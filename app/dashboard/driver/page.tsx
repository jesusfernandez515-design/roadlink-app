"use client";

import Link from "next/link";
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

  const totalPassengers = bookings.length;
  const totalEarnings = bookings.reduce((total, booking) => {
    const ride = rides.find((item) => item.id === booking.rideId);
    return total + Number(ride?.price || 0);
  }, 0);

  const totalSeats = rides.reduce(
    (total, ride) => total + Number(ride.seats || 0),
    0
  );

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>

          <Link href="/my-rides" className="miniButton">
            My Rides
          </Link>

          <Link href="/offer-ride" className="miniButton">
            Offer Ride
          </Link>

          <Link href="/profile" className="miniButton">
            Profile
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>
          Driver <span>Dashboard</span>
        </h1>

        <p className="subtitle">
          Manage your published rides, passenger reservations, and estimated earnings.
        </p>
      </section>

      <section className="stats">
        <Metric icon="🚘" label="Active Rides" value={String(rides.length)} />
        <Metric icon="👥" label="Passengers" value={String(totalPassengers)} />
        <Metric icon="💺" label="Open Seats" value={String(totalSeats)} />
        <Metric icon="💵" label="Earnings" value={`$${totalEarnings}`} />
      </section>

      <section className="list">
        {message && <p className="message">{message}</p>}

        {rides.map((ride) => {
          const rideBookings = getBookingsForRide(ride.id);
          const estimatedEarnings =
            rideBookings.length * Number(ride.price || 0);

          return (
            <div key={ride.id} className="rideCard">
              <div className="routeHeader">
                <div>
                  <p className="eyebrow">Driver Route</p>
                  <h2>
                    {ride.from} <span>→</span> {ride.to}
                  </h2>
                </div>

                <div className="priceBox">
                  <small>EARNINGS</small>
                  <strong>${estimatedEarnings}</strong>
                </div>
              </div>

              <div className="chips">
                <div className="chip">📅 {ride.date}</div>
                <div className="chip">🕒 {ride.time}</div>
                <div className="chip">💺 {ride.seats} seats left</div>
                <div className="chip active">● {ride.status}</div>
              </div>

              <div className="infoGrid">
                <Info icon="🚘" label="Vehicle" value={ride.vehicle || "Not provided"} />
                <Info icon="💵" label="Price Per Seat" value={`$${ride.price}`} />
                <Info icon="👥" label="Passengers" value={String(rideBookings.length)} />
              </div>

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

              <div className="cardButtons">
                <Link
                  href={`/ride-details?rideId=${ride.id}`}
                  className="outlineButton"
                >
                  View Details
                </Link>

                <Link
                  href={`/ride-passengers?rideId=${ride.id}`}
                  className="outlineButton"
                >
                  View Passengers
                </Link>
              </div>

              <button
                className="cancelButton"
                onClick={() => cancelRide(ride.id)}
                disabled={loadingRideId === ride.id}
              >
                {loadingRideId === ride.id ? "Cancelling..." : "Cancel Ride"}
              </button>

              <section className="passengerSection">
                <h3>Passengers</h3>

                {rideBookings.length === 0 ? (
                  <p className="emptyText">No passengers yet.</p>
                ) : (
                  rideBookings.map((booking) => (
                    <div key={booking.id} className="passenger">
                      <div>
                        <strong>{booking.passengerEmail || "Passenger"}</strong>
                        <p>Reservation status</p>
                      </div>

                      <span>{booking.status}</span>
                    </div>
                  ))
                )}
              </section>
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
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .stats,
        .list {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .metric,
        .rideCard {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
        }

        .hero {
          border-radius: 32px;
          padding: 30px;
          margin-bottom: 22px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 30px;
        }

        .miniButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .logo {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .logo span,
        h1 span,
        h2 span,
        .active,
        .eyebrow,
        .priceBox strong,
        .metricValue,
        .summary span {
          color: #22c55e;
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
          letter-spacing: -1px;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
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

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 26px 0;
        }

        .rideCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .routeHeader {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: start;
          margin-bottom: 20px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h2 {
          font-size: 34px;
          line-height: 1.15;
          margin: 0;
        }

        .priceBox {
          min-width: 120px;
          padding: 16px;
          border-radius: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          text-align: center;
        }

        .priceBox small {
          display: block;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .priceBox strong {
          font-size: 32px;
          font-weight: 900;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
        }

        .infoGrid {
          display: grid;
          gap: 10px;
        }

        .infoRow {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .infoIcon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(34,197,94,0.15);
        }

        .infoText strong {
          display: block;
          color: #e5e7eb;
          margin-bottom: 4px;
        }

        .infoText span {
          color: #a1a1aa;
          overflow-wrap: anywhere;
        }

        .summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 22px;
        }

        .summary div {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px;
          padding: 18px;
        }

        .summary span {
          display: block;
          font-size: 30px;
          font-weight: 900;
        }

        .summary small {
          color: #a1a1aa;
          font-weight: 800;
        }

        .cardButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 22px;
        }

        .outlineButton {
          display: block;
          width: 100%;
          padding: 15px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
        }

        .cancelButton {
          width: 100%;
          margin-top: 16px;
          padding: 18px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          color: white;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        }

        .cancelButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .passengerSection {
          margin-top: 28px;
        }

        h3 {
          font-size: 26px;
          margin: 0 0 14px;
        }

        .emptyText {
          color: #a1a1aa;
        }

        .passenger {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          margin-top: 10px;
        }

        .passenger strong {
          color: white;
          overflow-wrap: anywhere;
        }

        .passenger p {
          color: #a1a1aa;
          margin: 6px 0 0;
        }

        .passenger span {
          color: #22c55e;
          font-weight: 900;
          text-transform: capitalize;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .hero,
          .rideCard {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 50px;
          }

          h2 {
            font-size: 32px;
          }

          .stats,
          .routeHeader,
          .summary,
          .cardButtons {
            grid-template-columns: 1fr;
          }

          .priceBox {
            text-align: left;
          }

          .passenger {
            flex-direction: column;
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

function Info({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="infoRow">
      <div className="infoIcon">{icon}</div>
      <div className="infoText">
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
    </div>
  );
}
