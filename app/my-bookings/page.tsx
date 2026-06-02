"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

type Booking = {
  id: string;
  rideId: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seatsBooked?: number;
  price?: number;
  driverEmail?: string;
  status: string;
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading bookings...");
  const [loadingId, setLoadingId] = useState("");

  async function loadBookings(userId: string) {
    const q = query(
      collection(db, "bookings"),
      where("passengerId", "==", userId),
      where("status", "==", "reserved")
    );

    const snapshot = await getDocs(q);

    const bookingData = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })) as Booking[];

    setBookings(bookingData);
    setMessage(bookingData.length ? "" : "You have no bookings yet.");
  }

  async function cancelReservation(booking: Booking) {
    try {
      setLoadingId(booking.id);
      setMessage("");

      await updateDoc(doc(db, "bookings", booking.id), {
        status: "cancelled",
      });

      if (booking.rideId) {
        const rideRef = doc(db, "rides", booking.rideId);
        const rideSnap = await getDoc(rideRef);

        if (rideSnap.exists()) {
          const rideData = rideSnap.data();
          const currentSeats = Number(rideData.seats || 0);

          await updateDoc(rideRef, {
            seats: currentSeats + 1,
            status: "active",
          });
        }
      }

      setBookings((current) =>
        current.filter((item) => item.id !== booking.id)
      );

      setMessage("Reservation cancelled successfully.");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoadingId("");
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view your bookings.");
        return;
      }

      try {
        await loadBookings(user.uid);
      } catch (error: any) {
        setMessage(error.message);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <main className="page">
      <section className="headerCard">
        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>My Bookings</h1>
        <p>Your reserved rides will appear here.</p>
      </section>

      <section className="results">
        {message && (
          <div className="messageBox">
            <p className="message">{message}</p>

            {message.includes("sign in") && (
              <a href="/login" className="loginButton">
                Sign In
              </a>
            )}
          </div>
        )}

        {bookings.map((booking) => (
          <div key={booking.id} className="bookingCard">
            <h3>
              {booking.from} → {booking.to}
            </h3>

            <p>
              <strong>Date:</strong> {booking.date}
            </p>

            <p>
              <strong>Time:</strong> {booking.time}
            </p>

            <p>
              <strong>Price:</strong> ${booking.price || 0}
            </p>

            <p>
              <strong>Driver:</strong>{" "}
              {booking.driverEmail || "RoadLink Driver"}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              <span className="status">{booking.status}</span>
            </p>

            <button
              className="cancelButton"
              onClick={() => cancelReservation(booking)}
              disabled={loadingId === booking.id}
            >
              {loadingId === booking.id
                ? "Cancelling..."
                : "Cancel Reservation"}
            </button>
          </div>
        ))}
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: linear-gradient(135deg,#000,#0f172a,#111827);
          color: white;
          padding: 20px;
          font-family: Arial,sans-serif;
        }

        .headerCard,
        .bookingCard {
          max-width: 700px;
          margin: 0 auto 30px;
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 24px;
          padding: 24px;
        }

        .logo {
          font-size: 28px;
          font-weight: 900;
          margin-bottom: 20px;
        }

        .logo span,
        .status,
        .message {
          color: #22c55e;
        }

        h1 {
          font-size: 42px;
          margin-bottom: 12px;
        }

        h3 {
          margin-top: 0;
          font-size: 24px;
        }

        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        strong {
          color: white;
        }

        .results {
          max-width: 700px;
          margin: 0 auto;
        }

        .messageBox {
          text-align: center;
          margin-top: 30px;
        }

        .message {
          font-size: 20px;
          font-weight: 800;
        }

        .loginButton,
        .cancelButton {
          display: block;
          width: 100%;
          margin-top: 20px;
          padding: 16px;
          border-radius: 999px;
          border: none;
          text-align: center;
          text-decoration: none;
          font-weight: 800;
          font-size: 16px;
        }

        .loginButton {
          background: #22c55e;
          color: white;
        }

        .cancelButton {
          background: #ef4444;
          color: white;
        }

        .cancelButton:disabled {
          opacity: 0.6;
        }

        @media (max-width:480px) {
          .page { padding: 12px; }
          h1 { font-size: 34px; }

          .headerCard,
          .bookingCard {
            border-radius: 22px;
          }
        }
      `}</style>
    </main>
  );
}
