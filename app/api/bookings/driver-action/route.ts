import { ApiError, apiFailure, documentId, requirePassenger } from "../../../../lib/server/firebase-admin";

export async function POST(request: Request) {
  try {
    const { user, db } = await requirePassenger(request);
    const { bookingId, action } = await request.json();
    if (action !== "confirm" && action !== "complete") throw new ApiError(400, "Invalid action.");
    const ref = db.collection("bookings").doc(documentId(bookingId));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiError(404, "Booking not found.");
      const booking = snap.data()!;
      if (booking.driverId !== user.uid) throw new ApiError(403, "Only the assigned driver can update this booking.");
      const rideRef = db.collection("rides").doc(documentId(booking.rideId));
      const rideSnap = await tx.get(rideRef);
      const ride = rideSnap.data();
      if (!ride || ride.driverId !== user.uid) throw new ApiError(403, "Ride ownership mismatch.");
      if (booking.paymentStatus !== "paid") throw new ApiError(409, "La reserva debe estar pagada y sin reembolsos.");
      if (action === "confirm" && ["confirmed", "completed"].includes(booking.status)) return;
      if (action === "complete" && booking.status === "completed") return;
      if (!["active", "full"].includes(ride.status)) throw new ApiError(409, "El viaje no está activo.");
      if (action === "confirm" && booking.status !== "paid") throw new ApiError(409, "Esta reserva no se puede confirmar.");
      if (action === "complete" && booking.status !== "confirmed") throw new ApiError(409, "Confirma primero la reserva.");
      const now = new Date().toISOString();
      if (action === "confirm") {
        tx.update(ref, { status: "confirmed", confirmedAt: now, updatedAt: now });
      } else {
        // Puerto Rico pilot: do not release funds before the scheduled arrival.
        const start = Date.parse(`${ride.date}T${ride.time}:00-04:00`);
        const minutes = Number(ride.durationMinutes);
        if (!Number.isFinite(start) || !Number.isFinite(minutes) || minutes <= 0 || Date.now() < start + minutes * 60000) {
          throw new ApiError(409, "Solo puedes finalizar después de la llegada prevista, con una duración válida.");
        }
        const walletRef = db.collection("walletTransactions").doc(`wallet-${documentId(booking.paymentId)}`);
        const wallet = (await tx.get(walletRef)).data();
        if (!wallet || wallet.bookingId !== snap.id || wallet.driverId !== user.uid || wallet.status !== "pending_payout" || Number(wallet.refundedCents || 0) !== 0 || !(wallet.amount > 0)) {
          throw new ApiError(409, "El movimiento de pago requiere revisión.");
        }
        const siblings = await tx.get(db.collection("bookings").where("rideId", "==", booking.rideId));
        const allDone = siblings.docs.every((item) => item.id === snap.id || ["completed", "cancelled", "rejected"].includes(item.data().status));
        tx.update(ref, { status: "completed", completedAt: now, updatedAt: now });
        tx.update(walletRef, { status: "available", availableAt: now, updatedAt: now });
        if (allDone) tx.update(rideRef, { status: "completed", completedAt: now, updatedAt: now });
      }
      tx.set(db.collection("notifications").doc(), { userId: booking.passengerId, email: booking.passengerEmail || "", type: "booking", title: action === "confirm" ? "Reserva confirmada" : "Viaje terminado", message: action === "confirm" ? "El conductor confirmó tu reserva." : "El conductor marcó tu viaje como terminado.", read: false, bookingId: snap.id, rideId: booking.rideId, createdAt: now });
    });
    return Response.json({ updated: true });
  } catch (error) { return apiFailure(error); }
}
