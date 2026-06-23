"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type AuditSeverity = "info" | "success" | "warning" | "critical" | "error";

type AuditLog = {
  id: string;
  action?: string;
  targetId?: string;
  targetType?: string;
  details?: string;
  severity?: AuditSeverity | string;
  adminEmail?: string;
  userEmail?: string;
  createdAt?: string;
  resolved?: boolean;
};

export default function AdminAuditLogsCenterPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState("Loading audit logs center...");
  const [processingId, setProcessingId] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "auditLogs")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as AuditLog[];

        setLogs(
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
    const info = logs.filter((item) => !item.severity || item.severity === "info");
    const success = logs.filter((item) => item.severity === "success");
    const warning = logs.filter((item) => item.severity === "warning");
    const critical = logs.filter((item) => item.severity === "critical" || item.severity === "error");
    const unresolved = logs.filter((item) => !item.resolved && (item.severity === "critical" || item.severity === "error" || item.severity === "warning"));

    const paymentLogs = logs.filter((item) => item.targetType === "payment" || item.action?.toLowerCase().includes("payment"));
    const safetyLogs = logs.filter((item) =>
      ["sosEvent", "report", "fraudSignal", "driverVerification"].includes(item.targetType || "")
    );
    const dispatchLogs = logs.filter((item) => item.action?.toLowerCase().includes("dispatch") || item.targetType === "ride" || item.targetType === "booking");

    const auditScore = Math.max(
      Math.min(
        100 + success.length - warning.length * 2 - critical.length * 6 - unresolved.length * 5,
        100
      ),
      0
    );

    return {
      info,
      success,
      warning,
      critical,
      unresolved,
      paymentLogs,
      safetyLogs,
      dispatchLogs,
      auditScore,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (filter === "critical") {
      return logs.filter((item) => item.severity === "critical" || item.severity === "error");
    }

    if (filter === "warning") {
      return logs.filter((item) => item.severity === "warning");
    }

    if (filter === "success") {
      return logs.filter((item) => item.severity === "success");
    }

    if (filter === "payments") {
      return logs.filter((item) => item.targetType === "payment" || item.action?.toLowerCase().includes("payment"));
    }

    if (filter === "safety") {
      return logs.filter((item) =>
        ["sosEvent", "report", "fraudSignal", "driverVerification"].includes(item.targetType || "")
      );
    }

    if (filter === "dispatch") {
      return logs.filter((item) => item.action?.toLowerCase().includes("dispatch") || item.targetType === "ride" || item.targetType === "booking");
    }

    return logs;
  }, [logs, filter]);

  async function markResolved(log: AuditLog) {
    try {
      setProcessingId(log.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "auditLogs", log.id),
        {
          resolved: true,
          resolvedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      setMessage("Audit log marked as resolved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update audit log.");
    } finally {
      setProcessingId("");
    }
  }

  async function escalateLog(log: AuditLog) {
    try {
      setProcessingId(log.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "auditLogs", log.id),
        {
          severity: "critical",
          resolved: false,
          escalatedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "notifications", `audit-escalation-${log.id}-${Date.now()}`),
        {
          title: "Critical audit log escalated",
          message: `${log.action || "Audit event"} was escalated to critical.`,
          type: "audit",
          read: false,
          targetId: log.targetId || "",
          targetType: log.targetType || "auditLog",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Audit log escalated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not escalate audit log.");
    } finally {
      setProcessingId("");
    }
  }

  function severityLabel(severity?: string) {
    if (severity === "success") return "Success";
    if (severity === "warning") return "Warning";
    if (severity === "critical") return "Critical";
    if (severity === "error") return "Error";
    return "Info";
  }

  function severityClass(severity?: string, resolved?: boolean) {
    if (resolved) return "resolved";
    if (severity === "success") return "good";
    if (severity === "warning") return "warning";
    if (severity === "critical" || severity === "error") return "critical";
    return "info";
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
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/safety" className="miniButton">Safety</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/payments" className="miniButton">Payments</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Governance</p>
            <h1>Audit Logs <span>Center</span></h1>
            <p className="subtitle">
              Monitor every critical action across payments, dispatch, reports, safety, fraud,
              users, verification, Stripe, wallet and admin operations.
            </p>
          </div>

          <div className={metrics.auditScore >= 70 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.auditScore}</strong>
            <span>Audit Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📚" label="Total Logs" value={String(logs.length)} />
          <Metric icon="✅" label="Success" value={String(metrics.success.length)} />
          <Metric icon="ℹ️" label="Info" value={String(metrics.info.length)} />
          <Metric icon="⚠️" label="Warnings" value={String(metrics.warning.length)} />
          <Metric icon="🚨" label="Critical" value={String(metrics.critical.length)} />
          <Metric icon="🔥" label="Unresolved" value={String(metrics.unresolved.length)} />
          <Metric icon="💳" label="Payment Logs" value={String(metrics.paymentLogs.length)} />
          <Metric icon="🛡️" label="Safety Logs" value={String(metrics.safetyLogs.length)} />
        </section>

        <section className="panel">
          <div className="panelTop">
            <div>
              <p className="eyebrow">Audit Filters</p>
              <h2>Control Timeline</h2>
            </div>

            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All Logs</option>
              <option value="critical">Critical</option>
              <option value="warning">Warnings</option>
              <option value="success">Success</option>
              <option value="payments">Payments</option>
              <option value="safety">Safety</option>
              <option value="dispatch">Dispatch</option>
            </select>
          </div>

          <div className="quickGrid">
            <Quick label="Payments" value={metrics.paymentLogs.length} />
            <Quick label="Safety" value={metrics.safetyLogs.length} />
            <Quick label="Dispatch" value={metrics.dispatchLogs.length} />
            <Quick label="Unresolved" value={metrics.unresolved.length} />
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">System Timeline</p>
          <h2>Audit Events</h2>

          {filteredLogs.length === 0 ? (
            <div className="empty">
              <h3>No audit logs found</h3>
              <p>Admin, payment, safety, fraud and dispatch actions will appear here.</p>
            </div>
          ) : (
            <div className="logGrid">
              {filteredLogs.map((log) => (
                <section key={log.id} className={`logCard ${severityClass(log.severity, log.resolved)}`}>
                  <div className="cardTop">
                    <div>
                      <h3>{log.action || "Audit Event"}</h3>
                      <p>{log.details || "No details available"}</p>
                    </div>

                    <span className={`pill ${severityClass(log.severity, log.resolved)}`}>
                      {log.resolved ? "Resolved" : severityLabel(log.severity)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Target Type" value={log.targetType || "Not available"} />
                    <Info label="Target ID" value={log.targetId || "Not linked"} />
                    <Info label="Admin" value={log.adminEmail || "Not available"} />
                    <Info label="User" value={log.userEmail || "Not available"} />
                    <Info label="Severity" value={severityLabel(log.severity)} />
                    <Info label="Created" value={formatDate(log.createdAt)} />
                    <Info label="Resolved" value={log.resolved ? "Yes" : "No"} />
                    <Info label="Log ID" value={log.id} />
                  </div>

                  <div className="actions">
                    {!log.resolved && (
                      <button
                        className="goodButton"
                        onClick={() => markResolved(log)}
                        disabled={processingId === log.id}
                      >
                        Resolve
                      </button>
                    )}

                    <button
                      className="dangerButton"
                      onClick={() => escalateLog(log)}
                      disabled={processingId === log.id}
                    >
                      Escalate
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
            radial-gradient(circle at top right, rgba(59,130,246,0.20), transparent 34%),
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
        .panel,
        .logCard,
        .quickBox {
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
        .logCard p {
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
          background: rgba(59,130,246,0.14);
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

        .panel {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .panelTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        select {
          min-width: 220px;
          padding: 14px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-weight: 900;
          outline: none;
        }

        select option {
          color: black;
        }

        .quickGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .quickBox {
          border-radius: 18px;
          padding: 16px;
          box-shadow: none;
        }

        .quickBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .quickBox strong {
          display: block;
          color: #22c55e;
          font-size: 26px;
          font-weight: 900;
        }

        .logGrid {
          display: grid;
          gap: 16px;
        }

        .logCard {
          border-radius: 24px;
          padding: 22px;
          box-shadow: none;
        }

        .logCard.critical {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 42%),
            rgba(8,13,25,0.92);
        }

        .logCard.warning {
          border-color: rgba(250,204,21,0.35);
        }

        .logCard.good,
        .logCard.resolved {
          border-color: rgba(34,197,94,0.35);
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .logCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .logCard p {
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

        .pill.good,
        .pill.resolved {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.info {
          color: #60a5fa;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .pill.warning {
          color: #facc15;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .pill.critical {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
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

        .actions .goodButton {
          background: rgba(34,197,94,0.14);
          border-color: rgba(34,197,94,0.35);
        }

        .actions .dangerButton {
          background: rgba(239,68,68,0.14);
          border-color: rgba(239,68,68,0.35);
          color: #fca5a5;
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
          .infoGrid,
          .quickGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 780px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
          .cardTop,
          .panelTop {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero {
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          select {
            width: 100%;
          }

          .stats,
          .infoGrid,
          .quickGrid {
            grid-template-columns: 1fr;
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

function Quick({ label, value }: { label: string; value: number }) {
  return (
    <section className="quickBox">
      <span>{label}</span>
      <strong>{value}</strong>
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
