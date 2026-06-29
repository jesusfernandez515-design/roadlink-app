"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  admin?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  online?: boolean;
  createdAt?: any;
};

type Ride = {
  id: string;
  status?: string;
  price?: number;
  seats?: number;
  distanceMiles?: number;
  driverEmail?: string;
  from?: string;
  to?: string;
  createdAt?: any;
};

type Booking = {
  id: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  driverEmail?: string;
  passengerEmail?: string;
  createdAt?: any;
};

type Payout = {
  id: string;
  amount?: number;
  status?: string;
  createdAt?: any;
};

type Rating = {
  id: string;
  stars?: number;
  rating?: number;
  createdAt?: any;
};

type EmergencyAlert = {
  id: string;
  status?: string;
  priority?: string;
  createdAt?: any;
};

type Verification = {
  id: string;
  status?: string;
  createdAt?: any;
};

export default function AnalyticsCenterPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [status, setStatus] = useState("Loading analytics center...");

  useEffect(() => {
    let unsubscribeMe: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      unsubscribeMe = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile)
            : ({ id: user.uid, email: user.email || "" } as UserProfile);

          setCurrentUser(data);

          const adminAllowed =
            data.admin === true ||
            data.role === "admin" ||
            user.email === "jesusfernandez515@gmail.com";

          setStatus(adminAllowed ? "" : "Access denied. Admin account required.");
        },
        (error) => setStatus(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMe) unsubscribeMe();
    };
  }, [router]);

  const adminAllowed =
    currentUser?.admin === true ||
    currentUser?.role === "admin" ||
    auth.currentUser?.email === "jesusfernandez515@gmail.com";

  useEffect(() => {
    if (!adminAllowed) return;

    const unsubUsers = onSnapshot(query(collection(db, "users")), (s) =>
      setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })) as UserProfile[])
    );

    const unsubRides = onSnapshot(query(collection(db, "rides")), (s) =>
      setRides(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Ride[])
    );

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (s) =>
      setBookings(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Booking[])
    );

    const unsubPayouts = onSnapshot(query(collection(db, "payoutRequests")), (s) =>
      setPayouts(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Payout[])
    );

    const unsubRatings = onSnapshot(query(collection(db, "ratings")), (s) =>
      setRatings(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Rating[])
    );

    const unsubAlerts = onSnapshot(query(collection(db, "emergencyAlerts")), (s) =>
      setAlerts(s.docs.map((d) => ({ id: d.id, ...d.data() })) as EmergencyAlert[])
    );

    const unsubVerifications = onSnapshot(query(collection(db, "driverVerifications")), (s) =>
      setVerifications(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Verification[])
    );

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubRatings();
      unsubAlerts();
      unsubVerifications();
    };
  }, [adminAllowed]);

  function money(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function cleanStatus(value?: string) {
    return String(value || "").toLowerCase();
  }

  const analytics = useMemo(() => {
    const completedBookings = bookings.filter((item) => cleanStatus(item.status) === "completed");
    const activeBookings = bookings.filter((item) =>
      ["reserved", "confirmed", "pending"].includes(cleanStatus(item.status))
    );

    const grossRevenue = completedBookings.reduce(
      (total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1),
      0
    );

    const platformFee = Math.round(grossRevenue * 0.12);

    const totalSeats = completedBookings.reduce(
      (total, item) => total + Number(item.seatsBooked || 1),
      0
    );

    const totalMiles = rides.reduce((total, item) => total + Number(item.distanceMiles || 0), 0);

    const paidOut = payouts
      .filter((item) => cleanStatus(item.status) === "paid")
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const pendingPayouts = payouts
      .filter((item) => ["pending", "approved"].includes(cleanStatus(item.status)))
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const avgRating = ratings.length
      ? ratings.reduce((total, item) => total + Number(item.stars || item.rating || 0), 0) /
        ratings.length
      : 0;

    return {
      totalUsers: users.length,
      onlineUsers: users.filter((item) => item.online).length,
      verifiedUsers: users.filter((item) => item.verified || item.driverVerified).length,
      totalRides: rides.length,
      activeRides: rides.filter((item) => ["active", "full"].includes(cleanStatus(item.status))).length,
      completedRides: rides.filter((item) => cleanStatus(item.status) === "completed").length,
      cancelledRides: rides.filter((item) => cleanStatus(item.status) === "cancelled").length,
      totalBookings: bookings.length,
      completedBookings: completedBookings.length,
      activeBookings: activeBookings.length,
      grossRevenue,
      platformFee,
      paidOut,
      pendingPayouts,
      totalSeats,
      totalMiles,
      avgRating,
      totalReviews: ratings.length,
      activeSOS: alerts.filter((item) => cleanStatus(item.status) === "active").length,
      criticalSOS: alerts.filter((item) =>
        ["critical", "life_threatening"].includes(cleanStatus(item.priority))
      ).length,
      pendingVerifications: verifications.filter((item) => cleanStatus(item.status) === "pending").length,
      approvedVerifications: verifications.filter((item) => cleanStatus(item.status) === "approved").length,
    };
  }, [users, rides, bookings, payouts, ratings, alerts, verifications]);

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Analytics <span>Center</span></h1>
          <p>{status || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <PageStyles />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin-sos" className="navButton">Admin SOS</Link>
          <Link href="/admin-verifications" className="navButton">Verifications</Link>
          <Link href="/activity-feed" className="navButton">Activity</Link>
          <Link href="/dashboard" className="navButton">Dashboard</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Enterprise Intelligence</p>
            <h1>Analytics <span>Center</span></h1>
            <p className="subtitle">
              Global RoadLink metrics for users, rides, bookings, revenue, payouts, safety, verification and reputation.
            </p>
          </div>

          <div className="liveOrb">
            <strong>LIVE</strong>
            <span>{analytics.totalUsers} users</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="👥" label="Total Users" value={String(analytics.totalUsers)} />
          <Metric icon="🟢" label="Online Users" value={String(analytics.onlineUsers)} />
          <Metric icon="🛡️" label="Verified Users" value={String(analytics.verifiedUsers)} />
          <Metric icon="🚗" label="Total Rides" value={String(analytics.totalRides)} />
          <Metric icon="🟢" label="Active Rides" value={String(analytics.activeRides)} />
          <Metric icon="✅" label="Completed Rides" value={String(analytics.completedRides)} />
          <Metric icon="🎟️" label="Bookings" value={String(analytics.totalBookings)} />
          <Metric icon="📌" label="Active Bookings" value={String(analytics.activeBookings)} />
          <Metric icon="💰" label="Gross Revenue" value={money(analytics.grossRevenue)} />
          <Metric icon="🧾" label="Platform Fee" value={money(analytics.platformFee)} />
          <Metric icon="🏦" label="Paid Out" value={money(analytics.paidOut)} />
          <Metric icon="⏳" label="Pending Payouts" value={money(analytics.pendingPayouts)} />
          <Metric icon="👥" label="Passengers Moved" value={String(analytics.totalSeats)} />
          <Metric icon="🛣️" label="Total Miles" value={`${analytics.totalMiles.toFixed(1)} mi`} />
          <Metric icon="⭐" label="Avg Rating" value={analytics.avgRating ? analytics.avgRating.toFixed(1) : "New"} />
          <Metric icon="🚨" label="Active SOS" value={String(analytics.activeSOS)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Revenue</p>
            <h2>Financial Overview</h2>
            <Bar label="Gross Revenue" value={analytics.grossRevenue} max={Math.max(analytics.grossRevenue, 1)} money />
            <Bar label="Platform Fee" value={analytics.platformFee} max={Math.max(analytics.grossRevenue, 1)} money />
            <Bar label="Paid Out" value={analytics.paidOut} max={Math.max(analytics.grossRevenue, 1)} money />
            <Bar label="Pending Payouts" value={analytics.pendingPayouts} max={Math.max(analytics.grossRevenue, 1)} money />
          </section>

          <section className="panel">
            <p className="eyebrow">Operations</p>
            <h2>Ride Performance</h2>
            <Bar label="Total Rides" value={analytics.totalRides} max={Math.max(analytics.totalRides, 1)} />
            <Bar label="Active Rides" value={analytics.activeRides} max={Math.max(analytics.totalRides, 1)} />
            <Bar label="Completed Rides" value={analytics.completedRides} max={Math.max(analytics.totalRides, 1)} />
            <Bar label="Cancelled Rides" value={analytics.cancelledRides} max={Math.max(analytics.totalRides, 1)} />
          </section>

          <section className="panel">
            <p className="eyebrow">Trust & Safety</p>
            <h2>Safety Overview</h2>
            <Info label="Active SOS" value={String(analytics.activeSOS)} />
            <Info label="Critical SOS" value={String(analytics.criticalSOS)} />
            <Info label="Pending Verifications" value={String(analytics.pendingVerifications)} />
            <Info label="Approved Verifications" value={String(analytics.approvedVerifications)} />
          </section>

          <section className="panel">
            <p className="eyebrow">Community Reputation</p>
            <h2>Review Health</h2>
            <Info label="Total Reviews" value={String(analytics.totalReviews)} />
            <Info label="Average Rating" value={analytics.avgRating ? `${analytics.avgRating.toFixed(1)}/5` : "New"} />
            <Info label="Passengers Moved" value={String(analytics.totalSeats)} />
            <Info label="Total Miles" value={`${analytics.totalMiles.toFixed(1)} mi`} />
          </section>
        </section>
      </section>

      <PageStyles />
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  money: isMoney,
}: {
  label: string;
  value: number;
  max: number;
  money?: boolean;
}) {
  const width = Math.max(4, Math.min(100, Math.round((value / max) * 100)));

  return (
    <div className="barRow">
      <div className="barTop">
        <span>{label}</span>
        <strong>{isMoney ? `$${Number(value || 0).toFixed(2)}` : value}</strong>
      </div>
      <div className="bar">
        <div style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function PageStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 120px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 35%),
          radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container {
        max-width: 1180px;
        margin: auto;
      }

      .topBar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .navButton {
        color: white;
        text-decoration: none;
        font-weight: 900;
        padding: 12px 18px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        display: inline-flex;
        justify-content: center;
      }

      .hero,
      .metric,
      .panel,
      .locked {
        background: rgba(8,13,25,0.9);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 24px 80px rgba(0,0,0,0.55);
        backdrop-filter: blur(16px);
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        padding: 35px;
        border-radius: 32px;
        margin-bottom: 20px;
      }

      .locked {
        max-width: 720px;
        margin: 80px auto;
        padding: 35px;
        border-radius: 32px;
        text-align: center;
      }

      .eyebrow {
        color: #22c55e;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 13px;
        margin: 0 0 10px;
      }

      h1 {
        margin: 0 0 16px;
        font-size: 60px;
        line-height: 1;
      }

      h1 span,
      h2,
      .metric strong,
      .liveOrb strong {
        color: #22c55e;
      }

      .subtitle,
      .locked p {
        color: #a1a1aa;
        max-width: 760px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .liveOrb {
        min-width: 130px;
        height: 130px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        text-align: center;
      }

      .liveOrb strong {
        font-size: 24px;
      }

      .liveOrb span {
        color: #d4d4d8;
        font-size: 12px;
        font-weight: 900;
      }

      .status {
        color: #22c55e;
        text-align: center;
        font-weight: 900;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 20px;
      }

      .metric {
        padding: 18px;
        border-radius: 22px;
      }

      .metricIcon {
        font-size: 24px;
        margin-bottom: 8px;
      }

      .metric span {
        display: block;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .metric strong {
        font-size: 22px;
        overflow-wrap: anywhere;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .panel {
        border-radius: 30px;
        padding: 30px;
      }

      .info {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        padding: 14px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
        margin-bottom: 10px;
      }

      .info span,
      .barTop span {
        color: #a1a1aa;
        font-weight: 900;
      }

      .info strong,
      .barTop strong {
        color: #e5e7eb;
      }

      .barRow {
        margin-bottom: 18px;
      }

      .barTop {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      .bar {
        height: 13px;
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
        overflow: hidden;
      }

      .bar div {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(135deg, #22c55e, #16a34a);
      }

      @media (max-width: 900px) {
        .hero {
          flex-direction: column;
          align-items: flex-start;
        }

        h1 {
          font-size: 44px;
        }

        .stats,
        .grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 600px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero,
        .panel {
          padding: 22px;
          border-radius: 26px;
        }
      }
    `}</style>
  );
        }
