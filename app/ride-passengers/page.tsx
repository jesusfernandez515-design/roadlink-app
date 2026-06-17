"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Ride = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  seats?: number;
  status?: string;
  driverId?: string;
  driverEmail?: string;
  distanceText?: string;
  durationText?: string;
  mapUrl?: string;
};

type Booking = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
  seatsBooked?: number;
  price?: number;
  createdAt?: string;
};

export default function RidePassengersPage() {
  return (
    <Suspense fallback={<main className="page">Loading passengers...</main>}>
      <RidePassengersContent />
    </Suspense>
  );
}

function RidePassengersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rideId = searchParams.get("rideId") || "";

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("Loading passengers...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    if (!rideId) {
      setMessage("Missing ride ID.");
      return;
    }

    let unsubscribeBookings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUser(user);

      try {
        const rideSnap = await getDoc(doc(db, "rides", rideId));

        if (!rideSnap.exists()) {
          setMessage("Ride not found.");
          return;
        }

        const rideData = {
          ...rideSnap.data(),
          id: rideSnap.id,
        } as Ride;

        if (rideData.driverId && rideData.driverId !== user.uid) {
          setMessage("You can only manage passengers for your own rides.");
          return;
        }

        setRide(rideData);

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("rideId", "==", rideId),
          where("driverId", "==", user.uid)
        );

        unsubscribeBookings = onSnapshot(
          bookingsQuery,
          (snapshot) => {
            const data = snapshot.docs.map((document) => ({
              ...document.data(),
              id: document.id,
            })) as Booking[];

            data.sort((a, b) =>
              String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
            );

            setBookings(data);
            setMessage(data.length ? "" : "No passengers yet.");
          },
          (error) => setMessage(error.message)
        );
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeBookings) unsubscribeBookings();
    };
  }, [rideId, router]);

  const activePassengers = bookings.filter(
    (booking) => booking.status !== "cancelled"
  );

  const totalSeats = activePassengers.reduce(
    (total, booking) => total + Number(booking.seatsBooked || 1),
    0
  );

  const estimatedEarnings = activePassengers.reduce(
    (total, booking) =>
      total + Number(booking.price || ride?.price || 0) * Number(booking.seatsBooked || 1),
    0
  );

  function formatMoney(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusClass(status?: string) {
    if (status === "reserved") return "status reservedStatus";
    if (status === "confirmed") return "status confirmedStatus";
    if (status === "completed") return "status completedStatus";
    if (status === "cancelled") return "status cancelledStatus";
    return "status";
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
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  async function updateBookingStatus(booking: Booking, status: string) {
    if (!ride) return;

    const confirmed = confirm(`Are you sure you want to mark this booking as ${status}?`);
    if (!confirmed) return;

    try {
      setLoadingId(`${booking.id}-${status}`);
      setMessage("");

      await updateDoc(doc(db, "bookings", booking.id), {
        status,
        updatedAt: new Date().toISOString(),
      });

      if (status === "cancelled") {
        const seatsToReturn = Number(booking.seatsBooked || 1);
        const currentSeats = Number(ride.seats || 0);

        await updateDoc(doc(db, "rides", ride.id), {
          seats: currentSeats + seatsToReturn,
          status: "active",
          updatedAt: new Date().toISOString(),
        });

        setRide({
          ...ride,
          seats: currentSeats + seatsToReturn,
          status: "active",
        });

        await notifyPassenger(
          booking,
          "Booking Cancelled",
          `Your booking from ${ride.from || "origin"} to ${ride.to || "destination"} was cancelled.`
        );
      }

      if (status === "confirmed") {
        await notifyPassenger(
          booking,
          "Booking Confirmed",
          `Your booking from ${ride.from || "origin"} to ${ride.to || "destination"} was confirmed.`
        );
      }

      setMessage(`Booking marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function updateRideStatus(status: "completed" | "cancelled") {
    if (!ride) return;

    const confirmed = confirm(`Are you sure you want to mark this ride as ${status}?`);
    if (!confirmed) return;

    try {
      setLoadingId(`ride-${status}`);
      setMessage("");

      await updateDoc(doc(db, "rides", ride.id), {
        status,
        updatedAt: new Date().toISOString(),
      });

      await Promise.all(
        activePassengers.map(async (booking) => {
          await updateDoc(doc(db, "bookings", booking.id), {
            status,
            updatedAt: new Date().toISOString(),
          });

          await notifyPassenger(
            booking,
            status === "completed" ? "Ride Completed" : "Ride Cancelled",
            status === "completed"
              ? `Your ride from ${ride.from || "origin"} to ${ride.to || "destination"} was completed.`
              : `Your ride from ${ride.from || "origin"} to ${ride.to || "destination"} was cancelled.`
          );
        })
      );

      setRide({ ...ride, status });
      setMessage(`Ride marked as ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function openChat(booking: Booking) {
    if (!currentUser || !ride || !booking.passengerId) return;

    try {
      const chatId = `${ride.id}_${currentUser.uid}_${booking.passengerId}`;
      setLoadingId(`chat-${booking.id}`);

      await setDoc(
        doc(db, "chats", chatId),
        {
          id: chatId,
          rideId: ride.id,
          driverId: currentUser.uid,
          driverEmail: currentUser.email || ride.driverEmail || "",
          passengerId: booking.passengerId,
          passengerEmail: booking.passengerEmail || "",
          participants: [currentUser.uid, booking.passengerId],
          participantEmails: [
            currentUser.email || ride.driverEmail || "",
            booking.passengerEmail || "",
          ],
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      router.push(`/chat?chatId=${chatId}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not open chat.");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <button className="miniButton" onClick={() => router.back()}>
            ← Back
          </button>

          <Link href="/my-rides" className="miniButton">
            My Rides
          </Link>

          <Link href="/dashboard" className="miniButton">
            Dashboard
          </Link>
        </div>

        <div className="logo">
          Road<span>Link</span>
        </div>

        <p className="eyebrow">Passenger Management</p>

        <h1>
          Ride <span>Control</span>
        </h1>

        {ride && (
          <p className="subtitle">
            {ride.from || "Origin"} → {ride.to || "Destination"}
          </p>
        )}
      </section>

      <section className="stats">
        <Metric label="Passengers" value={String(activePassengers.length)} />
        <Metric label="Seats" value={String(totalSeats)} />
        <Metric label="Earnings" value={formatMoney(estimatedEarnings)} />
      </section>

      {ride && (
        <section className="rideSummary">
          <Mini label="Date" value={ride.date || "N/A"} />
          <Mini label="Time" value={ride.time || "N/A"} />
          <Mini label="Distance" value={ride.distanceText || "N/A"} />
          <Mini label="Duration" value={ride.durationText || "N/A"} />
          <Mini label="Seats Left" value={String(ride.seats || 0)} />
          <Mini label="Status" value={ride.status || "active"} />
        </section>
      )}

      {ride && (
        <section className="rideActions">
          {ride.mapUrl && (
            <a
              href={ride.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mapButton"
            >
              Open Route In Google Maps
            </a>
          )}

          <button
            className="completeButton"
            onClick={() => updateRideStatus("completed")}
            disabled={loadingId === "ride-completed" || ride.status === "completed"}
          >
            {loadingId === "ride-completed" ? "Updating..." : "Complete Ride"}
          </button>

          <button
            className="cancelRideButton"
            onClick={() => updateRideStatus("cancelled")}
            disabled={loadingId === "ride-cancelled" || ride.status === "cancelled"}
          >
            {loadingId === "ride-cancelled" ? "Updating..." : "Cancel Ride"}
          </button>
        </section>
      )}

      <section className="results">
        {message && <p className="message">{message}</p>}

        {activePassengers.length === 0 ? (
          <div className="empty">
            <h2>No passengers yet</h2>
            <p>When someone reserves this ride, they will appear here.</p>
          </div>
        ) : (
          activePassengers.map((booking) => (
            <article key={booking.id} className="passengerCard">
              <div className="passengerTop">
                <div className="avatar">👤</div>

                <div>
                  <p className="eyebrow">Passenger</p>
                  <h2>{booking.passengerEmail || "RoadLink Passenger"}</h2>
                </div>
              </div>

              <div className="passengerInfo">
                <span>💺 {booking.seatsBooked || 1} seat</span>
                <span>💵 {formatMoney(booking.price || ride?.price)}</span>
                <span className={getStatusClass(booking.status)}>
                  ● {booking.status || "reserved"}
                </span>
              </div>

              <div className="bookingMeta">
                <small>Booking ID</small>
                <strong>{booking.id}</strong>
              </div>

              <div className="buttons">
                <button
                  className="chatButton"
                  onClick={() => openChat(booking)}
                  disabled={loadingId === `chat-${booking.id}` || !booking.passengerId}
                >
                  {loadingId === `chat-${booking.id}` ? "Opening..." : "Chat"}
                </button>

                {booking.status !== "confirmed" && (
                  <button
                    className="confirmButton"
                    onClick={() => updateBookingStatus(booking, "confirmed")}
                    disabled={loadingId === `${booking.id}-confirmed`}
                  >
                    {loadingId === `${booking.id}-confirmed` ? "Updating..." : "Confirm"}
                  </button>
                )}

                <button
                  className="cancelButton"
                  onClick={() => updateBookingStatus(booking, "cancelled")}
                  disabled={loadingId === `${booking.id}-cancelled`}
                >
                  {loadingId === `${booking.id}-cancelled` ? "Updating..." : "Cancel Passenger"}
                </button>

                <Link href={`/ride-details?rideId=${rideId}`} className="outlineButton">
                  Ride Details
                </Link>
              </div>
            </article>
          ))
        )}
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.1), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 16px;
          padding-bottom: 105px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .stats,
        .rideSummary,
        .rideActions,
        .results {
          max-width: 860px;
          margin: 0 auto;
        }

        .hero,
        .metric,
        .rideSummary,
        .rideActions,
        .passengerCard,
        .empty {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 18px 55px rgba(0,0,0,0.38);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 28px;
          padding: 22px;
          margin-bottom: 14px;
        }

        .topActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .miniButton {
          padding: 10px 15px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
          cursor: pointer;
          font-size: 13px;
        }

        .logo {
          font-size: 32px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .logo span,
        h1 span,
        .eyebrow,
        .metricValue {
          color: #22c55e;
        }

        .eyebrow {
          margin: 0 0 7px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 42px;
          line-height: 1;
          margin: 0 0 12px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 16px;
          line-height: 1.4;
          margin: 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .metric {
          border-radius: 18px;
          padding: 13px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .metricValue {
          font-size: 20px;
          font-weight: 900;
        }

        .rideSummary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          border-radius: 22px;
          padding: 14px;
          margin-bottom: 12px;
        }

        .miniInfo {
          padding: 10px;
          border-radius: 14px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .miniInfo small,
        .bookingMeta small {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .miniInfo strong,
        .bookingMeta strong {
          color: white;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .rideActions {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 9px;
          border-radius: 22px;
          padding: 14px;
          margin-bottom: 14px;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 18px 0;
        }

        .passengerCard {
          border-radius: 22px;
          padding: 15px;
          margin-bottom: 10px;
        }

        .passengerTop {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }

        .passengerInfo {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .passengerInfo span,
        .status {
          padding: 9px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
          color: #d1d5db;
          font-size: 12px;
          font-weight: 900;
          text-align: center;
          text-transform: capitalize;
        }

        .reservedStatus {
          color: #22c55e;
          border-color: rgba(34,197,94,0.35);
        }

        .confirmedStatus {
          color: #38bdf8;
          border-color: rgba(56,189,248,0.35);
        }

        .completedStatus {
          color: #a78bfa;
          border-color: rgba(167,139,250,0.35);
        }

        .cancelledStatus {
          color: #fca5a5;
          border-color: rgba(239,68,68,0.35);
        }

        .bookingMeta {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 12px;
        }

        .buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .chatButton,
        .confirmButton,
        .cancelButton,
        .outlineButton,
        .mapButton,
        .completeButton,
        .cancelRideButton {
          width: 100%;
          padding: 13px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
          font-size: 13px;
          color: white;
          cursor: pointer;
        }

        .chatButton,
        .completeButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
        }

        .confirmButton {
          background: linear-gradient(135deg, #38bdf8, #0284c7);
          border: none;
        }

        .cancelButton,
        .cancelRideButton {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          border: none;
        }

        .outlineButton {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .mapButton {
          color: #22c55e;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.28);
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .empty {
          border-radius: 22px;
          padding: 26px;
          text-align: center;
        }

        .empty p {
          color: #a1a1aa;
        }

        @media (max-width: 700px) {
          .stats,
          .passengerInfo,
          .rideActions {
            grid-template-columns: 1fr;
          }

          .rideSummary {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 430px) {
          h1 {
            font-size: 38px;
          }

          .buttons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="miniInfo">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
