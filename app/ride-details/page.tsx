"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type Ride = {
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  seats?: number;
  price?: number;
  vehicle?: string;
  notes?: string;
  driverEmail?: string;
  status?: string;
};

export default function RideDetailsPage() {
  const [ride, setRide] = useState<Ride | null>(null);
  const [message, setMessage] = useState("Loading ride details...");

  useEffect(() => {
    async function loadRide() {
      try {
        const params = new URLSearchParams(window.location.search);
        const rideId = params.get("rideId");

        if (!rideId) {
          setMessage("No ride selected.");
          return;
        }

        const rideRef = doc(db, "rides", rideId);
        const rideSnap = await getDoc(rideRef);

        if (!rideSnap.exists()) {
          setMessage("Ride not found.");
          return;
        }

        setRide(rideSnap.data() as Ride);
        setMessage("");
      } catch (error: any) {
        setMessage(error.message);
      }
    }

    loadRide();
  }, []);

  return (
    <main className="page">
      <section className="hero">
        <Link href="/find-ride" className="backButton">
          ← Back
        </Link>

        <h1>
          Ride <span>Details</span>
        </h1>
        <p className="subtitle">View all the details about this ride</p>
      </section>

      {message && <p className="message">{message}</p>}

      {ride && (
        <>
          <section className="routeCard">
            <div className="routeLine">
              <div className="dot" />
              <div className="line" />
              <div className="dot" />
            </div>

            <div className="routeInfo">
              <span>FROM</span>
              <h2>{ride.from}</h2>

              <span>TO</span>
              <h2>{ride.to}</h2>

              <div className="chips">
                <div className="chip">📅 {ride.date}</div>
                <div className="chip">🕒 {ride.time}</div>
                <div className="chip active">● {ride.status || "Active"}</div>
              </div>
            </div>

            <div className="carIcon">🚗</div>
          </section>

          <section className="infoCard">
            <h3>🚗 Ride Information</h3>

            <Info label="Price" value={`$${ride.price}`} icon="💵" green />
            <Info label="Seats Available" value={ride.seats ?? 0} icon="💺" />
            <Info label="Vehicle" value={ride.vehicle || "Not provided"} icon="🚘" />
            <Info label="Driver" value={ride.driverEmail || "RoadLink Driver"} icon="👤" />
            <Info label="Status" value={ride.status || "Active"} icon="🛡️" green />
            <Info label="Notes" value={ride.notes || "No notes"} icon="📝" />
          </section>

          <section className="safetyCard">
            <div>
              <h3>🛡️ Safety First</h3>
              <p>
                All RoadLink rides are reviewed for your safety. Driver and trip
                details are shown before booking.
              </p>
            </div>
            <div className="shield">✓</div>
          </section>

          <Link href="/find-ride" className="bookButton">
            📅 Book This Ride
          </Link>
        </>
      )}

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
        .routeCard,
        .infoCard,
        .safetyCard {
          max-width: 820px;
          margin-left: auto;
          margin-right: auto;
        }

        .backButton {
          display: inline-flex;
          align-items: center;
          padding: 10px 18px;
          border-radius: 999px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
          color: white;
          text-decoration: none;
          font-weight: 800;
          margin-bottom: 34px;
        }

        h1 {
          font-size: 54px;
          line-height: 1;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }

        h1 span,
        .active,
        .greenValue {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 20px;
          margin: 0 0 28px;
        }

        .message {
          max-width: 820px;
          margin: 24px auto;
          color: #22c55e;
          font-weight: 900;
          text-align: center;
        }

        .routeCard,
        .infoCard,
        .safetyCard {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 26px;
          padding: 28px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
          margin-bottom: 22px;
        }

        .routeCard {
          display: grid;
          grid-template-columns: 34px 1fr 110px;
          gap: 20px;
          align-items: center;
        }

        .routeLine {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 130px;
        }

        .dot {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 4px solid #22c55e;
        }

        .line {
          width: 4px;
          flex: 1;
          background: #22c55e;
          opacity: 0.85;
        }

        .routeInfo span {
          display: block;
          color: #22c55e;
          font-weight: 900;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .routeInfo h2 {
          font-size: 28px;
          margin: 0 0 24px;
          line-height: 1.15;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 700;
        }

        .carIcon {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          font-size: 42px;
        }

        .infoCard h3,
        .safetyCard h3 {
          margin: 0 0 18px;
          font-size: 24px;
        }

        .infoRow {
          display: grid;
          grid-template-columns: 46px 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 15px;
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 10px;
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

        .infoLabel {
          color: #e5e7eb;
          font-weight: 800;
        }

        .infoValue {
          color: #f9fafb;
          font-weight: 800;
          text-align: right;
          max-width: 280px;
          overflow-wrap: anywhere;
        }

        .safetyCard {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
        }

        .safetyCard p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        .shield {
          min-width: 78px;
          height: 78px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          font-size: 36px;
          font-weight: 900;
        }

        .bookButton {
          display: block;
          max-width: 820px;
          margin: 28px auto 0;
          padding: 20px;
          border-radius: 16px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 22px;
          font-weight: 900;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        @media (max-width: 600px) {
          .page {
            padding: 20px 16px 40px;
          }

          h1 {
            font-size: 46px;
          }

          .subtitle {
            font-size: 18px;
          }

          .routeCard {
            grid-template-columns: 28px 1fr;
          }

          .carIcon {
            display: none;
          }

          .routeInfo h2 {
            font-size: 26px;
          }

          .infoRow {
            grid-template-columns: 42px 1fr;
          }

          .infoValue {
            grid-column: 2;
            text-align: left;
          }

          .safetyCard {
            align-items: flex-start;
          }

          .shield {
            min-width: 58px;
            height: 58px;
            font-size: 28px;
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
  green,
}: {
  icon: string;
  label: string;
  value: string | number;
  green?: boolean;
}) {
  return (
    <div className="infoRow">
      <div className="infoIcon">{icon}</div>
      <div className="infoLabel">{label}</div>
      <div className={green ? "infoValue greenValue" : "infoValue"}>
        {value}
      </div>
    </div>
  );
}
