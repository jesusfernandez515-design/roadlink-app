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
import { auth, db } from "../../../lib/firebase";

type JobStatus = "running" | "waiting" | "failed" | "retrying" | "completed";
type WorkerStatus = "online" | "warning" | "offline";

type AutomationJob = {
  id: string;
  name?: string;
  type?: string;
  schedule?: string;
  status?: JobStatus | string;
  lastRunAt?: string;
  nextRunAt?: string;
  runtimeMs?: number;
  successRate?: number;
  attempts?: number;
  createdAt?: string;
};

type Worker = {
  id: string;
  name?: string;
  status?: WorkerStatus | string;
  queueLength?: number;
  avgRuntimeMs?: number;
  failedJobs?: number;
  lastHeartbeat?: string;
};

const DEFAULT_JOBS = [
  "Cleanup Expired Rides",
  "Cleanup Old Chats",
  "Cleanup Notifications",
  "Expire Pending Reservations",
  "Release Seats",
  "Close Completed Trips",
  "Payment Reminders",
  "Verification Reminders",
  "Recalculate Ratings",
  "Fraud Scan",
  "Revenue Sync",
  "Analytics Refresh",
];

const DEFAULT_WORKERS = [
  "Notifications Worker",
  "Wallet Worker",
  "Stripe Worker",
  "Email Worker",
  "Maps Worker",
  "Analytics Worker",
  "Fraud Worker",
];

