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
  suspended?: boolean;
  driverVerified?: boolean;
  verified?: boolean;
  createdAt?: string;
};

type Ride = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  price?: number;
  status?: string;
  createdAt?: string;
};

type Booking = {
  id: string;
  driverId?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
  createdAt?: string;
};

type Report = {
  id: string;
  reportedUserId?: string;
  reporterId?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
};

type FraudProfile = {
  user: UserProfile;
  rides: Ride[];
  bookings: Booking[];
  reports: Report[];
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  reasons: string[];
};

export default function AdminFraudPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<FraudProfile | null>(null);
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [message, setMessage] = useState("Loading fraud center...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as UserProfile[]
        );
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubRides = onSnapshot(
      query(collection(db, "rides")),
      (snapshot) => {
        setRides(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Ride[]
        );
      },
      (error) => setMessage(error.message)
    );

    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[]
        );
      },
      (error) => setMessage(error.message)
    );

    const unsubReports = onSnapshot(
      query(collection(db, "reports")),
      (snapshot) => {
        setReports(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Report[]
        );
      },
      () => {
        setReports([]);
      }
    );

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
    };
  }, []);

  const fraudProfiles = useMemo(() => {
    return users.map((user) => {
      const userRides = rides.filter((ride) => ride.driverId === user.id);
      const userBookings = bookings.filter(
        (booking) => booking.driverId === user.id || booking.passengerId === user.id
      );
      const userReports = reports.filter((report) => report.reportedUserId === user.id);

      const cancelledBookings = userBookings.filter(
        (booking) => booking.status === "cancelled"
      ).length;

      const expensiveRides = userRides.filter((ride) => Number(ride.price || 0) > 300).length;

      let riskScore = 0;
      const reasons: string[] = [];

      if (user.suspended) {
        riskScore += 50;
        reasons.push("User is currently suspended.");
      }

      if (userReports.length >= 1) {
        riskScore += userReports.length * 20;
        reasons.push(`${userReports.length} report(s) found.`);
      }

      if (cancelledBookings >= 3) {
        riskScore += 20;
        reasons.push(`${cancelledBookings} cancelled booking(s).`);
      }

      if (userRides.length >= 10) {
        riskScore += 15;
        reasons.push(`${userRides.length} ride(s) created.`);
      }

      if (expensiveRides >= 1) {
        riskScore += expensiveRides * 15;
        reasons.push(`${expensiveRides} high-price ride(s).`);
      }

      if (!user.driverVerified && userRides.length >= 3) {
        riskScore += 20;
        reasons.push("Unverified driver has multiple rides.");
      }

      riskScore = Math.min(riskScore, 100);

      const riskLevel =
        riskScore >= 70 ? "High" : riskScore >= 35 ? "Medium" : "Low";

      if (reasons.length === 0) reasons.push("No major suspicious activity detected.");

      return {
        user,
        rides: userRides,
        bookings: userBookings,
        reports: userReports,
        riskScore,
        riskLevel,
        reasons,
      };
    });
  }, [users, rides, bookings, reports]);

  const filteredProfiles = useMemo(() => {
    if (filter === "all") return fraudProfiles;

    return fraudProfiles.filter(
      (profile) => profile.riskLevel.toLowerCase() === filter
    );
  }, [fraudProfiles, filter]);

  const highRisk = fraudProfiles.filter((item) => item.riskLevel === "High").length;
  const mediumRisk = fraudProfiles.filter((item) => item.riskLevel === "Medium").length;
  const lowRisk = fraudProfiles.filter((item) => item.riskLevel === "Low").length;
  const suspended = users.filter((user) => user.suspended).length;

  useEffect(() => {
    setSelected((current) => {
      if (!filteredProfiles.length) return null;
      if (!current) return filteredProfiles[0];
      return filteredProfiles.find((item) => item.user.id === current.user.id) || filteredProfiles[0];
    });
  }, [filteredProfiles]);

  async function updateUser(userId: string, updates: Partial<UserProfile>) {
    try {
      setLoadingId(userId);
      setMessage("");

      await setDoc(
        doc(db, "users", userId),
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

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/support" className="miniButton">Support</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Fraud <span>Center</span></h1>
            <p className="subtitle">
              Monitor suspicious activity, user reports, cancellations, high-risk accounts and unusual ride behavior.
            </p>
          </div>

          <div className="heroIcon">🕵️</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🔴" label="High Risk" value={String(highRisk)} />
          <Metric icon="🟡" label="Medium Risk" value={String(mediumRisk)} />
          <Metric icon="🟢" label="Low Risk" value={String(lowRisk)} />
          <Metric icon="⛔" label="Suspended" value={String(suspended)} />
        </section>

        <section className="adminGrid">
          <div className="listCard">
            <p className="eyebrow">Risk Queue</p>
            <h2>User Risk Profiles</h2>

            <div className="filters">
              <button onClick={() => setFilter("all")} className={filter === "all" ? "activeFilter" : ""}>All</button>
              <button onClick={() => setFilter("high")} className={filter === "high" ? "activeFilter" : ""}>High</button>
              <button onClick={() => setFilter("medium")} className={filter === "medium" ? "activeFilter" : ""}>Medium</button>
              <button onClick={() => setFilter("low")} className={filter === "low" ? "activeFilter" : ""}>Low</button>
            </div>

            {filteredProfiles.length === 0 ? (
              <div className="empty">
                <h3>No users found</h3>
                <p>No fraud profiles match this filter.</p>
              </div>
            ) : (
              <div className="profileList">
                {filteredProfiles.map((profile) => (
                  <button
                    key={profile.user.id}
                    onClick={() => setSelected(profile)}
                    className={
                      selected?.user.id === profile.user.id
                        ? "profileButton activeProfile"
                        : "profileButton"
                    }
                  >
                    <div>
                      <strong>{profile.user.name || "RoadLink User"}</strong>
                      <span>{profile.user.email || "No email"}</span>
                    </div>

                    <em className={`risk ${profile.riskLevel.toLowerCase()}`}>
                      {profile.riskLevel}
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
                    <h2>{selected.user.name || "RoadLink User"}</h2>
                    <p className="email">{selected.user.email || "No email"}</p>
                  </div>

                  <span className={`riskPill ${selected.riskLevel.toLowerCase()}`}>
                    {selected.riskScore}/100
                  </span>
                </div>

                <div className="riskBox">
                  <span>Risk Level</span>
                  <strong>{selected.riskLevel}</strong>
                </div>

                <div className="infoGrid">
                  <Info label="User ID" value={selected.user.id} />
                  <Info label="Reports" value={String(selected.reports.length)} />
                  <Info label="Rides Created" value={String(selected.rides.length)} />
                  <Info label="Bookings" value={String(selected.bookings.length)} />
                  <Info label="Driver Verified" value={selected.user.driverVerified ? "Yes" : "No"} />
                  <Info label="Suspended" value={selected.user.suspended ? "Yes" : "No"} />
                </div>

                <section className="reasons">
                  <p className="eyebrow">Risk Reasons</p>
                  {selected.reasons.map((reason) => (
                    <div key={reason} className="reasonItem">
                      ⚠️ {reason}
                    </div>
                  ))}
                </section>

                <div className="actionRow">
                  <button
                    className="verifyButton"
                    onClick={() =>
                      updateUser(selected.user.id, {
                        verified: true,
                        driverVerified: true,
                        licenseVerified: true,
                        verificationStatus: "approved",
                      })
                    }
                    disabled={loadingId === selected.user.id}
                  >
                    Verify User
                  </button>

                  <button
                    className={selected.user.suspended ? "restoreButton" : "suspendButton"}
                    onClick={() =>
                      updateUser(selected.user.id, {
                        suspended: !selected.user.suspended,
                      })
                    }
                    disabled={loadingId === selected.user.id}
                  >
                    {selected.user.suspended ? "Restore User" : "Suspend User"}
                  </button>

                  <button
                    className="watchButton"
                    onClick={() =>
                      updateUser(selected.user.id, {
                        watchlisted: true,
                      } as Partial<UserProfile>)
                    }
                    disabled={loadingId === selected.user.id}
                  >
                    Add Watchlist
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a user</h3>
                <p>Choose a risk profile to review.</p>
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
            radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

        .topNav,
        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton,
        .filters button {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
          cursor: pointer;
        }

        .filters .activeFilter {
          background: rgba(34,197,94,0.14);
          border-color: rgba(34,197,94,0.4);
          color: #22c55e;
        }

        .hero,
        .metric,
        .listCard,
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
          margin: 0 0 18px;
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
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
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
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .listCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .profileList {
          display: grid;
          gap: 12px;
        }

        .profileButton {
          width: 100%;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeProfile {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .profileButton strong,
        .profileButton span {
          display: block;
          overflow-wrap: anywhere;
        }

        .profileButton span {
          color: #a1a1aa;
          margin-top: 5px;
          font-size: 12px;
        }

        .risk,
        .riskPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .risk.low,
        .riskPill.low {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .risk.medium,
        .riskPill.medium {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .risk.high,
        .riskPill.high {
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

        .riskBox {
          padding: 24px;
          border-radius: 24px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          margin-bottom: 20px;
        }

        .riskBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .riskBox strong {
          color: #fca5a5;
          font-size: 44px;
          font-weight: 900;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .infoBox,
        .reasonItem {
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

        .infoBox strong,
        .reasonItem {
          overflow-wrap: anywhere;
        }

        .reasons {
          display: grid;
          gap: 10px;
          margin-bottom: 20px;
        }

        .reasonItem {
          color: #e5e7eb;
          font-weight: 800;
        }

        .actionRow {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .verifyButton,
        .suspendButton,
        .restoreButton,
        .watchButton {
          padding: 17px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .verifyButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .suspendButton {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
        }

        .restoreButton {
          background: linear-gradient(135deg, #f59e0b, #b45309);
        }

        .watchButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
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

          .listCard,
          .detailsCard {
            padding: 24px;
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
