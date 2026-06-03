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
      <section className="headerCard">
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

        <h1>Find a Ride</h1>
        <p>Available rides published by drivers.</p>

        <div className="mainActions">
          <Link href="/offer-ride" className="actionButton">
            Offer a Ride
          </Link>

          <button type="button" className="actionButton dark" onClick={loadRides}>
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
              <div className="topRow">
                <div>
                  <h3>
                    {ride.from} → {ride.to}
                  </h3>
                  <p>
                    {ride.date} • {ride.time}
                  </p>
                </div>

                <div className="price">${ride.price}</div>
              </div>

              <div className="details">
                <p>
                  <strong>Seats:</strong> {ride.seats}
                </p>

                <p>
                  <strong>Vehicle:</strong> {ride.vehicle}
                </p>

                <p>
                  <strong>Driver:</strong>{" "}
                  {ride.driverEmail || "RoadLink Driver"}
                </p>

                {ride.notes && (
                  <p>
                    <strong>Notes:</strong> {ride.notes}
                  </p>
                )}
              </div>

              {isOwnRide && (
                <p className="warning">This is your own ride.</p>
              )}

              <div className="cardButtons">
                <Link
                  href={`/driver-profile?driverId=${ride.driverId || ""}`}
                  className="secondaryButton"
                >
                  View Driver Profile
                </Link>

                <Link
                  href={`/ride-details?rideId=${ride.id}`}
                  className="secondaryButton"
                >
                  View Details
                </Link>
              </div>

              <button
                className="reserve"
                onClick={() => reserveSeat(ride)}
                disabled={
                  loadingRideId === ride.id ||
                  alreadyReserved ||
                  isOwnRide ||
                  noSeats
                }
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
          background: linear-gradient(135deg, #000, #0f172a, #111827);
          color: white;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .headerCard {
          max-width: 760px;
          margin: 0 auto 30px;
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 26px;
          padding: 24px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.45);
        }

        .topActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }

        .miniButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid #333;
          background: #111;
          color: white;
          text-decoration: none;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
        }

        .logo {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 24px;
        }

        .logo span {
          color: #22c55e;
        }

        h1 {
          font-size: 42px;
          margin: 0 0 10px;
        }

        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .mainActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 24px;
        }

        .actionButton {
          display: block;
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          border: none;
          background: #22c55e;
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
        }

        .actionButton.dark {
          background: #111;
          border: 1px solid #333;
        }

        .results {
          max-width: 760px;
          margin: 0 auto;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 800;
          margin: 24px 0;
        }

        .warning {
          color: #fbbf24;
          font-weight: 800;
        }

        .rideCard {
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 18px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        }

        .topRow {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        h3 {
          margin: 0;
          font-size: 26px;
          line-height: 1.25;
        }

        .price {
          color: #22c55e;
          font-size: 32px;
          font-weight: 900;
          white-space: nowrap;
        }

        .details {
          margin-top: 20px;
        }

        .details p {
          margin: 12px 0;
          font-size: 17px;
        }

        .details strong {
          color: #d4d4d8;
        }

        .cardButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 22px;
        }

        .secondaryButton {
          display: block;
          width: 100%;
          padding: 14px;
          border-radius: 999px;
          border: 1px solid #333;
          background: #111;
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
        }

        .reserve {
          width: 100%;
          padding: 17px;
          margin-top: 16px;
          border: none;
          border-radius: 999px;
          background: #22c55e;
          color: white;
          font-weight: 900;
          font-size: 17px;
          cursor: pointer;
        }

        .reserve:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 480px) {
          .page {
            padding: 12px;
          }

          .headerCard,
          .rideCard {
            border-radius: 24px;
            padding: 22px;
          }

          h1 {
            font-size: 38px;
          }

          h3 {
            font-size: 24px;
          }

          .topRow {
            flex-direction: column;
          }

          .mainActions,
          .cardButtons {
            grid-template-columns: 1fr;
          }

          .price {
            font-size: 30px;
          }
        }
      `}</style>
    </main>
  );
}
