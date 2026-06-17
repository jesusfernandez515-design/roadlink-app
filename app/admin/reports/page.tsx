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
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed" | "escalated";
type ReportPriority = "low" | "medium" | "high" | "urgent";

type ReportItem = {
  id: string;
  reporterId?: string;
  reporterEmail?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  rideId?: string;
  bookingId?: string;
  chatId?: string;
  type?: string;
  reason?: string;
  details?: string;
  status?: ReportStatus;
  priority?: ReportPriority;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selected, setSelected] = useState<ReportItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("Loading reports...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "reports")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ReportItem[];

        data.sort((a, b) =>
          String(b.createdAt || b.updatedAt || "").localeCompare(
            String(a.createdAt || a.updatedAt || "")
          )
        );

        setReports(data);

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

  const filteredReports = useMemo(() => {
    const text = search.toLowerCase().trim();

    return reports.filter((report) => {
      const status = report.status || "open";

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      const matchesSearch =
        !text ||
        report.reporterEmail?.toLowerCase().includes(text) ||
        report.targetUserEmail?.toLowerCase().includes(text) ||
        report.reason?.toLowerCase().includes(text) ||
        report.details?.toLowerCase().includes(text) ||
        report.type?.toLowerCase().includes(text) ||
        report.rideId?.toLowerCase().includes(text) ||
        report.bookingId?.toLowerCase().includes(text) ||
        report.chatId?.toLowerCase().includes(text) ||
        report.id.toLowerCase().includes(text);

      return matchesStatus && matchesSearch;
    });
  }, [reports, search, statusFilter]);

  const openCount = reports.filter((item) => !item.status || item.status === "open").length;
  const reviewingCount = reports.filter((item) => item.status === "reviewing").length;
  const resolvedCount = reports.filter((item) => item.status === "resolved").length;
  const escalatedCount = reports.filter((item) => item.status === "escalated").length;
  const urgentCount = reports.filter((item) => item.priority === "urgent").length;

  async function updateReport(report: ReportItem, status: ReportStatus) {
    try {
      setLoadingId(report.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "reports", report.id), {
        status,
        updatedAt: now,
        resolvedAt: status === "resolved" || status === "dismissed" ? now : "",
      });

      await addDoc(collection(db, "auditLogs"), {
        userId: report.targetUserId || report.reporterId || "system",
        userEmail: report.targetUserEmail || report.reporterEmail || "system",
        action: `Report ${status}`,
        targetId: report.id,
        targetType: "report",
        details: report.reason || report.details || "Report status updated",
        severity:
          status === "escalated"
            ? "warning"
            : status === "resolved"
            ? "success"
            : "info",
        createdAt: now,
      });

      if (report.reporterId) {
        await addDoc(collection(db, "notifications"), {
          userId: report.reporterId,
          type: "report",
          title: "Report Update",
          message: `Your report was marked as ${status}.`,
          read: false,
          createdAt: now,
          actionUrl: "/notifications",
        });
      }

      setMessage(`Report marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update report.");
    } finally {
      setLoadingId("");
    }
  }

  async function suspendUser(report: ReportItem) {
    if (!report.targetUserId) {
      setMessage("No target user found for this report.");
      return;
    }

    const confirmSuspend = window.confirm("Suspend this user?");

    if (!confirmSuspend) return;

    try {
      setLoadingId(report.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", report.targetUserId),
        {
          suspended: true,
          updatedAt: now,
        },
        { merge: true }
      );

      await updateDoc(doc(db, "reports", report.id), {
        status: "resolved",
        updatedAt: now,
        resolvedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        userId: report.targetUserId,
        userEmail: report.targetUserEmail || "No email",
        action: "User Suspended From Reports Center",
        targetId: report.targetUserId,
        targetType: "user",
        details: report.reason || report.details || "Suspended after report review",
        severity: "danger",
        createdAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId: report.targetUserId,
        type: "account",
        title: "Account Suspended",
        message: "Your RoadLink account has been suspended after an admin review.",
        read: false,
        createdAt: now,
        actionUrl: "/profile",
      });

      setMessage("User suspended and report resolved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not suspend user.");
    } finally {
      setLoadingId("");
    }
  }

  function statusLabel(status?: ReportStatus) {
    if (status === "reviewing") return "Reviewing";
    if (status === "resolved") return "Resolved";
    if (status === "dismissed") return "Dismissed";
    if (status === "escalated") return "Escalated";
    return "Open";
  }

  function priorityLabel(priority?: ReportPriority) {
    if (priority === "urgent") return "Urgent";
    if (priority === "high") return "High";
    if (priority === "low") return "Low";
    return "Medium";
  }

  function dateText(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function riskScore(report: ReportItem) {
    let score = 20;

    if (report.priority === "urgent") score += 50;
    if (report.priority === "high") score += 35;
    if (report.type === "fraud") score += 25;
    if (report.type === "safety") score += 30;
    if (report.type === "harassment") score += 25;
    if (report.rideId) score += 10;
    if (report.bookingId) score += 10;

    return Math.min(score, 100);
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/driver-risk" className="miniButton">Driver Risk</Link>
          <Link href="/admin/support" className="miniButton">Support</Link>
          <Link href="/admin/operations" className="miniButton">Operations</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Safety</p>
            <h1>Reports <span>Center</span></h1>
            <p className="subtitle">
              Review user reports, investigate safety issues, escalate fraud cases,
              suspend unsafe accounts, and keep RoadLink protected.
            </p>
          </div>

          <div className={urgentCount > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{urgentCount}</strong>
            <span>Urgent</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚨" label="Total Reports" value={String(reports.length)} />
          <Metric icon="📌" label="Open" value={String(openCount)} danger={openCount > 0} />
          <Metric icon="🔎" label="Reviewing" value={String(reviewingCount)} />
          <Metric icon="⚠️" label="Escalated" value={String(escalatedCount)} danger={escalatedCount > 0} />
          <Metric icon="✅" label="Resolved" value={String(resolvedCount)} />
          <Metric icon="🔥" label="Urgent" value={String(urgentCount)} danger={urgentCount > 0} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email, reason, report ID, ride ID, booking ID..."
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </section>

        <section className="adminGrid">
          <div className="reportsCard">
            <p className="eyebrow">Reports</p>
            <h2>Report Queue</h2>

            {filteredReports.length === 0 ? (
              <div className="empty">
                <h3>No reports found</h3>
                <p>User reports will appear here.</p>
              </div>
            ) : (
              <div className="reportList">
                {filteredReports.map((report) => (
                  <button
                    key={report.id}
                    className={selected?.id === report.id ? "reportRow activeReport" : "reportRow"}
                    onClick={() => setSelected(report)}
                  >
                    <div className="reportIcon">🚨</div>

                    <div className="reportInfo">
                      <strong>{report.reason || report.type || "User Report"}</strong>
                      <span>{report.reporterEmail || "Reporter not available"}</span>
                      <small>{report.targetUserEmail || "Target not available"}</small>
                    </div>

                    <em className={`status ${report.status || "open"}`}>
                      {statusLabel(report.status)}
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
                    <p className="eyebrow">Selected Report</p>
                    <h2>{selected.reason || selected.type || "Report Details"}</h2>
                    <p className="email">{selected.reporterEmail || "No reporter email"}</p>
                  </div>

                  <span className={`statusPill ${selected.status || "open"}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className="riskBox">
                  <span>Risk Score</span>
                  <strong>{riskScore(selected)}/100</strong>
                </div>

                <div className="infoGrid">
                  <Info label="Report ID" value={selected.id} />
                  <Info label="Type" value={selected.type || "Not available"} />
                  <Info label="Priority" value={priorityLabel(selected.priority)} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Reporter Email" value={selected.reporterEmail || "Not available"} />
                  <Info label="Target Email" value={selected.targetUserEmail || "Not available"} />
                  <Info label="Ride ID" value={selected.rideId || "Not available"} />
                  <Info label="Booking ID" value={selected.bookingId || "Not available"} />
                  <Info label="Chat ID" value={selected.chatId || "Not available"} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                  <Info label="Resolved" value={dateText(selected.resolvedAt)} />
                </div>

                <div className="detailsBox">
                  <strong>Report Details</strong>
                  <p>{selected.details || "No extra details provided."}</p>
                </div>

                <div className="actionRow">
                  <button
                    className="reviewButton"
                    onClick={() => updateReport(selected, "reviewing")}
                    disabled={loadingId === selected.id}
                  >
                    Reviewing
                  </button>

                  <button
                    className="escalateButton"
                    onClick={() => updateReport(selected, "escalated")}
                    disabled={loadingId === selected.id}
                  >
                    Escalate
                  </button>

                  <button
                    className="resolveButton"
                    onClick={() => updateReport(selected, "resolved")}
                    disabled={loadingId === selected.id}
                  >
                    Resolve
                  </button>

                  <button
                    className="dismissButton"
                    onClick={() => updateReport(selected, "dismissed")}
                    disabled={loadingId === selected.id}
                  >
                    Dismiss
                  </button>

                  <button
                    className="suspendButton"
                    onClick={() => suspendUser(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Suspend User
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a report</h3>
                <p>Choose a report to review details.</p>
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
            radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container { max-width: 1180px; margin: auto; }

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
        .filters,
        .reportsCard,
        .detailsCard {
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

        h1 { font-size: 58px; line-height: 1; margin: 0 0 16px; }
        h1 span, h2, .metricValue, .riskBox strong { color: #22c55e; }
        h2 { font-size: 32px; margin: 0 0 14px; }

        .subtitle,
        .email,
        .empty p,
        .detailsBox p {
          color: #a1a1aa;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .scoreOrb {
          min-width: 92px;
          height: 92px;
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
          font-size: 30px;
          font-weight: 900;
        }

        .warningScore strong { color: #fca5a5; }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .message { color: #22c55e; font-weight: 900; margin: 16px 0; }

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

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
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

        .metricValue { font-size: 24px; font-weight: 900; }

        .filters {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        input,
        select {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        select option { color: black; }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.95fr 1.4fr;
          gap: 24px;
        }

        .reportsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .reportList { display: grid; gap: 12px; }

        .reportRow {
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

        .activeReport {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .reportIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(239,68,68,0.13);
          border: 1px solid rgba(239,68,68,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .reportInfo { min-width: 0; }

        .reportInfo strong,
        .reportInfo span,
        .reportInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .reportInfo span,
        .reportInfo small {
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

        .status.open,
        .statusPill.open {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .status.reviewing,
        .statusPill.reviewing {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .status.escalated,
        .statusPill.escalated {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .status.resolved,
        .statusPill.resolved {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.dismissed,
        .statusPill.dismissed {
          color: #a1a1aa;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .riskBox,
        .detailsBox {
          padding: 22px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 20px;
        }

        .riskBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .riskBox strong {
          font-size: 46px;
          font-weight: 900;
        }

        .detailsBox strong {
          display: block;
          margin-bottom: 8px;
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
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .reviewButton,
        .escalateButton,
        .resolveButton,
        .dismissButton,
        .suspendButton {
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .reviewButton { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
        .escalateButton { background: linear-gradient(135deg, #f97316, #c2410c); }
        .resolveButton { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .dismissButton { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); }
        .suspendButton { background: linear-gradient(135deg, #ef4444, #991b1b); }

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
          .stats { grid-template-columns: repeat(3, 1fr); }
          .adminGrid { grid-template-columns: 1fr; }
          .actionRow { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 720px) {
          .page { padding: 16px; padding-bottom: 140px; }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 { font-size: 44px; }

          .stats,
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .reportRow {
            grid-template-columns: 46px 1fr;
          }

          .reportRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .reportIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  danger,
}: {
  icon: string;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "metric dangerMetric" : "metric"}>
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
