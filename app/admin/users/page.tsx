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

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  photoURL?: string;
  city?: string;
  state?: string;
  role?: string;
  verified?: boolean;
  driverVerified?: boolean;
  licenseVerified?: boolean;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  suspended?: boolean;
  verificationStatus?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selected, setSelected] = useState<UserItem | null>(null);
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
        })) as UserItem[];

        data.sort((a, b) =>
          String(b.createdAt || b.updatedAt || "").localeCompare(
            String(a.createdAt || a.updatedAt || "")
          )
        );

        setUsers(data);
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

  const filteredUsers = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return users;

    return users.filter((user) => {
      return (
        String(user.name || "").toLowerCase().includes(value) ||
        String(user.email || "").toLowerCase().includes(value) ||
        String(user.city || "").toLowerCase().includes(value) ||
        String(user.state || "").toLowerCase().includes(value) ||
        String(user.id || "").toLowerCase().includes(value)
      );
    });
  }, [users, search]);

  const totalUsers = users.length;
  const verifiedDrivers = users.filter((user) => user.driverVerified).length;
  const suspendedUsers = users.filter((user) => user.suspended).length;
  const pendingDrivers = users.filter(
    (user) => user.verificationStatus === "pending"
  ).length;

  async function updateUser(user: UserItem, data: Partial<UserItem>, success: string) {
    try {
      setLoadingId(user.id);
      setMessage("");

      await setDoc(
        doc(db, "users", user.id),
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage(success);
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
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/verifications" className="miniButton">Verifications</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Users <span>Management</span></h1>
            <p className="subtitle">
              View users, verify drivers, suspend accounts, reactivate users, and manage platform trust.
            </p>
          </div>

          <div className="heroIcon">👥</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Total Users" value={String(totalUsers)} />
          <Metric icon="🛡️" label="Verified Drivers" value={String(verifiedDrivers)} />
          <Metric icon="⏳" label="Pending Drivers" value={String(pendingDrivers)} />
          <Metric icon="⛔" label="Suspended" value={String(suspendedUsers)} />
        </section>

        <section className="searchCard">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, city, state, or UID..."
          />
        </section>

        <section className="adminGrid">
          <div className="usersCard">
            <p className="eyebrow">Users</p>
            <h2>Registered Accounts</h2>

            {filteredUsers.length === 0 ? (
              <div className="empty">
                <h3>No users found</h3>
                <p>Try a different search.</p>
              </div>
            ) : (
              <div className="userList">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    className={selected?.id === user.id ? "userRow activeUser" : "userRow"}
                    onClick={() => setSelected(user)}
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.name || "User"} className="avatarImage" />
                    ) : (
                      <div className="avatar">{(user.name || user.email || "R").charAt(0).toUpperCase()}</div>
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
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected User</p>
                    <h2>{selected.name || "RoadLink User"}</h2>
                    <p className="email">{selected.email || "No email"}</p>
                  </div>

                  {selected.photoURL ? (
                    <img src={selected.photoURL} alt={selected.name || "User"} className="bigAvatarImage" />
                  ) : (
                    <div className="bigAvatar">{(selected.name || selected.email || "R").charAt(0).toUpperCase()}</div>
                  )}
                </div>

                <div className="infoGrid">
                  <Info label="User ID" value={selected.id} />
                  <Info label="Role" value={selected.role || "member"} />
                  <Info label="City" value={selected.city || "Not set"} />
                  <Info label="State" value={selected.state || "Not set"} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                  <Info label="Email Verified" value={selected.emailVerified ? "Yes" : "No"} />
                  <Info label="Phone Verified" value={selected.phoneVerified ? "Yes" : "No"} />
                  <Info label="Driver Verified" value={selected.driverVerified ? "Yes" : "No"} />
                  <Info label="License Verified" value={selected.licenseVerified ? "Yes" : "No"} />
                  <Info label="Verification Status" value={selected.verificationStatus || "not_submitted"} />
                  <Info label="Account Status" value={selected.suspended ? "Suspended" : "Active"} />
                </div>

                <div className="actionRow">
                  <button
                    className="approveButton"
                    onClick={() =>
                      updateUser(
                        selected,
                        {
                          verified: true,
                          driverVerified: true,
                          licenseVerified: true,
                          verificationStatus: "approved",
                          suspended: false,
                        },
                        "User marked as verified driver."
                      )
                    }
                    disabled={loadingId === selected.id}
                  >
                    {loadingId === selected.id ? "Working..." : "Verify Driver"}
                  </button>

                  <button
                    className="basicButton"
                    onClick={() =>
                      updateUser(
                        selected,
                        {
                          verified: false,
                          driverVerified: false,
                          licenseVerified: false,
                          verificationStatus: "not_submitted",
                        },
                        "Driver verification removed."
                      )
                    }
                    disabled={loadingId === selected.id}
                  >
                    Remove Driver
                  </button>

                  <button
                    className="rejectButton"
                    onClick={() =>
                      updateUser(
                        selected,
                        {
                          suspended: true,
                        },
                        "User suspended."
                      )
                    }
                    disabled={loadingId === selected.id}
                  >
                    Suspend
                  </button>

                  <button
                    className="paidButton"
                    onClick={() =>
                      updateUser(
                        selected,
                        {
                          suspended: false,
                        },
                        "User reactivated."
                      )
                    }
                    disabled={loadingId === selected.id}
                  >
                    Reactivate
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a user</h3>
                <p>Choose a user to manage account details.</p>
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
          padding-bottom: 140px;
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
        .searchCard,
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
          margin: 0 0 8px;
        }

        .subtitle,
        .email,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
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
          margin-bottom: 18px;
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

        .searchCard {
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        .searchCard input {
          width: 100%;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .usersCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .userList {
          display: grid;
          gap: 12px;
        }

        .userRow {
          width: 100%;
          display: grid;
          grid-template-columns: 52px 1fr auto;
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
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 2px solid rgba(34,197,94,0.5);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 22px;
        }

        .avatarImage {
          object-fit: cover;
        }

        .userRow strong,
        .userRow span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .userRow span {
          color: #a1a1aa;
          font-size: 13px;
        }

        .status {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
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

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .bigAvatar,
        .bigAvatarImage {
          min-width: 86px;
          width: 86px;
          height: 86px;
          border-radius: 50%;
          border: 2px solid rgba(34,197,94,0.5);
        }

        .bigAvatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          font-weight: 900;
        }

        .bigAvatarImage {
          object-fit: cover;
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
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .approveButton,
        .paidButton,
        .rejectButton,
        .basicButton {
          padding: 16px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .approveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .paidButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .rejectButton {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
        }

        .basicButton {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
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

        @media (max-width: 1000px) {
          .stats,
          .adminGrid,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 620px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero {
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .usersCard,
          .detailsCard {
            padding: 24px;
          }

          .userRow {
            grid-template-columns: 46px 1fr;
          }

          .userRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .avatar,
          .avatarImage {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
            flex-direction: column;
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
      <strong>{value}</strong>
    </div>
  );
}
