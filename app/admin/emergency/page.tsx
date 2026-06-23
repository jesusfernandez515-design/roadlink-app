"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type EmergencyStatus = "open" | "active" | "reviewing" | "resolved" | "false_alarm";
type EmergencySeverity = "low" | "medium" | "high" | "critical";

type SOSEvent = {
  id: string;
  userId?: string;
  email?: string;
  name?: string;
  phone?: string;
  status?: EmergencyStatus;
  severity?: EmergencySeverity;
  message?: string;
  locationText?: string;
  latitude?: number;
  longitude?: number;
  rideId?: string;
  bookingId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
};

export default function AdminEmergencyCommandPage() {
  const [events, setEvents] = useState<SOSEvent[]>([]);
  const [message, setMessage] = useState("Loading emergency command center...");
  const [processingId, setProcessingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "sosEvents")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as SOSEvent[];

        setEvents(
          data.sort(
            (a, b) =>
              new Date(b.createdAt || "").getTime() -
              new Date(a.createdAt || "").getTime()
          )
        );

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const open = events.filter((item) => !item.status || item.status === "open");
    const active = events.filter((item) => item.status === "active");
    const reviewing = events.filter((item) => item.status === "reviewing");
    const resolved = events.filter((item) => item.status === "resolved");
    const falseAlarms = events.filter((item) => item.status === "false_alarm");

    const critical = events.filter((item) => item.severity === "critical");
    const high = events.filter((item) => item.severity === "high");
    const withGps = events.filter((item) => Number(item.latitude || 0) && Number(item.longitude || 0));

    const activeThreats = events.filter(
      (item) =>
        !item.status ||
        item.status === "open" ||
        item.status === "active" ||
        item.status === "reviewing"
    );

    const emergencyScore = Math.max(
      Math.min(
        100 -
          activeThreats.length * 12 -
          critical.length * 15 -
          high.length * 8 +
          resolved.length * 4 +
          withGps.length * 2,
        100
      ),
      0
    );

    return {
      open,
      active,
      reviewing,
      resolved,
      falseAlarms,
      critical,
      high,
      withGps,
      activeThreats,
      emergencyScore,
    };
  }, [events]);

  async function updateEvent(event: SOSEvent, status: EmergencyStatus, severity?: EmergencySeverity) {
    try {
      setProcessingId(event.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "sosEvents", event.id),
        {
          status,
          severity: severity || event.severity || "medium",
          updatedAt: now,
          ...(status === "resolved" || status === "false_alarm" ? { resolvedAt: now } : {}),
        },
        { merge: true }
      );

      if (event.userId || event.email) {
        await setDoc(
          doc(db, "notifications", `emergency-${event.id}-${Date.now()}`),
          {
            userId: event.userId || "",
            email: event.email || "",
            title:
              status === "resolved"
                ? "SOS resolved"
                : status === "reviewing"
                ? "SOS under review"
                : "SOS updated",
            message:
              status === "resolved"
                ? "Your emergency alert was marked as resolved."
                : status === "reviewing"
                ? "RoadLink support is reviewing your emergency alert."
                : `Your emergency alert status changed to ${status}.`,
            type: "emergency",
            read: false,
            sosId: event.id,
            rideId: event.rideId || "",
            bookingId: event.bookingId || "",
            createdAt: now,
          },
          { merge: true }
        );
      }

      await setDoc(
        doc(db, "auditLogs", `emergency-${event.id}-${Date.now()}`),
        {
          action: "Emergency Event Updated",
          targetId: event.id,
          targetType: "sosEvent",
          details: `${event.email || "User"} SOS changed to ${status}`,
          severity:
            status === "resolved"
              ? "success"
              : severity === "critical" || event.severity === "critical"
              ? "critical"
              : "warning",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Emergency event updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update emergency event.");
    } finally {
      setProcessingId("");
    }
  }

  function mapsUrl(event: SOSEvent) {
    const lat = Number(event.latitude || 0);
    const lng = Number(event.longitude || 0);
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  function hasGps(event: SOSEvent) {
    return Boolean(Number(event.latitude || 0) && Number(event.longitude || 0));
  }

  function statusLabel(status?: EmergencyStatus) {
    if (status === "active") return "Active";
    if (status === "reviewing") return "Reviewing";
    if (status === "resolved") return "Resolved";
    if (status === "false_alarm") return "False Alarm";
    return "Open";
  }

  function severityLabel(severity?: EmergencySeverity) {
    if (severity === "critical") return "Critical";
    if (severity === "high") return "High";
    if (severity === "low") return "Low";
    return "Medium";
  }

  function statusClass(status?: EmergencyStatus, severity?: EmergencySeverity) {
    if (status === "resolved") return "good";
    if (status === "false_alarm") return "neutral";
    if (severity === "critical") return "critical";
    if (severity === "high") return "bad";
    return "pending";
  }

  function formatDate(value?: string) {
    if (!value) return "Not available";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/live-map" className="miniButton">Live Map</Link>
          <Link href="/admin/dispatch" className="miniButton">Dispatch</Link>
          <Link href="/admin/safety" className="miniButton">Safety</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Safety Operations</p>
            <h1>Emergency <span>Command</span></h1>
            <p className="subtitle">
              Monitor SOS alerts, active emergencies, critical incidents, user locations,
              emergency contacts, audit logs and real-time safety response.
            </p>
          </div>

          <div className={metrics.emergencyScore >= 70 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.emergencyScore}</strong>
            <span>Safety Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚨" label="Open SOS" value={String(metrics.open.length)} />
          <Metric icon="🔥" label="Active" value={String(metrics.active.length)} />
          <Metric icon="👀" label="Reviewing" value={String(metrics.reviewing.length)} />
          <Metric icon="✅" label="Resolved" value={String(metrics.resolved.length)} />
          <Metric icon="🧨" label="Critical" value={String(metrics.critical.length)} />
          <Metric icon="⚠️" label="High Severity" value={String(metrics.high.length)} />
          <Metric icon="📍" label="With GPS" value={String(metrics.withGps.length)} />
          <Metric icon="🟢" label="False Alarms" value={String(metrics.falseAlarms.length)} />
        </section>

        <section className="commandGrid">
          <section className="mapPanel">
            <div className="mapHeader">
              <div>
                <p className="eyebrow">Emergency Map Layer</p>
                <h2>SOS GPS View</h2>
              </div>

              <Link href="/admin/live-map" className="openMapButton">Open Live Map</Link>
            </div>

            <div className="fakeMap">
              {metrics.activeThreats.filter(hasGps).length === 0 ? (
                <div className="noPoints">
                  <h3>No active GPS emergency points</h3>
                  <p>SOS alerts with latitude and longitude will appear here.</p>
                </div>
              ) : (
                metrics.activeThreats.filter(hasGps).slice(0, 20).map((event, index) => (
                  <a
                    key={event.id}
                    href={mapsUrl(event)}
                    target="_blank"
                    rel="noreferrer"
                    className={`mapPoint ${statusClass(event.status, event.severity)}`}
                    style={{
                      left: `${12 + ((index * 17) % 76)}%`,
                      top: `${18 + ((index * 23) % 64)}%`,
                    }}
                  >
                    🚨
                  </a>
                ))
              )}
            </div>
          </section>

          <section className="sidePanel">
            <p className="eyebrow">Response Protocol</p>
            <h2>Emergency Actions</h2>

            <div className="protocolList">
              <Protocol title="1. Verify location" text="Open GPS point and confirm user location." />
              <Protocol title="2. Contact user" text="Use phone/email and send RoadLink notification." />
              <Protocol title="3. Notify emergency contact" text="Use saved emergency contact if available." />
              <Protocol title="4. Escalate if critical" text="If danger is immediate, contact local emergency services." />
              <Protocol title="5. Resolve and audit" text="Mark resolved only after incident is handled." />
            </div>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Emergency Timeline</p>
          <h2>SOS Events</h2>

          {events.length === 0 ? (
            <div className="empty">
              <h3>No SOS events yet</h3>
              <p>Emergency alerts will appear here when users trigger SOS.</p>
            </div>
          ) : (
            <div className="eventGrid">
              {events.map((event) => (
                <section key={event.id} className={`eventCard ${statusClass(event.status, event.severity)}`}>
                  <div className="cardTop">
                    <div>
                      <h3>{event.name || event.email || "SOS Event"}</h3>
                      <p>{event.message || "Emergency alert triggered"}</p>
                    </div>

                    <span className={`pill ${statusClass(event.status, event.severity)}`}>
                      {statusLabel(event.status)} • {severityLabel(event.severity)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Email" value={event.email || "Not available"} />
                    <Info label="Phone" value={event.phone || "Not available"} />
                    <Info label="Location" value={event.locationText || "Not available"} />
                    <Info label="Latitude" value={String(event.latitude || "Not set")} />
                    <Info label="Longitude" value={String(event.longitude || "Not set")} />
                    <Info label="Ride ID" value={event.rideId || "Not linked"} />
                    <Info label="Booking ID" value={event.bookingId || "Not linked"} />
                    <Info label="Emergency Contact" value={event.emergencyContactName || "Not set"} />
                    <Info label="Contact Phone" value={event.emergencyContactPhone || "Not set"} />
                    <Info label="Created" value={formatDate(event.createdAt)} />
                    <Info label="Updated" value={formatDate(event.updatedAt)} />
                    <Info label="Resolved" value={formatDate(event.resolvedAt)} />
                  </div>

                  <div className="actions">
                    {hasGps(event) && (
                      <a
                        href={mapsUrl(event)}
                        target="_blank"
                        rel="noreferrer"
                        className="openMapButton"
                      >
                        Open GPS
                      </a>
                    )}

                    <button
                      onClick={() => updateEvent(event, "active", "high")}
                      disabled={processingId === event.id}
                    >
                      Activate
                    </button>

                    <button
                      onClick={() => updateEvent(event, "reviewing", event.severity)}
                      disabled={processingId === event.id}
                    >
                      Review
                    </button>

                    <button
                      className="criticalButton"
                      onClick={() => updateEvent(event, event.status || "active", "critical")}
                      disabled={processingId === event.id}
                    >
                      Critical
                    </button>

                    <button
                      className="goodButton"
                      onClick={() => updateEvent(event, "resolved", event.severity)}
                      disabled={processingId === event.id}
                    >
                      Resolve
                    </button>

                    <button
                      className="neutralButton"
                      onClick={() => updateEvent(event, "false_alarm", "low")}
                      disabled={processingId === event.id}
                    >
                      False Alarm
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.14), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1450px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton,
        .openMapButton {
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
        .card,
        .mapPanel,
        .sidePanel,
        .eventCard {
          background: rgba(8,13,25,0.92);
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
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .empty p,
        .eventCard p,
        .protocolItem p,
        .noPoints p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .scoreOrb {
          min-width: 112px;
          height: 112px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .warningScore {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 32px;
          font-weight: 900;
        }

        .warningScore strong { color: #fca5a5; }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
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
          background: rgba(239,68,68,0.14);
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
          color: #22c55e;
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .commandGrid {
          display: grid;
          grid-template-columns: 1.35fr 0.65fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .mapPanel,
        .sidePanel,
        .card {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .mapHeader {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .fakeMap {
          position: relative;
          height: 460px;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.12);
          background:
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            radial-gradient(circle at 35% 30%, rgba(239,68,68,0.22), transparent 22%),
            radial-gradient(circle at 70% 65%, rgba(34,197,94,0.12), transparent 25%),
            linear-gradient(135deg, #020617, #111827);
          background-size: 44px 44px, 44px 44px, auto, auto, auto;
        }

        .mapPoint {
          position: absolute;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-size: 22px;
          transform: translate(-50%, -50%);
          box-shadow: 0 12px 34px rgba(0,0,0,0.55);
        }

        .mapPoint.pending,
        .mapPoint.bad,
        .mapPoint.critical {
          background: rgba(239,68,68,0.2);
          border: 1px solid rgba(239,68,68,0.55);
        }

        .mapPoint.good {
          background: rgba(34,197,94,0.2);
          border: 1px solid rgba(34,197,94,0.55);
        }

        .noPoints {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
          padding: 24px;
        }

        .noPoints h3 {
          font-size: 28px;
          margin: 0 0 10px;
        }

        .protocolList {
          display: grid;
          gap: 12px;
        }

        .protocolItem {
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .protocolItem h3 {
          margin: 0 0 6px;
          color: #22c55e;
          font-size: 16px;
        }

        .protocolItem p {
          margin: 0;
          font-size: 13px;
        }

        .eventGrid {
          display: grid;
          gap: 16px;
        }

        .eventCard {
          border-radius: 24px;
          padding: 22px;
          box-shadow: none;
        }

        .eventCard.critical,
        .eventCard.bad,
        .eventCard.pending {
          border-color: rgba(239,68,68,0.32);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.1), transparent 40%),
            rgba(8,13,25,0.92);
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .eventCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .eventCard p {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .pill {
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .pill.good {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.neutral {
          color: #d4d4d8;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .pill.pending,
        .pill.bad,
        .pill.critical {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .pill.critical {
          color: #fecaca;
          border-color: rgba(248,113,113,0.7);
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
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
          display: block;
          overflow-wrap: anywhere;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .actions button {
          padding: 12px 16px;
          border-radius: 999px;
          border: none;
          font-weight: 900;
          color: white;
          cursor: pointer;
          background: rgba(59,130,246,0.14);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .actions .criticalButton {
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.55);
          color: #fecaca;
        }

        .actions .goodButton {
          background: rgba(34,197,94,0.14);
          border-color: rgba(34,197,94,0.35);
        }

        .actions .neutralButton {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.14);
        }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 22px;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1180px) {
          .stats,
          .infoGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .commandGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
          .mapHeader,
          .cardTop {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero {
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .infoGrid {
            grid-template-columns: 1fr;
          }

          .fakeMap {
            height: 400px;
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

function Protocol({ title, text }: { title: string; text: string }) {
  return (
    <section className="protocolItem">
      <h3>{title}</h3>
      <p>{text}</p>
    </section>
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
