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
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type AutomationStatus = "active" | "paused" | "disabled";
type AutomationTrigger =
  | "sos_created"
  | "user_reported"
  | "driver_reports"
  | "trip_cancelled"
  | "payment_failed"
  | "refund_requested"
  | "loyalty_tier"
  | "inactive_user"
  | "low_driver_supply";

type AutomationAction =
  | "create_task"
  | "send_notification"
  | "create_incident"
  | "create_audit_log"
  | "flag_user"
  | "pause_user"
  | "send_promo"
  | "escalate_admin";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type AutomationRule = {
  id: string;
  name?: string;
  description?: string;
  trigger?: AutomationTrigger | string;
  action?: AutomationAction | string;
  status?: AutomationStatus | string;
  priority?: string;
  targetModule?: string;
  conditionText?: string;
  actionText?: string;
  runCount?: number;
  lastRunAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
};

export default function AdminAutomationsPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [selected, setSelected] = useState<AutomationRule | null>(null);
  const [message, setMessage] = useState("Loading automation center...");
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [filter, setFilter] = useState("all");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>("sos_created");
  const [action, setAction] = useState<AutomationAction>("create_task");
  const [priority, setPriority] = useState("high");
  const [targetModule, setTargetModule] = useState("operations");
  const [conditionText, setConditionText] = useState("");
  const [actionText, setActionText] = useState("");

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
      query(collection(db, "automationRules")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as AutomationRule[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setRules(data);

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
    const active = rules.filter((item) => item.status === "active");
    const paused = rules.filter((item) => item.status === "paused");
    const disabled = rules.filter((item) => item.status === "disabled");
    const critical = rules.filter((item) => item.priority === "critical");
    const totalRuns = rules.reduce((total, item) => total + Number(item.runCount || 0), 0);

    const automationScore = Math.max(
      0,
      Math.min(
        100,
        60 + active.length * 5 + totalRuns * 2 - paused.length * 3 - disabled.length * 5
      )
    );

    return {
      total: rules.length,
      active: active.length,
      paused: paused.length,
      disabled: disabled.length,
      critical: critical.length,
      totalRuns,
      automationScore,
    };
  }, [rules]);

  const filteredRules = useMemo(() => {
    if (filter === "all") return rules;

    return rules.filter(
      (item) =>
        item.status === filter ||
        item.trigger === filter ||
        item.action === filter ||
        item.priority === filter ||
        item.targetModule === filter
    );
  }, [rules, filter]);

  async function createRule() {
    if (!name.trim()) {
      setMessage("Automation name is required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "automationRules"), {
        name: name.trim(),
        description: description.trim(),
        trigger,
        action,
        status: "active",
        priority,
        targetModule,
        conditionText: conditionText.trim(),
        actionText: actionText.trim(),
        runCount: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: auth.currentUser?.email || "",
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Automation Rule Created",
        targetType: "automationRule",
        details: `${name} automation created.`,
        severity: priority === "critical" ? "critical" : priority === "high" ? "warning" : "info",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setName("");
      setDescription("");
      setTrigger("sos_created");
      setAction("create_task");
      setPriority("high");
      setTargetModule("operations");
      setConditionText("");
      setActionText("");

      setMessage("Automation rule created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create automation.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(rule: AutomationRule, status: AutomationStatus) {
    try {
      setProcessingId(rule.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "automationRules", rule.id), {
        status,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Automation Status Updated",
        targetType: "automationRule",
        targetId: rule.id,
        details: `${rule.name || "Automation"} changed to ${status}.`,
        severity: status === "active" ? "success" : "info",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage(`Automation marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update automation.");
    } finally {
      setProcessingId("");
    }
  }

  async function testRun(rule: AutomationRule) {
    try {
      setProcessingId(rule.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "automationRules", rule.id),
        {
          runCount: Number(rule.runCount || 0) + 1,
          lastRunAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "adminTasks"), {
        title: `Automation Test: ${rule.name || "Rule"}`,
        description:
          rule.actionText ||
          `Test run created from automation rule using trigger ${rule.trigger}.`,
        category: rule.targetModule || "operations",
        priority: rule.priority || "medium",
        status: "open",
        source: "automation",
        sourceId: rule.id,
        createdBy: auth.currentUser?.email || "",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Automation Test Run",
        targetType: "automationRule",
        targetId: rule.id,
        details: `${rule.name || "Automation"} test run executed.`,
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage("Automation test run completed. A task was created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not test automation.");
    } finally {
      setProcessingId("");
    }
  }

  function statusClass(value?: string) {
    if (value === "active") return "pill active";
    if (value === "paused") return "pill paused";
    return "pill disabled";
  }

  function priorityClass(value?: string) {
    if (value === "critical") return "pill critical";
    if (value === "high") return "pill high";
    if (value === "medium") return "pill medium";
    return "pill low";
  }

  function label(value?: string) {
    return String(value || "not_available").replaceAll("_", " ");
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
          <h1>Automation <span>Center</span></h1>
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
          <Link href="/admin/tasks" className="navButton">Tasks</Link>
          <Link href="/admin/ai-command" className="navButton">AI Command</Link>
          <Link href="/admin/operations" className="navButton">Operations</Link>
          <Link href="/admin/audit-logs" className="navButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Rules Engine</p>
            <h1>Automation <span>Center</span></h1>
            <p className="subtitle">
              Create rules that convert safety, support, fraud, finance, loyalty and growth events into automated admin actions.
            </p>
          </div>

          <div className={metrics.automationScore >= 70 ? "autoOrb" : "autoOrb dangerOrb"}>
            <strong>{metrics.automationScore}</strong>
            <span>Automation Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="⚙️" label="Rules" value={String(metrics.total)} />
          <Metric icon="🟢" label="Active" value={String(metrics.active)} />
          <Metric icon="⏸️" label="Paused" value={String(metrics.paused)} />
          <Metric icon="🚫" label="Disabled" value={String(metrics.disabled)} />
          <Metric icon="🚨" label="Critical" value={String(metrics.critical)} />
          <Metric icon="▶️" label="Total Runs" value={String(metrics.totalRuns)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Create Rule</p>
            <h2>New Automation</h2>

            <label>Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Auto-create SOS task"
            />

            <label>Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what this rule does..."
            />

            <label>Trigger</label>
            <select value={trigger} onChange={(event) => setTrigger(event.target.value as AutomationTrigger)}>
              <option value="sos_created">SOS Created</option>
              <option value="user_reported">User Reported</option>
              <option value="driver_reports">Driver Gets Multiple Reports</option>
              <option value="trip_cancelled">Trip Cancelled</option>
              <option value="payment_failed">Payment Failed</option>
              <option value="refund_requested">Refund Requested</option>
              <option value="loyalty_tier">Loyalty Tier Reached</option>
              <option value="inactive_user">Inactive User</option>
              <option value="low_driver_supply">Low Driver Supply</option>
            </select>

            <label>Action</label>
            <select value={action} onChange={(event) => setAction(event.target.value as AutomationAction)}>
              <option value="create_task">Create Admin Task</option>
              <option value="send_notification">Send Notification</option>
              <option value="create_incident">Create Incident</option>
              <option value="create_audit_log">Create Audit Log</option>
              <option value="flag_user">Flag User</option>
              <option value="pause_user">Pause User</option>
              <option value="send_promo">Send Promo</option>
              <option value="escalate_admin">Escalate To Admin</option>
            </select>

            <label>Priority</label>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <label>Target Module</label>
            <select value={targetModule} onChange={(event) => setTargetModule(event.target.value)}>
              <option value="operations">Operations</option>
              <option value="safety">Safety</option>
              <option value="support">Support</option>
              <option value="fraud">Fraud</option>
              <option value="moderation">Moderation</option>
              <option value="finance">Finance</option>
              <option value="growth">Growth</option>
              <option value="loyalty">Loyalty</option>
            </select>

            <label>Condition</label>
            <input
              value={conditionText}
              onChange={(event) => setConditionText(event.target.value)}
              placeholder="Example: if user has 5 reports"
            />

            <label>Action Text</label>
            <textarea
              value={actionText}
              onChange={(event) => setActionText(event.target.value)}
              placeholder="Example: Create urgent task for operations team..."
            />

            <button onClick={createRule} disabled={saving}>
              {saving ? "Creating..." : "Create Automation"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Filters</p>
            <h2>Rules Queue</h2>

            <div className="filterGrid">
              {[
                ["all", "🌐 All"],
                ["active", "🟢 Active"],
                ["paused", "⏸️ Paused"],
                ["disabled", "🚫 Disabled"],
                ["critical", "🚨 Critical"],
                ["sos_created", "🚨 SOS"],
                ["refund_requested", "🔄 Refunds"],
                ["payment_failed", "💳 Payments"],
                ["support", "🎧 Support"],
                ["fraud", "🛡️ Fraud"],
              ].map(([key, text]) => (
                <button
                  key={key}
                  className={filter === key ? "filterButton activeFilter" : "filterButton"}
                  onClick={() => setFilter(key)}
                >
                  {text}
                </button>
              ))}
            </div>

            <div className="summaryBox">
              <strong>{filteredRules.length}</strong>
              <span>rules showing</span>
            </div>
          </section>
        </section>

        <section className="adminGrid">
          <section className="panel">
            <p className="eyebrow">Automation Rules</p>
            <h2>Rules Engine</h2>

            {filteredRules.length === 0 ? (
              <Empty text="No automation rules found." />
            ) : (
              <div className="ruleList">
                {filteredRules.map((rule) => (
                  <button
                    key={rule.id}
                    className={selected?.id === rule.id ? "ruleItem selected" : "ruleItem"}
                    onClick={() => setSelected(rule)}
                  >
                    <div>
                      <strong>{rule.name || "Automation Rule"}</strong>
                      <span>{label(rule.trigger)} → {label(rule.action)}</span>
                      <small>{rule.targetModule || "operations"} · {Number(rule.runCount || 0)} runs</small>
                    </div>

                    <div className="pillStack">
                      <em className={priorityClass(rule.priority)}>{rule.priority || "medium"}</em>
                      <em className={statusClass(rule.status)}>{rule.status || "active"}</em>
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
                    <p className="eyebrow">Selected Automation</p>
                    <h2>{selected.name || "Automation Rule"}</h2>
                    <p className="subtitle smallText">{selected.description || "No description provided."}</p>
                  </div>

                  <span className={statusClass(selected.status)}>{selected.status || "active"}</span>
                </div>

                <div className="flowBox">
                  <div>
                    <span>Trigger</span>
                    <strong>{label(selected.trigger)}</strong>
                  </div>
                  <div className="arrow">→</div>
                  <div>
                    <span>Action</span>
                    <strong>{label(selected.action)}</strong>
                  </div>
                </div>

                <div className="infoGrid">
                  <Info label="Rule ID" value={selected.id} />
                  <Info label="Status" value={selected.status || "active"} />
                  <Info label="Priority" value={selected.priority || "medium"} />
                  <Info label="Target Module" value={selected.targetModule || "operations"} />
                  <Info label="Condition" value={selected.conditionText || "No condition text"} />
                  <Info label="Action Text" value={selected.actionText || "No action text"} />
                  <Info label="Run Count" value={String(selected.runCount || 0)} />
                  <Info label="Last Run" value={formatDate(selected.lastRunAt)} />
                  <Info label="Created By" value={selected.createdBy || "System"} />
                  <Info label="Created" value={formatDate(selected.createdAt)} />
                </div>

                <div className="actionRow">
                  <button onClick={() => updateStatus(selected, "active")} disabled={processingId === selected.id}>
                    Activate
                  </button>

                  <button className="pauseButton" onClick={() => updateStatus(selected, "paused")} disabled={processingId === selected.id}>
                    Pause
                  </button>

                  <button className="dangerButton" onClick={() => updateStatus(selected, "disabled")} disabled={processingId === selected.id}>
                    Disable
                  </button>

                  <button className="testButton" onClick={() => testRun(selected)} disabled={processingId === selected.id}>
                    Test Run
                  </button>
                </div>
              </>
            ) : (
              <Empty text="Select an automation rule to view details." />
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

      h1 {
        margin: 0 0 16px;
        font-size: 60px;
        line-height: 1;
      }

      h1 span,
      h2,
      .metric strong,
      .autoOrb strong,
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

      .smallText {
        font-size: 15px;
        overflow-wrap: anywhere;
      }

      .autoOrb {
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

      .dangerOrb strong {
        color: #fca5a5;
      }

      .autoOrb strong {
        font-size: 42px;
      }

      .autoOrb span {
        color: #d4d4d8;
        font-weight: 900;
        font-size: 12px;
      }

      .message {
        color: #22c55e;
        text-align: center;
        font-weight: 900;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .metric {
        padding: 18px;
        border-radius: 22px;
      }

      .metricIcon {
        font-size: 24px;
        margin-bottom: 8px;
      }

      .metric span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .metric strong {
        font-size: 22px;
        overflow-wrap: anywhere;
      }

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

      option {
        color: black;
      }

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

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .filterGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }

      .filterButton {
        text-align: left;
        margin-top: 0;
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

      .ruleList {
        display: grid;
        gap: 12px;
      }

      .ruleItem {
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

      .ruleItem.selected {
        background: rgba(34,197,94,0.09);
        border-color: rgba(34,197,94,0.4);
      }

      .ruleItem strong,
      .ruleItem span,
      .ruleItem small {
        display: block;
        overflow-wrap: anywhere;
        text-transform: capitalize;
      }

      .ruleItem span,
      .ruleItem small {
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
      .disabled {
        color: #fca5a5;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .high,
      .paused {
        color: #fb923c;
        background: rgba(249,115,22,0.12);
        border: 1px solid rgba(249,115,22,0.35);
      }

      .medium {
        color: #fde68a;
        background: rgba(234,179,8,0.12);
        border: 1px solid rgba(234,179,8,0.35);
      }

      .low,
      .active {
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

      .flowBox {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 14px;
        align-items: center;
        padding: 18px;
        border-radius: 20px;
        background: rgba(34,197,94,0.08);
        border: 1px solid rgba(34,197,94,0.28);
        margin-bottom: 18px;
      }

      .flowBox span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .flowBox strong {
        display: block;
        text-transform: capitalize;
        overflow-wrap: anywhere;
      }

      .arrow {
        color: #22c55e;
        font-size: 28px;
        font-weight: 900;
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
        text-transform: capitalize;
      }

      .actionRow {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }

      .pauseButton {
        background: linear-gradient(135deg, #f59e0b, #b45309);
      }

      .dangerButton {
        background: linear-gradient(135deg, #ef4444, #991b1b);
      }

      .testButton {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
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

      .empty h3 {
        margin: 0 0 8px;
      }

      @media (max-width: 1050px) {
        .hero,
        .grid,
        .adminGrid,
        .detailsTop,
        .flowBox {
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

        h1 {
          font-size: 44px;
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

        .ruleItem {
          grid-template-columns: 1fr;
        }

        .pillStack {
          justify-content: flex-start;
        }
      }
    `}</style>
  );
    }
