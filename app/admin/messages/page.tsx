"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ChatItem = {
  id: string;
  chatId?: string;
  rideId?: string;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  status?: "active" | "closed" | "reported";
  createdAt?: string;
  updatedAt?: string;
};

type MessageItem = {
  id: string;
  chatId?: string;
  senderId?: string;
  senderEmail?: string;
  text?: string;
  message?: string;
  createdAt?: string;
  reported?: boolean;
};

export default function AdminMessagesPage() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [selected, setSelected] = useState<ChatItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("Loading messages...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubscribeChats = onSnapshot(
      query(collection(db, "chats")),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as ChatItem[];

        data.sort((a, b) =>
          String(b.lastMessageTime || b.updatedAt || b.createdAt || "").localeCompare(
            String(a.lastMessageTime || a.updatedAt || a.createdAt || "")
          )
        );

        setChats(data);
        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((item) => item.id === current.id) || data[0] || null;
        });
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubscribeMessages = onSnapshot(
      query(collection(db, "messages")),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as MessageItem[];

        data.sort((a, b) =>
          String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
        );

        setMessages(data);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubscribeChats();
      unsubscribeMessages();
    };
  }, []);

  const filteredChats = useMemo(() => {
    const value = search.toLowerCase().trim();

    return chats.filter((chat) => {
      const matchesSearch =
        !value ||
        String(chat.driverEmail || "").toLowerCase().includes(value) ||
        String(chat.passengerEmail || "").toLowerCase().includes(value) ||
        String(chat.driverId || "").toLowerCase().includes(value) ||
        String(chat.passengerId || "").toLowerCase().includes(value) ||
        String(chat.rideId || "").toLowerCase().includes(value) ||
        String(chat.chatId || chat.id || "").toLowerCase().includes(value) ||
        String(chat.lastMessage || "").toLowerCase().includes(value);

      const matchesStatus =
        statusFilter === "all" || String(chat.status || "active") === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [chats, search, statusFilter]);

  const selectedChatKey = selected?.chatId || selected?.id || "";

  const selectedMessages = useMemo(() => {
    return messages.filter(
      (item) => item.chatId === selectedChatKey || item.chatId === selected?.id
    );
  }, [messages, selectedChatKey, selected?.id]);

  const activeCount = chats.filter((item) => !item.status || item.status === "active").length;
  const closedCount = chats.filter((item) => item.status === "closed").length;
  const reportedCount =
    chats.filter((item) => item.status === "reported").length +
    messages.filter((item) => item.reported).length;

  const unreadTotal = chats.reduce(
    (total, item) => total + Number(item.unreadCount || 0),
    0
  );

  async function updateChatStatus(chat: ChatItem, status: "active" | "closed" | "reported") {
    try {
      setLoadingId(chat.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "chats", chat.id),
        {
          status,
          updatedAt: now,
        },
        { merge: true }
      );

      if (chat.driverId) {
        await setDoc(
          doc(db, "notifications", `${chat.driverId}-chat-admin-${Date.now()}`),
          {
            userId: chat.driverId,
            type: "message",
            title: "Chat Status Updated",
            message: `A chat related to your ride was marked as ${status}.`,
            read: false,
            createdAt: now,
            actionUrl: "/messages",
          },
          { merge: true }
        );
      }

      if (chat.passengerId) {
        await setDoc(
          doc(db, "notifications", `${chat.passengerId}-chat-admin-${Date.now()}`),
          {
            userId: chat.passengerId,
            type: "message",
            title: "Chat Status Updated",
            message: `A chat related to your booking was marked as ${status}.`,
            read: false,
            createdAt: now,
            actionUrl: "/messages",
          },
          { merge: true }
        );
      }

      setMessage(`Chat marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function deleteMessage(item: MessageItem) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this message? This cannot be undone."
    );

    if (!confirmDelete) return;

    try {
      setLoadingId(item.id);
      setMessage("");

      await deleteDoc(doc(db, "messages", item.id));

      setMessage("Message deleted successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not delete message.");
    } finally {
      setLoadingId("");
    }
  }

  async function deleteChat(chat: ChatItem) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this chat? Messages may remain unless deleted separately."
    );

    if (!confirmDelete) return;

    try {
      setLoadingId(chat.id);
      setMessage("");

      await deleteDoc(doc(db, "chats", chat.id));

      setSelected(null);
      setMessage("Chat deleted successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not delete chat.");
    } finally {
      setLoadingId("");
    }
  }

  function dateText(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function statusLabel(status?: string) {
    if (status === "closed") return "Closed";
    if (status === "reported") return "Reported";
    return "Active";
  }

  function messageText(item: MessageItem) {
    return item.text || item.message || "Empty message";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/rides" className="miniButton">Rides</Link>
          <Link href="/admin/bookings" className="miniButton">Bookings</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Messages <span>Dashboard</span></h1>
            <p className="subtitle">
              Monitor platform conversations, review support issues, close chats,
              mark conversations as reported, and remove spam messages.
            </p>
          </div>

          <div className="heroIcon">💬</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💬" label="Total Chats" value={String(chats.length)} />
          <Metric icon="🟢" label="Active" value={String(activeCount)} />
          <Metric icon="🔒" label="Closed" value={String(closedCount)} />
          <Metric icon="🚨" label="Reported" value={String(reportedCount)} />
          <Metric icon="📨" label="Unread" value={String(unreadTotal)} />
          <Metric icon="📋" label="Filtered" value={String(filteredChats.length)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email, user ID, ride ID, chat ID, or message..."
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="reported">Reported</option>
          </select>
        </section>

        <section className="adminGrid">
          <div className="chatsCard">
            <p className="eyebrow">Chats</p>
            <h2>Conversations</h2>

            {filteredChats.length === 0 ? (
              <div className="empty">
                <h3>No chats found</h3>
                <p>Try a different search or filter.</p>
              </div>
            ) : (
              <div className="chatList">
                {filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    className={selected?.id === chat.id ? "chatRow activeChat" : "chatRow"}
                    onClick={() => setSelected(chat)}
                  >
                    <div className="chatIcon">💬</div>

                    <div className="chatInfo">
                      <strong>{chat.driverEmail || "Driver"}</strong>
                      <span>{chat.passengerEmail || "Passenger"}</span>
                      <small>{chat.lastMessage || "No last message"}</small>
                    </div>

                    <em className={`status ${chat.status || "active"}`}>
                      {statusLabel(chat.status)}
                    </em>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Chat</p>
                    <h2>{selected.driverEmail || "Driver"}</h2>
                    <p className="email">{selected.passengerEmail || "Passenger"}</p>
                  </div>

                  <span className={`statusPill ${selected.status || "active"}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className="infoGrid">
                  <Info label="Chat ID" value={selected.chatId || selected.id} />
                  <Info label="Ride ID" value={selected.rideId || "Not available"} />
                  <Info label="Driver ID" value={selected.driverId || "Not available"} />
                  <Info label="Driver Email" value={selected.driverEmail || "Not available"} />
                  <Info label="Passenger ID" value={selected.passengerId || "Not available"} />
                  <Info label="Passenger Email" value={selected.passengerEmail || "Not available"} />
                  <Info label="Unread Count" value={String(selected.unreadCount || 0)} />
                  <Info label="Last Message Time" value={dateText(selected.lastMessageTime)} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                </div>

                <div className="actionRow">
                  <button
                    className="approveButton"
                    onClick={() => updateChatStatus(selected, "active")}
                    disabled={loadingId === selected.id}
                  >
                    Mark Active
                  </button>

                  <button
                    className="paidButton"
                    onClick={() => updateChatStatus(selected, "closed")}
                    disabled={loadingId === selected.id}
                  >
                    Close Chat
                  </button>

                  <button
                    className="rejectButton"
                    onClick={() => updateChatStatus(selected, "reported")}
                    disabled={loadingId === selected.id}
                  >
                    Mark Reported
                  </button>

                  <button
                    className="deleteButton"
                    onClick={() => deleteChat(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Delete Chat
                  </button>
                </div>

                <div className="messagesBox">
                  <p className="eyebrow">Messages</p>
                  <h2>Conversation History</h2>

                  {selectedMessages.length === 0 ? (
                    <div className="empty">
                      <h3>No messages found</h3>
                      <p>This chat has no messages in the messages collection.</p>
                    </div>
                  ) : (
                    <div className="messageList">
                      {selectedMessages.map((item) => (
                        <div
                          key={item.id}
                          className={item.reported ? "messageItem reportedMessage" : "messageItem"}
                        >
                          <div>
                            <strong>{item.senderEmail || item.senderId || "RoadLink User"}</strong>
                            <p>{messageText(item)}</p>
                            <small>{dateText(item.createdAt)}</small>
                          </div>

                          <button
                            className="smallDelete"
                            onClick={() => deleteMessage(item)}
                            disabled={loadingId === item.id}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a chat</h3>
                <p>Choose a conversation to review messages.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1180px;
          margin: auto;
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
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .metric,
        .filters,
        .chatsCard,
        .detailsCard {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 34px;
          margin-bottom: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
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
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 8px;
        }

        .subtitle,
        .email,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .heroIcon {
          min-width: 92px;
          height: 92px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 12px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 24px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        .filters input,
        .filters select {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        .filters option {
          color: black;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .chatsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .chatList,
        .messageList {
          display: grid;
          gap: 12px;
        }

        .chatRow {
          width: 100%;
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeChat {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .chatIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .chatInfo {
          min-width: 0;
        }

        .chatInfo strong,
        .chatInfo span,
        .chatInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chatInfo span,
        .chatInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .status,
        .statusPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .status.active,
        .statusPill.active {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.closed,
        .statusPill.closed {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .status.reported,
        .statusPill.reported {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .infoBox {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong {
          overflow-wrap: anywhere;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 24px;
        }

        .approveButton,
        .paidButton,
        .rejectButton,
        .deleteButton {
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .approveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .paidButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .rejectButton {
          background: linear-gradient(135deg, #f97316, #c2410c);
        }

        .deleteButton,
        .smallDelete {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .messagesBox {
          margin-top: 24px;
        }

        .messageItem {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 15px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .reportedMessage {
          border-color: rgba(239,68,68,0.35);
          background: rgba(239,68,68,0.1);
        }

        .messageItem strong {
          display: block;
          margin-bottom: 6px;
          overflow-wrap: anywhere;
        }

        .messageItem p {
          color: #e5e7eb;
          margin: 0 0 6px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .messageItem small {
          color: #a1a1aa;
        }

        .smallDelete {
          padding: 10px 13px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }

          .actionRow {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .filters,
          .infoGrid,
          .actionRow,
          .messageItem {
            grid-template-columns: 1fr;
          }

          .chatsCard,
          .detailsCard {
            padding: 24px;
          }

          .chatRow {
            grid-template-columns: 46px 1fr;
          }

          .chatRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .chatIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
            flex-direction: column;
          }

          .smallDelete {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
