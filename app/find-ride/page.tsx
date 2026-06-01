"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
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
  notes: string;
  status: string;
  driverEmail: string;
};

export default function FindRidePage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [message, setMessage] = useState("Loading rides...");

  async function loadRides() {
    try {
      const q = query(collection(db, "rides"), where("status", "==", "active"));
      const snapshot = await getDocs(q);

      const ridesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Ride[];

      setRides(ridesData);
      setMessage(ridesData.length ? "" : "No rides available yet.");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadRides();
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

        {rides.map((ride) => (
          <div key={ride.id} className="rideCard">
            <div className="topRow">
              <div>
                <h3>
                  {ride.from} → {ride.to}
                </h3>
                <p>{ride.date} • {ride.time}</p>
              </div>

              <div className="price">${ride.price}</div>
            </div>

            <p><strong>Seats:</strong> {ride.seats}</p>
            <p><strong>Vehicle:</strong> {ride.vehicle}</p>
            <p><strong>Driver:</strong> {ride.driverEmail || "RoadLink Driver"}</p>

            {ride.notes && <p><strong>Notes:</strong> {ride.notes}</p>}

            <button className="reserve">Reserve Seat</button>
          </div>
        ))}
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
