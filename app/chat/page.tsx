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
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../lib/firebase";

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
  lastMessage?: string;
  lastMessageTime?: string;
  lastSenderId?: string;
  lastSenderEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  typing?: { [key: string]: boolean };
  unread?: { [key: string]: number };
};

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  online?: boolean;
  lastSeen?: string;
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
  type?: "text" | "image" | "location";
  imageUrl?: string;
  imageName?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
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
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  const [uploading, setUploading] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);

  useEffect(() => {
    const urlRideId = searchParams.get("rideId") || "";
    const urlDriverId = searchParams.get("driverId") || "";
    const urlPassengerId = searchParams.get("passengerId") || "";
    const urlChatId = searchParams.get("chatId") || "";

    let unsubscribeChat: (() => void) | undefined;
    let unsubscribeOtherUser: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus("Please sign in to use chat.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");

      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email || "",
          online: true,
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      try {
        let finalRideId = urlRideId;
        let finalDriverId = urlDriverId;
        let finalPassengerId = urlPassengerId;
        let finalChatId = urlChatId;

        if (urlChatId) {
          const chatSnap = await getDoc(doc(db, "chats", urlChatId));
          if (chatSnap.exists()) {
            const data = { id: chatSnap.id, ...chatSnap.data() } as ChatData;
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
            const rideData = { id: rideSnap.id, ...rideSnap.data() } as Ride;
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

        const receiverId = user.uid === finalDriverId ? finalPassengerId : finalDriverId;

        if (receiverId) {
          unsubscribeOtherUser = onSnapshot(doc(db, "users", receiverId), (snapshot) => {
            if (snapshot.exists()) setOtherUser(snapshot.data() as UserProfile);
          });
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
            setChatData({ id: snapshot.id, ...snapshot.data() } as ChatData);
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
      if (unsubscribeOtherUser) unsubscribeOtherUser();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [router, searchParams]);

  useEffect(() => {
    if (!chatId || !userId) return;

    const messagesQuery = query(collection(db, "messages"), where("chatId", "==", chatId));

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      async (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          ...document.data(),
          id: document.id,
        })) as Message[];

        data.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const otherUserId = useMemo(() => {
    if (!userId) return "";
    if (userId === driverId) return passengerId;
    return driverId;
  }, [driverId, passengerId, userId]);

  const otherUserLabel = useMemo(() => {
    if (otherUser?.name) return otherUser.name;
    if (otherUser?.email) return otherUser.email;

    if (userId === driverId) {
      return chatData?.passengerEmail || "Passenger";
    }

    return chatData?.driverEmail || ride?.driverEmail || "Driver";
  }, [chatData, driverId, otherUser, ride, userId]);

  const otherUserInitial = otherUserLabel.charAt(0).toUpperCase() || "R";

  const isOtherUserTyping = Boolean(otherUserId && chatData?.typing && chatData.typing[otherUserId]);

  const onlineText = otherUser?.online
    ? "Online now"
    : otherUser?.lastSeen
    ? `Last seen ${formatRelativeTime(otherUser.lastSeen)}`
    : "Secure RoadLink user";

  const unreadOutgoingCount = useMemo(() => {
    return messages.filter((message) => message.senderId === userId && message.read === false).length;
  }, [messages, userId]);

  const chatTitle = ride
    ? `${ride.from || "Starting point"} → ${ride.to || "Destination"}`
    : `Chat with ${otherUserLabel}`;

  function getParticipants() {
    const finalDriverId = driverId || ride?.driverId || "";
    const finalPassengerId = passengerId || (userId !== finalDriverId ? userId : "");

    return {
      finalDriverId,
      finalPassengerId,
      receiverId: userId === finalDriverId ? finalPassengerId : finalDriverId,
    };
  }

  async function updateChatPreview(lastMessage: string, receiverId: string) {
    const now = new Date().toISOString();
    const { finalDriverId, finalPassengerId } = getParticipants();

    await setDoc(
      doc(db, "chats", chatId),
      {
        id: chatId,
        chatId,
        rideId: rideId || "",
        driverId: finalDriverId,
        passengerId: finalPassengerId,
        driverEmail: userId === finalDriverId ? userEmail : chatData?.driverEmail || ride?.driverEmail || "",
        passengerEmail: userId === finalPassengerId ? userEmail : chatData?.passengerEmail || "",
        participants: [finalDriverId, finalPassengerId],
        lastMessage,
        lastMessageTime: now,
        lastSenderId: userId,
        lastSenderEmail: userEmail,
        [`unread.${receiverId}`]: 1,
        [`typing.${userId}`]: false,
        updatedAt: now,
        createdAt: chatData?.createdAt || now,
      },
      { merge: true }
    );
  }

  async function createMessageNotification(receiverId: string, preview: string) {
    if (!receiverId || receiverId === userId) return;

    await addDoc(collection(db, "notifications"), {
      userId: receiverId,
      type: "message",
      title: "New Message",
      message: `${userEmail} sent: ${preview}`,
      chatId,
      rideId: rideId || "",
      driverId: driverId || "",
      passengerId: passengerId || "",
      senderId: userId,
      receiverId,
      read: false,
      createdAt: new Date().toISOString(),
      actionUrl: `/chat?chatId=${chatId}`,
    });
  }

  async function handleTyping(value: string) {
    setText(value);

    if (!chatId || !userId) return;

    await setDoc(
      doc(db, "chats", chatId),
      {
        [`typing.${userId}`]: Boolean(value.trim()),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(async () => {
      if (!chatId || !userId) return;

      await setDoc(
        doc(db, "chats", chatId),
        {
          [`typing.${userId}`]: false,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }, 1200);
  }

  async function sendMessage() {
    const cleanText = text.trim();

    if (!cleanText || !userId || !chatId) return;

    try {
      setSending(true);
      setStatus("");

      const { finalDriverId, finalPassengerId, receiverId } = getParticipants();

      if (!finalDriverId || !finalPassengerId || !receiverId) {
        setStatus("Chat participants are missing.");
        return;
      }

      const now = new Date().toISOString();

      await addDoc(collection(db, "messages"), {
        chatId,
        rideId: rideId || "",
        driverId: finalDriverId,
        passengerId: finalPassengerId,
        senderId: userId,
        senderEmail: userEmail,
        receiverId,
        type: "text",
        text: cleanText,
        createdAt: now,
        status: "sent",
        read: false,
      });

      await updateChatPreview(cleanText, receiverId);
      await createMessageNotification(receiverId, cleanText);

      setText("");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function sendImage(file: File) {
    if (!file || !chatId || !userId) return;

    if (!file.type.startsWith("image/")) {
      setStatus("Please select an image file.");
      return;
    }

    try {
      setUploading(true);
      setStatus("");

      const { finalDriverId, finalPassengerId, receiverId } = getParticipants();

      if (!finalDriverId || !finalPassengerId || !receiverId) {
        setStatus("Chat participants are missing.");
        return;
      }

      const now = new Date().toISOString();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `chatUploads/${chatId}/${Date.now()}_${safeName}`;
      const imageRef = ref(storage, filePath);

      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);

      await addDoc(collection(db, "messages"), {
        chatId,
        rideId: rideId || "",
        driverId: finalDriverId,
        passengerId: finalPassengerId,
        senderId: userId,
        senderEmail: userEmail,
        receiverId,
        type: "image",
        text: "Image",
        imageUrl,
        imageName: file.name,
        createdAt: now,
        status: "sent",
        read: false,
      });

      await updateChatPreview("📷 Image", receiverId);
      await createMessageNotification(receiverId, "📷 Image");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function shareLocation() {
    if (!chatId || !userId) return;

    if (!navigator.geolocation) {
      setStatus("Location sharing is not supported on this device.");
      return;
    }

    try {
      setSharingLocation(true);
      setStatus("");

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { finalDriverId, finalPassengerId, receiverId } = getParticipants();

            if (!finalDriverId || !finalPassengerId || !receiverId) {
              setStatus("Chat participants are missing.");
              setSharingLocation(false);
              return;
            }

            const now = new Date().toISOString();
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            await addDoc(collection(db, "messages"), {
              chatId,
              rideId: rideId || "",
              driverId: finalDriverId,
              passengerId: finalPassengerId,
              senderId: userId,
              senderEmail: userEmail,
              receiverId,
              type: "location",
              text: "Shared location",
              latitude,
              longitude,
              locationLabel: "Current Location",
              createdAt: now,
              status: "sent",
              read: false,
            });

            await updateChatPreview("📍 Location", receiverId);
            await createMessageNotification(receiverId, "📍 Location");
          } catch (error: unknown) {
            setStatus(error instanceof Error ? error.message : "Could not share location.");
          } finally {
            setSharingLocation(false);
          }
        },
        () => {
          setStatus("Location permission was denied.");
          setSharingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        }
      );
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not share location.");
      setSharingLocation(false);
    }
  }

  function locationUrl(message: Message) {
    if (!message.latitude || !message.longitude) return "#";
    return `https://www.google.com/maps?q=${message.latitude},${message.longitude}`;
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

  function formatDateLabel(value?: string) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function shouldShowDateSeparator(current: Message, previous?: Message) {
    if (!current.createdAt) return false;
    if (!previous?.createdAt) return true;

    const currentDate = new Date(current.createdAt);
    const previousDate = new Date(previous.createdAt);

    if (Number.isNaN(currentDate.getTime()) || Number.isNaN(previousDate.getTime())) return false;

    return currentDate.toDateString() !== previousDate.toDateString();
  }

  function getMessageStatus(message: Message) {
    if (message.senderId !== userId) return "";
    if (message.read) return "✓✓ Read";
    if (message.status === "sent") return "✓ Sent";
    return "✓ Sent";
  }

  function formatRelativeTime(value?: string) {
    if (!value) return "recently";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "recently";

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

    if (diffMinutes < 2) return "just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  function renderMessageBody(message: Message) {
    if (message.type === "image" && message.imageUrl) {
      return (
        <div className="imageMessage">
          <img src={message.imageUrl} alt={message.imageName || "Chat image"} />
          {message.imageName && <span>{message.imageName}</span>}
        </div>
      );
    }

    if (message.type === "location") {
      return (
        <div className="locationMessage">
          <div className="locationIcon">📍</div>
          <div>
            <strong>{message.locationLabel || "Shared Location"}</strong>
            <p>
              {message.latitude?.toFixed(5)}, {message.longitude?.toFixed(5)}
            </p>
            <a href={locationUrl(message)} target="_blank" rel="noopener noreferrer">
              Open in Google Maps
            </a>
          </div>
        </div>
      );
    }

    return <p>{message.text}</p>;
  }

  return (
    <main className="page">
      <section className="chatShell">
        <header className="header">
          <div className="topActions">
            <Link href="/messages" className="miniButton">← Inbox</Link>
            <Link href="/dashboard" className="miniButton">Dashboard</Link>
            <Link href="/notifications" className="miniButton">Notifications</Link>
            <Link href="/my-bookings" className="miniButton">My Bookings</Link>
          </div>

          <div className="brand">Road<span>Link</span></div>

          <div className="routeCard">
            {otherUser?.photoURL ? (
              <img src={otherUser.photoURL} alt={otherUserLabel} className="avatarImage" />
            ) : (
              <div className="avatar">{otherUserInitial}</div>
            )}

            <div>
              <p className="eyebrow">Premium Live Chat</p>
              <h1>{otherUserLabel}</h1>
              <p className="subtitle">{chatTitle}</p>

              <div className="chips">
                <span className={otherUser?.online ? "onlineChip" : ""}>
                  {otherUser?.online ? "● Online" : onlineText}
                </span>
                {ride?.date && <span>📅 {ride.date}</span>}
                {ride?.time && <span>🕒 {ride.time}</span>}
                <span>🛡️ Secure</span>
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
              <p>Start the conversation about pickup time, location, luggage, or trip details.</p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const isMine = message.senderId === userId;
                const previousMessage = index > 0 ? messages[index - 1] : undefined;
                const showDate = shouldShowDateSeparator(message, previousMessage);

                return (
                  <div key={message.id}>
                    {showDate && <div className="dateSeparator">{formatDateLabel(message.createdAt)}</div>}

                    <div className={isMine ? "messageRow mine" : "messageRow"}>
                      {!isMine && (
                        <div className="smallAvatar">
                          {otherUser?.photoURL ? (
                            <img src={otherUser.photoURL} alt={otherUserLabel} />
                          ) : (
                            <span>{otherUserInitial}</span>
                          )}
                        </div>
                      )}

                      <div className={isMine ? "bubble myBubble" : "bubble"}>
                        {renderMessageBody(message)}

                        <small>
                          {isMine ? "You" : message.senderEmail || "RoadLink User"}
                          {message.createdAt ? ` • ${formatTime(message.createdAt)}` : ""}
                          {getMessageStatus(message) ? ` • ${getMessageStatus(message)}` : ""}
                        </small>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isOtherUserTyping && (
                <div className="typingIndicator">
                  <span>{otherUserLabel} is typing</span>
                  <b>.</b>
                  <b>.</b>
                  <b>.</b>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </section>

        <section className="composer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hiddenFile"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) sendImage(file);
            }}
          />

          <div className="toolRow">
            <button
              type="button"
              className="toolButton"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
            >
              {uploading ? "Uploading..." : "📷 Image"}
            </button>

            <button
              type="button"
              className="toolButton"
              onClick={shareLocation}
              disabled={sharingLocation || sending}
            >
              {sharingLocation ? "Sharing..." : "📍 Location"}
            </button>
          </div>

          <textarea
            value={text}
            onChange={(event) => handleTyping(event.target.value)}
            placeholder="Write a message..."
            aria-label="Write a message"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />

          <button className="sendButton" onClick={sendMessage} disabled={sending || !text.trim()}>
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
          padding-bottom: 130px;
          font-family: Arial, sans-serif;
        }

        .chatShell { max-width: 960px; margin: 0 auto; }

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
        .status,
        .onlineChip {
          color: #22c55e;
        }

        .routeCard {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .avatar,
        .avatarImage {
          min-width: 82px;
          width: 82px;
          height: 82px;
          border-radius: 50%;
          border: 2px solid rgba(34,197,94,0.45);
          box-shadow: 0 18px 55px rgba(34,197,94,0.25);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: 900;
        }

        .avatarImage { object-fit: cover; }

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

        .chips .onlineChip {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
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

        .empty h2 { font-size: 32px; margin: 0 0 10px; }

        .empty p {
          color: #a1a1aa;
          max-width: 520px;
          line-height: 1.5;
          margin: 0;
        }

        .dateSeparator {
          width: fit-content;
          margin: 12px auto 18px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
        }

        .messageRow {
          display: flex;
          justify-content: flex-start;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 14px;
        }

        .messageRow.mine { justify-content: flex-end; }

        .smallAvatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          overflow: hidden;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
          font-weight: 900;
        }

        .smallAvatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
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

        .imageMessage {
          display: grid;
          gap: 8px;
        }

        .imageMessage img {
          max-width: 280px;
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.16);
          object-fit: cover;
        }

        .imageMessage span {
          font-size: 12px;
          color: rgba(255,255,255,0.75);
          overflow-wrap: anywhere;
        }

        .locationMessage {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: center;
        }

        .locationIcon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.16);
          font-size: 22px;
        }

        .locationMessage strong {
          display: block;
          margin-bottom: 4px;
        }

        .locationMessage p {
          margin: 0 0 8px;
          font-size: 13px;
          opacity: 0.85;
        }

        .locationMessage a {
          color: white;
          font-weight: 900;
          text-decoration: underline;
        }

        .typingIndicator {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          margin: 4px 0 12px 44px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #a1a1aa;
          font-weight: 900;
        }

        .typingIndicator b {
          color: #22c55e;
          animation: blink 1s infinite;
        }

        .typingIndicator b:nth-child(2) { animation-delay: 0.15s; }
        .typingIndicator b:nth-child(3) { animation-delay: 0.3s; }

        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }

        .composer {
          border-radius: 26px;
          padding: 14px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: end;
        }

        .hiddenFile { display: none; }

        .toolRow {
          display: grid;
          gap: 8px;
        }

        .toolButton,
        .sendButton {
          min-height: 58px;
          padding: 0 18px;
          border-radius: 999px;
          border: none;
          color: white;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .toolButton {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .sendButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          font-size: 16px;
          padding: 0 28px;
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
          font-family: Arial, sans-serif;
        }

        textarea::placeholder { color: #71717a; }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
            padding-bottom: 130px;
          }

          .header,
          .messages,
          .composer {
            border-radius: 28px;
          }

          .header { padding: 24px; }

          .routeCard { align-items: flex-start; }

          .avatar,
          .avatarImage {
            min-width: 68px;
            width: 68px;
            height: 68px;
            font-size: 30px;
          }

          h1 { font-size: 34px; }

          .messages {
            min-height: 420px;
            padding: 18px;
          }

          .bubble { max-width: 88%; }

          .composer { grid-template-columns: 1fr; }

          .toolRow { grid-template-columns: 1fr 1fr; }

          .toolButton,
          .sendButton {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
    }
