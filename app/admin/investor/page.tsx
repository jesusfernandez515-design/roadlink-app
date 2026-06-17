"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
  createdAt?: string;
};

type RideItem = {
  id: string;
  status?: string;
  from?: string;
  to?: string;
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

export default function AdminInvestorDashboardPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [message, setMessage] = useState("Loading investor dashboard...");

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
      unsubPayouts();
      unsubReports();
      unsubEmergencies();
    };
  }, []);

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function bookingValue(item: BookingItem) {
    return Number(item.price || item.amount || 0) * Number(item.seatsBooked || 1);
  }

  function isThisMonth(value?: string) {
    if (!value) return false;

    const date = new Date(value);
    const now = new Date();

    if (Number.isNaN(date.getTime())) return false;

    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  const investor = useMemo(() => {
    const activeUsers = users.filter((item) => !item.suspended);
    const verifiedDrivers = users.filter((item) => item.driverVerified || item.verified).length;
    const newUsersThisMonth = users.filter((item) => isThisMonth(item.createdAt)).length;

    const activeRides = rides.filter(
      (item) => item.status === "active" || item.status === "open" || item.status === "in_progress"
    ).length;

    const completedRides = rides.filter((item) => item.status === "completed").length;

    const completedBookings = bookings.filter((item) => item.status === "completed");
    const activeBookings = bookings.filter(
      (item) => item.status === "pending" || item.status === "reserved" || item.status === "confirmed"
    );

    const cancelledBookings = bookings.filter(
      (item) => item.status === "cancelled" || item.status === "rejected" || item.status === "no_show"
    );

    const gmv = completedBookings.reduce((total, item) => total + bookingValue(item), 0);
    const roadLinkRevenue = gmv * 0.12;
    const arr = roadLinkRevenue * 12;
    const mrr = roadLinkRevenue;

    const pendingPayoutAmount = payouts
      .filter((item) => item.status === "pending" || item.status === "approved")
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const activeSOS = emergencies.filter((item) => item.status === "active").length;
    const openReports = reports.filter((item) => !item.status || item.status === "open").length;
    const urgentReports = reports.filter((item) => item.priority === "urgent" || item.priority === "critical").length;

    const completionRate = bookings.length > 0 ? Math.round((completedBookings.length / bookings.length) * 100) : 0;
    const cancellationRate = bookings.length > 0 ? Math.round((cancelledBookings.length / bookings.length) * 100) : 0;
    const driverRatio = users.length > 0 ? Math.round((verifiedDrivers / users.length) * 100) : 0;
    const bookingConversion = users.length > 0 ? Math.round((bookings.length / users.length) * 100) : 0;

    let investorScore = 30;
    investorScore += Math.min(users.length * 2, 20);
    investorScore += Math.min(verifiedDrivers * 5, 20);
    investorScore += Math.min(bookings.length * 3, 20);
    investorScore += gmv > 0 ? 10 : 0;
    investorScore -= activeSOS > 0 ? 15 : 0;
    investorScore -= urgentReports > 0 ? 10 : 0;
    investorScore -= cancellationRate > 25 ? 10 : 0;

    investorScore = Math.max(Math.min(investorScore, 100), 0);

    const tractionStatus =
      investorScore >= 85
        ? "Investor Ready"
        : investorScore >= 65
        ? "Early Traction"
        : "Pre-Traction";

    return {
      activeUsers,
      verifiedDrivers,
      newUsersThisMonth,
      activeRides,
      completedRides,
      completedBookings,
      activeBookings,
      cancelledBookings,
      gmv,
      roadLinkRevenue,
      arr,
      mrr,
      pendingPayoutAmount,
      activeSOS,
      openReports,
      urgentReports,
      completionRate,
      cancellationRate,
      driverRatio,
      bookingConversion,
      investorScore,
      tractionStatus,
    };
  }, [users, rides, bookings, payouts, reports, emergencies]);

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/ai-command" className="miniButton">AI Command</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
          <Link href="/admin/launch" className="miniButton">Launch</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Investor View</p>
            <h1>Investor <span>Dashboard</span></h1>
            <p className="subtitle">
              Show traction, marketplace growth, GMV, revenue, drivers, bookings,
              safety and launch readiness in one executive view.
            </p>
          </div>

          <div className={investor.investorScore < 70 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{investor.investorScore}</strong>
            <span>{investor.tractionStatus}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="headlineCard">
          <p className="eyebrow">Executive Summary</p>
          <h2>{investor.tractionStatus}</h2>
          <p>
            RoadLink currently has {users.length} total users, {investor.verifiedDrivers} verified drivers,
            {rides.length} published rides, {bookings.length} bookings and {money(investor.gmv)} in GMV.
          </p>
        </section>

        <section className="stats">
          <Metric icon="💰" label="GMV" value={money(investor.gmv)} />
          <Metric icon="🏦" label="Revenue" value={money(investor.roadLinkRevenue)} />
          <Metric icon="📅" label="MRR" value={money(investor.mrr)} />
          <Metric icon="📈" label="ARR" value={money(investor.arr)} />
          <Metric icon="👥" label="Users" value={String(users.length)} />
          <Metric icon="🛡️" label="Drivers" value={String(investor.verifiedDrivers)} />
          <Metric icon="🚘" label="Rides" value={String(rides.length)} />
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} />
        </section>

        <section className="gridTwo">
          <Panel title="Traction Metrics" eyebrow="Growth" icon="📈">
            <Info label="Total Users" value={String(users.length)} />
            <Info label="Active Users" value={String(investor.activeUsers.length)} />
            <Info label="New Users This Month" value={String(investor.newUsersThisMonth)} />
            <Info label="Verified Drivers" value={String(investor.verifiedDrivers)} />
            <Info label="Driver Ratio" value={`${investor.driverRatio}%`} />
            <Info label="Booking Conversion" value={`${investor.bookingConversion}%`} />
          </Panel>

          <Panel title="Marketplace Metrics" eyebrow="Supply & Demand" icon="🚘">
            <Info label="Published Rides" value={String(rides.length)} />
            <Info label="Active Rides" value={String(investor.activeRides)} />
            <Info label="Completed Rides" value={String(investor.completedRides)} />
            <Info label="Active Bookings" value={String(investor.activeBookings.length)} />
            <Info label="Completed Bookings" value={String(investor.completedBookings.length)} />
            <Info label="Completion Rate" value={`${investor.completionRate}%`} />
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Financial Metrics" eyebrow="Investor Economics" icon="💵">
            <Info label="Gross Merchandise Value" value={money(investor.gmv)} />
            <Info label="RoadLink Revenue" value={money(investor.roadLinkRevenue)} />
            <Info label="Estimated MRR" value={money(investor.mrr)} />
            <Info label="Estimated ARR" value={money(investor.arr)} />
            <Info label="Pending Payouts" value={money(investor.pendingPayoutAmount)} />
            <Info label="Take Rate" value="12%" />
          </Panel>

          <Panel title="Risk & Safety Metrics" eyebrow="Trust" icon="🛡️" danger={investor.activeSOS > 0 || investor.openReports > 0}>
            <Info label="Active SOS" value={String(investor.activeSOS)} />
            <Info label="Open Reports" value={String(investor.openReports)} />
            <Info label="Urgent Reports" value={String(investor.urgentReports)} />
            <Info label="Cancellation Rate" value={`${investor.cancellationRate}%`} />
            <Info label="Suspended Users" value={String(users.filter((item) => item.suspended).length)} />
          </Panel>
        </section>

        <section className="pitchCard">
          <p className="eyebrow">Investor Pitch Snapshot</p>
          <h2>Why RoadLink?</h2>

          <div className="pitchGrid">
            <PitchItem icon="🛣️" title="Long-distance rideshare" text="RoadLink focuses on city-to-city and state-to-state travel, not short local rides." />
            <PitchItem icon="💸" title="Affordable mobility" text="Passengers can travel cheaper while drivers monetize empty seats." />
            <PitchItem icon="🛡️" title="Trust infrastructure" text="Verification, reports, SOS, fraud detection and admin control are built into the platform." />
            <PitchItem icon="📈" title="Scalable marketplace" text="The model can expand by universities, workers, cities, events and travel corridors." />
          </div>
        </section>

        <section className="quickCard">
          <p className="eyebrow">Investor Tools</p>
          <h2>Quick Access</h2>

          <div className="quickLinks">
            <Link href="/admin/ai-command">🤖 AI Command</Link>
            <Link href="/admin/launch">🚀 Launch Center</Link>
            <Link href="/admin/revenue">💰 Revenue</Link>
            <Link href="/admin/analytics">📊 Analytics</Link>
            <Link href="/admin/live">🟢 Live Center</Link>
            <Link href="/admin/fraud">🕵️ Fraud</Link>
            <Link href="/admin/users">👥 Users</Link>
            <Link href="/admin/rides">🚘 Rides</Link>
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
            radial-gradient(circle at bottom left, rgba(59,130,246,0.14), transparent 36%),
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

        .hero,
        .metric,
        .panel,
        .headlineCard,
        .pitchCard,
        .quickCard {
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

        .subtitle,
        .headlineCard p,
        .pitchItem p {
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

        .headlineCard,
        .pitchCard,
        .quickCard {
          border-radius: 22px;
          padding: 16px;
          margin-bottom: 12px;
        }

        .headlineCard h2 {
          margin-bottom: 8px;
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
        .pitchItem {
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

        .pitchGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 9px;
          margin-top: 14px;
        }

        .pitchItem div {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .pitchItem strong {
          display: block;
          margin-bottom: 6px;
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

        @media (max-width: 430px) {
          h1 {
            font-size: 31px;
          }

          .stats,
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

          .pitchGrid,
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
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
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

function PitchItem({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="pitchItem">
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
      }
