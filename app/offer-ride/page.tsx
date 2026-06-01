"use client";

import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import { addDoc, collection } from "firebase/firestore";

export default function OfferRidePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState("1");
  const [price, setPrice] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function publishRide() {
    setMessage("");

    if (!from || !to || !date || !time || !price || !vehicle) {
      setMessage("Please complete all required fields.");
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;

      await addDoc(collection(db, "rides"), {
        driverId: user?.uid || "guest",
        driverEmail: user?.email || "",
        from,
        to,
        date,
        time,
        seats: Number(seats),
        price: Number(price),
        vehicle,
        notes,
        status: "active",
        createdAt: new Date().toISOString(),
      });

      setMessage("Ride published successfully.");
      setFrom("");
      setTo("");
      setDate("");
      setTime("");
      setSeats("1");
      setPrice("");
      setVehicle("");
      setNotes("");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>Offer a Ride</h1>
        <p className="subtitle">
          Publish your route and let passengers join your trip.
        </p>

        <label>From</label>
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="City or address"
        />

        <label>To</label>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="City or address"
        />

        <label>Date</label>
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          type="date"
        />

        <label>Departure Time</label>
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          type="time"
        />

        <label>Available Seats</label>
        <select value={seats} onChange={(e) => setSeats(e.target.value)}>
          <option value="1">1 seat</option>
          <option value="2">2 seats</option>
          <option value="3">3 seats</option>
          <option value="4">4 seats</option>
          <option value="5">5 seats</option>
          <option value="6">6 seats</option>
        </select>

        <label>Price per Seat</label>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          min="1"
          placeholder="45"
        />

        <label>Vehicle</label>
        <input
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
          placeholder="Toyota Camry, Honda CR-V, etc."
        />

        <label>Trip Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="No smoking, small luggage allowed, pickup location..."
        />

        <button onClick={publishRide} disabled={loading}>
          {loading ? "Publishing..." : "Publish Ride"}
        </button>

        {message && <p className="message">{message}</p>}
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          width: 100%;
          background: linear-gradient(135deg, #000000, #0f172a, #111827);
          padding: 18px;
          font-family: Arial, sans-serif;
          color: white;
          overflow-x: hidden;
        }

        .card {
          width: 100%;
          max-width: 620px;
          margin: 0 auto;
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 26px;
          padding: 28px;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
        }

        .logo {
          font-size: 28px;
          font-weight: 900;
          margin-bottom: 26px;
        }

        .logo span {
          color: #22c55e;
        }

        h1 {
          font-size: 38px;
          margin: 0 0 10px;
        }

        .subtitle {
          color: #a1a1aa;
          line-height: 1.5;
          margin-bottom: 26px;
        }

        label {
          display: block;
          margin-top: 16px;
          margin-bottom: 8px;
          color: #d4d4d8;
          font-weight: 700;
        }

        input,
        select,
        textarea {
          width: 100%;
          display: block;
          padding: 15px;
          border-radius: 14px;
          border: 1px solid #333;
          background: #111;
          color: white;
          font-size: 16px;
          outline: none;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #22c55e;
        }

        textarea {
          min-height: 110px;
          resize: vertical;
        }

        button {
          width: 100%;
          padding: 17px;
          margin-top: 26px;
          border-radius: 999px;
          border: none;
          background: #22c55e;
          color: white;
          font-size: 17px;
          font-weight: 800;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .message {
          color: #22c55e;
          text-align: center;
          margin-top: 18px;
          font-weight: 700;
        }

        @media (max-width: 480px) {
          .page {
            padding: 12px;
          }

          .card {
            padding: 22px;
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
