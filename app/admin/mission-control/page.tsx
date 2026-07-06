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
  driverVerified?: boolean;
  suspended?: boolean;
  lastSeen?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverEmail?: string;
  passengerEmail?: string;
  price?: number;
  seats?: number;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  status?: string;
  passengerEmail?: string;
  driverEmail?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type EmergencyItem = {
  id: string;
  status?: string;
  priority?: string;
  userEmail?: string;
  location?: string;
  createdAt?: string;
};

type IncidentItem = {
  id: string;
  title?: string;
  status?: string;
  severity?: string;
  service?: string;
  createdAt?: string;
};

type TaskItem = {
  id: string;
  title?: string;
  status?: string;
  priority?: string;
  category?: string;
  createdAt?: string;
};

export default function AdminMissionControlPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [message, setMessage] = useState("Loading Mission Control...");

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
      setMessage("");
    });

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
    });

    const unsubEmergency = onSnapshot(query(collection(db, "emergencyAlerts")), (snapshot) => {
      setEmergencies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyItem[]);
    });

    const unsubIncidents = onSnapshot(query(collection(db, "incidents")), (snapshot) => {
      setIncidents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as IncidentItem[]);
    });

    const unsubTasks = onSnapshot(query(collection(db, "adminTasks")), (snapshot) => {
      setTasks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as TaskItem[]);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubEmergency();
      unsubIncidents();
      unsubTasks();
    };
  }, []);

  const mission = useMemo(() => {
    const onlineUsers = users.filter((item) => {
      if (item.online) return true;
      if (!item.lastSeen) return false;
      const lastSeen = new Date(item.lastSeen).getTime();
      return !Number.isNaN(lastSeen) && Date.now() - lastSeen <= 15 * 60 * 1000;
    });

    const verifiedDrivers = users.filter((item) => item.driverVerified);
    const suspendedUsers = users.filter((item) => item.suspended);

    const activeRides = rides.filter((item) =>
      ["active", "open", "in_progress", "full"].includes(String(item.status || ""))
    );

    const completedRides = rides.filter((item) => item.status === "completed");

    const activeBookings = bookings.filter((item) =>
      ["pending", "reserved", "confirmed"].includes(String(item.status || ""))
    );

    const completedBookings = bookings.filter((item) => item.status === "completed");
    const cancelledBookings = bookings.filter((item) =>
      ["cancelled", "rejected", "no_show"].includes(String(item.status || ""))
    );

    const activeSOS = emergencies.filter((item) => item.status === "active");
    const criticalSOS = emergencies.filter(
      (item) => item.status === "active" && (item.priority === "critical" || !item.priority)
    );

    const openIncidents = incidents.filter((item) =>
      ["open", "investigating", "monitoring"].includes(String(item.status || ""))
    );

    const criticalIncidents = incidents.filter((item) => item.severity === "critical");

    const openTasks = tasks.filter((item) =>
      ["open", "in_progress", ""].includes(String(item.status || ""))
    );

    const criticalTasks = tasks.filter((item) => item.priority === "critical");

    const revenue = completedBookings.reduce(
      (total, booking) =>
        total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1),
      0
    );

    const cancellationRate =
      bookings.length > 0 ? Math.round((cancelledBookings.length / bookings.length) * 100) : 0;

    let score = 100;
    score -= activeSOS.length * 20;
    score -= criticalSOS.length * 20;
    score -= criticalIncidents.length * 12;
    score -= openIncidents.length * 4;
    score -= criticalTasks.length * 5;
    score -= suspendedUsers.length * 3;
    score -= Math.min(cancellationRate, 20);

    return {
      onlineUsers,
      verifiedDrivers,
      suspendedUsers,
      activeRides,
      completedRides,
      activeBookings,
      completedBookings,
      cancelledBookings,
      activeSOS,
      criticalSOS,
      openIncidents,
      criticalIncidents,
      openTasks,
      criticalTasks,
      revenue,
      cancellationRate,
      score: Math.max(0, Math.min(100, score)),
    };
  }, [users, rides, bookings, emergencies, incidents, tasks]);

  const priorityFeed = useMemo(() => {
    const feed = [
      ...mission.activeSOS.map((item) => ({
        id: `sos-${item.id}`,
        icon: "🚨",
        title: item.userEmail || "Active SOS Alert",
        detail: item.location || item.priority || "Emergency needs review",
        href: "/admin/emergency",
        danger: true,
        createdAt: item.createdAt,
      })),
      ...mission.openIncidents.map((item) => ({
        id: `incident-${item.id}`,
        icon: "🔥",
        title: item.title || "Open Incident",
        detail: `${item.service || "System"} · ${item.severity || "medium"}`,
        href: "/admin/incidents",
        danger: item.severity === "critical",
        createdAt: item.createdAt,
      })),
      ...mission.openTasks.map((item) => ({
        id: `task-${item.id}`,
        icon: "📋",
        title: item.title || "Open Task",
        detail: `${item.category || "operations"} · ${item.priority || "medium"}`,
        href: "/admin/tasks",
        danger: item.priority === "critical",
        createdAt: item.createdAt,
      })),
      ...mission.activeRides.slice(0, 6).map((item) => ({
        id: `ride-${item.id}`,
        icon: "🚘",
        title: `${item.from || "Origin"} → ${item.to || "Destination"}`,
        detail: item.driverEmail || "Active ride",
        href: "/admin/rides",
        danger: false,
        createdAt: item.createdAt,
      })),
    ];

    return feed
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 14);
  }, [mission]);

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusText() {
    if (mission.criticalSOS.length > 0) return "Emergency";
    if (mission.score >= 90) return "Excellent";
    if (mission.score >= 75) return "Stable";
    if (mission.score >= 60) return "Needs Review";
    return "High Risk";
  }

  function timeAgo(value?: string) {
    if (!value) return "Recently";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/operations" className="miniButton">Operations</Link>
          <Link href="/admin/ai-command" className="miniButton">AI Command</Link>
          <Link href="/admin/system-health" className="miniButton">System Health</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Enterprise</p>
            <h1>Mission <span>Control</span></h1>
            <p className="subtitle">
              Real-time command center for rides, bookings, drivers, users, revenue,
              incidents, SOS alerts, operations and platform health.
            </p>
          </div>

          <div className={mission.score >= 75 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{mission.score}</strong>
            <span>{statusText()}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className={mission.criticalSOS.length > 0 ? "statusCard dangerStatus" : "statusCard"}>
          <div className="liveDot" />
          <div>
            <strong>{statusText()}</strong>
            <span>
              {mission.criticalSOS.length > 0
                ? "Critical SOS activity is active. Review safety immediately."
                : "Realtime platform monitoring is active."}
            </span>
          </div>
        </section>

        <section className="stats">
          <Metric icon="🟢" label="Online Users" value={String(mission.onlineUsers.length)} />
          <Metric icon="🚘" label="Active Rides" value={String(mission.activeRides.length)} />
          <Metric icon="🎟️" label="Active Bookings" value={String(mission.activeBookings.length)} />
          <Metric icon="🛡️" label="Drivers" value={String(mission.verifiedDrivers.length)} />
          <Metric icon="💰" label="Revenue" value={money(mission.revenue)} />
          <Metric icon="📉" label="Cancel Rate" value={`${mission.cancellationRate}%`} danger={mission.cancellationRate >= 20} />
          <Metric icon="🔥" label="Incidents" value={String(mission.openIncidents.length)} danger={mission.openIncidents.length > 0} />
          <Metric icon="🚨" label="SOS" value={String(mission.activeSOS.length)} danger={mission.activeSOS.length > 0} />
        </section>

        <section className="missionGrid">
          <section className="mapPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Live Map</p>
                <h2>RoadLink Network</h2>
              </div>

              <span className="mapBadge">Realtime</span>
            </div>

            <div className="mapBox">
              <div className="gridLines" />

              {mission.activeRides.slice(0, 9).map((ride, index) => (
                <div
                  key={ride.id}
                  className="vehiclePin"
                  style={{
                    left: `${12 + ((index * 19) % 76)}%`,
                    top: `${18 + ((index * 23) % 62)}%`,
                  }}
                  title={`${ride.from || "Origin"} to ${ride.to || "Destination"}`}
                >
                  🚘
                </div>
              ))}

              {mission.activeSOS.slice(0, 5).map((sos, index) => (
                <div
                  key={sos.id}
                  className="sosPin"
                  style={{
                    left: `${18 + ((index * 31) % 68)}%`,
                    top: `${22 + ((index * 17) % 58)}%`,
                  }}
                >
                  🚨
                </div>
              ))}

              <div className="mapCenter">
                <strong>{mission.activeRides.length}</strong>
                <span>Active Routes</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Priority Feed</p>
            <h2>Live Events</h2>

            {priorityFeed.length === 0 ? (
              <div className="empty">
                <h3>No live events</h3>
                <p>Mission Control is clear right now.</p>
              </div>
            ) : (
              <div className="feed">
                {priorityFeed.map((item) => (
                  <Link key={item.id} href={item.href} className={item.danger ? "feedItem dangerFeed" : "feedItem"}>
                    <div className="feedIcon">{item.icon}</div>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <em>{timeAgo(item.createdAt)}</em>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="gridTwo">
          <Panel title="Trip Intelligence" eyebrow="Mobility" icon="🚘">
            <Info label="Total Rides" value={String(rides.length)} />
            <Info label="Active Rides" value={String(mission.activeRides.length)} />
            <Info label="Completed Rides" value={String(mission.completedRides.length)} />
            <Info label="Total Bookings" value={String(bookings.length)} />
            <Info label="Completed Bookings" value={String(mission.completedBookings.length)} />
          </Panel>

          <Panel title="Safety Intelligence" eyebrow="Trust & Safety" icon="🛡️" danger={mission.activeSOS.length > 0}>
            <Info label="Active SOS" value={String(mission.activeSOS.length)} />
            <Info label="Critical SOS" value={String(mission.criticalSOS.length)} />
            <Info label="Open Incidents" value={String(mission.openIncidents.length)} />
            <Info label="Critical Incidents" value={String(mission.criticalIncidents.length)} />
            <Info label="Suspended Users" value={String(mission.suspendedUsers.length)} />
          </Panel>
        </section>

        <section className="quickCard">
          <p className="eyebrow">Command Shortcuts</p>
          <h2>Open Control Panels</h2>

          <div className="quickLinks">
            <Link href="/admin/operations">📡 Operations</Link>
            <Link href="/admin/ai-command">🧠 AI Command</Link>
            <Link href="/admin/tasks">📋 Tasks</Link>
            <Link href="/admin/incidents">🔥 Incidents</Link>
            <Link href="/admin/system-health">🩺 Health</Link>
            <Link href="/admin/security-center">🔐 Security</Link>
            <Link href="/admin/export-center">⬇️ Exports</Link>
            <Link href="/admin/backup-center">💾 Backups</Link>
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 24px;
          padding-bottom: 120px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1280px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 22px;
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

        .dangerLink {
          color: #fca5a5;
          border-color: rgba(239,68,68,0.35);
          background: rgba(239,68,68,0.12);
        }

        .hero,
        .metric,
        .panel,
        .mapPanel,
        .quickCard,
        .statusCard {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 34px;
          margin-bottom: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
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
          font-size: 64px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue,
        .scoreOrb strong,
        .mapCenter strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .empty p,
        .statusCard span,
        .feedItem span,
        .infoBox span {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 14px 0;
        }

        .scoreOrb {
          min-width: 118px;
          height: 118px;
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
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .warningScore strong { color: #fca5a5; }

        .scoreOrb strong {
          font-size: 36px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
        }

        .statusCard {
          border-radius: 22px;
          padding: 16px;
          margin-bottom: 18px;
          display: grid;
          grid-template-columns: 16px 1fr;
          gap: 14px;
          align-items: center;
        }

        .dangerStatus {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.22);
        }

        .liveDot {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 1.4s infinite;
        }

        .dangerStatus .liveDot { background: #ef4444; }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70% { box-shadow: 0 0 0 10px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }

        .statusCard strong,
        .statusCard span {
          display: block;
        }

        .statusCard span {
          font-size: 13px;
          margin-top: 4px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .metric {
          border-radius: 22px;
          padding: 16px;
          display: grid;
          grid-template-columns: 42px 1fr auto;
          gap: 10px;
          align-items: center;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.20);
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
        }

        .metricLabel {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
        }

        .metricValue {
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .missionGrid {
          display: grid;
          grid-template-columns: 1.35fr 0.85fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .gridTwo {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .panel,
        .mapPanel,
        .quickCard {
          border-radius: 30px;
          padding: 24px;
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
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .panelIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
        }

        .mapBadge {
          padding: 8px 12px;
          border-radius: 999px;
          color: #86efac;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          font-size: 12px;
          font-weight: 900;
        }

        .mapBox {
          position: relative;
          min-height: 440px;
          border-radius: 26px;
          overflow: hidden;
          background:
            radial-gradient(circle at 25% 30%, rgba(34,197,94,0.20), transparent 18%),
            radial-gradient(circle at 70% 60%, rgba(59,130,246,0.18), transparent 20%),
            linear-gradient(135deg, rgba(15,23,42,0.96), rgba(2,6,23,0.96));
          border: 1px solid rgba(255,255,255,0.10);
        }

        .gridLines {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 42px 42px;
          opacity: 0.65;
        }

        .vehiclePin,
        .sosPin {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          z-index: 3;
          animation: float 2.6s ease-in-out infinite;
        }

        .vehiclePin {
          background: rgba(34,197,94,0.18);
          border: 1px solid rgba(34,197,94,0.45);
        }

        .sosPin {
          background: rgba(239,68,68,0.18);
          border: 1px solid rgba(239,68,68,0.55);
          animation: sosPulse 1.2s infinite;
        }

        @keyframes float {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-8px); }
        }

        @keyframes sosPulse {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.75); }
          70% { box-shadow: 0 0 0 14px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }

        .mapCenter {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 2;
          width: 160px;
          height: 160px;
          border-radius: 50%;
          background: rgba(2,6,23,0.78);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .mapCenter strong {
          font-size: 42px;
          font-weight: 900;
        }

        .mapCenter span {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
        }

        .feed {
          display: grid;
          gap: 10px;
          max-height: 470px;
          overflow: auto;
          padding-right: 4px;
        }

        .feedItem {
          display: grid;
          grid-template-columns: 44px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 13px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          text-decoration: none;
        }

        .dangerFeed {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.18);
        }

        .feedIcon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
        }

        .dangerFeed .feedIcon {
          background: rgba(239,68,68,0.16);
        }

        .feedItem strong,
        .feedItem span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .feedItem em {
          color: #a1a1aa;
          font-size: 11px;
          font-style: normal;
          white-space: nowrap;
        }

        .infoStack {
          display: grid;
          gap: 10px;
        }

        .infoBox {
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .infoBox span {
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong {
          display: block;
          color: white;
          overflow-wrap: anywhere;
        }

        .quickLinks {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 14px;
        }

        .quickLinks a {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          text-decoration: none;
          font-weight: 900;
          text-align: center;
        }

        .empty {
          padding: 24px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
        }

        @media (max-width: 1050px) {
          .hero,
          .missionGrid,
          .gridTwo {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .quickLinks {
            grid-template-columns: repeat(2, 1fr);
          }

          h1 {
            font-size: 46px;
          }
        }

        @media (max-width: 650px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .panel,
          .mapPanel,
          .quickCard {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .quickLinks {
            grid-template-columns: 1fr;
          }

          .metric {
            grid-template-columns: 42px 1fr;
          }

          .metricValue {
            grid-column: 2;
          }

          .feedItem {
            grid-template-columns: 44px 1fr;
          }

          .feedItem em {
            grid-column: 2;
          }

          .mapBox {
            min-height: 340px;
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

      <div className="infoStack">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  ); 
}
