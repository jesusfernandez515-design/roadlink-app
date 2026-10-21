import { ApiError, apiFailure, documentId, requirePassenger } from "../../../../lib/server/firebase-admin";

export async function POST(request: Request) {
  try {
    const { user, db } = await requirePassenger(request);
    const { bookingId: input } = await request.json();
    const bookingRef = db.collection("bookings").doc(documentId(input));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) throw new ApiError(404, "Booking not found.");
      const booking = snap.data()!;
      if (booking.passengerId !== user.uid) throw new ApiError(403, "You can only cancel your own booking.");
      if (["cancelled", "rejected"].includes(booking.status)) return;
      // A session may still be payable even before its webhook arrives.
      if (booking.status !== "reserved" || booking.paymentStatus !== "unpaid" || booking.stripeCheckoutSessionId || booking.paymentId) {
        throw new ApiError(409, "This booking requires payment or refund review before cancellation.");
      }
      const rideRef = db.collection("rides").doc(booking.rideId);
      const rideSnap = await tx.get(rideRef);
      if (!rideSnap.exists) throw new ApiError(409, "Linked ride no longer exists.");
      const ride = rideSnap.data()!;
      const seats = Number(booking.seatsBooked);
      if (!Number.isInteger(seats) || seats < 1 || !Number.isInteger(ride.seats) || ride.seats + seats > ride.originalSeats) {
        throw new ApiError(409, "Seat counts require review.");
      }
      const now = new Date().toISOString();
      tx.update(bookingRef, { status: "cancelled", updatedAt: now });
      tx.update(rideRef, { seats: ride.seats + seats, ...(ride.status === "full" ? { status: "active" } : {}), updatedAt: now });
      tx.set(db.collection("notifications").doc(), { userId: booking.driverId, email: booking.driverEmail || "", type: "booking", title: "Booking cancelled", message: "A passenger cancelled a booking.", read: false, bookingId: snap.id, rideId: booking.rideId, createdAt: now });
    });
    return Response.json({ cancelled: true });
  } catch (error) { return apiFailure(error); }
}
