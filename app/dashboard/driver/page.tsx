"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

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
  const [loadingRideId, setLoadingRideId] = useState("");

  async function loadDriverData(userId: string) {
    const ridesQuery = query(
      collection(db, "rides"),
      where("driverId", "==", userId),
      where("status", "in", ["active", "full"])
    );

    const ridesSnapshot = await getDocs(ridesQuery);

    const ridesData = ridesSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })) as Ride[];

    const bookingsQuery = query(
      collection(db, "bookings"),
      where("driverId", "==", userId),
      where("status", "==", "reserved")
    );

    const bookingsSnapshot = await getDocs(bookingsQuery);

    const bookingsData = bookingsSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })) as Booking[];

    setRides(ridesData);
    setBookings(bookingsData);
    setMessage(ridesData.length ? "" : "You have not published rides yet.");
  }

  function getBookingsForRide(rideId: string) {
    return bookings.filter((booking) => booking.rideId === rideId);
  }

  async function cancelRide(rideId: string) {
    try {
      setLoadingRideId(rideId);
      setMessage("");

      await updateDoc(doc(db, "rides", rideId), {
        status: "cancelled",
      });

      const relatedBookings = bookings.filter(
        (booking) => booking.rideId === rideId
      );

      await Promise.all(
        relatedBookings.map((booking) =>
          updateDoc(doc(db, "bookings", booking.id), {
            status: "cancelled",
          })
        )
      );

      setRides((current) => current.filter((ride) => ride.id !== rideId));
      setBookings((current) =>
        current.filter((booking) => booking.rideId !== rideId)
      );

      setMessage("Ride cancelled successfully.");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoadingRideId("");
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRides([]);
        setBookings([]);
        setMessage("Please sign in to view your driver dashboard.");
        return;
      }

      try {
        await loadDriverData(user.uid);
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

        <h1>Driver Dashboard</h1>
        <p>Manage your published rides and passenger reservations.</p>
      </section>

      <section className="list">
        {message && <p className="message">{message}</p>}

        {rides.map((ride) => {
          const rideBookings = getBookingsForRide(ride.id);
          const estimatedEarnings = rideBookings.length * Number(ride.price || 0);

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
                <strong>Vehicle:</strong> {ride.vehicle || "Not provided"}
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

              <button
                className="cancelButton"
                onClick={() => cancelRide(ride.id)}
                disabled={loadingRideId === ride.id}
              >
                {loadingRideId === ride.id ? "Cancelling..." : "Cancel Ride"}
              </button>

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
          font-size: 18px;
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

        .cancelButton {
          width: 100%;
          margin-top: 20px;
          padding: 16px;
          border: none;
          border-radius: 999px;
          background: #ef4444;
          color: white;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }

        .cancelButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
