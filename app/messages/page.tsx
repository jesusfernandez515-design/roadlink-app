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
  unreadCount?: number;
};

export default function MessagesPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [driverChats, setDriverChats] = useState<Chat[]>([]);
  const [passengerChats, setPassengerChats] = useState<Chat[]>([]);
  const [status, setStatus] = useState("Loading messages...");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
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

    const driverChatsQuery = query(
      collection(db, "chats"),
      where("driverId", "==", userId)
    );

    const passengerChatsQuery = query(
      collection(db, "chats"),
      where("passengerId", "==", userId)
    );

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

  const conversations = useMemo(() => {
    const merged = new Map<string, Chat>();

    [...driverChats, ...passengerChats].forEach((chat) => {
      const key = chat.chatId || chat.id;
      merged.set(key, chat);
    });

    return Array.from(merged.values()).sort((a, b) =>
      String(b.lastMessageTime || "").localeCompare(String(a.lastMessageTime || ""))
    );
  }, [driverChats, passengerChats]);

  const totalUnread = conversations.reduce(
    (total, chat) => total + Number(chat.unreadCount || 0),
    0
  );

  return (
    <main className="page">
      <section className="inbox">
        <div className="topNav">
          <Link href="/dashboard" className="miniButton">← Dashboard</Link>
          <Link href="/find-ride" className="miniButton">Find Ride</Link>
          <Link href="/offer-ride" className="miniButton">Offer Ride</Link>
        </div>

        <section className="heroCard">
          <div>
            <p className="eyebrow">RoadLink Inbox</p>
            <h1>
              Your <span>messages.</span>
            </h1>
            <p className="subtitle">
              Manage your ride conversations, unread messages, and trip coordination from one premium inbox.
            </p>
          </div>

          <div className="avatar">💬</div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="summaryGrid">
          <div className="summaryCard">
            <p>Conversations</p>
            <h2>{conversations.length}</h2>
          </div>

          <div className="summaryCard">
            <p>Unread</p>
            <h2>{totalUnread}</h2>
          </div>

          <div className="summaryCard">
            <p>Account</p>
            <h2>{userEmail ? userEmail.charAt(0).toUpperCase() : "R"}</h2>
          </div>
        </section>

        <section className="messagesCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Conversations</p>
              <h2>Inbox</h2>
            </div>

            <div className="statusPill">Live</div>
          </div>

          {conversations.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">💬</div>
              <h3>No conversations yet</h3>
              <p>
                When someone messages you about a ride, the conversation will appear here.
              </p>
              <Link href="/find-ride" className="mainButton">
                Find a Ride
              </Link>
            </div>
          ) : (
            <div className="conversationList">
              {conversations.map((conversation) => {
                const otherUser =
                  conversation.driverId === userId
                    ? conversation.passengerEmail || "Passenger"
                    : conversation.driverEmail || "Driver";

                const openChatUrl = conversation.rideId
                  ? `/chat?rideId=${conversation.rideId}`
                  : `/chat?driverId=${conversation.driverId || ""}&passengerId=${conversation.passengerId || ""}`;

                return (
                  <Link
                    href={openChatUrl}
                    className="conversation"
                    key={conversation.chatId || conversation.id}
                  >
                    <div className="conversationAvatar">💬</div>

                    <div className="conversationContent">
                      <div className="conversationTop">
                        <h3>{otherUser}</h3>

                        <span>
                          {conversation.lastMessageTime
                            ? conversation.lastMessageTime.slice(11, 16)
                            : "Now"}
                        </span>
                      </div>

                      <p>{conversation.lastMessage || "New conversation"}</p>

                      <div className="conversationMeta">
                        <span>Ride chat</span>
                        {conversation.unreadCount && conversation.unreadCount > 0 ? (
                          <span className="unreadBadge">
                            {conversation.unreadCount} new
                          </span>
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
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 32%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .inbox {
          width: 100%;
          max-width: 980px;
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
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .heroCard,
        .summaryCard,
        .messagesCard {
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

        h1 span {
          color: #22c55e;
        }

        .subtitle {
          max-width: 680px;
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .avatar {
          min-width: 90px;
          height: 90px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          box-shadow: 0 18px 55px rgba(34,197,94,0.35);
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 18px 0;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
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
          font-size: 24px;
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
        }

        .conversationTop span {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }

        .conversationContent p {
          color: #d4d4d8;
          margin: 0 0 10px;
          line-height: 1.4;
          overflow-wrap: anywhere;
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

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .heroCard {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 48px;
          }

          .subtitle {
            font-size: 18px;
          }

          .summaryGrid {
            grid-template-columns: 1fr;
          }

          .messagesCard {
            padding: 22px;
            border-radius: 28px;
          }

          .conversation {
            grid-template-columns: auto 1fr;
          }

          .openIcon {
            display: none;
          }

          .conversationTop {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
