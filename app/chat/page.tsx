"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { auth, db } from "../../lib/firebase";

type Ride = {
  id?: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  driverId?: string;
  driverEmail?: string;
};

type ChatData = {
  id?: string;
  chatId?: string;
  rideId?: string;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  participants?: string[];
  participantEmails?: string[];
  lastMessage?: string;
  lastMessageTime?: string;
  lastSenderId?: string;
  lastSenderEmail?: string;
  createdAt?: string;
  updatedAt?: string;
};

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
};

type Message = {
  id: string;
  chatId?: string;
  rideId?: string;
  driverId?: string;
  passengerId?: string;
  senderId?: string;
  senderEmail?: string;
  receiverId?: string;
  text?: string;
  createdAt?: string;
  read?: boolean;
  status?: string;
};

export default function ChatPage() {
  return (
    <Suspense fallback={<LoadingChat />}>
      <ChatContent />
    </Suspense>
  );
}

function LoadingChat() {
  return (
    <main className="page">
      <p className="status">Loading chat...</p>

      <style>{`
        .page {
          min-height: 100vh;
          background: #020617;
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }
      `}</style>
    </main>
  );
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [rideId, setRideId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [passengerId, setPassengerId] = useState("");
  const [chatId, setChatId] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [ride, setRide] = useState<Ride | null>(null);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Loading chat...");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const urlRideId = searchParams.get("rideId") || "";
    const urlDriverId = searchParams.get("driverId") || "";
    const urlPassengerId = searchParams.get("passengerId") || "";
    const urlChatId = searchParams.get("chatId") || "";

    let unsubscribeChat: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus("Please sign in to use chat.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");

      try {
        let finalRideId = urlRideId;
        let finalDriverId = urlDriverId;
        let finalPassengerId = urlPassengerId;
        let finalChatId = urlChatId;

        if (urlChatId) {
          const chatSnap = await getDoc(doc(db, "chats", urlChatId));

          if (chatSnap.exists()) {
            const data = {
              id: chatSnap.id,
              ...chatSnap.data(),
            } as ChatData;

            setChatData(data);

            finalRideId = data.rideId || finalRideId;
            finalDriverId = data.driverId || finalDriverId;
            finalPassengerId = data.passengerId || finalPassengerId;
            finalChatId = data.chatId || data.id || urlChatId;
          }
        }

        if (finalRideId) {
          const rideSnap = await getDoc(doc(db, "rides", finalRideId));

          if (rideSnap.exists()) {
            const rideData = {
              id: rideSnap.id,
              ...rideSnap.data(),
            } as Ride;

            setRide(rideData);
            finalDriverId = finalDriverId || rideData.driverId || "";
          }
        }

        if (!finalPassengerId && user.uid !== finalDriverId) {
          finalPassengerId = user.uid;
        }

        if (!finalChatId) {
          if (finalRideId && finalDriverId && finalPassengerId) {
            finalChatId = `${finalRideId}_${finalDriverId}_${finalPassengerId}`;
          } else if (finalDriverId && finalPassengerId) {
            finalChatId = `direct_${finalDriverId}_${finalPassengerId}`;
          }
        }

        if (!finalChatId || !finalDriverId || !finalPassengerId) {
          setStatus("Chat information is incomplete.");
          return;
        }

        setRideId(finalRideId);
        setDriverId(finalDriverId);
        setPassengerId(finalPassengerId);
        setChatId(finalChatId);

        const receiverId =
          user.uid === finalDriverId ? finalPassengerId : finalDriverId;

        if (receiverId) {
          const userSnap = await getDoc(doc(db, "users", receiverId));

          if (userSnap.exists()) {
            setOtherUser(userSnap.data() as UserProfile);
          }
        }

        const now = new Date().toISOString();

        await setDoc(
          doc(db, "chats", finalChatId),
          {
            id: finalChatId,
            chatId: finalChatId,
            rideId: finalRideId,
            driverId: finalDriverId,
            passengerId: finalPassengerId,
            participants: [finalDriverId, finalPassengerId],
            updatedAt: now,
            createdAt: now,
          },
          { merge: true }
        );

        unsubscribeChat = onSnapshot(doc(db, "chats", finalChatId), (snapshot) => {
          if (snapshot.exists()) {
            setChatData({
              id: snapshot.id,
              ...snapshot.data(),
            } as ChatData);
          }
        });

        setStatus("");
      } catch (error: unknown) {
        setStatus(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeChat) unsubscribeChat();
    };
  }, [router, searchParams]);

  useEffect(() => {
    if (!chatId || !userId) return;

    const messagesQuery = query(
      collection(db, "messages"),
      where("chatId", "==", chatId)
    );

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      async (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          ...document.data(),
          id: document.id,
        })) as Message[];

        data.sort((a, b) =>
          String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
        );

        setMessages(data);

        const unreadIncoming = data.filter(
          (message) => message.senderId !== userId && message.read === false
        );

        if (unreadIncoming.length > 0) {
          await Promise.all(
            unreadIncoming.map((message) =>
              updateDoc(doc(db, "messages", message.id), {
                read: true,
                status: "read",
                readAt: new Date().toISOString(),
              })
            )
          );
        }

        await setDoc(
          doc(db, "chats", chatId),
          {
            [`unread.${userId}`]: 0,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      },
      (error) => setStatus(error.message)
    );

    return () => unsubscribeMessages();
  }, [chatId, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  const otherUserLabel = useMemo(() => {
    if (otherUser?.name) return otherUser.name;
    if (otherUser?.email) return otherUser.email;

    if (userId === driverId) {
      return chatData?.passengerEmail || "Passenger";
    }

    return chatData?.driverEmail || ride?.driverEmail || "Driver";
  }, [chatData, driverId, otherUser, ride, userId]);

  const unreadOutgoingCount = useMemo(() => {
    return messages.filter(
      (message) => message.senderId === userId && message.read === false
    ).length;
  }, [messages, userId]);

  const chatTitle = ride
    ? `${ride.from || "Starting point"} → ${ride.to || "Destination"}`
    : `Chat with ${otherUserLabel}`;

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
      setStatus("");

      const finalDriverId = driverId || ride?.driverId || "";
      const finalPassengerId = passengerId || (userId !== finalDriverId ? userId : "");

      if (!finalDriverId || !finalPassengerId) {
        setStatus("Chat participants are missing.");
        return;
      }

      const receiverId =
        userId === finalDriverId ? finalPassengerId : finalDriverId;

      const now = new Date().toISOString();

      await addDoc(collection(db, "messages"), {
        chatId,
        rideId: rideId || "",
        driverId: finalDriverId,
        passengerId: finalPassengerId,
        senderId: userId,
        senderEmail: userEmail,
        receiverId,
        text: cleanText,
        createdAt: now,
        status: "sent",
        read: false,
      });

      await setDoc(
        doc(db, "chats", chatId),
        {
          id: chatId,
          chatId,
          rideId: rideId || "",
          driverId: finalDriverId,
          passengerId: finalPassengerId,
          driverEmail:
            userId === finalDriverId
              ? userEmail
              : chatData?.driverEmail || ride?.driverEmail || "",
          passengerEmail:
            userId === finalPassengerId
              ? userEmail
              : chatData?.passengerEmail || "",
          participants: [finalDriverId, finalPassengerId],
          lastMessage: cleanText,
          lastMessageTime: now,
          lastSenderId: userId,
          lastSenderEmail: userEmail,
          [`unread.${receiverId}`]: 1,
          updatedAt: now,
          createdAt: chatData?.createdAt || now,
        },
        { merge: true }
      );

      if (receiverId && receiverId !== userId) {
        await addDoc(collection(db, "notifications"), {
          userId: receiverId,
          type: "message",
          title: "New Message",
          message: `${userEmail} sent you a message.`,
          chatId,
          rideId: rideId || "",
          driverId: finalDriverId,
          passengerId: finalPassengerId,
          senderId: userId,
          receiverId,
          read: false,
          createdAt: now,
          actionUrl: `/chat?chatId=${chatId}`,
        });
      }

      setText("");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  function formatTime(value?: string) {
    if (!value) return "";

    try {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) return value.slice(11, 16);

      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value.slice(11, 16);
    }
  }

  return (
    <main className="page">
      <section className="chatShell">
        <header className="header">
          <div className="topActions">
            <Link href="/messages" className="miniButton">
              ← Inbox
            </Link>

            <Link href="/dashboard" className="miniButton">
              Dashboard
            </Link>

            <Link href="/notifications" className="miniButton">
              Notifications
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
              <p className="eyebrow">Live RoadLink Chat</p>
              <h1>{otherUserLabel}</h1>
              <p className="subtitle">{chatTitle}</p>

              <div className="chips">
                {ride?.date && <span>📅 {ride.date}</span>}
                {ride?.time && <span>🕒 {ride.time}</span>}
                <span>🛡️ Secure Chat</span>
                <span>🔔 Real Time</span>
                {unreadOutgoingCount > 0 && <span>{unreadOutgoingCount} unread</span>}
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
              <p>
                Start the conversation about pickup time, location, luggage, or trip details.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
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
                        {message.createdAt ? ` • ${formatTime(message.createdAt)}` : ""}
                        {isMine && message.read ? " • Read" : ""}
                      </small>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </>
          )}
        </section>

        <section className="composer">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write a message..."
            aria-label="Write a message"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
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
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 42px;
          line-height: 1;
          margin: 0 0 12px;
          letter-spacing: -1px;
          overflow-wrap: anywhere;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
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
          scroll-behavior: smooth;
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
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
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
            font-size: 34px;
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
