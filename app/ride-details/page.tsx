"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
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
  createdAt?: string;
};

type Booking = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  seatsBooked?: number;
  price?: number;
  createdAt?: string;
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [alreadyReserved, setAlreadyReserved] = useState(false);
  const [message, setMessage] = useState("Loading ride details...");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const isOwnRide = Boolean(ride?.driverId && userId && ride.driverId === userId);
  const noSeats = Number(ride?.seats || 0) <= 0;

  const activeBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== "cancelled"),
    [bookings]
  );

  const completedBookings = useMemo(
    () => bookings.filter((booking) => booking.status === "completed"),
    [bookings]
  );

  const totalBookedSeats = activeBookings.reduce(
    (total, booking) => total + Number(booking.seatsBooked || 1),
    0
  );

  const earnings = activeBookings.reduce(
    (total, booking) =>
      total + Number(booking.price || ride?.price || 0) * Number(booking.seatsBooked || 1),
    0
  );

  const originalSeats = Number(ride?.originalSeats || 0);
  const capacity = Math.max(originalSeats, Number(ride?.seats || 0) + totalBookedSeats, 1);
  const occupancyRate = Math.min(100, Math.round((totalBookedSeats / capacity) * 100));

  function routeMapUrl(currentRide: Ride) {
    if (currentRide.mapUrl) return currentRide.mapUrl;

    if (!currentRide.from || !currentRide.to) return "";

    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      currentRide.from
    )}&destination=${encodeURIComponent(currentRide.to)}&travelmode=driving`;
  }

  function formatMoney(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function statusClass(status?: string) {
    if (status === "active") return "status activeStatus";
    if (status === "full") return "status fullStatus";
    if (status === "completed") return "status completedStatus";
    if (status === "cancelled") return "status cancelledStatus";
    return "status";
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
        ...snapshot.data(),
        id: snapshot.id,
      } as Ride;

      setRide(rideData);
      setMessage("");

      if (currentUserId) {
        const bookingQuery = query(
          collection(db, "bookings"),
          where("rideId", "==", rideId),
          where("passengerId", "==", currentUserId)
        );

        const bookingSnapshot = await getDocs(bookingQuery);

        const hasActiveBooking = bookingSnapshot.docs.some((document) => {
          const data = document.data();
          return (
            data.status === "reserved" ||
            data.status === "confirmed" ||
            data.status === "completed"
          );
        });

        setAlreadyReserved(hasActiveBooking);
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

      const now = new Date().toISOString();

      await addDoc(collection(db, "bookings"), {
        rideId: ride.id,

        passengerId: userId,
        passengerEmail: userEmail,

        driverId: ride.driverId || "",
        driverEmail: ride.driverEmail || "",

        from: ride.from || "",
        to: ride.to || "",
        date: ride.date || "",
        time: ride.time || "",

        price: Number(ride.price || 0),
        suggestedPrice: Number(ride.suggestedPrice || 0),

        distanceText: ride.distanceText || "",
        durationText: ride.durationText || "",
        distanceMiles: Number(ride.distanceMiles || 0),
        durationMinutes: Number(ride.durationMinutes || 0),
        mapUrl: routeMapUrl(ride),

        seatsBooked: 1,
        status: "reserved",
        createdAt: now,
        updatedAt: now,
      });

      if (ride.driverId) {
        await addDoc(collection(db, "notifications"), {
          userId: ride.driverId,
          type: "booking",
          title: "New Ride Booking",
          message: `${userEmail} reserved a seat from ${ride.from} to ${ride.to}.`,
          rideId: ride.id,
          passengerId: userId,
          passengerEmail: userEmail,
          read: false,
          createdAt: now,
          actionUrl: `/ride-passengers?rideId=${ride.id}`,
        });
      }

      const newSeats = Number(ride.seats || 0) - 1;

      await updateDoc(doc(db, "rides", ride.id), {
        seats: newSeats,
        status: newSeats <= 0 ? "full" : "active",
        updatedAt: now,
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

  async function notifyPassenger(booking: Booking, title: string, text: string) {
    if (!booking.passengerId) return;

    await addDoc(collection(db, "notifications"), {
      userId: booking.passengerId,
      type: "ride",
      title,
      message: text,
      rideId,
      bookingId: booking.id,
      driverId: ride?.driverId || "",
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  async function updateRideStatus(status: "completed" | "cancelled") {
    if (!ride || !isOwnRide) return;

    const confirmed = confirm(`Are you sure you want to mark this ride as ${status}?`);
    if (!confirmed) return;

    try {
      setActionLoading(status);
      setMessage("");

      const now = new Date().toISOString();

      await updateDoc(doc(db, "rides", ride.id), {
        status,
        updatedAt: now,
      });

      await Promise.all(
        activeBookings.map(async (booking) => {
          await updateDoc(doc(db, "bookings", booking.id), {
            status,
            updatedAt: now,
          });

          await notifyPassenger(
            booking,
            status === "completed" ? "Ride Completed" : "Ride Cancelled",
            status === "completed"
              ? `Your ride from ${ride.from} to ${ride.to} was completed. Please rate your trip experience.`
              : `Your ride from ${ride.from} to ${ride.to} was cancelled.`
          );

          if (status === "completed" && booking.passengerId) {
            await addDoc(collection(db, "notifications"), {
              userId: booking.passengerId,
              type: "review",
              title: "Rate Your Driver",
              message: `Please rate your trip from ${ride.from} to ${ride.to}.`,
              rideId: ride.id,
              driverId: ride.driverId || "",
              passengerId: booking.passengerId,
              read: false,
              createdAt: now,
              actionUrl: `/rate-driver?rideId=${ride.id}&driverId=${ride.driverId || ""}`,
            });
          }
        })
      );

      setRide({ ...ride, status });
      setMessage(`Ride marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setActionLoading("");
    }
  }

  useEffect(() => {
    let unsubscribeBookings: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view ride details.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      await loadRide(user.uid);

      if (rideId) {
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("rideId", "==", rideId)
        );

        unsubscribeBookings = onSnapshot(
          bookingsQuery,
          (snapshot) => {
            const data = snapshot.docs.map((document) => ({
              ...document.data(),
              id: document.id,
            })) as Booking[];

            setBookings(data);
          },
          (error) => setMessage(error.message)
        );
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeBookings) unsubscribeBookings();
    };
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
          Review the route, passengers, earnings, driver details and trip status.
        </p>
      </section>

      {message && <p className="message">{message}</p>}

      {ride && (
        <>
          <section className="detailsCard">
            <div className="routeHeader">
              <div>
                <p className="label">ROUTE</p>
                <h2>{ride.from} <span>→</span> {ride.to}</h2>
              </div>

              <div className="priceBox">
                <span>PRICE</span>
                <strong>{formatMoney(ride.price)}</strong>
              </div>
            </div>

            <div className="routeStats">
              <Stat label="Distance" value={ride.distanceText || "Not available"} />
              <Stat label="Duration" value={ride.durationText || "Not available"} />
              <Stat label="Miles" value={ride.distanceMiles ? `${ride.distanceMiles} mi` : "N/A"} />
              <Stat label="Suggested" value={ride.suggestedPrice ? formatMoney(ride.suggestedPrice) : "N/A"} />
            </div>

            <div className="chips">
              <div className="chip">📅 {ride.date}</div>
              <div className="chip">🕒 {ride.time}</div>
              <div className="chip">💺 {ride.seats} seats left</div>
              <div className={statusClass(ride.status)}>● {ride.status || "active"}</div>
            </div>

            <div className="infoGrid">
              <Info icon="🚘" label="Vehicle" value={ride.vehicle || "Not specified"} />
              <Info icon="👤" label="Driver" value={ride.driverEmail || "RoadLink Driver"} />
              <Info icon="💵" label="Price per Seat" value={formatMoney(ride.price)} />
              {ride.notes && <Info icon="📝" label="Trip Notes" value={ride.notes} />}
            </div>

            {routeMapUrl(ride) && (
              <a
                href={routeMapUrl(ride)}
                target="_blank"
                rel="noopener noreferrer"
                className="mapButton"
              >
                Open Route in Google Maps
              </a>
            )}

            {isOwnRide && <p className="warning">This is your own ride.</p>}
            {alreadyReserved && <p className="success">You already reserved this ride.</p>}

            <div className="actions">
              {isOwnRide ? (
                <>
                  <Link
                    href={`/ride-passengers?rideId=${ride.id}`}
                    className="outlineButton"
                  >
                    Passenger List
                  </Link>

                  <button
                    className="completeButton"
                    onClick={() => updateRideStatus("completed")}
                    disabled={actionLoading === "completed" || ride.status === "completed"}
                  >
                    {actionLoading === "completed" ? "Updating..." : "Complete Ride"}
                  </button>

                  <button
                    className="cancelButton"
                    onClick={() => updateRideStatus("cancelled")}
                    disabled={actionLoading === "cancelled" || ride.status === "cancelled"}
                  >
                    {actionLoading === "cancelled" ? "Updating..." : "Cancel Ride"}
                  </button>
                </>
              ) : (
                <>
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
                      : noSeats
                      ? "No Seats Available"
                      : "Reserve Seat"}
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="analyticsCard">
            <p className="eyebrow">Driver Analytics</p>

            <div className="analyticsGrid">
              <Metric label="Passengers" value={String(activeBookings.length)} />
              <Metric label="Seats Sold" value={String(totalBookedSeats)} />
              <Metric label="Earnings" value={formatMoney(earnings)} />
              <Metric label="Occupancy" value={`${occupancyRate}%`} />
              <Metric label="Completed" value={String(completedBookings.length)} />
              <Metric label="Status" value={ride.status || "active"} />
            </div>
          </section>

          <section className="timelineCard">
            <p className="eyebrow">Trip Timeline</p>

            <TimelineItem active label="Ride Created" detail={ride.createdAt || "Created in RoadLink"} />
            <TimelineItem active={activeBookings.length > 0} label="Passenger Reserved" detail={`${activeBookings.length} active booking${activeBookings.length === 1 ? "" : "s"}`} />
            <TimelineItem active={activeBookings.some((item) => item.status === "confirmed")} label="Booking Confirmed" detail="Driver confirmation step" />
            <TimelineItem active={ride.status === "completed"} label="Ride Completed" detail="Ratings unlocked after completion" />
          </section>
        </>
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
        .detailsCard,
        .analyticsCard,
        .timelineCard {
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

        .hero,
        .detailsCard,
        .analyticsCard {
          margin-bottom: 24px;
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
        h2 span,
        .active,
        .priceBox strong,
        .eyebrow,
        .metricValue {
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

        .chip,
        .status {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
          text-transform: capitalize;
        }

        .activeStatus {
          color: #22c55e;
          border-color: rgba(34,197,94,0.35);
        }

        .fullStatus {
          color: #fbbf24;
          border-color: rgba(251,191,36,0.35);
        }

        .completedStatus {
          color: #38bdf8;
          border-color: rgba(56,189,248,0.35);
        }

        .cancelledStatus {
          color: #fca5a5;
          border-color: rgba(239,68,68,0.35);
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

        .actions:has(.cancelButton) {
          grid-template-columns: 1fr 1fr 1fr;
        }

        .outlineButton,
        .reserve,
        .completeButton,
        .cancelButton {
          width: 100%;
          padding: 17px;
          border-radius: 999px;
          text-align: center;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
        }

        .outlineButton {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
        }

        .reserve,
        .completeButton {
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .cancelButton {
          border: none;
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          color: white;
        }

        .reserve:disabled,
        .completeButton:disabled,
        .cancelButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        .analyticsGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 16px;
        }

        .metric {
          border-radius: 18px;
          padding: 16px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 24px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .timelineItem {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 14px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .timelineItem:last-child {
          border-bottom: none;
        }

        .timelineDot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .timelineItem.isActive .timelineDot {
          background: #22c55e;
          box-shadow: 0 0 24px rgba(34,197,94,0.45);
        }

        .timelineText strong {
          display: block;
          margin-bottom: 4px;
        }

        .timelineText span {
          color: #a1a1aa;
          font-size: 14px;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
            padding-bottom: 150px;
          }

          .hero,
          .detailsCard,
          .analyticsCard,
          .timelineCard {
            padding: 24px;
            border-radius: 28px;
          }

          h1 { font-size: 48px; }
          h2 { font-size: 30px; }

          .routeHeader,
          .routeStats,
          .actions,
          .actions:has(.cancelButton),
          .analyticsGrid {
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function TimelineItem({
  active,
  label,
  detail,
}: {
  active: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className={active ? "timelineItem isActive" : "timelineItem"}>
      <div className="timelineDot" />
      <div className="timelineText">
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
      }
