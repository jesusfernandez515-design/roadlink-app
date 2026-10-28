import { ApiError, apiFailure, documentId, requirePassenger } from "../../../../lib/server/firebase-admin";

export async function POST(request: Request) {
  try {
    const { user, db } = await requirePassenger(request);
    const { rideId: input } = await request.json();
    const rideId = documentId(input);
    const rideRef = db.collection("rides").doc(rideId);
    // One deterministic reservation per passenger and ride prevents concurrent duplicates.
    const bookingRef = db.collection("bookings").doc(`${rideId}_${user.uid}`);
    await db.runTransaction(async (tx) => {
      const rideSnap = await tx.get(rideRef);
      const prior = await tx.get(bookingRef);
      const legacy = await tx.get(db.collection("bookings").where("rideId", "==", rideId).where("passengerId", "==", user.uid));
      if (!rideSnap.exists) throw new ApiError(404, "Viaje no encontrado.");
      if ((prior.exists && !["cancelled", "rejected"].includes(prior.data()!.status)) ||
          legacy.docs.some((item) => !["cancelled", "rejected"].includes(item.data().status))) {
        throw new ApiError(409, "Ya reservaste este viaje.");
      }
      const ride = rideSnap.data()!;
      if (ride.driverId === user.uid) throw new ApiError(403, "No puedes reservar tu propio viaje.");
      const departure = new Date(`${ride.date}T${ride.time}-04:00`).getTime();
      if (!Number.isFinite(departure) || departure <= Date.now() || ride.status !== "active" || !Number.isInteger(ride.seats) || ride.seats < 1) {
        throw new ApiError(409, "Este viaje ya no está disponible.");
      }
      if (!Number.isFinite(ride.price) || ride.price <= 0) throw new ApiError(409, "El precio del viaje no es válido.");
      const now = new Date().toISOString();
      const amount = Math.round(ride.price * 100) / 100;
      const fee = Math.round(amount * 12) / 100;
      tx.set(bookingRef, {
        rideId, passengerId: user.uid, passengerEmail: user.email || "", passengerEmailLower: (user.email || "").toLowerCase(),
        driverId: ride.driverId, driverEmail: ride.driverEmail || "", from: ride.from, to: ride.to, date: ride.date, time: ride.time,
        price: amount, amount, platformFee: fee, driverAmount: amount - fee, seatsBooked: 1, currency: "USD",
        status: "reserved", paymentStatus: "unpaid", paymentId: "", stripeCheckoutSessionId: "", createdAt: now, updatedAt: now,
        reservationVersion: Number(prior.data()?.reservationVersion || 0) + 1,
      });
      tx.update(rideRef, { seats: ride.seats - 1, status: ride.seats === 1 ? "full" : "active", updatedAt: now });
      tx.set(db.collection("notifications").doc(), { userId: ride.driverId, email: ride.driverEmail || "", type: "booking", title: "Nueva reserva de viaje", message: "Un pasajero reservó un asiento.", bookingId: bookingRef.id, rideId, read: false, createdAt: now });
    });
    return Response.json({ bookingId: bookingRef.id });
  } catch (error) { return apiFailure(error); }
}
