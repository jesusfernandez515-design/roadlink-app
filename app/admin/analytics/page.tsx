"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  verified?: boolean;
  driverVerified?: boolean;
  suspended?: boolean;
  createdAt?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
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

type EmergencyAlert = {
  id: string;
  status?: string;
  priority?: string;
  userEmail?: string;
  createdAt?: string;
};

type ActivityItem = {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  createdAt?: string;
};

export default function AdminAnalyticsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [message, setMessage] = useState("Loading analytics...");

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
      (error) => setMessage(error.message)
    );

    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, "payoutRequests")),
      (snapshot) => {
        setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PayoutItem[]);
      },
      (error) => setMessage(error.message)
    );

    const unsubVerifications = onSnapshot(
      query(collection(db, "driverVerifications")),
      (snapshot) => {
        setVerifications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as VerificationItem[]);
      },
      () => setVerifications([])
    );

    const unsubReports = onSnapshot(
      query(collection(db, "reports")),
      (snapshot) => {
        setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
      },
      () => setReports([])
    );

    const unsubEmergencies = onSnapshot(
      query(collection(db, "emergencyAlerts")),
      (snapshot) => {
        setEmergencies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as EmergencyAlert[]);
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
      unsubPayouts();
      unsubVerifications();
      unsubReports();
      unsubEmergencies();
      unsubActivities();
    };
  }, []);

  function isThisMonth(value?: string) {
    if (!value) return false;
    const date = new Date(value);
    const now = new Date();

    if (Number.isNaN(date.getTime())) return false;

    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

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

  function activityIcon(type?: string) {
    if (type === "user") return "👥";
    if (type === "ride") return "🚘";
    if (type === "booking") return "🎟️";
    if (type === "message") return "💬";
    if (type === "payout") return "🏦";
    if (type === "verification") return "🛡️";
    if (type === "report") return "⚠️";
    if (type === "sos") return "🚨";
    return "📡";
  }

  const analytics = useMemo(() => {
    const verifiedDrivers = users.filter((user) => user.driverVerified || user.verified).length;
    const suspendedUsers = users.filter((user) => user.suspended).length;
    const newUsersThisMonth = users.filter((user) => isThisMonth(user.createdAt)).length;

    const activeRides = rides.filter((ride) => ride.status === "active" || ride.status === "open").length;
    const completedRides = rides.filter((ride) => ride.status === "completed").length;
    const cancelledRides = rides.filter((ride) => ride.status === "cancelled").length;

    const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed").length;
    const completedBookings = bookings.filter((booking) => booking.status === "completed").length;
    const cancelledBookings = bookings.filter(
      (booking) => booking.status === "cancelled" || booking.status === "rejected"
    ).length;

    const completedRevenue = bookings
      .filter((booking) => booking.status === "completed")
      .reduce((total, booking) => {
        return total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1);
      }, 0);

    const roadLinkFees = Math.round(completedRevenue * 0.12);
    const driverRevenue = Math.max(completedRevenue - roadLinkFees, 0);

    const pendingPayouts = payouts.filter(
      (payout) => payout.status === "pending" || payout.status === "approved"
    ).length;

    const pendingPayoutAmount = payouts
      .filter((payout) => payout.status === "pending" || payout.status === "approved")
      .reduce((total, payout) => total + Number(payout.amount || 0), 0);

    const paidOutAmount = payouts
      .filter((payout) => payout.status === "paid")
      .reduce((total, payout) => total + Number(payout.amount || 0), 0);

    const pendingVerifications = verifications.filter((item) => item.status === "pending").length;
    const approvedVerifications = verifications.filter((item) => item.status === "approved").length;
    const rejectedVerifications = verifications.filter((item) => item.status === "rejected").length;

    const openReports = reports.filter((report) => !report.status || report.status === "open").length;
    const reviewingReports = reports.filter((report) => report.status === "reviewing").length;
    const resolvedReports = reports.filter((report) => report.status === "resolved").length;
    const urgentReports = reports.filter((report) => report.priority === "urgent").length;

    const activeSOS = emergencies.filter((item) => item.status === "active").length;
    const criticalSOS = emergencies.filter((item) => item.priority === "critical").length;

    const completionRate =
      bookings.length > 0 ? Math.round((completedBookings / bookings.length) * 100) : 0;

    const cancellationRate =
      bookings.length > 0 ? Math.round((cancelledBookings / bookings.length) * 100) : 0;

    const driverRatio =
      users.length > 0 ? Math.round((verifiedDrivers / users.length) * 100) : 0;

    let healthScore = 100;
    if (activeSOS > 0) healthScore -= 20;
    if (urgentReports > 0) healthScore -= Math.min(15, urgentReports * 5);
    if (cancelledBookings > 0) healthScore -= Math.min(15, cancelledBookings * 3);
    if (suspendedUsers > 0) healthScore -= Math.min(15, suspendedUsers * 3);
    if (pendingVerifications > 0) healthScore -= Math.min(10, pendingVerifications * 2);

    return {
      verifiedDrivers,
      suspendedUsers,
      newUsersThisMonth,
      activeRides,
      completedRides,
      cancelledRides,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      completedRevenue,
      roadLinkFees,
      driverRevenue,
      pendingPayouts,
      pendingPayoutAmount,
      paidOutAmount,
      pendingVerifications,
      approvedVerifications,
      rejectedVerifications,
      openReports,
      reviewingReports,
      resolvedReports,
      urgentReports,
      activeSOS,
      criticalSOS,
      completionRate,
      cancellationRate,
      driverRatio,
      healthScore: Math.max(healthScore, 0),
    };
  }, [users, rides, bookings, payouts, verifications, reports, emergencies]);

  const topRoutes = useMemo(() => {
    const map = new Map<string, number>();

    rides.forEach((ride) => {
      const from = ride.from || "Unknown";
      const to = ride.to || "Unknown";
      const route = `${from} → ${to}`;
      map.set(route, (map.get(route) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [rides]);

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/rides" className="miniButton">Rides</Link>
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Analytics <span>Dashboard</span></h1>
            <p className="subtitle">
              Monitor growth, bookings, revenue, safety, payouts and live platform activity.
            </p>
          </div>

          <div className={analytics.healthScore < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{analytics.healthScore}</strong>
            <span>Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="kpiGrid">
          <Metric icon="👥" label="Users" value={String(users.length)} detail={`${analytics.newUsersThisMonth} new this month`} />
          <Metric icon="🚘" label="Rides" value={String(rides.length)} detail={`${analytics.activeRides} active`} />
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} detail={`${analytics.completionRate}% completed`} />
          <Metric icon="💰" label="Revenue" value={money(analytics.completedRevenue)} detail={`${money(analytics.roadLinkFees)} RoadLink`} />
          <Metric icon="🏦" label="Payouts" value={money(analytics.paidOutAmount)} detail={`${money(analytics.pendingPayoutAmount)} pending`} />
          <Metric icon="🛡️" label="Drivers" value={String(analytics.verifiedDrivers)} detail={`${analytics.driverRatio}% verified`} />
          <Metric icon="🚨" label="SOS" value={String(analytics.activeSOS)} detail={`${analytics.criticalSOS} critical`} danger={analytics.activeSOS > 0} />
          <Metric icon="⚠️" label="Reports" value={String(analytics.openReports)} detail={`${analytics.urgentReports} urgent`} danger={analytics.openReports > 0} />
        </section>

        <section className="gridTwo">
          <Panel title="Live Platform Activity" eyebrow="Realtime" icon="📡">
            {activities.length === 0 ? (
              <div className="empty">
                <h3>No activity yet</h3>
                <p>Realtime platform events will appear here.</p>
              </div>
            ) : (
              <div className="activityList">
                {activities.map((activity) => (
                  <div className="activityRow" key={activity.id}>
                    <div className="activityIcon">{activityIcon(activity.type)}</div>
                    <div>
                      <strong>{activity.title || "RoadLink Activity"}</strong>
                      <span>{activity.description || activity.type || "Platform update"}</span>
                    </div>
                    <em>{timeAgo(activity.createdAt)}</em>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Admin Alerts" eyebrow="Priority" icon="🚨" danger>
            <div className="alertStack">
              <AdminAlert label="Active SOS Alerts" value={analytics.activeSOS} href="/admin/emergency" danger={analytics.activeSOS > 0} />
              <AdminAlert label="Pending Payouts" value={analytics.pendingPayouts} href="/admin/payouts" danger={analytics.pendingPayouts > 0} />
              <AdminAlert label="Pending Verifications" value={analytics.pendingVerifications} href="/admin/verifications" danger={analytics.pendingVerifications > 0} />
              <AdminAlert label="Urgent Reports" value={analytics.urgentReports} href="/admin/reports" danger={analytics.urgentReports > 0} />
            </div>
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Revenue Center" eyebrow="Money" icon="💵">
            <Info label="Completed Revenue" value={money(analytics.completedRevenue)} />
            <Info label="RoadLink Revenue" value={money(analytics.roadLinkFees)} />
            <Info label="Driver Revenue" value={money(analytics.driverRevenue)} />
            <Info label="Paid Payouts" value={money(analytics.paidOutAmount)} />
            <Info label="Pending Payouts" value={money(analytics.pendingPayoutAmount)} />
          </Panel>

          <Panel title="Platform Health" eyebrow="Executive" icon="📈">
            <Info label="Completion Rate" value={`${analytics.completionRate}%`} />
            <Info label="Cancellation Rate" value={`${analytics.cancellationRate}%`} />
            <Info label="Driver Ratio" value={`${analytics.driverRatio}%`} />
            <Info label="Suspended Users" value={String(analytics.suspendedUsers)} />
            <Info label="Health Status" value={analytics.healthScore >= 85 ? "Excellent" : analytics.healthScore >= 70 ? "Watch" : "Risk"} />
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Bookings" eyebrow="Reservations" icon="🎟️">
            <Info label="Confirmed" value={String(analytics.confirmedBookings)} />
            <Info label="Completed" value={String(analytics.completedBookings)} />
            <Info label="Cancelled" value={String(analytics.cancelledBookings)} />
          </Panel>

          <Panel title="Trust & Safety" eyebrow="Operations" icon="🛡️">
            <Info label="Pending Verifications" value={String(analytics.pendingVerifications)} />
            <Info label="Approved Verifications" value={String(analytics.approvedVerifications)} />
            <Info label="Rejected Verifications" value={String(analytics.rejectedVerifications)} />
            <Info label="Open Reports" value={String(analytics.openReports)} />
            <Info label="Reviewing Reports" value={String(analytics.reviewingReports)} />
            <Info label="Resolved Reports" value={String(analytics.resolvedReports)} />
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Top Routes" eyebrow="Demand" icon="🗺️">
            {topRoutes.length === 0 ? (
              <div className="empty">
                <h3>No routes yet</h3>
                <p>Popular routes will appear when drivers publish rides.</p>
              </div>
            ) : (
              <div className="routeList">
                {topRoutes.map((item) => (
                  <div className="routeRow" key={item.route}>
                    <span>{item.route}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Quick Access" eyebrow="Admin Tools" icon="⚡">
            <div className="quickLinks">
              <Link href="/admin/users">👥 Users</Link>
              <Link href="/admin/rides">🚘 Rides</Link>
              <Link href="/admin/payouts">🏦 Payouts</Link>
              <Link href="/admin/verifications">🛡️ Verifications</Link>
              <Link href="/admin/reports">⚠️ Reports</Link>
              <Link href="/admin/emergency">🚨 SOS</Link>
              <Link href="/admin/fraud">🕵️ Fraud</Link>
              <Link href="/dashboard">🏠 Dashboard</Link>
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
          padding: 14px;
          padding-bottom: 150px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 32%),
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
        .panel {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 16px 44px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 26px;
          padding: 22px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          gap: 18px;
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
          font-size: 42px;
          line-height: 0.98;
          margin: 0 0 10px;
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 14px;
          line-height: 1.45;
          margin: 0;
        }

        .scoreOrb {
          min-width: 92px;
          height: 92px;
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
          font-size: 30px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fde68a;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .metric {
          border-radius: 18px;
          padding: 13px;
          min-height: 94px;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .metricIcon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          margin-bottom: 8px;
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
          margin-bottom: 5px;
        }

        .metricValue {
          display: block;
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .metricDetail {
          display: block;
          color: #d4d4d8;
          font-size: 11px;
          margin-top: 6px;
        }

        .gridTwo {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .panel {
          border-radius: 22px;
          padding: 18px;
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
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .panel h2 {
          font-size: 24px;
          margin: 0;
        }

        .panelIcon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .infoStack,
        .alertStack,
        .routeList,
        .activityList {
          display: grid;
          gap: 9px;
        }

        .infoBox,
        .routeRow,
        .activityRow,
        .adminAlert {
          padding: 12px;
          border-radius: 14px;
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

        .activityRow {
          display: grid;
          grid-template-columns: 38px 1fr auto;
          gap: 10px;
          align-items: center;
        }

        .activityIcon {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .activityRow strong,
        .activityRow span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .activityRow span,
        .activityRow em {
          color: #a1a1aa;
          font-size: 11px;
          font-style: normal;
        }

        .adminAlert {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .adminAlertDanger {
          border-color: rgba(239,68,68,0.4);
          background: rgba(239,68,68,0.12);
        }

        .adminAlert strong {
          color: #22c55e;
          font-size: 20px;
        }

        .adminAlertDanger strong {
          color: #ef4444;
        }

        .routeRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .routeRow span {
          color: #d4d4d8;
          font-size: 13px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .routeRow strong {
          color: #22c55e;
          font-size: 18px;
          font-weight: 900;
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

        @media (max-width: 980px) {
          .kpiGrid,
          .gridTwo {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .page {
            padding: 12px;
            padding-bottom: 150px;
          }

          .hero {
            align-items: flex-start;
            padding: 18px;
          }

          h1 {
            font-size: 30px;
          }

          .subtitle {
            font-size: 13px;
          }

          .scoreOrb {
            min-width: 68px;
            width: 68px;
            height: 68px;
          }

          .scoreOrb strong {
            font-size: 22px;
          }

          .kpiGrid,
          .gridTwo {
            grid-template-columns: 1fr;
          }

          .metric {
            min-height: 72px;
            display: grid;
            grid-template-columns: 38px 1fr auto;
            align-items: center;
            gap: 10px;
          }

          .metricIcon {
            margin-bottom: 0;
          }

          .metricDetail {
            grid-column: 2 / -1;
            margin-top: -6px;
          }

          .activityRow {
            grid-template-columns: 38px 1fr;
          }

          .activityRow em {
            grid-column: 2;
          }

          .quickLinks {
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
  detail,
  danger,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "metric dangerMetric" : "metric"}>
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <strong className="metricValue">{value}</strong>
      <span className="metricDetail">{detail}</span>
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

function AdminAlert({
  label,
  value,
  href,
  danger,
}: {
  label: string;
  value: number;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link href={href} className={danger ? "adminAlert adminAlertDanger" : "adminAlert"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}
