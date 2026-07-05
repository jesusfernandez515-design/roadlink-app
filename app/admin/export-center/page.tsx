"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type ExportItem = {
  key: string;
  name: string;
  icon: string;
  description: string;
  collectionName: string;
  category: string;
};

const EXPORTS: ExportItem[] = [
  { key: "users", name: "Users", icon: "👥", description: "Export user accounts and profiles.", collectionName: "users", category: "People" },
  { key: "rides", name: "Rides", icon: "🚘", description: "Export published rides and trip data.", collectionName: "rides", category: "Trips" },
  { key: "bookings", name: "Bookings", icon: "🎟️", description: "Export reservations and booking history.", collectionName: "bookings", category: "Trips" },
  { key: "reports", name: "Reports", icon: "⚠️", description: "Export user reports and safety cases.", collectionName: "reports", category: "Safety" },
  { key: "payouts", name: "Payouts", icon: "🏦", description: "Export payout requests.", collectionName: "payoutRequests", category: "Finance" },
  { key: "tasks", name: "Admin Tasks", icon: "📋", description: "Export internal admin tasks.", collectionName: "adminTasks", category: "Operations" },
  { key: "auditLogs", name: "Audit Logs", icon: "📚", description: "Export system audit timeline.", collectionName: "auditLogs", category: "Security" },
  { key: "settings", name: "Global Settings", icon: "⚙️", description: "Export global configuration.", collectionName: "globalSettings", category: "Config" },
];

export default function AdminExportCenterPage() {
  const [message, setMessage] = useState("Export center ready.");
  const [loadingKey, setLoadingKey] = useState("");

  const metrics = useMemo(() => {
    return {
      total: EXPORTS.length,
      categories: Array.from(new Set(EXPORTS.map((item) => item.category))).length,
    };
  }, []);

  function downloadFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  function toCsv(rows: Record<string, unknown>[]) {
    if (rows.length === 0) return "";

    const headers = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row)))
    );

    const escape = (value: unknown) => {
      const text = String(value ?? "").replaceAll('"', '""');
      return `"${text}"`;
    };

    return [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
    ].join("\n");
  }

  async function exportCollection(item: ExportItem, format: "json" | "csv") {
    try {
      setLoadingKey(`${item.key}-${format}`);
      setMessage("");

      const snapshot = await getDocs(collection(db, item.collectionName));

      const rows = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Record<string, unknown>[];

      const timestamp = new Date().toISOString().replaceAll(":", "-");
      const filename = `roadlink-${item.key}-${timestamp}.${format}`;

      if (format === "json") {
        downloadFile(
          filename,
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              exportedBy: auth.currentUser?.email || "admin",
              collection: item.collectionName,
              count: rows.length,
              data: rows,
            },
            null,
            2
          ),
          "application/json"
        );
      } else {
        downloadFile(filename, toCsv(rows), "text/csv");
      }

      setMessage(`${item.name} exported successfully.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not export data.");
    } finally {
      setLoadingKey("");
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/backup-center" className="miniButton">Backups</Link>
          <Link href="/admin/audit-logs" className="miniButton">Audit Logs</Link>
          <Link href="/admin/global-settings" className="miniButton">Settings</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Data Tools</p>
            <h1>Export <span>Center</span></h1>
            <p className="subtitle">
              Export RoadLink users, rides, bookings, reports, payouts, tasks,
              audit logs and settings as JSON or CSV.
            </p>
          </div>

          <div className="heroIcon">⬇️</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📦" label="Export Types" value={String(metrics.total)} />
          <Metric icon="🗂️" label="Categories" value={String(metrics.categories)} />
          <Metric icon="📄" label="Formats" value="JSON / CSV" />
          <Metric icon="🔐" label="Access" value="Admin" />
        </section>

        <section className="grid">
          {EXPORTS.map((item) => (
            <article key={item.key} className="card">
              <div className="cardTop">
                <div className="cardIcon">{item.icon}</div>
                <span>{item.category}</span>
              </div>

              <h2>{item.name}</h2>
              <p>{item.description}</p>

              <div className="collectionName">
                Firestore: <strong>{item.collectionName}</strong>
              </div>

              <div className="actions">
                <button
                  onClick={() => exportCollection(item, "json")}
                  disabled={loadingKey === `${item.key}-json`}
                >
                  JSON
                </button>

                <button
                  className="secondaryButton"
                  onClick={() => exportCollection(item, "csv")}
                  disabled={loadingKey === `${item.key}-csv`}
                >
                  CSV
                </button>
              </div>
            </article>
          ))}
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
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
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
        .card {
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
          font-size: 28px;
          margin: 0 0 10px;
        }

        .subtitle,
        .card p,
        .collectionName {
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
          overflow-wrap: anywhere;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }

        .card {
          border-radius: 28px;
          padding: 24px;
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .cardTop span {
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .cardIcon {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
        }

        .collectionName {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin: 18px 0;
        }

        .collectionName strong {
          color: white;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        button {
          padding: 14px 18px;
          border-radius: 999px;
          border: none;
          color: white;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          font-weight: 900;
          cursor: pointer;
        }

        .secondaryButton {
          background: rgba(59,130,246,0.18);
          border: 1px solid rgba(59,130,246,0.35);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .grid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 44px;
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
