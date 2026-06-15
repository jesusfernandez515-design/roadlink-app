"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
  createdAt?: string;
};

type RideItem = {
  id: string;
  status?: string;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type MessageItem = {
  id: string;
  createdAt?: string;
};

type VerificationItem = {
  id: string;
  status?: string;
  createdAt?: string;
  submittedAt?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type EmergencyItem = {
  id: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type ActivityItem = {
  id: string;
  type?: string;
  createdAt?: string;
};

export default function AdminLaunchPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [message, setMessage] = useState("Loading launch center...");

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

    const unsubMessages = onSnapshot(query(collection(db, "messages")), (snapshot) => {
      setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as MessageItem[]);
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

    const unsubActivities = onSnapshot(query(collection(db, "activityFeed")), (snapshot) => {
      setActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ActivityItem[]);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubMessages();
      unsubVerifications();
      unsubPayouts();
      unsubReports();
      unsubEmergencies();
      unsubActivities();
    };
  }, []);

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function bookingValue(item: BookingItem) {
    return Number(item.price || item.amount || 0) * Number(item.seatsBooked || 1);
  }

  const launch = useMemo(() => {
    const verifiedDrivers = users.filter((item) => item.driverVerified || item.verified).length;
    const suspendedUsers = users.filter((item) => item.suspended).length;

    const activeRides = rides.filter((item) => item.status === "active" || item.status === "open").length;
    const completedRides = rides.filter((item) => item.status === "completed").length;

    const completedBookings = bookings.filter((item) => item.status === "completed");
    const activeBookings = bookings.filter(
      (item) => item.status === "pending" || item.status === "reserved" || item.status === "confirmed"
    );
    const cancelledBookings = bookings.filter((item) => item.status === "cancelled" || item.status === "rejected");

    const grossRevenue = completedBookings.reduce((total, item) => total + bookingValue(item), 0);
    const roadLinkRevenue = grossRevenue * 0.12;

    const pendingPayouts = payouts.filter((item) => item.status === "pending" || item.status === "approved");
    const paidPayouts = payouts.filter((item) => item.status === "paid");

    const pendingPayoutAmount = pendingPayouts.reduce((total, item) => total + Number(item.amount || 0), 0);
    const paidOutAmount = paidPayouts.reduce((total, item) => total + Number(item.amount || 0), 0);

    const pendingVerifications = verifications.filter((item) => item.status === "pending").length;
    const approvedVerifications = verifications.filter((item) => item.status === "approved").length;

    const openReports = reports.filter((item) => !item.status || item.status === "open").length;
    const urgentReports = reports.filter((item) => item.priority === "urgent").length;

    const activeSOS = emergencies.filter((item) => item.status === "active").length;
    const criticalSOS = emergencies.filter((item) => item.priority === "critical").length;

    const completionRate = bookings.length > 0 ? Math.round((completedBookings.length / bookings.length) * 100) : 0;
    const driverRatio = users.length > 0 ? Math.round((verifiedDrivers / users.length) * 100) : 0;

    const checklist = [
      { label: "Authentication", ready: users.length > 0 },
      { label: "User Profiles", ready: users.length > 0 },
      { label: "Rides System", ready: rides.length > 0 },
      { label: "Bookings System", ready: bookings.length > 0 },
      { label: "Messaging", ready: messages.length > 0 },
      { label: "Driver Verification", ready: verifications.length > 0 || verifiedDrivers > 0 },
      { label: "Payouts", ready: payouts.length > 0 },
      { label: "Reports", ready: true },
      { label: "SOS Center", ready: emergencies.length > 0 },
      { label: "Analytics", ready: true },
      { label: "Revenue Center", ready: true },
      { label: "Live Center", ready: true },
      { label: "Activity Feed", ready: activities.length > 0 },
    ];

    const readyItems = checklist.filter((item) => item.ready).length;
    let readinessScore = Math.round((readyItems / checklist.length) * 100);

    if (activeSOS > 0) readinessScore -= 10;
    if (urgentReports > 0) readinessScore -= 8;
    if (suspendedUsers > 0) readinessScore -= 5;
    if (pendingPayoutAmount > roadLinkRevenue && grossRevenue > 0) readinessScore -= 5;

    readinessScore = Math.max(Math.min(readinessScore, 100), 0);

    const missing = [
      { label: "Google Maps Production Key", ready: activeRides > 0 },
      { label: "Stripe Production Review", ready: payouts.length > 0 },
      { label: "Terms of Service", ready: false },
      { label: "Privacy Policy", ready: false },
      { label: "Public Beta Testers", ready: users.length >= 10 },
      { label: "Verified Driver Supply", ready: verifiedDrivers >= 3 },
    ];

    return {
      verifiedDrivers,
      suspendedUsers,
      activeRides,
      completedRides,
      completedBookings,
      activeBookings,
      cancelledBookings,
      grossRevenue,
      roadLinkRevenue,
      pendingPayouts,
      paidPayouts,
      pendingPayoutAmount,
      paidOutAmount,
      pendingVerifications,
      approvedVerifications,
      openReports,
      urgentReports,
      activeSOS,
      criticalSOS,
      completionRate,
      driverRatio,
      checklist,
      missing,
      readinessScore,
    };
  }, [users, rides, bookings, messages, verifications, payouts, reports, emergencies, activities]);

  const statusText =
    launch.readinessScore >= 90
      ? "Ready For Public Beta"
      : launch.readinessScore >= 70
      ? "Almost Ready"
      : "Needs Work";

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
          <Link href="/admin/live" className="miniButton">Live</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Executive</p>
            <h1>Launch <span>Center</span></h1>
            <p className="subtitle">
              Review launch readiness, platform health, revenue, safety, growth and investor metrics.
            </p>
          </div>

          <div className={launch.readinessScore < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{launch.readinessScore}%</strong>
            <span>{statusText}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="statusCard">
          <div className="liveDot"></div>
          <div>
            <strong>{statusText}</strong>
            <span>
              {launch.readinessScore >= 90
                ? "RoadLink is close to a public beta launch."
                : "Complete the missing launch items before going public."}
            </span>
          </div>
        </section>

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(users.length)} />
          <Metric icon="🛡️" label="Verified Drivers" value={String(launch.verifiedDrivers)} />
          <Metric icon="🚘" label="Active Rides" value={String(launch.activeRides)} />
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} />
          <Metric icon="💰" label="Gross Revenue" value={money(launch.grossRevenue)} />
          <Metric icon="🏦" label="RoadLink Revenue" value={money(launch.roadLinkRevenue)} />
          <Metric icon="🚨" label="Active SOS" value={String(launch.activeSOS)} danger={launch.activeSOS > 0} />
          <Metric icon="⚠️" label="Open Reports" value={String(launch.openReports)} danger={launch.openReports > 0} />
        </section>

        <section className="gridTwo">
          <Panel title="Launch Checklist" eyebrow="Readiness" icon="✅">
            {launch.checklist.map((item) => (
              <CheckRow key={item.label} label={item.label} ready={item.ready} />
            ))}
          </Panel>

          <Panel title="Missing Before Launch" eyebrow="Required" icon="🧩" danger>
            {launch.missing.map((item) => (
              <CheckRow key={item.label} label={item.label} ready={item.ready} />
            ))}
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Growth Snapshot" eyebrow="Users & Trips" icon="📈">
            <Info label="Total Users" value={String(users.length)} />
            <Info label="Verified Driver Ratio" value={`${launch.driverRatio}%`} />
            <Info label="Completed Trips" value={String(launch.completedRides)} />
            <Info label="Completed Bookings" value={String(launch.completedBookings.length)} />
            <Info label="Messages" value={String(messages.length)} />
            <Info label="Activity Events" value={String(activities.length)} />
          </Panel>

          <Panel title="Revenue Snapshot" eyebrow="Investor View" icon="💵">
            <Info label="Lifetime Trip Value" value={money(launch.grossRevenue)} />
            <Info label="RoadLink Fees" value={money(launch.roadLinkRevenue)} />
            <Info label="Pending Payouts" value={money(launch.pendingPayoutAmount)} />
            <Info label="Paid Out" value={money(launch.paidOutAmount)} />
            <Info label="Completion Rate" value={`${launch.completionRate}%`} />
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Safety Snapshot" eyebrow="Trust" icon="🚨" danger={launch.activeSOS > 0 || launch.openReports > 0}>
            <Info label="Active SOS" value={String(launch.activeSOS)} />
            <Info label="Critical SOS" value={String(launch.criticalSOS)} />
            <Info label="Open Reports" value={String(launch.openReports)} />
            <Info label="Urgent Reports" value={String(launch.urgentReports)} />
            <Info label="Suspended Users" value={String(launch.suspendedUsers)} />
          </Panel>

          <Panel title="Executive Actions" eyebrow="Command" icon="🚀">
            <div className="quickLinks">
              <Link href="/admin/live">🟢 Open Live Center</Link>
              <Link href="/admin/revenue">💰 Open Revenue</Link>
              <Link href="/admin/analytics">📊 Open Analytics</Link>
              <Link href="/admin/activity">📡 Open Activity</Link>
              <Link href="/admin/emergency">🚨 Open SOS</Link>
              <Link href="/admin/users">👥 Open Users</Link>
              <Link href="/admin/payouts">🏦 Open Payouts</Link>
              <Link href="/admin">⚙️ Admin Home</Link>
            </div>
          </Panel>
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
          font-size: 22px;
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

        .liveDot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 1.3s infinite;
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

        .panel {
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

        .infoStack {
          display: grid;
          gap: 8px;
        }

        .infoBox,
        .checkRow {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
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

        .checkRow {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .checkRow span {
          color: white;
          font-size: 13px;
          font-weight: 900;
        }

        .checkRow strong {
          font-size: 12px;
        }

        .ready {
          color: #22c55e;
        }

        .missing {
          color: #ef4444;
        }

        .quickLinks {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 9px;
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

        @media (max-width: 430px) {
          h1 {
            font-size: 31px;
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

function CheckRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="checkRow">
      <span>{label}</span>
      <strong className={ready ? "ready" : "missing"}>
        {ready ? "Ready" : "Missing"}
      </strong>
    </div>
  );
}
