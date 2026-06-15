"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type BookingItem = {
  id: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  driverEmail?: string;
  passengerEmail?: string;
  from?: string;
  to?: string;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
  driverEmail?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  driverEmail?: string;
  createdAt?: string;
};

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
  createdAt?: string;
};

export default function AdminRevenuePage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [message, setMessage] = useState("Loading revenue center...");

  useEffect(() => {
    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, "payoutRequests")),
      (snapshot) => {
        setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PayoutItem[]);
      },
      () => setPayouts([])
    );

    const unsubRides = onSnapshot(
      query(collection(db, "rides")),
      (snapshot) => {
        setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
      },
      () => setRides([])
    );

    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
      },
      () => setUsers([])
    );

    return () => {
      unsubBookings();
      unsubPayouts();
      unsubRides();
      unsubUsers();
    };
  }, []);

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function bookingValue(booking: BookingItem) {
    return Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1);
  }

  function validDate(value?: string) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  function isToday(value?: string) {
    const date = validDate(value);
    if (!date) return false;

    const now = new Date();

    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  function isThisWeek(value?: string) {
    const date = validDate(value);
    if (!date) return false;

    const now = new Date();
    const diff = now.getTime() - date.getTime();

    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }

  function isThisMonth(value?: string) {
    const date = validDate(value);
    if (!date) return false;

    const now = new Date();

    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  function isThisYear(value?: string) {
    const date = validDate(value);
    if (!date) return false;

    return date.getFullYear() === new Date().getFullYear();
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

  function shortText(value?: string, max = 34) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  const revenue = useMemo(() => {
    const completedBookings = bookings.filter((item) => item.status === "completed");
    const confirmedBookings = bookings.filter((item) => item.status === "confirmed");
    const reservedBookings = bookings.filter((item) => item.status === "reserved");
    const pendingBookings = bookings.filter((item) => item.status === "pending");
    const cancelledBookings = bookings.filter(
      (item) => item.status === "cancelled" || item.status === "rejected"
    );

    const grossRevenue = completedBookings.reduce((total, item) => total + bookingValue(item), 0);
    const confirmedValue = confirmedBookings.reduce((total, item) => total + bookingValue(item), 0);
    const reservedValue = reservedBookings.reduce((total, item) => total + bookingValue(item), 0);
    const pendingValue = pendingBookings.reduce((total, item) => total + bookingValue(item), 0);

    const todayRevenue = completedBookings
      .filter((item) => isToday(item.createdAt))
      .reduce((total, item) => total + bookingValue(item), 0);

    const weekRevenue = completedBookings
      .filter((item) => isThisWeek(item.createdAt))
      .reduce((total, item) => total + bookingValue(item), 0);

    const monthRevenue = completedBookings
      .filter((item) => isThisMonth(item.createdAt))
      .reduce((total, item) => total + bookingValue(item), 0);

    const yearRevenue = completedBookings
      .filter((item) => isThisYear(item.createdAt))
      .reduce((total, item) => total + bookingValue(item), 0);

    const roadLinkFeeRate = 0.12;
    const roadLinkRevenue = grossRevenue * roadLinkFeeRate;
    const driverRevenue = Math.max(grossRevenue - roadLinkRevenue, 0);

    const pendingPayouts = payouts.filter(
      (item) => item.status === "pending" || item.status === "approved"
    );

    const paidPayouts = payouts.filter((item) => item.status === "paid");
    const rejectedPayouts = payouts.filter((item) => item.status === "rejected");

    const pendingPayoutAmount = pendingPayouts.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const paidPayoutAmount = paidPayouts.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const averageBooking =
      completedBookings.length > 0 ? grossRevenue / completedBookings.length : 0;

    const estimatedAnnualRevenue =
      monthRevenue > 0 ? monthRevenue * 12 : weekRevenue > 0 ? weekRevenue * 52 : grossRevenue;

    const completionRate =
      bookings.length > 0 ? Math.round((completedBookings.length / bookings.length) * 100) : 0;

    const cancellationRate =
      bookings.length > 0 ? Math.round((cancelledBookings.length / bookings.length) * 100) : 0;

    let financialScore = 100;

    if (grossRevenue === 0) financialScore -= 20;
    if (pendingPayoutAmount > roadLinkRevenue && grossRevenue > 0) financialScore -= 20;
    if (cancellationRate > 20) financialScore -= 15;
    if (pendingBookings.length > completedBookings.length && bookings.length > 0) financialScore -= 10;

    return {
      completedBookings,
      confirmedBookings,
      reservedBookings,
      pendingBookings,
      cancelledBookings,
      grossRevenue,
      confirmedValue,
      reservedValue,
      pendingValue,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      yearRevenue,
      roadLinkRevenue,
      driverRevenue,
      pendingPayouts,
      paidPayouts,
      rejectedPayouts,
      pendingPayoutAmount,
      paidPayoutAmount,
      averageBooking,
      estimatedAnnualRevenue,
      completionRate,
      cancellationRate,
      financialScore: Math.max(financialScore, 0),
    };
  }, [bookings, payouts]);

  const topDrivers = useMemo(() => {
    const map = new Map<string, { email: string; revenue: number; bookings: number }>();

    revenue.completedBookings.forEach((booking) => {
      const email = booking.driverEmail || "Unknown Driver";
      const current = map.get(email) || { email, revenue: 0, bookings: 0 };

      current.revenue += bookingValue(booking);
      current.bookings += 1;

      map.set(email, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [revenue.completedBookings]);

  const topRoutes = useMemo(() => {
    const map = new Map<string, { route: string; revenue: number; rides: number }>();

    bookings.forEach((booking) => {
      const route = `${booking.from || "Origin"} → ${booking.to || "Destination"}`;
      const current = map.get(route) || { route, revenue: 0, rides: 0 };

      current.revenue += bookingValue(booking);
      current.rides += 1;

      map.set(route, current);
    });

    rides.forEach((ride) => {
      if (!ride.from && !ride.to) return;

      const route = `${ride.from || "Origin"} → ${ride.to || "Destination"}`;
      const current = map.get(route) || { route, revenue: 0, rides: 0 };

      current.rides += 1;

      map.set(route, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue || b.rides - a.rides)
      .slice(0, 5);
  }, [bookings, rides]);

  const latestPayouts = useMemo(() => {
    return [...payouts]
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.updatedAt || 0).getTime() -
          new Date(a.createdAt || a.updatedAt || 0).getTime()
      )
      .slice(0, 5);
  }, [payouts]);

  const verifiedDrivers = users.filter((user) => user.driverVerified || user.verified).length;

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/live" className="miniButton">Live</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin Finance</p>
            <h1>Revenue <span>Center</span></h1>
            <p className="subtitle">
              Track gross revenue, RoadLink fees, driver earnings, payouts and financial health.
            </p>
          </div>

          <div className={revenue.financialScore < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{revenue.financialScore}</strong>
            <span>Finance</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💰" label="Gross Revenue" value={money(revenue.grossRevenue)} />
          <Metric icon="🏦" label="RoadLink Fees" value={money(revenue.roadLinkRevenue)} />
          <Metric icon="🚘" label="Driver Earnings" value={money(revenue.driverRevenue)} />
          <Metric icon="📅" label="This Month" value={money(revenue.monthRevenue)} />
          <Metric icon="⏳" label="Pending Payouts" value={money(revenue.pendingPayoutAmount)} danger={revenue.pendingPayoutAmount > 0} />
          <Metric icon="✅" label="Paid Out" value={money(revenue.paidPayoutAmount)} />
        </section>

        <section className="gridTwo">
          <Panel title="Revenue Timeline" eyebrow="Performance" icon="📈">
            <Info label="Today" value={money(revenue.todayRevenue)} />
            <Info label="This Week" value={money(revenue.weekRevenue)} />
            <Info label="This Month" value={money(revenue.monthRevenue)} />
            <Info label="This Year" value={money(revenue.yearRevenue)} />
            <Info label="Estimated Annual Revenue" value={money(revenue.estimatedAnnualRevenue)} />
          </Panel>

          <Panel title="Booking Value" eyebrow="Sales" icon="🎟️">
            <Info label="Completed Bookings" value={String(revenue.completedBookings.length)} />
            <Info label="Confirmed Bookings" value={String(revenue.confirmedBookings.length)} />
            <Info label="Reserved Value" value={money(revenue.reservedValue)} />
            <Info label="Pending Value" value={money(revenue.pendingValue)} />
            <Info label="Average Booking" value={money(revenue.averageBooking)} />
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Financial Health" eyebrow="Executive" icon="🧠">
            <Info label="Completion Rate" value={`${revenue.completionRate}%`} />
            <Info label="Cancellation Rate" value={`${revenue.cancellationRate}%`} />
            <Info label="Verified Drivers" value={String(verifiedDrivers)} />
            <Info label="Pending Payout Count" value={String(revenue.pendingPayouts.length)} />
            <Info label="Rejected Payouts" value={String(revenue.rejectedPayouts.length)} />
          </Panel>

          <Panel title="Payout Stream" eyebrow="Driver Money" icon="🏦" danger={revenue.pendingPayouts.length > 0}>
            {latestPayouts.length === 0 ? (
              <div className="empty">
                <h3>No payout requests</h3>
                <p>Driver payout requests will appear here.</p>
              </div>
            ) : (
              <div className="list">
                {latestPayouts.map((payout) => (
                  <Link href="/admin/payouts" key={payout.id} className="row linkRow">
                    <div className="rowIcon">🏦</div>
                    <div className="rowText">
                      <strong>{shortText(payout.driverEmail || payout.email || "Driver payout")}</strong>
                      <span>{payout.status || "pending"} • {timeAgo(payout.createdAt || payout.updatedAt)}</span>
                    </div>
                    <em>{money(Number(payout.amount || 0))}</em>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <section className="gridTwo">
          <Panel title="Top Drivers" eyebrow="Earnings" icon="🏆">
            {topDrivers.length === 0 ? (
              <div className="empty">
                <h3>No driver revenue yet</h3>
                <p>Top drivers will appear after completed bookings.</p>
              </div>
            ) : (
              <div className="list">
                {topDrivers.map((driver) => (
                  <div className="row" key={driver.email}>
                    <div className="rowIcon">🚘</div>
                    <div className="rowText">
                      <strong>{shortText(driver.email)}</strong>
                      <span>{driver.bookings} completed booking{driver.bookings === 1 ? "" : "s"}</span>
                    </div>
                    <em>{money(driver.revenue)}</em>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Top Routes" eyebrow="Demand" icon="🗺️">
            {topRoutes.length === 0 ? (
              <div className="empty">
                <h3>No route revenue yet</h3>
                <p>Top routes will appear after bookings or rides are created.</p>
              </div>
            ) : (
              <div className="list">
                {topRoutes.map((route) => (
                  <div className="row" key={route.route}>
                    <div className="rowIcon">🗺️</div>
                    <div className="rowText">
                      <strong>{shortText(route.route, 42)}</strong>
                      <span>{route.rides} activity record{route.rides === 1 ? "" : "s"}</span>
                    </div>
                    <em>{money(route.revenue)}</em>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <section className="quickCard">
          <p className="eyebrow">Financial Operations</p>
          <h2>Quick Actions</h2>

          <div className="quickLinks">
            <Link href="/admin/payouts">🏦 Manage Payouts</Link>
            <Link href="/admin/bookings">🎟️ View Bookings</Link>
            <Link href="/admin/rides">🚘 View Rides</Link>
            <Link href="/admin/analytics">📊 Analytics</Link>
            <Link href="/admin/live">🟢 Live Center</Link>
            <Link href="/admin/users">👥 Users</Link>
            <Link href="/admin/activity">📡 Activity</Link>
            <Link href="/admin">⚙️ Admin Home</Link>
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
            radial-gradient(circle at bottom left, rgba(245,158,11,0.12), transparent 36%),
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

        .subtitle {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.45;
          margin: 0;
        }

        .scoreOrb {
          min-width: 74px;
          width: 74px;
          height: 74px;
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
          font-size: 24px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fde68a;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 9px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
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
          font-size: 20px;
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

        .infoStack,
        .list {
          display: grid;
          gap: 8px;
        }

        .infoBox,
        .row {
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

        .row {
          display: grid;
          grid-template-columns: 40px 1fr auto;
          gap: 10px;
          color: white;
          text-decoration: none;
          align-items: center;
        }

        .linkRow {
          cursor: pointer;
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

        .row em {
          color: #22c55e;
          font-weight: 900;
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
            grid-template-columns: repeat(3, minmax(0, 1fr));
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
