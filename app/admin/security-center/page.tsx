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

type SecurityStatus = "safe" | "watch" | "suspicious" | "blocked";
type SecuritySeverity = "low" | "medium" | "high" | "critical";

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  admin?: boolean;
  adminRole?: string;
  suspended?: boolean;
  blocked?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
};

type SecurityEvent = {
  id: string;
  userId?: string;
  userEmail?: string;
  type?: string;
  device?: string;
  ip?: string;
  location?: string;
  status?: SecurityStatus | string;
  severity?: SecuritySeverity | string;
  details?: string;
  createdAt?: string;
  resolved?: boolean;
};

type SessionItem = {
  id: string;
  userId?: string;
  userEmail?: string;
  device?: string;
  browser?: string;
  ip?: string;
  location?: string;
  active?: boolean;
  trusted?: boolean;
  createdAt?: string;
  lastSeenAt?: string;
};

export default function AdminSecurityCenterPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [message, setMessage] = useState("Loading security center...");
  const [processingId, setProcessingId] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

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
            data.adminRole === "super_admin" ||
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
    currentUser?.adminRole === "super_admin" ||
    auth.currentUser?.email === "jesusfernandez515@gmail.com";

  useEffect(() => {
    if (!adminAllowed) return;

    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserProfile[]);
      setMessage("");
    });

    const unsubEvents = onSnapshot(query(collection(db, "securityEvents")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as SecurityEvent[];

      data.sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );

      setEvents(data);
      setSelectedEvent((current) => {
        if (!current) return data[0] || null;
        return data.find((item) => item.id === current.id) || data[0] || null;
      });
    });

    const unsubSessions = onSnapshot(query(collection(db, "sessions")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as SessionItem[];

      data.sort((a, b) =>
        String(b.lastSeenAt || b.createdAt || "").localeCompare(
          String(a.lastSeenAt || a.createdAt || "")
        )
      );

      setSessions(data);
    });

    return () => {
      unsubUsers();
      unsubEvents();
      unsubSessions();
    };
  }, [adminAllowed]);

  const metrics = useMemo(() => {
    const activeSessions = sessions.filter((item) => item.active !== false);
    const trustedDevices = sessions.filter((item) => item.trusted === true);
    const suspicious = events.filter(
      (item) =>
        item.status === "suspicious" ||
        item.severity === "high" ||
        item.severity === "critical"
    );
    const unresolved = events.filter((item) => !item.resolved);
    const blockedUsers = users.filter((item) => item.blocked || item.suspended);
    const adminUsers = users.filter(
      (item) => item.admin || item.role === "admin" || item.adminRole
    );

    const securityScore = Math.max(
      0,
      Math.min(
        100,
        100 -
          suspicious.length * 7 -
          unresolved.length * 3 -
          blockedUsers.length * 2 -
          Math.max(adminUsers.length - 5, 0) * 2
      )
    );

    return {
      users: users.length,
      events: events.length,
      activeSessions: activeSessions.length,
      trustedDevices: trustedDevices.length,
      suspicious: suspicious.length,
      unresolved: unresolved.length,
      blockedUsers: blockedUsers.length,
      adminUsers: adminUsers.length,
      securityScore,
    };
  }, [users, events, sessions]);

  const filteredEvents = useMemo(() => {
    const value = search.trim().toLowerCase();

    return events.filter((item) => {
      const matchesSearch =
        !value ||
        String(item.userEmail || "").toLowerCase().includes(value) ||
        String(item.type || "").toLowerCase().includes(value) ||
        String(item.device || "").toLowerCase().includes(value) ||
        String(item.ip || "").toLowerCase().includes(value) ||
        String(item.location || "").toLowerCase().includes(value) ||
        String(item.details || "").toLowerCase().includes(value) ||
        String(item.id || "").toLowerCase().includes(value);

      const matchesFilter =
        filter === "all" ||
        item.status === filter ||
        item.severity === filter ||
        item.type === filter ||
        (filter === "unresolved" && !item.resolved) ||
        (filter === "resolved" && item.resolved);

      return matchesSearch && matchesFilter;
    });
  }, [events, filter, search]);

  async function createDemoSecurityEvent() {
    try {
      setProcessingId("demo");
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "securityEvents"), {
        userEmail: auth.currentUser?.email || "",
        type: "manual_security_check",
        device: "Admin Console",
        ip: "Internal",
        location: "RoadLink Admin",
        status: "watch",
        severity: "medium",
        details: "Manual security check created from Security Center.",
        createdAt: now,
        resolved: false,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Security Event Created",
        targetType: "securityEvent",
        details: "Manual security event created.",
        severity: "warning",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: false,
      });

      setMessage("Security event created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create security event.");
    } finally {
      setProcessingId("");
    }
  }

  async function markResolved(event: SecurityEvent) {
    try {
      setProcessingId(event.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "securityEvents", event.id), {
        resolved: true,
        status: "safe",
        resolvedAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Security Event Resolved",
        targetType: "securityEvent",
        targetId: event.id,
        details: `${event.type || "Security event"} resolved.`,
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        userEmail: event.userEmail || "",
        createdAt: now,
        resolved: true,
      });

      setMessage("Security event resolved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not resolve event.");
    } finally {
      setProcessingId("");
    }
  }

  async function escalateEvent(event: SecurityEvent) {
    try {
      setProcessingId(event.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "securityEvents", event.id),
        {
          status: "suspicious",
          severity: "critical",
          resolved: false,
          escalatedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "adminTasks"), {
        title: `Security Review: ${event.userEmail || "Unknown user"}`,
        description: event.details || "Security event escalated for admin review.",
        category: "security",
        priority: "critical",
        status: "open",
        source: "security-center",
        sourceId: event.id,
        createdBy: auth.currentUser?.email || "",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "Security Event Escalated",
        targetType: "securityEvent",
        targetId: event.id,
        details: `${event.type || "Security event"} escalated to critical.`,
        severity: "critical",
        adminEmail: auth.currentUser?.email || "",
        userEmail: event.userEmail || "",
        createdAt: now,
        resolved: false,
      });

      setMessage("Security event escalated and task created.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not escalate event.");
    } finally {
      setProcessingId("");
    }
  }

  async function revokeSession(session: SessionItem) {
    try {
      setProcessingId(session.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "sessions", session.id), {
        active: false,
        trusted: false,
        revokedAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "securityEvents"), {
        userId: session.userId || "",
        userEmail: session.userEmail || "",
        type: "session_revoked",
        device: session.device || session.browser || "Unknown device",
        ip: session.ip || "",
        location: session.location || "",
        status: "blocked",
        severity: "medium",
        details: "Admin revoked this session from Security Center.",
        createdAt: now,
        resolved: true,
      });

      setMessage("Session revoked.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not revoke session.");
    } finally {
      setProcessingId("");
    }
  }

  function formatDate(value?: string) {
    if (!value) return "Not available";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function severityClass(value?: string) {
    if (value === "critical") return "pill critical";
    if (value === "high") return "pill high";
    if (value === "medium") return "pill medium";
    return "pill low";
  }

  function statusClass(value?: string, resolved?: boolean) {
    if (resolved) return "pill safe";
    if (value === "blocked") return "pill blocked";
    if (value === "suspicious") return "pill suspicious";
    if (value === "watch") return "pill watch";
    return "pill safe";
  }

  function label(value?: string) {
    return String(value || "not_available").replaceAll("_", " ");
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Security <span>Center</span></h1>
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
          <Link href="/admin/rbac" className="navButton">RBAC</Link>
          <Link href="/admin/audit-logs" className="navButton">Audit Logs</Link>
          <Link href="/admin/moderation" className="navButton">Moderation</Link>
          <Link href="/admin/system-health" className="navButton">System Health</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Security</p>
            <h1>Security <span>Center</span></h1>
            <p className="subtitle">
              Monitor suspicious logins, sessions, devices, admin access, security events and account risk.
            </p>
          </div>

          <div className={metrics.securityScore >= 80 ? "securityOrb" : "securityOrb dangerOrb"}>
            <strong>{metrics.securityScore}</strong>
            <span>Security Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(metrics.users)} />
          <Metric icon="🔐" label="Security Events" value={String(metrics.events)} />
          <Metric icon="🟢" label="Active Sessions" value={String(metrics.activeSessions)} />
          <Metric icon="✅" label="Trusted Devices" value={String(metrics.trustedDevices)} />
          <Metric icon="🚨" label="Suspicious" value={String(metrics.suspicious)} />
          <Metric icon="📌" label="Unresolved" value={String(metrics.unresolved)} />
          <Metric icon="🚫" label="Blocked Users" value={String(metrics.blockedUsers)} />
          <Metric icon="👑" label="Admin Users" value={String(metrics.adminUsers)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Security Filters</p>
            <h2>Event Search</h2>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search user, device, IP, location or details..."
            />

            <div className="filterGrid">
              {[
                ["all", "🌐 All"],
                ["unresolved", "📌 Unresolved"],
                ["resolved", "✅ Resolved"],
                ["critical", "🚨 Critical"],
                ["high", "🔥 High"],
                ["suspicious", "⚠️ Suspicious"],
                ["blocked", "🚫 Blocked"],
                ["safe", "🟢 Safe"],
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

            <button onClick={createDemoSecurityEvent} disabled={processingId === "demo"}>
              Create Test Security Event
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Active Sessions</p>
            <h2>Device Access</h2>

            {sessions.length === 0 ? (
              <Empty text="No active sessions found yet." />
            ) : (
              <div className="sessionList">
                {sessions.slice(0, 8).map((session) => (
                  <article key={session.id} className="sessionItem">
                    <div>
                      <strong>{session.userEmail || "Unknown user"}</strong>
                      <span>{session.device || session.browser || "Unknown device"}</span>
                      <small>{session.location || "Unknown location"} · {session.ip || "No IP"}</small>
                    </div>

                    <button onClick={() => revokeSession(session)} disabled={processingId === session.id}>
                      Revoke
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="adminGrid">
          <section className="panel">
            <p className="eyebrow">Security Events</p>
            <h2>{filteredEvents.length} Events</h2>

            {filteredEvents.length === 0 ? (
              <Empty text="No security events found." />
            ) : (
              <div className="eventList">
                {filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    className={selectedEvent?.id === event.id ? "eventItem selected" : "eventItem"}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div>
                      <strong>{label(event.type)}</strong>
                      <span>{event.userEmail || "Unknown user"}</span>
                      <small>{event.device || "Device unknown"} · {formatDate(event.createdAt)}</small>
                    </div>

                    <div className="pillStack">
                      <em className={severityClass(event.severity)}>{event.severity || "low"}</em>
                      <em className={statusClass(event.status, event.resolved)}>
                        {event.resolved ? "resolved" : event.status || "safe"}
                      </em>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            {selectedEvent ? (
              <>
                <div className="detailsTop">
                  <div>
                    <p className="eyebrow">Selected Event</p>
                    <h2>{label(selectedEvent.type)}</h2>
                    <p className="subtitle smallText">{selectedEvent.details || "No details provided."}</p>
                  </div>

                  <span className={severityClass(selectedEvent.severity)}>
                    {selectedEvent.severity || "low"}
                  </span>
                </div>

                <div className="infoGrid">
                  <Info label="Event ID" value={selectedEvent.id} />
                  <Info label="User Email" value={selectedEvent.userEmail || "Not available"} />
                  <Info label="User ID" value={selectedEvent.userId || "Not available"} />
                  <Info label="Type" value={label(selectedEvent.type)} />
                  <Info label="Status" value={selectedEvent.resolved ? "resolved" : selectedEvent.status || "safe"} />
                  <Info label="Severity" value={selectedEvent.severity || "low"} />
                  <Info label="Device" value={selectedEvent.device || "Not available"} />
                  <Info label="IP" value={selectedEvent.ip || "Not available"} />
                  <Info label="Location" value={selectedEvent.location || "Not available"} />
                  <Info label="Created" value={formatDate(selectedEvent.createdAt)} />
                </div>

                <div className="actionRow">
                  <button
                    onClick={() => markResolved(selectedEvent)}
                    disabled={processingId === selectedEvent.id}
                  >
                    Mark Safe
                  </button>

                  <button
                    className="dangerButton"
                    onClick={() => escalateEvent(selectedEvent)}
                    disabled={processingId === selectedEvent.id}
                  >
                    Escalate
                  </button>
                </div>
              </>
            ) : (
              <Empty text="Select a security event to review." />
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
          radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 35%),
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
      .securityOrb strong {
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

      .securityOrb {
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
      .securityOrb strong { font-size: 42px; }
      .securityOrb span { color: #d4d4d8; font-weight: 900; font-size: 12px; }

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

      input {
        width: 100%;
        padding: 15px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: white;
        font-size: 16px;
        outline: none;
      }

      button {
        width: 100%;
        margin-top: 14px;
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
        margin-top: 0;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .activeFilter {
        color: #22c55e;
        background: rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.35);
      }

      .eventList,
      .sessionList {
        display: grid;
        gap: 12px;
      }

      .eventItem,
      .sessionItem {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 16px;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        color: white;
        text-align: left;
      }

      .eventItem.selected {
        background: rgba(34,197,94,0.09);
        border-color: rgba(34,197,94,0.4);
      }

      .eventItem strong,
      .eventItem span,
      .eventItem small,
      .sessionItem strong,
      .sessionItem span,
      .sessionItem small {
        display: block;
        overflow-wrap: anywhere;
        text-transform: capitalize;
      }

      .eventItem span,
      .eventItem small,
      .sessionItem span,
      .sessionItem small {
        color: #a1a1aa;
        margin-top: 5px;
      }

      .sessionItem button {
        width: auto;
        padding: 10px 14px;
        margin-top: 0;
        background: linear-gradient(135deg, #ef4444, #991b1b);
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
      .blocked {
        color: #fca5a5;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .high,
      .suspicious {
        color: #fb923c;
        background: rgba(249,115,22,0.12);
        border: 1px solid rgba(249,115,22,0.35);
      }

      .medium,
      .watch {
        color: #fde68a;
        background: rgba(234,179,8,0.12);
        border: 1px solid rgba(234,179,8,0.35);
      }

      .low,
      .safe {
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
        text-transform: capitalize;
      }

      .actionRow {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
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

        .eventItem,
        .sessionItem {
          grid-template-columns: 1fr;
        }

        .pillStack {
          justify-content: flex-start;
        }

        .sessionItem button {
          width: 100%;
        }
      }
    `}</style>
  );
  }
