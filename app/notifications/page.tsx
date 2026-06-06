"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

type NotificationItem = {
  id: string;
  userId?: string;
  title?: string;
  message?: string;
  type?: string;
  read?: boolean;
  createdAt?: any;
};

export default function NotificationsPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [status, setStatus] = useState("Loading notifications...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId("");
        setUserEmail("");
        setNotifications([]);
        setStatus("Please sign in to view your notifications.");
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

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as NotificationItem[];

        setNotifications(data);
        setStatus("");
      },
      (error) => {
        setStatus(error.message);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const unreadNotifications = useMemo(() => {
    return notifications.filter((notification) => !notification.read);
  }, [notifications]);

  const totalUnread = unreadNotifications.length;

  function getIcon(type?: string) {
    if (type === "booking") return "🎟️";
    if (type === "message") return "💬";
    if (type === "ride") return "🚘";
    if (type === "review") return "⭐";
    if (type === "verification") return "🛡️";
    if (type === "payment") return "💳";
    return "🔔";
  }

  function formatTime(value?: any) {
    if (!value) return "Now";

    try {
      let date: Date;

      if (value?.toDate) {
        date = value.toDate();
      } else {
        date = new Date(value);
      }

      if (Number.isNaN(date.getTime())) return "Recently";

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  async function markOneAsRead(notificationId: string) {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true,
        readAt: new Date().toISOString(),
      });
    } catch (error: any) {
      setStatus(error.message || "Could not update notification.");
    }
  }

  async function markAllAsRead() {
    if (!unreadNotifications.length) return;

    try {
      setSaving(true);
      setStatus("");

      const batch = writeBatch(db);

      unreadNotifications.forEach((notification) => {
        batch.update(doc(db, "notifications", notification.id), {
          read: true,
          readAt: new Date().toISOString(),
        });
      });

      await batch.commit();
      setStatus("All notifications marked as read.");
    } catch (error: any) {
      setStatus(error.message || "Could not mark notifications as read.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="backButton">← Dashboard</Link>
          <Link href="/messages" className="backButton">Messages</Link>
          <Link href="/profile" className="backButton">Profile</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Notifications</p>
            <h1>Notification <span>Center</span></h1>
            <p className="subtitle">
              Track bookings, messages, ride updates, account alerts, reviews,
              payments and verification activity.
            </p>
          </div>

          <div className="bell">🔔</div>
        </section>

        <section className="debugCard">
          <p><strong>Current User:</strong> {userEmail || "Not signed in"}</p>
          <p><strong>Current User ID:</strong> {userId || "No user ID"}</p>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <div className="stat">
            <span>Total</span>
            <h2>{notifications.length}</h2>
          </div>

          <div className="stat">
            <span>Unread</span>
            <h2>{totalUnread}</h2>
          </div>

          <div className="stat">
            <span>Status</span>
            <h2>{userId ? "Live" : "Locked"}</h2>
          </div>
        </section>

        <section className="card">
          <div className="header">
            <div>
              <p className="eyebrow">Recent Activity</p>
              <h2>Notifications</h2>
            </div>

            <button
              className="readButton"
              onClick={markAllAsRead}
              disabled={saving || totalUnread === 0}
            >
              {saving ? "Updating..." : "Mark all as read"}
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🔕</div>
              <h3>No notifications yet</h3>
              <p>
                If you just reserved a ride, remember: the notification appears
                in the driver account, not the passenger account.
              </p>

              <Link href="/dashboard" className="mainButton">
                Back to Dashboard
              </Link>
            </div>
          ) : (
            <div className="list">
              {notifications.map((notification) => {
                const isUnread = !notification.read;

                return (
                  <button
                    key={notification.id}
                    className={isUnread ? "notification unread" : "notification"}
                    onClick={() => {
                      if (isUnread) markOneAsRead(notification.id);
                    }}
                  >
                    <div className="icon">{getIcon(notification.type)}</div>

                    <div className="content">
                      <div className="titleRow">
                        <h3>{notification.title || "RoadLink Update"}</h3>
                        {isUnread ? (
                          <span className="unreadBadge">New</span>
                        ) : (
                          <span className="readBadge">Read</span>
                        )}
                      </div>

                      <p>{notification.message || "You have a new RoadLink notification."}</p>
                      <span>{formatTime(notification.createdAt)}</span>
                    </div>
                  </button>
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
          padding: 24px;
          color: white;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 35%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          max-width: 1000px;
          margin: auto;
        }

        .topBar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }

        .backButton {
          color: white;
          text-decoration: none;
          font-weight: 900;
          padding: 12px 20px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .hero,
        .stat,
        .card,
        .debugCard {
          background: rgba(8,13,25,0.9);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding: 35px;
          border-radius: 30px;
          margin-bottom: 20px;
        }

        .debugCard {
          border-radius: 22px;
          padding: 18px;
          margin-bottom: 20px;
        }

        .debugCard p {
          margin: 6px 0;
          color: #d4d4d8;
          overflow-wrap: anywhere;
        }

        .debugCard strong {
          color: #22c55e;
        }

        .eyebrow {
          color: #22c55e;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 13px;
          margin: 0 0 10px;
        }

        h1 {
          margin: 10px 0 16px;
          font-size: 60px;
          line-height: 1;
          letter-spacing: -1px;
        }

        h1 span {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          max-width: 650px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .bell {
          min-width: 100px;
          height: 100px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 45px;
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.3);
          box-shadow: 0 18px 55px rgba(34,197,94,0.2);
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 18px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }

        .stat {
          padding: 25px;
          border-radius: 24px;
        }

        .stat span {
          color: #a1a1aa;
          font-weight: 900;
        }

        .stat h2 {
          color: #22c55e;
          margin: 10px 0 0;
          font-size: 34px;
        }

        .card {
          padding: 30px;
          border-radius: 30px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 22px;
        }

        .header h2 {
          margin: 0;
          font-size: 34px;
        }

        .readButton {
          width: auto;
          padding: 12px 18px;
          border-radius: 999px;
          border: 1px solid rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.12);
          color: #22c55e;
          font-weight: 900;
          cursor: pointer;
        }

        .readButton:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .list {
          display: grid;
          gap: 15px;
        }

        .notification {
          width: 100%;
          text-align: left;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 16px;
          padding: 20px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: white;
          cursor: pointer;
        }

        .unread {
          border-color: rgba(34,197,94,0.4);
          background: rgba(34,197,94,0.08);
        }

        .icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .titleRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .content h3 {
          margin: 0 0 8px;
          font-size: 20px;
        }

        .content p {
          margin: 0;
          color: #d4d4d8;
          line-height: 1.5;
        }

        .content span {
          display: block;
          margin-top: 10px;
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }

        .unreadBadge,
        .readBadge {
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .unreadBadge {
          background: rgba(34,197,94,0.15);
          color: #22c55e;
          border: 1px solid rgba(34,197,94,0.35);
        }

        .readBadge {
          background: rgba(255,255,255,0.06);
          color: #a1a1aa;
          border: 1px solid rgba(255,255,255,0.1);
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 42px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .card {
            padding: 22px;
          }

          .header {
            flex-direction: column;
            align-items: flex-start;
          }

          .readButton {
            width: 100%;
          }

          .titleRow {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
