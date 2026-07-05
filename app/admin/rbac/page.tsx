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

type AdminRole =
  | "super_admin"
  | "admin"
  | "operations"
  | "support"
  | "finance"
  | "marketing"
  | "safety"
  | "viewer";

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  admin?: boolean;
  adminRole?: AdminRole | string;
  suspended?: boolean;
  createdAt?: string;
};

type PermissionProfile = {
  id: string;
  userId?: string;
  userEmail?: string;
  role?: AdminRole | string;
  modules?: string[];
  actions?: string[];
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

const MODULES = [
  "admin-console",
  "analytics",
  "operations",
  "users",
  "rides",
  "bookings",
  "support",
  "disputes",
  "fraud",
  "moderation",
  "sos",
  "finance",
  "revenue",
  "payouts",
  "refunds",
  "marketing",
  "campaigns",
  "loyalty",
  "tasks",
  "automations",
  "system-health",
  "audit-logs",
];

const ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "approve",
  "reject",
  "refund",
  "payout",
  "suspend",
  "restore",
  "export",
  "execute",
];

const ROLE_PRESETS: Record<AdminRole, { modules: string[]; actions: string[] }> = {
  super_admin: { modules: MODULES, actions: ACTIONS },
  admin: {
    modules: MODULES.filter((item) => item !== "automations"),
    actions: ACTIONS.filter((item) => item !== "delete"),
  },
  operations: {
    modules: ["admin-console", "operations", "rides", "bookings", "tasks", "support", "system-health"],
    actions: ["view", "create", "update", "execute"],
  },
  support: {
    modules: ["admin-console", "support", "disputes", "users", "tasks", "moderation"],
    actions: ["view", "create", "update", "restore"],
  },
  finance: {
    modules: ["admin-console", "finance", "revenue", "payouts", "refunds", "audit-logs"],
    actions: ["view", "update", "approve", "reject", "refund", "payout", "export"],
  },
  marketing: {
    modules: ["admin-console", "marketing", "campaigns", "loyalty", "analytics"],
    actions: ["view", "create", "update", "export"],
  },
  safety: {
    modules: ["admin-console", "sos", "fraud", "moderation", "incidents", "audit-logs", "tasks"],
    actions: ["view", "create", "update", "suspend", "restore", "execute"],
  },
  viewer: {
    modules: ["admin-console", "analytics", "revenue", "system-health"],
    actions: ["view", "export"],
  },
};

