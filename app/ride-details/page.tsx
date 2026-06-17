"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Ride = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  originalSeats?: number;
  price: number;
  suggestedPrice?: number;
  vehicle?: string;
  notes?: string;
  status?: string;
  distanceText?: string;
  durationText?: string;
  distanceMiles?: number;
  durationMinutes?: number;
  mapUrl?: string;
};

export default function RideDetailsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RideDetailsContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <main className="page">
      <p className="message">Loading ride details...</p>

      <style>{`
        .page {
          min-height: 100vh;
          background: #020617;
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }
      `}</style>
    </main>
  );
}

function RideDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rideId = searchParams.get("rideId") || "";

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [ride, setRide] = useState<Ride | null>(null);
  const [alreadyReserved, setAlreadyReserved] = useState(false);
  const [message, setMessage] = useState("Loading ride details...");
  const [loading, setLoading] = useState(false);

  const isOwnRide = Boolean(ride?.driverId && userId && ride.driverId === userId);
  const noSeats = Number(ride?.seats || 0) <= 0;

  function routeMapUrl(currentRide: Ride) {
    if (currentRide.mapUrl) return currentRide.mapUrl;

    if (!currentRide.from || !currentRide.to) return "";

    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      currentRide.from
    )}&destination=${encodeURIComponent(currentRide.to)}&travelmode=driving`;
  }

  async function loadRide(currentUserId?: string) {
    if (!rideId) {
      setMessage("Ride not found.");
      return;
    }

    try {
      const rideRef = doc(db, "rides", rideId);
      const snapshot = await getDoc(rideRef);

      if (!snapshot.exists()) {
        setMessage("Ride not found.");
        return;
      }

      const rideData = {
        id: snapshot.id,
        ...snapshot.data(),
      } as Ride;

      setRide(rideData);
      setMessage("");

      if (currentUserId) {
        const bookingQuery = query(
          collection(db, "bookings"),
          where("rideId", "==", rideId),
          where("passengerId", "==", currentUserId),
          where("status", "==", "reserved")
        );

        const bookingSnapshot = await getDocs(bookingQuery);
        setAlreadyReserved(!bookingSnapshot.empty);
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  async function reserveSeat() {
    if (!ride) return;

    setMessage("");

    if (!userId) {
      setMessage("Please sign in before reserving a seat.");
      router.push("/login");
      return;
    }

    if (isOwnRide) {
      setMessage("You cannot reserve your own ride.");
      return;
    }

    if (alreadyReserved) {
      setMessage("You already reserved this ride.");
      return;
    }

    if (noSeats) {
      setMessage("No seats available for this ride.");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "bookings"), {
        rideId: ride.id,
        passengerId: userId,
        passengerEmail: userEmail,
        driverId: ride.driverId || "",
        driverEmail: ride.driverEmail || "",
        from: ride.from,
        to: ride.to,
        date: ride.date,
        time: ride.time,
        price: Number(ride.price || 0),
        suggestedPrice: Number(ride.suggestedPrice || 0),
        distanceText: ride.distanceText || "",
        durationText: ride.durationText || "",
        distanceMiles: Number(ride.distanceMiles || 0),
        durationMinutes: Number(ride.durationMinutes || 0),
        mapUrl: routeMapUrl(ride),
        seatsBooked: 1,
        status: "reserved",
        createdAt: new Date().toISOString(),
      });

      if (ride.driverId) {
        await addDoc(collection(db, "notifications"), {
          userId: ride.driverId,
          type: "booking",
          title: "New Ride Booking",
          message: `${userEmail} reserved a seat from ${ride.from} to ${ride.to}.`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      const newSeats = Number(ride.seats || 0) - 1;

      await updateDoc(doc(db, "rides", ride.id), {
        seats: newSeats,
        status: newSeats <= 0 ? "full" : "active",
      });

      setAlreadyReserved(true);
      setRide({
        ...ride,
        seats: newSeats,
        status: newSeats <= 0 ? "full" : "active",
      });

      setMessage("Seat reserved successfully. The driver has been notified.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view ride details.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      await loadRide(user.uid);
    });

    return () => unsubscribe();
  }, [router, rideId]);

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <button type="button" className="miniButton" onClick={() => router.back()}>
            ← Back
          </button>

          <Link href="/find-ride" className="miniButton">Find Rides</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
        </div>

        <div className="logo">Road<span>Link</span></div>

        <p className="eyebrow">Ride Details</p>

        <h1>Trip <span>Overview</span></h1>

        <p className="subtitle">
          Review the full route, driver, vehicle and travel information before reserving.
        </p>
      </section>

      {message && <p className="message">{message}</p>}

      {ride && (
        <section className="detailsCard">
          <div className="routeHeader">
            <div>
              <p className="label">ROUTE</p>
              <h2>{ride.from} <span>→</span> {ride.to}</h2>
            </div>

            <div className="priceBox">
              <span>PRICE</span>
              <strong>${ride.price}</strong>
            </div>
          </div>

          <div className="routeStats">
            <Stat label="Distance" value={ride.distanceText || "Not available"} />
            <Stat label="Duration" value={ride.durationText || "Not available"} />
            <Stat label="Miles" value={ride.distanceMiles ? `${ride.distanceMiles} mi` : "N/A"} />
            <Stat label="Suggested" value={ride.suggestedPrice ? `$${ride.suggestedPrice}` : "N/A"} />
          </div>

          <div className="chips">
            <div className="chip">📅 {ride.date}</div>
            <div className="chip">🕒 {ride.time}</div>
            <div className="chip">💺 {ride.seats} seats left</div>
            <div className="chip active">● {ride.status || "active"}</div>
          </div>

          <div className="infoGrid">
            <Info icon="🚘" label="Vehicle" value={ride.vehicle || "Not specified"} />
            <Info icon="👤" label="Driver" value={ride.driverEmail || "RoadLink Driver"} />
            <Info icon="💵" label="Price per Seat" value={`$${ride.price}`} />
            {ride.notes && <Info icon="📝" label="Trip Notes" value={ride.notes} />}
          </div>

          {routeMapUrl(ride) && (
            <a
              href={routeMapUrl(ride)}
              target="_blank"
              rel="noopener noreferrer"
              className="mapButton"
            >
              🗺️ Open Route in Google Maps
            </a>
          )}

          {isOwnRide && <p className="warning">This is your own ride.</p>}
          {alreadyReserved && <p className="success">You already reserved this ride.</p>}

          <div className="actions">
            <Link
              href={`/driver-profile?driverId=${ride.driverId || ""}`}
              className="outlineButton"
            >
              View Driver Profile
            </Link>

            <button
              className="reserve"
              onClick={reserveSeat}
              disabled={loading || alreadyReserved || isOwnRide || noSeats}
            >
              {loading
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
        </section>
      )}

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 150px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .detailsCard {
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
          background: rgba(8,13,25,0.9);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 32px;
          padding: 30px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero { margin-bottom: 28px; }

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
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
          cursor: pointer;
        }

        .logo {
          font-size: 38px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .logo span,
        h1 span,
        h2 span,
        .active,
        .priceBox strong,
        .eyebrow {
          color: #22c55e;
        }

        .eyebrow {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 10px;
        }

        h1 {
          font-size: 60px;
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

        .message {
          max-width: 860px;
          margin: 0 auto 24px;
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          line-height: 1.5;
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
          overflow-wrap: anywhere;
        }

        .priceBox {
          min-width: 125px;
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

        .routeStats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin: 24px 0;
        }

        .statBox {
          border-radius: 18px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.18);
          padding: 14px;
          min-height: 78px;
        }

        .statBox small {
          display: block;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .statBox strong {
          display: block;
          color: #22c55e;
          font-size: 17px;
          overflow-wrap: anywhere;
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

        .infoGrid { display: grid; gap: 10px; }

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

        .mapButton {
          display: block;
          margin-top: 18px;
          padding: 16px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
        }

        .warning {
          color: #fbbf24;
          font-weight: 900;
          margin: 18px 0 0;
        }

        .success {
          color: #22c55e;
          font-weight: 900;
          margin: 18px 0 0;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 24px;
        }

        .outlineButton,
        .reserve {
          width: 100%;
          padding: 17px;
          border-radius: 999px;
          text-align: center;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
        }

        .outlineButton {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
        }

        .reserve {
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .reserve:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        @media (max-width: 650px) {
          .page {
            padding: 16px;
            padding-bottom: 150px;
          }

          .hero,
          .detailsCard {
            padding: 24px;
            border-radius: 28px;
          }

          h1 { font-size: 48px; }
          h2 { font-size: 30px; }

          .routeHeader,
          .routeStats,
          .actions {
            grid-template-columns: 1fr;
          }

          .priceBox {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="statBox">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ icon, label, value }: { icon: string; label: string; value: string }) {
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
