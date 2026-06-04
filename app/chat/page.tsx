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

type Message = {
  id: string;
  chatId?: string;
  rideId?: string;
  senderId?: string;
  senderEmail?: string;
  text?: string;
  createdAt?: string;
};

export default function ChatPage() {
  const [rideId, setRideId] = useState("");
  const [chatId, setChatId] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [ride, setRide] = useState<Ride | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Loading chat...");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentRideId = params.get("rideId") || "";

    setRideId(currentRideId);
    setChatId(currentRideId ? `chat_${currentRideId}` : "");

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus("Please sign in to use chat.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");

      if (!currentRideId) {
        setStatus("No ride selected.");
        return;
      }

      try {
        const rideRef = doc(db, "rides", currentRideId);
        const rideSnap = await getDoc(rideRef);

        if (rideSnap.exists()) {
          setRide(rideSnap.data() as Ride);
        }

        setStatus("");
      } catch (error: unknown) {
        if (error instanceof Error) {
          setStatus(error.message);
        } else {
          setStatus("Something went wrong.");
        }
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
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Message[];

        data.sort((a, b) =>
          String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
        );

        setMessages(data);
      },
      (error) => {
        setStatus(error.message);
      }
    );

    return () => unsubscribeMessages();
  }, [chatId]);

  async function sendMessage() {
    const cleanText = text.trim();

    if (!cleanText) return;

    if (!userId) {
      setStatus("Please sign in to send messages.");
      return;
    }

    if (!rideId || !chatId) {
      setStatus("No ride selected.");
      return;
    }

    try {
      setSending(true);

      await addDoc(collection(db, "messages"), {
        chatId,
        rideId,
        senderId: userId,
        senderEmail: userEmail,
        text: cleanText,
        createdAt: new Date().toISOString(),
      });

      setText("");
      setStatus("");
    } catch (error: unknown) {
      if (error instanceof Error) {
        setStatus(error.message);
      } else {
        setStatus("Something went wrong.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="page">
      <section className="chatShell">
        <header className="header">
          <div className="topActions">
            <Link href="/find-ride" className="miniButton">
              ← Back
            </Link>

            <Link href="/dashboard" className="miniButton">
              Dashboard
            </Link>

            <Link href="/my-bookings" className="miniButton">
              My Bookings
            </Link>
          </div>

          <div className="brand">
            Road<span>Link</span>
          </div>

          <div className="routeCard">
            <div className="avatar">💬</div>

            <div>
              <p className="eyebrow">Private Trip Chat</p>
              <h1>Chat</h1>
              <p className="subtitle">
                {ride
                  ? `${ride.from || "Starting point"} → ${ride.to || "Destination"}`
                  : "Coordinate your trip safely."}
              </p>

              {ride && (
                <div className="chips">
                  <span>📅 {ride.date || "Date"}</span>
                  <span>🕒 {ride.time || "Time"}</span>
                  <span>🛡️ RoadLink Secure</span>
                </div>
              )}
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
                <div
                  key={message.id}
                  className={isMine ? "messageRow mine" : "messageRow"}
                >
                  <div className={isMine ? "bubble myBubble" : "bubble"}>
                    <p>{message.text}</p>
                    <small>
                      {isMine ? "You" : message.senderEmail || "RoadLink User"}
                      {message.createdAt
                        ? ` • ${message.createdAt.slice(11, 16)}`
                        : ""}
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
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
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
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
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
          .page {
            padding: 16px;
          }

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
