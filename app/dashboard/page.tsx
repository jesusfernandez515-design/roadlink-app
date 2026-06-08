"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

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
  createdAt?: string;
};

type Booking = {
  id: string;
  rideId?: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  price?: number;
  driverId?: string;
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
  lastMessage?: string;
  lastMessageTime?: string;
  lastSenderId?: string;
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
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [avatar, setAvatar] = useState("R");

  const [rides, setRides] = useState<Ride[]>([]);
  const [passengerBookings, setPassengerBookings] = useState<Booking[]>([]);
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [driverChats, setDriverChats] = useState<Chat[]>([]);
  const [passengerChats, setPassengerChats] = useState<Chat[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [message, setMessage] = useState("Loading dashboard...");

  useEffect(() => {
    let unsubscribeRides: (() => void) | undefined;
    let unsubscribePassengerBookings: (() => void) | undefined;
    let unsubscribeDriverBookings: (() => void) | undefined;
    let unsubscribeDriverChats: (() => void) | undefined;
    let unsubscribePassengerChats: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId("");
        setUserEmail("");
        setAvatar("R");
        setMessage("Please sign in to view your dashboard.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setAvatar((user.email || "R").charAt(0).toUpperCase());
      setMessage("");

      const ridesQuery = query(
        collection(db, "rides"),
        where("driverId", "==", user.uid)
      );

      unsubscribeRides = onSnapshot(
        ridesQuery,
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            ...document.data(),
            id: document.id,
          })) as Ride[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setRides(data);
        },
        (error) => setMessage(error.message)
      );

      const passengerBookingsQuery = query(
        collection(db, "bookings"),
        where("passengerId", "==", user.uid)
      );

      unsubscribePassengerBookings = onSnapshot(
        passengerBookingsQuery,
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            ...document.data(),
            id: document.id,
          })) as Booking[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setPassengerBookings(data);
        },
        (error) => setMessage(error.message)
      );

      const driverBookingsQuery = query(
        collection(db, "bookings"),
        where("driverId", "==", user.uid)
      );

      unsubscribeDriverBookings = onSnapshot(
        driverBookingsQuery,
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            ...document.data(),
            id: document.id,
          })) as Booking[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setDriverBookings(data);
        },
        (error) => setMessage(error.message)
      );

      const driverChatsQuery = query(
        collection(db, "chats"),
        where("driverId", "==", user.uid)
      );

      unsubscribeDriverChats = onSnapshot(
        driverChatsQuery,
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            ...document.data(),
            id: document.id,
          })) as Chat[];

          setDriverChats(data);
        },
        (error) => setMessage(error.message)
      );

      const passengerChatsQuery = query(
        collection(db, "chats"),
        where("passengerId", "==", user.uid)
      );

      unsubscribePassengerChats = onSnapshot(
        passengerChatsQuery,
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            ...document.data(),
            id: document.id,
          })) as Chat[];

          setPassengerChats(data);
        },
        (error) => setMessage(error.message)
      );

      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid)
      );

      unsubscribeNotifications = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            ...document.data(),
            id: document.id,
          })) as NotificationItem[];

          data.sort((a, b) =>
            getNotificationTime(b.createdAt) - getNotificationTime(a.createdAt)
          );

          setNotifications(data);
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeRides) unsubscribeRides();
      if (unsubscribePassengerBookings) unsubscribePassengerBookings();
      if (unsubscribeDriverBookings) unsubscribeDriverBookings();
      if (unsubscribeDriverChats) unsubscribeDriverChats();
      if (unsubscribePassengerChats) unsubscribePassengerChats();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  function getNotificationTime(value?: any) {
    try {
      const date = value?.toDate ? value.toDate() : new Date(value || "");
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    } catch {
      return 0;
    }
  }

  function formatActivityTime(value?: any) {
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

  const unreadNotifications = notifications.filter(
    (notification) => !notification.read
  ).length;

  const earnings = driverBookings
    .filter(
      (booking) =>
        booking.status === "reserved" || booking.status === "completed"
    )
    .reduce(
      (total, booking) =>
        total + Number(booking.price || 0) * Number(booking.seatsBooked || 1),
      0
    );

  const passengersTransported = driverBookings
    .filter(
      (booking) =>
        booking.status === "reserved" || booking.status === "completed"
    )
    .reduce((total, booking) => total + Number(booking.seatsBooked || 1), 0);

  const upcomingTrip = activePassengerBookings[0];
  const recentActivity = notifications.slice(0, 5);

  const greetingName =
    userEmail?.split("@")[0]?.replace(/[._-]/g, " ") || "RoadLink User";

  return (
    <main className="page">
      <section className="dashboard">
        <nav className="topNav">
          <Link href="/" className="miniButton">Home</Link>
          <Link href="/find-ride" className="miniButton">Find Ride</Link>
          <Link href="/offer-ride" className="miniButton">Offer Ride</Link>

          <Link href="/messages" className={unreadMessages > 0 ? "miniButton alertNav" : "miniButton"}>
            Messages {unreadMessages > 0 && <span className="navBadge">{unreadMessages}</span>}
          </Link>

          <Link href="/notifications" className={unreadNotifications > 0 ? "miniButton alertNav" : "miniButton"}>
            Notifications {unreadNotifications > 0 && <span className="navBadge">{unreadNotifications}</span>}
          </Link>

          <Link href="/profile" className="miniButton">Profile</Link>
        </nav>

        <section className="heroCard">
          <div>
            <p className="eyebrow">RoadLink Executive Dashboard</p>
            <h1>
              Welcome back, <span>{greetingName}.</span>
            </h1>
            <p className="subtitle">
              Your premium command center for rides, bookings, messages,
              notifications, earnings, and passenger activity.
            </p>

            <div className="heroActions">
              <Link href="/offer-ride" className="heroPrimary">➕ Offer Ride</Link>
              <Link href="/find-ride" className="heroSecondary">🔎 Find Ride</Link>
            </div>
          </div>

          <div className="profileOrb">
            <div className="avatar">{avatar}</div>
            {(unreadMessages > 0 || unreadNotifications > 0) && (
              <div className="orbBadge">
                {unreadMessages + unreadNotifications}
              </div>
            )}
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚘" title="Active Rides" value={String(activeRides.length)} href="/my-rides" />
          <Metric icon="🎟️" title="Reservations" value={String(activeDriverBookings.length)} href="/ride-passengers" />
          <Metric icon="💬" title="Unread Messages" value={String(unreadMessages)} href="/messages" alert={unreadMessages > 0} />
          <Metric icon="🔔" title="Notifications" value={String(unreadNotifications)} href="/notifications" alert={unreadNotifications > 0} />
          <Metric icon="✅" title="Completed Trips" value={String(completedRides.length)} href="/my-rides" />
          <Metric icon="👥" title="Passengers" value={String(passengersTransported)} href="/my-rides" />
          <Metric icon="📋" title="My Bookings" value={String(activePassengerBookings.length)} href="/my-bookings" />
          <Metric icon="💵" title="Earnings" value={`$${earnings}`} href="/dashboard/driver" />
        </section>

        <section className="premiumGrid">
          <div className="tripCard">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Next Reservation</p>
                <h2>Upcoming Trip</h2>
              </div>

              <div className="statusPill">Live</div>
            </div>

            {upcomingTrip ? (
              <div className="tripContent">
                <div className="route">
                  <div className="routeLine">
                    <div className="dot" />
                    <div className="line" />
                    <div className="dot" />
                  </div>

                  <div>
                    <span>FROM</span>
                    <h3>{upcomingTrip.from || "Starting point"}</h3>

                    <span>TO</span>
                    <h3>{upcomingTrip.to || "Destination"}</h3>
                  </div>
                </div>

                <div className="chips">
                  <div className="chip">📅 {upcomingTrip.date || "Date"}</div>
                  <div className="chip">🕒 {upcomingTrip.time || "Time"}</div>
                  <div className="chip green">${upcomingTrip.price || 0}</div>
                </div>

                <p className="driver">
                  Driver: {upcomingTrip.driverEmail || "RoadLink Driver"}
                </p>

                <Link className="mainButton" href="/my-bookings">
                  View Booking
                </Link>
              </div>
            ) : (
              <div className="emptyTrip">
                <h3>No upcoming trips yet.</h3>
                <p>
                  Reserve your next ride and your trip summary will appear here.
                </p>
                <Link className="mainButton" href="/find-ride">
                  Find a Ride
                </Link>
              </div>
            )}
          </div>

          <div className="activityCard">
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
              <div className="emptyActivity">
                <div className="emptyIcon">🔕</div>
                <h3>No activity yet</h3>
                <p>Your messages, bookings and ride alerts will show here.</p>
              </div>
            ) : (
              <div className="activityList">
                {recentActivity.map((item) => (
                  <Link
                    key={item.id}
                    href={item.actionUrl || "/notifications"}
                    className={item.read ? "activityItem" : "activityItem unreadActivity"}
                  >
                    <div className="activityIcon">{getActivityIcon(item.type)}</div>

                    <div>
                      <strong>{item.title || "RoadLink Update"}</strong>
                      <p>{item.message || "New activity available."}</p>
                      <span>{formatActivityTime(item.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="actionsCard">
          <p className="eyebrow">Quick Actions</p>
          <h2>Premium Control Center</h2>

          <div className="actions">
            <Link href="/notifications" className={unreadNotifications > 0 ? "alertAction" : ""}>
              🔔 Notifications {unreadNotifications > 0 ? `(${unreadNotifications} new)` : ""}
            </Link>

            <Link href="/messages" className={unreadMessages > 0 ? "alertAction" : ""}>
              💬 Messages {unreadMessages > 0 ? `(${unreadMessages} new)` : chats.length > 0 ? `(${chats.length})` : ""}
            </Link>

            <Link href="/find-ride">🔎 Find a Ride</Link>
            <Link href="/offer-ride">➕ Offer a Ride</Link>
            <Link href="/my-bookings">📋 My Bookings</Link>
            <Link href="/my-rides">🚘 My Rides</Link>
            <Link href="/dashboard/driver">📊 Driver Dashboard</Link>
            <Link href="/profile">👤 Profile</Link>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 32%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.14), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .dashboard {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .miniButton:hover {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.12);
        }

        .alertNav {
          border-color: rgba(239,68,68,0.45);
          background: rgba(239,68,68,0.12);
        }

        .navBadge,
        .orbBadge {
          min-width: 24px;
          height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          background: #ef4444;
          color: white;
          font-size: 12px;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 18px rgba(239,68,68,0.75);
        }

        .heroCard,
        .tripCard,
        .activityCard,
        .actionsCard,
        .metric {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .heroCard {
          border-radius: 34px;
          padding: 36px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          margin-bottom: 24px;
          overflow: hidden;
          position: relative;
        }

        .heroCard::after {
          content: "";
          position: absolute;
          inset: auto -80px -120px auto;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          filter: blur(4px);
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
          letter-spacing: -1px;
          max-width: 760px;
        }

        h1 span {
          color: #22c55e;
          text-transform: capitalize;
        }

        .subtitle {
          max-width: 720px;
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .heroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 26px;
        }

        .heroPrimary,
        .heroSecondary {
          padding: 16px 22px;
          border-radius: 999px;
          font-weight: 900;
          text-decoration: none;
        }

        .heroPrimary {
          color: white;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .heroSecondary {
          color: white;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .profileOrb {
          position: relative;
          z-index: 1;
        }

        .avatar {
          min-width: 96px;
          height: 96px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
          font-weight: 900;
          box-shadow: 0 18px 55px rgba(34,197,94,0.35);
        }

        .orbBadge {
          position: absolute;
          top: -5px;
          right: -5px;
        }

        .message {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
          margin: 24px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .metric {
          display: block;
          border-radius: 24px;
          padding: 22px;
          transition: all 0.25s ease;
          text-decoration: none;
          color: white;
          position: relative;
        }

        .metric.alertMetric {
          border-color: rgba(239,68,68,0.45);
          background: rgba(239,68,68,0.08);
        }

        .metric.alertMetric::after {
          content: "";
          position: absolute;
          top: 18px;
          right: 18px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 18px rgba(239,68,68,0.8);
        }

        .metric:hover {
          transform: translateY(-4px);
          border-color: rgba(34,197,94,0.4);
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
          margin-bottom: 16px;
        }

        .metric h3 {
          color: #a1a1aa;
          font-size: 14px;
          margin: 0 0 10px;
        }

        .metric p {
          color: #22c55e;
          font-size: 32px;
          font-weight: 900;
          margin: 0;
        }

        .alertMetric p {
          color: #fca5a5;
        }

        .premiumGrid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .tripCard,
        .activityCard,
        .actionsCard {
          border-radius: 30px;
          padding: 30px;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 24px;
        }

        h2 {
          font-size: 32px;
          margin: 0;
        }

        .statusPill,
        .smallLink {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          border-radius: 999px;
          padding: 10px 16px;
          font-weight: 900;
          text-decoration: none;
        }

        .route {
          display: grid;
          grid-template-columns: 32px 1fr;
          gap: 18px;
          margin-bottom: 22px;
        }

        .routeLine {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 130px;
        }

        .dot {
          width: 17px;
          height: 17px;
          border-radius: 50%;
          border: 4px solid #22c55e;
        }

        .line {
          width: 4px;
          flex: 1;
          background: #22c55e;
        }

        .route span {
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
        }

        .route h3 {
          font-size: 28px;
          margin: 6px 0 22px;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 18px 0;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e5e7eb;
          font-weight: 800;
        }

        .chip.green {
          color: #22c55e;
        }

        .driver,
        .emptyTrip p,
        .emptyActivity p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .mainButton {
          display: block;
          width: 100%;
          margin-top: 18px;
          padding: 18px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          text-align: center;
          text-decoration: none;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .emptyActivity {
          text-align: center;
          padding: 34px 12px;
        }

        .emptyIcon {
          width: 70px;
          height: 70px;
          margin: 0 auto 16px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
        }

        .activityList {
          display: grid;
          gap: 12px;
        }

        .activityItem {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          text-decoration: none;
          color: white;
        }

        .unreadActivity {
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
          margin-bottom: 5px;
        }

        .activityItem p {
          color: #d4d4d8;
          margin: 0 0 6px;
          line-height: 1.4;
        }

        .activityItem span {
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 24px;
        }

        .actions a {
          display: block;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px;
          padding: 18px;
          color: white;
          text-decoration: none;
          font-weight: 900;
          transition: all 0.25s ease;
          text-align: center;
        }

        .actions a.alertAction {
          border-color: rgba(239,68,68,0.45);
          background: rgba(239,68,68,0.12);
          color: #fca5a5;
        }

        .actions a:hover {
          transform: translateY(-3px);
          border-color: rgba(34,197,94,0.4);
        }

        @media (max-width: 1000px) {
          .stats,
          .actions {
            grid-template-columns: repeat(2, 1fr);
          }

          .premiumGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .heroCard {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .subtitle {
            font-size: 18px;
          }

          .avatar {
            min-width: 82px;
            height: 82px;
            font-size: 34px;
          }

          .tripCard,
          .activityCard,
          .actionsCard {
            padding: 24px;
            border-radius: 28px;
          }
        }

        @media (max-width: 480px) {
          .stats,
          .actions {
            grid-template-columns: 1fr;
          }

          .metric {
            padding: 18px;
          }

          .metric p {
            font-size: 28px;
          }

          .sectionHeader {
            flex-direction: column;
            align-items: flex-start;
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
