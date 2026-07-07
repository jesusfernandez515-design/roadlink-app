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

type WorkflowStatus = "active" | "paused" | "draft";
type StepType = "trigger" | "condition" | "action" | "notification";

type WorkflowStep = {
  id: string;
  type: StepType;
  title: string;
  description: string;
};

type Workflow = {
  id: string;
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  trigger?: string;
  condition?: string;
  action?: string;
  notification?: string;
  runs?: number;
  successRate?: number;
  lastRunAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_STEPS: WorkflowStep[] = [
  {
    id: "trigger",
    type: "trigger",
    title: "Event Trigger",
    description: "When something happens in RoadLink.",
  },
  {
    id: "condition",
    type: "condition",
    title: "Condition",
    description: "Check if the rule should continue.",
  },
  {
    id: "action",
    type: "action",
    title: "Action",
    description: "Create task, notification, campaign or update.",
  },
  {
    id: "notification",
    type: "notification",
    title: "Notification",
    description: "Notify admin, driver or passenger.",
  },
];

export default function AdminWorkflowBuilderPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [message, setMessage] = useState("Loading workflow builder...");
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState("");

  const [name, setName] = useState("Driver Verification Workflow");
  const [description, setDescription] = useState(
    "When a driver is verified, notify the user and create an admin follow-up task."
  );
  const [trigger, setTrigger] = useState("driver_verified");
  const [condition, setCondition] = useState("driverVerified == true");
  const [action, setAction] = useState("create_admin_task");
  const [notification, setNotification] = useState("send_user_notification");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "workflows")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Workflow[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setWorkflows(data);

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

  const metrics = useMemo(() => {
    const active = workflows.filter((item) => item.status === "active");
    const paused = workflows.filter((item) => item.status === "paused");
    const draft = workflows.filter((item) => item.status === "draft");

    const totalRuns = workflows.reduce(
      (total, item) => total + Number(item.runs || 0),
      0
    );

    const avgSuccess =
      workflows.length > 0
        ? Math.round(
            workflows.reduce(
              (total, item) => total + Number(item.successRate || 0),
              0
            ) / workflows.length
          )
        : 0;

    const healthScore = Math.max(
      0,
      Math.min(100, 65 + active.length * 8 + avgSuccess / 3 - paused.length * 4)
    );

    return {
      active: active.length,
      paused: paused.length,
      draft: draft.length,
      totalRuns,
      avgSuccess,
      healthScore: Math.round(healthScore),
    };
  }, [workflows]);

  async function createWorkflow(status: WorkflowStatus = "draft") {
    if (!name.trim()) {
      setMessage("Workflow name is required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "workflows"), {
        name: name.trim(),
        description: description.trim(),
        status,
        trigger,
        condition,
        action,
        notification,
        steps: DEFAULT_STEPS,
        runs: 0,
        successRate: 100,
        createdAt: now,
        updatedAt: now,
        createdBy: auth.currentUser?.email || "admin",
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Workflow Created",
        targetType: "workflow",
        details: `${name.trim()} created as ${status}.`,
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage("Workflow created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create workflow.");
    } finally {
      setSaving(false);
    }
  }

  async function updateWorkflowStatus(item: Workflow, status: WorkflowStatus) {
    try {
      setRunningId(item.id);
      setMessage("");

      await updateDoc(doc(db, "workflows", item.id), {
        status,
        updatedAt: new Date().toISOString(),
      });

      setMessage(`Workflow marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update workflow.");
    } finally {
      setRunningId("");
    }
  }

  async function runWorkflow(item: Workflow) {
    try {
      setRunningId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "workflows", item.id),
        {
          runs: Number(item.runs || 0) + 1,
          successRate: Math.min(100, Number(item.successRate || 95) + 1),
          lastRunAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "workflowRuns"), {
        workflowId: item.id,
        workflowName: item.name || "Workflow",
        status: "completed",
        trigger: item.trigger || "",
        condition: item.condition || "",
        action: item.action || "",
        notification: item.notification || "",
        startedAt: now,
        finishedAt: new Date().toISOString(),
        triggeredBy: auth.currentUser?.email || "admin",
      });

      await addDoc(collection(db, "adminTasks"), {
        title: `Workflow executed: ${item.name || "Workflow"}`,
        description: item.description || "Workflow executed from Workflow Builder.",
        category: "workflow",
        priority: "medium",
        status: "open",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Workflow Executed",
        targetType: "workflow",
        targetId: item.id,
        details: `${item.name || "Workflow"} executed manually.`,
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage("Workflow executed.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not run workflow.");
    } finally {
      setRunningId("");
    }
  }

  function statusClass(status?: string) {
    if (status === "active") return "pill active";
    if (status === "paused") return "pill paused";
    return "pill draft";
  }

  function formatDate(value?: string) {
    if (!value) return "Never";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Never";
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/automation-center" className="miniButton">Automation</Link>
          <Link href="/admin/ai-automation" className="miniButton">AI Automation</Link>
          <Link href="/admin/tasks" className="miniButton">Tasks</Link>
          <Link href="/admin/audit-logs" className="miniButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Automation</p>
            <h1>Workflow <span>Builder</span></h1>
            <p className="subtitle">
              Build RoadLink automation workflows using triggers, conditions, actions and notifications.
            </p>
          </div>

          <div className={metrics.healthScore >= 75 ? "scoreOrb" : "scoreOrb warning"}>
            <strong>{metrics.healthScore}</strong>
            <span>Workflow Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🧩" label="Workflows" value={String(workflows.length)} />
          <Metric icon="🟢" label="Active" value={String(metrics.active)} />
          <Metric icon="⏸️" label="Paused" value={String(metrics.paused)} />
          <Metric icon="📝" label="Draft" value={String(metrics.draft)} />
          <Metric icon="⚡" label="Total Runs" value={String(metrics.totalRuns)} />
          <Metric icon="📊" label="Success" value={`${metrics.avgSuccess}%`} />
        </section>

        <section className="builderGrid">
          <section className="panel">
            <p className="eyebrow">Create Workflow</p>
            <h2>Automation Builder</h2>

            <label>Workflow Name</label>
            <input value={name} onChange={(event) => setName(event.target.value)} />

            <label>Description</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />

            <div className="formGrid">
              <div>
                <label>Trigger</label>
                <select value={trigger} onChange={(event) => setTrigger(event.target.value)}>
                  <option value="driver_verified">Driver Verified</option>
                  <option value="ride_created">Ride Created</option>
                  <option value="booking_completed">Booking Completed</option>
                  <option value="payment_failed">Payment Failed</option>
                  <option value="sos_created">SOS Created</option>
                  <option value="user_registered">User Registered</option>
                  <option value="low_driver_supply">Low Driver Supply</option>
                </select>
              </div>

              <div>
                <label>Condition</label>
                <select value={condition} onChange={(event) => setCondition(event.target.value)}>
                  <option value="driverVerified == true">driverVerified == true</option>
                  <option value="status == completed">status == completed</option>
                  <option value="priority == critical">priority == critical</option>
                  <option value="drivers < 5">drivers &lt; 5</option>
                  <option value="bookings < target">bookings &lt; target</option>
                  <option value="always">always</option>
                </select>
              </div>

              <div>
                <label>Action</label>
                <select value={action} onChange={(event) => setAction(event.target.value)}>
                  <option value="create_admin_task">Create Admin Task</option>
                  <option value="send_coupon">Send Coupon</option>
                  <option value="create_incident">Create Incident</option>
                  <option value="run_fraud_scan">Run Fraud Scan</option>
                  <option value="create_campaign">Create Campaign</option>
                  <option value="update_status">Update Status</option>
                </select>
              </div>

              <div>
                <label>Notification</label>
                <select value={notification} onChange={(event) => setNotification(event.target.value)}>
                  <option value="send_user_notification">Send User Notification</option>
                  <option value="send_admin_notification">Send Admin Notification</option>
                  <option value="send_driver_notification">Send Driver Notification</option>
                  <option value="send_passenger_notification">Send Passenger Notification</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>

            <div className="actions">
              <button onClick={() => createWorkflow("draft")} disabled={saving}>
                Save Draft
              </button>
              <button className="secondaryButton" onClick={() => createWorkflow("active")} disabled={saving}>
                Create Active
              </button>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Workflow Canvas</p>
            <h2>Visual Flow</h2>

            <div className="canvas">
              {DEFAULT_STEPS.map((step, index) => (
                <div key={step.id} className={`node ${step.type}`}>
                  <div className="nodeNumber">{index + 1}</div>
                  <strong>{step.title}</strong>
                  <p>
                    {step.type === "trigger"
                      ? trigger
                      : step.type === "condition"
                      ? condition
                      : step.type === "action"
                      ? action
                      : notification}
                  </p>
                  {index < DEFAULT_STEPS.length - 1 && <div className="connector">↓</div>}
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="workflowsGrid">
          <section className="panel">
            <p className="eyebrow">Saved Workflows</p>
            <h2>Workflow Library</h2>

            {workflows.length === 0 ? (
              <div className="empty">
                <h3>No workflows yet</h3>
                <p>Create your first RoadLink workflow above.</p>
              </div>
            ) : (
              <div className="workflowList">
                {workflows.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "workflowItem selected" : "workflowItem"}
                  >
                    <div>
                      <strong>{item.name || "Workflow"}</strong>
                      <span>{item.trigger || "trigger"} → {item.action || "action"}</span>
                    </div>
                    <em className={statusClass(item.status)}>{item.status || "draft"}</em>
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
                    <p className="eyebrow">Selected Workflow</p>
                    <h2>{selected.name || "Workflow"}</h2>
                    <p className="subtitle">{selected.description || "No description."}</p>
                  </div>
                  <span className={statusClass(selected.status)}>{selected.status || "draft"}</span>
                </div>

                <div className="infoGrid">
                  <Info label="Trigger" value={selected.trigger || "Not configured"} />
                  <Info label="Condition" value={selected.condition || "Not configured"} />
                  <Info label="Action" value={selected.action || "Not configured"} />
                  <Info label="Notification" value={selected.notification || "None"} />
                  <Info label="Runs" value={String(selected.runs || 0)} />
                  <Info label="Success Rate" value={`${selected.successRate || 0}%`} />
                  <Info label="Last Run" value={formatDate(selected.lastRunAt)} />
                  <Info label="Workflow ID" value={selected.id} />
                </div>

                <div className="actions three">
                  <button onClick={() => runWorkflow(selected)} disabled={runningId === selected.id}>
                    {runningId === selected.id ? "Running..." : "Run Now"}
                  </button>

                  <button
                    className="secondaryButton"
                    onClick={() => updateWorkflowStatus(selected, "active")}
                    disabled={runningId === selected.id}
                  >
                    Activate
                  </button>

                  <button
                    className="dangerButton"
                    onClick={() => updateWorkflowStatus(selected, "paused")}
                    disabled={runningId === selected.id}
                  >
                    Pause
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select workflow</h3>
                <p>Choose a workflow to review details and execute it.</p>
              </div>
            )}
          </section>
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
        .panel {
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
        .empty p,
        .node p,
        .workflowItem span {
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

        .scoreOrb.warning {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb.warning strong { color: #fca5a5; }

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
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }

        .metric {
          border-radius: 22px;
          padding: 16px;
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

        .builderGrid,
        .workflowsGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .panel {
          border-radius: 30px;
          padding: 24px;
        }

        label {
          display: block;
          font-weight: 900;
          margin: 14px 0 8px;
        }

        input,
        select,
        textarea {
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

        option { color: black; }

        textarea {
          min-height: 100px;
          resize: vertical;
        }

        .formGrid,
        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 18px;
        }

        .actions.three {
          grid-template-columns: repeat(3, 1fr);
        }

        button {
          padding: 15px 20px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
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

        .canvas {
          display: grid;
          gap: 20px;
        }

        .node {
          position: relative;
          padding: 18px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .node.trigger { border-color: rgba(34,197,94,0.35); }
        .node.condition { border-color: rgba(234,179,8,0.35); }
        .node.action { border-color: rgba(59,130,246,0.35); }
        .node.notification { border-color: rgba(168,85,247,0.35); }

        .nodeNumber {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(34,197,94,0.14);
          border: 1px solid rgba(34,197,94,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          margin-bottom: 10px;
        }

        .node strong,
        .node p {
          display: block;
          overflow-wrap: anywhere;
        }

        .connector {
          position: absolute;
          left: 50%;
          bottom: -25px;
          transform: translateX(-50%);
          color: #22c55e;
          font-size: 20px;
          font-weight: 900;
        }

        .workflowList {
          display: grid;
          gap: 12px;
        }

        .workflowItem {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          text-align: left;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .workflowItem.selected {
          background: rgba(34,197,94,0.1);
          border-color: rgba(34,197,94,0.4);
        }

        .workflowItem strong,
        .workflowItem span {
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
        }

        .pill.active {
          color: #86efac;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .pill.paused {
          color: #fde68a;
          background: rgba(234,179,8,0.12);
          border: 1px solid rgba(234,179,8,0.35);
        }

        .pill.draft {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .detailsTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 18px;
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
          .builderGrid,
          .workflowsGrid,
          .detailsTop {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          h1 { font-size: 46px; }
        }

        @media (max-width: 650px) {
          .page { padding: 16px; padding-bottom: 120px; }

          .hero,
          .panel {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .formGrid,
          .infoGrid,
          .actions,
          .actions.three,
          .workflowItem {
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
