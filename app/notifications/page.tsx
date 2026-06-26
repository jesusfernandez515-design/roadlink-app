"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  rideId?: string;
  bookingId?: string;
  chatId?: string;
  driverId?: string;
  passengerId?: string;
  senderId?: string;
  receiverId?: string;
  actionUrl?: string;
};

type CategoryKey =
  | "message"
  | "payout"
  | "support"
  | "emergency"
  | "booking"
  | "cancelled"
  | "completed";

const categories: {
  key: CategoryKey;
  title: string;
  icon: string;
  description: string;
}[] = [
  {
    key: "message",
    title: "New Messages",
    icon: "💬",
    description: "All direct chat and message notifications.",
  },
  {
    key: "payout",
    title: "Payout Update",
    icon: "🏦",
    description: "Driver wallet, payout requests and payout status updates.",
  },
  {
    key: "support",
    title: "Support Ticket Created",
    icon: "🎧",
    description: "Support requests submitted through RoadLink.",
  },
  {
    key: "emergency",
    title: "Emergency Alert Sent",
    icon: "🚨",
    description: "SOS and emergency alerts sent from the platform.",
  },
  {
    key: "booking",
    title: "New Ride Booking",
    icon: "🎟️",
    description: "New passenger reservations and ride booking activity.",
  },
  {
    key: "cancelled",
    title: "Booking Cancelled",
    icon: "❌",
    description: "Cancelled passenger bookings and ride reservation changes.",
  },
  {
    key: "completed",
    title: "Ride Completed",
    icon: "✅",
    description: "Completed trips and finished ride confirmations.",
  },
];

