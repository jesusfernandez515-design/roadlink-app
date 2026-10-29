import { notificationRef, deliverNotificationPush, type PushAlert } from "../../../../lib/server/notification-push";
import { ApiError, apiFailure, documentId, requirePassenger } from "../../../../lib/server/firebase-admin";

import { paymentConfig } from "../../../../lib/server/payments";

export async function POST(request: Request) {
  const pushAlerts: PushAlert[] = [];
  try {
    const { user, db } = await requirePassenger(request);
    const { bookingId: input } = await request.json();
    const bookingRef = db.collection("bookings").doc(documentId(input));
    const initial = (await bookingRef.get()).data();
    if (!initial) throw new ApiError(404, "Reserva no encontrada.");
    if (initial.passengerId !== user.uid) throw new ApiError(403, "Solo puedes cancelar tus propias reservas.");
    let closedSessionId = "";
    if (!["cancelled", "rejected"].includes(initial.status) && initial.stripeCheckoutSessionId &&
        ["reserved", "payment_pending"].includes(initial.status) && ["unpaid", "pending"].includes(initial.paymentStatus)) {
      const { stripe } = paymentConfig();
      const sessionId = initial.stripeCheckoutSessionId;
      if (!sessionId.startsWith("cs_test_")) throw new ApiError(409, "La sesión de pago requiere revisión.");
      const verify = (session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>) => {
        if (session.livemode !== false || session.id !== sessionId || session.metadata?.bookingId !== bookingRef.id ||
            session.metadata?.passengerId !== user.uid || session.metadata?.environment !== "test" ||
            Number(session.metadata?.reservationVersion) !== Number(initial.reservationVersion || 1)) {
          throw new ApiError(409, "La sesión de pago no corresponde a esta reserva.");
        }
        if (session.payment_status !== "unpaid" || !["open", "expired"].includes(session.status || "")) {
          throw new ApiError(409, "El pago ya se completó o está procesándose. Contacta con soporte para revisar su cancelación.");
        }
      };
      let session = await stripe.checkout.sessions.retrieve(sessionId);
      verify(session);
      if (session.status === "open") {
        try { session = await stripe.checkout.sessions.expire(sessionId); }
        catch { session = await stripe.checkout.sessions.retrieve(sessionId); }
        verify(session);
      }
      if (session.status !== "expired") throw new ApiError(409, "No se pudo cerrar el pago pendiente. Intenta cancelar de nuevo.");
      closedSessionId = sessionId;
    }
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) throw new ApiError(404, "Reserva no encontrada.");
      const booking = snap.data()!;
      if (booking.passengerId !== user.uid) throw new ApiError(403, "Solo puedes cancelar tus propias reservas.");
      if (["cancelled", "rejected"].includes(booking.status)) return;
      const closedCheckout = closedSessionId && booking.stripeCheckoutSessionId === closedSessionId &&
        Number(booking.reservationVersion || 1) === Number(initial.reservationVersion || 1) &&
        ["reserved", "payment_pending"].includes(booking.status) && ["unpaid", "pending"].includes(booking.paymentStatus) &&
        (!booking.paymentId || booking.paymentId === `stripe-${closedSessionId}`);
      const neverPaid = booking.status === "reserved" && booking.paymentStatus === "unpaid" && !booking.stripeCheckoutSessionId && !booking.paymentId;
      if (Number(booking.reservationVersion || 1) !== Number(initial.reservationVersion || 1) || (!neverPaid && !closedCheckout)) {
        throw new ApiError(409, "El pago está procesándose o requiere revisión. Espera unos segundos e intenta de nuevo; si ya pagaste, contacta con soporte.");
      }
      const paymentRef = closedSessionId ? db.collection("payments").doc(`stripe-${closedSessionId}`) : null;
      const payment = paymentRef ? (await tx.get(paymentRef)).data() : null;
      if (payment && payment.status !== "pending" && payment.status !== "cancelled") throw new ApiError(409, "El pago requiere revisión antes de cancelar.");
      const rideRef = db.collection("rides").doc(booking.rideId);
      const rideSnap = await tx.get(rideRef);
      if (!rideSnap.exists) throw new ApiError(409, "El viaje asociado ya no existe.");
      const ride = rideSnap.data()!;
      const seats = Number(booking.seatsBooked);
      if (!Number.isInteger(seats) || seats < 1 || !Number.isInteger(ride.seats) || ride.seats + seats > ride.originalSeats) {
        throw new ApiError(409, "La disponibilidad de asientos requiere revisión.");
      }
      const now = new Date().toISOString();
      const lockRef = ride.rideType === "now" ? db.collection("instantDriverLocks").doc(ride.driverId) : null;
      const lock = lockRef ? (await tx.get(lockRef)).data() : null;
      tx.update(bookingRef, { status: "cancelled", paymentStatus: "unpaid", stripeCheckoutSessionId: "", paymentId: "", checkoutAttempt: Number(booking.checkoutAttempt || 0) + 1, updatedAt: now });
      if (paymentRef && payment) tx.update(paymentRef, { status: "cancelled", updatedAt: now });
      tx.update(rideRef, { seats: ride.seats + seats, ...(ride.rideType === "now" ? { status: "cancelled" } : ride.status === "full" ? { status: "active" } : {}), updatedAt: now });
      if (lockRef && lock?.rideId === rideRef.id) tx.set(lockRef, { rideId: "", until: now });
      tx.set(notificationRef(db, pushAlerts, "driver"), { userId: booking.driverId, email: booking.driverEmail || "", type: "booking", title: "Reserva cancelada", message: "Un pasajero canceló una reserva.", read: false, bookingId: snap.id, rideId: booking.rideId, createdAt: now });
    });
    await deliverNotificationPush(pushAlerts);
    return Response.json({ cancelled: true });
  } catch (error) { return apiFailure(error); }
}
