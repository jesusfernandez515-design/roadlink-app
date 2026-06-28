"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type SOSStatus = "active" | "support_responding" | "officer_assigned" | "closed";

type EmergencyAlert = {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyType?: string;
  emergencyTitle?: string;
  priority?: string;
  status?: SOSStatus;
  note?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  mapUrl?: string;
  photoUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type FilterKey = "active" | "support_responding" | "officer_assigned" | "closed" | "all";

export default function AdminSOSPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [filter, setFilter] = useState<FilterKey>("active");
  const [status, setStatus] = useState("Loading SOS center...");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    let unsubscribeUser: (() => void) | undefined;
    let unsubscribeAlerts: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      unsubscribeUser = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : ({ id: user.uid, email: user.email || "" } as UserProfile);

          setCurrentUser(data);

          const isAdmin =
            data.admin === true ||
            data.role === "admin" ||
            user.email === "jesusfernandez515@gmail.com";

          if (!isAdmin) {
            setStatus("Access denied. Admin account required.");
            return;
          }

          setStatus("");

          if (!unsubscribeAlerts) {
            unsubscribeAlerts = onSnapshot(
              query(collection(db, "emergencyAlerts")),
              (snapshotData) => {
                const data = snapshotData.docs.map((item) => ({
                  id: item.id,
                  ...item.data(),
                })) as EmergencyAlert[];

                data.sort((a, b) =>
                  String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
                );

                setAlerts(data);
              },
              (error) => setStatus(error.message)
            );
          }
        },
        (error) => setStatus(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeAlerts) unsubscribeAlerts();
    };
  }, [router]);

  const adminAllowed =
    currentUser?.admin === true ||
    currentUser?.role === "admin" ||
    auth.currentUser?.email === "jesusfernandez515@gmail.com";

  const visibleAlerts = useMemo(() => {
    if (filter === "all") return alerts;
    return alerts.filter((item) => (item.status || "active") === filter);
  }, [alerts, filter]);

  const counts = useMemo(() => {
    return {
      all: alerts.length,
      active: alerts.filter((item) => (item.status || "active") === "active").length,
      responding: alerts.filter((item) => item.status === "support_responding").length,
      officer: alerts.filter((item) => item.status === "officer_assigned").length,
      closed: alerts.filter((item) => item.status === "closed").length,
      critical: alerts.filter((item) => item.priority === "critical" || item.priority === "life_threatening").length,
    };
  }, [alerts]);

  function formatDate(value?: string) {
    if (!value) return "Recently";

    try {
      const date = new Date(value);
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

  function statusLabel(value?: SOSStatus) {
    if (value === "support_responding") return "Support Responding";
    if (value === "officer_assigned") return "Officer Assigned";
    if (value === "closed") return "Closed";
    return "Active";
  }

  function priorityLabel(value?: string) {
    if (value === "life_threatening") return "Life Threatening";
    if (value === "critical") return "Critical";
    return "High";
  }

  async function updateAlertStatus(alert: EmergencyAlert, nextStatus: SOSStatus) {
    try {
      setSavingId(alert.id);
      setStatus("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "emergencyAlerts", alert.id), {
        status: nextStatus,
        updatedAt: now,
        closedAt: nextStatus === "closed" ? now : "",
        assignedAt: nextStatus === "officer_assigned" ? now : "",
        respondingAt: nextStatus === "support_responding" ? now : "",
        reviewedBy: auth.currentUser?.uid || "",
        reviewedByEmail: auth.currentUser?.email || "",
      });

      if (alert.userId) {
        await addDoc(collection(db, "notifications"), {
          userId: alert.userId,
          type: "emergency",
          title: "Emergency Alert Updated",
          message: `Your SOS status is now: ${statusLabel(nextStatus)}.`,
          emergencyAlertId: alert.id,
          read: false,
          createdAt: now,
          actionUrl: "/sos",
        });
      }

      setStatus(`SOS marked as ${statusLabel(nextStatus)}.`);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not update SOS alert.");
    } finally {
      setSavingId("");
    }
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Admin <span>SOS</span></h1>
          <p>{status || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>

        <PageStyles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/sos" className="navButton">SOS Page</Link>
          <Link href="/notifications" className="navButton">Notifications</Link>
          <Link href="/dashboard" className="navButton">Dashboard</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Safety Operations</p>
            <h1>Admin <span>SOS Center</span></h1>
            <p className="subtitle">
              Monitor emergency alerts, GPS locations, attached evidence and response status in real time.
            </p>
          </div>

          <div className="liveOrb">
            <strong>{counts.active}</strong>
            <span>Active SOS</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="🚨" label="Active" value={String(counts.active)} />
          <Metric icon="📡" label="Responding" value={String(counts.responding)} />
          <Metric icon="🚔" label="Officer" value={String(counts.officer)} />
          <Metric icon="🔴" label="Critical" value={String(counts.critical)} />
          <Metric icon="✅" label="Closed" value={String(counts.closed)} />
          <Metric icon="📋" label="Total" value={String(counts.all)} />
        </section>

        <section className="filters">
          <button className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>
            🚨 Active
          </button>
          <button className={filter === "support_responding" ? "active" : ""} onClick={() => setFilter("support_responding")}>
            📡 Responding
          </button>
          <button className={filter === "officer_assigned" ? "active" : ""} onClick={() => setFilter("officer_assigned")}>
            🚔 Officer
          </button>
          <button className={filter === "closed" ? "active" : ""} onClick={() => setFilter("closed")}>
            ✅ Closed
          </button>
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            🔎 All
          </button>
        </section>

        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Emergency Alerts</p>
              <h2>{visibleAlerts.length} SOS Incidents</h2>
            </div>
          </div>

          {visibleAlerts.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🚨</div>
              <h3>No SOS alerts in this filter</h3>
              <p>Emergency alerts will appear here as soon as users submit them.</p>
            </div>
          ) : (
            <div className="list">
              {visibleAlerts.map((alert) => {
                const mapLink =
                  alert.mapUrl ||
                  (alert.latitude && alert.longitude
                    ? `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`
                    : "");

                return (
                  <article key={alert.id} className="sosCard">
                    <div className="cardTop">
                      <div className="sosIcon">🚨</div>

                      <div>
                        <h3>{alert.emergencyTitle || alert.emergencyType || "Emergency Alert"}</h3>
                        <p>{alert.userEmail || "Unknown user"} · {priorityLabel(alert.priority)}</p>
                        <small>
                          Status: {statusLabel(alert.status)} · {formatDate(alert.createdAt)}
                        </small>
                      </div>

                      <div className="priorityBox">
                        <strong>{priorityLabel(alert.priority)}</strong>
                        <span>{statusLabel(alert.status)}</span>
                      </div>
                    </div>

                    <div className="detailsGrid">
                      <Detail label="User" value={alert.userName || alert.userEmail || "N/A"} />
                      <Detail label="Phone" value={alert.userPhone || "N/A"} />
                      <Detail label="Contact" value={alert.emergencyContactName || "N/A"} />
                      <Detail label="Contact Phone" value={alert.emergencyContactPhone || "N/A"} />
                      <Detail label="Latitude" value={alert.latitude ? String(alert.latitude) : "N/A"} />
                      <Detail label="Longitude" value={alert.longitude ? String(alert.longitude) : "N/A"} />
                      <Detail label="Accuracy" value={alert.accuracy ? `${Math.round(alert.accuracy)} meters` : "N/A"} />
                      <Detail label="Photos" value={String(alert.photoUrls?.length || 0)} />
                    </div>

                    {alert.note && (
                      <div className="noteBox">
                        <strong>Incident Note</strong>
                        <p>{alert.note}</p>
                      </div>
                    )}

                    <div className="documentsGrid">
                      {mapLink ? (
                        <a href={mapLink} target="_blank" rel="noopener noreferrer" className="document">
                          <span>GPS Location</span>
                          <strong>Open Map</strong>
                        </a>
                      ) : (
                        <div className="document missing">
                          <span>GPS Location</span>
                          <strong>Missing</strong>
                        </div>
                      )}

                      {(alert.photoUrls || []).map((url, index) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="document">
                          <span>Photo {index + 1}</span>
                          <strong>Open</strong>
                        </a>
                      ))}
                    </div>

                    <div className="actions">
                      <button
                        onClick={() => updateAlertStatus(alert, "support_responding")}
                        disabled={savingId === alert.id || alert.status === "support_responding"}
                      >
                        📡 Responding
                      </button>

                      <button
                        onClick={() => updateAlertStatus(alert, "officer_assigned")}
                        disabled={savingId === alert.id || alert.status === "officer_assigned"}
                      >
                        🚔 Officer Assigned
                      </button>

                      <button
                        className="closeButton"
                        onClick={() => updateAlertStatus(alert, "closed")}
                        disabled={savingId === alert.id || alert.status === "closed"}
                      >
                        ✅ Close Incident
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <PageStyles />
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
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

function PageStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 120px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(239,68,68,0.30), transparent 35%),
          radial-gradient(circle at bottom left, rgba(34,197,94,0.12), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container {
        max-width: 1180px;
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
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        display: inline-flex;
        justify-content: center;
      }

      .hero,
      .metric,
      .filters,
      .panel,
      .sosCard,
      .locked {
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
        border-radius: 32px;
        margin-bottom: 20px;
      }

      .locked {
        max-width: 720px;
        margin: 80px auto;
        padding: 35px;
        border-radius: 32px;
        text-align: center;
      }

      .eyebrow {
        color: #ef4444;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 13px;
        margin: 0 0 10px;
      }

      h1 {
        margin: 0 0 16px;
        font-size: 60px;
        line-height: 1;
      }

      h1 span,
      h2,
      .metric strong,
      .liveOrb strong {
        color: #ef4444;
      }

      .subtitle,
      .locked p {
        color: #a1a1aa;
        max-width: 720px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .liveOrb {
        min-width: 120px;
        height: 120px;
        border-radius: 50%;
        background: rgba(239,68,68,0.13);
        border: 1px solid rgba(239,68,68,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
      }

      .liveOrb strong {
        font-size: 34px;
      }

      .liveOrb span {
        color: #d4d4d8;
        font-size: 12px;
        font-weight: 900;
      }

      .status {
        text-align: center;
        color: #22c55e;
        font-weight: 900;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .metric {
        padding: 18px;
        border-radius: 22px;
      }

      .metricIcon {
        font-size: 24px;
        margin-bottom: 8px;
      }

      .metric span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .metric strong {
        font-size: 24px;
      }

      .filters {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        border-radius: 26px;
        padding: 14px;
        margin-bottom: 20px;
      }

      button {
        border: none;
        border-radius: 999px;
        padding: 13px 15px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      button.active {
        color: #ef4444;
        background: rgba(239,68,68,0.12);
        border-color: rgba(239,68,68,0.4);
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .panel {
        border-radius: 30px;
        padding: 30px;
      }

      .sectionHeader {
        margin-bottom: 20px;
      }

      .list {
        display: grid;
        gap: 16px;
      }

      .sosCard {
        border-radius: 26px;
        padding: 22px;
        box-shadow: none;
      }

      .cardTop {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 16px;
        align-items: center;
        margin-bottom: 16px;
      }

      .sosIcon {
        width: 58px;
        height: 58px;
        border-radius: 50%;
        background: rgba(239,68,68,0.14);
        border: 1px solid rgba(239,68,68,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
      }

      .cardTop h3 {
        margin: 0 0 5px;
        font-size: 22px;
        overflow-wrap: anywhere;
      }

      .cardTop p,
      .cardTop small {
        color: #a1a1aa;
        margin: 0;
        overflow-wrap: anywhere;
      }

      .priorityBox {
        text-align: center;
        padding: 12px;
        border-radius: 18px;
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.3);
      }

      .priorityBox strong {
        color: #ef4444;
        display: block;
        font-size: 17px;
      }

      .priorityBox span {
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
      }

      .detailsGrid,
      .documentsGrid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 14px;
      }

      .detail,
      .document {
        padding: 13px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .document {
        text-decoration: none;
      }

      .document.missing {
        opacity: 0.55;
      }

      .detail span,
      .document span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 5px;
      }

      .detail strong,
      .document strong {
        display: block;
        color: #e5e7eb;
        overflow-wrap: anywhere;
      }

      .document strong {
        color: #ef4444;
      }

      .noteBox {
        padding: 14px;
        border-radius: 18px;
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.35);
        margin-bottom: 14px;
      }

      .noteBox strong {
        color: #fca5a5;
      }

      .noteBox p {
        color: #fecaca;
        margin-bottom: 0;
      }

      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 10px;
      }

      .closeButton {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border: none;
      }

      .empty {
        min-height: 260px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      
      .emptyIcon {
        width: 82px;
        height: 82px;
        border-radius: 50%;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 38px;
        margin-bottom: 16px;
      }

      .empty p {
        color: #a1a1aa;
      }

      @media (max-width: 1000px) {
        .stats {
          grid-template-columns: repeat(3, 1fr);
        }

        .filters,
        .detailsGrid,
        .documentsGrid {
          grid-template-columns: 1fr;
        }

        .hero {
          flex-direction: column;
          align-items: flex-start;
        }

        h1 {
          font-size: 44px;
        }

        .cardTop {
          grid-template-columns: 1fr;
        }

        .priorityBox {
          text-align: left;
        }
      }

      @media (max-width: 700px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .stats,
        .actions {
          grid-template-columns: 1fr;
        }

        .hero,
        .panel,
        .sosCard {
          padding: 22px;
          border-radius: 26px;
        }

        .actions button {
          width: 100%;
        }
      }
    `}</style>
  );
      }
