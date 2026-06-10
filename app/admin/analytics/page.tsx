"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  verified?: boolean;
  driverVerified?: boolean;
  suspended?: boolean;
  verificationStatus?: string;
  createdAt?: string;
};

type RideItem = {
  id: string;
  status?: string;
  price?: number;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
  createdAt?: string;
};

type VerificationItem = {
  id: string;
  status?: string;
  submittedAt?: string;
};

type ReportItem = {
  id: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

export default function AdminAnalyticsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [message, setMessage] = useState("Loading analytics...");

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as UserItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubRides = onSnapshot(
      query(collection(db, "rides")),
      (snapshot) => {
        setRides(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as RideItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as BookingItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, "payoutRequests")),
      (snapshot) => {
        setPayouts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as PayoutItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubVerifications = onSnapshot(
      query(collection(db, "driverVerifications")),
      (snapshot) => {
        setVerifications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as VerificationItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubReports = onSnapshot(
      query(collection(db, "reports")),
      (snapshot) => {
        setReports(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ReportItem[]);
      },
      (error) => setMessage(error.message)
    );

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubVerifications();
      unsubReports();
    };
  }, []);

  function isThisMonth(value?: string) {
    if (!value) return false;

    const date = new Date(value);
    const now = new Date();

    if (Number.isNaN(date.getTime())) return false;

    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  const analytics = useMemo(() => {
    const verifiedDrivers = users.filter((user) => user.driverVerified).length;
    const suspendedUsers = users.filter((user) => user.suspended).length;
    const newUsersThisMonth = users.filter((user) => isThisMonth(user.createdAt)).length;

    const activeRides = rides.filter((ride) => ride.status === "active").length;
    const fullRides = rides.filter((ride) => ride.status === "full").length;
    const completedRides = rides.filter((ride) => ride.status === "completed").length;
    const cancelledRides = rides.filter((ride) => ride.status === "cancelled").length;

    const pendingBookings = bookings.filter((booking) => booking.status === "pending").length;
    const reservedBookings = bookings.filter((booking) => booking.status === "reserved").length;
    const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed").length;
    const completedBookings = bookings.filter((booking) => booking.status === "completed").length;
    const cancelledBookings = bookings.filter((booking) => booking.status === "cancelled").length;

    const completedRevenue = bookings
      .filter((booking) => booking.status === "completed")
      .reduce((total, booking) => {
        return total + Number(booking.price || 0) * Number(booking.seatsBooked || 1);
      }, 0);

    const roadLinkFees = Math.round(completedRevenue * 0.12);

    const pendingPayouts = payouts.filter((payout) => payout.status === "pending").length;
    const approvedPayouts = payouts.filter((payout) => payout.status === "approved").length;
    const paidPayouts = payouts.filter((payout) => payout.status === "paid").length;

    const paidOutAmount = payouts
      .filter((payout) => payout.status === "paid")
      .reduce((total, payout) => total + Number(payout.amount || 0), 0);

    const pendingPayoutAmount = payouts
      .filter((payout) => payout.status === "pending" || payout.status === "approved")
      .reduce((total, payout) => total + Number(payout.amount || 0), 0);

    const pendingVerifications = verifications.filter((item) => item.status === "pending").length;
    const approvedVerifications = verifications.filter((item) => item.status === "approved").length;
    const rejectedVerifications = verifications.filter((item) => item.status === "rejected").length;

    const openReports = reports.filter((report) => !report.status || report.status === "open").length;
    const reviewingReports = reports.filter((report) => report.status === "reviewing").length;
    const resolvedReports = reports.filter((report) => report.status === "resolved").length;
    const urgentReports = reports.filter((report) => report.priority === "urgent").length;

    return {
      verifiedDrivers,
      suspendedUsers,
      newUsersThisMonth,
      activeRides,
      fullRides,
      completedRides,
      cancelledRides,
      pendingBookings,
      reservedBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      completedRevenue,
      roadLinkFees,
      pendingPayouts,
      approvedPayouts,
      paidPayouts,
      paidOutAmount,
      pendingPayoutAmount,
      pendingVerifications,
      approvedVerifications,
      rejectedVerifications,
      openReports,
      reviewingReports,
      resolvedReports,
      urgentReports,
    };
  }, [users, rides, bookings, payouts, verifications, reports]);

  const completionRate =
    bookings.length > 0
      ? Math.round((analytics.completedBookings / bookings.length) * 100)
      : 0;

  const cancellationRate =
    bookings.length > 0
      ? Math.round((analytics.cancelledBookings / bookings.length) * 100)
      : 0;

  const driverRatio =
    users.length > 0 ? Math.round((analytics.verifiedDrivers / users.length) * 100) : 0;

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/rides" className="miniButton">Rides</Link>
          <Link href="/admin/bookings" className="miniButton">Bookings</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Analytics <span>Dashboard</span></h1>
            <p className="subtitle">
              Track users, rides, bookings, revenue, payouts, reports, verification
              requests, and platform health from one executive dashboard.
            </p>
          </div>

          <div className="heroIcon">📊</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="kpiGrid">
          <Kpi icon="👥" label="Users" value={String(users.length)} detail={`${analytics.newUsersThisMonth} new this month`} />
          <Kpi icon="🚘" label="Rides" value={String(rides.length)} detail={`${analytics.activeRides} active`} />
          <Kpi icon="🎟️" label="Bookings" value={String(bookings.length)} detail={`${completionRate}% completed`} />
          <Kpi icon="💰" label="Revenue" value={`$${analytics.completedRevenue}`} detail={`$${analytics.roadLinkFees} RoadLink fee`} />
          <Kpi icon="🏦" label="Paid Out" value={`$${analytics.paidOutAmount}`} detail={`$${analytics.pendingPayoutAmount} pending`} />
          <Kpi icon="🛡️" label="Verified Drivers" value={String(analytics.verifiedDrivers)} detail={`${driverRatio}% of users`} />
          <Kpi icon="🚨" label="Open Reports" value={String(analytics.openReports)} detail={`${analytics.urgentReports} urgent`} alert={analytics.openReports > 0} />
          <Kpi icon="⛔" label="Suspended" value={String(analytics.suspendedUsers)} detail="Accounts restricted" alert={analytics.suspendedUsers > 0} />
        </section>

        <section className="analyticsGrid">
          <Panel title="Users" eyebrow="Community" icon="👥">
            <Metric label="Total Users" value={String(users.length)} />
            <Metric label="New This Month" value={String(analytics.newUsersThisMonth)} />
            <Metric label="Verified Drivers" value={String(analytics.verifiedDrivers)} />
            <Metric label="Suspended Users" value={String(analytics.suspendedUsers)} />
          </Panel>

          <Panel title="Rides" eyebrow="Trips" icon="🚘">
            <Metric label="Total Rides" value={String(rides.length)} />
            <Metric label="Active" value={String(analytics.activeRides)} />
            <Metric label="Full" value={String(analytics.fullRides)} />
            <Metric label="Completed" value={String(analytics.completedRides)} />
            <Metric label="Cancelled" value={String(analytics.cancelledRides)} />
          </Panel>

          <Panel title="Bookings" eyebrow="Reservations" icon="🎟️">
            <Metric label="Total Bookings" value={String(bookings.length)} />
            <Metric label="Pending" value={String(analytics.pendingBookings)} />
            <Metric label="Reserved" value={String(analytics.reservedBookings)} />
            <Metric label="Confirmed" value={String(analytics.confirmedBookings)} />
            <Metric label="Completed" value={String(analytics.completedBookings)} />
            <Metric label="Cancelled" value={String(analytics.cancelledBookings)} />
          </Panel>

          <Panel title="Money" eyebrow="Revenue" icon="💵">
            <Metric label="Completed Revenue" value={`$${analytics.completedRevenue}`} />
            <Metric label="RoadLink Fees" value={`$${analytics.roadLinkFees}`} />
            <Metric label="Paid Payouts" value={`$${analytics.paidOutAmount}`} />
            <Metric label="Pending Payout $" value={`$${analytics.pendingPayoutAmount}`} />
            <Metric label="Pending Payouts" value={String(analytics.pendingPayouts)} />
            <Metric label="Paid Payouts Count" value={String(analytics.paidPayouts)} />
          </Panel>

          <Panel title="Verification" eyebrow="Trust" icon="🛡️">
            <Metric label="Total Requests" value={String(verifications.length)} />
            <Metric label="Pending" value={String(analytics.pendingVerifications)} />
            <Metric label="Approved" value={String(analytics.approvedVerifications)} />
            <Metric label="Rejected" value={String(analytics.rejectedVerifications)} />
          </Panel>

          <Panel title="Reports" eyebrow="Safety" icon="🚨">
            <Metric label="Total Reports" value={String(reports.length)} />
            <Metric label="Open" value={String(analytics.openReports)} />
            <Metric label="Reviewing" value={String(analytics.reviewingReports)} />
            <Metric label="Resolved" value={String(analytics.resolvedReports)} />
            <Metric label="Urgent" value={String(analytics.urgentReports)} />
          </Panel>

          <Panel title="Platform Health" eyebrow="Executive" icon="📈">
            <Metric label="Completion Rate" value={`${completionRate}%`} />
            <Metric label="Cancellation Rate" value={`${cancellationRate}%`} />
            <Metric label="Driver Ratio" value={`${driverRatio}%`} />
            <Metric label="Platform Status" value="Live" />
          </Panel>

          <Panel title="Quick Access" eyebrow="Admin Tools" icon="⚡">
            <div className="quickLinks">
              <Link href="/admin/users">👥 Users</Link>
              <Link href="/admin/rides">🚘 Rides</Link>
              <Link href="/admin/bookings">🎟️ Bookings</Link>
              <Link href="/admin/payouts">🏦 Payouts</Link>
              <Link href="/admin/verifications">🛡️ Verifications</Link>
              <Link href="/admin/reports">🚨 Reports</Link>
              <Link href="/admin/messages">💬 Messages</Link>
              <Link href="/dashboard">🏠 Dashboard</Link>
            </div>
          </Panel>
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
        .kpi,
        .panel {
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
        .kpiValue,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0;
        }

        .subtitle {
          max-width: 780px;
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
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

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .kpi {
          position: relative;
          border-radius: 24px;
          padding: 20px;
          overflow: hidden;
        }

        .kpi.alert {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .kpiIcon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 14px;
        }

        .kpiLabel {
          display: block;
          color: #a1a1aa;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .kpiValue {
          display: block;
          font-size: 30px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .kpiDetail {
          display: block;
          color: #d4d4d8;
          font-size: 13px;
          margin-top: 8px;
        }

        .analyticsGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }

        .panel {
          border-radius: 28px;
          padding: 24px;
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .panelIcon {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
        }

        .metricList {
          display: grid;
          gap: 10px;
        }

        .metricRow {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .metricLabel {
          color: #a1a1aa;
          font-weight: 900;
          font-size: 13px;
        }

        .metricValue {
          font-weight: 900;
          overflow-wrap: anywhere;
          text-align: right;
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

        @media (max-width: 1000px) {
          .kpiGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .analyticsGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .kpiGrid {
            grid-template-columns: 1fr;
          }

          .panel {
            padding: 22px;
          }

          .quickLinks {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Kpi({
  icon,
  label,
  value,
  detail,
  alert,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  alert?: boolean;
}) {
  return (
    <div className={alert ? "kpi alert" : "kpi"}>
      <div className="kpiIcon">{icon}</div>
      <span className="kpiLabel">{label}</span>
      <strong className="kpiValue">{value}</strong>
      <span className="kpiDetail">{detail}</span>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>

        <div className="panelIcon">{icon}</div>
      </div>

      <div className="metricList">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metricRow">
      <span className="metricLabel">{label}</span>
      <strong className="metricValue">{value}</strong>
    </div>
  );
}
