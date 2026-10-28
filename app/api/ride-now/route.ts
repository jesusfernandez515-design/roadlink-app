import { ApiError, apiFailure, requirePassenger } from "../../../lib/server/firebase-admin";
import { guestPassenger } from "../../../lib/server/guest";

const pilotDriver = "XmpCtSTIS6cf7r8UMc2UxLFj6qH3";
const headers = { "Cache-Control": "private, no-store" };
function enabled() {
  if (process.env.NEXT_PUBLIC_ROADLINK_ENV !== "test") throw new ApiError(503, "Viajar ahora está disponible solo en el piloto de pruebas.");
}
function text(value: unknown, label: string, min = 3, max = 200) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new ApiError(400, `Revisa ${label}.`);
  return value.trim();
}
export async function GET(request: Request) {
  try {
    enabled();
    const { user, db } = await requirePassenger(request);
    const driver = user.uid === pilotDriver;
    if (driver) {
      const rows = await db.collection("instantRequests").where("status", "==", "open").limit(51).get();
      if (rows.size > 50) throw new ApiError(503, "Hay demasiadas solicitudes. Vuelve a intentarlo en un momento.");
      // Exact guest contact is only released to the assigned driver after acceptance.
      const requests = rows.docs.map(item => ({ ...item.data(), id: item.id })).filter((item: any) => Date.parse(item.expiresAt) > Date.now()).map((item: any) => {
        const { guest, ...safe } = item;
        return { ...safe, forGuest: Boolean(guest), guest: undefined };
      });
      return Response.json({ driver, requests }, { headers });
    }
    const snap = await db.collection("instantRequests").doc(user.uid).get();
    const value = snap.data();
    return Response.json({ driver, requests: value ? [{ ...value, id: snap.id }] : [] }, { headers });
  } catch (error) { return apiFailure(error); }
}
export async function POST(request: Request) {
  try {
    enabled();
    const { user, db } = await requirePassenger(request);
    const body = await request.json();
    const driver = user.uid === pilotDriver;
    const action = body.action;
    if (!["request", "offer", "accept", "cancel"].includes(action)) throw new ApiError(400, "Acción no válida.");
    if (action === "request" && driver) throw new ApiError(403, "Usa tu cuenta de pasajero para solicitar un viaje.");
    if (action === "offer" && !driver) throw new ApiError(403, "Solo el conductor del piloto puede ofrecer una recogida.");
    const id = action === "offer" ? text(body.requestId, "la solicitud", 1, 128) : user.uid;
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new ApiError(400, "Referencia no válida.");
    const ref = db.collection("instantRequests").doc(id);
    const now = Date.now(), stamp = new Date(now).toISOString();
    const input = action === "request" ? {
      from: text(body.from, "el punto de recogida"), to: text(body.to, "el destino"),
      guest: guestPassenger(body), version: crypto.randomUUID().replace(/-/g, ""),
    } : null;
    const offer = action === "offer" ? {
      id: crypto.randomUUID(), driverId: user.uid, driverEmail: user.email || "", vehicle: text(body.vehicle, "el vehículo", 2, 80),
      price: Number(body.price), pickupMinutes: Number(body.pickupMinutes), durationMinutes: Number(body.durationMinutes),
      expiresAt: new Date(now + 5 * 60000).toISOString(),
    } : null;
    if (offer && (!Number.isFinite(offer.price) || Math.round(offer.price * 100) < 50 || offer.price > 1000 ||
      !Number.isInteger(offer.pickupMinutes) || offer.pickupMinutes < 2 || offer.pickupMinutes > 30 ||
      !Number.isInteger(offer.durationMinutes) || offer.durationMinutes < 5 || offer.durationMinutes > 240)) {
      throw new ApiError(400, "Indica un precio entre $0.50 y $1000, recogida de 2 a 30 minutos y duración de 5 a 240 minutos.");
    }
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref), current = snap.data();
      if (input) {
        if (current?.status === "open" && Date.parse(current.expiresAt) > now) throw new ApiError(409, "Ya tienes una solicitud abierta. Cancélala antes de crear otra.");
        tx.set(ref, { ...input, passengerId: user.uid, passengerEmail: user.email || "", status: "open",
          travelFor: input.guest ? "guest" : "self", offer: null, createdAt: stamp, expiresAt: new Date(now + 15 * 60000).toISOString() });
        return { requested: true };
      }
      if (!current) throw new ApiError(404, "Solicitud no encontrada.");
      if (action !== "offer" && current.passengerId !== user.uid) throw new ApiError(403, "Esta solicitud no pertenece a tu cuenta.");
      if (body.version !== current.version) throw new ApiError(409, "La solicitud cambió. Actualiza la pantalla.");
      if (action === "accept" && current.status === "accepted") return { bookingId: current.bookingId };
      if (action === "cancel" && current.status === "cancelled") return { cancelled: true };
      if (current.status !== "open" || Date.parse(current.expiresAt) <= now) throw new ApiError(409, "Esta solicitud ya está cerrada o caducó.");
      if (action === "cancel") { tx.update(ref, { status: "cancelled", updatedAt: stamp }); return { cancelled: true }; }
      if (offer) {
        const lock = (await tx.get(db.collection("instantDriverLocks").doc(user.uid))).data();
        if (lock?.rideId) throw new ApiError(409, "Ya tienes un viaje inmediato asignado. Finalízalo o cancélalo antes de ofrecer otra recogida.");
        tx.update(ref, { offer: { ...offer, price: Math.round(offer.price * 100) / 100 }, updatedAt: stamp });
        return { offered: true };
      }
      const selected = current.offer;
      if (!selected || selected.driverId !== pilotDriver || Date.parse(selected.expiresAt) <= now) throw new ApiError(409, "La oferta caducó. Espera una nueva propuesta.");
      // Confirm the exact quote the passenger saw; a newer price needs fresh acceptance.
      if (body.offerId !== selected.id || body.offerExpiresAt !== selected.expiresAt) throw new ApiError(409, "La oferta cambió. Revisa el precio antes de aceptar.");
      const lockRef = db.collection("instantDriverLocks").doc(selected.driverId);
      const lock = (await tx.get(lockRef)).data();
      if (lock?.rideId) throw new ApiError(409, "El conductor acaba de aceptar otro viaje. Solicita otra recogida.");
      const rideId = `now_${current.version}`, bookingId = `${rideId}_${user.uid}`;
      const departure = now + selected.pickupMinutes * 60000;
      const local = new Date(departure - 4 * 3600000).toISOString();
      const amount = selected.price, fee = Math.round(amount * 12) / 100;
      const shared = { driverId: selected.driverId, driverEmail: selected.driverEmail, from: current.from, to: current.to,
        date: local.slice(0, 10), time: local.slice(11, 16), price: amount, durationMinutes: selected.durationMinutes,
        rideType: "now", requestId: ref.id, createdAt: stamp, updatedAt: stamp };
      tx.set(db.collection("rides").doc(rideId), { ...shared, vehicle: selected.vehicle, seats: 0, originalSeats: 1, status: "full",
        notes: "Viaje inmediato de prueba. Recogida y duración estimadas por el conductor.", durationText: `${selected.durationMinutes} min estimados` });
      tx.set(db.collection("bookings").doc(bookingId), { ...shared, rideId, passengerId: user.uid, passengerEmail: user.email || "",
        passengerEmailLower: (user.email || "").toLowerCase(), seatsBooked: 1, amount, platformFee: fee, driverAmount: amount - fee,
        currency: "USD", status: "reserved", paymentStatus: "unpaid", paymentId: "", stripeCheckoutSessionId: "",
        reservationVersion: 1, guest: current.guest || null, travelFor: current.travelFor });
      tx.set(lockRef, { rideId, until: new Date(departure + selected.durationMinutes * 60000).toISOString() });
      tx.update(ref, { status: "accepted", bookingId, rideId, updatedAt: stamp });
      tx.set(db.collection("notifications").doc(), { userId: selected.driverId, email: selected.driverEmail, type: "booking",
        title: "Viaje inmediato reservado", message: "El pasajero aceptó tu propuesta. Revisa la reserva y el pago de prueba.",
        bookingId, rideId, read: false, createdAt: stamp });
      return { bookingId };
    });
    return Response.json(result, { headers });
  } catch (error) { return apiFailure(error); }
}
