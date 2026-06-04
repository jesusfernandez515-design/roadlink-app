"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import {
  addDoc,
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
  notes?: string;
  status: string;
  driverEmail: string;
  driverId?: string;
};

export default function FindRidePage() {
  const router = useRouter();

  const [rides, setRides] = useState<Ride[]>([]);
  const [reservedRideIds, setReservedRideIds] = useState<string[]>([]);
  const [message, setMessage] = useState("Loading rides...");
  const [loadingRideId, setLoadingRideId] = useState("");

  async function loadRides() {
    try {
      const q = query(collection(db, "rides"), where("status", "==", "active"));
      const snapshot = await getDocs(q);

      const ridesData = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Ride[];

      setRides(ridesData);
      setMessage(ridesData.length ? "" : "No rides available yet.");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function loadUserBookings() {
    const user = auth.currentUser;

    if (!user) {
      setReservedRideIds([]);
      return;
    }

    const q = query(
      collection(db, "bookings"),
      where("passengerId", "==", user.uid),
      where("status", "==", "reserved")
    );

    const snapshot = await getDocs(q);

    const ids = snapshot.docs
      .map((document) => document.data().rideId)
      .filter(Boolean);

    setReservedRideIds(ids);
  }

  async function reserveSeat(ride: Ride) {
    setMessage("");

    try {
      const user = auth.currentUser;

      if (!user) {
        setMessage("Please sign in before reserving a seat.");
        router.push("/login");
        return;
      }

      if (ride.driverId === user.uid) {
        setMessage("You cannot reserve your own ride.");
        return;
      }

      if (ride.seats <= 0) {
        setMessage("No seats available for this ride.");
        return;
      }

      const duplicateQuery = query(
        collection(db, "bookings"),
        where("rideId", "==", ride.id),
        where("passengerId", "==", user.uid),
        where("status", "==", "reserved")
      );

      const duplicateSnapshot = await getDocs(duplicateQuery);

      if (!duplicateSnapshot.empty) {
        setMessage("You already reserved this ride.");
        setReservedRideIds((previous) =>
          previous.includes(ride.id) ? previous : [...previous, ride.id]
        );
        return;
      }

      setLoadingRideId(ride.id);

      await addDoc(collection(db, "bookings"), {
        rideId: ride.id,
        passengerId: user.uid,
        passengerEmail: user.email || "",
        driverId: ride.driverId || "",
        driverEmail: ride.driverEmail || "",
        from: ride.from,
        to: ride.to,
        date: ride.date,
        time: ride.time,
        price: ride.price,
        seatsBooked: 1,
        status: "reserved",
        createdAt: new Date().toISOString(),
      });

      const newSeats = ride.seats - 1;

      await updateDoc(doc(db, "rides", ride.id), {
        seats: newSeats,
        status: newSeats <= 0 ? "full" : "active",
      });

      setReservedRideIds((previous) => [...previous, ride.id]);
      setMessage("Seat reserved successfully.");

      await loadRides();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoadingRideId("");
    }
  }

  useEffect(() => {
    async function loadPage() {
      await loadRides();
      await loadUserBookings();
    }

    loadPage();
  }, []);

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <button type="button" className="miniButton" onClick={() => router.back()}>
            ← Back
          </button>

          <Link href="/" className="miniButton">
            Home
          </Link>

          <Link href="/profile" className="miniButton">
            Profile
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>
          Find a <span>Ride</span>
        </h1>

        <p className="subtitle">
          Discover available long-distance rides published by verified drivers.
        </p>

        <div className="mainActions">
          <Link href="/offer-ride" className="primaryButton">
            Offer a Ride
          </Link>

          <button type="button" className="secondaryTopButton" onClick={loadRides}>
            Refresh Rides
          </button>
        </div>
      </section>

      <section className="results">
        {message && <p className="message">{message}</p>}

        {rides.map((ride) => {
          const user = auth.currentUser;
          const alreadyReserved = reservedRideIds.includes(ride.id);
          const isOwnRide = user?.uid && ride.driverId === user.uid;
          const noSeats = ride.seats <= 0;

          return (
            <div key={ride.id} className="rideCard">
              <div className="routeHeader">
                <div>
                  <p className="label">ROUTE</p>
                  <h2>
                    {ride.from} <span>→</span> {ride.to}
                  </h2>
                </div>

                <div className="priceBox">
                  <span>PRICE</span>
                  <strong>${ride.price}</strong>
                </div>
              </div>

              <div className="chips">
                <div className="chip">📅 {ride.date}</div>
                <div className="chip">🕒 {ride.time}</div>
                <div className="chip">💺 {ride.seats} seats</div>
                <div className="chip active">● {ride.status}</div>
              </div>

              <div className="infoGrid">
                <Info label="Vehicle" value={ride.vehicle} icon="🚘" />
                <Info
                  label="Driver"
                  value={ride.driverEmail || "RoadLink Driver"}
                  icon="👤"
                />
                {ride.notes && <Info label="Notes" value={ride.notes} icon="📝" />}
              </div>

              {isOwnRide && <p className="warning">This is your own ride.</p>}

              <div className="cardButtons">
                <Link
                  href={`/driver-profile?driverId=${ride.driverId || ""}`}
                  className="outlineButton"
                >
                  View Driver Profile
                </Link>

                <Link href={`/ride-details?rideId=${ride.id}`} className="outlineButton">
                  View Details
                </Link>
              </div>

              <button
                className="reserve"
                onClick={() => reserveSeat(ride)}
                disabled={loadingRideId === ride.id || alreadyReserved || isOwnRide || noSeats}
              >
                {loadingRideId === ride.id
                  ? "Reserving..."
                  : alreadyReserved
                  ? "Already Reserved"
                  : isOwnRide
                  ? "Your Own Ride"
                  : noSeats
                  ? "No Seats Available"
                  : "Reserve Seat"}
              </button>
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
        .results {
          max-width: 820px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 30px;
          padding: 28px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
          margin-bottom: 28px;
        }

        .topActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
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
          cursor: pointer;
        }

        .logo {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .logo span,
        h1 span,
        .active,
        .priceBox strong {
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

        .mainActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 30px;
        }

        .primaryButton,
        .secondaryTopButton {
          width: 100%;
          padding: 18px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        }

        .primaryButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          border: none;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .secondaryTopButton {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 26px 0;
        }

        .rideCard {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 28px;
          padding: 28px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
          margin-bottom: 24px;
        }

        .routeHeader {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: start;
        }

        .label {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
          margin: 0 0 8px;
        }

        h2 {
          font-size: 34px;
          line-height: 1.15;
          margin: 0;
        }

        h2 span {
          color: #22c55e;
        }

        .priceBox {
          min-width: 110px;
          padding: 16px;
          border-radius: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          text-align: center;
        }

        .priceBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .priceBox strong {
          font-size: 34px;
          font-weight: 900;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 24px 0;
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

        .warning {
          color: #fbbf24;
          font-weight: 900;
          margin: 18px 0 0;
        }

        .cardButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 24px;
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

        .reserve {
          width: 100%;
          padding: 18px;
          margin-top: 16px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .reserve:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        @media (max-width: 600px) {
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

          .routeHeader {
            grid-template-columns: 1fr;
          }

          .priceBox {
            text-align: left;
          }

          .mainActions,
          .cardButtons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
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
