"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

type Booking = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  price?: number;
  seatsBooked?: number;
  status?: string;
  from?: string;
  to?: string;
  date?: string;
  createdAt?: string;
  completedAt?: string;
};

type PayoutRequest = {
  id: string;
  amount?: number;
  status?: string;
  createdAt?: string;
};

export default function DriverEarningsPage() {
  const [driverId, setDriverId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [message, setMessage] = useState("Loading earnings...");

  useEffect(() => {
    let unsubscribeBookings: (() => void) | undefined;
    let unsubscribePayouts: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setMessage("Please sign in.");
        return;
      }

      setDriverId(user.uid);

      unsubscribeBookings = onSnapshot(
        query(
          collection(db, "bookings"),
          where("driverId", "==", user.uid)
        ),
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Booking[];

          setBookings(data);
          setMessage("");
        }
      );

      unsubscribePayouts = onSnapshot(
        query(
          collection(db, "payoutRequests"),
          where("userId", "==", user.uid)
        ),
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as PayoutRequest[];

          setPayouts(data);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeBookings) unsubscribeBookings();
      if (unsubscribePayouts) unsubscribePayouts();
    };
  }, []);

  const completedTrips = bookings.filter(
    (booking) => booking.status === "completed"
  );

  const totalEarnings = useMemo(() => {
    return completedTrips.reduce((total, booking) => {
      return (
        total +
        Number(booking.price || 0) *
          Number(booking.seatsBooked || 1)
      );
    }, 0);
  }, [completedTrips]);

  const thisMonthEarnings = useMemo(() => {
    const now = new Date();

    return completedTrips.reduce((total, booking) => {
      const value =
        booking.completedAt || booking.createdAt;

      if (!value) return total;

      const date = new Date(value);

      if (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      ) {
        return (
          total +
          Number(booking.price || 0) *
            Number(booking.seatsBooked || 1)
        );
      }

      return total;
    }, 0);
  }, [completedTrips]);

  const paidOut = payouts
    .filter((item) => item.status === "paid")
    .reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

  const pendingPayouts = payouts
    .filter(
      (item) =>
        item.status === "pending" ||
        item.status === "approved"
    )
    .reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

  const availableBalance =
    totalEarnings - paidOut - pendingPayouts;

  const averageTrip =
    completedTrips.length > 0
      ? (totalEarnings / completedTrips.length).toFixed(2)
      : "0";

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/dashboard" className="button">
            Dashboard
          </Link>

          <Link href="/wallet" className="button">
            Wallet
          </Link>

          <Link href="/my-rides" className="button">
            My Rides
          </Link>

          <Link href="/driver" className="button">
            Driver
          </Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">
              RoadLink Driver
            </p>

            <h1>
              Earnings <span>Center</span>
            </h1>

            <p className="subtitle">
              Track your driver income,
              payouts, balances, and completed trips.
            </p>
          </div>

          <div className="moneyOrb">
            <strong>
              ${totalEarnings.toFixed(0)}
            </strong>

            <span>Total Earned</span>
          </div>
        </section>

        {message && (
          <p className="message">{message}</p>
        )}

        <section className="stats">
          <Metric
            icon="💰"
            label="Total Earnings"
            value={`$${totalEarnings.toFixed(0)}`}
          />

          <Metric
            icon="📈"
            label="This Month"
            value={`$${thisMonthEarnings.toFixed(0)}`}
          />

          <Metric
            icon="🚘"
            label="Completed Trips"
            value={String(completedTrips.length)}
          />

          <Metric
            icon="💳"
            label="Available"
            value={`$${availableBalance.toFixed(0)}`}
          />

          <Metric
            icon="🏦"
            label="Paid Out"
            value={`$${paidOut.toFixed(0)}`}
          />

          <Metric
            icon="⏳"
            label="Pending"
            value={`$${pendingPayouts.toFixed(0)}`}
          />

          <Metric
            icon="⭐"
            label="Average Trip"
            value={`$${averageTrip}`}
          />

          <Metric
            icon="📋"
            label="Payout Requests"
            value={String(payouts.length)}
          />
        </section>

        <section className="panel">
          <p className="eyebrow">
            Recent Completed Trips
          </p>

          <h2>Trip History</h2>

          {completedTrips.length === 0 ? (
            <div className="empty">
              No completed trips yet.
            </div>
          ) : (
            <div className="tripList">
              {completedTrips
                .slice()
                .reverse()
                .slice(0, 15)
                .map((trip) => (
                  <div
                    key={trip.id}
                    className="tripCard"
                  >
                    <div>
                      <strong>
                        {trip.from} → {trip.to}
                      </strong>

                      <p>
                        {trip.passengerEmail ||
                          "Passenger"}
                      </p>
                    </div>

                    <span>
                      $
                      {(
                        Number(trip.price || 0) *
                        Number(
                          trip.seatsBooked || 1
                        )
                      ).toFixed(0)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </section>
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 24px;
          background:
            linear-gradient(
              135deg,
              #020617,
              #030712,
              #0f172a
            );
          color: white;
        }

        .container {
          max-width: 1200px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .button {
          padding: 10px 16px;
          border-radius: 999px;
          text-decoration: none;
          color: white;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
        }

        .hero,
        .panel,
        .stats > div {
          background: rgba(8,13,25,.92);
          border: 1px solid rgba(255,255,255,.1);
          backdrop-filter: blur(16px);
        }

        .hero {
          padding: 30px;
          border-radius: 30px;
          margin-bottom: 20px;
          display:flex;
          justify-content:space-between;
          align-items:center;
        }

        .eyebrow {
          color:#22c55e;
          font-weight:900;
        }

        h1 {
          font-size:58px;
          margin:10px 0;
        }

        h1 span {
          color:#22c55e;
        }

        .subtitle {
          color:#a1a1aa;
        }

        .moneyOrb {
          width:130px;
          height:130px;
          border-radius:50%;
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          background:rgba(34,197,94,.15);
        }

        .moneyOrb strong {
          color:#22c55e;
          font-size:28px;
        }

        .stats {
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:14px;
          margin-bottom:20px;
        }

        .panel {
          padding:24px;
          border-radius:30px;
        }

        .tripList {
          display:grid;
          gap:12px;
          margin-top:20px;
        }

        .tripCard {
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:16px;
          border-radius:16px;
          background:rgba(255,255,255,.04);
        }

        .tripCard p {
          color:#a1a1aa;
          margin-top:6px;
        }

        .tripCard span {
          color:#22c55e;
          font-weight:900;
          font-size:20px;
        }

        .empty {
          padding:20px;
          color:#a1a1aa;
        }

        @media(max-width:900px){
          .stats{
            grid-template-columns:1fr;
          }

          .hero{
            flex-direction:column;
            align-items:flex-start;
          }

          h1{
            font-size:42px;
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
    <div
      style={{
        padding: 20,
        borderRadius: 24,
      }}
    >
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div
        style={{
          color: "#a1a1aa",
          marginTop: 10,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#22c55e",
          fontWeight: 900,
          fontSize: 26,
          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}
