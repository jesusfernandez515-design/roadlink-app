import { connectDriver } from "../../../../lib/server/connect";
import { ApiError, apiFailure, documentId } from "../../../../lib/server/firebase-admin";
export async function POST(request: Request) {
  try {
    const { user, db, stripe } = await connectDriver(request);
    const { walletId } = await request.json();
    const ref = db.collection("walletTransactions").doc(documentId(walletId));
    const payoutRef = db.collection("payoutRequests").doc(`connect-${ref.id}`);
    const job = await db.runTransaction(async tx => {
      const row = (await tx.get(ref)).data();
      const payout = (await tx.get(payoutRef)).data();
      const account = (await tx.get(db.collection("connectAccounts").doc(user.uid))).data();
      if (!row || row.driverId !== user.uid || !payout || payout.userId !== user.uid) throw new ApiError(403, "Movimiento ajeno.");
      const payment = (await tx.get(db.collection("payments").doc(documentId(row.paymentId)))).data();
      if (!payment || payment.status !== "refunded" || payment.refundedCents !== payment.cents || !String(payment.stripeCheckoutSessionId).startsWith("cs_test_") || payment.bookingId !== row.bookingId || payout.paymentIntent !== payment.stripePaymentIntentId || payout.destination !== account?.accountId || row.transferId !== payout.transferId || !payout.transferId) throw new ApiError(409, "La recuperación requiere un reembolso completo y una transferencia verificada.");
      if (row.status !== "transfer_review" && !(row.status === "refunded" && row.reversalId)) throw new ApiError(409, "Este movimiento no requiere recuperación.");
      const startedAt = payout.reversalStartedAt || Date.now();
      tx.update(payoutRef, { reversalStartedAt: startedAt });
      return { transferId: String(payout.transferId), paymentIntent: String(payout.paymentIntent), destination: String(payout.destination), cents: Number(payout.cents), reversalId: String(payout.reversalId || ""), startedAt, paymentCents: payment.cents, expectedCents: Math.round(payment.driverAmount * 100) };
    });
    const transfer = await stripe.transfers.retrieve(job.transferId);
    const intent = await stripe.paymentIntents.retrieve(job.paymentIntent, { expand: ["latest_charge"] });
    const charge = intent.latest_charge;
    if (transfer.livemode || intent.livemode || transfer.currency !== "usd" || transfer.destination !== job.destination || transfer.metadata.walletId !== ref.id || transfer.amount !== job.expectedCents || transfer.amount !== job.cents || !charge || typeof charge === "string" || charge.currency !== "usd" || charge.amount !== job.paymentCents || charge.amount_refunded !== charge.amount || transfer.source_transaction !== charge.id) throw new ApiError(409, "Stripe no confirma la recuperación de este pago de pruebas.");
    let reversalId = job.reversalId || "";
    if (transfer.amount_reversed === 0) {
      if (Date.now() - job.startedAt > 20 * 3600000) throw new ApiError(409, "La recuperación requiere revisión antes de reintentar.");
      const reversal = await stripe.transfers.createReversal(transfer.id, { amount: transfer.amount, metadata: { environment: "test", walletId: ref.id } }, { idempotencyKey: `refund-recovery-${transfer.id}-${job.startedAt}` });
      reversalId = reversal.id;
    } else if (transfer.amount_reversed === transfer.amount) {
      const reversals = await stripe.transfers.listReversals(transfer.id, { limit: 100 });
      reversalId = reversals.data.find(r => r.amount === transfer.amount)?.id || reversalId;
      if (!reversalId) throw new ApiError(409, "La reversión existente requiere revisión.");
    } else throw new ApiError(409, "Hay una reversión parcial que requiere revisión.");
    await db.runTransaction(async tx => {
      const row = (await tx.get(ref)).data();
      if (row?.transferId !== transfer.id || !["transfer_review", "refunded"].includes(row.status)) throw new ApiError(409, "Stripe recuperó el importe; la cartera requiere revisión.");
      const now = new Date().toISOString();
      tx.update(ref, { status: "refunded", amount: 0, reversalId, recoveredCents: transfer.amount, updatedAt: now });
      tx.update(payoutRef, { status: "reversed", reversalId, recoveredCents: transfer.amount, updatedAt: now });
    });
    return Response.json({ recovered: true, amount: job.cents / 100 });
  } catch (error) { return apiFailure(error); }
}
