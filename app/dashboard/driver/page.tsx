"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

type UserProfile = {
  name?: string;
  email?: string;
  verified?: boolean;
  driverVerified?: boolean;
  verificationStatus?: string;
};

type Ride = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  seats?: number;
  price?: number;
  vehicle?: string;
  status?: string;
  driverId?: string;
};

type Booking = {
  id: string;
  rideId?: string;
  driverId?: string;
  passengerEmail?: string;
  passengerName?: string;
  status?: string;
  seatsBooked?: number;
  price?: number;
  createdAt?: string;
};

type Rating = {
  id: string;
  driverId?: string;
  rating?: number;
  stars?: number;
  comment?: string;
};

export default function DriverDashboardPage() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<UserProfile>({});
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [message, setMessage] = useState("Loading driver dashboard...");
  const [loadingRideId, setLoadingRideId] = useState("");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeRides: (() => void) | undefined;
    let unsubscribeBookings: (() => void) | undefined;
    let unsubscribeRatings: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId("");
        setProfile({});
        setRides([]);
        setBookings([]);
        setRatings([]);
        setMessage("Please sign in to view your driver dashboard.");
        return;
      }

      setUserId(user.uid);
      setMessage("");

      unsubscribeProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          setProfile((snapshot.data() as UserProfile) || {});
        },
        (error) => setMessage(error.message)
      );

      unsubscribeRides = onSnapshot(
        query(collection(db, "rides"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Ride[];

          setRides(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribeBookings = onSnapshot(
        query(collection(db, "bookings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          setBookings(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribeRatings = onSnapshot(
        query(collection(db, "ratings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Rating[];

          setRatings(data);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeRides) unsubscribeRides();
      if (unsubscribeBookings) unsubscribeBookings();
      if (unsubscribeRatings) unsubscribeRatings();
    };
  }, []);

  const driverVerified =
    profile.driverVerified === true ||
    profile.verified === true ||
    profile.verificationStatus === "approved";

  const activeRides = rides.filter(
    (ride) => ride.status === "active" || ride.status === "full"
  );

  const completedRides = rides.filter((ride) => ride.status === "completed");
  const cancelledRides = rides.filter((ride) => ride.status === "cancelled");

  const activeBookings = bookings.filter(
    (booking) => booking.status === "reserved" || booking.status === "confirmed"
  );

  const completedBookings = bookings.filter(
    (booking) => booking.status === "completed"
  );

  const pendingBookings = bookings.filter(
    (booking) => booking.status === "pending"
  );

  const totalPassengers = activeBookings.reduce(
    (total, booking) => total + Number(booking.seatsBooked || 1),
    0
  );

  const estimatedEarnings = activeBookings.reduce((total, booking) => {
    const ride = rides.find((item) => item.id === booking.rideId);
    const price = Number(booking.price || ride?.price || 0);
    const seats = Number(booking.seatsBooked || 1);
    return total + price * seats;
  }, 0);

  const completedEarnings = completedBookings.reduce((total, booking) => {
    const ride = rides.find((item) => item.id === booking.rideId);
    const price = Number(booking.price || ride?.price || 0);
    const seats = Number(booking.seatsBooked || 1);
    return total + price * seats;
  }, 0);

  const openSeats = activeRides.reduce(
    (total, ride) => total + Number(ride.seats || 0),
    0
  );

  const averageRating = useMemo(() => {
    if (!ratings.length) return 0;

    return (
      ratings.reduce(
        (total, item) => total + Number(item.rating || item.stars || 0),
        0
      ) / ratings.length
    );
  }, [ratings]);

  const ratingDisplay = ratings.length ? averageRating.toFixed(1) : "New";

  function getBookingsForRide(rideId: string) {
    return bookings.filter(
      (booking) =>
        booking.rideId === rideId &&
        booking.status !== "cancelled" &&
        booking.status !== "rejected"
    );
  }

  async function cancelRide(rideId: string) {
    try {
      setLoadingRideId(rideId);
      setMessage("");

      await updateDoc(doc(db, "rides", rideId), {
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      });

      const relatedBookings = bookings.filter(
        (booking) => booking.rideId === rideId
      );

      await Promise.all(
        relatedBookings.map((booking) =>
          updateDoc(doc(db, "bookings", booking.id), {
            status: "cancelled",
            updatedAt: new Date().toISOString(),
          })
        )
      );

      setMessage("Ride cancelled successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingRideId("");
    }
  }

  async function completeRide(rideId: string) {
    try {
      setLoadingRideId(rideId);
      setMessage("");

      await updateDoc(doc(db, "rides", rideId), {
        status: "completed",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const relatedBookings = bookings.filter(
        (booking) =>
          booking.rideId === rideId &&
          (booking.status === "reserved" || booking.status === "confirmed")
      );

      await Promise.all(
        relatedBookings.map((booking) =>
          updateDoc(doc(db, "bookings", booking.id), {
            status: "completed",
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        )
      );

      setMessage("Ride marked as completed.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingRideId("");
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="topActions">
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/my-rides" className="miniButton">My Rides</Link>
          <Link href="/offer-ride" className="miniButton">Offer Ride</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
        </div>

        <div className="heroGrid">
          <div>
            <p className="eyebrow">RoadLink Driver Center</p>
            <h1>
              Driver <span>Dashboard</span>
            </h1>
            <p className="subtitle">
              Manage active rides, passengers, completed trips, ratings, and estimated earnings.
            </p>

            <div className="badgeRow">
              <span className={driverVerified ? "verifiedBadge" : "warningBadge"}>
                {driverVerified ? "✓ Verified Driver" : "Driver Verification Required"}
              </span>
              <span className="ratingBadge">⭐ {ratingDisplay}</span>
            </div>
          </div>

          <div className="heroIcon">🚘</div>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      {!driverVerified && userId && (
        <section className="warningCard">
          <div>
            <p className="eyebrow">Verification Needed</p>
            <h2>Become a Verified Driver</h2>
            <p>
              Complete your driver verification to build passenger trust and prepare your account for paid rides.
            </p>
          </div>

          <Link href="/driver-verification" className="verifyButton">
            Verify Driver
          </Link>
        </section>
      )}

      <section className="stats">
        <Metric icon="🚘" label="Active Rides" value={String(activeRides.length)} />
        <Metric icon="👥" label="Passengers" value={String(totalPassengers)} />
        <Metric icon="💺" label="Open Seats" value={String(openSeats)} />
        <Metric icon="⏳" label="Pending" value={String(pendingBookings.length)} />
        <Metric icon="✅" label="Completed" value={String(completedRides.length)} />
        <Metric icon="⭐" label="Rating" value={String(ratingDisplay)} />
        <Metric icon="💵" label="Estimated" value={`$${estimatedEarnings}`} />
        <Metric icon="🏁" label="Completed $" value={`$${completedEarnings}`} />
      </section>

      <section className="quickActions">
        <Link href="/offer-ride">➕ Create New Ride</Link>
        <Link href="/my-rides">🚘 Manage My Rides</Link>
        <Link href="/messages">💬 Driver Messages</Link>
        <Link href="/reviews">⭐ View Reviews</Link>
      </section>

      <section className="list">
        <div className="sectionTitle">
          <p className="eyebrow">Active Routes</p>
          <h2>Your Driver Operations</h2>
        </div>

        {activeRides.length === 0 ? (
          <div className="emptyCard">
            <h3>No active rides yet</h3>
            <p>Create your next ride and start receiving passenger reservations.</p>
            <Link href="/offer-ride">Offer a Ride</Link>
          </div>
        ) : (
          activeRides.map((ride) => {
            const rideBookings = getBookingsForRide(ride.id);
            const ridePassengers = rideBookings.reduce(
              (total, booking) => total + Number(booking.seatsBooked || 1),
              0
            );
            const rideEarnings = rideBookings.reduce((total, booking) => {
              const price = Number(booking.price || ride.price || 0);
              const seats = Number(booking.seatsBooked || 1);
              return total + price * seats;
            }, 0);

            return (
              <div key={ride.id} className="rideCard">
                <div className="routeHeader">
                  <div>
                    <p className="eyebrow">Driver Route</p>
                    <h2>
                      {ride.from || "From"} <span>→</span> {ride.to || "To"}
                    </h2>
                  </div>

                  <div className="priceBox">
                    <small>EARNINGS</small>
                    <strong>${rideEarnings}</strong>
                  </div>
                </div>

                <div className="chips">
                  <div className="chip">📅 {ride.date || "No date"}</div>
                  <div className="chip">🕒 {ride.time || "No time"}</div>
                  <div className="chip">💺 {Number(ride.seats || 0)} seats left</div>
                  <div className="chip active">● {ride.status || "active"}</div>
                </div>

                <div className="infoGrid">
                  <Info icon="🚘" label="Vehicle" value={ride.vehicle || "Not provided"} />
                  <Info icon="💵" label="Price Per Seat" value={`$${Number(ride.price || 0)}`} />
                  <Info icon="👥" label="Passengers" value={String(ridePassengers)} />
                </div>

                <div className="summary">
                  <div>
                    <span>{ridePassengers}</span>
                    <small>Passengers</small>
                  </div>

                  <div>
                    <span>${rideEarnings}</span>
                    <small>Estimated earnings</small>
                  </div>
                </div>

                <div className="cardButtons">
                  <Link href={`/ride-details?rideId=${ride.id}`} className="outlineButton">
                    View Details
                  </Link>

                  <Link href={`/ride-passengers?rideId=${ride.id}`} className="outlineButton">
                    View Passengers
                  </Link>
                </div>

                <div className="dangerGrid">
                  <button
                    className="completeButton"
                    onClick={() => completeRide(ride.id)}
                    disabled={loadingRideId === ride.id}
                  >
                    {loadingRideId === ride.id ? "Working..." : "Complete Ride"}
                  </button>

                  <button
                    className="cancelButton"
                    onClick={() => cancelRide(ride.id)}
                    disabled={loadingRideId === ride.id}
                  >
                    {loadingRideId === ride.id ? "Working..." : "Cancel Ride"}
                  </button>
                </div>

                <section className="passengerSection">
                  <h3>Passengers</h3>

                  {rideBookings.length === 0 ? (
                    <p className="emptyText">No passengers yet.</p>
                  ) : (
                    rideBookings.map((booking) => (
                      <div key={booking.id} className="passenger">
                        <div>
                          <strong>
                            {booking.passengerName ||
                              booking.passengerEmail ||
                              "Passenger"}
                          </strong>
                          <p>{booking.passengerEmail || "No email available"}</p>
                        </div>

                        <span>{booking.status || "reserved"}</span>
                      </div>
                    ))
                  )}
                </section>
              </div>
            );
          })
        )}
      </section>

      <section className="historyGrid">
        <div className="historyCard">
          <p className="eyebrow">Completed Trips</p>
          <h2>{completedRides.length}</h2>
          <p>Trips marked as completed by you.</p>
        </div>

        <div className="historyCard">
          <p className="eyebrow">Cancelled Trips</p>
          <h2>{cancelledRides.length}</h2>
          <p>Trips cancelled from your driver dashboard.</p>
        </div>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .hero,
        .stats,
        .list,
        .quickActions,
        .warningCard,
        .historyGrid {
          max-width: 960px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero,
        .metric,
        .rideCard,
        .quickActions a,
        .warningCard,
        .emptyCard,
        .historyCard {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          backdrop-filter: blur(14px);
        }

        .hero {
          border-radius: 32px;
          padding: 30px;
          margin-bottom: 22px;
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
        }

        .heroGrid {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 24px;
          align-items: center;
        }

        .heroIcon {
          width: 104px;
          height: 104px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 46px;
          box-shadow: 0 18px 60px rgba(34,197,94,0.15);
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
          letter-spacing: -1px;
        }

        h1 span,
        h2 span,
        .active,
        .eyebrow,
        .priceBox strong,
        .metricValue,
        .summary span,
        .historyCard h2 {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .badgeRow {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .verifiedBadge,
        .warningBadge,
        .ratingBadge {
          display: inline-flex;
          padding: 10px 14px;
          border-radius: 999px;
          font-weight: 900;
        }

        .verifiedBadge,
        .ratingBadge {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
        }

        .warningBadge {
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
          color: #fde68a;
        }

        .message {
          max-width: 960px;
          margin: 0 auto 22px;
          color: #22c55e;
          font-weight: 900;
        }

        .warningCard {
          border-radius: 28px;
          padding: 24px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .warningCard h2 {
          margin: 0 0 10px;
        }

        .warningCard p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        .verifyButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 15px 22px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 20px;
        }

        .metricIcon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 26px;
          font-weight: 900;
        }

        .quickActions {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 28px;
        }

        .quickActions a {
          display: block;
          padding: 16px;
          border-radius: 18px;
          color: white;
          text-align: center;
          text-decoration: none;
          font-weight: 900;
        }

        .sectionTitle {
          margin-bottom: 16px;
        }

        .sectionTitle h2 {
          margin: 0;
          font-size: 34px;
        }

        .emptyCard {
          border-radius: 28px;
          padding: 28px;
          text-align: center;
        }

        .emptyCard h3 {
          font-size: 28px;
          margin: 0 0 10px;
        }

        .emptyCard p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .emptyCard a {
          display: inline-flex;
          margin-top: 10px;
          padding: 15px 24px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .rideCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .routeHeader {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: start;
          margin-bottom: 20px;
        }

        h2 {
          font-size: 34px;
          line-height: 1.15;
          margin: 0;
        }

        .priceBox {
          min-width: 120px;
          padding: 16px;
          border-radius: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          text-align: center;
        }

        .priceBox small {
          display: block;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .priceBox strong {
          font-size: 32px;
          font-weight: 900;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
          text-transform: capitalize;
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

        .summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 22px;
        }

        .summary div {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px;
          padding: 18px;
        }

        .summary span {
          display: block;
          font-size: 30px;
          font-weight: 900;
        }

        .summary small {
          color: #a1a1aa;
          font-weight: 800;
        }

        .cardButtons,
        .dangerGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 22px;
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

        .completeButton,
        .cancelButton {
          width: 100%;
          padding: 18px;
          border: none;
          border-radius: 999px;
          color: white;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        }

        .completeButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .cancelButton {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
        }

        .completeButton:disabled,
        .cancelButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .passengerSection {
          margin-top: 28px;
        }

        h3 {
          font-size: 26px;
          margin: 0 0 14px;
        }

        .emptyText {
          color: #a1a1aa;
        }

        .passenger {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          margin-top: 10px;
        }

        .passenger strong {
          color: white;
          overflow-wrap: anywhere;
        }

        .passenger p {
          color: #a1a1aa;
          margin: 6px 0 0;
          overflow-wrap: anywhere;
        }

        .passenger span {
          color: #22c55e;
          font-weight: 900;
          text-transform: capitalize;
        }

        .historyGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 20px;
        }

        .historyCard {
          border-radius: 28px;
          padding: 24px;
        }

        .historyCard h2 {
          font-size: 42px;
          margin: 0 0 8px;
        }

        .historyCard p {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 800px) {
          .page {
            padding: 16px;
          }

          .hero,
          .rideCard,
          .warningCard,
          .emptyCard,
          .historyCard {
            padding: 24px;
            border-radius: 28px;
          }

          .heroGrid,
          .stats,
          .quickActions,
          .routeHeader,
          .summary,
          .cardButtons,
          .dangerGrid,
          .historyGrid,
          .warningCard {
            grid-template-columns: 1fr;
          }

          .heroIcon {
            width: 86px;
            height: 86px;
            font-size: 38px;
          }

          h1 {
            font-size: 48px;
          }

          h2 {
            font-size: 30px;
          }

          .priceBox {
            text-align: left;
          }

          .passenger {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
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
