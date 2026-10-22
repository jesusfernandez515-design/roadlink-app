import { apiFailure, ApiError, documentId } from "../../../../lib/server/firebase-admin";
import { connectDriver } from "../../../../lib/server/connect";
export async function POST(request: Request) {
  try {
    const { user, db, stripe } = await connectDriver(request);
    const { walletId } = await request.json();
    const ref = db.collection("walletTransactions").doc(documentId(walletId));
    const account = (await db.collection("connectAccounts").doc(user.uid).get()).data();
    if (!account?.accountId) throw new ApiError(409, "Conecta tu cuenta con Stripe primero.");
    const destination = await stripe.accounts.retrieve(account.accountId);
    if (destination.metadata.roadlinkUserId !== user.uid || destination.capabilities?.transfers !== "active" || !destination.payouts_enabled) throw new ApiError(409, "Completa los requisitos de tu cuenta en Stripe.");
    const requestRef = db.collection("payoutRequests").doc(`connect-${ref.id}`);
    const job = await db.runTransaction(async (tx) => {
      const row = (await tx.get(ref)).data();
      if (!row || row.driverId !== user.uid) throw new ApiError(403, "Movimiento ajeno.");
      const old = (await tx.get(requestRef)).data();
      if (old?.transferId) return { ...old, done: true as const };
      if (!["available", "transferring"].includes(row.status) || Number(row.refundedCents || 0) !== 0) throw new ApiError(409, "Este importe no está disponible para transferir.");
      const booking = (await tx.get(db.collection("bookings").doc(documentId(row.bookingId)))).data();
      const payment = (await tx.get(db.collection("payments").doc(documentId(row.paymentId)))).data();
      if (!booking || booking.driverId !== user.uid || booking.status !== "completed" || booking.paymentStatus !== "paid" || !payment || payment.status !== "paid" || payment.bookingId !== row.bookingId || !String(payment.stripeCheckoutSessionId).startsWith("cs_test_") || Number(payment.refundedCents || 0) !== 0) throw new ApiError(409, "El pago requiere revisión.");
      const cents = Math.round(Number(row.amount) * 100);
      if (!Number.isSafeInteger(cents) || cents <= 0 || cents !== Math.round(Number(payment.driverAmount) * 100)) throw new ApiError(409, "El importe requiere revisión.");
      const startedAt = old?.startedAt || Date.now();
      if (Date.now() - startedAt > 20 * 3600000) throw new ApiError(409, "La transferencia requiere conciliación antes de reintentar.");
      const job = { userId: user.uid, amount: cents / 100, cents, destination: account.accountId, paymentIntent: payment.stripePaymentIntentId, walletId: ref.id, status: "processing", startedAt, createdAt: old?.createdAt || new Date().toISOString() };
      tx.update(ref, { status: "transferring" });
      tx.set(requestRef, job);
      return { ...job, done: false as const, transferId: "" };
    });
    if (job.done === true) return Response.json({ transferred: true });
    const intent = await stripe.paymentIntents.retrieve(job.paymentIntent as string, { expand: ["latest_charge"] });
    const charge = intent.latest_charge;
    if (intent.livemode || intent.status !== "succeeded" || !charge || typeof charge === "string" || charge.amount_refunded !== 0 || charge.currency !== "usd") throw new ApiError(409, "Stripe no confirma un pago de pruebas sin reembolso. El importe queda bloqueado para revisión.");
    const transfer = await stripe.transfers.create({ amount: job.cents as number, currency: "usd", destination: job.destination as string, source_transaction: charge.id, metadata: { roadlinkUserId: user.uid, walletId: ref.id, environment: "test" } }, { idempotencyKey: `roadlink-transfer-${ref.id}-${job.startedAt}` });
    await db.runTransaction(async (tx) => {
      const row = (await tx.get(ref)).data();
      if (row?.transferId === transfer.id) return;
      const needsReview = row?.status !== "transferring";
      const now = new Date().toISOString();
      tx.update(ref, { status: needsReview ? "transfer_review" : "transferred", transferId: transfer.id, transferredAt: now });
      tx.update(requestRef, { status: needsReview ? "transfer_review" : "transferred", transferId: transfer.id, updatedAt: now });
    });
    return Response.json({ transferred: true });
  } catch (error) { return apiFailure(error); }
}
