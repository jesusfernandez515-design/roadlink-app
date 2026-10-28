import { ApiError, apiFailure, documentId, requirePassenger } from "../../../../lib/server/firebase-admin";

export async function POST(request: Request) {
  try {
    const { user, db } = await requirePassenger(request);
    const { bookingId: input } = await request.json();
    const bookingRef = db.collection("bookings").doc(documentId(input));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) throw new ApiError(404, "Reserva no encontrada.");
      const booking = snap.data()!;
      if (booking.passengerId !== user.uid) throw new ApiError(403, "Solo puedes cancelar tus propias reservas.");
      if (["cancelled", "rejected"].includes(booking.status)) return;
      // A session may still be payable even before its webhook arrives.
      if (booking.status !== "reserved" || booking.paymentStatus !== "unpaid" || booking.stripeCheckoutSessionId || booking.paymentId) {
        throw new ApiError(409, "Antes de cancelar esta reserva, hay que revisar su pago o reembolso.");
      }
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
      tx.update(bookingRef, { status: "cancelled", updatedAt: now });
      tx.update(rideRef, { seats: ride.seats + seats, ...(ride.rideType === "now" ? { status: "cancelled" } : ride.status === "full" ? { status: "active" } : {}), updatedAt: now });
      if (lockRef && lock?.rideId === rideRef.id) tx.set(lockRef, { rideId: "", until: now });
      tx.set(db.collection("notifications").doc(), { userId: booking.driverId, email: booking.driverEmail || "", type: "booking", title: "Reserva cancelada", message: "Un pasajero canceló una reserva.", read: false, bookingId: snap.id, rideId: booking.rideId, createdAt: now });
    });
    return Response.json({ cancelled: true });
  } catch (error) { return apiFailure(error); }
}
