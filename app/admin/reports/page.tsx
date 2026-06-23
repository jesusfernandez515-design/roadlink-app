"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ReportStatus = "open" | "reviewing" | "resolved" | "closed";
type ReportSeverity = "low" | "medium" | "high" | "critical";

type ReportItem = {
  id: string;
  reporterId?: string;
  reporterEmail?: string;
  targetUserId?: string;
  reportedEmail?: string;
  rideId?: string;
  bookingId?: string;
  type?: string;
  category?: string;
  status?: ReportStatus;
  severity?: ReportSeverity;
  message?: string;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
};

export default function AdminReportsCenterPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [message, setMessage] = useState("Loading reports center...");
  const [processingId, setProcessingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "reports")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ReportItem[];

        setReports(
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
    const open = reports.filter((item) => !item.status || item.status === "open");
    const reviewing = reports.filter((item) => item.status === "reviewing");
    const resolved = reports.filter((item) => item.status === "resolved");
    const closed = reports.filter((item) => item.status === "closed");
    const high = reports.filter((item) => item.severity === "high");
    const critical = reports.filter((item) => item.severity === "critical");

    const activeRisk = open.length + reviewing.length + high.length + critical.length * 2;

    const reportHealthScore = Math.max(
      Math.min(
        100 - activeRisk * 7 + resolved.length * 3 + closed.length,
        100
      ),
      0
    );

    return {
      open,
      reviewing,
      resolved,
      closed,
      high,
      critical,
      activeRisk,
      reportHealthScore,
    };
  }, [reports]);

  async function updateReport(report: ReportItem, status: ReportStatus, severity?: ReportSeverity) {
    try {
      setProcessingId(report.id);
      const now = new Date().toISOString();

      await setDoc(
        doc(db, "reports", report.id),
        {
          status,
          severity: severity || report.severity || "medium",
          updatedAt: now,
          ...(status === "resolved" || status === "closed" ? { resolvedAt: now } : {}),
        },
        { merge: true }
      );

      if (report.reporterId || report.reporterEmail) {
        await setDoc(
          doc(db, "notifications", `report-${report.id}-${Date.now()}`),
          {
            userId: report.reporterId || "",
            email: report.reporterEmail || "",
            title:
              status === "resolved"
                ? "Report resolved"
                : status === "reviewing"
                ? "Report under review"
                : "Report updated",
            message:
              status === "resolved"
                ? "Your report was reviewed and marked as resolved."
                : status === "reviewing"
                ? "RoadLink Trust & Safety is reviewing your report."
                : `Your report status changed to ${status}.`,
            type: "report",
            read: false,
            reportId: report.id,
            rideId: report.rideId || "",
            bookingId: report.bookingId || "",
            createdAt: now,
          },
          { merge: true }
        );
      }

      await setDoc(
        doc(db, "auditLogs", `report-${report.id}-${Date.now()}`),
        {
          action: "Report Updated",
          targetId: report.id,
          targetType: "report",
          details: `${report.type || report.category || "Report"} changed to ${status}`,
          severity: status === "resolved" ? "success" : severity === "critical" ? "critical" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      if (severity === "critical" && report.targetUserId) {
        await setDoc(
          doc(db, "fraudSignals", `report-risk-${report.id}-${Date.now()}`),
          {
            userId: report.targetUserId,
            email: report.reportedEmail || "",
            status: "open",
            riskLevel: "critical",
            fraudScore: 90,
            reason: `Critical report: ${report.message || report.type || "User report"}`,
            source: "reports_center",
            reportId: report.id,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      setMessage("Report updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update report.");
    } finally {
      setProcessingId("");
    }
  }

  function statusClass(status?: ReportStatus, severity?: ReportSeverity) {
    if (status === "resolved" || status === "closed") return "good";
    if (severity === "critical" || severity === "high") return "bad";
    if (status === "reviewing") return "active";
    return "pending";
  }

  function statusLabel(status?: ReportStatus) {
    if (status === "reviewing") return "Reviewing";
    if (status === "resolved") return "Resolved";
    if (status === "closed") return "Closed";
    return "Open";
  }

  function severityLabel(severity?: ReportSeverity) {
    if (severity === "critical") return "Critical";
    if (severity === "high") return "High";
    if (severity === "low") return "Low";
    return "Medium";
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
          <Link href="/admin/safety" className="miniButton">Trust & Safety</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/emergency" className="miniButton">Emergency</Link>
          <Link href="/admin/audit-logs" className="miniButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Trust Operations</p>
            <h1>Reports <span>Center</span></h1>
            <p className="subtitle">
              Review user reports, safety complaints, ride incidents, fraud reports,
              severity levels, notifications and audit history.
            </p>
          </div>

          <div className={metrics.reportHealthScore >= 70 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.reportHealthScore}</strong>
            <span>Report Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📋" label="Total Reports" value={String(reports.length)} />
          <Metric icon="🟡" label="Open" value={String(metrics.open.length)} />
          <Metric icon="👀" label="Reviewing" value={String(metrics.reviewing.length)} />
          <Metric icon="✅" label="Resolved" value={String(metrics.resolved.length)} />
          <Metric icon="📦" label="Closed" value={String(metrics.closed.length)} />
          <Metric icon="⚠️" label="High" value={String(metrics.high.length)} />
          <Metric icon="🚨" label="Critical" value={String(metrics.critical.length)} />
          <Metric icon="🔥" label="Active Risk" value={String(metrics.activeRisk)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Report Risk</p>
            <h2>Priority Queue</h2>

            <div className="riskList">
              <Risk label="Open Reports" value={metrics.open.length} />
              <Risk label="Under Review" value={metrics.reviewing.length} />
              <Risk label="High Severity" value={metrics.high.length} />
              <Risk label="Critical Severity" value={metrics.critical.length} />
              <Risk label="Resolved Reports" value={metrics.resolved.length} />
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Connected Centers</p>
            <h2>Safety Workflow</h2>

            <div className="linkGrid">
              <Link href="/admin/safety" className="actionLink">Trust & Safety</Link>
              <Link href="/admin/fraud" className="actionLink">Fraud Detection</Link>
              <Link href="/admin/emergency" className="actionLink">Emergency Command</Link>
              <Link href="/admin/users" className="actionLink">Users</Link>
              <Link href="/admin/dispatch" className="actionLink">Dispatch</Link>
              <Link href="/admin/audit-logs" className="actionLink">Audit Logs</Link>
            </div>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Incident Review</p>
          <h2>Reports Timeline</h2>

          {reports.length === 0 ? (
            <div className="empty">
              <h3>No reports yet</h3>
              <p>User reports, ride complaints, safety issues and fraud complaints will appear here.</p>
            </div>
          ) : (
            <div className="cardGrid">
              {reports.map((report) => (
                <section key={report.id} className={`itemCard ${statusClass(report.status, report.severity)}`}>
                  <div className="cardTop">
                    <div>
                      <h3>{report.type || report.category || "User Report"}</h3>
                      <p>{report.message || "No message provided"}</p>
                    </div>

                    <span className={`pill ${statusClass(report.status, report.severity)}`}>
                      {statusLabel(report.status)} • {severityLabel(report.severity)}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Reporter" value={report.reporterEmail || "Not available"} />
                    <Info label="Reported" value={report.reportedEmail || "Not available"} />
                    <Info label="Target User ID" value={report.targetUserId || "Not linked"} />
                    <Info label="Ride ID" value={report.rideId || "Not linked"} />
                    <Info label="Booking ID" value={report.bookingId || "Not linked"} />
                    <Info label="Status" value={statusLabel(report.status)} />
                    <Info label="Severity" value={severityLabel(report.severity)} />
                    <Info label="Created" value={formatDate(report.createdAt)} />
                    <Info label="Updated" value={formatDate(report.updatedAt)} />
                    <Info label="Resolved" value={formatDate(report.resolvedAt)} />
                    <Info label="Admin Notes" value={report.adminNotes || "No notes"} />
                    <Info label="Report ID" value={report.id} />
                  </div>

                  <div className="actions">
                    <button
                      onClick={() => updateReport(report, "reviewing", report.severity)}
                      disabled={processingId === report.id}
                    >
                      Review
                    </button>

                    <button
                      onClick={() => updateReport(report, report.status || "open", "high")}
                      disabled={processingId === report.id}
                    >
                      High
                    </button>

                    <button
                      className="dangerButton"
                      onClick={() => updateReport(report, report.status || "open", "critical")}
                      disabled={processingId === report.id}
                    >
                      Critical
                    </button>

                    <button
                      className="goodButton"
                      onClick={() => updateReport(report, "resolved", report.severity)}
                      disabled={processingId === report.id}
                    >
                      Resolve
                    </button>

                    <button
                      className="neutralButton"
                      onClick={() => updateReport(report, "closed", report.severity)}
                      disabled={processingId === report.id}
                    >
                      Close
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
            radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 34%),
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
        .actionLink {
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
        .itemCard {
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
        .itemCard p {
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

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 24px;
        }

        .panel {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .riskList,
        .linkGrid {
          display: grid;
          gap: 12px;
        }

        .riskBox {
          padding: 14px;
          border-radius: 18px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .riskBox span {
          color: #a1a1aa;
          font-weight: 900;
        }

        .riskBox strong {
          color: #22c55e;
          font-size: 22px;
        }

        .actionLink {
          display: block;
          text-align: center;
        }

        .cardGrid {
          display: grid;
          gap: 16px;
        }

        .itemCard {
          border-radius: 24px;
          padding: 22px;
          box-shadow: none;
        }

        .itemCard.bad {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 42%),
            rgba(8,13,25,0.92);
        }

        .itemCard.active {
          border-color: rgba(59,130,246,0.35);
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .itemCard h3 {
          margin: 0 0 6px;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .itemCard p {
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

        .pill.active {
          color: #60a5fa;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .pill.pending {
          color: #facc15;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .pill.bad {
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
          .infoGrid,
          .grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 780px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
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
          .infoGrid,
          .grid {
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

function Risk({ label, value }: { label: string; value: number }) {
  return (
    <section className="riskBox">
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
