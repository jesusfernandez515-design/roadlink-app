"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type BookingItem = {
  id: string;
  price?: number;
  seatsBooked?: number;
  status?: string;
  driverEmail?: string;
  passengerEmail?: string;
  from?: string;
  to?: string;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  amount?: number;
  status?: string;
  driverEmail?: string;
  email?: string;
  createdAt?: string;
};

export default function AdminPaymentsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [message, setMessage] = useState("Loading payments...");

  useEffect(() => {
    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as BookingItem[]
        );
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, "payoutRequests")),
      (snapshot) => {
        setPayouts(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as PayoutItem[]
        );
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubBookings();
      unsubPayouts();
    };
  }, []);

  const completedBookings = bookings.filter((item) => item.status === "completed");

  const totalRevenue = useMemo(() => {
    return completedBookings.reduce((total, item) => {
      return total + Number(item.price || 0) * Number(item.seatsBooked || 1);
    }, 0);
  }, [completedBookings]);

  const roadLinkFees = Math.round(totalRevenue * 0.12);
  const driverEarnings = Math.max(totalRevenue - roadLinkFees, 0);

  const paidPayouts = payouts
    .filter((item) => item.status === "paid")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const pendingPayouts = payouts
    .filter((item) => item.status === "pending" || item.status === "approved")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const remainingDriverBalance = Math.max(driverEarnings - paidPayouts - pendingPayouts, 0);

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/settings" className="miniButton">Settings</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Payments <span>Center</span></h1>
            <p className="subtitle">
              Track platform revenue, RoadLink fees, driver earnings, pending payouts,
              and paid payouts before Stripe Connect integration.
            </p>
          </div>

          <div className="heroIcon">💳</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💰" label="Total Revenue" value={`$${totalRevenue}`} />
          <Metric icon="🧾" label="RoadLink Fees" value={`$${roadLinkFees}`} />
          <Metric icon="🚘" label="Driver Earnings" value={`$${driverEarnings}`} />
          <Metric icon="🏦" label="Paid Payouts" value={`$${paidPayouts}`} />
          <Metric icon="⏳" label="Pending Payouts" value={`$${pendingPayouts}`} />
          <Metric icon="✅" label="Available Balance" value={`$${remainingDriverBalance}`} />
        </section>

        <section className="grid">
          <section className="card">
            <p className="eyebrow">Revenue</p>
            <h2>Completed Payments</h2>

            {completedBookings.length === 0 ? (
              <div className="empty">
                <h3>No completed payments yet</h3>
                <p>Completed bookings will appear here as revenue.</p>
              </div>
            ) : (
              <div className="list">
                {completedBookings.map((booking) => {
                  const amount =
                    Number(booking.price || 0) * Number(booking.seatsBooked || 1);
                  const fee = Math.round(amount * 0.12);
                  const driverAmount = Math.max(amount - fee, 0);

                  return (
                    <div key={booking.id} className="item">
                      <div className="itemIcon">🎟️</div>

                      <div className="itemInfo">
                        <strong>{booking.from || "Origin"} → {booking.to || "Destination"}</strong>
                        <span>{booking.passengerEmail || "Passenger"}</span>
                        <small>
                          Revenue ${amount} • Fee ${fee} • Driver ${driverAmount}
                        </small>
                      </div>

                      <em className="good">${amount}</em>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card">
            <p className="eyebrow">Payouts</p>
            <h2>Driver Payout Activity</h2>

            {payouts.length === 0 ? (
              <div className="empty">
                <h3>No payouts yet</h3>
                <p>Driver payout requests will appear here.</p>
              </div>
            ) : (
              <div className="list">
                {payouts.map((payout) => (
                  <div key={payout.id} className="item">
                    <div className="itemIcon">🏦</div>

                    <div className="itemInfo">
                      <strong>{payout.driverEmail || payout.email || "Driver"}</strong>
                      <span>Status: {String(payout.status || "pending").toUpperCase()}</span>
                      <small>
                        {payout.createdAt
                          ? new Date(payout.createdAt).toLocaleString()
                          : "Recently"}
                      </small>
                    </div>

                    <em className={payout.status === "paid" ? "paid" : "pending"}>
                      ${Number(payout.amount || 0)}
                    </em>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="stripeCard">
          <div>
            <p className="eyebrow">Stripe Connect Prep</p>
            <h2>Next Payment Phase</h2>
            <p>
              This page is now ready for Stripe Connect integration. Next we add checkout,
              payment intents, platform fees, and automatic driver payouts.
            </p>
          </div>

          <Link href="/admin/payouts" className="stripeButton">
            Manage Payouts
          </Link>
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
        .card,
        .stripeCard {
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
          margin: 0 0 14px;
        }

        .subtitle,
        .empty p,
        .stripeCard p {
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
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 12px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 24px;
          font-weight: 900;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .card,
        .stripeCard {
          border-radius: 30px;
          padding: 28px;
        }

        .list {
          display: grid;
          gap: 12px;
        }

        .item {
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .itemIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .itemInfo {
          min-width: 0;
        }

        .itemInfo strong,
        .itemInfo span,
        .itemInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .itemInfo span,
        .itemInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .good {
          color: #22c55e;
          font-style: normal;
          font-weight: 900;
        }

        .paid {
          color: #93c5fd;
          font-style: normal;
          font-weight: 900;
        }

        .pending {
          color: #fde68a;
          font-style: normal;
          font-weight: 900;
        }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .stripeCard {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .stripeButton {
          padding: 16px 22px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-decoration: none;
          font-weight: 900;
          text-align: center;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
          .stripeCard {
            grid-template-columns: 1fr;
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

          .card {
            padding: 24px;
          }

          .item {
            grid-template-columns: 46px 1fr;
          }

          .item em {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .itemIcon {
            width: 46px;
            height: 46px;
          }

          .stripeButton {
            width: 100%;
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
