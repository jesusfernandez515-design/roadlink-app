import { notificationRef, deliverNotificationPush, type PushAlert } from "../../../lib/server/notification-push";
import type { Firestore, DocumentReference } from "firebase-admin/firestore";
import { apiFailure, ApiError, documentId, requirePassenger } from "../../../lib/server/firebase-admin";

const headers = { "Cache-Control": "private, no-store" };
function member(booking: Record<string, any>, uid: string) {
  if (booking.driverId !== uid && booking.passengerId !== uid) throw new ApiError(403, "Esta conversación no pertenece a tu cuenta.");
  if (!booking.driverId || !booking.passengerId || booking.driverId === booking.passengerId) throw new ApiError(409, "La reserva no permite una conversación.");
}
function maySend(booking: Record<string, any>) {
  return ["reserved", "payment_pending", "paid", "confirmed", "completed"].includes(booking.status);
}
async function conversation(db: Firestore, uid: string, chatId: string) {
  const ref = db.collection("chats").doc(documentId(chatId));
  const chat = (await ref.get()).data();
  if (!chat) throw new ApiError(404, "Conversación no encontrada.");
  member(chat, uid);
  // The chat document alone never grants access: verify its actual booking too.
  let bookingRef: DocumentReference;
  if (chat.bookingId) bookingRef = db.collection("bookings").doc(documentId(chat.bookingId));
  else {
    const matches = await db.collection("bookings").where("rideId", "==", chat.rideId).where("passengerId", "==", chat.passengerId).where("driverId", "==", chat.driverId).limit(1).get();
    if (!matches.size) throw new ApiError(403, "No hay una reserva asociada a esta conversación.");
    bookingRef = matches.docs[0].ref;
  }
  const booking = (await bookingRef.get()).data();
  if (!booking || booking.rideId !== chat.rideId || booking.driverId !== chat.driverId || booking.passengerId !== chat.passengerId) throw new ApiError(403, "La conversación no coincide con su reserva.");
  member(booking, uid);
  return { ref, chat, bookingRef, booking };
}
export async function GET(request: Request) {
  try {
    const { user, db } = await requirePassenger(request);
    const { ref, chat, booking } = await conversation(db, user.uid, new URL(request.url).searchParams.get("chatId") || "");
    const history = await db.collection("messages").where("chatId", "==", ref.id).limit(101).get();
    if (history.size > 100) throw new ApiError(409, "Esta conversación requiere consultar el historial con soporte.");
    const messages = history.docs.map(item => {
      const value = item.data();
      return { id: item.id, senderId: value.senderId, text: typeof value.text === "string" ? value.text : "", createdAt: value.createdAt || "" };
    }).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return Response.json({ chat: { id: ref.id, rideId: chat.rideId, driverId: chat.driverId, passengerId: chat.passengerId, driverEmail: chat.driverEmail || "", passengerEmail: chat.passengerEmail || "", from: booking.from || "", to: booking.to || "" }, messages, canSend: maySend(booking) }, { headers });
  } catch (error) { return apiFailure(error); }
}
export async function POST(request: Request) {
  const pushAlerts: PushAlert[] = [];
  try {
    const { user, db } = await requirePassenger(request);
    const body = await request.json();
    if (body.action === "open") {
      let bookingRef: DocumentReference;
      if (body.bookingId) bookingRef = db.collection("bookings").doc(documentId(body.bookingId));
      else {
        const rideId = documentId(body.rideId);
        const ride = (await db.collection("rides").doc(rideId).get()).data();
        if (!ride) throw new ApiError(404, "Viaje no encontrado.");
        const passengerId = user.uid === ride.driverId ? documentId(body.passengerId) : user.uid;
        const matches = await db.collection("bookings").where("rideId", "==", rideId).where("passengerId", "==", passengerId).where("driverId", "==", ride.driverId).limit(1).get();
        if (!matches.size) throw new ApiError(403, "Reserva un asiento antes de abrir esta conversación.");
        bookingRef = matches.docs[0].ref;
      }
      const booking = (await bookingRef.get()).data();
      if (!booking) throw new ApiError(404, "Reserva no encontrada.");
      member(booking, user.uid);
      const chatId = documentId(`${booking.rideId}_${booking.driverId}_${booking.passengerId}`);
      const chatRef = db.collection("chats").doc(chatId);
      await db.runTransaction(async tx => {
        const [currentBooking, existing] = await Promise.all([tx.get(bookingRef), tx.get(chatRef)]);
        const current = currentBooking.data();
        if (!current || current.driverId !== booking.driverId || current.passengerId !== booking.passengerId || current.rideId !== booking.rideId) throw new ApiError(409, "La reserva cambió. Actualiza la página.");
        member(current, user.uid);
        if (existing.exists) {
          const value = existing.data()!;
          if (value.driverId !== booking.driverId || value.passengerId !== booking.passengerId || value.rideId !== booking.rideId) throw new ApiError(409, "La conversación requiere revisión.");
          return;
        }
        if (!maySend(current)) throw new ApiError(409, "Esta reserva está cerrada.");
        const now = new Date().toISOString();
        tx.set(chatRef, { chatId, bookingId: bookingRef.id, rideId: booking.rideId, driverId: booking.driverId, passengerId: booking.passengerId, driverEmail: booking.driverEmail || "", passengerEmail: booking.passengerEmail || "", participants: [booking.driverId, booking.passengerId], unread: { [booking.driverId]: 0, [booking.passengerId]: 0 }, createdAt: now, updatedAt: now });
      });
      return Response.json({ chatId }, { headers });
    }
    if (!["send", "read"].includes(body.action)) throw new ApiError(400, "Acción no válida.");
    const { ref, bookingRef } = await conversation(db, user.uid, body.chatId);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (body.action === "send" && (!text || text.length > 2000)) throw new ApiError(400, "Escribe entre 1 y 2000 caracteres.");
    const messageRef = body.action === "send" ? db.collection("messages").doc(documentId(`msg_${user.uid}_${documentId(body.messageId)}`)) : null;
    await db.runTransaction(async tx => {
      const bookingSnap = await tx.get(bookingRef);
      const chatSnap = await tx.get(ref);
      const existing = messageRef ? await tx.get(messageRef) : null;
      const booking = bookingSnap.data();
      const chat = chatSnap.data();
      if (!booking || !chat) throw new ApiError(404, "Conversación no disponible.");
      member(booking, user.uid);
      if (chat.driverId !== booking.driverId || chat.passengerId !== booking.passengerId || chat.rideId !== booking.rideId) throw new ApiError(403, "La conversación cambió.");
      const now = new Date().toISOString();
      if (body.action === "read") {
        if (chat.unread?.[user.uid]) tx.update(ref, { unread: { ...(chat.unread || {}), [user.uid]: 0 } });
        return;
      }
      if (!maySend(booking)) throw new ApiError(409, "Esta reserva está cerrada; puedes consultar su historial.");
      if (existing?.exists) {
        const value = existing.data()!;
        if (value.chatId !== ref.id || value.senderId !== user.uid || value.text !== text) throw new ApiError(409, "Este identificador ya pertenece a otro mensaje.");
        return;
      }
      const receiverId = user.uid === booking.driverId ? booking.passengerId : booking.driverId;
      tx.set(messageRef!, { chatId: ref.id, rideId: booking.rideId, driverId: booking.driverId, passengerId: booking.passengerId, senderId: user.uid, senderEmail: user.email || "", receiverId, text, type: "text", createdAt: now, read: false });
      tx.update(ref, { lastMessage: text, lastMessageTime: now, lastSenderId: user.uid, lastSenderEmail: user.email || "", unread: { ...(chat.unread || {}), [user.uid]: 0, [receiverId]: Math.max(0, Number(chat.unread?.[receiverId] || 0)) + 1 }, updatedAt: now });
      tx.set(notificationRef(db, pushAlerts, user.uid === booking.driverId ? "passenger" : "driver", `chat_${messageRef!.id}`), { userId: receiverId, email: user.uid === booking.driverId ? booking.passengerEmail || "" : booking.driverEmail || "", type: "message", title: "Nuevo mensaje de RoadLink", message: text.slice(0, 120), chatId: ref.id, rideId: booking.rideId, senderId: user.uid, read: false, createdAt: now, actionUrl: `/chat?chatId=${ref.id}` });
    });
    await deliverNotificationPush(pushAlerts);
    return Response.json({ ok: true }, { headers });
  } catch (error) { return apiFailure(error); }
}