export default function NotificationsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [status, setStatus] = useState("Loading notifications...");
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("message");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId("");
        setNotifications([]);
        setStatus("Please sign in to view your notifications.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setStatus("");
    });

    return () => unsubscribeAuth();
  }, [router]);

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
          ...document.data(),
          id: document.id,
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

  const categorized = useMemo(() => {
    const groups: Record<CategoryKey, NotificationItem[]> = {
      message: [],
      payout: [],
      support: [],
      emergency: [],
      booking: [],
      cancelled: [],
      completed: [],
    };

    notifications.forEach((notification) => {
      const category = getCategory(notification);
      groups[category].push(notification);
    });

    return groups;
  }, [notifications]);

  const totalUnread = useMemo(() => {
    return notifications.filter((notification) => !notification.read).length;
  }, [notifications]);

  const activeNotifications = categorized[activeCategory] || [];
  const activeUnread = activeNotifications.filter((item) => !item.read).length;

  function getCategory(notification: NotificationItem): CategoryKey {
    const title = String(notification.title || "").toLowerCase();
    const message = String(notification.message || "").toLowerCase();
    const type = String(notification.type || "").toLowerCase();
    const combined = `${title} ${message} ${type}`;

    if (combined.includes("message")) return "message";
    if (combined.includes("payout") || combined.includes("payment")) return "payout";
    if (combined.includes("support")) return "support";
    if (combined.includes("emergency") || combined.includes("sos")) return "emergency";
    if (combined.includes("cancel")) return "cancelled";
    if (combined.includes("completed") || combined.includes("ride completed")) return "completed";
    if (combined.includes("booking") || type === "booking") return "booking";

    return "booking";
  }

  function formatTime(value?: any) {
    if (!value) return "Now";

    try {
      const date = value?.toDate ? value.toDate() : new Date(value);

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

  function getNotificationUrl(notification: NotificationItem) {
    if (notification.actionUrl) return notification.actionUrl;

    const category = getCategory(notification);

    if (category === "message") {
      if (notification.chatId) {
        return `/chat?chatId=${notification.chatId}&rideId=${notification.rideId || ""}&driverId=${notification.driverId || ""}&passengerId=${notification.passengerId || ""}`;
      }

      return "/messages";
    }

    if (category === "payout") return "/wallet";
    if (category === "support") return "/support";
    if (category === "emergency") return "/sos";
    if (category === "booking") {
      if (notification.rideId) return `/ride-passengers?rideId=${notification.rideId}`;
      return "/my-rides";
    }

    if (category === "cancelled") return "/my-rides";
    if (category === "completed") return "/my-rides";

    return "/dashboard";
  }

  async function markOneAsRead(notificationId: string) {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true,
        readAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not update notification.");
    }
  }

  async function openNotification(notification: NotificationItem) {
    try {
      if (!notification.read) {
        await markOneAsRead(notification.id);
      }

      router.push(getNotificationUrl(notification));
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not open notification.");
    }
  }

  async function markAllAsRead() {
    const unreadNotifications = notifications.filter((notification) => !notification.read);
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
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not mark notifications as read.");
    } finally {
      setSaving(false);
    }
  }

  async function markCategoryAsRead() {
    const unreadCategory = activeNotifications.filter((notification) => !notification.read);
    if (!unreadCategory.length) return;

    try {
      setSaving(true);
      setStatus("");

      const batch = writeBatch(db);

      unreadCategory.forEach((notification) => {
        batch.update(doc(db, "notifications", notification.id), {
          read: true,
          readAt: new Date().toISOString(),
        });
      });

      await batch.commit();
      setStatus(`${getActiveCategoryTitle()} marked as read.`);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not update category.");
    } finally {
      setSaving(false);
    }
  }

  function getActiveCategoryTitle() {
    return categories.find((category) => category.key === activeCategory)?.title || "Notifications";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="backButton">← Dashboard</Link>
          <Link href="/messages" className="backButton">Messages</Link>
          <Link href="/my-rides" className="backButton">My Rides</Link>
          <Link href="/profile" className="backButton">Profile</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Notifications</p>
            <h1>Notification <span>Center</span></h1>
            <p className="subtitle">
              View your activity by category. Tap a notification type to expand its full content.
            </p>
          </div>

          <div className={totalUnread > 0 ? "bell activeBell" : "bell"}>
            🔔
            {totalUnread > 0 && <span>{totalUnread}</span>}
          </div>
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

        <section className="categoryPanel">
          <div className="header">
            <div>
              <p className="eyebrow">Notification Types</p>
              <h2>Activity Buttons</h2>
            </div>

            <button className="readButton" onClick={markAllAsRead} disabled={saving || totalUnread === 0}>
              {saving ? "Updating..." : "Mark all as read"}
            </button>
          </div>

          <div className="categoryGrid">
            {categories.map((category) => {
              const items = categorized[category.key] || [];
              const unread = items.filter((item) => !item.read).length;
              const isActive = activeCategory === category.key;

              return (
                <button
                  key={category.key}
                  type="button"
                  className={isActive ? "categoryButton activeCategory" : "categoryButton"}
                  onClick={() => setActiveCategory(category.key)}
                >
                  <div className="categoryIcon">{category.icon}</div>

                  <div className="categoryContent">
                    <strong>{category.title}</strong>
                    <span>{category.description}</span>
                  </div>

                  <div className="categoryCount">
                    <b>{items.length}</b>
                    {unread > 0 && <small>{unread} new</small>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card">
          <div className="header">
            <div>
              <p className="eyebrow">Expanded Content</p>
              <h2>{getActiveCategoryTitle()}</h2>
              <p className="categorySummary">
                {activeNotifications.length} total · {activeUnread} unread
              </p>
            </div>

            <button
              className="readButton"
              onClick={markCategoryAsRead}
              disabled={saving || activeUnread === 0}
            >
              {saving ? "Updating..." : "Mark category read"}
            </button>
          </div>

          {activeNotifications.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">
                {categories.find((category) => category.key === activeCategory)?.icon || "🔕"}
              </div>

              <h3>No {getActiveCategoryTitle()} yet</h3>

              <p>
                When RoadLink creates this type of notification, it will appear inside this category.
              </p>
            </div>
          ) : (
            <div className="list">
              {activeNotifications.map((notification) => {
                const isUnread = !notification.read;

                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={isUnread ? "notification unread" : "notification"}
                    onClick={() => openNotification(notification)}
                  >
                    <div className="icon">
                      {categories.find((category) => category.key === activeCategory)?.icon || "🔔"}
                    </div>

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

                      <div className="detailsGrid">
                        {notification.rideId && <Detail label="Ride ID" value={notification.rideId} />}
                        {notification.bookingId && <Detail label="Booking ID" value={notification.bookingId} />}
                        {notification.chatId && <Detail label="Chat ID" value={notification.chatId} />}
                        {notification.driverId && <Detail label="Driver ID" value={notification.driverId} />}
                        {notification.passengerId && <Detail label="Passenger ID" value={notification.passengerId} />}
                      </div>

                      <div className="metaRow">
                        <span>{formatTime(notification.createdAt)}</span>
                        <strong>Open</strong>
                      </div>
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
          padding-bottom: 120px;
          color: white;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 35%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          max-width: 1100px;
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
        .categoryPanel {
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

        h1 span,
        h2 {
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
          position: relative;
          min-width: 100px;
          height: 100px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 45px;
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.3);
        }

        .bell span {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 34px;
          height: 34px;
          padding: 0 9px;
          border-radius: 999px;
          background: #ef4444;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 900;
          border: 2px solid #020617;
        }

        .activeBell {
          animation: pulse 1.6s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.35); }
          70% { box-shadow: 0 0 0 14px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
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

        .stat span,
        .categorySummary {
          color: #a1a1aa;
          font-weight: 900;
        }

        .stat h2 {
          color: #22c55e;
          margin: 10px 0 0;
          font-size: 34px;
        }

        .categoryPanel,
        .card {
          padding: 30px;
          border-radius: 30px;
          margin-bottom: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 22px;
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

        .categoryGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .categoryButton {
          width: 100%;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 14px;
          align-items: center;
          text-align: left;
          padding: 18px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
        }

        .activeCategory {
          background: rgba(34,197,94,0.1);
          border-color: rgba(34,197,94,0.45);
        }

        .categoryIcon {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
        }

        .categoryContent strong {
          display: block;
          font-size: 18px;
          margin-bottom: 5px;
        }

        .categoryContent span {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.35;
        }

        .categoryCount {
          text-align: right;
        }

        .categoryCount b {
          display: block;
          color: #22c55e;
          font-size: 28px;
        }

        .categoryCount small {
          display: inline-flex;
          margin-top: 5px;
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(34,197,94,0.14);
          color: #22c55e;
          font-weight: 900;
          white-space: nowrap;
        }

        .empty {
          min-height: 260px;
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

        .detailsGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-top: 12px;
        }

        .detail {
          padding: 10px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .detail span {
          display: block;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 4px;
        }

        .detail strong {
          display: block;
          color: #e5e7eb;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .metaRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-top: 12px;
        }

        .metaRow span,
        .metaRow strong {
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

        @media (max-width: 760px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 42px;
          }

          .stats,
          .categoryGrid,
          .detailsGrid {
            grid-template-columns: 1fr;
          }

          .categoryPanel,
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

          .categoryButton {
            grid-template-columns: auto 1fr;
          }

          .categoryCount {
            grid-column: 1 / -1;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .titleRow {
            flex-direction: column;
            align-items: flex-start;
          }

          .notification {
            grid-template-columns: 1fr;
          }

          .metaRow {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
        }
