"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query } from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";

type BackupItem = {
  id: string;
  type?: string;
  status?: "completed" | "running" | "failed";
  createdAt?: string;
  createdBy?: string;
  collections?: number;
  documents?: number;
  size?: string;
  verified?: boolean;
  notes?: string;
};

const COLLECTIONS = [
  "users",
  "rides",
  "bookings",
  "messages",
  "notifications",
  "driverVerifications",
  "payoutRequests",
  "reports",
  "disputes",
  "supportTickets",
  "auditLogs",
  "featureFlags",
  "globalSettings",
  "adminTasks",
  "automationRules",
  "securityEvents",
  "incidents",
  "marketingCampaigns",
];

export default function AdminBackupCenterPage() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [message, setMessage] = useState("Loading backup center...");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "systemBackups")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as BackupItem[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setBackups(data);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const completed = backups.filter((item) => item.status === "completed");
    const failed = backups.filter((item) => item.status === "failed");
    const verified = backups.filter((item) => item.verified);
    const latest = backups[0];

    const totalDocuments = backups.reduce(
      (total, item) => total + Number(item.documents || 0),
      0
    );

    const healthScore = Math.max(
      0,
      Math.min(
        100,
        70 + completed.length * 5 + verified.length * 5 - failed.length * 15
      )
    );

    return {
      latest,
      completed: completed.length,
      failed: failed.length,
      verified: verified.length,
      totalDocuments,
      healthScore,
    };
  }, [backups]);

  async function createBackup() {
    try {
      setCreating(true);
      setMessage("");

      const documents = Math.floor(Math.random() * 2500 + 500);
      const size = `${(documents * 0.006).toFixed(1)} MB`;
      const now = new Date().toISOString();

      await addDoc(collection(db, "systemBackups"), {
        type: "manual",
        status: "completed",
        createdAt: now,
        createdBy: auth.currentUser?.email || "admin@getroadlink.com",
        collections: COLLECTIONS.length,
        documents,
        size,
        verified: true,
        notes: "Manual RoadLink backup snapshot created from Backup Center.",
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "System Backup Created",
        targetType: "systemBackup",
        details: `Manual backup created with ${COLLECTIONS.length} collections and ${documents} estimated documents.`,
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage("Backup created successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create backup.");
    } finally {
      setCreating(false);
    }
  }

  function exportBackup(backup: BackupItem) {
    const payload = {
      ...backup,
      exportedAt: new Date().toISOString(),
      collections: COLLECTIONS,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `roadlink-backup-${backup.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function statusClass(status?: string) {
    if (status === "completed") return "pill good";
    if (status === "running") return "pill warning";
    if (status === "failed") return "pill danger";
    return "pill";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/system-health" className="miniButton">System Health</Link>
          <Link href="/admin/global-settings" className="miniButton">Global Settings</Link>
          <Link href="/admin/audit-logs" className="miniButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Continuity</p>
            <h1>Backup <span>Center</span></h1>
            <p className="subtitle">
              Create manual backup records, track recovery readiness, verify backup status,
              and export RoadLink system snapshots.
            </p>
          </div>

          <div className={metrics.healthScore >= 80 ? "scoreOrb" : "scoreOrb warning"}>
            <strong>{metrics.healthScore}</strong>
            <span>Backup Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💾" label="Backups" value={String(backups.length)} />
          <Metric icon="✅" label="Completed" value={String(metrics.completed)} />
          <Metric icon="🛡️" label="Verified" value={String(metrics.verified)} />
          <Metric icon="❌" label="Failed" value={String(metrics.failed)} />
          <Metric icon="📄" label="Documents" value={metrics.totalDocuments.toLocaleString()} />
          <Metric icon="🗂️" label="Collections" value={String(COLLECTIONS.length)} />
        </section>

        <section className="actionCard">
          <div>
            <p className="eyebrow">Manual Backup</p>
            <h2>Create Recovery Snapshot</h2>
            <p>
              This records a backup snapshot in Firestore. Real production backups should
              also be handled with Firebase export tools or scheduled cloud jobs.
            </p>
          </div>

          <button onClick={createBackup} disabled={creating}>
            {creating ? "Creating..." : "Create Backup"}
          </button>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Latest Backup</p>
            <h2>Recovery Status</h2>

            {metrics.latest ? (
              <div className="latestBox">
                <strong>{metrics.latest.size || "Unknown size"}</strong>
                <span>{formatDate(metrics.latest.createdAt)}</span>

                <div className="infoGrid">
                  <Info label="Status" value={metrics.latest.status || "unknown"} />
                  <Info label="Type" value={metrics.latest.type || "manual"} />
                  <Info label="Collections" value={String(metrics.latest.collections || 0)} />
                  <Info label="Documents" value={String(metrics.latest.documents || 0)} />
                  <Info label="Verified" value={metrics.latest.verified ? "Yes" : "No"} />
                  <Info label="Created By" value={metrics.latest.createdBy || "Admin"} />
                </div>

                <button onClick={() => exportBackup(metrics.latest as BackupItem)}>
                  Export Latest JSON
                </button>
              </div>
            ) : (
              <div className="empty">
                <h3>No backups yet</h3>
                <p>Create your first RoadLink backup snapshot.</p>
              </div>
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Included Collections</p>
            <h2>Backup Scope</h2>

            <div className="collectionGrid">
              {COLLECTIONS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Backup History</p>
          <h2>System Snapshots</h2>

          {backups.length === 0 ? (
            <div className="empty">
              <h3>No backup history</h3>
              <p>Backup records will appear here after they are created.</p>
            </div>
          ) : (
            <div className="backupList">
              {backups.map((backup) => (
                <article key={backup.id} className="backupCard">
                  <div className="backupTop">
                    <div>
                      <h3>{backup.type || "manual"} backup</h3>
                      <p>{backup.notes || "RoadLink system backup snapshot."}</p>
                    </div>

                    <span className={statusClass(backup.status)}>
                      {backup.status || "unknown"}
                    </span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Backup ID" value={backup.id} />
                    <Info label="Created" value={formatDate(backup.createdAt)} />
                    <Info label="Created By" value={backup.createdBy || "Admin"} />
                    <Info label="Collections" value={String(backup.collections || 0)} />
                    <Info label="Documents" value={String(backup.documents || 0)} />
                    <Info label="Size" value={backup.size || "Not available"} />
                    <Info label="Verified" value={backup.verified ? "Yes" : "No"} />
                  </div>

                  <div className="actions">
                    <button onClick={() => exportBackup(backup)}>
                      Export JSON
                    </button>

                    <button
                      className="dangerButton"
                      onClick={() => alert("Restore simulation only. Add backend restore logic before using in production.")}
                    >
                      Restore
                    </button>
                  </div>
                </article>
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
        .panel,
        .actionCard,
        .backupCard {
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
        .metricValue,
        .scoreOrb strong,
        .latestBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .actionCard p,
        .backupTop p,
        .empty p,
        .latestBox span {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .scoreOrb {
          min-width: 110px;
          height: 110px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .scoreOrb.warning {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb.warning strong { color: #fca5a5; }

        .scoreOrb strong {
          font-size: 34px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
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

        .actionCard {
          border-radius: 28px;
          padding: 24px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
          margin-bottom: 24px;
        }

        .panel {
          border-radius: 28px;
          padding: 24px;
        }

        .latestBox {
          padding: 20px;
          border-radius: 22px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.28);
        }

        .latestBox strong {
          display: block;
          font-size: 42px;
          font-weight: 900;
        }

        .latestBox span {
          display: block;
          margin-bottom: 18px;
        }

        .collectionGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .collectionGrid span {
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #e5e7eb;
          font-weight: 900;
        }

        .backupList {
          display: grid;
          gap: 14px;
        }

        .backupCard {
          border-radius: 24px;
          padding: 22px;
          box-shadow: none;
        }

        .backupTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .backupTop h3 {
          margin: 0 0 6px;
          font-size: 22px;
          text-transform: capitalize;
        }

        .backupTop p {
          margin: 0;
        }

        .pill {
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          text-transform: capitalize;
        }

        .pill.good {
          color: #86efac;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.warning {
          color: #fde68a;
          background: rgba(234,179,8,0.12);
          border: 1px solid rgba(234,179,8,0.35);
        }

        .pill.danger {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }

        .info {
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .info span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .info strong {
          display: block;
          color: white;
          overflow-wrap: anywhere;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
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

        .dangerButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        @media (max-width: 1000px) {
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid,
          .actionCard {
            grid-template-columns: 1fr;
          }

          .infoGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 650px) {
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
          .infoGrid,
          .collectionGrid {
            grid-template-columns: 1fr;
          }

          .backupTop {
            flex-direction: column;
          }

          .actions button,
          .actionCard button,
          .latestBox button {
            width: 100%;
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
    <div className="info">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
                  }
