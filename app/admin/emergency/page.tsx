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
  const [showFullDetails, setShowFullDetails] = useState(false);
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
    setShowFullDetails(false);
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

  function shortDate(value?: string) {
    if (!value) return "Recently";

    try {
      return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  function shortEmail(value?: string) {
    if (!value) return "RoadLink User";
    if (value.length <= 22) return value;
    const [name, domain] = value.split("@");
    return `${name.slice(0, 12)}...@${domain || "email.com"}`;
  }

  function shortId(value?: string) {
    if (!value) return "No user ID";
    if (value.length <= 14) return value;
    return `${value.slice(0, 7)}...${value.slice(-5)}`;
  }

  function statusLabel(status?: EmergencyStatus) {
    if (status === "in_progress") return "In Review";
    if (status === "resolved") return "Resolved";
    return "Active";
  }

  function locationText(alert: EmergencyAlert) {
    if (typeof alert.latitude !== "number" || typeof alert.longitude !== "number") {
      return "Location not available";
    }

    return `${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}`;
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
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/support" className="miniButton">Support</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin Safety</p>
            <h1>Emergency <span>Center</span></h1>
            <p className="subtitle">
              Monitor SOS alerts, location, status, and safety response.
            </p>
          </div>

          <div className="heroIcon">🚨</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚨" label="Active" value={String(activeCount)} />
          <Metric icon="👀" label="Review" value={String(inProgressCount)} />
          <Metric icon="✅" label="Resolved" value={String(resolvedCount)} />
          <Metric icon="🔥" label="Critical" value={String(criticalCount)} />
        </section>

        <section className="alertsCard">
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

                  <div className="alertText">
                    <strong>{shortEmail(alert.userEmail)}</strong>
                    <span>{shortDate(alert.createdAt)}</span>
                    <small>{locationText(alert)}</small>
                  </div>

                  <em className={`status ${alert.status || "active"}`}>
                    {statusLabel(alert.status)}
                  </em>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="detailsCard">
          {selected ? (
            <>
              <div className="selectedTop">
                <div>
                  <p className="eyebrow">Selected Alert</p>
                  <h2>{shortEmail(selected.userEmail)}</h2>
                  <p className="email">{shortId(selected.userId)}</p>
                </div>

                <span className={`statusPill ${selected.status || "active"}`}>
                  {statusLabel(selected.status)}
                </span>
              </div>

              <div className="summaryGrid">
                <Info label="Priority" value={(selected.priority || "critical").toUpperCase()} />
                <Info label="Status" value={statusLabel(selected.status)} />
                <Info label="Created" value={shortDate(selected.createdAt)} />
                <Info label="Location" value={locationText(selected)} />
              </div>

              {mapUrl(selected) ? (
                <a href={mapUrl(selected)} target="_blank" rel="noreferrer" className="mapButton">
                  Open Location in Google Maps
                </a>
              ) : (
                <div className="locationMissing">
                  Location was not available for this SOS alert.
                </div>
              )}

              <button
                className="detailsToggle"
                onClick={() => setShowFullDetails((value) => !value)}
              >
                {showFullDetails ? "Hide Details" : "View Full Details"}
              </button>

              {showFullDetails && (
                <div className="fullDetails">
                  <Info label="Alert ID" value={selected.id} />
                  <Info label="User Email" value={selected.userEmail || "Not available"} />
                  <Info label="User ID" value={selected.userId || "Not available"} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                  <Info label="Resolved" value={dateText(selected.resolvedAt)} />
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
                  Review
                </button>

                <button
                  className="activeButton"
                  onClick={() => updateAlertStatus(selected, "active")}
                  disabled={loadingId === selected.id}
                >
                  Active
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
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        html,
        body {
          overflow-x: hidden;
        }

        .page {
          width: 100%;
          max-width: 100vw;
          min-height: 100vh;
          overflow-x: hidden;
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 32%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.1), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 12px;
          padding-bottom: 150px;
          font-family: Arial, sans-serif;
        }

        .container {
          width: 100%;
          max-width: 760px;
          margin: auto;
          overflow-x: hidden;
        }

        .topNav {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .miniButton,
        .filters button,
        .detailsToggle {
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .hero,
        .metric,
        .alertsCard,
        .detailsCard {
          width: 100%;
          max-width: 100%;
          overflow: hidden;
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 16px 44px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 12px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: center;
        }

        .eyebrow {
          margin: 0 0 7px;
          color: #ef4444;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 34px;
          line-height: 0.98;
          margin: 0 0 10px;
        }

        h1 span {
          color: #ef4444;
        }

        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          font-size: 23px;
          line-height: 1.05;
          margin: 0 0 12px;
          overflow-wrap: anywhere;
        }

        .subtitle,
        .email {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.4;
          margin: 0;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .heroIcon {
          width: 50px;
          height: 50px;
          min-width: 50px;
          border-radius: 50%;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 10px 0;
          font-size: 13px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .metric {
          border-radius: 18px;
          padding: 13px;
        }

        .metricIcon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(239,68,68,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          margin-bottom: 8px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .metricValue {
          font-size: 22px;
          font-weight: 900;
        }

        .alertsCard,
        .detailsCard {
          border-radius: 22px;
          padding: 16px;
          margin-bottom: 12px;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 12px;
        }

        .filters .activeFilter {
          background: rgba(239,68,68,0.14);
          border-color: rgba(239,68,68,0.45);
          color: #fca5a5;
        }

        .alertList {
          display: grid;
          gap: 10px;
        }

        .alertRow {
          width: 100%;
          max-width: 100%;
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
          overflow: hidden;
        }

        .activeAlert {
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.1);
        }

        .alertIcon {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(239,68,68,0.13);
          border: 1px solid rgba(239,68,68,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .alertText {
          min-width: 0;
          max-width: 100%;
        }

        .alertRow strong,
        .alertRow span,
        .alertRow small {
          display: block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .alertRow strong {
          font-size: 12px;
        }

        .alertRow span,
        .alertRow small {
          color: #a1a1aa;
          margin-top: 3px;
          font-size: 10px;
        }

        .status {
          grid-column: 2;
          width: fit-content;
          margin-top: 6px;
        }

        .status,
        .statusPill {
          border-radius: 999px;
          padding: 7px 10px;
          font-style: normal;
          font-weight: 900;
          font-size: 10px;
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

        .selectedTop {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .statusPill {
          display: inline-flex;
          flex-shrink: 0;
          margin-top: 4px;
        }

        .summaryGrid,
        .fullDetails {
          display: grid;
          grid-template-columns: 1fr;
          gap: 9px;
          margin-bottom: 12px;
        }

        .infoBox,
        .locationMissing {
          max-width: 100%;
          padding: 11px;
          border-radius: 13px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          overflow: hidden;
        }

        .summaryGrid .infoBox:first-child {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.25);
        }

        .summaryGrid .infoBox:first-child strong {
          color: #ef4444;
          font-size: 20px;
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .infoBox strong,
        .locationMissing {
          display: block;
          font-size: 11px;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .mapButton,
        .detailsToggle {
          display: flex;
          width: 100%;
          justify-content: center;
          align-items: center;
          padding: 13px;
          margin-bottom: 12px;
          border-radius: 999px;
          font-weight: 900;
          text-decoration: none;
          font-size: 12px;
          text-align: center;
        }

        .mapButton {
          background: rgba(59,130,246,0.15);
          border: 1px solid rgba(59,130,246,0.4);
          color: #93c5fd;
        }

        .detailsToggle {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
        }

        .locationMissing {
          color: #a1a1aa;
          margin-bottom: 12px;
        }

        label {
          display: block;
          font-weight: 900;
          font-size: 12px;
          margin-bottom: 7px;
        }

        textarea {
          width: 100%;
          min-height: 86px;
          padding: 13px;
          border-radius: 15px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 13px;
          outline: none;
          resize: vertical;
          margin-bottom: 12px;
          font-family: Arial, sans-serif;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .reviewButton,
        .activeButton,
        .resolveButton {
          width: 100%;
          padding: 12px 8px;
          border-radius: 999px;
          border: none;
          color: white;
          font-size: 11px;
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
          padding: 20px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 18px;
        }

        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        @media (min-width: 900px) {
          .container {
            max-width: 1180px;
          }

          .page {
            padding: 24px;
            padding-bottom: 60px;
          }

          .stats {
            grid-template-columns: repeat(4, 1fr);
          }

          .alertsCard,
          .detailsCard {
            padding: 22px;
          }

          .alertRow {
            grid-template-columns: 44px minmax(0, 1fr) auto;
          }

          .status {
            grid-column: auto;
            margin-top: 0;
          }

          .summaryGrid,
          .fullDetails {
            grid-template-columns: repeat(2, 1fr);
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
