import { ApiError, apiFailure, documentId, requirePassenger } from "../../../../lib/server/firebase-admin";

// One specific fictitious pilot booking. Never enabled for production.
const pilotBooking = "UWfkcqsR5lRSwIxqghk5_DefaRi3pT2c5ZKs5gwc66lywFWN2";
export async function POST(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_ROADLINK_ENV !== "test") throw new ApiError(404, "Not found.");
    const { user, db } = await requirePassenger(request);
    if (user.uid !== "XmpCtSTIS6cf7r8UMc2UxLFj6qH3") throw new ApiError(403, "Only the pilot driver can prepare this test.");
    const { bookingId } = await request.json();
    if (documentId(bookingId) !== pilotBooking) throw new ApiError(403, "This option only applies to the designated test booking.");
    const ref = db.collection("bookings").doc(pilotBooking);
    await db.runTransaction(async (tx) => {
      const booking = (await tx.get(ref)).data();
      if (!booking || booking.driverId !== user.uid || booking.status !== "confirmed" || booking.paymentStatus !== "paid" || !String(booking.stripeCheckoutSessionId).startsWith("cs_test_")) {
        throw new ApiError(409, "The confirmed test payment could not be verified.");
      }
      const rideRef = db.collection("rides").doc(documentId(booking.rideId));
      const ride = (await tx.get(rideRef)).data();
      const siblings = await tx.get(db.collection("bookings").where("rideId", "==", booking.rideId));
      if (!ride || ride.driverId !== user.uid || !["active", "full"].includes(ride.status) || siblings.docs.some((item) => item.id !== pilotBooking && !["cancelled", "rejected"].includes(item.data().status))) {
        throw new ApiError(409, "The ride cannot be adjusted independently.");
      }
      const minutes = Number(ride.durationMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) throw new ApiError(409, "A valid trip duration is required.");
      if (booking.testArrivalPreparedAt) return;
      // Yesterday at 00:00 Puerto Rico; keeps the ordinary arrival guard in force.
      const date = new Date(Date.now() - 28 * 3600000).toISOString().slice(0, 10);
      const update = { date, time: "00:00", testArrivalPreparedAt: new Date().toISOString(), originalTestSchedule: { date: ride.date, time: ride.time } };
      tx.update(rideRef, update);
      tx.update(ref, update);
      // No wallet or payment write: finishing the trip remains a separate action.
    });
    return Response.json({ prepared: true });
  } catch (error) { return apiFailure(error); }
}
