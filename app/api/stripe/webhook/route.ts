import Stripe from "stripe";
import { ApiError, apiFailure, serverFirebase } from "../../../../lib/server/firebase-admin";
import { bookingAmount, paymentConfig } from "../../../../lib/server/payments";

export async function POST(request: Request) {
  try {
    const { stripe, webhook, test } = paymentConfig();
    if (!webhook) throw new ApiError(503, "Payment webhook is not configured.");
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new ApiError(400, "Missing Stripe signature.");
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(await request.text(), signature, webhook); }
    catch { throw new ApiError(400, "Invalid Stripe signature."); }
    if (event.livemode === test) throw new ApiError(400, "Wrong payment environment.");
    const { db } = serverFirebase();
    const eventRef = db.collection("stripeEvents").doc(event.id);
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired"].includes(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;
      if (!bookingId || session.metadata?.environment !== (test ? "test" : "production")) throw new ApiError(400, "Missing booking context.");
      if (event.type !== "checkout.session.expired" && session.payment_status !== "paid") return Response.json({ received: true });
      await db.runTransaction(async (tx) => {
        if ((await tx.get(eventRef)).exists) return;
        const ref = db.collection("bookings").doc(bookingId);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiError(409, "Booking not found.");
        const booking = snap.data()!;
        const version = Number(booking.reservationVersion || 1);
        if (session.metadata?.passengerId !== booking.passengerId || Number(session.metadata?.reservationVersion) !== version ||
            (booking.stripeCheckoutSessionId && booking.stripeCheckoutSessionId !== session.id)) {
          throw new ApiError(409, "Checkout does not match the booking.");
        }
        const now = new Date().toISOString();
        if (event.type === "checkout.session.expired") {
          if (booking.status === "payment_pending") tx.update(ref, { status: "reserved", paymentStatus: "unpaid", paymentId: "", stripeCheckoutSessionId: "", checkoutAttempt: Number(booking.checkoutAttempt || 0) + 1, updatedAt: now });
          tx.set(eventRef, { type: event.type, processedAt: now });
          return;
        }
        const amounts = bookingAmount(booking);
        if (session.amount_total !== amounts.cents || session.currency !== "usd") throw new ApiError(409, "Payment amount mismatch.");
        const paymentId = `stripe-${session.id}`;
        const paymentRef = db.collection("payments").doc(paymentId);
        const existing = await tx.get(paymentRef);
        if (existing.data()?.status === "paid" || existing.data()?.refundedCents > 0) {
          tx.set(eventRef, { type: event.type, processedAt: now }); return;
        }
        if (booking.status !== "payment_pending") throw new ApiError(409, "Booking is not awaiting payment; manual review required.");
        const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "";
        const identity = { bookingId, rideId: booking.rideId, passengerId: booking.passengerId, driverId: booking.driverId };
        tx.set(paymentRef, { ...identity, ...amounts, currency: "USD", provider: "stripe", status: "paid", stripeCheckoutSessionId: session.id, stripePaymentIntentId: intent, paidAt: now, updatedAt: now }, { merge: true });
        tx.update(ref, { status: "paid", paymentStatus: "paid", paymentId, stripeCheckoutSessionId: session.id, stripePaymentIntentId: intent, ...amounts, paidAt: now, updatedAt: now });
        tx.set(db.collection("walletTransactions").doc(`wallet-${paymentId}`), { ...identity, paymentId, amount: amounts.driverAmount, grossAmount: amounts.amount, platformFee: amounts.platformFee, type: "ride_payment", status: "pending_payout", createdAt: now, updatedAt: now });
        for (const [role, uid] of [["driver", booking.driverId], ["passenger", booking.passengerId]]) {
          tx.set(db.collection("notifications").doc(`payment-${role}-${paymentId}`), { userId: uid, type: "payment", title: "Booking paid", message: "Payment confirmed by Stripe.", bookingId, rideId: booking.rideId, read: false, createdAt: now });
        }
        tx.set(eventRef, { type: event.type, processedAt: now });
      });
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (!intent) throw new ApiError(400, "Refund has no payment intent.");
      const matches = await db.collection("payments").where("stripePaymentIntentId", "==", intent).limit(2).get();
      if (matches.size !== 1) throw new ApiError(409, "Refund requires manual payment matching.");
      await db.runTransaction(async (tx) => {
        if ((await tx.get(eventRef)).exists) return;
        const paymentRef = matches.docs[0].ref;
        const payment = (await tx.get(paymentRef)).data()!;
        const now = new Date().toISOString();
        const cents = Number(payment.cents || Math.round(Number(payment.amount) * 100));
        const refunded = Math.max(Number(payment.refundedCents || 0), charge.amount_refunded);
        if (!Number.isSafeInteger(cents) || cents <= 0 || charge.amount !== cents || !Number.isSafeInteger(refunded) || refunded < 0 || refunded > cents || charge.currency !== "usd") {
          throw new ApiError(409, "Refund amount mismatch.");
        }
        const full = refunded === cents;
        tx.update(paymentRef, { refundedCents: refunded, status: full ? "refunded" : "partially_refunded", updatedAt: now });
        tx.update(db.collection("bookings").doc(payment.bookingId), { paymentStatus: full ? "refunded" : "partially_refunded", updatedAt: now });
        tx.update(db.collection("walletTransactions").doc(`wallet-${paymentRef.id}`), { amount: Math.round(payment.driverAmount * (1 - refunded / cents) * 100) / 100, refundedCents: refunded, status: full ? "refunded" : "pending_payout", updatedAt: now });
        tx.set(eventRef, { type: event.type, processedAt: now });
      });
    }
    return Response.json({ received: true });
  } catch (error) { return apiFailure(error); }
}
