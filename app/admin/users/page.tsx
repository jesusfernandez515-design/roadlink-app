"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  photoURL?: string;
  city?: string;
  state?: string;
  verified?: boolean;
  driverVerified?: boolean;
  licenseVerified?: boolean;
  suspended?: boolean;
  verificationStatus?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading users...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as UserProfile[];

        data.sort((a, b) =>
          String(b.createdAt || b.updatedAt || "").localeCompare(
            String(a.createdAt || a.updatedAt || "")
          )
        );

        setUsers(data);

        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((user) => user.id === current.id) || data[0] || null;
        });

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribe();
  }, []);

  const filteredUsers = useMemo(() => {
    const text = search.toLowerCase().trim();

    if (!text) return users;

    return users.filter((user) => {
      return (
        user.name?.toLowerCase().includes(text) ||
        user.email?.toLowerCase().includes(text) ||
        user.role?.toLowerCase().includes(text) ||
        user.city?.toLowerCase().includes(text) ||
        user.state?.toLowerCase().includes(text)
      );
    });
  }, [users, search]);

  const totalUsers = users.length;
  const verifiedDrivers = users.filter((user) => user.driverVerified).length;
  const suspendedUsers = users.filter((user) => user.suspended).length;
  const members = users.filter((user) => user.role === "member").length;

  async function updateUser(user: UserProfile, updates: Partial<UserProfile>) {
    try {
      setLoadingId(user.id);
      setMessage("");

      await setDoc(
        doc(db, "users", user.id),
        {
          ...updates,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage("User updated successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  function dateText(value?: string) {
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
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/admin/verifications" className="miniButton">Verifications</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>User <span>Management</span></h1>
            <p className="subtitle">
              View users, manage roles, verify drivers, and suspend unsafe accounts.
            </p>
          </div>

          <div className="heroIcon">👥</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👤" label="Total Users" value={String(totalUsers)} />
          <Metric icon="✅" label="Verified Drivers" value={String(verifiedDrivers)} />
          <Metric icon="🧑‍💼" label="Members" value={String(members)} />
          <Metric icon="⛔" label="Suspended" value={String(suspendedUsers)} />
        </section>

        <section className="adminGrid">
          <div className="usersCard">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Users</p>
                <h2>Accounts</h2>
              </div>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users..."
              className="searchInput"
            />

            {filteredUsers.length === 0 ? (
              <div className="empty">
                <h3>No users found</h3>
                <p>Try searching by name, email, role, city or state.</p>
              </div>
            ) : (
              <div className="userList">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    className={selected?.id === user.id ? "userButton activeUser" : "userButton"}
                    onClick={() => setSelected(user)}
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.name || "User"} className="avatarImage" />
                    ) : (
                      <div className="avatar">
                        {(user.name || user.email || "R").charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <strong>{user.name || "RoadLink User"}</strong>
                      <span>{user.email || "No email"}</span>
                    </div>

                    <em className={user.suspended ? "status suspended" : user.driverVerified ? "status verified" : "status basic"}>
                      {user.suspended ? "Suspended" : user.driverVerified ? "Driver" : "User"}
                    </em>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="detailsCard">
            {selected ? (
              <>
                <div className="profileHeader">
                  {selected.photoURL ? (
                    <img src={selected.photoURL} alt={selected.name || "User"} className="bigAvatarImage" />
                  ) : (
                    <div className="bigAvatar">
                      {(selected.name || selected.email || "R").charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <p className="eyebrow">Selected User</p>
                    <h2>{selected.name || "RoadLink User"}</h2>
                    <p className="email">{selected.email || "No email"}</p>
                  </div>
                </div>

                <div className="infoGrid">
                  <Info label="User ID" value={selected.id} />
                  <Info label="Role" value={selected.role || "member"} />
                  <Info label="Location" value={`${selected.city || ""}${selected.city && selected.state ? ", " : ""}${selected.state || ""}` || "Not added"} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Verification" value={selected.verificationStatus || "not submitted"} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                </div>

                <div className="badges">
                  <span className={selected.verified ? "goodBadge" : ""}>Verified</span>
                  <span className={selected.driverVerified ? "goodBadge" : ""}>Driver Verified</span>
                  <span className={selected.licenseVerified ? "goodBadge" : ""}>License Verified</span>
                  <span className={selected.suspended ? "dangerBadge" : ""}>
                    {selected.suspended ? "Suspended" : "Active"}
                  </span>
                </div>

                <div className="actionRow">
                  <button
                    className="approveButton"
                    onClick={() =>
                      updateUser(selected, {
                        verified: true,
                        driverVerified: true,
                        licenseVerified: true,
                        verificationStatus: "approved",
                      })
                    }
                    disabled={loadingId === selected.id}
                  >
                    {loadingId === selected.id ? "Working..." : "Verify Driver"}
                  </button>

                  <button
                    className="roleButton"
                    onClick={() =>
                      updateUser(selected, {
                        role: selected.role === "admin" ? "member" : "admin",
                      })
                    }
                    disabled={loadingId === selected.id}
                  >
                    {selected.role === "admin" ? "Make Member" : "Make Admin"}
                  </button>

                  <button
                    className={selected.suspended ? "restoreButton" : "suspendButton"}
                    onClick={() =>
                      updateUser(selected, {
                        suspended: !selected.suspended,
                      })
                    }
                    disabled={loadingId === selected.id}
                  >
                    {selected.suspended ? "Restore User" : "Suspend User"}
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a user</h3>
                <p>Choose a user account to manage.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

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
        .usersCard,
        .detailsCard {
          background: rgba(8, 13, 25, 0.92);
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
          font-size: 32px;
          margin: 0;
        }

        .subtitle,
        .email {
          max-width: 700px;
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
          overflow-wrap: anywhere;
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
          padding: 22px;
        }

        .metricIcon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 30px;
          font-weight: 900;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.95fr 1.45fr;
          gap: 24px;
        }

        .usersCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 18px;
        }

        .searchInput {
          width: 100%;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 16px;
          outline: none;
          margin-bottom: 18px;
        }

        .userList {
          display: grid;
          gap: 12px;
        }

        .userButton {
          width: 100%;
          display: grid;
          grid-template-columns: 48px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeUser {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .avatar,
        .avatarImage {
          width: 48px;
          height: 48px;
          border-radius: 50%;
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
        }

        .avatarImage {
          object-fit: cover;
          border: 2px solid rgba(34,197,94,0.45);
        }

        .userButton strong {
          display: block;
          margin-bottom: 5px;
          overflow-wrap: anywhere;
        }

        .userButton span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .status {
          border-radius: 999px;
          padding: 8px 10px;
          font-style: normal;
          font-weight: 900;
          font-size: 11px;
          white-space: nowrap;
        }

        .status.verified {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.basic {
          color: #a1a1aa;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .status.suspended {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .profileHeader {
          display: flex;
          gap: 18px;
          align-items: center;
          margin-bottom: 24px;
        }

        .bigAvatar,
        .bigAvatarImage {
          min-width: 92px;
          width: 92px;
          height: 92px;
          border-radius: 50%;
        }

        .bigAvatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          font-weight: 900;
        }

        .bigAvatarImage {
          object-fit: cover;
          border: 2px solid rgba(34,197,94,0.45);
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .infoBox {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong {
          overflow-wrap: anywhere;
          text-transform: capitalize;
        }

        .badges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 22px;
        }

        .badges span {
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: #d4d4d8;
          font-weight: 900;
        }

        .badges .goodBadge {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
        }

        .badges .dangerBadge {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .actionRow {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .approveButton,
        .roleButton,
        .suspendButton,
        .restoreButton {
          padding: 17px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .approveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .roleButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .suspendButton {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
        }

        .restoreButton {
          background: linear-gradient(135deg, #f59e0b, #b45309);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 900px) {
          .page {
            padding: 16px;
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
          .adminGrid,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .usersCard,
          .detailsCard {
            padding: 24px;
          }

          .userButton {
            grid-template-columns: 48px 1fr;
          }

          .status {
            grid-column: 2;
            width: fit-content;
          }

          .profileHeader {
            align-items: flex-start;
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
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}
