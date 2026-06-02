"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";

type Ride = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  seats: number;
  status: string;
};

type Booking = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  driverEmail: string;
  status: string;
};

export default function DashboardPage() {
  const [activeRides, setActiveRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [avatar, setAvatar] = useState("J");
  const [message, setMessage] = useState("Loading dashboard...");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view your dashboard.");
        return;
      }

      setAvatar((user.email || "J").charAt(0).toUpperCase());

      try {
        const ridesQuery = query(
          collection(db, "rides"),
          where("driverId", "==", user.uid)
        );

        const ridesSnapshot = await getDocs(ridesQuery);

        const ridesData = ridesSnapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Ride[];

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("passengerId", "==", user.uid),
          where("status", "==", "reserved")
        );

        const bookingsSnapshot = await getDocs(bookingsQuery);

        const bookingsData = bookingsSnapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Booking[];

        const driverBookingsQuery = query(
          collection(db, "bookings"),
          where("driverId", "==", user.uid),
          where("status", "==", "reserved")
        );

        const driverBookingsSnapshot = await getDocs(driverBookingsQuery);

        const totalEarnings = driverBookingsSnapshot.docs.reduce(
          (total, document) => total + Number(document.data().price || 0),
          0
        );

        setActiveRides(ridesData);
        setBookings(bookingsData);
        setEarnings(totalEarnings);
        setMessage("");
      } catch (error: any) {
        setMessage(error.message);
      }
    });

    return () => unsubscribe();
  }, []);

  const upcomingTrip = bookings[0];

  return (
    <main className="page">
      <section className="card">
        <div className="header">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back to RoadLink.</p>
          </div>

          <div className="avatar">{avatar}</div>
        </div>

        {message && <p className="message">{message}</p>}

        <div className="stats">
          <Box title="Active Rides" value={String(activeRides.length)} />
          <Box title="Booked Trips" value={String(bookings.length)} />
          <Box title="Rating" value="New" />
          <Box title="Earnings" value={`$${earnings}`} />
        </div>

        <section className="section">
          <h2>Upcoming Trip</h2>

          {upcomingTrip ? (
            <div className="trip">
              <h3>
                {upcomingTrip.from} → {upcomingTrip.to}
              </h3>
              <p>
                {upcomingTrip.date} · {upcomingTrip.time}
              </p>
              <p>Driver: {upcomingTrip.driverEmail || "RoadLink Driver"}</p>
              <a className="mainButton" href="/my-bookings">
                View Details
              </a>
            </div>
          ) : (
            <div className="trip">
              <h3>No upcoming trips yet.</h3>
              <p>Reserve a ride to see it here.</p>
              <a className="mainButton" href="/find-ride">
                Find a Ride
              </a>
            </div>
          )}
        </section>

        <section className="section">
          <h2>Quick Actions</h2>
          <div className="actions">
            <a href="/find-ride">Find a Ride</a>
            <a href="/offer-ride">Offer a Ride</a>
            <a href="/my-bookings">My Bookings</a>
            <a href="/dashboard/driver">Driver Dashboard</a>
            <a href="/profile">Profile</a>
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: linear-gradient(135deg,#000,#0f172a,#111827);
          color: white;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .card {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 28px;
          padding: 28px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.6);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        h1 {
          font-size: 42px;
          margin: 0;
        }

        p {
          color: #a1a1aa;
        }

        .message {
          color: #22c55e;
          font-weight: 800;
          margin-top: 20px;
        }

        .avatar {
          width: 62px;
          height: 62px;
          border-radius: 50%;
          background: #22c55e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          gap: 16px;
          margin-top: 32px;
        }

        .box {
          background: #111;
          border: 1px solid #222;
          border-radius: 18px;
          padding: 18px;
        }

        .box h3 {
          color: #a1a1aa;
          font-size: 14px;
          margin: 0 0 10px;
        }

        .box p {
          color: #22c55e;
          font-size: 28px;
          font-weight: 900;
          margin: 0;
        }

        .section {
          margin-top: 34px;
        }

        .trip {
          background: #111;
          border: 1px solid #222;
          border-radius: 20px;
          padding: 20px;
        }

        .trip h3 {
          margin-top: 0;
        }

        .mainButton {
          display: block;
          width: 100%;
          margin-top: 16px;
          padding: 15px;
          border-radius: 999px;
          background: #22c55e;
          color: white;
          font-weight: 800;
          text-align: center;
          text-decoration: none;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(5,1fr);
          gap: 14px;
        }

        .actions a {
          background: #111;
          border: 1px solid #222;
          border-radius: 18px;
          padding: 18px;
          text-align: center;
          color: white;
          text-decoration: none;
          font-weight: 800;
        }

        @media (max-width: 700px) {
          .card {
            padding: 22px;
          }

          h1 {
            font-size: 34px;
          }

          .stats {
            grid-template-columns: 1fr 1fr;
          }

          .actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Box({ title, value }: any) {
  return (
    <div className="box">
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
}
