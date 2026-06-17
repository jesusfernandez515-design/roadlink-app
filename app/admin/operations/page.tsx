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
  price?: number;
  amount?: number;
  createdAt?: string;
};

type SupportTicket = {
  id: string;
  status?: string;
  priority?: string;
  userEmail?: string;
  subject?: string;
  createdAt?: string;
};

type VerificationItem = {
  id: string;
  status?: string;
  userEmail?: string;
  submittedAt?: string;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
  driverEmail?: string;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  status?: string;
  priority?: string;
  reporterEmail?: string;
  targetUserEmail?: string;
  reason?: string;
  createdAt?: string;
};

type EmergencyItem = {
  id: string;
  status?: string;
  priority?: string;
  userEmail?: string;
  createdAt?: string;
};

export default function AdminOperationsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [message, setMessage] = useState("Loading operations center...");

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
    });

    const unsubTickets = onSnapshot(query(collection(db, "supportTickets")), (snapshot) => {
      setTickets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as SupportTicket[]);
    });

    const unsubVerifications = onSnapshot(query(collection(db, "driverVerifications")), (snapshot) => {
      setVerifications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as VerificationItem[]);
    });

    const unsubPayouts = onSnapshot(query(collection(db, "payoutRequests")), (snapshot) => {
      setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PayoutItem[]);
    });

    const unsubReports = onSnapshot(query(collection(db, "reports")), (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
    });

    const unsubEmergencies = onSnapshot(query(collection(db, "emergencyAlerts")), (snapshot) => {
      setEmergencies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyItem[]);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubTickets();
      unsubVerifications();
      unsubPayouts();
      unsubReports();
      unsubEmergencies();
    };
  }, []);

  const ops = useMemo(() => {
    const onlineUsers = users.filter((user) => {
      if (user.online) return true;
      if (!user.lastSeen) return false;

      const lastSeen = new Date(user.lastSeen).getTime();
      if (Number.isNaN(lastSeen)) return false;

      return Date.now() - lastSeen <= 15 * 60 * 1000;
    });

    const activeRides = rides.filter(
      (ride) =>
        ride.status === "active" ||
        ride.status === "open" ||
        ride.status === "in_progress"
    );

    const activeBookings = bookings.filter(
      (booking) =>
        booking.status === "pending" ||
        booking.status === "reserved" ||
        booking.status === "confirmed"
    );

    const openTickets = tickets.filter((ticket) => !ticket.status || ticket.status === "open");
    const urgentTickets = tickets.filter((ticket) => ticket.priority === "urgent");

    const pendingVerifications = verifications.filter(
      (item) => !item.status || item.status === "pending" || item.status === "reviewing"
    );

    const pendingPayouts = payouts.filter(
      (item) => item.status === "pending" || item.status === "approved"
    );

    const pendingPayoutAmount = pendingPayouts.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const openReports = reports.filter((report) => !report.status || report.status === "open");
    const urgentReports = reports.filter((report) => report.priority === "urgent");

    const activeSOS = emergencies.filter((item) => item.status === "active");
    const criticalSOS = emergencies.filter(
      (item) => item.status === "active" && (item.priority === "critical" || !item.priority)
    );

    const suspendedUsers = users.filter((user) => user.suspended);
    const verifiedDrivers = users.filter((user) => user.driverVerified);

    let operationsScore = 100;

    if (activeSOS.length > 0) operationsScore -= 25;
    if (criticalSOS.length > 0) operationsScore -= Math.min(25, criticalSOS.length * 10);
    if (urgentReports.length > 0) operationsScore -= Math.min(15, urgentReports.length * 5);
    if (urgentTickets.length > 0) operationsScore -= Math.min(10, urgentTickets.length * 3);
    if (pendingVerifications.length > 5) operationsScore -= 8;
    if (pendingPayouts.length > 5) operationsScore -= 8;
    if (suspendedUsers.length > 0) operationsScore -= Math.min(10, suspendedUsers.length * 2);

    return {
      onlineUsers,
      activeRides,
      activeBookings,
      openTickets,
      urgentTickets,
      pendingVerifications,
      pendingPayouts,
      pendingPayoutAmount,
      openReports,
      urgentReports,
      activeSOS,
      criticalSOS,
      suspendedUsers,
      verifiedDrivers,
      operationsScore: Math.max(operationsScore, 0),
    };
  }, [users, rides, bookings, tickets, verifications, payouts, reports, emergencies]);

  const latestQueue = useMemo(() => {
    const queue = [
      ...ops.activeSOS.map((item) => ({
        id: `sos-${item.id}`,
        icon: "🚨",
        title: item.userEmail || "Active SOS Alert",
        detail: item.priority || "critical",
        href: "/admin/emergency",
        danger: true,
        createdAt: item.createdAt,
      })),
      ...ops.urgentReports.map((item) => ({
        id: `report-${item.id}`,
        icon: "⚠️",
        title: item.reason || "Urgent Report",
        detail: item.targetUserEmail || item.reporterEmail || "Safety report",
        href: "/admin/reports",
        danger: true,
        createdAt: item.createdAt,
      })),
      ...ops.openTickets.map((item) => ({
        id: `ticket-${item.id}`,
        icon: "🎧",
        title: item.subject || "Support Ticket",
        detail: item.userEmail || "Support request",
        href: "/admin/support",
        danger: item.priority === "urgent",
        createdAt: item.createdAt,
      })),
      ...ops.pendingVerifications.map((item) => ({
        id: `verification-${item.id}`,
        icon: "🛡️",
        title: item.userEmail || "Driver Verification",
        detail: item.status || "pending",
        href: "/admin/verification-queue",
        danger: false,
        createdAt: item.submittedAt || item.createdAt,
      })),
      ...ops.pendingPayouts.map((item) => ({
        id: `payout-${item.id}`,
        icon: "🏦",
        title: item.driverEmail || "Payout Request",
        detail: `$${Number(item.amount || 0)}`,
        href: "/admin/payouts",
        danger: false,
        createdAt: item.createdAt,
      })),
    ];

    return queue
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
      .slice(0, 12);
  }, [ops]);

  function statusText() {
    if (ops.activeSOS.length > 0) return "Emergency Attention";
    if (ops.operationsScore >= 90) return "Excellent";
    if (ops.operationsScore >= 75) return "Stable";
    if (ops.operationsScore >= 60) return "Needs Review";
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
          <Link href="/admin/live" className="miniButton">Live</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Command</p>
            <h1>Operations <span>Center</span></h1>
            <p className="subtitle">
              Control users, rides, bookings, support, payouts, verifications, reports and emergencies from one realtime command center.
            </p>
          </div>

          <div className={ops.operationsScore < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{ops.operationsScore}</strong>
            <span>{statusText()}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className={ops.activeSOS.length > 0 ? "statusCard dangerStatus" : "statusCard"}>
          <div className="liveDot"></div>
          <div>
            <strong>{statusText()}</strong>
            <span>
              {ops.activeSOS.length > 0
                ? "Active emergency alerts require immediate review."
                : "Realtime Firestore operations monitoring is active."}
            </span>
          </div>
        </section>

        <section className="stats">
          <Metric icon="🟢" label="Online Users" value={String(ops.onlineUsers.length)} />
          <Metric icon="🚘" label="Active Rides" value={String(ops.activeRides.length)} />
          <Metric icon="🎟️" label="Active Bookings" value={String(ops.activeBookings.length)} />
          <Metric icon="🎧" label="Open Support" value={String(ops.openTickets.length)} danger={ops.openTickets.length > 0} />
          <Metric icon="🛡️" label="Verifications" value={String(ops.pendingVerifications.length)} danger={ops.pendingVerifications.length > 0} />
          <Metric icon="🏦" label="Payouts" value={`$${Math.round(ops.pendingPayoutAmount)}`} danger={ops.pendingPayouts.length > 0} />
          <Metric icon="⚠️" label="Reports" value={String(ops.openReports.length)} danger={ops.openReports.length > 0} />
          <Metric icon="🚨" label="Active SOS" value={String(ops.activeSOS.length)} danger={ops.activeSOS.length > 0} />
        </section>

        <section className="gridTwo">
          <Panel title="Operations Queue" eyebrow="Priority" icon="📡" danger={latestQueue.some((item) => item.danger)}>
            {latestQueue.length === 0 ? (
              <div className="empty">
                <h3>No priority tasks</h3>
                <p>Operations queue is clear right now.</p>
              </div>
            ) : (
              <div className="list">
                {latestQueue.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={item.danger ? "row dangerRow" : "row"}
                  >
                    <div className="rowIcon">{item.icon}</div>
                    <div className="rowText">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <em>{timeAgo(item.createdAt)}</em>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Safety Monitor" eyebrow="Trust & Safety" icon="🚨" danger={ops.activeSOS.length > 0 || ops.openReports.length > 0}>
            <Info label="Active SOS" value={String(ops.activeSOS.length)} />
            <Info label="Critical SOS" value={String(ops.criticalSOS.length)} />
            <Info label="Open Reports" value={String(ops.openReports.length)} />
            <Info label="Urgent Reports" value={String(ops.urgentReports.length)} />
            <Info label="Suspended Users" value={String(ops.suspendedUsers.length)} />
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Trip Operations" eyebrow="Mobility" icon="🚘">
            <Info label="Total Rides" value={String(rides.length)} />
            <Info label="Active Rides" value={String(ops.activeRides.length)} />
            <Info label="Total Bookings" value={String(bookings.length)} />
            <Info label="Active Bookings" value={String(ops.activeBookings.length)} />
            <Info label="Verified Drivers" value={String(ops.verifiedDrivers.length)} />
          </Panel>

          <Panel title="Admin Workload" eyebrow="Back Office" icon="⚙️">
            <Info label="Support Tickets" value={String(ops.openTickets.length)} />
            <Info label="Urgent Support" value={String(ops.urgentTickets.length)} />
            <Info label="Pending Verifications" value={String(ops.pendingVerifications.length)} />
            <Info label="Pending Payouts" value={String(ops.pendingPayouts.length)} />
            <Info label="Pending Payout Amount" value={`$${Math.round(ops.pendingPayoutAmount)}`} />
          </Panel>
        </section>

        <section className="quickCard">
          <p className="eyebrow">Command Shortcuts</p>
          <h2>Open Control Panels</h2>

          <div className="quickLinks">
            <Link href="/admin/users">👥 Users</Link>
            <Link href="/admin/rides">🚘 Rides</Link>
            <Link href="/admin/bookings">🎟️ Bookings</Link>
            <Link href="/admin/support">🎧 Support</Link>
            <Link href="/admin/verification-queue">🛡️ Verification Queue</Link>
            <Link href="/admin/payouts">🏦 Payouts</Link>
            <Link href="/admin/reports">⚠️ Reports</Link>
            <Link href="/admin/emergency">🚨 SOS</Link>
            <Link href="/admin/fraud">🕵️ Fraud</Link>
            <Link href="/admin/analytics">📊 Analytics</Link>
            <Link href="/admin/revenue">💰 Revenue</Link>
            <Link href="/admin/launch">🚀 Launch</Link>
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
        .statusCard {
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
          min-width: 84px;
          width: 84px;
          height: 84px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
          padding: 8px;
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
          font-size: 8px;
          font-weight: 900;
          line-height: 1.2;
        }

        .message {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }

        .statusCard {
          border-radius: 18px;
          padding: 14px;
          display: grid;
          grid-template-columns: 14px 1fr;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .dangerStatus {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .liveDot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 1.3s infinite;
        }

        .dangerStatus .liveDot {
          background: #ef4444;
        }

        .statusCard strong,
        .statusCard span {
          display: block;
        }

        .statusCard span {
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
          font-size: 19px;
          font-weight: 900;
          overflow-wrap: anywhere;
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

        .list,
        .infoStack {
          display: grid;
          gap: 8px;
        }

        .row,
        .infoBox {
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .row {
          display: grid;
          grid-template-columns: 40px 1fr auto;
          gap: 10px;
          padding: 12px;
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

        .infoBox {
          padding: 12px;
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .infoBox strong {
          display: block;
          color: white;
          font-size: 14px;
          overflow-wrap: anywhere;
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
            grid-template-columns: repeat(4, minmax(0, 1fr));
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