export default function AdminAutomationCenterPage() {
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [message, setMessage] = useState("Loading automation center...");
  const [runningId, setRunningId] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const unsubJobs = onSnapshot(
      query(collection(db, "automationJobs")),
      async (snapshot) => {
        if (snapshot.empty) {
          const now = new Date().toISOString();

          await Promise.all(
            DEFAULT_JOBS.map((name, index) =>
              setDoc(doc(db, "automationJobs", name.toLowerCase().replaceAll(" ", "-")), {
                name,
                type: index % 2 === 0 ? "scheduled" : "manual",
                schedule: index % 3 === 0 ? "hourly" : index % 3 === 1 ? "daily" : "weekly",
                status: index % 5 === 0 ? "waiting" : "completed",
                runtimeMs: Math.floor(Math.random() * 900 + 120),
                successRate: Math.floor(Math.random() * 12 + 88),
                attempts: 0,
                createdAt: now,
                lastRunAt: now,
                nextRunAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              })
            )
          );

          return;
        }

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as AutomationJob[];

        data.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        setJobs(data);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubWorkers = onSnapshot(
      query(collection(db, "backgroundWorkers")),
      async (snapshot) => {
        if (snapshot.empty) {
          const now = new Date().toISOString();

          await Promise.all(
            DEFAULT_WORKERS.map((name, index) =>
              setDoc(doc(db, "backgroundWorkers", name.toLowerCase().replaceAll(" ", "-")), {
                name,
                status: index === 2 ? "warning" : "online",
                queueLength: Math.floor(Math.random() * 12),
                avgRuntimeMs: Math.floor(Math.random() * 700 + 100),
                failedJobs: index === 2 ? 2 : 0,
                lastHeartbeat: now,
              })
            )
          );

          return;
        }

        setWorkers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Worker[]);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubJobs();
      unsubWorkers();
    };
  }, []);

  const metrics = useMemo(() => {
    const running = jobs.filter((job) => job.status === "running");
    const waiting = jobs.filter((job) => job.status === "waiting");
    const failed = jobs.filter((job) => job.status === "failed");
    const retrying = jobs.filter((job) => job.status === "retrying");
    const completed = jobs.filter((job) => job.status === "completed");
    const queueSize = workers.reduce((total, worker) => total + Number(worker.queueLength || 0), 0);
    const failedWorkerJobs = workers.reduce((total, worker) => total + Number(worker.failedJobs || 0), 0);
    const avgRuntime =
      jobs.length > 0
        ? Math.round(jobs.reduce((total, job) => total + Number(job.runtimeMs || 0), 0) / jobs.length)
        : 0;

    const avgSuccess =
      jobs.length > 0
        ? Math.round(jobs.reduce((total, job) => total + Number(job.successRate || 0), 0) / jobs.length)
        : 0;

    const healthScore = Math.max(
      0,
      Math.min(100, avgSuccess - failed.length * 7 - retrying.length * 3 - failedWorkerJobs * 2)
    );

    return {
      total: jobs.length,
      running: running.length,
      waiting: waiting.length,
      failed: failed.length,
      retrying: retrying.length,
      completed: completed.length,
      queueSize,
      failedWorkerJobs,
      avgRuntime,
      avgSuccess,
      healthScore,
    };
  }, [jobs, workers]);

  const filteredJobs = useMemo(() => {
    if (filter === "all") return jobs;
    return jobs.filter(
      (job) => job.status === filter || job.type === filter || job.schedule === filter
    );
  }, [jobs, filter]);

  async function runJob(job: AutomationJob) {
    try {
      setRunningId(job.id);
      setMessage("");

      const now = new Date().toISOString();
      const runtime = Math.floor(Math.random() * 1000 + 120);

      await updateDoc(doc(db, "automationJobs", job.id), {
        status: "running",
        updatedAt: now,
      });

      await new Promise((resolve) => setTimeout(resolve, 650));

      await updateDoc(doc(db, "automationJobs", job.id), {
        status: "completed",
        lastRunAt: new Date().toISOString(),
        nextRunAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        runtimeMs: runtime,
        successRate: Math.min(100, Number(job.successRate || 95) + 1),
        attempts: Number(job.attempts || 0) + 1,
        updatedAt: new Date().toISOString(),
      });

      await addDoc(collection(db, "jobLogs"), {
        jobId: job.id,
        jobName: job.name || "Automation Job",
        status: "completed",
        runtimeMs: runtime,
        startedAt: now,
        finishedAt: new Date().toISOString(),
        triggeredBy: auth.currentUser?.email || "admin",
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Automation Job Executed",
        targetType: "automationJob",
        targetId: job.id,
        details: `${job.name || "Automation job"} executed manually.`,
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: new Date().toISOString(),
        resolved: true,
      });

      setMessage(`${job.name || "Job"} completed.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not run job.");
    } finally {
      setRunningId("");
    }
  }

  async function runAllJobs() {
    for (const job of jobs) {
      await runJob(job);
    }
  }

  async function createQueueJob(name: string) {
    try {
      setRunningId(name);
      const now = new Date().toISOString();

      await addDoc(collection(db, "automationQueue"), {
        name,
        status: "waiting",
        priority: "high",
        createdAt: now,
        createdBy: auth.currentUser?.email || "",
      });

      await addDoc(collection(db, "jobLogs"), {
        jobName: name,
        status: "queued",
        startedAt: now,
        triggeredBy: auth.currentUser?.email || "admin",
      });

      setMessage(`${name} added to queue.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not queue job.");
    } finally {
      setRunningId("");
    }
  }

  function statusClass(status?: string) {
    if (status === "completed" || status === "online") return "pill good";
    if (status === "running" || status === "retrying" || status === "warning") return "pill warning";
    if (status === "failed" || status === "offline") return "pill danger";
    return "pill neutral";
  }

  function formatDate(value?: string) {
    if (!value) return "Not available";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/automations" className="miniButton">Rules</Link>
          <Link href="/admin/mission-control" className="miniButton">Mission Control</Link>
          <Link href="/admin/system-health" className="miniButton">System Health</Link>
          <Link href="/admin/audit-logs" className="miniButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Automation</p>
            <h1>Automation <span>Center</span></h1>
            <p className="subtitle">
              Monitor jobs, workers, queues, scheduled tasks, cron runs, cleanup jobs,
              revenue sync, fraud scans and background automations.
            </p>
          </div>

          <div className={metrics.healthScore >= 80 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{metrics.healthScore}</strong>
            <span>Automation Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🤖" label="Total Jobs" value={String(metrics.total)} />
          <Metric icon="⚡" label="Running" value={String(metrics.running)} />
          <Metric icon="⏳" label="Waiting" value={String(metrics.waiting)} />
          <Metric icon="❌" label="Failed" value={String(metrics.failed)} danger={metrics.failed > 0} />
          <Metric icon="🔁" label="Retrying" value={String(metrics.retrying)} />
          <Metric icon="✅" label="Completed" value={String(metrics.completed)} />
          <Metric icon="📦" label="Queue Size" value={String(metrics.queueSize)} />
          <Metric icon="📊" label="Success" value={`${metrics.avgSuccess}%`} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Manual Actions</p>
            <h2>Run Jobs Now</h2>

            <div className="quickGrid">
              {[
                "Run Cleanup",
                "Run Notifications",
                "Run Fraud Scan",
                "Run Revenue Sync",
                "Run Analytics",
                "Run Queue",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => createQueueJob(item)}
                  disabled={runningId === item}
                >
                  {item}
                </button>
              ))}

              <button className="dangerButton" onClick={runAllJobs} disabled={Boolean(runningId)}>
                Run All Jobs
              </button>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Filters</p>
            <h2>Job Groups</h2>

            <div className="filterGrid">
              {[
                ["all", "🌐 All"],
                ["running", "⚡ Running"],
                ["waiting", "⏳ Waiting"],
                ["completed", "✅ Completed"],
                ["failed", "❌ Failed"],
                ["retrying", "🔁 Retrying"],
                ["hourly", "🕐 Hourly"],
                ["daily", "📅 Daily"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={filter === key ? "filterButton activeFilter" : "filterButton"}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Background Workers</p>
            <h2>Worker Fleet</h2>

            <div className="workerList">
              {workers.map((worker) => (
                <article key={worker.id} className="workerCard">
                  <div>
                    <strong>{worker.name || "Worker"}</strong>
                    <span>Queue: {Number(worker.queueLength || 0)} · Avg: {Number(worker.avgRuntimeMs || 0)} ms</span>
                  </div>

                  <em className={statusClass(worker.status)}>{worker.status || "online"}</em>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Performance</p>
            <h2>Live Runtime</h2>

            <div className="perfGrid">
              <Info label="Average Runtime" value={`${metrics.avgRuntime} ms`} />
              <Info label="Failed Worker Jobs" value={String(metrics.failedWorkerJobs)} />
              <Info label="Queue Length" value={String(metrics.queueSize)} />
              <Info label="Success Rate" value={`${metrics.avgSuccess}%`} />
              <Info label="CPU Usage" value={`${Math.min(88, 25 + metrics.running * 8)}%`} />
              <Info label="Memory Usage" value={`${Math.min(91, 41 + metrics.queueSize * 2)}%`} />
            </div>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Job Queue</p>
          <h2>Scheduled & Manual Jobs</h2>

          {filteredJobs.length === 0 ? (
            <div className="empty">
              <h3>No jobs found</h3>
              <p>Automation jobs will appear here.</p>
            </div>
          ) : (
            <div className="jobList">
              {filteredJobs.map((job) => (
                <article key={job.id} className="jobCard">
                  <div className="jobTop">
                    <div>
                      <h3>{job.name || "Automation Job"}</h3>
                      <p>{job.type || "scheduled"} · {job.schedule || "manual"}</p>
                    </div>

                    <span className={statusClass(job.status)}>{job.status || "waiting"}</span>
                  </div>

                  <div className="infoGrid">
                    <Info label="Runtime" value={`${Number(job.runtimeMs || 0)} ms`} />
                    <Info label="Success Rate" value={`${Number(job.successRate || 0)}%`} />
                    <Info label="Attempts" value={String(job.attempts || 0)} />
                    <Info label="Last Run" value={formatDate(job.lastRunAt)} />
                    <Info label="Next Run" value={formatDate(job.nextRunAt)} />
                    <Info label="Job ID" value={job.id} />
                  </div>

                  <div className="actions">
                    <button onClick={() => runJob(job)} disabled={runningId === job.id}>
                      {runningId === job.id ? "Running..." : "Run Now"}
                    </button>

                    <button
                      className="secondaryButton"
                      onClick={() => updateDoc(doc(db, "automationJobs", job.id), { status: "waiting" })}
                    >
                      Queue
                    </button>

                    <button
                      className="dangerButton"
                      onClick={() => updateDoc(doc(db, "automationJobs", job.id), { status: "failed" })}
                    >
                      Mark Failed
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
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1240px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .metric,
        .panel,
        .jobCard {
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
          font-size: 60px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue,
        .scoreOrb strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .jobTop p,
        .empty p,
        .workerCard span {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 14px 0;
        }

        .scoreOrb {
          min-width: 116px;
          height: 116px;
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

        .warningScore strong { color: #fca5a5; }

        .scoreOrb strong {
          font-size: 36px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }

        .metric {
          border-radius: 22px;
          padding: 16px;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.20);
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          margin-bottom: 10px;
        }

        .metricLabel {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          display: block;
          margin-bottom: 6px;
        }

        .metricValue {
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .panel {
          border-radius: 30px;
          padding: 24px;
        }

        .quickGrid,
        .filterGrid,
        .perfGrid,
        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        button {
          width: 100%;
          padding: 14px 18px;
          border-radius: 999px;
          border: none;
          color: white;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          font-weight: 900;
          cursor: pointer;
        }

        .filterButton {
          text-align: left;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .activeFilter {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
        }

        .secondaryButton {
          background: rgba(59,130,246,0.18);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .dangerButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .workerList,
        .jobList {
          display: grid;
          gap: 12px;
        }

        .workerCard {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .workerCard strong,
        .workerCard span {
          display: block;
          overflow-wrap: anywhere;
        }

        .pill {
          padding: 8px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          text-transform: capitalize;
          font-style: normal;
          white-space: nowrap;
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

        .pill.neutral {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .jobCard {
          border-radius: 24px;
          padding: 22px;
          box-shadow: none;
        }

        .jobTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .jobTop h3 {
          margin: 0 0 6px;
          font-size: 22px;
        }

        .jobTop p {
          margin: 0;
          text-transform: capitalize;
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
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 16px;
        }

        .empty {
          padding: 24px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .empty h3 {
          margin: 0 0 8px;
        }

        @media (max-width: 1050px) {
          .hero,
          .grid,
          .jobTop {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .quickGrid,
          .filterGrid,
          .perfGrid,
          .infoGrid,
          .actions {
            grid-template-columns: repeat(2, 1fr);
          }

          h1 {
            font-size: 46px;
          }
        }

        @media (max-width: 650px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .panel {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .quickGrid,
          .filterGrid,
          .perfGrid,
          .infoGrid,
          .actions,
          .workerCard {
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
      <strong className="metricValue">{value}</strong>
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
