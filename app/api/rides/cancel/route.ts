import { ApiError, apiFailure, documentId, requirePassenger } from "../../../../lib/server/firebase-admin";

export async function POST(request: Request) {
  try {
    const { user, db } = await requirePassenger(request);
    const { rideId } = await request.json();
    const ref = db.collection("rides").doc(documentId(rideId));
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const ride = snap.data();
      if (!ride) throw new ApiError(404, "El viaje no existe.");
      if (ride.driverId !== user.uid) throw new ApiError(403, "Solo puedes cancelar tus propios viajes.");
      if (ride.status === "cancelled") return;
      if (!["active", "full"].includes(ride.status)) throw new ApiError(409, "Este viaje ya terminó o no se puede cancelar.");
      const bookings = await tx.get(db.collection("bookings").where("rideId", "==", ref.id).limit(101));
      if (bookings.size > 100) throw new ApiError(409, "Este viaje requiere revisión antes de cancelar.");
      const pending = bookings.docs.filter(doc => !["cancelled", "rejected"].includes(doc.data().status));
      if (pending.some(doc => {
        const b = doc.data();
        return b.status !== "reserved" || b.paymentStatus !== "unpaid" || b.paymentId || b.stripeCheckoutSessionId;
      })) throw new ApiError(409, "Hay reservas pagadas o pagos en proceso. Deben resolverse sus reembolsos antes de cancelar el viaje.");
      const now = new Date().toISOString();
      tx.update(ref, { status: "cancelled", cancelledAt: now, cancelledBy: user.uid, updatedAt: now });
      for (const booking of pending) {
        const b = booking.data();
        tx.update(booking.ref, { status: "cancelled", cancellationReason: "driver_cancelled_ride", updatedAt: now });
        tx.set(db.collection("notifications").doc(), { userId: b.passengerId, email: b.passengerEmail || "", type: "booking", title: "Viaje cancelado", message: "El conductor canceló el viaje. Tu reserva sin pago también fue cancelada.", rideId: ref.id, bookingId: booking.id, read: false, createdAt: now });
      }
    });
    return Response.json({ cancelled: true });
  } catch (error) { return apiFailure(error); }
}
