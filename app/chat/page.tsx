"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

type Ride = {
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  driverId?: string;
  driverEmail?: string;
};

type Driver = {
  name?: string;
  email?: string;
};

type Message = {
  id: string;
  chatId?: string;
  rideId?: string;
  driverId?: string;
  passengerId?: string;
  senderId?: string;
  senderEmail?: string;
  text?: string;
  createdAt?: string;
  read?: boolean;
};

export default function ChatPage() {
  const [rideId, setRideId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [passengerId, setPassengerId] = useState("");
  const [chatId, setChatId] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [ride, setRide] = useState<Ride | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Loading chat...");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentRideId = params.get("rideId") || "";
    const currentDriverId = params.get("driverId") || "";
    const currentPassengerId = params.get("passengerId") || "";

    setRideId(currentRideId);
    setDriverId(currentDriverId);
    setPassengerId(currentPassengerId);

    const generatedChatId = currentRideId
      ? `chat_${currentRideId}`
      : currentDriverId
      ? `driver_chat_${currentDriverId}`
      : "";

    setChatId(generatedChatId);

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus("Please sign in to use chat.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");

      if (!currentRideId && !currentDriverId) {
        setStatus("No ride or driver selected.");
        return;
      }

      try {
        if (currentRideId) {
          const rideRef = doc(db, "rides", currentRideId);
          const rideSnap = await getDoc(rideRef);

          if (rideSnap.exists()) {
            const rideData = rideSnap.data() as Ride;
            setRide(rideData);

            if (rideData.driverId) {
              setDriverId(rideData.driverId);
            }
          }
        }

        if (currentDriverId) {
          const driverRef = doc(db, "users", currentDriverId);
          const driverSnap = await getDoc(driverRef);

          if (driverSnap.exists()) {
            setDriver(driverSnap.data() as Driver);
          }
        }

        setStatus("");
      } catch (error: unknown) {
        setStatus(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!chatId) return;

    const messagesQuery = query(
      collection(db, "messages"),
      where("chatId", "==", chatId)
    );

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      async (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Message[];

        data.sort((a, b) =>
          String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
        );

        setMessages(data);

        if (userId) {
          const unreadIncoming = data.filter(
            (message) => message.senderId !== userId && message.read === false
          );

          await Promise.all(
            unreadIncoming.map((message) =>
              updateDoc(doc(db, "messages", message.id), {
                read: true,
                status: "read",
              })
            )
          );

          if (unreadIncoming.length > 0) {
            await setDoc(
              doc(db, "chats", chatId),
              {
                unreadCount: 0,
              },
              { merge: true }
            );
          }
        }
      },
      (error) => {
        setStatus(error.message);
      }
    );

    return () => unsubscribeMessages();
  }, [chatId, userId]);

  async function sendMessage() {
    const cleanText = text.trim();

    if (!cleanText) return;

    if (!userId) {
      setStatus("Please sign in to send messages.");
      return;
    }

    if (!chatId) {
      setStatus("No chat selected.");
      return;
    }

    try {
      setSending(true);

      const finalDriverId = driverId || ride?.driverId || "";
      const finalPassengerId =
        passengerId || (userId !== finalDriverId ? userId : "");

      const now = new Date().toISOString();
      const receiverIsDriver = userId !== finalDriverId;

      await addDoc(collection(db, "messages"), {
        chatId,
        rideId: rideId || "",
        driverId: finalDriverId,
        passengerId: finalPassengerId,
        senderId: userId,
        senderEmail: userEmail,
        text: cleanText,
        createdAt: now,
        status: "sent",
        read: false,
      });

      await setDoc(
        doc(db, "chats", chatId),
        {
          chatId,
          rideId: rideId || "",
          driverId: finalDriverId,
          passengerId: finalPassengerId,
          driverEmail: ride?.driverEmail || driver?.email || "",
          passengerEmail: receiverIsDriver ? userEmail : "",
          lastMessage: cleanText,
          lastMessageTime: now,
          lastSenderId: userId,
          lastSenderEmail: userEmail,
          unreadCount: 1,
        },
        { merge: true }
      );

      setText("");
      setStatus("");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  const chatTitle = ride
    ? `${ride.from || "Starting point"} → ${ride.to || "Destination"}`
    : driver
    ? `Chat with ${driver.name || driver.email || "RoadLink Driver"}`
    : "Coordinate your trip safely.";

  return (
    <main className="page">
      <section className="chatShell">
        <header className="header">
          <div className="topActions">
            <Link href="/messages" className="miniButton">← Inbox</Link>
            <Link href="/dashboard" className="miniButton">Dashboard</Link>
            <Link href="/my-bookings" className="miniButton">My Bookings</Link>
          </div>

          <div className="brand">Road<span>Link</span></div>

          <div className="routeCard">
            <div className="avatar">💬</div>

            <div>
              <p className="eyebrow">Private RoadLink Chat</p>
              <h1>Chat</h1>
              <p className="subtitle">{chatTitle}</p>

              <div className="chips">
                {ride?.date && <span>📅 {ride.date}</span>}
                {ride?.time && <span>🕒 {ride.time}</span>}
                <span>🛡️ Secure Chat</span>
              </div>
            </div>
          </div>
        </header>

        {status && <p className="status">{status}</p>}

        <section className="messages">
          {messages.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">💬</div>
              <h2>No messages yet</h2>
              <p>Start the conversation about pickup time, location, luggage, or trip details.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.senderId === userId;

              return (
                <div key={message.id} className={isMine ? "messageRow mine" : "messageRow"}>
                  <div className={isMine ? "bubble myBubble" : "bubble"}>
                    <p>{message.text}</p>
                    <small>
                      {isMine ? "You" : message.senderEmail || "RoadLink User"}
                      {message.createdAt ? ` • ${message.createdAt.slice(11, 16)}` : ""}
                      {isMine && message.read ? " • Read" : ""}
                    </small>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section className="composer">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message..."
          />

          <button onClick={sendMessage} disabled={sending || !text.trim()}>
            {sending ? "Sending..." : "Send"}
          </button>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .chatShell {
          max-width: 900px;
          margin: 0 auto;
        }

        .header,
        .messages,
        .composer {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(16px);
        }

        .header {
          border-radius: 32px;
          padding: 30px;
          margin-bottom: 22px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 28px;
        }

        .miniButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .miniButton:hover {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.12);
        }

        .brand {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 26px;
        }

        .brand span,
        .eyebrow,
        .status {
          color: #22c55e;
        }

        .routeCard {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .avatar {
          min-width: 82px;
          height: 82px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          box-shadow: 0 16px 50px rgba(34,197,94,0.35);
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 54px;
          line-height: 1;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .chips span {
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
        }

        .status {
          text-align: center;
          font-weight: 900;
          margin: 18px 0;
        }

        .messages {
          min-height: 430px;
          max-height: 560px;
          overflow-y: auto;
          border-radius: 30px;
          padding: 24px;
          margin-bottom: 18px;
        }

        .empty {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }

        .emptyIcon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          font-size: 36px;
          margin-bottom: 18px;
        }

        .empty h2 {
          font-size: 32px;
          margin: 0 0 10px;
        }

        .empty p {
          color: #a1a1aa;
          max-width: 520px;
          line-height: 1.5;
          margin: 0;
        }

        .messageRow {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 14px;
        }

        .messageRow.mine {
          justify-content: flex-end;
        }

        .bubble {
          max-width: 75%;
          padding: 14px 16px;
          border-radius: 20px 20px 20px 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .myBubble {
          border-radius: 20px 20px 6px 20px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
        }

        .bubble p {
          margin: 0 0 8px;
          color: white;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .bubble small {
          color: rgba(255,255,255,0.72);
          font-size: 12px;
          font-weight: 800;
        }

        .composer {
          border-radius: 26px;
          padding: 14px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: end;
        }

        textarea {
          width: 100%;
          min-height: 58px;
          max-height: 140px;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 16px;
          outline: none;
          resize: vertical;
        }

        textarea:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        textarea::placeholder {
          color: #71717a;
        }

        button {
          min-height: 58px;
          padding: 0 28px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        @media (max-width: 700px) {
          .page { padding: 16px; }

          .header,
          .messages,
          .composer {
            border-radius: 28px;
          }

          .header {
            padding: 24px;
          }

          .routeCard {
            align-items: flex-start;
          }

          .avatar {
            min-width: 68px;
            height: 68px;
            font-size: 30px;
          }

          h1 {
            font-size: 46px;
          }

          .messages {
            min-height: 420px;
            padding: 18px;
          }

          .bubble {
            max-width: 88%;
          }

          .composer {
            grid-template-columns: 1fr;
          }

          button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
