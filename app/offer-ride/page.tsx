"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { addDoc, collection } from "firebase/firestore";

export default function OfferRidePage() {
  const router = useRouter();

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

    const user = auth.currentUser;

    if (!user) {
      setMessage("Please sign in before publishing a ride.");
      router.push("/login");
      return;
    }

    if (!from || !to || !date || !time || !price || !vehicle) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (Number(price) <= 0) {
      setMessage("Price must be greater than 0.");
      return;
    }

    if (Number(seats) <= 0) {
      setMessage("Seats must be greater than 0.");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "rides"), {
        driverId: user.uid,
        driverEmail: user.email || "",
        from: from.trim(),
        to: to.trim(),
        date,
        time,
        seats: Number(seats),
        originalSeats: Number(seats),
        price: Number(price),
        vehicle: vehicle.trim(),
        notes: notes.trim(),
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

      setTimeout(() => {
        router.push("/find-ride");
      }, 800);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

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

          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>

          <Link href="/profile" className="miniButton">
            Profile
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <h1>
          Offer a <span>Ride</span>
        </h1>

        <p className="subtitle">
          Publish your route, set your price, and let passengers join your trip.
        </p>
      </section>

      <section className="formCard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Trip Route</p>
            <h2>Where are you going?</h2>
          </div>

          <div className="carBadge">🚗</div>
        </div>

        <div className="routeGrid">
          <Field label="From *" icon="📍">
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="City or address"
            />
          </Field>

          <Field label="To *" icon="🏁">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="City or address"
            />
          </Field>
        </div>

        <div className="grid">
          <Field label="Date *" icon="📅">
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              type="date"
            />
          </Field>

          <Field label="Departure Time *" icon="🕒">
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              type="time"
            />
          </Field>
        </div>

        <div className="grid">
          <Field label="Available Seats *" icon="💺">
            <select value={seats} onChange={(e) => setSeats(e.target.value)}>
              <option value="1">1 seat</option>
              <option value="2">2 seats</option>
              <option value="3">3 seats</option>
              <option value="4">4 seats</option>
              <option value="5">5 seats</option>
              <option value="6">6 seats</option>
            </select>
          </Field>

          <Field label="Price per Seat *" icon="💵">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="1"
              placeholder="45"
            />
          </Field>
        </div>

        <Field label="Vehicle *" icon="🚘">
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Toyota Camry, Honda CR-V, Nissan Altima..."
          />
        </Field>

        <Field label="Trip Notes" icon="📝">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="No smoking, small luggage allowed, pickup location..."
          />
        </Field>

        <section className="previewCard">
          <p className="eyebrow">Live Preview</p>

          <h3>
            {from || "Starting point"} <span>→</span> {to || "Destination"}
          </h3>

          <div className="chips">
            <div className="chip">📅 {date || "Date"}</div>
            <div className="chip">🕒 {time || "Time"}</div>
            <div className="chip">💺 {seats} seat{seats === "1" ? "" : "s"}</div>
            <div className="chip green">${price || "0"}</div>
          </div>

          <p>{vehicle || "Vehicle information will appear here."}</p>
        </section>

        <button onClick={publishRide} disabled={loading} className="publishButton">
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
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .formCard {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .formCard,
        .previewCard {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
        }

        .hero {
          border-radius: 32px;
          padding: 30px;
          margin-bottom: 24px;
        }

        .formCard {
          border-radius: 32px;
          padding: 30px;
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
          cursor: pointer;
        }

        .logo {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .logo span,
        h1 span,
        h3 span,
        .green,
        .eyebrow {
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

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          margin-bottom: 26px;
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
          margin: 0;
        }

        .carBadge {
          min-width: 76px;
          height: 76px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
        }

        .routeGrid,
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .field {
          margin-bottom: 18px;
        }

        .labelRow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 9px;
          color: #e5e7eb;
          font-weight: 900;
        }

        .fieldIcon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
        }

        input,
        select,
        textarea {
          width: 100%;
          display: block;
          padding: 17px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 16px;
          outline: none;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.10);
        }

        input::placeholder,
        textarea::placeholder {
          color: #71717a;
        }

        select option {
          background: #020617;
          color: white;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
        }

        .previewCard {
          border-radius: 24px;
          padding: 22px;
          margin-top: 10px;
          margin-bottom: 24px;
        }

        .previewCard h3 {
          font-size: 28px;
          line-height: 1.2;
          margin: 0 0 18px;
        }

        .previewCard p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
        }

        .publishButton {
          width: 100%;
          padding: 20px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 19px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .publishButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }

        .message {
          color: #22c55e;
          text-align: center;
          margin-top: 18px;
          font-weight: 900;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .hero,
          .formCard {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 50px;
          }

          h2 {
            font-size: 30px;
          }

          .routeGrid,
          .grid {
            grid-template-columns: 1fr;
          }

          .sectionHeader {
            align-items: flex-start;
          }

          .carBadge {
            min-width: 58px;
            height: 58px;
            font-size: 26px;
          }
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <div className="labelRow">
        <div className="fieldIcon">{icon}</div>
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}
