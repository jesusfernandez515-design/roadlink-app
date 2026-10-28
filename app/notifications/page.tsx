"use client";

import { notificationInSpanish } from "../../lib/spanish";

import Link from "../components/AppLink";
import { useEffect, useMemo, useState } from "react";
import { useAppRouter as useRouter } from "../components/useAppRouter";
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
import { auth, db } from "../../lib/firebase";

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
  | "instant"
  | "message"
  | "payout"
  | "support"
  | "emergency"
  | "booking"
  | "cancelled"
  | "completed"
  | "all";

const categories: {
  key: CategoryKey;
  title: string;
  icon: string;
  description: string;
}[] = [
  { key: "instant", title: "Viajes de último minuto", icon: "🚕", description: "Solicitudes urgentes y propuestas de recogida." },
  {
    key: "message",
    title: "Mensajes nuevos",
    icon: "💬",
    description: "Chats y mensajes directos.",
  },
  {
    key: "payout",
    title: "Actualización de retiros",
    icon: "🏦",
    description: "Cartera, pagos y retiros.",
  },
  {
    key: "support",
    title: "Solicitud de soporte creada",
    icon: "🎧",
    description: "Solicitudes y soporte.",
  },
  {
    key: "emergency",
    title: "Alerta de emergencia enviada",
    icon: "🚨",
    description: "Alertas SOS y emergencias.",
  },
  {
    key: "booking",
    title: "Nueva reserva de viaje",
    icon: "🎟️",
    description: "Reservas nuevas.",
  },
  {
    key: "cancelled",
    title: "Reserva cancelada",
    icon: "❌",
    description: "Reservas o viajes cancelados.",
  },
  {
    key: "completed",
    title: "Viaje completado",
    icon: "✅",
    description: "Viajes completados.",
  },
  {
    key: "all",
    title: "Todas",
    icon: "🔔",
    description: "Toda la actividad.",
  },
];

