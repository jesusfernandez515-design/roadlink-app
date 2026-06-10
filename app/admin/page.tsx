"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  verified?: boolean;
  driverVerified?: boolean;
};

type RideItem = {
  id: string;
  status?: string;
};

type BookingItem = {
  id: string;
  status?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
};

type VerificationItem = {
  id: string;
  status?: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [message, setMessage] = useState("Loading admin dashboard...");

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as UserItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubRides = onSnapshot(
      query(collection(db, "rides")),
      (snapshot) => {
        setRides(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as RideItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as BookingItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, "payoutRequests")),
      (snapshot) => {
        setPayouts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as PayoutItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubVerifications = onSnapshot(
      query(collection(db, "driverVerifications")),
      (snapshot) => {
        setVerifications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as VerificationItem[]);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubVerifications();
    };
  }, []);

  const pendingPayouts = useMemo(
    () => payouts.filter((item) => item.status === "pending"),
    [payouts]
  );

  const pendingVerifications = useMemo(
    () => verifications.filter((item) => item.status === "pending"),
    [verifications]
  );

  const activeRides = useMemo(
    () => rides.filter((item) => item.status === "active" || item.status === "full"),
    [rides]
  );

  const completedBookings = useMemo(
    () => bookings.filter((item) => item.status === "completed"),
    [bookings]
  );

  const pendingPayoutAmount = useMemo(
    () => pendingPayouts.reduce((total, item) => total + Number(item.amount || 0), 0),
    [pendingPayouts]
  );

  return (
    <main className="page">
      <section className="container">
        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>
              Control <span>Center</span>
            </h1>
            <p className="subtitle">
              Manage users, rides, bookings, driver verification, payout requests,
              reports, and platform activity from one premium dashboard.
            </p>
          </div>

          <div className="heroIcon">🛡️</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(users.length)} />
          <Metric icon="🚘" label="Active Rides" value={String(activeRides.length)} />
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} />
          <Metric icon="✅" label="Completed" value={String(completedBookings.length)} />
          <Metric icon="🛡️" label="Pending Verifications" value={String(pendingVerifications.length)} />
          <Metric icon="🏦" label="Pending Payouts" value={String(pendingPayouts.length)} />
          <Metric icon="💵" label="Pending Payout $" value={`$${pendingPayoutAmount}`} />
          <Metric icon="⭐" label="Platform Status" value="Live" />
        </section>

        <section className="adminGrid">
          <AdminCard
            href="/admin/verifications"
            icon="🛡️"
            title="Driver Verifications"
            text="Review driver licenses, government IDs, insurance documents, and vehicle photos."
            badge={pendingVerifications.length}
          />

          <AdminCard
            href="/admin/payouts"
            icon="🏦"
            title="Payout Requests"
            text="Approve, reject, and mark driver payout requests as paid."
            badge={pendingPayouts.length}
          />

          <AdminCard
            href="/admin/users"
            icon="👥"
            title="Users"
            text="View RoadLink users, driver status, trust status, and account data."
          />

          <AdminCard
            href="/admin/rides"
            icon="🚘"
            title="Rides"
            text="Monitor active, completed, cancelled, and full rides."
          />

          <AdminCard
            href="/admin/bookings"
            icon="🎟️"
            title="Bookings"
            text="Review passenger bookings, completed trips, and reservation activity."
          />

          <AdminCard
            href="/admin/reports"
            icon="🚨"
            title="Reports"
            text="Handle user reports, safety concerns, and platform issues."
          />

          <AdminCard
            href="/dashboard"
            icon="🏠"
            title="Back to Dashboard"
            text="Return to the main RoadLink dashboard."
          />

          <AdminCard
            href="/wallet"
            icon="💰"
            title="Wallet"
            text="Review your own driver wallet, payout history, and earnings."
          />
        </section>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
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

        .hero,
        .metric,
        .adminCard {
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
          letter-spacing: -1px;
        }

        h1 span {
          color: #22c55e;
        }

        .subtitle {
          max-width: 760px;
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
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
          color: #22c55e;
          font-size: 28px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .adminCard {
          position: relative;
          min-height: 210px;
          border-radius: 28px;
          padding: 24px;
          color: white;
          text-decoration: none;
          overflow: hidden;
          transition: all 0.25s ease;
        }

        .adminCard:hover {
          transform: translateY(-4px);
          border-color: rgba(34,197,94,0.45);
        }

        .adminIcon {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin-bottom: 18px;
        }

        .adminCard h2 {
          font-size: 22px;
          line-height: 1.1;
          margin: 0 0 10px;
        }

        .adminCard p {
          color: #a1a1aa;
          font-size: 14px;
          line-height: 1.45;
          margin: 0;
        }

        .badge {
          position: absolute;
          top: 16px;
          right: 16px;
          min-width: 26px;
          height: 26px;
          padding: 0 8px;
          border-radius: 999px;
          background: #ef4444;
          color: white;
          font-size: 12px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 18px rgba(239,68,68,0.75);
        }

        @media (max-width: 1000px) {
          .stats,
          .adminGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 620px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
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
          .adminGrid {
            grid-template-columns: 1fr;
          }

          .adminCard {
            min-height: 170px;
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

function AdminCard({
  href,
  icon,
  title,
  text,
  badge,
}: {
  href: string;
  icon: string;
  title: string;
  text: string;
  badge?: number;
}) {
  return (
    <Link href={href} className="adminCard">
      {badge !== undefined && badge > 0 && <span className="badge">{badge}</span>}

      <div className="adminIcon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </Link>
  );
}
