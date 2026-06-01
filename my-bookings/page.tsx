"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

type Booking = {
  id: string;
  rideId: string;
  passengerId: string;
  passengerEmail: string;
  driverEmail: string;
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  status: string;
  createdAt: string;
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading your bookings...");

  async function loadBookings() {
    try {
      const user = auth.currentUser;

      if (!user) {
        setMessage("Please sign in to view your bookings.");
        return;
      }

      const q = query(
        collection(db, "bookings"),
        where("passengerId", "==", user.uid)
      );

      const snapshot = await getDocs(q);

      const bookingsData = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Booking[];

      setBookings(bookingsData);
      setMessage(bookingsData.length ? "" : "You do not have bookings yet.");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  return (
    <main className="page">
      <section className="header">
        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>My Bookings</h1>
        <p>Your reserved rides will appear here.</p>
      </section>

      <section className="list">
        {message && <p className="message">{message}</p>}

        {bookings.map((booking) => (
          <div key={booking.id} className="card">
            <h2>
              {booking.from} → {booking.to}
            </h2>

            <p>
              <strong>Date:</strong> {booking.date}
            </p>

            <p>
              <strong>Time:</strong> {booking.time}
            </p>

            <p>
              <strong>Price:</strong> ${booking.price}
            </p>

            <p>
              <strong>Driver:</strong> {booking.driverEmail || "RoadLink Driver"}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              <span className="status">{booking.status}</span>
            </p>
          </div>
        ))}
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, #000, #0f172a, #111827);
          color: white;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .header {
          max-width: 700px;
          margin: 0 auto 30px;
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 24px;
          padding: 28px;
        }

        .logo {
          font-size: 30px;
          font-weight: 900;
          margin-bottom: 22px;
        }

        .logo span {
          color: #22c55e;
        }

        h1 {
          font-size: 38px;
          margin: 0 0 10px;
        }

        h2 {
          margin-top: 0;
        }

        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .list {
          max-width: 700px;
          margin: 0 auto;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 800;
        }

        .card {
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 22px;
          padding: 24px;
          margin-bottom: 16px;
        }

        strong {
          color: white;
        }

        .status {
          color: #22c55e;
          font-weight: 800;
          text-transform: capitalize;
        }

        @media (max-width: 480px) {
          .page {
            padding: 12px;
          }

          .header,
          .card {
            border-radius: 22px;
          }

          h1 {
            font-size: 34px;
          }
        }
      `}</style>
    </main>
  );
}
