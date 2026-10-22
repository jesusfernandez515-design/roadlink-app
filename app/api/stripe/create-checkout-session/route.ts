import { ApiError, apiFailure, documentId, requirePassenger } from "../../../../lib/server/firebase-admin";
import { bookingAmount, paymentConfig } from "../../../../lib/server/payments";

export async function POST(request: Request) {
  try {
    const { user, db } = await requirePassenger(request);
    const { stripe, test } = paymentConfig();
    const { bookingId: input } = await request.json();
    const bookingId = documentId(input);
    const ref = db.collection("bookings").doc(bookingId);
    const booking = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiError(404, "Booking not found.");
      const value = snap.data()!;
      if (value.passengerId !== user.uid) throw new ApiError(403, "This booking belongs to another passenger.");
      if (!["reserved", "payment_pending"].includes(value.status) || !["unpaid", "pending"].includes(value.paymentStatus)) {
        throw new ApiError(409, "This booking cannot be paid.");
      }
      const ride = await tx.get(db.collection("rides").doc(value.rideId));
      const departure = new Date(`${value.date}T${value.time}`).getTime();
      if (!ride.exists || !["active", "full"].includes(ride.data()!.status) || !Number.isFinite(departure) || departure <= Date.now()) {
        throw new ApiError(409, "This ride cannot accept payment.");
      }
      bookingAmount(value);
      tx.update(ref, { status: "payment_pending", paymentStatus: "pending", updatedAt: new Date().toISOString() });
      return value;
    });
    if (booking.stripeCheckoutSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(booking.stripeCheckoutSessionId);
      if (existing.status === "open" && existing.url) return Response.json({ url: existing.url, sessionId: existing.id });
      throw new ApiError(409, "The checkout session is closed; payment status requires review.");
    }
    const amounts = bookingAmount(booking);
    // Use the origin serving the authenticated request, never a browser-supplied redirect URL.
    const origin = new URL(request.url).origin;
    const version = Number(booking.reservationVersion || 1);
    const attempt = Number(booking.checkoutAttempt || 0);
    const session = await stripe.checkout.sessions.create({
      mode: "payment", customer_email: user.email, payment_method_types: ["card"],
      client_reference_id: bookingId,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: amounts.cents, product_data: { name: `RoadLink: ${booking.from} to ${booking.to}` } } }],
      metadata: { bookingId, passengerId: user.uid, reservationVersion: String(version), environment: test ? "test" : "production" },
      success_url: `${origin}/my-bookings?payment=success`, cancel_url: `${origin}/my-bookings?payment=cancelled`,
    }, { idempotencyKey: `roadlink-${test ? "test" : "live"}-${bookingId}-${version}-${attempt}` });
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.data();
      if (!current || current.status !== "payment_pending" || Number(current.reservationVersion || 1) !== version) {
        // A webhook may already have confirmed this exact session.
        if (current?.status === "paid" && current.stripeCheckoutSessionId === session.id) return;
        throw new ApiError(409, "Booking changed during checkout. Contact support.");
      }
      const now = new Date().toISOString();
      const paymentId = `stripe-${session.id}`;
      tx.set(db.collection("payments").doc(paymentId), {
        bookingId, rideId: booking.rideId, passengerId: user.uid, passengerEmail: user.email || "",
        driverId: booking.driverId, driverEmail: booking.driverEmail || "", ...amounts,
        currency: "USD", status: "pending", provider: "stripe", stripeCheckoutSessionId: session.id,
        reservationVersion: version, createdAt: now, updatedAt: now,
      }, { merge: true });
      tx.update(ref, { paymentId, stripeCheckoutSessionId: session.id, ...amounts, updatedAt: now });
    });
    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) { return apiFailure(error); }
}