export default function AdminRBACPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState("Loading RBAC center...");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState("");
  const [role, setRole] = useState<AdminRole>("viewer");
  const [modules, setModules] = useState<string[]>(ROLE_PRESETS.viewer.modules);
  const [actions, setActions] = useState<string[]>(ROLE_PRESETS.viewer.actions);
  const [active, setActive] = useState(true);

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

          setMessage(allowed ? "" : "Access denied. Super admin required.");
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
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as UserProfile[];

      data.sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")));

      setUsers(data);
      setSelectedUser((current) => {
        if (!current) return data[0] || null;
        return data.find((item) => item.id === current.id) || data[0] || null;
      });
      setMessage("");
    });

    const unsubProfiles = onSnapshot(query(collection(db, "adminPermissions")), (snapshot) => {
      setProfiles(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PermissionProfile[]);
    });

    return () => {
      unsubUsers();
      unsubProfiles();
    };
  }, [adminAllowed]);

  const selectedProfile = useMemo(() => {
    if (!selectedUser) return null;
    return profiles.find(
      (item) => item.userId === selectedUser.id || item.userEmail === selectedUser.email
    );
  }, [profiles, selectedUser]);

  useEffect(() => {
    if (!selectedUser) return;

    const profile = profiles.find(
      (item) => item.userId === selectedUser.id || item.userEmail === selectedUser.email
    );

    const nextRole = (profile?.role || selectedUser.adminRole || selectedUser.role || "viewer") as AdminRole;
    const safeRole = ROLE_PRESETS[nextRole] ? nextRole : "viewer";

    setRole(safeRole);
    setModules(profile?.modules || ROLE_PRESETS[safeRole].modules);
    setActions(profile?.actions || ROLE_PRESETS[safeRole].actions);
    setActive(profile?.active !== false);
  }, [selectedUser, profiles]);

  const metrics = useMemo(() => {
    const admins = profiles.filter((item) => item.active !== false);
    const superAdmins = profiles.filter((item) => item.role === "super_admin");
    const finance = profiles.filter((item) => item.role === "finance");
    const support = profiles.filter((item) => item.role === "support");
    const viewers = profiles.filter((item) => item.role === "viewer");
    const inactive = profiles.filter((item) => item.active === false);

    const securityScore = Math.max(
      0,
      Math.min(100, 100 - superAdmins.length * 3 - inactive.length * 2 + (profiles.length > 0 ? 5 : 0))
    );

    return {
      users: users.length,
      permissionProfiles: profiles.length,
      activeAdmins: admins.length,
      superAdmins: superAdmins.length,
      finance: finance.length,
      support: support.length,
      viewers: viewers.length,
      inactive: inactive.length,
      securityScore,
    };
  }, [users, profiles]);

  const filteredUsers = useMemo(() => {
    const value = search.trim().toLowerCase();

    return users.filter((user) => {
      const profile = profiles.find(
        (item) => item.userId === user.id || item.userEmail === user.email
      );

      return (
        !value ||
        String(user.name || "").toLowerCase().includes(value) ||
        String(user.email || "").toLowerCase().includes(value) ||
        String(user.role || "").toLowerCase().includes(value) ||
        String(user.adminRole || "").toLowerCase().includes(value) ||
        String(profile?.role || "").toLowerCase().includes(value)
      );
    });
  }, [users, profiles, search]);

  function applyPreset(nextRole: AdminRole) {
    setRole(nextRole);
    setModules(ROLE_PRESETS[nextRole].modules);
    setActions(ROLE_PRESETS[nextRole].actions);
  }

  function toggleItem(value: string, list: string[], setList: (items: string[]) => void) {
    if (list.includes(value)) {
      setList(list.filter((item) => item !== value));
    } else {
      setList([...list, value]);
    }
  }

  async function savePermissions() {
    if (!selectedUser) return;

    try {
      setSavingId(selectedUser.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "adminPermissions", selectedUser.id),
        {
          userId: selectedUser.id,
          userEmail: selectedUser.email || "",
          role,
          modules,
          actions,
          active,
          updatedAt: now,
          updatedBy: auth.currentUser?.email || "",
          createdAt: selectedProfile?.createdAt || now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", selectedUser.id),
        {
          admin: role !== "viewer" && active,
          adminRole: role,
          role: role === "viewer" ? selectedUser.role || "user" : "admin",
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, "auditLogs"), {
        action: "Admin Permissions Updated",
        targetType: "adminPermissions",
        targetId: selectedUser.id,
        userEmail: selectedUser.email || "",
        details: `${selectedUser.email || selectedUser.id} set to ${role}.`,
        severity: role === "super_admin" ? "warning" : "success",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });

      setMessage("Permissions saved successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save permissions.");
    } finally {
      setSavingId("");
    }
  }

  function roleLabel(value?: string) {
    return String(value || "viewer").replaceAll("_", " ");
  }

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>RBAC <span>Center</span></h1>
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
          <Link href="/admin/users" className="navButton">Users</Link>
          <Link href="/admin/audit-logs" className="navButton">Audit Logs</Link>
          <Link href="/admin/security" className="navButton">Security</Link>
          <Link href="/admin/settings" className="navButton">Settings</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Security</p>
            <h1>RBAC <span>Center</span></h1>
            <p className="subtitle">
              Control admin roles, module access, permissions and action-level security across the whole RoadLink Admin Console.
            </p>
          </div>

          <div className={metrics.securityScore >= 80 ? "roleOrb" : "roleOrb dangerOrb"}>
            <strong>{metrics.securityScore}</strong>
            <span>Security Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(metrics.users)} />
          <Metric icon="🔐" label="Permission Profiles" value={String(metrics.permissionProfiles)} />
          <Metric icon="🟢" label="Active Admins" value={String(metrics.activeAdmins)} />
          <Metric icon="👑" label="Super Admins" value={String(metrics.superAdmins)} />
          <Metric icon="💰" label="Finance" value={String(metrics.finance)} />
          <Metric icon="🎧" label="Support" value={String(metrics.support)} />
          <Metric icon="👁️" label="Viewers" value={String(metrics.viewers)} />
          <Metric icon="🚫" label="Inactive" value={String(metrics.inactive)} />
        </section>

        <section className="adminGrid">
          <section className="panel">
            <p className="eyebrow">Admin Users</p>
            <h2>User Access</h2>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search user, email or role..."
            />

            <div className="userList">
              {filteredUsers.map((user) => {
                const profile = profiles.find(
                  (item) => item.userId === user.id || item.userEmail === user.email
                );

                return (
                  <button
                    key={user.id}
                    className={selectedUser?.id === user.id ? "userItem selected" : "userItem"}
                    onClick={() => setSelectedUser(user)}
                  >
                    <div className="avatar">
                      {(user.name || user.email || "U").charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <strong>{user.name || "RoadLink User"}</strong>
                      <span>{user.email || "No email"}</span>
                      <small>{roleLabel(profile?.role || user.adminRole || user.role)}</small>
                    </div>

                    <em className={profile?.active === false ? "pill inactive" : "pill active"}>
                      {profile?.active === false ? "inactive" : "active"}
                    </em>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel">
            {selectedUser ? (
              <>
                <div className="detailsTop">
                  <div>
                    <p className="eyebrow">Selected User</p>
                    <h2>{selectedUser.name || "RoadLink User"}</h2>
                    <p className="subtitle smallText">{selectedUser.email || "No email"}</p>
                  </div>

                  <span className={active ? "pill active" : "pill inactive"}>
                    {active ? "active" : "inactive"}
                  </span>
                </div>

                <label>Role Preset</label>
                <select value={role} onChange={(event) => applyPreset(event.target.value as AdminRole)}>
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="operations">Operations</option>
                  <option value="support">Support</option>
                  <option value="finance">Finance</option>
                  <option value="marketing">Marketing</option>
                  <option value="safety">Safety</option>
                  <option value="viewer">Viewer</option>
                </select>

                <button
                  className={active ? "dangerButton" : "goodButton"}
                  onClick={() => setActive(!active)}
                >
                  {active ? "Disable Access" : "Enable Access"}
                </button>

                <section className="accessBox">
                  <p className="eyebrow">Modules</p>
                  <div className="checkGrid">
                    {MODULES.map((item) => (
                      <button
                        key={item}
                        className={modules.includes(item) ? "check activeCheck" : "check"}
                        onClick={() => toggleItem(item, modules, setModules)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="accessBox">
                  <p className="eyebrow">Actions</p>
                  <div className="checkGrid">
                    {ACTIONS.map((item) => (
                      <button
                        key={item}
                        className={actions.includes(item) ? "check activeCheck" : "check"}
                        onClick={() => toggleItem(item, actions, setActions)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </section>

                <div className="infoGrid">
                  <Info label="User ID" value={selectedUser.id} />
                  <Info label="Current Role" value={roleLabel(role)} />
                  <Info label="Modules" value={String(modules.length)} />
                  <Info label="Actions" value={String(actions.length)} />
                  <Info label="Profile Active" value={active ? "Yes" : "No"} />
                  <Info label="Updated By" value={selectedProfile?.updatedBy || "Not available"} />
                </div>

                <button onClick={savePermissions} disabled={savingId === selectedUser.id}>
                  {savingId === selectedUser.id ? "Saving..." : "Save Permissions"}
                </button>
              </>
            ) : (
              <div className="empty">
                <h3>Select a user</h3>
                <p>Choose a user to manage admin permissions.</p>
              </div>
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

      .topBar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }

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
      .roleOrb strong {
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

      .roleOrb {
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
      .roleOrb strong { font-size: 42px; }
      .roleOrb span { color: #d4d4d8; font-weight: 900; font-size: 12px; }

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

      option { color: black; }

      label {
        display: block;
        margin: 14px 0 8px;
        font-weight: 900;
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

      .userList {
        display: grid;
        gap: 12px;
        margin-top: 16px;
        max-height: 780px;
        overflow: auto;
        padding-right: 4px;
      }

      .userItem {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 12px;
        align-items: center;
        text-align: left;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        margin-top: 0;
      }

      .userItem.selected {
        background: rgba(34,197,94,0.09);
        border-color: rgba(34,197,94,0.4);
      }

      .avatar {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
      }

      .userItem strong,
      .userItem span,
      .userItem small {
        display: block;
        overflow-wrap: anywhere;
        text-transform: capitalize;
      }

      .userItem span,
      .userItem small {
        color: #a1a1aa;
        margin-top: 4px;
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

      .active {
        color: #86efac;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
      }

      .inactive {
        color: #fca5a5;
        background: rgba(239,68,68,0.12);
        border: 1px solid rgba(239,68,68,0.35);
      }

      .detailsTop {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 20px;
      }

      .dangerButton {
        background: linear-gradient(135deg, #ef4444, #991b1b);
      }

      .goodButton {
        background: linear-gradient(135deg, #22c55e, #16a34a);
      }

      .accessBox {
        margin-top: 18px;
        padding: 18px;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .checkGrid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }

      .check {
        margin-top: 0;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        text-transform: capitalize;
      }

      .activeCheck {
        color: #22c55e;
        background: rgba(34,197,94,0.12);
        border-color: rgba(34,197,94,0.35);
      }

      .infoGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin: 18px 0;
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

      .empty {
        min-height: 320px;
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
        .adminGrid,
        .detailsTop {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats,
        .infoGrid,
        .checkGrid {
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

        .userItem {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
      }
