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

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  photoURL?: string;
  bio?: string;
  role?: string;
  admin?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  suspended?: boolean;
  blocked?: boolean;
  status?: string;
  createdAt?: any;
};

type Report = {
  id: string;
  reporterId?: string;
  reporterEmail?: string;
  reportedUserId?: string;
  reportedUserEmail?: string;
  targetId?: string;
  targetType?: string;
  reason?: string;
  details?: string;
  status?: string;
  priority?: string;
  createdAt?: any;
};

type ModerationCase = {
  id: string;
  userId?: string;
  userEmail?: string;
  reason?: string;
  status?: string;
  severity?: string;
  createdAt?: any;
};

type FilterKey = "all" | "flagged" | "reports" | "blocked" | "verified" | "clean";

export default function AdminModerationPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("Loading moderation center...");
  const [processingId, setProcessingId] = useState("");

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

    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as UserProfile[];

      setUsers(data);
      setSelected((current) => {
        if (!current) return data[0] || null;
        return data.find((item) => item.id === current.id) || data[0] || null;
      });
      setMessage("");
    });

    const unsubReports = onSnapshot(query(collection(db, "reports")), (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Report[]);
    });

    const unsubCases = onSnapshot(query(collection(db, "moderationCases")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as ModerationCase[];

      data.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      setCases(data);
    });

    return () => {
      unsubUsers();
      unsubReports();
      unsubCases();
    };
  }, [adminAllowed]);

  function clean(value?: string) {
    return String(value || "").toLowerCase();
  }

  function formatDate(value?: any) {
    if (!value) return "Not available";
    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return "Not available";
      return date.toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function userReports(user: UserProfile) {
    return reports.filter(
      (item) =>
        item.reportedUserId === user.id ||
        item.reportedUserEmail === user.email ||
        item.targetId === user.id
    );
  }

  function userCases(user: UserProfile) {
    return cases.filter((item) => item.userId === user.id || item.userEmail === user.email);
  }

  function getRisk(user: UserProfile) {
    const relatedReports = userReports(user);
    const relatedCases = userCases(user);

    let score = 0;
    const reasons: string[] = [];

    if (relatedReports.length > 0) {
      score += relatedReports.length * 18;
      reasons.push(`${relatedReports.length} report(s)`);
    }

    if (relatedCases.length > 0) {
      score += relatedCases.length * 12;
      reasons.push(`${relatedCases.length} moderation case(s)`);
    }

    if (user.suspended || user.blocked || clean(user.status) === "blocked") {
      score += 35;
      reasons.push("Account restricted");
    }

    if (!user.name || user.name.length < 2) {
      score += 10;
      reasons.push("Incomplete name");
    }

    if (!user.email) {
      score += 20;
      reasons.push("Missing email");
    }

    if (clean(user.bio).includes("cashapp") || clean(user.bio).includes("whatsapp")) {
      score += 15;
      reasons.push("Possible off-platform contact");
    }

    const moderationScore = Math.min(100, score);
    const level = moderationScore >= 70 ? "High" : moderationScore >= 35 ? "Medium" : "Low";

    return {
      score: moderationScore,
      level,
      reasons: reasons.length ? reasons : ["No major moderation signals"],
    };
  }

  const moderatedUsers = useMemo(() => {
    return users
      .map((user) => ({
        user,
        risk: getRisk(user),
        reports: userReports(user),
        cases: userCases(user),
      }))
      .filter((item) => {
        const text = search.trim().toLowerCase();

        const matchesSearch =
          !text ||
          clean(item.user.name).includes(text) ||
          clean(item.user.email).includes(text) ||
          clean(item.user.role).includes(text) ||
          clean(item.user.id).includes(text);

        const matchesFilter =
          filter === "all" ||
          (filter === "flagged" && item.risk.score >= 35) ||
          (filter === "reports" && item.reports.length > 0) ||
          (filter === "blocked" &&
            (item.user.blocked || item.user.suspended || clean(item.user.status) === "blocked")) ||
          (filter === "verified" && (item.user.verified || item.user.driverVerified)) ||
          (filter === "clean" && item.risk.score < 35);

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => b.risk.score - a.risk.score);
  }, [users, reports, cases, search, filter]);

  const metrics = useMemo(() => {
    const blocked = users.filter(
      (item) => item.blocked || item.suspended || clean(item.status) === "blocked"
    ).length;

    const verified = users.filter((item) => item.verified || item.driverVerified).length;
    const flagged = users.filter((item) => getRisk(item).score >= 35).length;
    const highRisk = users.filter((item) => getRisk(item).score >= 70).length;
    const openReports = reports.filter((item) => clean(item.status) !== "resolved").length;
    const resolvedCases = cases.filter((item) => clean(item.status) === "resolved").length;

    const safetyScore = Math.max(0, Math.min(100, 100 - flagged * 3 - highRisk * 5 - openReports * 2));

    return {
      users: users.length,
      flagged,
      highRisk,
      reports: reports.length,
      openReports,
      blocked,
      verified,
      cases: cases.length,
      resolvedCases,
      safetyScore,
    };
  }, [users, reports, cases]);

  async function createModerationCase(user: UserProfile, status: "open" | "resolved") {
    try {
      setProcessingId(user.id);
      setMessage("");

      const risk = getRisk(user);
      const now = new Date().toISOString();

      await addDoc(collection(db, "moderationCases"), {
        userId: user.id,
        userEmail: user.email || "",
        userName: user.name || "",
        reason: note.trim() || risk.reasons.join(", "),
        riskScore: risk.score,
        severity: risk.level.toLowerCase(),
        status,
        createdAt: now,
        updatedAt: now,
        adminEmail: auth.currentUser?.email || "",
      });

      await addDoc(collection(db, "auditLogs"), {
        action: status === "resolved" ? "Moderation Case Resolved" : "Moderation Case Opened",
        targetType: "moderationCase",
        targetId: user.id,
        details: note.trim() || risk.reasons.join(", "),
        severity: status === "resolved" ? "success" : risk.level === "High" ? "warning" : "info",
        adminEmail: auth.currentUser?.email || "",
        userEmail: user.email || "",
        createdAt: now,
        resolved: status === "resolved",
      });

      setNote("");
      setMessage(status === "resolved" ? "Moderation case resolved." : "Moderation case opened.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not create moderation case.");
    } finally {
      setProcessingId("");
    }
  }

  async function blockUser(user: UserProfile) {
    const confirmed = confirm(`Block ${user.email || user.id}?`);
    if (!confirmed) return;

    try {
      setProcessingId(user.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", user.id),
        {
          blocked: true,
          suspended: true,
          status: "blocked",
          blockedAt: now,
          blockedBy: auth.currentUser?.email || "",
          updatedAt: now,
        },
        { merge: true }
      );

      await createModerationCase(user, "open");

      await addDoc(collection(db, "notifications"), {
        userId: user.id,
        type: "moderation",
        title: "Account Under Review",
        message: "Your RoadLink account has been restricted while our team reviews community safety activity.",
        read: false,
        createdAt: now,
        actionUrl: "/support",
      });

      setMessage("User blocked.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not block user.");
    } finally {
      setProcessingId("");
    }
  }

  async function restoreUser(user: UserProfile) {
    try {
      setProcessingId(user.id);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "users", user.id), {
        blocked: false,
        suspended: false,
        status: "active",
        restoredAt: now,
        restoredBy: auth.currentUser?.email || "",
        updatedAt: now,
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "User Restored By Moderation",
        targetType: "user",
        targetId: user.id,
        details: note.trim() || "User restored from moderation center.",
        severity: "success",
        adminEmail: auth.currentUser?.email || "",
        userEmail: user.email || "",
        createdAt: now,
        resolved: true,
      });

      setNote("");
      setMessage("User restored.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not restore user.");
    } finally {
      setProcessingId("");
    }
  }

  function riskClass(level: string) {
    if (level === "High") return "risk high";
    if (level === "Medium") return "risk medium";
    return "risk low";
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Moderation <span>Center</span></h1>
          <p>{message || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <Styles />
      </main>
    );
  }

  const selectedRisk = selected ? getRisk(selected) : null;
  const selectedReports = selected ? userReports(selected) : [];
  const selectedCases = selected ? userCases(selected) : [];

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/fraud-center" className="navButton">Fraud</Link>
          <Link href="/admin/support-center" className="navButton">Support</Link>
          <Link href="/admin/disputes" className="navButton">Disputes</Link>
          <Link href="/admin/audit-logs" className="navButton">Audit Logs</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Community Safety</p>
            <h1>Moderation <span>Center</span></h1>
            <p className="subtitle">
              Review users, reports, names, profiles, bios, suspicious activity and community safety cases.
            </p>
          </div>

          <div className={metrics.safetyScore >= 75 ? "modOrb" : "modOrb dangerOrb"}>
            <strong>{metrics.safetyScore}</strong>
            <span>Safety Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(metrics.users)} />
          <Metric icon="🚩" label="Flagged" value={String(metrics.flagged)} />
          <Metric icon="🔥" label="High Risk" value={String(metrics.highRisk)} />
          <Metric icon="📢" label="Reports" value={String(metrics.reports)} />
          <Metric icon="📌" label="Open Reports" value={String(metrics.openReports)} />
          <Metric icon="🚫" label="Blocked" value={String(metrics.blocked)} />
          <Metric icon="✅" label="Verified" value={String(metrics.verified)} />
          <Metric icon="📁" label="Cases" value={String(metrics.cases)} />
        </section>

        <section className="controls">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, role or user ID..."
          />

          <div className="filterGrid">
            {[
              ["all", "🌐 All"],
              ["flagged", "🚩 Flagged"],
              ["reports", "📢 Reports"],
              ["blocked", "🚫 Blocked"],
              ["verified", "✅ Verified"],
              ["clean", "🟢 Clean"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "filterButton activeFilter" : "filterButton"}
                onClick={() => setFilter(key as FilterKey)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="adminGrid">
          <section className="panel">
            <p className="eyebrow">User Queue</p>
            <h2>{moderatedUsers.length} Users</h2>

            {moderatedUsers.length === 0 ? (
              <Empty text="No users found." />
            ) : (
              <div className="userList">
                {moderatedUsers.map((item) => (
                  <button
                    key={item.user.id}
                    className={selected?.id === item.user.id ? "userItem selected" : "userItem"}
                    onClick={() => setSelected(item.user)}
                  >
                    <div className="avatar">{(item.user.name || item.user.email || "U").charAt(0).toUpperCase()}</div>

                    <div>
                      <strong>{item.user.name || "RoadLink User"}</strong>
                      <span>{item.user.email || "No email"}</span>
                      <small>{item.risk.reasons.join(" · ")}</small>
                    </div>

                    <em className={riskClass(item.risk.level)}>
                      {item.risk.score}
                    </em>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            {selected && selectedRisk ? (
              <>
                <div className="detailsTop">
                  <div>
                    <p className="eyebrow">Selected Profile</p>
                    <h2>{selected.name || "RoadLink User"}</h2>
                    <p className="subtitle smallText">{selected.email || "No email"}</p>
                  </div>

                  <span className={riskClass(selectedRisk.level)}>
                    {selectedRisk.level} · {selectedRisk.score}
                  </span>
                </div>

                <div className="profileBox">
                  <div className="avatar big">{(selected.name || selected.email || "U").charAt(0).toUpperCase()}</div>
                  <div>
                    <strong>{selected.name || "No name"}</strong>
                    <p>{selected.bio || "No bio available."}</p>
                  </div>
                </div>

                <div className="reasonBox">
                  {selectedRisk.reasons.map((reason) => (
                    <span key={reason}>{reason}</span>
                  ))}
                </div>

                <div className="infoGrid">
                  <Info label="User ID" value={selected.id} />
                  <Info label="Email" value={selected.email || "Not available"} />
                  <Info label="Role" value={selected.role || "user"} />
                  <Info label="Verified" value={selected.verified || selected.driverVerified ? "Yes" : "No"} />
                  <Info label="Blocked" value={selected.blocked || selected.suspended ? "Yes" : "No"} />
                  <Info label="Status" value={selected.status || "active"} />
                  <Info label="Reports" value={String(selectedReports.length)} />
                  <Info label="Cases" value={String(selectedCases.length)} />
                  <Info label="Created" value={formatDate(selected.createdAt)} />
                  <Info label="Risk Score" value={`${selectedRisk.score}/100`} />
                </div>

                <label>Moderation Note</label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Write moderation note, review decision, or reason..."
                />

                <div className="actionRow">
                  <button onClick={() => createModerationCase(selected, "open")} disabled={processingId === selected.id}>
                    Open Case
                  </button>

                  <button className="goodButton" onClick={() => createModerationCase(selected, "resolved")} disabled={processingId === selected.id}>
                    Mark Safe
                  </button>

                  {selected.blocked || selected.suspended ? (
                    <button className="restoreButton" onClick={() => restoreUser(selected)} disabled={processingId === selected.id}>
                      Restore
                    </button>
                  ) : (
                    <button className="dangerButton" onClick={() => blockUser(selected)} disabled={processingId === selected.id}>
                      Block User
                    </button>
                  )}
                </div>

                <section className="subPanel">
                  <p className="eyebrow">Reports</p>
                  {selectedReports.length === 0 ? (
                    <p className="muted">No reports for this user.</p>
                  ) : (
                    selectedReports.map((report) => (
                      <div key={report.id} className="caseItem">
                        <strong>{report.reason || "Report"}</strong>
                        <p>{report.details || "No details provided."}</p>
                        <small>{formatDate(report.createdAt)}</small>
                      </div>
                    ))
                  )}
                </section>
              </>
            ) : (
              <Empty text="Select a user to review." />
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
          radial-gradient(circle at top right, rgba(239,68,68,0.20), transparent 35%),
          radial-gradient(circle at bottom left, rgba(34,197,94,0.14), transparent 35%),
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
      .controls,
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
      .modOrb strong {
        color: #22c55e;
      }

      .subtitle,
      .empty p,
      .locked p,
      .profileBox p,
      .muted,
      .caseItem p,
      .caseItem small {
        color: #a1a1aa;
        line-height: 1.5;
        margin: 0;
      }

      .smallText { font-size: 15px; overflow-wrap: anywhere; }

      .modOrb {
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
      .modOrb strong { font-size: 42px; }
      .modOrb span { color: #d4d4d8; font-weight: 900; font-size: 12px; }

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

      .controls {
        border-radius: 30px;
        padding: 22px;
        margin-bottom: 20px;
        display: grid;
        grid-template-columns: 1fr 1.4fr;
        gap: 14px;
        align-items: center;
      }

      input,
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

      textarea {
        min-height: 110px;
        resize: vertical;
      }

      label {
        display: block;
        margin: 14px 0 8px;
        font-weight: 900;
      }

      .filterGrid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }

      button {
        width: 100%;
        padding: 14px;
        border-radius: 999px;
        border: none;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      .activeFilter {
        color: #22c55e;
        background: rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.35);
      }

      button:disabled { opacity: 0.55; cursor: not-allowed; }

      .adminGrid {
        display: grid;
        grid-template-columns: 0.95fr 1.45fr;
        gap: 20px;
      }

      .panel {
        border-radius: 30px;
        padding: 30px;
        margin-bottom: 20px;
      }

      .userList { display: grid; gap: 12px; max-height: 760px; overflow: auto; padding-right: 4px; }

      .userItem {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 12px;
        align-items: center;
        text-align: left;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
      }

      .userItem.selected {
        background: rgba(34,197,94,0.09);
        border-color: rgba(34,197,94,0.4);
      }

      .avatar {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        font-size: 22px;
      }

      .avatar.big {
        width: 74px;
        height: 74px;
        font-size: 30px;
      }

      .userItem strong,
      .userItem span,
      .userItem small {
        display: block;
        overflow-wrap: anywhere;
      }

      .userItem span,
      .userItem small {
        color: #a1a1aa;
        margin-top: 4px;
      }

      .risk {
        padding: 8px 11px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        white-space: nowrap;
        font-style: normal;
      }

      .risk.high {
        color: #fca5a5;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .risk.medium {
        color: #fde68a;
        background: rgba(234,179,8,0.12);
        border: 1px solid rgba(234,179,8,0.35);
      }

      .risk.low {
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

      .profileBox {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 16px;
        align-items: center;
        padding: 18px;
        border-radius: 20px;
        background: rgba(34,197,94,0.08);
        border: 1px solid rgba(34,197,94,0.28);
        margin-bottom: 16px;
      }

      .profileBox strong {
        display: block;
        color: white;
        margin-bottom: 6px;
      }

      .reasonBox {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      }

      .reasonBox span {
        padding: 8px 11px;
        border-radius: 999px;
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.3);
        color: #fecaca;
        font-size: 13px;
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
      }

      .actionRow {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-top: 14px;
      }

      .actionRow button {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border: none;
      }

      .goodButton,
      .restoreButton {
        background: linear-gradient(135deg, #22c55e, #16a34a) !important;
      }

      .dangerButton {
        background: linear-gradient(135deg, #ef4444, #991b1b) !important;
      }

      .subPanel {
        margin-top: 20px;
        padding: 18px;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .caseItem {
        padding: 13px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
        margin-top: 10px;
      }

      .caseItem strong {
        display: block;
        margin-bottom: 5px;
      }

      .caseItem small {
        display: block;
        margin-top: 6px;
        font-size: 12px;
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
        .controls,
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
        .panel,
        .controls {
          padding: 22px;
          border-radius: 26px;
        }

        .userItem,
        .profileBox {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
      }
