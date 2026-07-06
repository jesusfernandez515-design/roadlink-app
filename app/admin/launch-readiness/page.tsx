"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
};

type RideItem = {
  id: string;
  status?: string;
};

type BookingItem = {
  id: string;
  status?: string;
  price?: number;
  amount?: number;
};

type ReportItem = {
  id: string;
  status?: string;
  priority?: string;
};

type BackupItem = {
  id: string;
  status?: string;
  verified?: boolean;
  createdAt?: string;
};

type FeatureFlags = {
  enableBookings?: boolean;
  enableMessaging?: boolean;
  enableWallet?: boolean;
  enableDriverVerification?: boolean;
  enableCoupons?: boolean;
  enableReviews?: boolean;
  enableNotifications?: boolean;
  enableStripe?: boolean;
  enableDisputes?: boolean;
  enablePublicLaunch?: boolean;
  maintenanceMode?: boolean;
};

type GlobalSettings = {
  roadLinkCommissionPercent?: number;
  minimumTripPrice?: number;
  pricePerMile?: number;
  supportEmail?: string;
  emergencyEmail?: string;
  platformMode?: string;
};

type CheckItem = {
  id: string;
  icon: string;
  title: string;
  description: string;
  ready: boolean;
  score: number;
  href: string;
};

const DEFAULT_FLAGS: FeatureFlags = {
  enableBookings: true,
  enableMessaging: true,
  enableWallet: true,
  enableDriverVerification: true,
  enableCoupons: true,
  enableReviews: true,
  enableNotifications: true,
  enableStripe: false,
  enableDisputes: true,
  enablePublicLaunch: false,
  maintenanceMode: false,
};

