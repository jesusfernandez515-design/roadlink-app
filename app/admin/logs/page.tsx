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

type AuditLog = {
  id: string;
  userId?: string;
  userEmail?: string;
  action?: string;
  targetId?: string;
  targetType?: string;
  details?: string;
  severity?: "info" | "warning" | "danger" | "success";
  createdAt?: string;
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [message, setMessage] = useState("Loading audit logs...");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "auditLogs")),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as AuditLog[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setLogs(data);
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

  const filteredLogs = useMemo(() => {
    const value = search.toLowerCase().trim();

    return logs.filter((log) => {
      const matchesSearch =
        !value ||
        String(log.userEmail || "").toLowerCase().includes(value) ||
        String(log.userId || "").toLowerCase().includes(value) ||
        String(log.action || "").toLowerCase().includes(value) ||
        String(log.targetId || "").toLowerCase().includes(value) ||
        String(log.targetType || "").toLowerCase().includes(value) ||
        String(log.details || "").toLowerCase().includes(value) ||
        String(log.id || "").toLowerCase().includes(value);

      const matchesSeverity =
        severityFilter === "all" ||
        String(log.severity || "info") === severityFilter;

      return matchesSearch && matchesSeverity;
    });
  }, [logs, search, severityFilter]);

  const infoCount = logs.filter((item) => !item.severity || item.severity === "info").length;
  const successCount = logs.filter((item) => item.severity === "success").length;
  const warningCount = logs.filter((item) => item.severity === "warning").length;
  const dangerCount = logs.filter((item) => item.severity === "danger").length;

  async function createTestLog() {
    try {
      setCreating(true);
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "auditLogs"), {
        userId: "system",
        userEmail: "system@getroadlink.com",
        action: "Audit Log Test",
        targetId: "admin-logs",
        targetType: "system",
        details: "Manual test audit log created from Admin Logs dashboard.",
        severity: "info",
        createdAt: now,
      });

      setMessage("Test audit log created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create log.");
    } finally {
      setCreating(false);
    }
  }

  async function duplicateLogAsResolved(log: AuditLog) {
    try {
      setCreating(true);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(doc(db, "auditLogs", `resolved-${log.id}-${Date.now()}`), {
        userId: log.userId || "admin",
        userEmail: log.userEmail || "admin@getroadlink.com",
        action: "Log Reviewed",
        targetId: log.id,
        targetType: "auditLog",
        details: `Audit log reviewed: ${log.action || "Unknown action"}`,
        severity: "success",
        createdAt: now,
      });

      setMessage("Review log created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create review log.");
    } finally {
      setCreating(false);
    }
  }

  function dateText(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function severityLabel(value?: string) {
    if (value === "success") return "Success";
    if (value === "warning") return "Warning";
    if (value === "danger") return "Danger";
    return "Info";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/settings" className="miniButton">Settings</Link>
          <Link href="/admin/support" className="miniButton">Support</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Audit <span>Logs</span></h1>
            <p className="subtitle">
              Track important system actions, admin decisions, account events,
              payout updates, verification changes, and security activity.
            </p>
          </div>

          <div className="heroIcon">🧾</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🧾" label="Total Logs" value={String(logs.length)} />
          <Metric icon="ℹ️" label="Info" value={String(infoCount)} />
          <Metric icon="✅" label="Success" value={String(successCount)} />
          <Metric icon="⚠️" label="Warning" value={String(warningCount)} />
          <Metric icon="🚨" label="Danger" value={String(dangerCount)} />
          <Metric icon="📋" label="Filtered" value={String(filteredLogs.length)} />
        </section>

        <section className="toolsCard">
          <div>
            <p className="eyebrow">Developer Tool</p>
            <h2>Create Test Log</h2>
            <p>
              Use this to confirm the audit log system is working before connecting
              logs to every admin action.
            </p>
          </div>

          <button onClick={createTestLog} disabled={creating}>
            {creating ? "Creating..." : "Create Test Log"}
          </button>
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by user, action, target, details, or log ID..."
          />

          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
          >
            <option value="all">All severity</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="danger">Danger</option>
          </select>
        </section>

        <section className="adminGrid">
          <div className="logsCard">
            <p className="eyebrow">Timeline</p>
            <h2>System Activity</h2>

            {filteredLogs.length === 0 ? (
              <div className="empty">
                <h3>No audit logs found</h3>
                <p>Create a test log or connect audit logging to admin actions.</p>
              </div>
            ) : (
              <div className="logList">
                {filteredLogs.map((log) => (
                  <button
                    key={log.id}
                    className={selected?.id === log.id ? "logRow activeLog" : "logRow"}
                    onClick={() => setSelected(log)}
                  >
                    <div className={`logIcon ${log.severity || "info"}`}>
                      {log.severity === "danger"
                        ? "🚨"
                        : log.severity === "warning"
                        ? "⚠️"
                        : log.severity === "success"
                        ? "✅"
                        : "ℹ️"}
                    </div>

                    <div className="logInfo">
                      <strong>{log.action || "System Action"}</strong>
                      <span>{log.userEmail || log.userId || "System"}</span>
                      <small>{dateText(log.createdAt)}</small>
                    </div>

                    <em className={`severity ${log.severity || "info"}`}>
                      {severityLabel(log.severity)}
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
                    <p className="eyebrow">Selected Log</p>
                    <h2>{selected.action || "System Action"}</h2>
                    <p className="email">{selected.userEmail || "No user email"}</p>
                  </div>

                  <span className={`severityPill ${selected.severity || "info"}`}>
                    {severityLabel(selected.severity)}
                  </span>
                </div>

                <div className="detailsBox">
                  <strong>Details</strong>
                  <p>{selected.details || "No details provided."}</p>
                </div>

                <div className="infoGrid">
                  <Info label="Log ID" value={selected.id} />
                  <Info label="User ID" value={selected.userId || "Not available"} />
                  <Info label="User Email" value={selected.userEmail || "Not available"} />
                  <Info label="Action" value={selected.action || "Not available"} />
                  <Info label="Target Type" value={selected.targetType || "Not available"} />
                  <Info label="Target ID" value={selected.targetId || "Not available"} />
                  <Info label="Severity" value={severityLabel(selected.severity)} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                </div>

                <div className="actionRow">
                  <button
                    className="approveButton"
                    onClick={() => duplicateLogAsResolved(selected)}
                    disabled={creating}
                  >
                    {creating ? "Working..." : "Mark Reviewed"}
                  </button>

                  <Link href="/admin/support" className="linkButton">
                    Open Support
                  </Link>

                  <Link href="/admin/reports" className="linkButton">
                    Open Reports
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a log</h3>
                <p>Choose an audit log to view full details.</p>
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
        .toolsCard,
        .filters,
        .logsCard,
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
          margin: 0 0 8px;
        }

        .subtitle,
        .email,
        .empty p,
        .toolsCard p {
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
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
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

        .toolsCard {
          border-radius: 28px;
          padding: 24px;
          margin-bottom: 18px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .toolsCard button {
          padding: 16px 22px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        .filters input,
        .filters select {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        .filters option {
          color: black;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .logsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .logList {
          display: grid;
          gap: 12px;
        }

        .logRow {
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

        .activeLog {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .logIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          border: 1px solid rgba(255,255,255,0.12);
        }

        .logIcon.info {
          background: rgba(59,130,246,0.12);
          border-color: rgba(59,130,246,0.35);
        }

        .logIcon.success {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
        }

        .logIcon.warning {
          background: rgba(250,204,21,0.12);
          border-color: rgba(250,204,21,0.35);
        }

        .logIcon.danger {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .logInfo {
          min-width: 0;
        }

        .logInfo strong,
        .logInfo span,
        .logInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .logInfo span,
        .logInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .severity,
        .severityPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .severity.info,
        .severityPill.info {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .severity.success,
        .severityPill.success {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .severity.warning,
        .severityPill.warning {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .severity.danger,
        .severityPill.danger {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .detailsBox {
          padding: 22px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 20px;
        }

        .detailsBox p {
          color: #e5e7eb;
          line-height: 1.5;
          margin-bottom: 0;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
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
          overflow-wrap: anywhere;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .approveButton,
        .linkButton {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
        }

        .approveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .linkButton {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
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

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
          .toolsCard {
            grid-template-columns: 1fr;
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
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .logsCard,
          .detailsCard {
            padding: 24px;
          }

          .logRow {
            grid-template-columns: 46px 1fr;
          }

          .logRow .severity {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .logIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
            flex-direction: column;
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
      <strong>{value}</strong>
    </div>
  );
}
