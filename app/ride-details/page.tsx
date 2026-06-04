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
  driverId?: string;
  status?: string;
};

export default function RideDetailsPage() {
  const [ride, setRide] = useState<Ride | null>(null);
  const [rideId, setRideId] = useState("");
  const [message, setMessage] = useState("Loading ride details...");

  useEffect(() => {
    async function loadRide() {
      try {
        const params = new URLSearchParams(window.location.search);
        const currentRideId = params.get("rideId") || "";

        if (!currentRideId) {
          setMessage("No ride selected.");
          return;
        }

        setRideId(currentRideId);

        const rideRef = doc(db, "rides", currentRideId);
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
        <div className="topActions">
          <Link href="/find-ride" className="miniButton">
            ← Back
          </Link>

          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>

          <Link href="/profile" className="miniButton">
            Profile
          </Link>
        </div>

        <h1>
          Ride <span>Details</span>
        </h1>

        <p className="subtitle">
          Review the route, driver information, price, safety details, and trip status.
        </p>
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
              <h2>{ride.from || "Starting point"}</h2>

              <span>TO</span>
              <h2>{ride.to || "Destination"}</h2>

              <div className="chips">
                <div className="chip">📅 {ride.date || "Date not set"}</div>
                <div className="chip">🕒 {ride.time || "Time not set"}</div>
                <div className="chip active">● {ride.status || "Active"}</div>
              </div>
            </div>

            <div className="carIcon">🚗</div>
          </section>

          <section className="infoCard">
            <p className="eyebrow">Trip Overview</p>
            <h3>🚗 Ride Information</h3>

            <Info label="Price" value={`$${ride.price || 0}`} icon="💵" green />
            <Info label="Seats Available" value={ride.seats ?? 0} icon="💺" />
            <Info label="Vehicle" value={ride.vehicle || "Not provided"} icon="🚘" />
            <Info label="Driver" value={ride.driverEmail || "RoadLink Driver"} icon="👤" />
            <Info label="Status" value={ride.status || "Active"} icon="🛡️" green />
            <Info label="Notes" value={ride.notes || "No notes"} icon="📝" />
          </section>

          <section className="driverCard">
            <div>
              <p className="eyebrow">Driver Experience</p>
              <h3>⭐ Driver Trust</h3>
              <p>
                View the driver profile, check verification status, and leave a rating
                after your trip.
              </p>
            </div>

            <div className="driverStats">
              <div>
                <strong>New</strong>
                <span>Rating</span>
              </div>

              <div>
                <strong>0</strong>
                <span>Trips</span>
              </div>

              <div>
                <strong>Verified</strong>
                <span>Status</span>
              </div>
            </div>

            <div className="driverButtons">
              <Link
                href={`/driver-profile?driverId=${ride.driverId || ""}`}
                className="outlineButton"
              >
                View Driver Profile
              </Link>

              <Link
                href={`/rate-driver?rideId=${rideId}&driverId=${ride.driverId || ""}`}
                className="outlineButton greenOutline"
              >
                ⭐ Rate Driver
              </Link>
            </div>
          </section>

          <section className="safetyCard">
            <div>
              <p className="eyebrow">Safety</p>
              <h3>🛡️ Safety First</h3>
              <p>
                RoadLink helps passengers review ride details before booking.
                Always confirm pickup location, luggage space, and trip rules with the driver.
              </p>
            </div>

            <div className="shield">✓</div>
          </section>

          <div className="bottomActions">
            <Link href="/find-ride" className="bookButton">
              📅 Back to Available Rides
            </Link>

            <Link href="/my-bookings" className="secondaryButton">
              View My Bookings
            </Link>
          </div>
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
        .driverCard,
        .safetyCard,
        .bottomActions {
          max-width: 820px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .routeCard,
        .infoCard,
        .driverCard,
        .safetyCard {
          background: rgba(8, 13, 25, 0.88);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 30px;
          padding: 28px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
          margin-bottom: 22px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 32px;
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

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 14px;
          letter-spacing: -1px;
        }

        h1 span,
        .active,
        .greenValue,
        .eyebrow {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .message {
          max-width: 820px;
          margin: 24px auto;
          color: #22c55e;
          font-weight: 900;
          text-align: center;
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
          font-size: 30px;
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
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
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

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .infoCard h3,
        .driverCard h3,
        .safetyCard h3 {
          margin: 0 0 18px;
          font-size: 26px;
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
          font-weight: 900;
        }

        .infoValue {
          color: #f9fafb;
          font-weight: 900;
          text-align: right;
          max-width: 280px;
          overflow-wrap: anywhere;
        }

        .driverCard p,
        .safetyCard p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        .driverStats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 24px 0;
        }

        .driverStats div {
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .driverStats strong {
          display: block;
          color: #22c55e;
          font-size: 22px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .driverStats span {
          color: #a1a1aa;
          font-weight: 800;
        }

        .driverButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .outlineButton,
        .secondaryButton {
          display: block;
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 16px;
          font-weight: 900;
        }

        .greenOutline {
          border-color: rgba(34,197,94,0.45);
          color: #22c55e;
        }

        .safetyCard {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
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

        .bottomActions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-top: 28px;
        }

        .bookButton {
          display: block;
          width: 100%;
          padding: 20px;
          border-radius: 18px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-align: center;
          text-decoration: none;
          font-size: 20px;
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

          .driverStats,
          .driverButtons {
            grid-template-columns: 1fr;
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
