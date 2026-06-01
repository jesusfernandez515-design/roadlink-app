"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

type Booking = {
  id: string;
  rideId: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seatsBooked: number;
  status: string;
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading bookings...");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view your bookings.");
        return;
      }

      try {
        const q = query(
          collection(db, "bookings"),
          where("userId", "==", user.uid)
        );

        const snapshot = await getDocs(q);

        const bookingData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Booking[];

        setBookings(bookingData);

        if (bookingData.length === 0) {
          setMessage("You have no bookings yet.");
        } else {
          setMessage("");
        }
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
              {booking.date} • {booking.time}
            </p>

            <p>
              Seats Reserved: {booking.seatsBooked}
            </p>

            <p>
              Status: {booking.status}
            </p>

          </div>
        ))}
      </section>

      <style>{`
        *{
          box-sizing:border-box;
        }

        .page{
          min-height:100vh;
          background:linear-gradient(135deg,#000,#0f172a,#111827);
          color:white;
          padding:20px;
          font-family:Arial,sans-serif;
        }

        .headerCard{
          max-width:700px;
          margin:0 auto 30px;
          background:#0b0b0b;
          border:1px solid #222;
          border-radius:24px;
          padding:24px;
        }

        .logo{
          font-size:28px;
          font-weight:900;
          margin-bottom:20px;
        }

        .logo span{
          color:#22c55e;
        }

        h1{
          font-size:42px;
          margin-bottom:12px;
        }

        p{
          color:#a1a1aa;
        }

        .results{
          max-width:700px;
          margin:0 auto;
        }

        .messageBox{
          text-align:center;
          margin-top:30px;
        }

        .message{
          color:#22c55e;
          font-size:20px;
          font-weight:800;
        }

        .loginButton{
          display:inline-block;
          margin-top:20px;
          padding:16px 30px;
          border-radius:999px;
          background:#22c55e;
          color:white;
          text-decoration:none;
          font-weight:800;
        }

        .bookingCard{
          background:#0b0b0b;
          border:1px solid #222;
          border-radius:20px;
          padding:20px;
          margin-bottom:16px;
        }

        .bookingCard h3{
          margin-top:0;
          font-size:22px;
        }

        @media (max-width:480px){

          .page{
            padding:12px;
          }

          h1{
            font-size:34px;
          }

          .headerCard,
          .bookingCard{
            border-radius:22px;
          }
        }
      `}</style>
    </main>
  );
}
