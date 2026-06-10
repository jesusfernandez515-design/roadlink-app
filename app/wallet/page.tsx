"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

type Booking = {
  id: string;
  driverId?: string;
  passengerEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  createdAt?: string;
  completedAt?: string;
};

export default function WalletPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading wallet...");

  useEffect(() => {
    let unsubscribeBookings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setBookings([]);
        setMessage("Please sign in to view your wallet.");
        return;
      }

      unsubscribeBookings = onSnapshot(
        query(collection(db, "bookings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          setBookings(data);
          setMessage("");
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeBookings) unsubscribeBookings();
    };
  }, []);

  const completedBookings = bookings.filter((item) => item.status === "completed");
  const pendingBookings = bookings.filter(
    (item) => item.status === "reserved" || item.status === "confirmed" || item.status === "pending"
  );

  const totalEarnings = useMemo(() => {
    return completedBookings.reduce((total, item) => {
      return total + Number(item.price || 0) * Number(item.seatsBooked || 1);
    }, 0);
  }, [completedBookings]);

  const pendingBalance = useMemo(() => {
    return pendingBookings.reduce((total, item) => {
      return total + Number(item.price || 0) * Number(item.seatsBooked || 1);
    }, 0);
  }, [pendingBookings]);

  const roadLinkFee = Math.round(totalEarnings * 0.12);
  const availableBalance = Math.max(totalEarnings - roadLinkFee, 0);

  return (
    <main className="page">
      <section className="hero">
        <div className="topNav">
          <Link href="/profile" className="miniButton">Profile</Link>
          <Link href="/dashboard/driver" className="miniButton">Driver Dashboard</Link>
          <Link href="/my-rides" className="miniButton">My Rides</Link>
        </div>

        <p className="eyebrow">RoadLink Wallet</p>
        <h1>Driver <span>Wallet</span></h1>
        <p className="subtitle">
          Track completed earnings, pending ride money, fees, and future payouts.
        </p>

        <div className="balanceBox">
          <span>Available Balance</span>
          <strong>${availableBalance}</strong>
          <small>Payouts coming soon</small>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="stats">
        <Metric icon="💰" label="Total Earnings" value={`$${totalEarnings}`} />
        <Metric icon="⏳" label="Pending Balance" value={`$${pendingBalance}`} />
        <Metric icon="✅" label="Completed Trips" value={String(completedBookings.length)} />
        <Metric icon="🏦" label="RoadLink Fee" value={`$${roadLinkFee}`} />
      </section>

      <section className="payoutCard">
        <div>
          <p className="eyebrow">Payout Status</p>
          <h2>Bank payouts coming soon</h2>
          <p>
            RoadLink Wallet is tracking your earnings now. Stripe Connect payout support
            will be added later for automatic driver payments.
          </p>
        </div>

        <button onClick={() => alert("Payouts are coming soon.")}>
          Request Payout
        </button>
      </section>

      <section className="history">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Transaction History</p>
            <h2>Recent Activity</h2>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="emptyCard">
            <h3>No wallet activity yet</h3>
            <p>Your ride earnings will appear here when passengers book and complete trips.</p>
          </div>
        ) : (
          bookings.map((booking) => {
            const amount = Number(booking.price || 0) * Number(booking.seatsBooked || 1);
            const completed = booking.status === "completed";

            return (
              <div key={booking.id} className="transaction">
                <div className="transactionIcon">{completed ? "✅" : "⏳"}</div>

                <div>
                  <strong>
                    {completed ? "Ride completed" : "Ride payment pending"}
                  </strong>
                  <p>
                    {booking.from || "Origin"} → {booking.to || "Destination"}
                  </p>
                  <small>{booking.passengerEmail || "Passenger"}</small>
                </div>

                <div className={completed ? "amount good" : "amount pending"}>
                  +${amount}
                </div>
              </div>
            );
          })
        )}
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
          padding: 20px;
          padding-bottom: 110px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .stats,
        .payoutCard,
        .history {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .metric,
        .payoutCard,
        .history,
        .transaction,
        .emptyCard {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 30px;
          margin-bottom: 18px;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 28px;
        }

        .miniButton {
          padding: 11px 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
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
          font-size: 54px;
          line-height: 1;
          margin: 0 0 14px;
        }

        h1 span,
        h2,
        .balanceBox strong,
        .metricValue {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
        }

        .balanceBox {
          margin-top: 24px;
          padding: 24px;
          border-radius: 26px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .balanceBox span,
        .balanceBox small {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
        }

        .balanceBox strong {
          display: block;
          font-size: 54px;
          margin: 8px 0;
        }

        .message {
          max-width: 860px;
          margin: 0 auto 18px;
          color: #22c55e;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 18px;
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

        .payoutCard,
        .history {
          border-radius: 30px;
          padding: 26px;
          margin-bottom: 18px;
        }

        .payoutCard {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .payoutCard h2,
        .history h2 {
          margin: 0 0 10px;
          font-size: 30px;
        }

        .payoutCard p,
        .emptyCard p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .payoutCard button {
          padding: 16px 22px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .transaction {
          display: grid;
          grid-template-columns: 50px 1fr auto;
          gap: 14px;
          align-items: center;
          border-radius: 20px;
          padding: 16px;
          margin-top: 12px;
        }

        .transactionIcon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .transaction strong {
          display: block;
          margin-bottom: 5px;
        }

        .transaction p,
        .transaction small {
          color: #a1a1aa;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .amount {
          font-size: 20px;
          font-weight: 900;
        }

        .amount.good {
          color: #22c55e;
        }

        .amount.pending {
          color: #fde68a;
        }

        .emptyCard {
          border-radius: 24px;
          padding: 24px;
        }

        @media (max-width: 760px) {
          .page {
            padding: 16px;
            padding-bottom: 110px;
          }

          .hero,
          .payoutCard,
          .history {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .payoutCard,
          .transaction {
            grid-template-columns: 1fr;
          }

          .balanceBox strong {
            font-size: 44px;
          }

          .amount {
            font-size: 24px;
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