export default function NotificationsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [status, setStatus] = useState("Cargando notificaciones…");
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId("");
        setNotifications([]);
        setStatus("Inicia sesión para ver tus notificaciones.");
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
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as NotificationItem[];

        setNotifications(data);
        setStatus("");
      },
      (error) => setStatus(error.message)
    );

    return () => unsubscribe();
  }, [userId]);

  function getDate(value?: any) {
    if (!value) return new Date();

    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      return Number.isNaN(date.getTime()) ? new Date() : date;
    } catch {
      return new Date();
    }
  }

  function formatTime(value?: any) {
    const date = getDate(value);

    return date.toLocaleString("es-PR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getCategory(notification: NotificationItem): CategoryKey {
    const title = String(notification.title || "").toLowerCase();
    const message = String(notification.message || "").toLowerCase();
    const type = String(notification.type || "").toLowerCase();
    const combined = `${title} ${message} ${type}`;

    if (type === "instant_request" || type === "instant_offer") return "instant";
    if (combined.includes("message") || combined.includes("mensaje") || combined.includes("chat")) return "message";
    if (combined.includes("payout") || combined.includes("payment") || combined.includes("wallet") || combined.includes("pago") || combined.includes("retiro")) return "payout";
    if (combined.includes("support") || combined.includes("soporte") || combined.includes("ticket")) return "support";
    if (combined.includes("emergency") || combined.includes("emergencia") || combined.includes("sos")) return "emergency";
    if (combined.includes("cancel")) return "cancelled";
    if (combined.includes("completed") || combined.includes("completado") || combined.includes("terminado") || combined.includes("ride completed")) return "completed";
    if (combined.includes("booking") || combined.includes("reserva") || type === "booking") return "booking";

    return "booking";
  }

  function getNotificationUrl(notification: NotificationItem) {
    if (notification.actionUrl) return notification.actionUrl;

    const category = getCategory(notification);

    if (category === "instant") return "/ride-now";
    if (category === "message") {
      if (notification.chatId) return `/chat?chatId=${notification.chatId}`;
      return "/messages";
    }

    if (category === "payout") return "/wallet";
    if (category === "support") return "/support";
    if (category === "emergency") return "/sos";

    if (category === "booking") {
      if (notification.rideId) return `/ride-passengers?rideId=${notification.rideId}`;
      return "/my-rides";
    }

    if (category === "cancelled") return "/my-bookings";
    if (category === "completed") return "/my-bookings";

    return "/dashboard";
  }

  const grouped = useMemo(() => {
    const result: Record<CategoryKey, NotificationItem[]> = {
      instant: [],
      message: [],
      payout: [],
      support: [],
      emergency: [],
      booking: [],
      cancelled: [],
      completed: [],
      all: [],
    };

    notifications.forEach((item) => {
      const category = getCategory(item);
      result[category].push(item);
      result.all.push(item);
    });

    return result;
  }, [notifications]);

  const totalUnread = notifications.filter((item) => !item.read).length;
  const activeItems = grouped[activeCategory] || [];
  const activeUnread = activeItems.filter((item) => !item.read).length;

  async function markOneAsRead(notificationId: string) {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
    });
  }

  async function openNotification(notification: NotificationItem) {
    try {
      if (!notification.read) {
        await markOneAsRead(notification.id);
      }

      router.push(getNotificationUrl(notification));
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "No se pudo abrir la notificación.");
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter((item) => !item.read);
    if (!unread.length) return;

    try {
      setSaving(true);
      setStatus("");

      const batch = writeBatch(db);

      unread.forEach((item) => {
        batch.update(doc(db, "notifications", item.id), {
          read: true,
        });
      });

      await batch.commit();
      setStatus("Todas las notificaciones se marcaron como leídas.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "No se pudieron actualizar las notificaciones.");
    } finally {
      setSaving(false);
    }
  }

  async function markCategoryAsRead() {
    const unread = activeItems.filter((item) => !item.read);
    if (!unread.length) return;

    try {
      setSaving(true);
      setStatus("");

      const batch = writeBatch(db);

      unread.forEach((item) => {
        batch.update(doc(db, "notifications", item.id), {
          read: true,
        });
      });

      await batch.commit();
      setStatus("Las notificaciones de esta categoría se marcaron como leídas.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "No se pudo actualizar esta categoría.");
    } finally {
      setSaving(false);
    }
  }

  const activeCategoryData =
    categories.find((item) => item.key === activeCategory) || categories[0];

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Mi panel</Link>
          <Link href="/messages" className="navButton">Mensajes</Link>
          <Link href="/my-rides" className="navButton">Mis viajes</Link>
          <Link href="/wallet" className="navButton">Cartera</Link>
          <Link href="/profile" className="navButton">Perfil</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">Actividad de RoadLink</p>
            <h1>Centro de <span>notificaciones</span></h1>
            <p className="subtitle">
              Selecciona una categoría para consultar sus notificaciones.
            </p>
          </div>

          <div className={totalUnread > 0 ? "bell activeBell" : "bell"}>
            🔔
            {totalUnread > 0 && <span>{totalUnread}</span>}
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric label="Total" value={String(notifications.length)} />
          <Metric label="Sin leer" value={String(totalUnread)} />
          <Metric label="Categoría seleccionada" value={activeCategoryData.title} />
          <Metric label="Sin leer en esta categoría" value={String(activeUnread)} />
        </section>

        <section className="categoryPanel">
          <div className="header">
            <div>
              <p className="eyebrow">Categorías de notificaciones</p>
              <h2>Selecciona una categoría</h2>
            </div>

            <button
              className="readButton"
              onClick={markAllAsRead}
              disabled={saving || totalUnread === 0}
            >
              {saving ? "Actualizando…" : "Marcar todas como leídas"}
            </button>
          </div>

          <div className="categoryGrid">
            {categories.map((category) => {
              const items = grouped[category.key] || [];
              const unread = items.filter((item) => !item.read).length;
              const active = activeCategory === category.key;

              return (
                <button
                  key={category.key}
                  type="button"
                  className={active ? "categoryButton activeCategory" : "categoryButton"}
                  onClick={() => setActiveCategory(category.key)}
                >
                  <div className="categoryIcon">{category.icon}</div>

                  <div className="categoryText">
                    <strong>{category.title}</strong>
                    <span>{category.description}</span>
                  </div>

                  <div className="categoryCount">
                    <b>{items.length}</b>
                    {unread > 0 && <small>{unread} nuevas</small>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="contentPanel">
          <div className="header">
            <div>
              <p className="eyebrow">Notificaciones de la categoría</p>
              <h2>{activeCategoryData.icon} {activeCategoryData.title}</h2>
              <p className="summary">
                {activeItems.length} total · {activeUnread} sin leer
              </p>
            </div>

            <button
              className="readButton"
              onClick={markCategoryAsRead}
              disabled={saving || activeUnread === 0}
            >
              {saving ? "Actualizando…" : "Marcar categoría como leída"}
            </button>
          </div>

          {activeItems.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">{activeCategoryData.icon}</div>
              <h3>Todavía no hay actividad</h3>
              <p>Aquí aparecerán las novedades de esta categoría.</p>
            </div>
          ) : (
            <div className="list">
              {activeItems.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={!notification.read ? "notification unread" : "notification"}
                  onClick={() => openNotification(notification)}
                >
                  <div className="icon">{activeCategoryData.icon}</div>

                  <div className="content">
                    <div className="titleRow">
                      <h3>{notificationInSpanish(notification.title || "Novedad de RoadLink")}</h3>
                      {!notification.read ? (
                        <span className="unreadBadge">Nuevo</span>
                      ) : (
                        <span className="readBadge">Leído</span>
                      )}
                    </div>

                    <p>{notificationInSpanish(notification.message || "Tienes una nueva notificación de RoadLink.")}</p>

                    <div className="detailsGrid">
                      {notification.rideId && <Detail label="Referencia del viaje" value={notification.rideId} />}
                      {notification.bookingId && <Detail label="Referencia de reserva" value={notification.bookingId} />}
                      {notification.chatId && <Detail label="Referencia de conversación" value={notification.chatId} />}
                      {notification.driverId && <Detail label="Referencia del conductor" value={notification.driverId} />}
                      {notification.passengerId && <Detail label="Referencia del pasajero" value={notification.passengerId} />}
                    </div>

                    <div className="metaRow">
                      <span>{formatTime(notification.createdAt)}</span>
                      <strong>Abrir</strong>
                    </div>
                  </div>
                </button>
              ))}
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
          max-width: 1120px;
          margin: auto;
        }

        .topBar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }

        .navButton {
          color: white;
          text-decoration: none;
          font-weight: 900;
          padding: 12px 20px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .hero,
        .metric,
        .categoryPanel,
        .contentPanel {
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
        }

        h1 span,
        h2 {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          max-width: 680px;
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
          border-radius: 999px;
          background: #ef4444;
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
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }

        .metric {
          padding: 22px;
          border-radius: 24px;
        }

        .metric span {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metric strong {
          color: #22c55e;
          font-size: 25px;
          overflow-wrap: anywhere;
        }

        .categoryPanel,
        .contentPanel {
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

        .categoryIcon,
        .icon,
        .emptyIcon {
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

        .categoryText strong {
          display: block;
          font-size: 18px;
          margin-bottom: 5px;
        }

        .categoryText span,
        .summary,
        .empty p {
          color: #a1a1aa;
          line-height: 1.4;
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
          min-height: 250px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }

        .emptyIcon {
          font-size: 36px;
          width: 82px;
          height: 82px;
          margin-bottom: 18px;
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 28px;
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

        @media (max-width: 850px) {
          .stats,
          .categoryGrid,
          .detailsGrid {
            grid-template-columns: 1fr;
          }

          .hero,
          .header {
            flex-direction: column;
            align-items: flex-start;
          }

          h1 {
            font-size: 42px;
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
          }

          .notification {
            grid-template-columns: 1fr;
          }

          .titleRow,
          .metaRow {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 600px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .categoryPanel,
          .contentPanel {
            padding: 22px;
            border-radius: 26px;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
