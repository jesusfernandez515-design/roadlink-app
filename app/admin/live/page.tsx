"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  online?: boolean;
  lastSeen?: string;
  driverVerified?: boolean;
  suspended?: boolean;
  createdAt?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverEmail?: string;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  status?: string;
  passengerEmail?: string;
  driverEmail?: string;
  createdAt?: string;
};

type EmergencyItem = {
  id: string;
  status?: string;
  priority?: string;
  userEmail?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
};

type ActivityItem = {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  status?: string;
  createdAt?: string;
};

export default function AdminLivePage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [message, setMessage] = useState("Loading live center...");

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubRides = onSnapshot(
      query(collection(db, "rides")),
      (snapshot) => {
        setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
      },
      () => setRides([])
    );

    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
      },
      () => setBookings([])
    );

    const unsubEmergencies = onSnapshot(
      query(collection(db, "emergencyAlerts")),
      (snapshot) => {
        setEmergencies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyItem[]);
      },
      () => setEmergencies([])
    );

    const unsubActivities = onSnapshot(
      query(collection(db, "activityFeed")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ActivityItem[];

        data.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );

        setActivities(data.slice(0, 12));
      },
      () => setActivities([])
    );

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubEmergencies();
      unsubActivities();
    };
  }, []);

  function timeAgo(value?: string) {
    if (!value) return "Recently";

    try {
      const date = new Date(value);
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

      if (seconds < 60) return "Just now";

      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} min ago`;

      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hr ago`;

      const days = Math.floor(hours / 24);
      return `${days} day${days === 1 ? "" : "s"} ago`;
    } catch {
      return "Recently";
    }
  }

  function shortText(value?: string, max = 34) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  function activityIcon(type?: string) {
    if (type === "user") return "👥";
    if (type === "ride") return "🚘";
    if (type === "booking") return "🎟️";
    if (type === "payout") return "🏦";
    if (type === "verification") return "🛡️";
    if (type === "report") return "⚠️";
    if (type === "sos") return "🚨";
    return "📡";
  }

  const live = useMemo(() => {
    const activeRides = rides.filter(
      (ride) => ride.status === "active" || ride.status === "open" || ride.status === "in_progress"
    );

    const activeBookings = bookings.filter(
      (booking) =>
        booking.status === "pending" ||
        booking.status === "reserved" ||
        booking.status === "confirmed"
    );

    const activeSOS = emergencies.filter((item) => item.status === "active");
    const criticalSOS = emergencies.filter(
      (item) => item.status === "active" && (item.priority === "critical" || !item.priority)
    );

    const verifiedDrivers = users.filter((user) => user.driverVerified).length;
    const suspendedUsers = users.filter((user) => user.suspended).length;

    const onlineUsers = users.filter((user) => {
      if (user.online) return true;
      if (!user.lastSeen) return false;

      const diff = Date.now() - new Date(user.lastSeen).getTime();
      return diff >= 0 && diff <= 15 * 60 * 1000;
    });

    let liveScore = 100;

    if (activeSOS.length > 0) liveScore -= 25;
    if (criticalSOS.length > 0) liveScore -= Math.min(25, criticalSOS.length * 10);
    if (suspendedUsers > 0) liveScore -= Math.min(15, suspendedUsers * 3);
    if (activeRides.length === 0 && users.length > 0) liveScore -= 5;

    return {
      activeRides,
      activeBookings,
      activeSOS,
      criticalSOS,
      verifiedDrivers,
      suspendedUsers,
      onlineUsers,
      liveScore: Math.max(liveScore, 0),
    };
  }, [users, rides, bookings, emergencies]);

  const latestRides = useMemo(() => {
    return [...rides]
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
      .slice(0, 5);
  }, [rides]);

  const latestBookings = useMemo(() => {
    return [...bookings]
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
      .slice(0, 5);
  }, [bookings]);

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/activity" className="miniButton">Activity</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin Live</p>
            <h1>Live <span>Center</span></h1>
            <p className="subtitle">
              Monitor active users, rides, bookings, SOS alerts and real-time platform activity.
            </p>
          </div>

          <div className={live.liveScore < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{live.liveScore}</strong>
            <span>Live Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="statusBanner">
          <div className="liveDot"></div>
          <div>
            <strong>RoadLink is live</strong>
            <span>Realtime listeners connected to Firestore.</span>
          </div>
        </section>

        <section className="stats">
          <Metric icon="🟢" label="Online Users" value={String(live.onlineUsers.length)} />
          <Metric icon="🚘" label="Active Rides" value={String(live.activeRides.length)} />
          <Metric icon="🎟️" label="Active Bookings" value={String(live.activeBookings.length)} />
          <Metric icon="🛡️" label="Drivers" value={String(live.verifiedDrivers)} />
          <Metric icon="🚨" label="Active SOS" value={String(live.activeSOS.length)} danger={live.activeSOS.length > 0} />
          <Metric icon="🔥" label="Critical SOS" value={String(live.criticalSOS.length)} danger={live.criticalSOS.length > 0} />
        </section>

        <section className="gridTwo">
          <Panel title="Live Activity" eyebrow="Realtime Feed" icon="📡">
            {activities.length === 0 ? (
              <div className="empty">
                <h3>No activity yet</h3>
                <p>Live activity will appear here as users interact with RoadLink.</p>
              </div>
            ) : (
              <div className="list">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className={activity.type === "sos" || activity.type === "report" ? "row dangerRow" : "row"}
                  >
                    <div className="rowIcon">{activityIcon(activity.type)}</div>
                    <div className="rowText">
                      <strong>{shortText(activity.title || "RoadLink Activity")}</strong>
                      <span>{shortText(activity.description || activity.type || "Platform update", 44)}</span>
                    </div>
                    <em>{timeAgo(activity.createdAt)}</em>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="SOS Monitor" eyebrow="Safety" icon="🚨" danger>
            {live.activeSOS.length === 0 ? (
              <div className="empty">
                <h3>No active SOS</h3>
                <p>There are no active emergency alerts right now.</p>
              </div>
            ) : (
              <div className="list">
                {live.activeSOS.map((alert) => (
                  <Link href="/admin/emergency" key={alert.id} className="row dangerRow linkRow">
                    <div className="rowIcon">🚨</div>
                    <div className="rowText">
                      <strong>{shortText(alert.userEmail || "Emergency Alert")}</strong>
                      <span>{alert.latitude && alert.longitude ? "Location available" : "Location missing"}</span>
                    </div>
                    <em>{timeAgo(alert.createdAt)}</em>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Active Rides" eyebrow="Trips" icon="🚘">
            {latestRides.length === 0 ? (
              <div className="empty">
                <h3>No rides yet</h3>
                <p>Published rides will appear here.</p>
              </div>
            ) : (
              <div className="list">
                {latestRides.map((ride) => (
                  <Link href="/admin/rides" key={ride.id} className="row linkRow">
                    <div className="rowIcon">🚘</div>
                    <div className="rowText">
                      <strong>{shortText(`${ride.from || "Origin"} → ${ride.to || "Destination"}`, 42)}</strong>
                      <span>{ride.driverEmail || ride.status || "Ride activity"}</span>
                    </div>
                    <em>{timeAgo(ride.createdAt)}</em>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Booking Stream" eyebrow="Reservations" icon="🎟️">
            {latestBookings.length === 0 ? (
              <div className="empty">
                <h3>No bookings yet</h3>
                <p>Reservation activity will appear here.</p>
              </div>
            ) : (
              <div className="list">
                {latestBookings.map((booking) => (
                  <Link href="/admin/bookings" key={booking.id} className="row linkRow">
                    <div className="rowIcon">🎟️</div>
                    <div className="rowText">
                      <strong>{booking.status || "Booking Activity"}</strong>
                      <span>{booking.passengerEmail || booking.driverEmail || "RoadLink booking"}</span>
                    </div>
                    <em>{timeAgo(booking.createdAt)}</em>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <section className="quickCard">
          <p className="eyebrow">Live Operations</p>
          <h2>Quick Actions</h2>

          <div className="quickLinks">
            <Link href="/admin/users">👥 Users</Link>
            <Link href="/admin/rides">🚘 Rides</Link>
            <Link href="/admin/bookings">🎟️ Bookings</Link>
            <Link href="/admin/activity">📡 Activity</Link>
            <Link href="/admin/emergency">🚨 SOS</Link>
            <Link href="/admin/fraud">🕵️ Fraud</Link>
            <Link href="/admin/payouts">🏦 Payouts</Link>
            <Link href="/admin/analytics">📊 Analytics</Link>
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        html,
        body {
          overflow-x: hidden;
        }

        .page {
          width: 100%;
          min-height: 100vh;
          color: white;
          padding: 12px;
          padding-bottom: 150px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 32%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 36%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          width: 100%;
          max-width: 1180px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .miniButton {
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
        }

        .dangerLink {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .hero,
        .metric,
        .panel,
        .quickCard,
        .statusBanner {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 16px 44px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 12px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: center;
        }

        .eyebrow {
          margin: 0 0 7px;
          color: #22c55e;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 34px;
          line-height: 0.98;
          margin: 0 0 10px;
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          margin: 0;
          font-size: 24px;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.45;
          margin: 0;
        }

        .scoreOrb {
          min-width: 74px;
          width: 74px;
          height: 74px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .warningScore {
          background: rgba(250,204,21,0.12);
          border-color: rgba(250,204,21,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 24px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fde68a;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 9px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }

        .statusBanner {
          border-radius: 18px;
          padding: 14px;
          display: grid;
          grid-template-columns: 14px 1fr;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .liveDot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 1.3s infinite;
        }

        .statusBanner strong,
        .statusBanner span {
          display: block;
        }

        .statusBanner span {
          color: #a1a1aa;
          font-size: 12px;
          margin-top: 3px;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70% { box-shadow: 0 0 0 9px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }

        .metric {
          border-radius: 16px;
          padding: 11px;
          min-height: 58px;
          display: grid;
          grid-template-columns: 34px 1fr auto;
          gap: 8px;
          align-items: center;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .metricIcon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
        }

        .dangerMetric .metricIcon {
          background: rgba(239,68,68,0.16);
        }

        .dangerMetric .metricValue {
          color: #ef4444;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .metricValue {
          display: block;
          font-size: 20px;
          font-weight: 900;
        }

        .gridTwo {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .panel,
        .quickCard {
          border-radius: 22px;
          padding: 16px;
          overflow: hidden;
        }

        .dangerPanel {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 40%),
            rgba(8,13,25,0.92);
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .panelIcon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }

        .list {
          display: grid;
          gap: 8px;
        }

        .row {
          display: grid;
          grid-template-columns: 40px 1fr auto;
          gap: 10px;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          text-decoration: none;
          align-items: center;
        }

        .dangerRow {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.18);
        }

        .rowIcon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
        }

        .dangerRow .rowIcon {
          background: rgba(239,68,68,0.16);
        }

        .rowText {
          min-width: 0;
        }

        .rowText strong,
        .rowText span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rowText strong {
          font-size: 13px;
        }

        .rowText span,
        .row em {
          color: #a1a1aa;
          font-size: 11px;
          font-style: normal;
        }

        .quickLinks {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 9px;
          margin-top: 14px;
        }

        .quickLinks a {
          padding: 13px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          text-decoration: none;
          font-size: 13px;
          font-weight: 900;
          text-align: center;
        }

        .empty {
          padding: 18px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 18px;
        }

        .empty p {
          color: #a1a1aa;
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 430px) {
          h1 {
            font-size: 31px;
          }

          .row {
            grid-template-columns: 40px 1fr;
          }

          .row em {
            grid-column: 2;
          }

          .quickLinks {
            grid-template-columns: 1fr;
          }
        }

        @media (min-width: 900px) {
          .page {
            padding: 24px;
            padding-bottom: 80px;
          }

          .stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .gridTwo {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .quickLinks {
            grid-template-columns: repeat(4, 1fr);
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
  danger,
}: {
  icon: string;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "metric dangerMetric" : "metric"}>
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <strong className="metricValue">{value}</strong>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  icon,
  children,
  danger,
}: {
  title: string;
  eyebrow: string;
  icon: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section className={danger ? "panel dangerPanel" : "panel"}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>

        <div className="panelIcon">{icon}</div>
      </div>

      {children}
    </section>
  );
}
