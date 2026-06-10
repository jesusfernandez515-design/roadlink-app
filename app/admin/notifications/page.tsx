"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  driverVerified?: boolean;
  suspended?: boolean;
};

type BroadcastItem = {
  id: string;
  title?: string;
  message?: string;
  audience?: string;
  type?: string;
  createdAt?: string;
  sentCount?: number;
};

export default function AdminNotificationsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("system");
  const [audience, setAudience] = useState("all");
  const [specificUserId, setSpecificUserId] = useState("");
  const [message, setMessage] = useState("Loading notifications center...");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubBroadcasts = onSnapshot(
      query(collection(db, "broadcastNotifications")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as BroadcastItem[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setBroadcasts(data);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubUsers();
      unsubBroadcasts();
    };
  }, []);

  const activeUsers = users.filter((user) => !user.suspended);
  const drivers = activeUsers.filter((user) => user.driverVerified);
  const passengers = activeUsers.filter((user) => !user.driverVerified);

  const targetUsers = useMemo(() => {
    if (audience === "drivers") return drivers;
    if (audience === "passengers") return passengers;
    if (audience === "specific") {
      return activeUsers.filter((user) => user.id === specificUserId);
    }

    return activeUsers;
  }, [audience, activeUsers, drivers, passengers, specificUserId]);

  async function sendNotification() {
    if (!title.trim() || !body.trim()) {
      setMessage("Title and message are required.");
      return;
    }

    if (audience === "specific" && !specificUserId) {
      setMessage("Select a specific user first.");
      return;
    }

    if (targetUsers.length === 0) {
      setMessage("No users found for this audience.");
      return;
    }

    try {
      setSending(true);
      setMessage("");

      const now = new Date().toISOString();

      const broadcastRef = await addDoc(collection(db, "broadcastNotifications"), {
        title: title.trim(),
        message: body.trim(),
        type,
        audience,
        specificUserId: audience === "specific" ? specificUserId : "",
        sentCount: targetUsers.length,
        createdAt: now,
      });

      await Promise.all(
        targetUsers.map((user) =>
          setDoc(
            doc(db, "notifications", `${user.id}-broadcast-${Date.now()}-${Math.random()}`),
            {
              userId: user.id,
              type,
              title: title.trim(),
              message: body.trim(),
              read: false,
              broadcastId: broadcastRef.id,
              createdAt: now,
              actionUrl: "/notifications",
            },
            { merge: true }
          )
        )
      );

      setTitle("");
      setBody("");
      setType("system");
      setAudience("all");
      setSpecificUserId("");

      setMessage(`Notification sent to ${targetUsers.length} user(s).`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not send notification.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/support" className="miniButton">Support</Link>
          <Link href="/admin/settings" className="miniButton">Settings</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Notifications <span>Center</span></h1>
            <p className="subtitle">
              Send platform alerts, security updates, promotions, maintenance notices,
              and user-specific notifications.
            </p>
          </div>

          <div className="heroIcon">🔔</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="All Users" value={String(activeUsers.length)} />
          <Metric icon="🚘" label="Drivers" value={String(drivers.length)} />
          <Metric icon="🎟️" label="Passengers" value={String(passengers.length)} />
          <Metric icon="📣" label="Broadcasts" value={String(broadcasts.length)} />
        </section>

        <section className="sendCard">
          <p className="eyebrow">Create Broadcast</p>
          <h2>Send Notification</h2>

          <div className="formGrid">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Notification title"
            />

            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="system">System</option>
              <option value="promotion">Promotion</option>
              <option value="security">Security</option>
              <option value="maintenance">Maintenance</option>
              <option value="payment">Payment</option>
              <option value="ride">Ride</option>
            </select>

            <select value={audience} onChange={(event) => setAudience(event.target.value)}>
              <option value="all">All active users</option>
              <option value="drivers">Drivers only</option>
              <option value="passengers">Passengers only</option>
              <option value="specific">Specific user</option>
            </select>
          </div>

          {audience === "specific" && (
            <select
              className="userSelect"
              value={specificUserId}
              onChange={(event) => setSpecificUserId(event.target.value)}
            >
              <option value="">Select user</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email || user.name || user.id}
                </option>
              ))}
            </select>
          )}

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write notification message..."
          />

          <div className="previewBox">
            <strong>Audience Preview</strong>
            <p>This message will be sent to {targetUsers.length} user(s).</p>
          </div>

          <button onClick={sendNotification} disabled={sending} className="sendButton">
            {sending ? "Sending..." : "Send Notification"}
          </button>
        </section>

        <section className="historyCard">
          <p className="eyebrow">History</p>
          <h2>Broadcast Campaigns</h2>

          {broadcasts.length === 0 ? (
            <div className="empty">
              <h3>No broadcasts yet</h3>
              <p>Sent campaigns will appear here.</p>
            </div>
          ) : (
            <div className="list">
              {broadcasts.map((item) => (
                <div key={item.id} className="broadcast">
                  <div className="broadcastIcon">📣</div>

                  <div>
                    <strong>{item.title || "Broadcast"}</strong>
                    <p>{item.message || "No message"}</p>
                    <small>
                      Audience: {item.audience || "all"} • Sent: {item.sentCount || 0} •{" "}
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recently"}
                    </small>
                  </div>

                  <em>{item.type || "system"}</em>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
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
        .sendCard,
        .historyCard {
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
          margin: 0 0 18px;
        }

        .subtitle,
        .empty p,
        .previewBox p,
        .broadcast p,
        .broadcast small {
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
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
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
        }

        .sendCard,
        .historyCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: 1fr 220px 220px;
          gap: 12px;
        }

        input,
        select,
        textarea {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        select option {
          color: black;
        }

        .userSelect {
          margin-top: 12px;
        }

        textarea {
          min-height: 130px;
          resize: vertical;
          margin-top: 12px;
        }

        .previewBox {
          padding: 16px;
          border-radius: 18px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.3);
          margin-top: 12px;
        }

        .sendButton {
          width: 100%;
          margin-top: 14px;
          padding: 17px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .list {
          display: grid;
          gap: 12px;
        }

        .broadcast {
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .broadcastIcon {
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

        .broadcast strong,
        .broadcast p,
        .broadcast small {
          display: block;
          overflow-wrap: anywhere;
        }

        .broadcast p {
          margin: 5px 0;
        }

        .broadcast em {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          white-space: nowrap;
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

        @media (max-width: 900px) {
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .formGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
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

          .stats {
            grid-template-columns: 1fr;
          }

          .sendCard,
          .historyCard {
            padding: 24px;
          }

          .broadcast {
            grid-template-columns: 46px 1fr;
          }

          .broadcast em {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .broadcastIcon {
            width: 46px;
            height: 46px;
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
