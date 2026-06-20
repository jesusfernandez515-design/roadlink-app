"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type GrowthStatus = "excellent" | "growing" | "watch" | "risk";

type BasicItem = {
  id: string;
  email?: string;
  name?: string;
  status?: string;
  amount?: number;
  price?: number;
  seatsBooked?: number;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
  online?: boolean;
  lastSeen?: string;
  createdAt?: string;
};

type GrowthSignal = {
  id: string;
  title: string;
  value: string;
  status: GrowthStatus;
  insight: string;
};

export default function AdminGrowthIntelligencePage() {
  const [users, setUsers] = useState<BasicItem[]>([]);
  const [rides, setRides] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [reports, setReports] = useState<BasicItem[]>([]);
  const [message, setMessage] = useState("Loading growth intelligence...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const listen = <T,>(name: string, setter: (items: T[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]);
          setMessage("");
        },
        () => setter([])
      );

    const unsubUsers = listen<BasicItem>("users", setUsers);
    const unsubRides = listen<BasicItem>("rides", setRides);
    const unsubBookings = listen<BasicItem>("bookings", setBookings);
    const unsubReports = listen<BasicItem>("reports", setReports);

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
    };
  }, []);

  const growth = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const createdWithin = (item: BasicItem, days: number) => {
      if (!item.createdAt) return false;
      const time = new Date(item.createdAt).getTime();
      return !Number.isNaN(time) && now - time <= days * day;
    };

    const activeWithin = (item: BasicItem, minutes: number) => {
      if (item.online) return true;
      if (!item.lastSeen) return false;
      const time = new Date(item.lastSeen).getTime();
      return !Number.isNaN(time) && now - time <= minutes * 60 * 1000;
    };

    const newUsersToday = users.filter((item) => createdWithin(item, 1));
    const newUsers7Days = users.filter((item) => createdWithin(item, 7));
    const newUsers30Days = users.filter((item) => createdWithin(item, 30));

    const activeUsers = users.filter((item) => activeWithin(item, 15));
    const activeUsers24h = users.filter((item) => activeWithin(item, 1440));

    const verifiedDrivers = users.filter((item) => item.driverVerified || item.verified);
    const suspendedUsers = users.filter((item) => item.suspended);

    const newRides7Days = rides.filter((item) => createdWithin(item, 7));
    const newBookings7Days = bookings.filter((item) => createdWithin(item, 7));
    const newBookings30Days = bookings.filter((item) => createdWithin(item, 30));

    const completedBookings = bookings.filter((item) => item.status === "completed");
    const cancelledBookings = bookings.filter(
      (item) =>
        item.status === "cancelled" ||
        item.status === "rejected" ||
        item.status === "no_show"
    );

    const openReports = reports.filter((item) => !item.status || item.status === "open");

    const grossRevenue = bookings.reduce(
      (total, booking) =>
        total +
        Number(booking.price || booking.amount || 0) *
          Number(booking.seatsBooked || 1),
      0
    );

    const weeklyRevenue = newBookings7Days.reduce(
      (total, booking) =>
        total +
        Number(booking.price || booking.amount || 0) *
          Number(booking.seatsBooked || 1),
      0
    );

    const monthlyRevenue = newBookings30Days.reduce(
      (total, booking) =>
        total +
        Number(booking.price || booking.amount || 0) *
          Number(booking.seatsBooked || 1),
      0
    );

    const conversionRate =
      users.length > 0 ? Math.round((bookings.length / users.length) * 100) : 0;

    const activationRate =
      users.length > 0 ? Math.round((activeUsers24h.length / users.length) * 100) : 0;

    const driverSupplyRate =
      users.length > 0 ? Math.round((verifiedDrivers.length / users.length) * 100) : 0;

    const completionRate =
      bookings.length > 0 ? Math.round((completedBookings.length / bookings.length) * 100) : 0;

    const cancellationRate =
      bookings.length > 0 ? Math.round((cancelledBookings.length / bookings.length) * 100) : 0;

    let growthScore = 0;

    growthScore += users.length >= 100 ? 20 : users.length >= 25 ? 14 : users.length >= 5 ? 8 : 2;
    growthScore += newUsers7Days.length >= 20 ? 18 : newUsers7Days.length >= 5 ? 10 : newUsers7Days.length > 0 ? 5 : 0;
    growthScore += bookings.length >= 50 ? 18 : bookings.length >= 10 ? 10 : bookings.length > 0 ? 5 : 0;
    growthScore += completedBookings.length >= 25 ? 14 : completedBookings.length >= 5 ? 8 : completedBookings.length > 0 ? 4 : 0;
    growthScore += verifiedDrivers.length >= 10 ? 12 : verifiedDrivers.length >= 3 ? 7 : verifiedDrivers.length > 0 ? 3 : 0;
    growthScore += grossRevenue >= 1000 ? 12 : grossRevenue >= 250 ? 7 : grossRevenue > 0 ? 3 : 0;

    growthScore -= cancellationRate >= 35 ? 12 : cancellationRate >= 20 ? 6 : 0;
    growthScore -= openReports.length * 3;
    growthScore -= suspendedUsers.length * 3;

    growthScore = Math.max(Math.min(growthScore, 100), 0);

    const growthStatus: GrowthStatus =
      growthScore >= 85 ? "excellent" : growthScore >= 65 ? "growing" : growthScore >= 40 ? "watch" : "risk";

    const viralScore = Math.min(
      Math.round(newUsers7Days.length * 6 + newBookings7Days.length * 8 + activeUsers24h.length * 3),
      100
    );

    const retentionScore = Math.min(
      Math.round(activationRate * 0.7 + completionRate * 0.3),
      100
    );

    const signals: GrowthSignal[] = [
      {
        id: "growth-score",
        title: "Growth Score",
        value: `${growthScore}/100`,
        status: growthStatus,
        insight:
          growthStatus === "excellent"
            ? "RoadLink is showing strong growth momentum."
            : growthStatus === "growing"
            ? "RoadLink is growing. Keep increasing drivers, users and bookings."
            : growthStatus === "watch"
            ? "Growth needs attention. Focus on acquisition and activation."
            : "Growth is weak. RoadLink needs more users, drivers and completed bookings.",
      },
      {
        id: "new-users",
        title: "New Users 7 Days",
        value: String(newUsers7Days.length),
        status: newUsers7Days.length >= 20 ? "excellent" : newUsers7Days.length >= 5 ? "growing" : "watch",
        insight: "New users show whether acquisition is working.",
      },
      {
        id: "active-users",
        title: "Active Users 24h",
        value: String(activeUsers24h.length),
        status: activeUsers24h.length >= 25 ? "excellent" : activeUsers24h.length >= 5 ? "growing" : "watch",
        insight: "Active users show real platform engagement.",
      },
      {
        id: "conversion",
        title: "Conversion Rate",
        value: `${conversionRate}%`,
        status: conversionRate >= 50 ? "excellent" : conversionRate >= 20 ? "growing" : "watch",
        insight: "Conversion compares bookings against total users.",
      },
      {
        id: "retention",
        title: "Retention Score",
        value: `${retentionScore}/100`,
        status: retentionScore >= 75 ? "excellent" : retentionScore >= 45 ? "growing" : "watch",
        insight: "Retention estimates active usage and booking completion health.",
      },
      {
        id: "viral",
        title: "Viral Score",
        value: `${viralScore}/100`,
        status: viralScore >= 75 ? "excellent" : viralScore >= 40 ? "growing" : "watch",
        insight: "Viral score estimates momentum from new users, bookings and activity.",
      },
    ];

    return {
      newUsersToday,
      newUsers7Days,
      newUsers30Days,
      activeUsers,
      activeUsers24h,
      verifiedDrivers,
      suspendedUsers,
      newRides7Days,
      newBookings7Days,
      newBookings30Days,
      completedBookings,
      cancelledBookings,
      openReports,
      grossRevenue,
      weeklyRevenue,
      monthlyRevenue,
      conversionRate,
      activationRate,
      driverSupplyRate,
      completionRate,
      cancellationRate,
      growthScore,
      growthStatus,
      viralScore,
      retentionScore,
      signals,
    };
  }, [users, rides, bookings, reports]);

  async function saveGrowthSnapshot() {
    try {
      setSaving(true);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "growthSnapshots", `growth-${Date.now()}`),
        {
          growthScore: growth.growthScore,
          growthStatus: growth.growthStatus,
          users: users.length,
          newUsersToday: growth.newUsersToday.length,
          newUsers7Days: growth.newUsers7Days.length,
          newUsers30Days: growth.newUsers30Days.length,
          activeUsers24h: growth.activeUsers24h.length,
          verifiedDrivers: growth.verifiedDrivers.length,
          bookings: bookings.length,
          completedBookings: growth.completedBookings.length,
          grossRevenue: growth.grossRevenue,
          weeklyRevenue: growth.weeklyRevenue,
          monthlyRevenue: growth.monthlyRevenue,
          conversionRate: growth.conversionRate,
          activationRate: growth.activationRate,
          retentionScore: growth.retentionScore,
          viralScore: growth.viralScore,
          createdAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `growth-intel-${Date.now()}`),
        {
          action: "Growth Intelligence Snapshot Saved",
          targetId: "growth-intelligence",
          targetType: "growthSnapshot",
          details: `Growth score: ${growth.growthScore}/100`,
          severity: growth.growthStatus === "risk" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Growth snapshot saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save growth snapshot.");
    } finally {
      setSaving(false);
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status: GrowthStatus) {
    if (status === "excellent") return "Excellent";
    if (status === "growing") return "Growing";
    if (status === "watch") return "Watch";
    return "Risk";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/executive" className="miniButton">Executive</Link>
          <Link href="/admin/ceo-dashboard" className="miniButton">CEO</Link>
          <Link href="/admin/investor-board" className="miniButton">Investor</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Growth Intelligence</p>
            <h1>Growth <span>Intelligence</span></h1>
            <p className="subtitle">
              Track acquisition, activation, conversion, retention, viral momentum,
              driver supply, bookings and growth readiness.
            </p>
          </div>

          <div className={growth.growthScore < 65 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{growth.growthScore}</strong>
            <span>{statusLabel(growth.growthStatus)}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Total Users" value={String(users.length)} />
          <Metric icon="🆕" label="New Today" value={String(growth.newUsersToday.length)} />
          <Metric icon="📈" label="New 7 Days" value={String(growth.newUsers7Days.length)} />
          <Metric icon="🟢" label="Active 24h" value={String(growth.activeUsers24h.length)} />
          <Metric icon="🚘" label="Drivers" value={String(growth.verifiedDrivers.length)} />
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} />
          <Metric icon="💰" label="Weekly Revenue" value={money(growth.weeklyRevenue)} />
          <Metric icon="🔥" label="Viral Score" value={`${growth.viralScore}/100`} />
        </section>

        <section className="signalGrid">
          {growth.signals.map((item) => (
            <section key={item.id} className={`signalCard ${item.status}`}>
              <div className="signalTop">
                <span>{statusLabel(item.status)}</span>
                <strong>{item.value}</strong>
              </div>

              <h2>{item.title}</h2>
              <p>{item.insight}</p>
            </section>
          ))}
        </section>

        <section className="boardGrid">
          <section className="panel">
            <p className="eyebrow">Growth Metrics</p>
            <h2>Growth Snapshot</h2>

            <div className="infoGrid">
              <Info label="Growth Score" value={`${growth.growthScore}/100`} />
              <Info label="Growth Status" value={statusLabel(growth.growthStatus)} />
              <Info label="New Users Today" value={String(growth.newUsersToday.length)} />
              <Info label="New Users 7 Days" value={String(growth.newUsers7Days.length)} />
              <Info label="New Users 30 Days" value={String(growth.newUsers30Days.length)} />
              <Info label="Active Users 15m" value={String(growth.activeUsers.length)} />
              <Info label="Active Users 24h" value={String(growth.activeUsers24h.length)} />
              <Info label="Verified Drivers" value={String(growth.verifiedDrivers.length)} />
              <Info label="New Rides 7 Days" value={String(growth.newRides7Days.length)} />
              <Info label="New Bookings 7 Days" value={String(growth.newBookings7Days.length)} />
              <Info label="Completed Bookings" value={String(growth.completedBookings.length)} />
              <Info label="Cancelled Bookings" value={String(growth.cancelledBookings.length)} />
              <Info label="Gross Revenue" value={money(growth.grossRevenue)} />
              <Info label="Monthly Revenue" value={money(growth.monthlyRevenue)} />
              <Info label="Conversion Rate" value={`${growth.conversionRate}%`} />
              <Info label="Activation Rate" value={`${growth.activationRate}%`} />
              <Info label="Driver Supply Rate" value={`${growth.driverSupplyRate}%`} />
              <Info label="Completion Rate" value={`${growth.completionRate}%`} />
              <Info label="Cancellation Rate" value={`${growth.cancellationRate}%`} />
              <Info label="Retention Score" value={`${growth.retentionScore}/100`} />
            </div>

            <button className="saveButton" onClick={saveGrowthSnapshot} disabled={saving}>
              {saving ? "Saving..." : "Save Growth Snapshot"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Growth Actions</p>
            <h2>Next Moves</h2>

            <div className="actionList">
              <Link href="/admin/marketing" className="action">
                <strong>Marketing</strong>
                <span>Launch campaigns to bring new users.</span>
              </Link>

              <Link href="/admin/coupons" className="action">
                <strong>Coupons</strong>
                <span>Use offers to increase bookings.</span>
              </Link>

              <Link href="/admin/driver-performance" className="action">
                <strong>Driver Performance</strong>
                <span>Improve supply and driver reliability.</span>
              </Link>

              <Link href="/admin/demand-heatmap" className="action">
                <strong>Demand Heatmap</strong>
                <span>Find where demand is strongest.</span>
              </Link>

              <Link href="/admin/investor-board" className="action">
                <strong>Investor Board</strong>
                <span>Review traction signals for investors.</span>
              </Link>
            </div>
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1280px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .metric,
        .signalCard,
        .panel {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 34px;
          margin-bottom: 22px;
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

        h1 { font-size: 58px; line-height: 1; margin: 0 0 16px; }
        h1 span, h2, .metricValue { color: #22c55e; }
        h2 { font-size: 30px; margin: 0 0 14px; }

        .subtitle,
        .signalCard p,
        .action span {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .scoreOrb {
          min-width: 104px;
          height: 104px;
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

        .scoreOrb strong {
          color: #22c55e;
          font-size: 32px;
          font-weight: 900;
        }

        .warningScore strong { color: #fca5a5; }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 12px;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .metricValue {
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .signalGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .signalCard {
          border-radius: 28px;
          padding: 24px;
        }

        .signalCard.risk,
        .signalCard.watch {
          border-color: rgba(239,68,68,0.35);
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.12), transparent 42%),
            rgba(8,13,25,0.92);
        }

        .signalTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .signalTop span {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .signalTop strong {
          color: #22c55e;
          font-size: 24px;
          font-weight: 900;
        }

        .signalCard.risk .signalTop strong,
        .signalCard.watch .signalTop strong {
          color: #fca5a5;
        }

        .boardGrid {
          display: grid;
          grid-template-columns: 1.35fr 0.65fr;
          gap: 24px;
        }

        .panel {
          border-radius: 30px;
          padding: 28px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .infoBox,
        .action {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .infoBox span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoBox strong {
          display: block;
          overflow-wrap: anywhere;
        }

        .saveButton {
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .actionList {
          display: grid;
          gap: 12px;
        }

        .action {
          display: block;
          color: white;
          text-decoration: none;
        }

        .action strong,
        .action span {
          display: block;
        }

        .action span {
          margin-top: 6px;
          font-size: 13px;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1100px) {
          .stats,
          .signalGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .boardGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .page { padding: 16px; padding-bottom: 140px; }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 { font-size: 44px; }

          .stats,
          .signalGrid,
          .infoGrid {
            grid-template-columns: 1fr;
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
      <div className="metricValue">{value}</div>
    </div>
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
