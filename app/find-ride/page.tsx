"use client";

import { useEffect, useState } from "react";
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
  notes: string;
  status: string;
  driverEmail: string;
  driverId?: string;
};

export default function FindRidePage() {
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
      <section className="searchCard">
        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>Find a Ride</h1>
        <p>Available rides published by drivers.</p>
      </section>

      <section className="results">
        {message && <p className="message">{message}</p>}

        {rides.map((ride) => {
          const alreadyReserved = reservedRideIds.includes(ride.id);

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

              <button
                className="reserve"
                onClick={() => reserveSeat(ride)}
                disabled={loadingRideId === ride.id || alreadyReserved}
              >
                {loadingRideId === ride.id
                  ? "Reserving..."
                  : alreadyReserved
                  ? "Already Reserved"
                  : "Reserve Seat"}
              </button>
            </div>
          );
        })}
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, #000, #0f172a, #111827);
          color: white;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .searchCard {
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

        .logo span {
          color: #22c55e;
        }

        h1 {
          font-size: 38px;
          margin: 0 0 10px;
        }

        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .results {
          max-width: 700px;
          margin: 0 auto;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 700;
        }

        .rideCard {
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .topRow {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        h3 {
          margin: 0;
          font-size: 22px;
        }

        .price {
          color: #22c55e;
          font-size: 24px;
          font-weight: 800;
          white-space: nowrap;
        }

        .reserve {
          width: 100%;
          padding: 16px;
          margin-top: 16px;
          border: none;
          border-radius: 999px;
          background: #22c55e;
          color: white;
          font-weight: 800;
          font-size: 16px;
        }

        .reserve:disabled {
          opacity: 0.55;
        }

        @media (max-width: 480px) {
          .page {
            padding: 12px;
          }

          .searchCard,
          .rideCard {
            border-radius: 22px;
          }

          h1 {
            font-size: 34px;
          }

          .topRow {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
