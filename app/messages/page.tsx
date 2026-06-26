"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

type Chat = {
  id: string;
  chatId?: string;
  rideId?: string;
  driverId?: string;
  passengerId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  lastSenderId?: string;
  lastSenderEmail?: string;
  unreadCount?: number;
  unreadByDriver?: number;
  unreadByPassenger?: number;
  unread?: {
    [key: string]: number;
  };
};

type InboxFilter = "all" | "unread" | "driver" | "passenger";

export default function MessagesPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [driverChats, setDriverChats] = useState<Chat[]>([]);
  const [passengerChats, setPassengerChats] = useState<Chat[]>([]);
  const [status, setStatus] = useState("Loading Messages Center...");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId("");
        setUserEmail("");
        setStatus("Please sign in to view your messages.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setStatus("");
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const driverChatsQuery = query(collection(db, "chats"), where("driverId", "==", userId));
    const passengerChatsQuery = query(collection(db, "chats"), where("passengerId", "==", userId));

    const unsubscribeDriver = onSnapshot(
      driverChatsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Chat[];

        setDriverChats(data);
        setStatus("");
      },
      (error) => setStatus(error.message)
    );

    const unsubscribePassenger = onSnapshot(
      passengerChatsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Chat[];

        setPassengerChats(data);
        setStatus("");
      },
      (error) => setStatus(error.message)
    );

    return () => {
      unsubscribeDriver();
      unsubscribePassenger();
    };
  }, [userId]);

  function getConversationKey(chat: Chat) {
    if (chat.chatId) return chat.chatId;
    if (chat.id) return chat.id;

    const driver = chat.driverId || "no_driver";
    const passenger = chat.passengerId || "no_passenger";
    const ride = chat.rideId || "direct";

    return `${ride}_${driver}_${passenger}`;
  }

  function getChatTime(chat: Chat) {
    const value = chat.lastMessageTime || "";

    if (!value) return 0;

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function getUnreadForUser(chat: Chat) {
    if (chat.unread && userId && chat.unread[userId] !== undefined) {
      return Number(chat.unread[userId] || 0);
    }

    const isDriver = chat.driverId === userId;

    if (isDriver && chat.unreadByDriver !== undefined) {
      return Number(chat.unreadByDriver || 0);
    }

    if (!isDriver && chat.unreadByPassenger !== undefined) {
      return Number(chat.unreadByPassenger || 0);
    }

    if (chat.lastSenderId === userId) return 0;

    return Number(chat.unreadCount || 0);
  }

  const conversations = useMemo(() => {
    const merged = new Map<string, Chat>();

    [...driverChats, ...passengerChats].forEach((chat) => {
      if (!chat) return;

      if (chat.chatId === "chat_abc123") return;
      if (chat.driverId === "test-driver") return;
      if (chat.passengerId === "test-passenger") return;
      if (!chat.driverId && !chat.passengerId) return;

      const key = getConversationKey(chat);
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, chat);
        return;
      }

      const existingTime = getChatTime(existing);
      const currentTime = getChatTime(chat);
      const newestChat = currentTime >= existingTime ? chat : existing;
      const olderChat = currentTime >= existingTime ? existing : chat;

      merged.set(key, {
        ...olderChat,
        ...newestChat,
        unreadCount: Math.max(Number(existing.unreadCount || 0), Number(chat.unreadCount || 0)),
        unreadByDriver: Math.max(Number(existing.unreadByDriver || 0), Number(chat.unreadByDriver || 0)),
        unreadByPassenger: Math.max(Number(existing.unreadByPassenger || 0), Number(chat.unreadByPassenger || 0)),
        unread: {
          ...(olderChat.unread || {}),
          ...(newestChat.unread || {}),
        },
        driverEmail: newestChat.driverEmail || olderChat.driverEmail || "",
        passengerEmail: newestChat.passengerEmail || olderChat.passengerEmail || "",
        lastMessage: newestChat.lastMessage || olderChat.lastMessage || "",
        lastMessageTime: newestChat.lastMessageTime || olderChat.lastMessageTime || "",
        lastSenderId: newestChat.lastSenderId || olderChat.lastSenderId || "",
        lastSenderEmail: newestChat.lastSenderEmail || olderChat.lastSenderEmail || "",
      });
    });

    return Array.from(merged.values()).sort((a, b) => getChatTime(b) - getChatTime(a));
  }, [driverChats, passengerChats, userId]);

  const totalUnread = conversations.reduce((total, chat) => total + getUnreadForUser(chat), 0);
  const driverInboxCount = conversations.filter((chat) => chat.driverId === userId).length;
  const passengerInboxCount = conversations.filter((chat) => chat.passengerId === userId).length;

  const filteredConversations = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return conversations.filter((chat) => {
      const unread = getUnreadForUser(chat);
      const otherUser = getOtherUser(chat).toLowerCase();
      const lastMessage = String(chat.lastMessage || "").toLowerCase();
      const rideId = String(chat.rideId || "").toLowerCase();

      if (filter === "unread" && unread <= 0) return false;
      if (filter === "driver" && chat.driverId !== userId) return false;
      if (filter === "passenger" && chat.passengerId !== userId) return false;

      if (!searchText) return true;

      return (
        otherUser.includes(searchText) ||
        lastMessage.includes(searchText) ||
        rideId.includes(searchText)
      );
    });
  }, [conversations, filter, search, userId]);

  function getOtherUser(chat: Chat) {
    const isDriver = chat.driverId === userId;

    if (isDriver) {
      return chat.passengerEmail || chat.lastSenderEmail || "Passenger";
    }

    return chat.driverEmail || chat.lastSenderEmail || "Driver";
  }

  function getInitial(name: string) {
    return name?.charAt(0)?.toUpperCase() || "R";
  }

  function getRole(chat: Chat) {
    return chat.driverId === userId ? "Driver Inbox" : "Passenger Inbox";
  }

  function getOpenChatUrl(chat: Chat) {
    const params = new URLSearchParams();

    params.set("chatId", chat.chatId || chat.id);

    if (chat.rideId) params.set("rideId", chat.rideId);
    if (chat.driverId) params.set("driverId", chat.driverId);
    if (chat.passengerId) params.set("passengerId", chat.passengerId);

    return `/chat?${params.toString()}`;
  }

  function formatTime(value?: string) {
    if (!value) return "Now";

    try {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return value.slice(11, 16) || "Now";
      }

      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      }

      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    } catch {
      return value.slice(11, 16) || "Now";
    }
  }

  return (
    <main className="page">
      <section className="inbox">
        <div className="topNav">
          <Link href="/dashboard" className="miniButton">← Dashboard</Link>
          <Link href="/find-ride" className="miniButton">Find Ride</Link>
          <Link href="/offer-ride" className="miniButton">Offer Ride</Link>
          <Link href="/notifications" className="miniButton">Notifications</Link>
        </div>

        <section className="heroCard">
          <div>
            <p className="eyebrow">RoadLink Messages</p>
            <h1>Messages <span>Center</span></h1>
            <p className="subtitle">
              Premium conversation inbox with unread counters, ride context, search, filters and direct chat access.
            </p>
          </div>

          <div className={totalUnread > 0 ? "heroBubble hotBubble" : "heroBubble"}>
            💬
            {totalUnread > 0 && <span>{totalUnread}</span>}
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="summaryGrid">
          <Summary label="Conversations" value={String(conversations.length)} />
          <Summary label="Unread" value={String(totalUnread)} />
          <Summary label="Driver Inbox" value={String(driverInboxCount)} />
          <Summary label="Passenger Inbox" value={String(passengerInboxCount)} />
        </section>

        <section className="controlPanel">
          <div>
            <p className="eyebrow">Inbox Controls</p>
            <h2>Search & Filters</h2>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by user, message or ride ID..."
          />

          <div className="filterGrid">
            <FilterButton label="All" value="all" current={filter} setFilter={setFilter} count={conversations.length} />
            <FilterButton label="Unread" value="unread" current={filter} setFilter={setFilter} count={totalUnread} />
            <FilterButton label="Driver" value="driver" current={filter} setFilter={setFilter} count={driverInboxCount} />
            <FilterButton label="Passenger" value="passenger" current={filter} setFilter={setFilter} count={passengerInboxCount} />
          </div>
        </section>

        <section className="messagesCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Conversations</p>
              <h2>Inbox</h2>
            </div>

            <div className={totalUnread > 0 ? "statusPill unreadLive" : "statusPill"}>
              {totalUnread > 0 ? `${totalUnread} New` : "Live"}
            </div>
          </div>

          {filteredConversations.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">💬</div>
              <h3>No conversations found</h3>
              <p>When someone messages you about a ride, the conversation will appear here.</p>
              <Link href="/find-ride" className="mainButton">Find a Ride</Link>
            </div>
          ) : (
            <div className="conversationList">
              {filteredConversations.map((conversation) => {
                const unread = getUnreadForUser(conversation);
                const otherUser = getOtherUser(conversation);
                const openChatUrl = getOpenChatUrl(conversation);
                const isLastMessageMine = conversation.lastSenderId === userId;

                return (
                  <Link
                    href={openChatUrl}
                    className={unread > 0 ? "conversation unreadConversation" : "conversation"}
                    key={getConversationKey(conversation)}
                  >
                    <div className="conversationAvatar">
                      {getInitial(otherUser)}
                    </div>

                    <div className="conversationContent">
                      <div className="conversationTop">
                        <h3>{otherUser}</h3>
                        <span>{formatTime(conversation.lastMessageTime)}</span>
                      </div>

                      <p className={unread > 0 ? "messagePreview strong" : "messagePreview"}>
                        {isLastMessageMine ? "You: " : ""}
                        {conversation.lastMessage || "New conversation"}
                      </p>

                      <div className="conversationMeta">
                        <span>{getRole(conversation)}</span>
                        {conversation.rideId && <span>Ride #{conversation.rideId.slice(0, 6)}</span>}
                        {unread > 0 ? (
                          <span className="unreadBadge">{unread} new</span>
                        ) : (
                          <span>Opened</span>
                        )}
                      </div>
                    </div>

                    <div className="openIcon">›</div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 32%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.14), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 130px;
          font-family: Arial, sans-serif;
        }

        .inbox {
          width: 100%;
          max-width: 1050px;
          margin: 0 auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
          font-size: 14px;
        }

        .miniButton:hover {
          border-color: rgba(34,197,94,0.48);
          background: rgba(34,197,94,0.12);
        }

        .heroCard,
        .summaryCard,
        .messagesCard,
        .controlPanel {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .heroCard {
          border-radius: 32px;
          padding: 34px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          margin-bottom: 20px;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
          letter-spacing: -1px;
        }

        h1 span,
        h2 {
          color: #22c55e;
        }

        h2 {
          margin: 0;
          font-size: 30px;
        }

        .subtitle {
          max-width: 680px;
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .heroBubble {
          position: relative;
          min-width: 96px;
          height: 96px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          box-shadow: 0 18px 55px rgba(34,197,94,0.35);
        }

        .heroBubble span {
          position: absolute;
          top: -7px;
          right: -7px;
          min-width: 34px;
          height: 34px;
          border-radius: 999px;
          background: #ef4444;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 900;
          border: 2px solid #020617;
        }

        .hotBubble {
          animation: pulse 1.7s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
          70% { box-shadow: 0 0 0 16px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 18px 0;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .summaryCard {
          border-radius: 24px;
          padding: 22px;
        }

        .summaryCard p {
          color: #a1a1aa;
          margin: 0 0 10px;
          font-weight: 900;
        }

        .summaryCard h2 {
          color: #22c55e;
          font-size: 34px;
          margin: 0;
        }

        .controlPanel {
          display: grid;
          gap: 16px;
          border-radius: 28px;
          padding: 26px;
          margin-bottom: 20px;
        }

        input {
          width: 100%;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          outline: none;
          font-size: 16px;
        }

        input:focus {
          border-color: rgba(34,197,94,0.55);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.08);
        }

        .filterGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .filterButton {
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: white;
          cursor: pointer;
          font-weight: 900;
          text-align: left;
        }

        .filterButton.activeFilter {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.12);
        }

        .filterButton span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .filterButton strong {
          color: #22c55e;
          font-size: 22px;
        }

        .messagesCard {
          border-radius: 30px;
          padding: 30px;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 24px;
        }

        .sectionHeader h2 {
          font-size: 34px;
          margin: 0;
        }

        .statusPill {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          border-radius: 999px;
          padding: 10px 16px;
          font-weight: 900;
          white-space: nowrap;
        }

        .unreadLive {
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.45);
          color: #fca5a5;
        }

        .empty {
          min-height: 330px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }

        .emptyIcon {
          width: 82px;
          height: 82px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          margin-bottom: 18px;
        }

        .empty h3 {
          font-size: 30px;
          margin: 0 0 10px;
        }

        .empty p {
          color: #a1a1aa;
          max-width: 520px;
          line-height: 1.5;
          margin: 0;
        }

        .mainButton {
          display: inline-flex;
          margin-top: 22px;
          padding: 16px 28px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .conversationList {
          display: grid;
          gap: 14px;
        }

        .conversation {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 16px;
          align-items: center;
          padding: 18px;
          border-radius: 22px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          text-decoration: none;
          color: white;
          transition: all 0.25s ease;
        }

        .unreadConversation {
          border-color: rgba(239,68,68,0.45);
          background:
            linear-gradient(135deg, rgba(239,68,68,0.12), rgba(255,255,255,0.05));
        }

        .conversation:hover {
          transform: translateY(-3px);
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .conversationAvatar {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(34,197,94,0.14);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 900;
          color: #22c55e;
          flex-shrink: 0;
        }

        .conversationTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 6px;
        }

        .conversationTop h3 {
          margin: 0;
          font-size: 18px;
          overflow-wrap: anywhere;
        }

        .conversationTop span {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
        }

        .messagePreview {
          color: #d4d4d8;
          margin: 0 0 10px;
          line-height: 1.4;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .messagePreview.strong {
          color: white;
          font-weight: 900;
        }

        .conversationMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .conversationMeta span {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .conversationMeta .unreadBadge {
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.4);
          color: #fca5a5;
        }

        .openIcon {
          color: #22c55e;
          font-size: 38px;
          font-weight: 300;
        }

        @media (max-width: 850px) {
          .summaryGrid,
          .filterGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .heroCard {
            flex-direction: column;
            align-items: flex-start;
          }

          h1 {
            font-size: 46px;
          }
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
            padding-bottom: 130px;
          }

          .topNav {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .miniButton {
            text-align: center;
            padding: 12px 10px;
            font-size: 13px;
          }

          .heroCard {
            padding: 28px;
            border-radius: 28px;
          }

          .subtitle {
            font-size: 17px;
          }

          .summaryGrid,
          .filterGrid {
            grid-template-columns: 1fr;
          }

          .messagesCard,
          .controlPanel {
            padding: 22px;
            border-radius: 28px;
          }

          .sectionHeader {
            align-items: flex-start;
          }

          .sectionHeader h2 {
            font-size: 30px;
          }

          .conversation {
            grid-template-columns: auto 1fr;
            padding: 16px;
          }

          .openIcon {
            display: none;
          }

          .conversationTop {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .conversationAvatar {
            width: 48px;
            height: 48px;
            font-size: 20px;
          }
        }
      `}</style>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="summaryCard">
      <p>{label}</p>
      <h2>{value}</h2>
    </div>
  );
}

function FilterButton({
  label,
  value,
  current,
  setFilter,
  count,
}: {
  label: string;
  value: InboxFilter;
  current: InboxFilter;
  setFilter: (value: InboxFilter) => void;
  count: number;
}) {
  return (
    <button
      type="button"
      className={current === value ? "filterButton activeFilter" : "filterButton"}
      onClick={() => setFilter(value)}
    >
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
        }
