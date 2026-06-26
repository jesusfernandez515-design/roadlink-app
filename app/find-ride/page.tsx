"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

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
  distanceText?: string;
  durationText?: string;
  distanceMiles?: number;
  durationMinutes?: number;
  mapUrl?: string;
  suggestedPrice?: number;
  originalSeats?: number;
};

export default function FindRidePage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [rides, setRides] = useState<Ride[]>([]);
  const [reservedRideIds, setReservedRideIds] = useState<string[]>([]);
  const [message, setMessage] = useState("Checking account...");
  const [loadingRideId, setLoadingRideId] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadRides() {
    try {
      setLoading(true);
      setMessage("Loading rides...");

      const ridesQuery = query(collection(db, "rides"), where("status", "==", "active"));
      const snapshot = await getDocs(ridesQuery);

      const ridesData = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Ride[];

      const sorted = ridesData.sort((a, b) => {
        const dateA = new Date(`${a.date || ""} ${a.time || ""}`).getTime();
        const dateB = new Date(`${b.date || ""} ${b.time || ""}`).getTime();
        return dateA - dateB;
      });

      setRides(sorted);
      setMessage(sorted.length ? "" : "No rides available yet.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not load rides.");
    } finally {
      setLoading(false);
    }
  }

  async function loadUserBookings(currentUserId: string, currentEmail: string) {
    try {
      if (!currentUserId && !currentEmail) {
        setReservedRideIds([]);
        return;
      }

      const activeStatuses = [
        "reserved",
        "confirmed",
        "payment_pending",
        "paid",
        "completed",
      ];

      const ids = new Set<string>();

      if (currentUserId) {
        const byUidQuery = query(
          collection(db, "bookings"),
          where("passengerId", "==", currentUserId)
        );

        const byUidSnapshot = await getDocs(byUidQuery);

        byUidSnapshot.docs.forEach((item) => {
          const data = item.data();
          if (activeStatuses.includes(String(data.status || "")) && data.rideId) {
            ids.add(String(data.rideId));
          }
        });
      }

      if (currentEmail) {
        const byEmailQuery = query(
          collection(db, "bookings"),
          where("passengerEmail", "==", currentEmail)
        );

        const byEmailSnapshot = await getDocs(byEmailQuery);

        byEmailSnapshot.docs.forEach((item) => {
          const data = item.data();
          if (activeStatuses.includes(String(data.status || "")) && data.rideId) {
            ids.add(String(data.rideId));
          }
        });
      }

      setReservedRideIds(Array.from(ids));
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not load your bookings.");
    }
  }

  async function refreshPageData(currentUserId: string, currentEmail: string) {
    await loadRides();
    await loadUserBookings(currentUserId, currentEmail);
  }

  function routeMapUrl(ride: Ride) {
    if (ride.mapUrl) return ride.mapUrl;

    if (!ride.from || !ride.to) return "";

    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      ride.from
    )}&destination=${encodeURIComponent(ride.to)}&travelmode=driving`;
  }

  async function reserveSeat(ride: Ride) {
    setMessage("");

    if (!userId) {
      setMessage("Please sign in before reserving a seat.");
      router.push("/login");
      return;
    }

    if (!ride.id) {
      setMessage("Ride ID is missing. Please refresh and try again.");
      return;
    }

    if (ride.driverId === userId) {
      setMessage("You cannot reserve your own ride.");
      return;
    }

    if (Number(ride.seats || 0) <= 0) {
      setMessage("No seats available for this ride.");
      return;
    }

    try {
      setLoadingRideId(ride.id);

      const duplicateQuery = query(
        collection(db, "bookings"),
        where("rideId", "==", ride.id),
        where("passengerId", "==", userId)
      );

      const duplicateSnapshot = await getDocs(duplicateQuery);

      const activeStatuses = [
        "reserved",
        "confirmed",
        "payment_pending",
        "paid",
        "completed",
      ];

      const hasActiveBooking = duplicateSnapshot.docs.some((item) => {
        const data = item.data();
        return activeStatuses.includes(String(data.status || ""));
      });

      if (hasActiveBooking) {
        setMessage("You already reserved this ride.");
        setReservedRideIds((previous) =>
          previous.includes(ride.id) ? previous : [...previous, ride.id]
        );
        router.push("/my-bookings");
        return;
      }

      const now = new Date().toISOString();
      const bookingRef = doc(collection(db, "bookings"));
      const rideRef = doc(db, "rides", ride.id);

      const bookingPayload = await runTransaction(db, async (transaction) => {
        const rideSnap = await transaction.get(rideRef);

        if (!rideSnap.exists()) {
          throw new Error("Ride no longer exists.");
        }

        const liveRide = rideSnap.data() as Ride;
        const liveSeats = Number(liveRide.seats || 0);
        const liveStatus = String(liveRide.status || "");

        if (liveStatus !== "active") {
          throw new Error("This ride is no longer active.");
        }

        if (liveSeats <= 0) {
          throw new Error("No seats available for this ride.");
        }

        const amount = Number(liveRide.price || ride.price || 0);
        const platformFee = Math.round(amount * 0.12 * 100) / 100;
        const driverAmount = Math.max(amount - platformFee, 0);
        const newSeats = liveSeats - 1;

        const payload = {
          rideId: ride.id,

          passengerId: userId,
          passengerEmail: userEmail,
          passengerEmailLower: userEmail.toLowerCase(),

          driverId: liveRide.driverId || ride.driverId || "",
          driverEmail: liveRide.driverEmail || ride.driverEmail || "",

          from: liveRide.from || ride.from || "",
          to: liveRide.to || ride.to || "",
          date: liveRide.date || ride.date || "",
          time: liveRide.time || ride.time || "",

          price: amount,
          amount,
          platformFee,
          driverAmount,
          currency: "USD",
          seatsBooked: 1,

          distanceText: liveRide.distanceText || ride.distanceText || "",
          durationText: liveRide.durationText || ride.durationText || "",
          distanceMiles: Number(liveRide.distanceMiles || ride.distanceMiles || 0),
          durationMinutes: Number(liveRide.durationMinutes || ride.durationMinutes || 0),
          mapUrl: liveRide.mapUrl || routeMapUrl(ride),

          status: "reserved",
          paymentStatus: "unpaid",
          paymentId: "",
          stripeCheckoutSessionId: "",

          createdAt: now,
          updatedAt: now,
        };

        transaction.set(bookingRef, payload);

        transaction.update(rideRef, {
          seats: newSeats,
          status: newSeats <= 0 ? "full" : "active",
          updatedAt: now,
        });

        return payload;
      });

      if (bookingPayload.driverId) {
        await addDoc(collection(db, "notifications"), {
          userId: bookingPayload.driverId,
          email: bookingPayload.driverEmail,
          type: "booking",
          title: "New Ride Booking",
          message: `${userEmail} reserved a seat from ${bookingPayload.from} to ${bookingPayload.to}.`,
          rideId: ride.id,
          bookingId: bookingRef.id,
          passengerId: userId,
          passengerEmail: userEmail,
          driverId: bookingPayload.driverId,
          driverEmail: bookingPayload.driverEmail,
          read: false,
          createdAt: now,
          actionUrl: `/ride-passengers?rideId=${ride.id}`,
        });
      }

      await addDoc(collection(db, "auditLogs"), {
        action: "Ride Seat Reserved",
        targetId: bookingRef.id,
        targetType: "booking",
        details: `${userEmail} reserved ${bookingPayload.from} to ${bookingPayload.to}`,
        severity: "success",
        createdAt: now,
      });

      setReservedRideIds((previous) =>
        previous.includes(ride.id) ? previous : [...previous, ride.id]
      );

      setMessage("Seat reserved. Continue to My Bookings to pay.");
      await refreshPageData(userId, userEmail);

      router.push("/my-bookings");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not reserve this ride.");
    } finally {
      setLoadingRideId("");
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view available rides.");
        router.push("/login");
        return;
      }

      const email = user.email || "";

      setUserId(user.uid);
      setUserEmail(email);

      await refreshPageData(user.uid, email);
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <button type="button" className="miniButton" onClick={() => router.back()}>
            ← Back
          </button>

          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/messages" className="miniButton">Messages</Link>
          <Link href="/notifications" className="miniButton">Notifications</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
        </div>

        <div className="logo">Road<span>Link</span></div>

        <p className="eyebrow">Verified Ride Marketplace</p>

        <h1>Find a <span>Ride</span></h1>

        <p className="subtitle">
          Discover available rides, preview routes, reserve your seat and continue to secure payment.
        </p>

        <div className="mainActions">
          <Link href="/offer-ride" className="primaryButton">
            Offer a Ride
          </Link>

          <button
            type="button"
            className="secondaryTopButton"
            onClick={() => refreshPageData(userId, userEmail)}
            disabled={loading || !userId}
          >
            {loading ? "Refreshing..." : "Refresh Rides"}
          </button>
        </div>
      </section>

      <section className="results">
        {message && <p className="message">{message}</p>}

        {rides.map((ride) => {
          const alreadyReserved = reservedRideIds.includes(ride.id);
          const isOwnRide = Boolean(userId && ride.driverId === userId);
          const noSeats = Number(ride.seats || 0) <= 0;
          const mapLink = routeMapUrl(ride);

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

              <div className="routeStats">
                <Stat label="Distance" value={ride.distanceText || "Not available"} />
                <Stat label="Duration" value={ride.durationText || "Not available"} />
                <Stat
                  label="Miles"
                  value={ride.distanceMiles ? `${ride.distanceMiles} mi` : "Not available"}
                />
                <Stat
                  label="Suggested"
                  value={ride.suggestedPrice ? `$${ride.suggestedPrice}` : "Not available"}
                />
              </div>

              <div className="infoGrid">
                <Info label="Vehicle" value={ride.vehicle || "Not specified"} icon="🚘" />
                <Info label="Driver" value={ride.driverEmail || "RoadLink Driver"} icon="👤" />
                {ride.notes && <Info label="Notes" value={ride.notes} icon="📝" />}
              </div>

              {mapLink && (
                <a href={mapLink} target="_blank" rel="noreferrer" className="mapButton">
                  🗺️ Open Route in Google Maps
                </a>
              )}

              {isOwnRide && <p className="warning">This is your own ride.</p>}

              <div className="cardButtons">
                <Link href={`/driver-profile?driverId=${ride.driverId || ""}`} className="outlineButton">
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
                  : "Reserve Seat & Continue to Pay"}
              </button>
            </div>
          );
        })}
      </section>

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
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .results {
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 32px;
          padding: 30px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
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
        .active,
        .priceBox strong,
        .eyebrow,
        .statBox strong {
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
          line-height: 1.5;
        }

        .rideCard {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 30px;
          padding: 28px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
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
          overflow-wrap: anywhere;
        }

        h2 span {
          color: #22c55e;
        }

        .priceBox {
          min-width: 120px;
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

        .routeStats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }

        .statBox {
          padding: 13px;
          border-radius: 16px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.18);
        }

        .statBox span {
          display: block;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .statBox strong {
          display: block;
          overflow-wrap: anywhere;
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

        .mapButton {
          display: flex;
          justify-content: center;
          width: 100%;
          padding: 15px;
          margin-top: 16px;
          border-radius: 999px;
          background: rgba(59,130,246,0.15);
          border: 1px solid rgba(59,130,246,0.35);
          color: #93c5fd;
          text-decoration: none;
          font-weight: 900;
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
            padding-bottom: 140px;
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

          .routeHeader,
          .mainActions,
          .cardButtons,
          .routeStats {
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="statBox">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
