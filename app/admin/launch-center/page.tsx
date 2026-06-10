"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

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

type PlatformSettings = {
  platformName?: string;
  supportEmail?: string;
  roadLinkFeePercent?: number;
  maintenanceMode?: boolean;
};

export default function AdminLaunchCenterPage() {
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [settings, setSettings] = useState<PlatformSettings>({});
  const [usersCount, setUsersCount] = useState(0);
  const [ridesCount, setRidesCount] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [paymentsCount, setPaymentsCount] = useState(0);
  const [message, setMessage] = useState("Loading launch center...");

  useEffect(() => {
    const unsubFlags = onSnapshot(
      doc(db, "featureFlags", "main"),
      (snapshot) => {
        setFlags((snapshot.data() as FeatureFlags) || {});
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubSettings = onSnapshot(
      doc(db, "platformSettings", "main"),
      (snapshot) => {
        setSettings((snapshot.data() as PlatformSettings) || {});
      },
      (error) => setMessage(error.message)
    );

    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsersCount(snapshot.size);
    });

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRidesCount(snapshot.size);
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookingsCount(snapshot.size);
    });

    const unsubPayments = onSnapshot(query(collection(db, "payments")), (snapshot) => {
      setPaymentsCount(snapshot.size);
    });

    return () => {
      unsubFlags();
      unsubSettings();
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayments();
    };
  }, []);

  const checklist = useMemo(() => {
    return [
      {
        title: "Authentication",
        icon: "🔐",
        ready: usersCount > 0,
        detail: `${usersCount} user(s) detected`,
      },
      {
        title: "Rides System",
        icon: "🚘",
        ready: Boolean(flags.enableBookings) && ridesCount >= 0,
        detail: `${ridesCount} ride(s) in database`,
      },
      {
        title: "Bookings",
        icon: "🎟️",
        ready: Boolean(flags.enableBookings),
        detail: `${bookingsCount} booking(s) detected`,
      },
      {
        title: "Messaging",
        icon: "💬",
        ready: Boolean(flags.enableMessaging),
        detail: "Feature flag enabled",
      },
      {
        title: "Wallet",
        icon: "💰",
        ready: Boolean(flags.enableWallet),
        detail: "Driver wallet enabled",
      },
      {
        title: "Driver Verification",
        icon: "🛡️",
        ready: Boolean(flags.enableDriverVerification),
        detail: "Verification workflow enabled",
      },
      {
        title: "Reviews",
        icon: "⭐",
        ready: Boolean(flags.enableReviews),
        detail: "Reviews and ratings enabled",
      },
      {
        title: "Notifications",
        icon: "🔔",
        ready: Boolean(flags.enableNotifications),
        detail: "Notification center enabled",
      },
      {
        title: "Coupons",
        icon: "🎟️",
        ready: Boolean(flags.enableCoupons),
        detail: "Promotions enabled",
      },
      {
        title: "Disputes",
        icon: "⚖️",
        ready: Boolean(flags.enableDisputes),
        detail: "Dispute center enabled",
      },
      {
        title: "Stripe Payments",
        icon: "💳",
        ready: Boolean(flags.enableStripe) && paymentsCount > 0,
        detail: paymentsCount > 0 ? `${paymentsCount} payment record(s)` : "Stripe not live yet",
      },
      {
        title: "Platform Settings",
        icon: "⚙️",
        ready: Boolean(settings.platformName && settings.supportEmail),
        detail: settings.platformName || "RoadLink",
      },
    ];
  }, [flags, settings, usersCount, ridesCount, bookingsCount, paymentsCount]);

  const readyCount = checklist.filter((item) => item.ready).length;
  const totalCount = checklist.length;
  const launchScore = Math.round((readyCount / totalCount) * 100);

  const launchStatus =
    flags.maintenanceMode || settings.maintenanceMode
      ? "Maintenance"
      : flags.enablePublicLaunch
      ? "Public Launch Enabled"
      : launchScore >= 85
      ? "Almost Ready"
      : "MVP Build Mode";

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/feature-flags" className="miniButton">Feature Flags</Link>
          <Link href="/admin/system-health" className="miniButton">System Health</Link>
          <Link href="/admin/stripe" className="miniButton">Stripe</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Launch <span>Center</span></h1>
            <p className="subtitle">
              Track RoadLink launch readiness, verify critical systems, and see what is still missing before production.
            </p>
          </div>

          <div className="heroIcon">🚀</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="scoreCard">
          <div>
            <p className="eyebrow">Launch Readiness</p>
            <h2>{launchScore}% Ready</h2>
            <p>Status: <strong>{launchStatus}</strong></p>
          </div>

          <div className="scoreCircle">
            {launchScore}%
          </div>
        </section>

        <section className="stats">
          <Metric icon="✅" label="Ready" value={String(readyCount)} />
          <Metric icon="📋" label="Total Checks" value={String(totalCount)} />
          <Metric icon="👥" label="Users" value={String(usersCount)} />
          <Metric icon="🚘" label="Rides" value={String(ridesCount)} />
          <Metric icon="🎟️" label="Bookings" value={String(bookingsCount)} />
          <Metric icon="💳" label="Payments" value={String(paymentsCount)} />
        </section>

        <section className="checklistCard">
          <p className="eyebrow">MVP Checklist</p>
          <h2>Production Readiness</h2>

          <div className="checklist">
            {checklist.map((item) => (
              <div key={item.title} className={item.ready ? "checkItem ready" : "checkItem missing"}>
                <div className="checkIcon">{item.icon}</div>

                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>

                <span>{item.ready ? "Ready" : "Missing"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="nextCard">
          <div>
            <p className="eyebrow">Next Steps</p>
            <h2>Before Public Launch</h2>

            <div className="nextList">
              <div>💳 Connect real Stripe Checkout and Stripe Connect.</div>
              <div>🗺️ Add Google Maps and geolocation.</div>
              <div>📱 Test full mobile experience.</div>
              <div>🔐 Lock admin routes behind admin-only permission.</div>
              <div>📄 Add Terms, Privacy Policy, and refund rules.</div>
            </div>
          </div>

          <Link href="/admin/feature-flags" className="launchButton">
            Manage Launch Flags
          </Link>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1180px;
          margin: auto;
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
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .scoreCard,
        .metric,
        .checklistCard,
        .nextCard {
          background: rgba(8, 13, 25, 0.92);
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

        h1 {
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          font-size: 34px;
          margin: 0 0 12px;
        }

        .subtitle,
        .scoreCard p,
        .checkItem p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .heroIcon {
          min-width: 92px;
          height: 92px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .scoreCard {
          border-radius: 30px;
          padding: 30px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 24px;
          align-items: center;
          margin-bottom: 24px;
        }

        .scoreCircle {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 8px solid rgba(34,197,94,0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          font-weight: 900;
          color: #22c55e;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
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
          font-size: 24px;
          font-weight: 900;
        }

        .checklistCard,
        .nextCard {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .checklist {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .checkItem {
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .checkItem.ready {
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.08);
        }

        .checkItem.missing {
          border-color: rgba(250,204,21,0.35);
          background: rgba(250,204,21,0.08);
        }

        .checkIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .checkItem strong {
          display: block;
          margin-bottom: 4px;
        }

        .checkItem p {
          margin: 0;
          font-size: 13px;
        }

        .checkItem span {
          border-radius: 999px;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 900;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .missing span {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border-color: rgba(250,204,21,0.35);
        }

        .nextCard {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .nextList {
          display: grid;
          gap: 10px;
          color: #e5e7eb;
          font-weight: 800;
        }

        .launchButton {
          padding: 16px 22px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-decoration: none;
          font-weight: 900;
          text-align: center;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .checklist {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero,
          .scoreCard,
          .nextCard {
            grid-template-columns: 1fr;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .checkItem {
            grid-template-columns: 46px 1fr;
          }

          .checkItem span {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .scoreCircle {
            width: 120px;
            height: 120px;
            font-size: 28px;
          }

          .launchButton {
            width: 100%;
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
