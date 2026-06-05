"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";

type Ride = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  seats: number;
  status: string;
};

type Booking = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  driverEmail: string;
  status: string;
};

type Chat = {
  id: string;
  chatId?: string;
  driverId?: string;
  passengerId?: string;
  unreadCount?: number;
};

export default function DashboardPage() {
  const [activeRides, setActiveRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const [avatar, setAvatar] = useState("R");
  const [message, setMessage] = useState("Loading dashboard...");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view your dashboard.");
        return;
      }

      setAvatar((user.email || "R").charAt(0).toUpperCase());

      try {
        const ridesQuery = query(
          collection(db, "rides"),
          where("driverId", "==", user.uid)
        );

        const ridesSnapshot = await getDocs(ridesQuery);

        const ridesData = ridesSnapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Ride[];

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("passengerId", "==", user.uid),
          where("status", "==", "reserved")
        );

        const bookingsSnapshot = await getDocs(bookingsQuery);

        const bookingsData = bookingsSnapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Booking[];

        const driverBookingsQuery = query(
          collection(db, "bookings"),
          where("driverId", "==", user.uid),
          where("status", "==", "reserved")
        );

        const driverBookingsSnapshot = await getDocs(driverBookingsQuery);

        const totalEarnings = driverBookingsSnapshot.docs.reduce(
          (total, document) => total + Number(document.data().price || 0),
          0
        );

        const driverChatsQuery = query(
          collection(db, "chats"),
          where("driverId", "==", user.uid)
        );

        const passengerChatsQuery = query(
          collection(db, "chats"),
          where("passengerId", "==", user.uid)
        );

        const driverChatsSnapshot = await getDocs(driverChatsQuery);
        const passengerChatsSnapshot = await getDocs(passengerChatsQuery);

        const chatsMap = new Map<string, Chat>();

        driverChatsSnapshot.docs.forEach((document) => {
          const data = {
            id: document.id,
            ...document.data(),
          } as Chat;

          const key = data.chatId || data.id;

          if (key !== "chat_abc123" && data.driverId !== "test-driver") {
            chatsMap.set(key, data);
          }
        });

        passengerChatsSnapshot.docs.forEach((document) => {
          const data = {
            id: document.id,
            ...document.data(),
          } as Chat;

          const key = data.chatId || data.id;

          if (key !== "chat_abc123" && data.passengerId !== "test-passenger") {
            chatsMap.set(key, data);
          }
        });

        const chatsData = Array.from(chatsMap.values());

        const unreadMessages = chatsData.reduce(
          (total, chat) => total + Number(chat.unreadCount || 0),
          0
        );

        setActiveRides(ridesData);
        setBookings(bookingsData);
        setEarnings(totalEarnings);
        setConversationCount(chatsData.length);
        setMessageCount(unreadMessages);
        setMessage("");
      } catch (error: any) {
        setMessage(error.message);
      }
    });

    return () => unsubscribe();
  }, []);

  const upcomingTrip = bookings[0];

  return (
    <main className="page">
      <section className="dashboard">
        <div className="topNav">
          <Link href="/" className="miniButton">Home</Link>
          <Link href="/find-ride" className="miniButton">Find Ride</Link>
          <Link href="/offer-ride" className="miniButton">Offer Ride</Link>
          <Link href="/messages" className="miniButton">
            Messages {messageCount > 0 ? `(${messageCount})` : ""}
          </Link>
          <Link href="/profile" className="miniButton">Profile</Link>
        </div>

        <section className="heroCard">
          <div>
            <p className="eyebrow">RoadLink Premium Dashboard</p>
            <h1>
              Welcome back, <span>driver.</span>
            </h1>
            <p className="subtitle">
              Manage your rides, bookings, earnings, messages, and upcoming trips from one powerful control center.
            </p>
          </div>

          <div className="avatar">{avatar}</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚗" title="Active Rides" value={String(activeRides.length)} href="/my-rides" />
          <Metric icon="🎟️" title="Booked Trips" value={String(bookings.length)} href="/my-bookings" />
          <Metric
            icon="💬"
            title={messageCount > 0 ? "Unread Messages" : "Messages"}
            value={messageCount > 0 ? String(messageCount) : String(conversationCount)}
            href="/messages"
            alert={messageCount > 0}
          />
          <Metric icon="💵" title="Earnings" value={`$${earnings}`} href="/dashboard/driver" />
        </section>

        <section className="premiumGrid">
          <div className="tripCard">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Next Reservation</p>
                <h2>Upcoming Trip</h2>
              </div>
              <div className="statusPill">Active</div>
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
                    <h3>{upcomingTrip.from}</h3>

                    <span>TO</span>
                    <h3>{upcomingTrip.to}</h3>
                  </div>
                </div>

                <div className="chips">
                  <div className="chip">📅 {upcomingTrip.date}</div>
                  <div className="chip">🕒 {upcomingTrip.time}</div>
                  <div className="chip green">${upcomingTrip.price}</div>
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
                  Reserve your next long-distance ride and it will appear here automatically.
                </p>
                <Link className="mainButton" href="/find-ride">
                  Find a Ride
                </Link>
              </div>
            )}
          </div>

          <div className="actionsCard">
            <p className="eyebrow">Quick Actions</p>
            <h2>Control Center</h2>

            <div className="actions">
              <Link href="/messages" className={messageCount > 0 ? "alertAction" : ""}>
                💬 Messages {messageCount > 0 ? `(${messageCount} new)` : conversationCount > 0 ? `(${conversationCount})` : ""}
              </Link>
              <Link href="/find-ride">🔎 Find a Ride</Link>
              <Link href="/offer-ride">➕ Offer a Ride</Link>
              <Link href="/my-bookings">📋 My Bookings</Link>
              <Link href="/my-rides">🚘 My Rides</Link>
              <Link href="/dashboard/driver">📊 Driver Dashboard</Link>
              <Link href="/profile">👤 Profile</Link>
            </div>
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
          max-width: 1120px;
          margin: 0 auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
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

        .heroCard,
        .tripCard,
        .actionsCard,
        .metric {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .heroCard {
          border-radius: 32px;
          padding: 34px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          margin-bottom: 24px;
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
        }

        h1 span {
          color: #22c55e;
        }

        .subtitle {
          max-width: 680px;
          color: #a1a1aa;
          font-size: 20px;
          line-height: 1.5;
          margin: 0;
        }

        .avatar {
          min-width: 90px;
          height: 90px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          font-weight: 900;
          box-shadow: 0 18px 55px rgba(34,197,94,0.35);
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
          grid-template-columns: 1.2fr 0.8fr;
          gap: 24px;
        }

        .tripCard,
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

        .statusPill {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          border-radius: 999px;
          padding: 10px 16px;
          font-weight: 900;
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
        .emptyTrip p {
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

        .actions {
          display: grid;
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
        }

        .actions a:first-child {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.12);
        }

        .actions a.alertAction {
          border-color: rgba(239,68,68,0.45);
          background: rgba(239,68,68,0.12);
          color: #fca5a5;
        }

        .actions a:hover {
          transform: translateX(4px);
          border-color: rgba(34,197,94,0.4);
        }

        @media (max-width: 800px) {
          .page {
            padding: 16px;
          }

          .heroCard {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 48px;
          }

          .subtitle {
            font-size: 18px;
          }

          .stats {
            grid-template-columns: 1fr 1fr;
          }

          .premiumGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .metric {
            padding: 18px;
          }

          .metric p {
            font-size: 28px;
          }

          .tripCard,
          .actionsCard {
            padding: 24px;
            border-radius: 28px;
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
