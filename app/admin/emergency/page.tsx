"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type EmergencyStatus = "active" | "in_progress" | "resolved";

type EmergencyAlert = {
  id: string;
  userId?: string;
  userEmail?: string;
  status?: EmergencyStatus;
  priority?: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  adminNote?: string;
};

export default function AdminEmergencyPage() {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [selected, setSelected] = useState<EmergencyAlert | null>(null);
  const [filter, setFilter] = useState<"all" | EmergencyStatus>("all");
  const [adminNote, setAdminNote] = useState("");
  const [message, setMessage] = useState("Loading emergency alerts...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "emergencyAlerts")),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as EmergencyAlert[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setAlerts(data);

        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((item) => item.id === current.id) || data[0] || null;
        });

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setAdminNote(selected?.adminNote || "");
  }, [selected]);

  const filteredAlerts = useMemo(() => {
    if (filter === "all") return alerts;
    return alerts.filter((item) => item.status === filter);
  }, [alerts, filter]);

  const activeCount = alerts.filter((item) => item.status === "active").length;
  const inProgressCount = alerts.filter((item) => item.status === "in_progress").length;
  const resolvedCount = alerts.filter((item) => item.status === "resolved").length;
  const criticalCount = alerts.filter((item) => item.priority === "critical").length;

  function dateText(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function locationText(alert: EmergencyAlert) {
    if (typeof alert.latitude !== "number" || typeof alert.longitude !== "number") {
      return "Location not available";
    }

    return `${alert.latitude}, ${alert.longitude}`;
  }

  function mapUrl(alert: EmergencyAlert) {
    if (typeof alert.latitude !== "number" || typeof alert.longitude !== "number") {
      return "";
    }

    return `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;
  }

  async function updateAlertStatus(alert: EmergencyAlert, status: EmergencyStatus) {
    if (!alert.id) return;

    try {
      setLoadingId(alert.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "emergencyAlerts", alert.id), {
        status,
        adminNote: adminNote.trim(),
        updatedAt: now,
        ...(status === "resolved" ? { resolvedAt: now } : {}),
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Emergency Alert Updated",
        alertId: alert.id,
        userId: alert.userId || "",
        userEmail: alert.userEmail || "",
        status,
        details: adminNote.trim(),
        severity: status === "resolved" ? "success" : "warning",
        createdAt: now,
      });

      if (alert.userId) {
        await addDoc(collection(db, "notifications"), {
          userId: alert.userId,
          type: "emergency",
          title:
            status === "resolved"
              ? "Emergency Alert Resolved"
              : status === "in_progress"
              ? "Emergency Alert In Review"
              : "Emergency Alert Active",
          message:
            status === "resolved"
              ? "RoadLink Support marked your emergency alert as resolved."
              : status === "in_progress"
              ? "RoadLink Support is reviewing your emergency alert."
              : "Your emergency alert is still active.",
          read: false,
          createdAt: now,
          actionUrl: "/sos",
        });
      }

      setMessage("Emergency alert updated successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/support" className="miniButton">Support</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin Safety</p>
            <h1>Emergency <span>Center</span></h1>
            <p className="subtitle">
              Monitor SOS alerts, review user location, update emergency status,
              and create safety audit records.
            </p>
          </div>

          <div className="heroIcon">🚨</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚨" label="Active" value={String(activeCount)} />
          <Metric icon="👀" label="In Review" value={String(inProgressCount)} />
          <Metric icon="✅" label="Resolved" value={String(resolvedCount)} />
          <Metric icon="🔥" label="Critical" value={String(criticalCount)} />
        </section>

        <section className="adminGrid">
          <div className="alertsCard">
            <p className="eyebrow">SOS Queue</p>
            <h2>Emergency Alerts</h2>

            <div className="filters">
              <button onClick={() => setFilter("all")} className={filter === "all" ? "activeFilter" : ""}>All</button>
              <button onClick={() => setFilter("active")} className={filter === "active" ? "activeFilter" : ""}>Active</button>
              <button onClick={() => setFilter("in_progress")} className={filter === "in_progress" ? "activeFilter" : ""}>Review</button>
              <button onClick={() => setFilter("resolved")} className={filter === "resolved" ? "activeFilter" : ""}>Resolved</button>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="empty">
                <h3>No emergency alerts found</h3>
                <p>SOS alerts will appear here after users submit them.</p>
              </div>
            ) : (
              <div className="alertList">
                {filteredAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => setSelected(alert)}
                    className={selected?.id === alert.id ? "alertRow activeAlert" : "alertRow"}
                  >
                    <div className="alertIcon">🚨</div>

                    <div>
                      <strong>{alert.userEmail || "RoadLink User"}</strong>
                      <span>{dateText(alert.createdAt)}</span>
                      <small>{locationText(alert)}</small>
                    </div>

                    <em className={`status ${alert.status || "active"}`}>
                      {String(alert.status || "active").replace("_", " ")}
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
                    <p className="eyebrow">Selected Alert</p>
                    <h2>{selected.userEmail || "RoadLink User"}</h2>
                    <p className="email">{selected.userId || "No user ID"}</p>
                  </div>

                  <span className={`statusPill ${selected.status || "active"}`}>
                    {String(selected.status || "active").replace("_", " ")}
                  </span>
                </div>

                <div className="dangerBox">
                  <span>Emergency Priority</span>
                  <strong>{selected.priority || "critical"}</strong>
                </div>

                <div className="infoGrid">
                  <Info label="Alert ID" value={selected.id} />
                  <Info label="User Email" value={selected.userEmail || "Not available"} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                  <Info label="Resolved" value={dateText(selected.resolvedAt)} />
                  <Info label="Location" value={locationText(selected)} />
                </div>

                {mapUrl(selected) ? (
                  <a href={mapUrl(selected)} target="_blank" className="mapButton">
                    Open Location in Google Maps
                  </a>
                ) : (
                  <div className="locationMissing">
                    Location was not available for this SOS alert.
                  </div>
                )}

                <label>Admin Note</label>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  placeholder="Write a note about this emergency case..."
                />

                <div className="actionRow">
                  <button
                    className="reviewButton"
                    onClick={() => updateAlertStatus(selected, "in_progress")}
                    disabled={loadingId === selected.id}
                  >
                    Mark In Review
                  </button>

                  <button
                    className="activeButton"
                    onClick={() => updateAlertStatus(selected, "active")}
                    disabled={loadingId === selected.id}
                  >
                    Keep Active
                  </button>

                  <button
                    className="resolveButton"
                    onClick={() => updateAlertStatus(selected, "resolved")}
                    disabled={loadingId === selected.id}
                  >
                    Resolve
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select an alert</h3>
                <p>Choose an SOS alert to review safety details.</p>
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
            radial-gradient(circle at top right, rgba(239,68,68,0.25), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.12), transparent 35%),
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

        .topNav,
        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton,
        .filters button {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
          cursor: pointer;
        }

        .filters .activeFilter {
          background: rgba(239,68,68,0.14);
          border-color: rgba(239,68,68,0.45);
          color: #fca5a5;
        }

        .hero,
        .metric,
        .alertsCard,
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
          color: #ef4444;
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
        .dangerBox strong {
          color: #ef4444;
        }

        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 18px;
        }

        .subtitle,
        .email {
          max-width: 700px;
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .heroIcon {
          min-width: 92px;
          height: 92px;
          border-radius: 50%;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
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
          padding: 22px;
        }

        .metricIcon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(239,68,68,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 30px;
          font-weight: 900;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.95fr 1.45fr;
          gap: 24px;
        }

        .alertsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .alertList {
          display: grid;
          gap: 12px;
        }

        .alertRow {
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

        .activeAlert {
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.1);
        }

        .alertIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(239,68,68,0.13);
          border: 1px solid rgba(239,68,68,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .alertRow strong,
        .alertRow span,
        .alertRow small {
          display: block;
          overflow-wrap: anywhere;
        }

        .alertRow span,
        .alertRow small {
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
          text-transform: capitalize;
        }

        .status.active,
        .statusPill.active {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .status.in_progress,
        .statusPill.in_progress {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .status.resolved,
        .statusPill.resolved {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .dangerBox {
          padding: 24px;
          border-radius: 24px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          margin-bottom: 20px;
        }

        .dangerBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .dangerBox strong {
          font-size: 44px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .infoBox,
        .locationMissing {
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

        .infoBox strong,
        .locationMissing {
          overflow-wrap: anywhere;
        }

        .mapButton {
          display: flex;
          width: 100%;
          justify-content: center;
          align-items: center;
          padding: 16px;
          margin-bottom: 18px;
          border-radius: 999px;
          background: rgba(59,130,246,0.15);
          border: 1px solid rgba(59,130,246,0.4);
          color: #93c5fd;
          font-weight: 900;
          text-decoration: none;
        }

        .locationMissing {
          color: #a1a1aa;
          margin-bottom: 18px;
        }

        label {
          display: block;
          font-weight: 900;
          margin-bottom: 8px;
        }

        textarea {
          width: 100%;
          min-height: 140px;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 15px;
          outline: none;
          resize: vertical;
          margin-bottom: 16px;
          font-family: Arial, sans-serif;
        }

        .actionRow {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .reviewButton,
        .activeButton,
        .resolveButton {
          padding: 17px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .reviewButton {
          background: linear-gradient(135deg, #f59e0b, #b45309);
        }

        .activeButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        .resolveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 900px) {
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
          .adminGrid,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .alertsCard,
          .detailsCard {
            padding: 24px;
          }

          .alertRow {
            grid-template-columns: 52px 1fr;
          }

          .status {
            grid-column: 2;
            width: fit-content;
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
      <strong>{value || "Not available"}</strong>
    </div>
  );
}