export default function AdminLaunchReadinessPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [settings, setSettings] = useState<GlobalSettings>({});
  const [message, setMessage] = useState("Loading launch readiness...");

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

    const unsubReports = onSnapshot(query(collection(db, "reports")), (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
    });

    const unsubBackups = onSnapshot(query(collection(db, "systemBackups")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BackupItem[];
      data.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      setBackups(data);
    });

    const unsubFlags = onSnapshot(doc(db, "featureFlags", "main"), (snapshot) => {
      if (snapshot.exists()) setFlags({ ...DEFAULT_FLAGS, ...(snapshot.data() as FeatureFlags) });
    });

    const unsubSettings = onSnapshot(doc(db, "globalSettings", "main"), (snapshot) => {
      if (snapshot.exists()) setSettings(snapshot.data() as GlobalSettings);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
      unsubBackups();
      unsubFlags();
      unsubSettings();
    };
  }, []);

  const launch = useMemo(() => {
    const verifiedDrivers = users.filter((user) => user.driverVerified || user.verified);
    const suspendedUsers = users.filter((user) => user.suspended);
    const activeRides = rides.filter((ride) => ["active", "open", "full"].includes(String(ride.status || "")));
    const completedBookings = bookings.filter((booking) => booking.status === "completed");
    const openReports = reports.filter((report) => !report.status || report.status === "open");
    const urgentReports = reports.filter((report) => report.priority === "urgent" || report.priority === "critical");
    const latestBackup = backups[0];

    const revenue = completedBookings.reduce(
      (total, booking) => total + Number(booking.price || booking.amount || 0),
      0
    );

    const checks: CheckItem[] = [
      {
        id: "drivers",
        icon: "🚘",
        title: "Driver Supply",
        description: "At least three verified drivers should exist before public launch.",
        ready: verifiedDrivers.length >= 3,
        score: Math.min(100, verifiedDrivers.length * 25),
        href: "/admin/verifications",
      },
      {
        id: "rides",
        icon: "🛣️",
        title: "Active Rides",
        description: "Passengers need available routes to book.",
        ready: activeRides.length >= 3,
        score: Math.min(100, activeRides.length * 25),
        href: "/admin/rides",
      },
      {
        id: "bookings",
        icon: "🎟️",
        title: "Booking Flow",
        description: "Bookings should be enabled and tested.",
        ready: Boolean(flags.enableBookings) && bookings.length > 0,
        score: Boolean(flags.enableBookings) ? (bookings.length > 0 ? 100 : 70) : 0,
        href: "/admin/bookings",
      },
      {
        id: "payments",
        icon: "💳",
        title: "Payments",
        description: "Stripe should be enabled only when payment flow is ready.",
        ready: Boolean(flags.enableStripe),
        score: Boolean(flags.enableStripe) ? 100 : 35,
        href: "/admin/stripe",
      },
      {
        id: "safety",
        icon: "🛡️",
        title: "Safety & Reports",
        description: "Reports and disputes should be enabled with low urgent risk.",
        ready: Boolean(flags.enableDisputes) && urgentReports.length === 0,
        score: Math.max(0, 100 - urgentReports.length * 30 - openReports.length * 5),
        href: "/admin/reports",
      },
      {
        id: "notifications",
        icon: "📨",
        title: "Notifications",
        description: "System notifications should be active before launch.",
        ready: Boolean(flags.enableNotifications),
        score: Boolean(flags.enableNotifications) ? 100 : 0,
        href: "/admin/notifications",
      },
      {
        id: "backup",
        icon: "💾",
        title: "Backup Recovery",
        description: "A verified backup should exist before launch.",
        ready: Boolean(latestBackup?.verified && latestBackup.status === "completed"),
        score: latestBackup?.verified ? 100 : backups.length > 0 ? 60 : 0,
        href: "/admin/backup-center",
      },
      {
        id: "settings",
        icon: "⚙️",
        title: "Global Settings",
        description: "Pricing, commission and support emails must be configured.",
        ready:
          Number(settings.roadLinkCommissionPercent || 0) > 0 &&
          Number(settings.minimumTripPrice || 0) > 0 &&
          Number(settings.pricePerMile || 0) > 0 &&
          String(settings.supportEmail || "").includes("@"),
        score:
          Number(settings.roadLinkCommissionPercent || 0) > 0 &&
          Number(settings.minimumTripPrice || 0) > 0 &&
          Number(settings.pricePerMile || 0) > 0
            ? 100
            : 40,
        href: "/admin/global-settings",
      },
      {
        id: "maintenance",
        icon: "🚦",
        title: "Platform Mode",
        description: "Maintenance mode must be off for launch.",
        ready: !flags.maintenanceMode,
        score: flags.maintenanceMode ? 0 : 100,
        href: "/admin/feature-flags",
      },
    ];

    const totalScore = Math.round(
      checks.reduce((total, check) => total + check.score, 0) / checks.length
    );

    const readyCount = checks.filter((check) => check.ready).length;
    const blockers = checks.filter((check) => !check.ready);

    return {
      checks,
      totalScore,
      readyCount,
      blockers,
      verifiedDrivers,
      activeRides,
      completedBookings,
      revenue,
      suspendedUsers,
      openReports,
      urgentReports,
      latestBackup,
      readyForLaunch: totalScore >= 80 && blockers.length <= 2 && !flags.maintenanceMode,
    };
  }, [users, rides, bookings, reports, backups, flags, settings]);

  function statusText() {
    if (flags.maintenanceMode) return "Maintenance";
    if (launch.readyForLaunch) return "Ready";
    if (launch.totalScore >= 70) return "Almost Ready";
    return "Not Ready";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/mission-control" className="miniButton">Mission Control</Link>
          <Link href="/admin/feature-flags" className="miniButton">Feature Flags</Link>
          <Link href="/admin/global-settings" className="miniButton">Global Settings</Link>
          <Link href="/admin/backup-center" className="miniButton">Backups</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Launch</p>
            <h1>Launch <span>Readiness</span></h1>
            <p className="subtitle">
              Verify drivers, rides, bookings, payments, safety, backups, settings and feature flags before public launch.
            </p>
          </div>

          <div className={launch.readyForLaunch ? "scoreOrb" : "scoreOrb warning"}>
            <strong>{launch.totalScore}</strong>
            <span>{statusText()}</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className={launch.readyForLaunch ? "statusCard ready" : "statusCard"}>
          <div className="liveDot" />
          <div>
            <strong>{statusText()}</strong>
            <span>
              {launch.readyForLaunch
                ? "RoadLink is ready for a controlled launch."
                : `${launch.blockers.length} launch blocker(s) need attention before going public.`}
            </span>
          </div>
        </section>

        <section className="stats">
          <Metric icon="✅" label="Ready Checks" value={`${launch.readyCount}/${launch.checks.length}`} />
          <Metric icon="🚧" label="Blockers" value={String(launch.blockers.length)} danger={launch.blockers.length > 0} />
          <Metric icon="🚘" label="Drivers" value={String(launch.verifiedDrivers.length)} />
          <Metric icon="🛣️" label="Active Rides" value={String(launch.activeRides.length)} />
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} />
          <Metric icon="💰" label="Revenue" value={`$${Math.round(launch.revenue)}`} />
          <Metric icon="⚠️" label="Open Reports" value={String(launch.openReports.length)} danger={launch.openReports.length > 0} />
          <Metric icon="💾" label="Backup" value={launch.latestBackup?.verified ? "Verified" : "Missing"} danger={!launch.latestBackup?.verified} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Launch Checklist</p>
            <h2>Readiness Checks</h2>

            <div className="checkList">
              {launch.checks.map((check) => (
                <Link key={check.id} href={check.href} className={check.ready ? "checkItem readyCheck" : "checkItem"}>
                  <div className="checkIcon">{check.icon}</div>

                  <div>
                    <strong>{check.title}</strong>
                    <p>{check.description}</p>

                    <div className="bar">
                      <div style={{ width: `${check.score}%` }} />
                    </div>
                  </div>

                  <em>{check.ready ? "Ready" : "Fix"}</em>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Launch Decision</p>
            <h2>{statusText()}</h2>

            <div className={launch.readyForLaunch ? "decisionBox good" : "decisionBox bad"}>
              <strong>{launch.readyForLaunch ? "✅ Launch Approved" : "🚧 Launch Not Approved"}</strong>
              <p>
                {launch.readyForLaunch
                  ? "You can move toward a private or controlled public launch."
                  : "Fix the blockers below before opening RoadLink to the public."}
              </p>
            </div>

            <div className="infoGrid">
              <Info label="Platform Mode" value={flags.maintenanceMode ? "Maintenance" : flags.enablePublicLaunch ? "Public Launch" : "Private MVP"} />
              <Info label="Stripe Enabled" value={flags.enableStripe ? "Yes" : "No"} />
              <Info label="Bookings Enabled" value={flags.enableBookings ? "Yes" : "No"} />
              <Info label="Notifications" value={flags.enableNotifications ? "Enabled" : "Disabled"} />
              <Info label="Support Email" value={settings.supportEmail || "Not configured"} />
              <Info label="Emergency Email" value={settings.emergencyEmail || "Not configured"} />
            </div>

            <div className="quickLinks">
              <Link href="/admin/feature-flags">🚦 Feature Flags</Link>
              <Link href="/admin/global-settings">⚙️ Settings</Link>
              <Link href="/admin/backup-center">💾 Backup</Link>
              <Link href="/admin/mission-control">🛰️ Mission Control</Link>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1240px; margin: auto; }

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

        .hero,
        .metric,
        .panel,
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
          font-size: 60px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue,
        .scoreOrb strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .statusCard span,
        .checkItem p,
        .decisionBox p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 14px 0;
        }

        .scoreOrb {
          min-width: 116px;
          height: 116px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .scoreOrb.warning {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb.warning strong { color: #fca5a5; }

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
          margin-bottom: 20px;
          display: grid;
          grid-template-columns: 16px 1fr;
          gap: 14px;
          align-items: center;
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.18);
        }

        .statusCard.ready {
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.10);
        }

        .liveDot {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #ef4444;
          animation: pulse 1.4s infinite;
        }

        .ready .liveDot {
          background: #22c55e;
        }

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
          margin-top: 4px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 22px;
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
          font-size: 21px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 20px;
        }

        .panel {
          border-radius: 30px;
          padding: 24px;
        }

        .checkList {
          display: grid;
          gap: 12px;
        }

        .checkItem {
          display: grid;
          grid-template-columns: 48px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 15px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(239,68,68,0.30);
          color: white;
          text-decoration: none;
        }

        .readyCheck {
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.08);
        }

        .checkIcon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .checkItem strong,
        .checkItem p {
          display: block;
          margin: 0;
        }

        .checkItem p {
          font-size: 13px;
          margin-top: 5px;
        }

        .checkItem em {
          color: #22c55e;
          font-style: normal;
          font-weight: 900;
        }

        .bar {
          height: 9px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          margin-top: 10px;
        }

        .bar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .decisionBox {
          padding: 20px;
          border-radius: 22px;
          margin-bottom: 18px;
        }

        .decisionBox.good {
          border: 1px solid rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.10);
        }

        .decisionBox.bad {
          border: 1px solid rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.18);
        }

        .decisionBox strong {
          display: block;
          font-size: 22px;
          margin-bottom: 8px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }

        .info {
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .info span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .info strong {
          display: block;
          color: white;
          overflow-wrap: anywhere;
        }

        .quickLinks {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
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

        @media (max-width: 1050px) {
          .hero,
          .grid {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats {
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
          .panel {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .infoGrid,
          .quickLinks {
            grid-template-columns: 1fr;
          }

          .metric,
          .checkItem {
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
  }
