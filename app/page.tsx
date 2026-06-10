"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";

type UserProfile = {
  name?: string;
  email?: string;
  photoURL?: string;
  city?: string;
  state?: string;
};

type Ride = {
  id: string;
  driverId?: string;
  status?: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  seats?: number;
};

type Booking = {
  id: string;
  driverId?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
};

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  read?: boolean;
  createdAt?: string;
};

export default function Home() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<UserProfile>({});
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [avatar, setAvatar] = useState("R");
  const [message, setMessage] = useState("Loading home...");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeRides: (() => void) | undefined;
    let unsubscribeBookings: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserId("");
        setProfile({});
        setRides([]);
        setBookings([]);
        setNotifications([]);
        setMessage("");
        return;
      }

      const userEmail = user.email || "";
      const fallbackName = user.displayName || "RoadLink User";
      const fallbackPhoto = user.photoURL || "";

      setUserId(user.uid);
      setAvatar(userEmail ? userEmail.charAt(0).toUpperCase() : "R");

      const userRef = doc(db, "users", user.uid);

      try {
        const existingUser = await getDoc(userRef);

        if (!existingUser.exists()) {
          await setDoc(
            userRef,
            {
              name: fallbackName,
              email: userEmail,
              photoURL: fallbackPhoto,
              role: "member",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }

      unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
        const data = snapshot.data() as UserProfile | undefined;

        setProfile({
          name: data?.name || fallbackName,
          email: data?.email || userEmail,
          photoURL: data?.photoURL || fallbackPhoto,
          city: data?.city || "",
          state: data?.state || "",
        });

        setMessage("");
      });

      unsubscribeRides = onSnapshot(
        query(collection(db, "rides"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Ride[];

          setRides(data);
        }
      );

      unsubscribeBookings = onSnapshot(
        query(collection(db, "bookings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          setBookings(data);
        }
      );

      unsubscribeNotifications = onSnapshot(
        query(collection(db, "notifications"), where("userId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as NotificationItem[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setNotifications(data);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeRides) unsubscribeRides();
      if (unsubscribeBookings) unsubscribeBookings();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  const displayName = profile.name || "RoadLink User";
  const displayEmail = profile.email || "No email found";
  const displayPhoto = profile.photoURL || "";

  const activeRides = rides.filter((ride) => ride.status !== "cancelled");
  const completedBookings = bookings.filter((booking) => booking.status === "completed");
  const pendingBookings = bookings.filter(
    (booking) =>
      booking.status === "pending" ||
      booking.status === "reserved" ||
      booking.status === "confirmed"
  );

  const earnings = useMemo(() => {
    return completedBookings.reduce((total, booking) => {
      return total + Number(booking.price || 0) * Number(booking.seatsBooked || 1);
    }, 0);
  }, [completedBookings]);

  const unreadNotifications = notifications.filter((item) => !item.read).length;
  const upcomingRide = activeRides[0];

  return (
    <main className="page">
      <section className="heroCard">
        <div className="heroTop">
          {displayPhoto ? (
            <img src={displayPhoto} alt={displayName} className="avatarImage" />
          ) : (
            <div className="avatar">{avatar}</div>
          )}

          <div className="userInfo">
            <p className="eyebrow">RoadLink Dashboard</p>
            <h1>Welcome back, {displayName}</h1>
            <p className="email">{displayEmail}</p>
          </div>
        </div>

        <div className="quickActions">
          <Link href="/find-ride">🔎 Find Ride</Link>
          <Link href="/offer-ride">➕ Offer Ride</Link>
        </div>

        {message && <p className="message">{message}</p>}
      </section>

      <section className="statsGrid">
        <Stat icon="🚗" title="Active Rides" value={String(activeRides.length)} />
        <Stat icon="🎟️" title="Bookings" value={String(pendingBookings.length)} />
        <Stat icon="💬" title="Messages" value="0" />
        <Stat icon="🔔" title="Notifications" value={String(unreadNotifications)} alert />
        <Stat icon="✅" title="Completed Trips" value={String(completedBookings.length)} />
        <Stat icon="💰" title="Earnings" value={`$${earnings}`} />
      </section>

      <section className="sectionCard">
        <p className="eyebrow">Next Reservation</p>
        <h2>Upcoming Trip</h2>

        {upcomingRide ? (
          <div className="tripCard">
            <strong>
              {upcomingRide.from || "Origin"} → {upcomingRide.to || "Destination"}
            </strong>
            <span>
              {upcomingRide.date || "Date pending"} • {upcomingRide.time || "Time pending"}
            </span>
            <Link href="/my-rides">View Ride</Link>
          </div>
        ) : (
          <div className="tripCard">
            <strong>No upcoming trips yet.</strong>
            <span>Create or find a ride to get started.</span>
            <Link href="/find-ride">Find a Ride</Link>
          </div>
        )}
      </section>

      <section className="sectionCard">
        <p className="eyebrow">Road Activity</p>
        <h2>Live Feed</h2>

        {notifications.length === 0 ? (
          <div className="emptyFeed">No notifications yet.</div>
        ) : (
          notifications.slice(0, 4).map((notification) => (
            <div key={notification.id} className="feedItem">
              <div className="feedIcon">🔔</div>
              <div>
                <strong>{notification.title || "RoadLink Update"}</strong>
                <p>{notification.message || "You have a new update."}</p>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="sectionCard">
        <p className="eyebrow">Main Navigation</p>
        <h2>Control Center</h2>

        <div className="buttonGrid">
          <DashboardLink href="/notifications" icon="🔔" label="Notifications" />
          <DashboardLink href="/messages" icon="💬" label="Messages" />
          <DashboardLink href="/find-ride" icon="🔎" label="Find a Ride" />
          <DashboardLink href="/offer-ride" icon="➕" label="Offer Ride" />
          <DashboardLink href="/my-bookings" icon="🎟️" label="My Bookings" />
          <DashboardLink href="/my-rides" icon="🚘" label="My Rides" />
          <DashboardLink href="/wallet" icon="💰" label="Wallet" />
          <DashboardLink href="/dashboard/driver" icon="🚗" label="Driver Dashboard" />
          <DashboardLink href="/profile" icon="👤" label="Profile" />
        </div>
      </section>

      <nav className="bottomNav">
        <Link href="/">🏠<span>Home</span></Link>
        <Link href="/find-ride">🔎<span>Find</span></Link>
        <Link href="/offer-ride">➕<span>Offer</span></Link>
        <Link href="/messages">💬<span>Messages</span></Link>
        <Link href="/profile" className="active">
          👤<span>Profile</span>
          {unreadNotifications > 0 && <b>{unreadNotifications}</b>}
        </Link>
      </nav>

      <style>{`
        * {
          box-sizing: border-box;
        }

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

        .heroCard,
        .statsGrid,
        .sectionCard {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        .heroCard,
        .stat,
        .sectionCard,
        .tripCard,
        .feedItem,
        .dashboardButton {
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
          grid-template-columns: 74px 1fr;
          gap: 14px;
          align-items: center;
        }

        .avatar,
        .avatarImage {
          width: 74px;
          height: 74px;
          border-radius: 50%;
          border: 2px solid rgba(34,197,94,0.55);
          box-shadow: 0 12px 40px rgba(34,197,94,0.25);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          font-weight: 900;
        }

        .avatarImage {
          object-fit: cover;
        }

        .userInfo {
          min-width: 0;
        }

        .eyebrow {
          margin: 0 0 7px;
          color: #22c55e;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 28px;
          line-height: 1.05;
          margin: 0 0 7px;
          letter-spacing: -0.8px;
          overflow-wrap: anywhere;
        }

        .email {
          color: #a1a1aa;
          font-size: 13px;
          margin: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .quickActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 18px;
        }

        .quickActions a {
          padding: 13px 10px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          color: white;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          font-size: 13px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 14px 0 0;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 14px;
        }

        .stat {
          position: relative;
          border-radius: 20px;
          padding: 14px;
          min-height: 102px;
        }

        .stat.alert {
          background: rgba(127,29,29,0.28);
          border-color: rgba(239,68,68,0.3);
        }

        .statIcon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
        }

        .stat span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .stat strong {
          color: #22c55e;
          font-size: 20px;
        }

        .sectionCard {
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 14px;
        }

        h2 {
          color: #22c55e;
          font-size: 24px;
          margin: 0 0 16px;
        }

        .tripCard {
          border-radius: 18px;
          padding: 16px;
          display: grid;
          gap: 8px;
        }

        .tripCard strong {
          font-size: 16px;
        }

        .tripCard span,
        .feedItem p,
        .emptyFeed {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.4;
          margin: 0;
        }

        .tripCard a {
          margin-top: 8px;
          padding: 13px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          color: white;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          font-weight: 900;
        }

        .feedItem {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          align-items: center;
          border-radius: 18px;
          padding: 14px;
          margin-top: 10px;
        }

        .feedIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .feedItem strong {
          display: block;
          margin-bottom: 4px;
          overflow-wrap: anywhere;
        }

        .buttonGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .dashboardButton {
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

        .dashboardButton span {
          font-size: 22px;
        }

        .dashboardButton strong {
          font-size: 14px;
        }

        .bottomNav {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 12px;
          z-index: 50;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
          padding: 10px;
          border-radius: 26px;
          background: rgba(8, 13, 25, 0.96);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 18px 60px rgba(0,0,0,0.65);
          backdrop-filter: blur(16px);
        }

        .bottomNav a {
          position: relative;
          color: white;
          text-decoration: none;
          text-align: center;
          font-size: 17px;
          font-weight: 900;
          padding: 8px 4px;
          border-radius: 18px;
        }

        .bottomNav span {
          display: block;
          font-size: 10px;
          margin-top: 2px;
        }

        .bottomNav .active {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
        }

        .bottomNav b {
          position: absolute;
          top: 0;
          right: 8px;
          background: #ef4444;
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (min-width: 780px) {
          .page {
            padding: 24px;
            padding-bottom: 120px;
          }

          .heroCard {
            padding: 30px;
          }

          .heroTop {
            grid-template-columns: 110px 1fr;
            gap: 20px;
          }

          .avatar,
          .avatarImage {
            width: 110px;
            height: 110px;
          }

          h1 {
            font-size: 44px;
          }

          .email {
            font-size: 16px;
          }

          .statsGrid {
            grid-template-columns: repeat(3, 1fr);
          }

          .buttonGrid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </main>
  );
}

function Stat({
  icon,
  title,
  value,
  alert,
}: {
  icon: string;
  title: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={alert ? "stat alert" : "stat"}>
      <div className="statIcon">{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DashboardLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link href={href} className="dashboardButton">
      <span>{icon}</span>
      <strong>{label}</strong>
    </Link>
  );
}
