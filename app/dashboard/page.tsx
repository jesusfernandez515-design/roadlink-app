"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  city?: string;
  state?: string;
  emailVerified?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  licenseVerified?: boolean;
  phoneVerified?: boolean;
  verificationStatus?: string;
};

type Ride = {
  id: string;
  status?: string;
  driverId?: string;
};

type Booking = {
  id: string;
  status?: string;
  driverId?: string;
  passengerId?: string;
  price?: number;
  seatsBooked?: number;
};

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  read?: boolean;
  createdAt?: any;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile>({});
  const [avatar, setAvatar] = useState("R");
  const [rides, setRides] = useState<Ride[]>([]);
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [passengerBookings, setPassengerBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [message, setMessage] = useState("Loading dashboard...");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeRides: (() => void) | undefined;
    let unsubscribeDriverBookings: (() => void) | undefined;
    let unsubscribePassengerBookings: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setProfile({});
        setAvatar("R");
        setRides([]);
        setDriverBookings([]);
        setPassengerBookings([]);
        setNotifications([]);
        setMessage("Please sign in to view your dashboard.");
        return;
      }

      const userEmail = user.email || "";
      setAvatar(userEmail ? userEmail.charAt(0).toUpperCase() : "R");
      setMessage("");

      unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
        const data = snapshot.data() as UserProfile | undefined;

        setProfile({
          name: data?.name || user.displayName || "RoadLink User",
          email: data?.email || userEmail,
          photoURL: data?.photoURL || user.photoURL || "",
          city: data?.city || "",
          state: data?.state || "",
          emailVerified: Boolean(user.emailVerified || data?.emailVerified),
          verified: Boolean(data?.verified),
          driverVerified: Boolean(data?.driverVerified),
          licenseVerified: Boolean(data?.licenseVerified),
          phoneVerified: Boolean(data?.phoneVerified),
          verificationStatus: data?.verificationStatus || "not_submitted",
        });
      });

      unsubscribeRides = onSnapshot(
        query(collection(db, "rides"), where("driverId", "==", user.uid)),
        (snapshot) => {
          setRides(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Ride[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribeDriverBookings = onSnapshot(
        query(collection(db, "bookings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          setDriverBookings(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Booking[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribePassengerBookings = onSnapshot(
        query(collection(db, "bookings"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          setPassengerBookings(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Booking[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribeNotifications = onSnapshot(
        query(collection(db, "notifications"), where("userId", "==", user.uid)),
        (snapshot) => {
          setNotifications(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as NotificationItem[]
          );
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeRides) unsubscribeRides();
      if (unsubscribeDriverBookings) unsubscribeDriverBookings();
      if (unsubscribePassengerBookings) unsubscribePassengerBookings();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  const displayName = profile.name || "RoadLink User";
  const displayEmail = profile.email || "No email found";
  const displayPhoto = profile.photoURL || "";

  const driverVerified =
    profile.driverVerified === true ||
    profile.verified === true ||
    profile.verificationStatus === "approved";

  const trustScore = Math.min(
    100,
    40 +
      (profile.emailVerified ? 15 : 0) +
      (profile.phoneVerified ? 15 : 0) +
      (driverVerified ? 25 : 0) +
      (profile.licenseVerified ? 5 : 0)
  );

  const trustLabel =
    trustScore >= 85 ? "Premium Driver" : trustScore >= 65 ? "Trusted Driver" : "Basic Account";

  const locationText =
    profile.city || profile.state
      ? `${profile.city || ""}${profile.city && profile.state ? ", " : ""}${profile.state || ""}`
      : "Location not set";

  const activeRides = rides.filter(
    (ride) => ride.status === "active" || ride.status === "full"
  );

  const completedBookings = driverBookings.filter(
    (booking) => booking.status === "completed"
  );

  const activeDriverBookings = driverBookings.filter(
    (booking) =>
      booking.status === "reserved" ||
      booking.status === "confirmed" ||
      booking.status === "pending"
  );

  const activePassengerBookings = passengerBookings.filter(
    (booking) =>
      booking.status === "reserved" ||
      booking.status === "confirmed" ||
      booking.status === "pending"
  );

  const earnings = useMemo(() => {
    return completedBookings.reduce((total, booking) => {
      return total + Number(booking.price || 0) * Number(booking.seatsBooked || 1);
    }, 0);
  }, [completedBookings]);

  const unreadNotifications = notifications.filter((item) => !item.read).length;
  const recentActivity = notifications.slice(0, 3);

  return (
    <main className="page">
      <section className="dashboard">
        <section className="heroCard">
          <div className="heroTop">
            {displayPhoto ? (
              <img src={displayPhoto} alt={displayName} className="avatarImage" />
            ) : (
              <div className="avatar">{avatar}</div>
            )}

            <div className="heroText">
              <p className="eyebrow">RoadLink Dashboard</p>
              <h1>Welcome back, {displayName}</h1>
              <p className="email">{displayEmail}</p>
              <p className="trustLine">🟢 {trustLabel} • {trustScore}/100</p>
              <p className="location">📍 {locationText}</p>
            </div>
          </div>

          <div className="heroActions">
            <Link href="/wallet" className="heroPrimary">💰 Wallet</Link>
            <Link href="/offer-ride" className="heroSecondary">➕ Offer Ride</Link>
            <Link href="/find-ride" className="heroSecondary">🔎 Find Ride</Link>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💰" title="Earnings" value={`$${earnings}`} href="/wallet" />
          <Metric icon="🚘" title="Active Rides" value={String(activeRides.length)} href="/my-rides" />
          <Metric icon="🎟️" title="Reservations" value={String(activeDriverBookings.length)} href="/ride-passengers" />
          <Metric icon="🔔" title="Notifications" value={String(unreadNotifications)} href="/notifications" alert={unreadNotifications > 0} />
          <Metric icon="✅" title="Completed" value={String(completedBookings.length)} href="/my-rides" />
          <Metric icon="📋" title="Bookings" value={String(activePassengerBookings.length)} href="/my-bookings" />
        </section>

        <section className="sectionCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Next Reservation</p>
              <h2>Upcoming Trip</h2>
            </div>
            <span className="statusPill">Live</span>
          </div>

          <div className="tripBox">
            <strong>No upcoming trips yet.</strong>
            <p>Reserve your next ride and your trip summary will appear here.</p>
            <Link href="/find-ride" className="mainButton">Find a Ride</Link>
          </div>
        </section>

        <section className="sectionCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Recent Activity</p>
              <h2>Live Feed</h2>
            </div>
            <Link href="/notifications" className="smallLink">View All</Link>
          </div>

          {recentActivity.length === 0 ? (
            <div className="emptyBox">
              <strong>No activity yet</strong>
              <p>Your messages, bookings and ride alerts will show here.</p>
            </div>
          ) : (
            <div className="activityList">
              {recentActivity.map((item) => (
                <Link key={item.id} href="/notifications" className="activityItem">
                  <div className="activityIcon">🔔</div>
                  <div>
                    <strong>{item.title || "RoadLink Update"}</strong>
                    <p>{item.message || "New activity available."}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="sectionCard">
          <p className="eyebrow">Quick Actions</p>
          <h2>Quick Actions</h2>

          <div className="actions">
            <ActionLink href="/wallet" icon="💰" label="Wallet" />
            <ActionLink href="/notifications" icon="🔔" label="Notifications" alert={unreadNotifications > 0} />
            <ActionLink href="/messages" icon="💬" label="Messages" />
            <ActionLink href="/find-ride" icon="🔎" label="Find a Ride" />
            <ActionLink href="/offer-ride" icon="➕" label="Offer a Ride" />
            <ActionLink href="/my-bookings" icon="📋" label="My Bookings" />
            <ActionLink href="/my-rides" icon="🚘" label="My Rides" />
            <ActionLink href="/dashboard/driver" icon="📊" label="Driver Dashboard" />
            <ActionLink href="/profile" icon="👤" label="Profile" />
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 16px;
          padding-bottom: 110px;
          font-family: Arial, sans-serif;
        }

        .dashboard {
          width: 100%;
          max-width: 860px;
          margin: 0 auto;
        }

        .heroCard,
        .metric,
        .sectionCard,
        .tripBox,
        .activityItem,
        .actionButton,
        .emptyBox {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 18px 60px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .heroCard {
          border-radius: 28px;
          padding: 22px;
          margin-bottom: 14px;
        }

        .heroTop {
          display: grid;
          grid-template-columns: 90px 1fr;
          gap: 14px;
          align-items: center;
        }

        .avatar,
        .avatarImage {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          border: 2px solid rgba(34,197,94,0.55);
          box-shadow: 0 12px 40px rgba(34,197,94,0.25);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: 900;
        }

        .avatarImage { object-fit: cover; }

        .heroText { min-width: 0; }

        .eyebrow {
          margin: 0 0 7px;
          color: #22c55e;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 26px;
          line-height: 1.05;
          margin: 0 0 7px;
          overflow-wrap: anywhere;
        }

        h2 {
          color: #22c55e;
          font-size: 24px;
          margin: 0;
        }

        .email,
        .trustLine,
        .location {
          color: #a1a1aa;
          font-size: 13px;
          margin: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .trustLine {
          color: #22c55e;
          font-weight: 900;
          margin-top: 6px;
        }

        .location { margin-top: 4px; }

        .heroActions {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin-top: 18px;
        }

        .heroPrimary,
        .heroSecondary,
        .mainButton {
          padding: 12px 8px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          color: white;
          font-size: 12px;
          font-weight: 900;
        }

        .heroPrimary,
        .mainButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .heroSecondary {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 0 0 14px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 14px;
        }

        .metric {
          display: block;
          border-radius: 20px;
          padding: 13px;
          min-height: 82px;
          text-decoration: none;
          color: white;
        }

        .metric.alertMetric {
          background: rgba(127,29,29,0.28);
          border-color: rgba(239,68,68,0.3);
        }

        .metricIcon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }

        .metric h3 {
          color: #a1a1aa;
          font-size: 11px;
          margin: 0 0 5px;
        }

        .metric p {
          color: #22c55e;
          font-size: 18px;
          font-weight: 900;
          margin: 0;
        }

        .alertMetric p { color: #fca5a5; }

        .sectionCard {
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 14px;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .statusPill,
        .smallLink {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
          white-space: nowrap;
        }

        .tripBox,
        .emptyBox {
          border-radius: 18px;
          padding: 16px;
          display: grid;
          gap: 8px;
        }

        .tripBox p,
        .emptyBox p,
        .activityItem p {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.4;
          margin: 0;
        }

        .activityList {
          display: grid;
          gap: 10px;
        }

        .activityItem {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          align-items: center;
          border-radius: 18px;
          padding: 14px;
          text-decoration: none;
          color: white;
        }

        .activityIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .activityItem strong {
          display: block;
          margin-bottom: 4px;
          overflow-wrap: anywhere;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 16px;
        }

        .actionButton {
          min-height: 74px;
          border-radius: 18px;
          padding: 14px;
          color: white;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
        }

        .actionButton span { font-size: 22px; }

        .actionButton strong { font-size: 14px; }

        .actionButton.alert {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        @media (max-width: 380px) {
          .heroTop { grid-template-columns: 76px 1fr; }

          .avatar,
          .avatarImage {
            width: 76px;
            height: 76px;
          }

          h1 { font-size: 23px; }

          .heroActions { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}

function Metric({
  icon,
  title,
  value,
  href,
  alert,
}: {
  icon: string;
  title: string;
  value: string;
  href: string;
  alert?: boolean;
}) {
  return (
    <Link href={href} className={alert ? "metric alertMetric" : "metric"}>
      <div className="metricIcon">{icon}</div>
      <h3>{title}</h3>
      <p>{value}</p>
    </Link>
  );
}

function ActionLink({
  href,
  icon,
  label,
  alert,
}: {
  href: string;
  icon: string;
  label: string;
  alert?: boolean;
}) {
  return (
    <Link href={href} className={alert ? "actionButton alert" : "actionButton"}>
      <span>{icon}</span>
      <strong>{label}</strong>
    </Link>
  );
}
