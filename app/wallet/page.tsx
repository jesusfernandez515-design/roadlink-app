"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

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

type PayoutRequest = {
  id: string;
  userId?: string;
  driverEmail?: string;
  email?: string;
  amount?: number;
  status?: "pending" | "approved" | "rejected" | "paid";
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string;
};

export default function WalletPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [message, setMessage] = useState("Loading wallet...");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let unsubscribeBookings: (() => void) | undefined;
    let unsubscribePayouts: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId("");
        setUserEmail("");
        setBookings([]);
        setPayouts([]);
        setMessage("Please sign in to view your wallet.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setMessage("");

      unsubscribeBookings = onSnapshot(
        query(collection(db, "bookings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          setBookings(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribePayouts = onSnapshot(
        query(collection(db, "payoutRequests"), where("userId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as PayoutRequest[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setPayouts(data);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeBookings) unsubscribeBookings();
      if (unsubscribePayouts) unsubscribePayouts();
    };
  }, []);

  const completedBookings = useMemo(() => {
    return bookings.filter((item) => item.status === "completed");
  }, [bookings]);

  const pendingBookings = useMemo(() => {
    return bookings.filter(
      (item) =>
        item.status === "reserved" ||
        item.status === "confirmed" ||
        item.status === "pending"
    );
  }, [bookings]);

  const lifetimeEarnings = useMemo(() => {
    return completedBookings.reduce((total, item) => {
      return total + Number(item.price || 0) * Number(item.seatsBooked || 1);
    }, 0);
  }, [completedBookings]);

  const pendingBalance = useMemo(() => {
    return pendingBookings.reduce((total, item) => {
      return total + Number(item.price || 0) * Number(item.seatsBooked || 1);
    }, 0);
  }, [pendingBookings]);

  const roadLinkFee = useMemo(() => {
    return Math.round(lifetimeEarnings * 0.12);
  }, [lifetimeEarnings]);

  const totalPaidOut = useMemo(() => {
    return payouts
      .filter((item) => item.status === "paid")
      .reduce((total, item) => total + Number(item.amount || 0), 0);
  }, [payouts]);

  const activePayoutRequests = useMemo(() => {
    return payouts
      .filter((item) => item.status === "pending" || item.status === "approved")
      .reduce((total, item) => total + Number(item.amount || 0), 0);
  }, [payouts]);

  const currentBalance = useMemo(() => {
    return Math.max(lifetimeEarnings - roadLinkFee - totalPaidOut, 0);
  }, [lifetimeEarnings, roadLinkFee, totalPaidOut]);

  const availableBalance = useMemo(() => {
    return Math.max(currentBalance - activePayoutRequests, 0);
  }, [currentBalance, activePayoutRequests]);

  const latestPayout = payouts[0];

  const walletActivity = useMemo(() => {
    const rideActivity = completedBookings.map((booking) => {
      const amount = Number(booking.price || 0) * Number(booking.seatsBooked || 1);

      return {
        id: `booking-${booking.id}`,
        type: "ride",
        title: "Ride Completed",
        subtitle: `${booking.from || "Origin"} → ${booking.to || "Destination"}`,
        detail: booking.passengerEmail || "Passenger",
        amount,
        sign: "+",
        status: "completed",
        date: booking.completedAt || booking.createdAt || "",
        icon: "✅",
      };
    });

    const payoutActivity = payouts
      .filter((payout) => payout.status === "paid")
      .map((payout) => {
        return {
          id: `payout-${payout.id}`,
          type: "payout",
          title: "Payout Sent",
          subtitle: "Money sent to driver",
          detail: "PAID",
          amount: Number(payout.amount || 0),
          sign: "-",
          status: "paid",
          date: payout.paidAt || payout.updatedAt || payout.createdAt || "",
          icon: "🏦",
        };
      });

    return [...rideActivity, ...payoutActivity].sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    );
  }, [completedBookings, payouts]);

  async function requestPayout() {
    if (!userId) {
      setMessage("Please sign in first.");
      return;
    }

    if (availableBalance <= 0) {
      setMessage("No available balance to request.");
      return;
    }

    const hasActiveRequest = payouts.some(
      (item) => item.status === "pending" || item.status === "approved"
    );

    if (hasActiveRequest) {
      setMessage("You already have an active payout request.");
      return;
    }

    try {
      setRequesting(true);
      setMessage("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "payoutRequests"), {
        userId,
        email: userEmail,
        driverEmail: userEmail,
        amount: availableBalance,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId,
        type: "payout",
        title: "Payout Requested",
        message: `Your payout request for $${availableBalance} was submitted.`,
        read: false,
        createdAt: now,
      });

      setMessage("Payout request submitted successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="topNav">
          <Link href="/profile" className="miniButton">
            Profile
          </Link>
          <Link href="/dashboard/driver" className="miniButton">
            Driver Dashboard
          </Link>
          <Link href="/my-rides" className="miniButton">
            My Rides
          </Link>
        </div>

        <p className="eyebrow">RoadLink Wallet</p>
        <h1>
          Driver <span>Wallet</span>
        </h1>
        <p className="subtitle">
          Track completed earnings, RoadLink fees, paid payouts, and current
          available balance.
        </p>

        <div className="balanceBox">
          <span>Current Balance</span>
          <strong>${currentBalance}</strong>
          <small>
            {latestPayout
              ? `Latest payout: ${String(
                  latestPayout.status || "pending"
                ).toUpperCase()}`
              : "No payout requests yet"}
          </small>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="stats">
        <Metric icon="💰" label="Lifetime Earnings" value={`$${lifetimeEarnings}`} />
        <Metric icon="🏦" label="Total Paid Out" value={`$${totalPaidOut}`} />
        <Metric icon="✅" label="Current Balance" value={`$${currentBalance}`} />
        <Metric icon="⏳" label="Pending Balance" value={`$${pendingBalance}`} />
        <Metric icon="🧾" label="RoadLink Fee" value={`$${roadLinkFee}`} />
        <Metric icon="🚗" label="Completed Trips" value={String(completedBookings.length)} />
      </section>

      <section className="payoutCard">
        <div>
          <p className="eyebrow">Payout Status</p>
          <h2>Request your balance</h2>
          <p>
            Available to request: <strong>${availableBalance}</strong>
          </p>
          <p>
            Pending or approved payout requests are already reserved and are not
            counted as available money.
          </p>
        </div>

        <button onClick={requestPayout} disabled={requesting || availableBalance <= 0}>
          {requesting ? "Requesting..." : "Request Payout"}
        </button>
      </section>

      <section className="history">
        <p className="eyebrow">Payout Requests</p>
        <h2>Request History</h2>

        {payouts.length === 0 ? (
          <div className="emptyCard">
            <h3>No payout requests yet</h3>
            <p>Your payout requests will appear here.</p>
          </div>
        ) : (
          payouts.map((payout) => (
            <div key={payout.id} className="transaction">
              <div className="transactionIcon">🏦</div>

              <div>
                <strong>
                  {payout.status === "paid" ? "Payout Sent" : "Payout Request"}
                </strong>
                <p>
                  {payout.createdAt
                    ? new Date(payout.createdAt).toLocaleString()
                    : "Recently"}
                </p>
                <small>Status: {String(payout.status || "pending").toUpperCase()}</small>
              </div>

              <div className={`amount ${payout.status || "pending"}`}>
                {payout.status === "paid" ? "-" : ""}${Number(payout.amount || 0)}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="history">
        <p className="eyebrow">Transaction History</p>
        <h2>Wallet Activity</h2>

        {walletActivity.length === 0 ? (
          <div className="emptyCard">
            <h3>No wallet activity yet</h3>
            <p>
              Completed ride earnings and paid payouts will appear here.
            </p>
          </div>
        ) : (
          walletActivity.map((activity) => (
            <div key={activity.id} className="transaction">
              <div className="transactionIcon">{activity.icon}</div>

              <div>
                <strong>{activity.title}</strong>
                <p>{activity.subtitle}</p>
                <small>
                  {activity.detail}
                  {activity.date
                    ? ` • ${new Date(activity.date).toLocaleString()}`
                    : ""}
                </small>
              </div>

              <div
                className={
                  activity.sign === "+"
                    ? "amount good"
                    : "amount paidOut"
                }
              >
                {activity.sign}${activity.amount}
              </div>
            </div>
          ))
        )}
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
          grid-template-columns: repeat(3, 1fr);
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

        .payoutCard strong {
          color: #22c55e;
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

        .payoutCard button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
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

        .amount.good,
        .amount.approved {
          color: #22c55e;
        }

        .amount.pending {
          color: #fde68a;
        }

        .amount.rejected {
          color: #fca5a5;
        }

        .amount.paid,
        .amount.paidOut {
          color: #fca5a5;
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
