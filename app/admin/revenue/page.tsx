"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Booking = {
  id: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  createdAt?: string;
  completedAt?: string;
};

type PayoutRequest = {
  id: string;
  amount?: number;
  status?: "pending" | "approved" | "rejected" | "paid";
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string;
};

type Ride = {
  id: string;
  status?: string;
  createdAt?: string;
};

export default function AdminRevenuePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [message, setMessage] = useState("Loading revenue center...");

  useEffect(() => {
    const unsubscribeBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[]
        );
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubscribePayouts = onSnapshot(
      query(collection(db, "payoutRequests")),
      (snapshot) => {
        setPayouts(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as PayoutRequest[]
        );
      },
      (error) => setMessage(error.message)
    );

    const unsubscribeRides = onSnapshot(
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

    return () => {
      unsubscribeBookings();
      unsubscribePayouts();
      unsubscribeRides();
    };
  }, []);

  const completedBookings = useMemo(
    () => bookings.filter((booking) => booking.status === "completed"),
    [bookings]
  );

  const activeBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status === "reserved" ||
          booking.status === "confirmed" ||
          booking.status === "pending"
      ),
    [bookings]
  );

  const lifetimeEarnings = useMemo(() => {
    return completedBookings.reduce((total, booking) => {
      return total + Number(booking.price || 0) * Number(booking.seatsBooked || 1);
    }, 0);
  }, [completedBookings]);

  const pendingTripValue = useMemo(() => {
    return activeBookings.reduce((total, booking) => {
      return total + Number(booking.price || 0) * Number(booking.seatsBooked || 1);
    }, 0);
  }, [activeBookings]);

  const roadLinkFee = Math.round(lifetimeEarnings * 0.12);

  const totalPaidOut = useMemo(() => {
    return payouts
      .filter((payout) => payout.status === "paid")
      .reduce((total, payout) => total + Number(payout.amount || 0), 0);
  }, [payouts]);

  const pendingPayouts = useMemo(() => {
    return payouts
      .filter((payout) => payout.status === "pending" || payout.status === "approved")
      .reduce((total, payout) => total + Number(payout.amount || 0), 0);
  }, [payouts]);

  const platformBalance = Math.max(roadLinkFee, 0);
  const driverBalanceRemaining = Math.max(lifetimeEarnings - roadLinkFee - totalPaidOut, 0);

  const currentMonthRevenue = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const monthlyEarnings = completedBookings.reduce((total, booking) => {
      const value = booking.completedAt || booking.createdAt;
      if (!value) return total;

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return total;

      if (date.getMonth() === month && date.getFullYear() === year) {
        return total + Number(booking.price || 0) * Number(booking.seatsBooked || 1);
      }

      return total;
    }, 0);

    return Math.round(monthlyEarnings * 0.12);
  }, [completedBookings]);

  const activeRides = rides.filter(
    (ride) => ride.status === "active" || ride.status === "full"
  ).length;

  const cancelledBookings = bookings.filter(
    (booking) => booking.status === "cancelled" || booking.status === "rejected"
  ).length;

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Revenue <span>Center</span></h1>
            <p className="subtitle">
              Track RoadLink revenue, completed trip value, platform fees, payouts, and driver balances.
            </p>
          </div>

          <div className="heroIcon">💵</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💰" label="Lifetime Trip Value" value={`$${lifetimeEarnings}`} />
          <Metric icon="🧾" label="RoadLink Fees" value={`$${roadLinkFee}`} />
          <Metric icon="📆" label="Monthly Revenue" value={`$${currentMonthRevenue}`} />
          <Metric icon="🏦" label="Paid Out" value={`$${totalPaidOut}`} />
          <Metric icon="⏳" label="Pending Payouts" value={`$${pendingPayouts}`} />
          <Metric icon="🚘" label="Completed Trips" value={String(completedBookings.length)} />
          <Metric icon="📌" label="Pending Trip Value" value={`$${pendingTripValue}`} />
          <Metric icon="✅" label="Platform Balance" value={`$${platformBalance}`} />
        </section>

        <section className="grid">
          <div className="panel">
            <p className="eyebrow">Revenue Summary</p>
            <h2>Platform Money</h2>

            <Info label="RoadLink Fee Rate" value="12%" />
            <Info label="Platform Revenue" value={`$${roadLinkFee}`} />
            <Info label="This Month Revenue" value={`$${currentMonthRevenue}`} />
            <Info label="Completed Booking Value" value={`$${lifetimeEarnings}`} />
          </div>

          <div className="panel">
            <p className="eyebrow">Driver Money</p>
            <h2>Payout Health</h2>

            <Info label="Total Paid Out" value={`$${totalPaidOut}`} />
            <Info label="Pending / Approved Payouts" value={`$${pendingPayouts}`} />
            <Info label="Driver Balance Remaining" value={`$${driverBalanceRemaining}`} />
            <Info label="Payout Requests" value={String(payouts.length)} />
          </div>

          <div className="panel">
            <p className="eyebrow">Trip Activity</p>
            <h2>Operations</h2>

            <Info label="Total Rides" value={String(rides.length)} />
            <Info label="Active Rides" value={String(activeRides)} />
            <Info label="Total Bookings" value={String(bookings.length)} />
            <Info label="Cancelled Bookings" value={String(cancelledBookings)} />
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

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
        .panel {
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

        .subtitle {
          max-width: 700px;
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
          padding: 20px;
        }

        .metricIcon {
          width: 44px;
          height: 44px;
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
          font-size: 26px;
          font-weight: 900;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .panel {
          border-radius: 30px;
          padding: 26px;
        }

        .infoBox {
          padding: 15px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 12px;
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong {
          color: white;
          font-size: 18px;
          overflow-wrap: anywhere;
        }

        @media (max-width: 1000px) {
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
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

          .stats {
            grid-template-columns: 1fr;
          }

          .panel {
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
      <strong>{value}</strong>
    </div>
  );
}
