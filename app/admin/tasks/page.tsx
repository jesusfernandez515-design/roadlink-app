"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
type TaskPriority = "low" | "medium" | "high" | "critical";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type AdminTask = {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  priority?: TaskPriority | string;
  status?: TaskStatus | string;
  assignedTo?: string;
  source?: string;
  sourceId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

export default function AdminTasksPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [selected, setSelected] = useState<AdminTask | null>(null);
  const [message, setMessage] = useState("Loading tasks center...");
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("operations");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [source, setSource] = useState("manual");

  useEffect(() => {
    let unsubscribeMe: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      unsubscribeMe = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : ({ id: user.uid, email: user.email || "" } as UserProfile);

          setCurrentUser(data);

          const allowed =
            data.admin === true ||
            data.role === "admin" ||
            user.email === "jesusfernandez515@gmail.com";

          setMessage(allowed ? "" : "Access denied. Admin account required.");
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMe) unsubscribeMe();
    };
  }, [router]);

  const adminAllowed =
    currentUser?.admin === true ||
    currentUser?.role === "admin" ||
    auth.currentUser?.email === "jesusfernandez515@gmail.com";

  useEffect(() => {
    if (!adminAllowed) return;

    const unsubscribe = onSnapshot(
      query(collection(db, "adminTasks")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as AdminTask[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setTasks(data);
        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((item) => item.id === current.id) || data[0] || null;
        });

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, [adminAllowed]);

  const metrics = useMemo(() => {
    const open = tasks.filter((item) => !item.status || item.status === "open");
    const progress = tasks.filter((item) => item.status === "in_progress");
    const completed = tasks.filter((item) => item.status === "completed");
    const cancelled = tasks.filter((item) => item.status === "cancelled");
    const critical = tasks.filter((item) => item.priority === "critical");
    const high = tasks.filter((item) => item.priority === "high");

    const completionRate =
      tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;

    const workloadScore = Math.max(
      0,
      Math.min(
        100,
        100 - open.length * 4 - progress.length * 2 - critical.length * 10 - high.length * 5
      )
    );

    return {
      total: tasks.length,
      open: open.length,
      progress: progress.length,
      completed: completed.length,
      cancelled: cancelled.length,
      critical: critical.length,
      high: high.length,
      completionRate,
      workloadScore,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const value = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !value ||
        String(task.title || "").toLowerCase().includes(value) ||
        String(task.description || "").toLowerCase().includes(value) ||
        String(task.category || "").toLowerCase().includes(value) ||
        String(task.assignedTo || "").toLowerCase().includes(value) ||
        String(task.source || "").toLowerCase().includes(value) ||
        String(task.id || "").toLowerCase().includes(value);

      const matchesFilter =
        filter === "all" ||
        task.status === filter ||
        task.priority === filter ||
        task.category === filter ||
        task.source === filter;

      return matchesSearch && matchesFilter;
    });
  }, [tasks, filter, search]);

  async function createTask() {
    if (!title.trim()) {
      setMessage("Task title is required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "adminTasks"), {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: "open",
        assignedTo: assignedTo.trim(),
        source,
        createdBy: auth.currentUser?.email || "",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Admin Task Created",
        targetType: "adminTask",
        details: `${title} task created.`,
        severity: priority === "critical" ? "critical" : priority === "high" ? "warning" : "info",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: false,
      });

      setTitle("");
      setDescription("");
      setCategory("operations");
      setPriority("medium");
      setAssignedTo("");
      setSource("manual");
      setMessage("Task created successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create task.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(task: AdminTask, nextStatus: TaskStatus) {
    try {
      setProcessingId(task.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "adminTasks", task.id), {
        status: nextStatus,
        updatedAt: now,
        ...(nextStatus === "completed" ? { completedAt: now } : {}),
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Admin Task Updated",
        targetType: "adminTask",
        targetId: task.id,
        details: `${task.title || "Task"} moved to ${nextStatus}.`,
        severity: nextStatus === "completed" ? "success" : "info",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: nextStatus === "completed",
      });

      setMessage(`Task marked as ${nextStatus}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update task.");
    } finally {
      setProcessingId("");
    }
  }

  function statusClass(value?: string) {
    if (value === "completed") return "pill completed";
    if (value === "in_progress") return "pill progress";
    if (value === "cancelled") return "pill cancelled";
    return "pill open";
  }

  function priorityClass(value?: string) {
    if (value === "critical") return "pill critical";
    if (value === "high") return "pill high";
    if (value === "medium") return "pill medium";
    return "pill low";
  }

  function formatDate(value?: string) {
    if (!value) return "Not available";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Tasks <span>Center</span></h1>
          <p>{message || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <Styles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/ai-assistant" className="navButton">AI Assistant</Link>
          <Link href="/admin/ai-command" className="navButton">AI Command</Link>
          <Link href="/admin/support-center" className="navButton">Support</Link>
          <Link href="/admin/audit-logs" className="navButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Operations</p>
            <h1>Tasks <span>Center</span></h1>
            <p className="subtitle">
              Convert AI insights, support, fraud, moderation, finance and operations into trackable admin tasks.
            </p>
          </div>

          <div className={metrics.workloadScore >= 70 ? "taskOrb" : "taskOrb dangerOrb"}>
            <strong>{metrics.workloadScore}</strong>
            <span>Workload Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📋" label="Total Tasks" value={String(metrics.total)} />
          <Metric icon="📌" label="Open" value={String(metrics.open)} />
          <Metric icon="🔄" label="In Progress" value={String(metrics.progress)} />
          <Metric icon="✅" label="Completed" value={String(metrics.completed)} />
          <Metric icon="❌" label="Cancelled" value={String(metrics.cancelled)} />
          <Metric icon="🚨" label="Critical" value={String(metrics.critical)} />
          <Metric icon="⚠️" label="High" value={String(metrics.high)} />
          <Metric icon="📈" label="Completion" value={`${metrics.completionRate}%`} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Create Task</p>
            <h2>New Admin Task</h2>

            <label>Title</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Review urgent support case..." />

            <label>Description</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what needs to be done..." />

            <label>Category</label>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="operations">Operations</option>
              <option value="support">Support</option>
              <option value="fraud">Fraud</option>
              <option value="moderation">Moderation</option>
              <option value="finance">Finance</option>
              <option value="growth">Growth</option>
              <option value="safety">Safety</option>
              <option value="engineering">Engineering</option>
            </select>

            <label>Priority</label>
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <label>Assigned To</label>
            <input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Admin email or team name" />

            <label>Source</label>
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="manual">Manual</option>
              <option value="ai">AI Recommendation</option>
              <option value="support">Support</option>
              <option value="fraud">Fraud</option>
              <option value="moderation">Moderation</option>
              <option value="finance">Finance</option>
              <option value="sos">SOS</option>
            </select>

            <button onClick={createTask} disabled={saving}>
              {saving ? "Creating..." : "Create Task"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Filters</p>
            <h2>Task Queue</h2>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks..."
            />

            <div className="filterGrid">
              {[
                ["all", "🌐 All"],
                ["open", "📌 Open"],
                ["in_progress", "🔄 Progress"],
                ["completed", "✅ Completed"],
                ["critical", "🚨 Critical"],
                ["high", "⚠️ High"],
                ["support", "🎧 Support"],
                ["fraud", "🛡️ Fraud"],
                ["finance", "💰 Finance"],
                ["ai", "🤖 AI"],
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

            <div className="summaryBox">
              <strong>{filteredTasks.length}</strong>
              <span>tasks showing</span>
            </div>
          </section>
        </section>

        <section className="adminGrid">
          <section className="panel">
            <p className="eyebrow">Tasks</p>
            <h2>Admin Work Queue</h2>

            {filteredTasks.length === 0 ? (
              <Empty text="No tasks found." />
            ) : (
              <div className="taskList">
                {filteredTasks.map((task) => (
                  <button
                    key={task.id}
                    className={selected?.id === task.id ? "taskItem selected" : "taskItem"}
                    onClick={() => setSelected(task)}
                  >
                    <div>
                      <strong>{task.title || "Admin Task"}</strong>
                      <span>{task.category || "operations"} · {task.assignedTo || "Unassigned"}</span>
                      <small>{formatDate(task.createdAt)}</small>
                    </div>

                    <div className="pillStack">
                      <em className={priorityClass(task.priority)}>{task.priority || "medium"}</em>
                      <em className={statusClass(task.status)}>{task.status || "open"}</em>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            {selected ? (
              <>
                <div className="detailsTop">
                  <div>
                    <p className="eyebrow">Selected Task</p>
                    <h2>{selected.title || "Admin Task"}</h2>
                    <p className="subtitle smallText">{selected.description || "No description provided."}</p>
                  </div>

                  <span className={priorityClass(selected.priority)}>{selected.priority || "medium"}</span>
                </div>

                <div className="infoGrid">
                  <Info label="Task ID" value={selected.id} />
                  <Info label="Status" value={selected.status || "open"} />
                  <Info label="Priority" value={selected.priority || "medium"} />
                  <Info label="Category" value={selected.category || "operations"} />
                  <Info label="Assigned To" value={selected.assignedTo || "Unassigned"} />
                  <Info label="Source" value={selected.source || "manual"} />
                  <Info label="Created By" value={selected.createdBy || "System"} />
                  <Info label="Created" value={formatDate(selected.createdAt)} />
                  <Info label="Updated" value={formatDate(selected.updatedAt)} />
                  <Info label="Completed" value={formatDate(selected.completedAt)} />
                </div>

                <div className="actionRow">
                  <button onClick={() => updateTaskStatus(selected, "open")} disabled={processingId === selected.id}>
                    Open
                  </button>

                  <button className="progressButton" onClick={() => updateTaskStatus(selected, "in_progress")} disabled={processingId === selected.id}>
                    In Progress
                  </button>

                  <button className="goodButton" onClick={() => updateTaskStatus(selected, "completed")} disabled={processingId === selected.id}>
                    Complete
                  </button>

                  <button className="dangerButton" onClick={() => updateTaskStatus(selected, "cancelled")} disabled={processingId === selected.id}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <Empty text="Select a task to view details." />
            )}
          </section>
        </section>
      </section>

      <Styles />
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <h3>No data</h3>
      <p>{text}</p>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 130px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 35%),
          radial-gradient(circle at bottom left, rgba(59,130,246,0.14), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container { max-width: 1240px; margin: auto; }

      .topBar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .navButton {
        color: white;
        text-decoration: none;
        font-weight: 900;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .hero,
      .metric,
      .panel,
      .locked {
        background: rgba(8,13,25,0.9);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 24px 80px rgba(0,0,0,0.55);
        backdrop-filter: blur(16px);
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        padding: 35px;
        border-radius: 32px;
        margin-bottom: 20px;
      }

      .locked {
        max-width: 720px;
        margin: 80px auto;
        padding: 35px;
        border-radius: 32px;
        text-align: center;
      }

      .eyebrow {
        color: #22c55e;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 13px;
        margin: 0 0 10px;
      }

      h1 { margin: 0 0 16px; font-size: 60px; line-height: 1; }

      h1 span,
      h2,
      .metric strong,
      .taskOrb strong,
      .summaryBox strong {
        color: #22c55e;
      }

      .subtitle,
      .empty p,
      .locked p {
        color: #a1a1aa;
        line-height: 1.5;
        margin: 0;
      }

      .smallText { font-size: 15px; overflow-wrap: anywhere; }

      .taskOrb {
        min-width: 130px;
        height: 130px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        text-align: center;
      }

      .dangerOrb {
        background: rgba(239,68,68,0.13);
        border-color: rgba(239,68,68,0.35);
      }

      .dangerOrb strong { color: #fca5a5; }
      .taskOrb strong { font-size: 42px; }
      .taskOrb span { color: #d4d4d8; font-weight: 900; font-size: 12px; }

      .message { color: #22c55e; text-align: center; font-weight: 900; }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .metric { padding: 18px; border-radius: 22px; }
      .metricIcon { font-size: 24px; margin-bottom: 8px; }
      .metric span { display: block; color: #a1a1aa; font-size: 12px; font-weight: 900; margin-bottom: 6px; }
      .metric strong { font-size: 22px; overflow-wrap: anywhere; }

      .grid,
      .adminGrid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .panel {
        border-radius: 30px;
        padding: 30px;
        margin-bottom: 20px;
      }

      label {
        display: block;
        margin: 14px 0 8px;
        font-weight: 900;
      }

      input,
      textarea,
      select {
        width: 100%;
        padding: 15px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: white;
        font-size: 16px;
        outline: none;
        font-family: Arial, sans-serif;
      }

      textarea {
        min-height: 110px;
        resize: vertical;
      }

      option { color: black; }

      button {
        width: 100%;
        margin-top: 16px;
        padding: 14px;
        border-radius: 999px;
        border: none;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      button:disabled { opacity: 0.55; cursor: not-allowed; }

      .filterGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-top: 16px;
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

      .summaryBox {
        margin-top: 18px;
        padding: 18px;
        border-radius: 20px;
        background: rgba(34,197,94,0.1);
        border: 1px solid rgba(34,197,94,0.3);
      }

      .summaryBox strong {
        display: block;
        font-size: 34px;
      }

      .summaryBox span {
        color: #a1a1aa;
        font-weight: 900;
      }

      .taskList {
        display: grid;
        gap: 12px;
      }

      .taskItem {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
        width: 100%;
        text-align: left;
        padding: 16px;
        margin: 0;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .taskItem.selected {
        background: rgba(34,197,94,0.09);
        border-color: rgba(34,197,94,0.4);
      }

      .taskItem strong,
      .taskItem span,
      .taskItem small {
        display: block;
        overflow-wrap: anywhere;
      }

      .taskItem span,
      .taskItem small {
        color: #a1a1aa;
        margin-top: 5px;
      }

      .pillStack {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .pill {
        padding: 8px 11px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        text-transform: capitalize;
        white-space: nowrap;
        font-style: normal;
      }

      .critical,
      .cancelled {
        color: #fca5a5;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .high,
      .open {
        color: #fb923c;
        background: rgba(249,115,22,0.12);
        border: 1px solid rgba(249,115,22,0.35);
      }

      .medium,
      .progress {
        color: #fde68a;
        background: rgba(234,179,8,0.12);
        border: 1px solid rgba(234,179,8,0.35);
      }

      .low,
      .completed {
        color: #86efac;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
      }

      .detailsTop {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 20px;
      }

      .infoGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
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

      .actionRow {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }

      .progressButton {
        background: linear-gradient(135deg, #f59e0b, #b45309);
      }

      .goodButton {
        background: linear-gradient(135deg, #22c55e, #16a34a);
      }

      .dangerButton {
        background: linear-gradient(135deg, #ef4444, #991b1b);
      }

      .empty {
        min-height: 220px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        border-radius: 20px;
        padding: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .empty h3 { margin: 0 0 8px; }

      @media (max-width: 1050px) {
        .hero,
        .grid,
        .adminGrid,
        .detailsTop {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats,
        .infoGrid,
        .actionRow,
        .filterGrid {
          grid-template-columns: 1fr;
        }

        h1 { font-size: 44px; }
      }

      @media (max-width: 650px) {
        .page { padding: 16px; padding-bottom: 120px; }

        .hero,
        .panel {
          padding: 22px;
          border-radius: 26px;
        }

        .taskItem {
          grid-template-columns: 1fr;
        }

        .pillStack {
          justify-content: flex-start;
        }
      }
    `}</style>
  );
      }
