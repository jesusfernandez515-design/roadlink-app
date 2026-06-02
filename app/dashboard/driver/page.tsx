"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";

type Ride = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  price: number;
  vehicle: string;
  status: string;
};

type Booking = {
  id: string;
  rideId: string;
  passengerEmail: string;
  status: string;
};

export default function DriverDashboardPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading driver dashboard...");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view your driver dashboard.");
        return;
      }

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
          where("driverId", "==", user.uid)
        );

        const bookingsSnapshot = await getDocs(bookingsQuery);

        const bookingsData = bookingsSnapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Booking[];

        setRides(ridesData);
        setBookings(bookingsData);
        setMessage(ridesData.length ? "" : "You have not published rides yet.");
      } catch (error: any) {
        setMessage(error.message);
      }
    });

    return () => unsubscribe();
  }, []);

  function getBookingsForRide(rideId: string) {
    return bookings.filter(
      (booking) => booking.rideId === rideId && booking.status === "reserved"
    );
  }

  return (
    <main className="page">
      <section className="headerCard">
        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>Driver Dashboard</h1>
        <p>Manage your published rides and passenger reservations.</p>
      </section>

      <section className="list">
        {message && <p className="message">{message}</p>}

        {rides.map((ride) => {
          const rideBookings = getBookingsForRide(ride.id);
          const estimatedEarnings = rideBookings.length * ride.price;

          return (
            <div key={ride.id} className="rideCard">
              <h2>
                {ride.from} → {ride.to}
              </h2>

              <p>
                <strong>Date:</strong> {ride.date}
              </p>

              <p>
                <strong>Time:</strong> {ride.time}
              </p>

              <p>
                <strong>Vehicle:</strong> {ride.vehicle}
              </p>

              <p>
                <strong>Seats left:</strong> {ride.seats}
              </p>

              <p>
                <strong>Price:</strong> ${ride.price}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                <span className="status">{ride.status}</span>
              </p>

              <div className="summary">
                <div>
                  <span>{rideBookings.length}</span>
                  <small>Passengers</small>
                </div>

                <div>
                  <span>${estimatedEarnings}</span>
                  <small>Estimated earnings</small>
                </div>
              </div>

              <h3>Passengers</h3>

              {rideBookings.length === 0 ? (
                <p>No passengers yet.</p>
              ) : (
                rideBookings.map((booking) => (
                  <div key={booking.id} className="passenger">
                    <p>{booking.passengerEmail || "Passenger"}</p>
                    <span>{booking.status}</span>
                  </div>
                ))
              )}
            </div>
          );
        })}
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

        .headerCard {
          max-width: 800px;
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
          font-size: 26px;
        }

        h3 {
          margin-top: 24px;
        }

        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        strong {
          color: white;
        }

        .list {
          max-width: 800px;
          margin: 0 auto;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 800;
        }

        .rideCard {
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 22px;
          padding: 24px;
          margin-bottom: 18px;
        }

        .status {
          color: #22c55e;
          font-weight: 800;
          text-transform: capitalize;
        }

        .summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 22px;
        }

        .summary div {
          background: #111;
          border: 1px solid #222;
          border-radius: 18px;
          padding: 18px;
        }

        .summary span {
          display: block;
          color: #22c55e;
          font-size: 28px;
          font-weight: 900;
        }

        .summary small {
          color: #a1a1aa;
        }

        .passenger {
          background: #111;
          border: 1px solid #222;
          border-radius: 16px;
          padding: 14px;
          margin-top: 10px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .passenger p {
          margin: 0;
        }

        .passenger span {
          color: #22c55e;
          font-weight: 800;
          text-transform: capitalize;
        }

        @media (max-width: 480px) {
          .page {
            padding: 12px;
          }

          .headerCard,
          .rideCard {
            border-radius: 22px;
          }

          h1 {
            font-size: 34px;
          }

          h2 {
            font-size: 24px;
          }

          .summary {
            grid-template-columns: 1fr;
          }

          .passenger {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
