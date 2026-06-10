"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
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
};

type Ride = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  status?: string;
  createdAt?: string;
};

type Booking = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  status?: string;
  seatsBooked?: number;
  createdAt?: string;
};

type Chat = {
  id: string;
  chatId?: string;
  driverId?: string;
  passengerId?: string;
  unreadCount?: number;
};

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  read?: boolean;
  createdAt?: any;
  actionUrl?: string;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile>({});
  const [avatar, setAvatar] = useState("R");
  const [rides, setRides] = useState<Ride[]>([]);
  const [passengerBookings, setPassengerBookings] = useState<Booking[]>([]);
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [driverChats, setDriverChats] = useState<Chat[]>([]);
  const [passengerChats, setPassengerChats] = useState<Chat[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [message, setMessage] = useState("Loading dashboard...");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeRides: (() => void) | undefined;
    let unsubscribePassengerBookings: (() => void) | undefined;
    let unsubscribeDriverBookings: (() => void) | undefined;
    let unsubscribeDriverChats: (() => void) | undefined;
    let unsubscribePassengerChats: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile({});
        setAvatar("R");
        setMessage("Please sign in to view your dashboard.");
        return;
      }

      const userEmail = user.email || "";
      const fallbackName = user.displayName || "RoadLink User";
      const fallbackPhoto = user.photoURL || "";

      setAvatar(userEmail ? userEmail.charAt(0).toUpperCase() : "R");
      setMessage("");

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
        } else {
          await setDoc(
            userRef,
            {
              email: userEmail,
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
        });
      });

      unsubscribeRides = onSnapshot(
        query(collection(db, "rides"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Ride[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setRides(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribePassengerBookings = onSnapshot(
        query(collection(db, "bookings"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setPassengerBookings(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribeDriverBookings = onSnapshot(
        query(collection(db, "bookings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setDriverBookings(data);
        },
        (error) => setMessage(error.message)
      );

      unsubscribeDriverChats = onSnapshot(
        query(collection(db, "chats"), where("driverId", "==", user.uid)),
        (snapshot) => {
          setDriverChats(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Chat[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribePassengerChats = onSnapshot(
        query(collection(db, "chats"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          setPassengerChats(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Chat[]
          );
        },
        (error) => setMessage(error.message)
      );

      unsubscribeNotifications = onSnapshot(
        query(collection(db, "notifications"), where("userId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as NotificationItem[];

          data.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
          setNotifications(data);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeRides) unsubscribeRides();
      if (unsubscribePassengerBookings) unsubscribePassengerBookings();
      if (unsubscribeDriverBookings) unsubscribeDriverBookings();
      if (unsubscribeDriverChats) unsubscribeDriverChats();
      if (unsubscribePassengerChats) unsubscribePassengerChats();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  function getTime(value?: any) {
    try {
      const date = value?.toDate ? value.toDate() : new Date(value || "");
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    } catch {
      return 0;
    }
  }

  function formatTime(value?: any) {
    if (!value) return "Recently";

    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return "Recently";

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  function getActivityIcon(type?: string) {
    if (type === "message") return "💬";
    if (type === "booking") return "🎟️";
    if (type === "ride") return "🚘";
    if (type === "review") return "⭐";
    if (type === "payment") return "💵";
    return "🔔";
  }

  const chats = useMemo(() => {
    const map = new Map<string, Chat>();

    [...driverChats, ...passengerChats].forEach((chat) => {
      const key = chat.chatId || chat.id;

      if (!key) return;
      if (key === "chat_abc123") return;
      if (chat.driverId === "test-driver") return;
      if (chat.passengerId === "test-passenger") return;

      map.set(key, chat);
    });

    return Array.from(map.values());
  }, [driverChats, passengerChats]);

  const activeRides = rides.filter(
    (ride) => ride.status === "active" || ride.status === "full"
  );

  const completedRides = rides.filter((ride) => ride.status === "completed");

  const activePassengerBookings = passengerBookings.filter(
    (booking) => booking.status === "reserved"
  );

  const activeDriverBookings = driverBookings.filter(
    (booking) => booking.status === "reserved"
  );

  const unreadMessages = chats.reduce(
    (total, chat) => total + Number(chat.unreadCount || 0),
    0
  );

  const unreadNotifications = notifications.filter((item) => !item.read).length;

  const earnings = driverBookings
    .filter((booking) => booking.status === "reserved" || booking.status === "completed")
    .reduce(
      (total, booking) =>
        total + Number(booking.price || 0) * Number(booking.seatsBooked || 1),
      0
    );

  const passengersTransported = driverBookings
    .filter((booking) => booking.status === "reserved" || booking.status === "completed")
    .reduce((total, booking) => total + Number(booking.seatsBooked || 1), 0);

  const upcomingTrip = activePassengerBookings[0];
  const recentActivity = notifications.slice(0, 3);

  const displayName = profile.name || "RoadLink User";
  const displayEmail = profile.email || "No email found";
  const displayPhoto = profile.photoURL || "";

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
            </div>
          </div>

          <p className="subtitle">
            Manage your rides, bookings, messages, notifications and earnings.
          </p>

          <div className="heroActions">
            <Link href="/offer-ride" className="heroPrimary">
              ➕ Offer Ride
            </Link>
            <Link href="/find-ride" className="heroSecondary">
              🔎 Find Ride
            </Link>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚘" title="Active Rides" value={String(activeRides.length)} href="/my-rides" />
          <Metric icon="🎟️" title="Reservations" value={String(activeDriverBookings.length)} href="/ride-passengers" />
          <Metric icon="💬" title="Messages" value={String(unreadMessages)} href="/messages" alert={unreadMessages > 0} />
          <Metric icon="🔔" title="Notifications" value={String(unreadNotifications)} href="/notifications" alert={unreadNotifications > 0} />
          <Metric icon="✅" title="Completed Trips" value={String(completedRides.length)} href="/my-rides" />
          <Metric icon="👥" title="Passengers" value={String(passengersTransported)} href="/my-rides" />
          <Metric icon="📋" title="My Bookings" value={String(activePassengerBookings.length)} href="/my-bookings" />
          <Metric icon="💵" title="Earnings" value={`$${earnings}`} href="/dashboard/driver" />
        </section>

        <section className="sectionCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Next Reservation</p>
              <h2>Upcoming Trip</h2>
            </div>

            <span className="statusPill">Live</span>
          </div>

          {upcomingTrip ? (
            <div className="tripBox">
              <strong>
                {upcomingTrip.from || "Origin"} → {upcomingTrip.to || "Destination"}
              </strong>
              <p>
                {upcomingTrip.date || "Date pending"} • {upcomingTrip.time || "Time pending"}
              </p>
              <p>{upcomingTrip.driverEmail || "RoadLink Driver"}</p>
              <Link href="/my-bookings" className="mainButton">
                View Booking
              </Link>
            </div>
          ) : (
            <div className="tripBox">
              <strong>No upcoming trips yet.</strong>
              <p>Reserve your next ride and your trip summary will appear here.</p>
              <Link href="/find-ride" className="mainButton">
                Find a Ride
              </Link>
            </div>
          )}
        </section>

        <section className="sectionCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Recent Activity</p>
              <h2>Live Feed</h2>
            </div>

            <Link href="/notifications" className="smallLink">
              View All
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <div className="emptyBox">
              <strong>No activity yet</strong>
              <p>Your messages, bookings and ride alerts will show here.</p>
            </div>
          ) : (
            <div className="activityList">
              {recentActivity.map((item) => (
                <Link
                  key={item.id}
                  href={item.actionUrl || "/notifications"}
                  className={item.read ? "activityItem" : "activityItem unread"}
                >
                  <div className="activityIcon">{getActivityIcon(item.type)}</div>

                  <div>
                    <strong>{item.title || "RoadLink Update"}</strong>
                    <p>{item.message || "New activity available."}</p>
                    <span>{formatTime(item.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="sectionCard">
          <p className="eyebrow">Quick Actions</p>
          <h2>Control Center</h2>

          <div className="actions">
            <ActionLink href="/notifications" icon="🔔" label="Notifications" alert={unreadNotifications > 0} />
            <ActionLink href="/messages" icon="💬" label="Messages" alert={unreadMessages > 0} />
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
          overflow: hidden;
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

        .heroText {
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

        h2 {
          color: #22c55e;
          font-size: 24px;
          margin: 0;
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

        .subtitle {
          color: #a1a1aa;
          font-size: 14px;
          line-height: 1.45;
          margin: 16px 0 0;
        }

        .heroActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 18px;
        }

        .heroPrimary,
        .heroSecondary,
        .mainButton {
          padding: 13px 10px;
          border-radius: 999px;
          text-align: center;
          text-decoration: none;
          color: white;
          font-size: 13px;
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
          position: relative;
          display: block;
          border-radius: 20px;
          padding: 14px;
          min-height: 102px;
          text-decoration: none;
          color: white;
        }

        .metric.alertMetric {
          background: rgba(127,29,29,0.28);
          border-color: rgba(239,68,68,0.3);
        }

        .metricIcon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
        }

        .metric h3 {
          color: #a1a1aa;
          font-size: 12px;
          margin: 0 0 6px;
        }

        .metric p {
          color: #22c55e;
          font-size: 20px;
          font-weight: 900;
          margin: 0;
        }

        .alertMetric p {
          color: #fca5a5;
        }

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
        }

        .tripBox {
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

        .activityItem.unread {
          background: rgba(34,197,94,0.08);
          border-color: rgba(34,197,94,0.28);
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

        .activityItem span {
          display: block;
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
          margin-top: 5px;
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

        .actionButton span {
          font-size: 22px;
        }

        .actionButton strong {
          font-size: 14px;
        }

        .actionButton.alert {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
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

          .stats {
            grid-template-columns: repeat(4, 1fr);
          }

          .actions {
            grid-template-columns: repeat(4, 1fr);
          }
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
  href?: string;
  alert?: boolean;
}) {
  const content = (
    <>
      <div className="metricIcon">{icon}</div>
      <h3>{title}</h3>
      <p>{value}</p>
    </>
  );

  const className = alert ? "metric alertMetric" : "metric";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
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
