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

type IncidentSeverity = "low" | "medium" | "high" | "critical";
type IncidentStatus = "open" | "investigating" | "resolved" | "monitoring";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type Incident = {
  id: string;
  title?: string;
  description?: string;
  service?: string;
  severity?: IncidentSeverity | string;
  status?: IncidentStatus | string;
  assignedTo?: string;
  reportedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
};

export default function AdminIncidentCenterPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [message, setMessage] = useState("Loading incident center...");
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [filter, setFilter] = useState("all");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [service, setService] = useState("Firestore");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [assignedTo, setAssignedTo] = useState("");

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
      query(collection(db, "incidents")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Incident[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setIncidents(data);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, [adminAllowed]);

  const metrics = useMemo(() => {
    const open = incidents.filter((item) => item.status === "open");
    const investigating = incidents.filter((item) => item.status === "investigating");
    const monitoring = incidents.filter((item) => item.status === "monitoring");
    const resolved = incidents.filter((item) => item.status === "resolved");
    const critical = incidents.filter((item) => item.severity === "critical");
    const high = incidents.filter((item) => item.severity === "high");

    const healthScore = Math.max(
      0,
      Math.min(
        100,
        100 -
          open.length * 6 -
          investigating.length * 4 -
          monitoring.length * 2 -
          critical.length * 10 -
          high.length * 6
      )
    );

    return {
      total: incidents.length,
      open: open.length,
      investigating: investigating.length,
      monitoring: monitoring.length,
      resolved: resolved.length,
      critical: critical.length,
      high: high.length,
      healthScore,
    };
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    if (filter === "all") return incidents;
    if (filter === "active") {
      return incidents.filter((item) =>
        ["open", "investigating", "monitoring"].includes(String(item.status || ""))
      );
    }

    return incidents.filter(
      (item) => item.status === filter || item.severity === filter || item.service === filter
    );
  }, [incidents, filter]);

  async function createIncident() {
    if (!title.trim()) {
      setMessage("Incident title is required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "incidents"), {
        title: title.trim(),
        description: description.trim(),
        service,
        severity,
        status: "open",
        assignedTo: assignedTo.trim(),
        reportedBy: auth.currentUser?.email || "",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Incident Created",
        targetType: "incident",
        details: `${title} created for ${service}.`,
        severity: severity === "critical" ? "critical" : "warning",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: false,
      });

      await addDoc(collection(db, "notifications"), {
        type: "incident",
        title: "Incident Created",
        message: `${title} was reported in ${service}.`,
        read: false,
        createdAt: now,
        actionUrl: "/admin/incident-center",
      });

      setTitle("");
      setDescription("");
      setService("Firestore");
      setSeverity("medium");
      setAssignedTo("");
      setMessage("Incident created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create incident.");
    } finally {
      setSaving(false);
    }
  }

  async function updateIncidentStatus(id: string, nextStatus: IncidentStatus) {
    try {
      setProcessingId(id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "incidents", id), {
        status: nextStatus,
        updatedAt: now,
        ...(nextStatus === "resolved" ? { resolvedAt: now } : {}),
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Incident Status Updated",
        targetId: id,
        targetType: "incident",
        details: `Incident moved to ${nextStatus}.`,
        severity: nextStatus === "resolved" ? "success" : "warning",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: nextStatus === "resolved",
      });

      setMessage(`Incident marked as ${nextStatus}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update incident.");
    } finally {
      setProcessingId("");
    }
  }

  async function escalateIncident(incident: Incident) {
    try {
      setProcessingId(incident.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "incidents", incident.id),
        {
          severity: "critical",
          status: "investigating",
          updatedAt: now,
          escalatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "auditLogs"), {
        action: "Incident Escalated",
        targetId: incident.id,
        targetType: "incident",
        details: `${incident.title || "Incident"} escalated to critical.`,
        severity: "critical",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: false,
      });

      setMessage("Incident escalated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not escalate incident.");
    } finally {
      setProcessingId("");
    }
  }

  function severityClass(value?: string) {
    if (value === "critical") return "pill critical";
    if (value === "high") return "pill high";
    if (value === "medium") return "pill medium";
    return "pill low";
  }

  function statusClass(value?: string) {
    if (value === "resolved") return "pill resolved";
    if (value === "investigating") return "pill investigating";
    if (value === "monitoring") return "pill monitoring";
    return "pill open";
  }

  function formatDate(value?: string) {
    if (!value) return "Recently";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Recently";
    }
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Incident <span>Center</span></h1>
          <p>{message || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <PageStyles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/system-health" className="navButton">System Health</Link>
          <Link href="/admin/audit-logs" className="navButton">Audit Logs</Link>
          <Link href="/admin/fraud-center" className="navButton">Fraud Center</Link>
          <Link href="/admin/analytics" className="navButton">Analytics</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Operations</p>
            <h1>Incident <span>Center</span></h1>
            <p className="subtitle">
              Create, track, investigate and resolve RoadLink incidents across Firestore,
              Auth, Stripe, SOS, chat, maps, bookings and platform operations.
            </p>
          </div>

          <div className={metrics.healthScore >= 75 ? "scoreOrb" : "scoreOrb dangerOrb"}>
            <strong>{metrics.healthScore}</strong>
            <span>Health Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📚" label="Total" value={String(metrics.total)} />
          <Metric icon="🔥" label="Open" value={String(metrics.open)} />
          <Metric icon="🔍" label="Investigating" value={String(metrics.investigating)} />
          <Metric icon="👁️" label="Monitoring" value={String(metrics.monitoring)} />
          <Metric icon="✅" label="Resolved" value={String(metrics.resolved)} />
          <Metric icon="🚨" label="Critical" value={String(metrics.critical)} />
          <Metric icon="⚠️" label="High" value={String(metrics.high)} />
          <Metric icon="📈" label="Health" value={`${metrics.healthScore}/100`} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Create Incident</p>
            <h2>New Operational Incident</h2>

            <label>Incident Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Stripe payout delays"
            />

            <label>Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what happened..."
            />

            <label>Service</label>
            <select value={service} onChange={(event) => setService(event.target.value)}>
              <option value="Firestore">Firestore</option>
              <option value="Firebase Auth">Firebase Auth</option>
              <option value="Firebase Storage">Firebase Storage</option>
              <option value="Google Maps">Google Maps</option>
              <option value="Stripe">Stripe</option>
              <option value="Notifications">Notifications</option>
              <option value="Chat">Chat</option>
              <option value="SOS">SOS</option>
              <option value="Bookings">Bookings</option>
              <option value="Wallet">Wallet</option>
            </select>

            <label>Severity</label>
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <label>Assigned To</label>
            <input
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              placeholder="Admin or team member"
            />

            <button onClick={createIncident} disabled={saving}>
              {saving ? "Creating..." : "Create Incident"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Filters</p>
            <h2>Incident Timeline</h2>

            <div className="filterGrid">
              {[
                ["all", "🌐 All"],
                ["active", "🔥 Active"],
                ["open", "🟠 Open"],
                ["investigating", "🔍 Investigating"],
                ["monitoring", "👁️ Monitoring"],
                ["resolved", "✅ Resolved"],
                ["critical", "🚨 Critical"],
                ["high", "⚠️ High"],
                ["Stripe", "💳 Stripe"],
                ["SOS", "🚨 SOS"],
                ["Bookings", "🎟️ Bookings"],
                ["Chat", "💬 Chat"],
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
              <strong>{filteredIncidents.length}</strong>
              <span>incidents showing</span>
            </div>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Incident Records</p>
          <h2>Operational Timeline</h2>

          {filteredIncidents.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🩺</div>
              <h3>No incidents found</h3>
              <p>System incidents and operational events will appear here.</p>
            </div>
          ) : (
            <div className="list">
              {filteredIncidents.map((incident) => (
                <article key={incident.id} className="incidentCard">
                  <div className="incidentTop">
                    <div>
                      <h3>{incident.title || "Operational Incident"}</h3>
                      <p>{incident.description || "No description provided."}</p>
                    </div>

                    <div className="pillGroup">
                      <span className={severityClass(incident.severity)}>
                        {incident.severity || "medium"}
                      </span>
                      <span className={statusClass(incident.status)}>
                        {incident.status || "open"}
                      </span>
                    </div>
                  </div>

                  <div className="infoGrid">
                    <Info label="Service" value={incident.service || "Unknown"} />
                    <Info label="Assigned To" value={incident.assignedTo || "Unassigned"} />
                    <Info label="Reported By" value={incident.reportedBy || "System"} />
                    <Info label="Created" value={formatDate(incident.createdAt)} />
                    <Info label="Updated" value={formatDate(incident.updatedAt)} />
                    <Info label="Resolved" value={incident.resolvedAt ? formatDate(incident.resolvedAt) : "Not resolved"} />
                  </div>

                  <div className="actions">
                    <button
                      onClick={() => updateIncidentStatus(incident.id, "investigating")}
                      disabled={processingId === incident.id}
                    >
                      Investigating
                    </button>

                    <button
                      onClick={() => updateIncidentStatus(incident.id, "monitoring")}
                      disabled={processingId === incident.id}
                    >
                      Monitoring
                    </button>

                    <button
                      className="goodButton"
                      onClick={() => updateIncidentStatus(incident.id, "resolved")}
                      disabled={processingId === incident.id}
                    >
                      Resolve
                    </button>

                    <button
                      className="dangerButton"
                      onClick={() => escalateIncident(incident)}
                      disabled={processingId === incident.id}
                    >
                      Escalate
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <PageStyles />
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

function PageStyles() {
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
          radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 35%),
          radial-gradient(circle at bottom left, rgba(34,197,94,0.13), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container {
        max-width: 1180px;
        margin: auto;
      }

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
      .incidentCard,
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
      .scoreOrb strong {
        color: #22c55e;
      }

      .subtitle,
      .incidentTop p,
      .locked p,
      .empty p {
        color: #a1a1aa;
        max-width: 780px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .scoreOrb {
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

      .scoreOrb strong {
        font-size: 42px;
      }

      .scoreOrb span {
        color: #d4d4d8;
        font-weight: 900;
      }

      .message {
        color: #22c55e;
        font-weight: 900;
        text-align: center;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
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

      .grid {
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
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.06);
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
        color: #22c55e;
        font-size: 34px;
      }

      .summaryBox span {
        color: #a1a1aa;
        font-weight: 900;
      }

      .list {
        display: grid;
        gap: 16px;
      }

      .incidentCard {
        border-radius: 26px;
        padding: 22px;
        box-shadow: none;
      }

      .incidentTop {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 16px;
      }

      .incidentTop h3 {
        margin: 0 0 8px;
        font-size: 22px;
        overflow-wrap: anywhere;
      }

      .pillGroup {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }

      .pill {
        padding: 8px 11px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        text-transform: capitalize;
        white-space: nowrap;
      }

      .critical,
      .open {
        color: #fca5a5;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .high,
      .investigating {
        color: #fb923c;
        background: rgba(249,115,22,0.12);
        border: 1px solid rgba(249,115,22,0.35);
      }

      .medium,
      .monitoring {
        color: #fde68a;
        background: rgba(234,179,8,0.12);
        border: 1px solid rgba(234,179,8,0.35);
      }

      .low,
      .resolved {
        color: #86efac;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
      }

      .infoGrid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 14px;
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
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }

      .goodButton {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border: none;
      }

      .dangerButton {
        background: linear-gradient(135deg, #ef4444, #991b1b);
        border: none;
      }

      .empty {
        min-height: 220px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      
      .emptyIcon {
        width: 82px;
        height: 82px;
        border-radius: 50%;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 38px;
        margin-bottom: 16px;
      }

      @media (max-width: 1000px) {
        .hero,
        .grid,
        .incidentTop {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats,
        .infoGrid,
        .actions,
        .filterGrid {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 44px;
        }

        .pillGroup {
          justify-content: flex-start;
        }
      }

      @media (max-width: 600px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero,
        .panel,
        .incidentCard {
          padding: 22px;
          border-radius: 26px;
        }
      }
    `}</style>
  );
}
