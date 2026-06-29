"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserProfile = {
  id: string;
  email?: string;
  role?: string;
  admin?: boolean;
};

type Booking = {
  id: string;
  rideId?: string;
  driverId?: string;
  passengerId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  distanceMiles?: number;
  createdAt?: any;
  completedAt?: any;
};

type Ride = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  distanceMiles?: number;
  createdAt?: any;
};

type Payout = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  amount?: number;
  status?: string;
  createdAt?: any;
};

type Refund = {
  id: string;
  userEmail?: string;
  amount?: number;
  status?: string;
  createdAt?: any;
};

type RevenueRow = {
  id: string;
  driverEmail: string;
  passengerEmail: string;
  route: string;
  city: string;
  amount: number;
  platformFee: number;
  driverPayout: number;
  status: string;
  createdAt?: any;
};

export default function AdminRevenuePage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [message, setMessage] = useState("Loading revenue center...");

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

          const allowed =
            data.admin === true ||
            data.role === "admin" ||
            user.email === "jesusfernandez515@gmail.com";

          setMessage(allowed ? "" : "Access denied. Admin account required.");
        },
        (error) => setMessage(error.message)
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

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Booking[]);
      setMessage("");
    });

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Ride[]);
    });

    const unsubPayouts = onSnapshot(query(collection(db, "payoutRequests")), (snapshot) => {
      setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Payout[]);
    });

    const unsubRefunds = onSnapshot(query(collection(db, "refundRequests")), (snapshot) => {
      setRefunds(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Refund[]);
    });

    return () => {
      unsubBookings();
      unsubRides();
      unsubPayouts();
      unsubRefunds();
    };
  }, [adminAllowed]);

  function clean(value?: string) {
    return String(value || "").toLowerCase();
  }

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getDate(value?: any) {
    if (!value) return new Date(0);
    const date = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function isToday(value?: any) {
    const date = getDate(value);
    const now = new Date();
    return date.toDateString() === now.toDateString();
  }

  function isThisWeek(value?: any) {
    const date = getDate(value);
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 7);
    return date >= start && date <= now;
  }

  function isThisMonth(value?: any) {
    const date = getDate(value);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  function isThisYear(value?: any) {
    const date = getDate(value);
    const now = new Date();
    return date.getFullYear() === now.getFullYear();
  }

  function periodMatch(value?: any) {
    if (period === "today") return isToday(value);
    if (period === "week") return isThisWeek(value);
    if (period === "month") return isThisMonth(value);
    if (period === "year") return isThisYear(value);
    return true;
  }

  function formatDate(value?: any) {
    const date = getDate(value);
    if (date.getTime() === 0) return "Not available";
    return date.toLocaleString();
  }

  const revenue = useMemo(() => {
    const completedBookings = bookings.filter(
      (item) => clean(item.status) === "completed" && periodMatch(item.completedAt || item.createdAt)
    );

    const revenueRows: RevenueRow[] = completedBookings
      .map((booking) => {
        const amount = Number(booking.price || 0) * Number(booking.seatsBooked || 1);
        const platformFee = Number((amount * 0.12).toFixed(2));
        const driverPayout = Number((amount * 0.88).toFixed(2));
        const route = `${booking.from || "Origin"} → ${booking.to || "Destination"}`;
        const city = String(booking.from || "Unknown").split(",")[0] || "Unknown";

        return {
          id: booking.id,
          driverEmail: booking.driverEmail || "RoadLink Driver",
          passengerEmail: booking.passengerEmail || "RoadLink Passenger",
          route,
          city,
          amount,
          platformFee,
          driverPayout,
          status: booking.status || "completed",
          createdAt: booking.completedAt || booking.createdAt,
        };
      })
      .sort((a, b) => getDate(b.createdAt).getTime() - getDate(a.createdAt).getTime());

    const grossRevenue = revenueRows.reduce((total, item) => total + item.amount, 0);
    const platformRevenue = revenueRows.reduce((total, item) => total + item.platformFee, 0);
    const driverRevenue = revenueRows.reduce((total, item) => total + item.driverPayout, 0);

    const todayRevenue = bookings
      .filter((item) => clean(item.status) === "completed" && isToday(item.completedAt || item.createdAt))
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

    const weekRevenue = bookings
      .filter((item) => clean(item.status) === "completed" && isThisWeek(item.completedAt || item.createdAt))
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

    const monthRevenue = bookings
      .filter((item) => clean(item.status) === "completed" && isThisMonth(item.completedAt || item.createdAt))
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

    const yearRevenue = bookings
      .filter((item) => clean(item.status) === "completed" && isThisYear(item.completedAt || item.createdAt))
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

    const paidPayouts = payouts
      .filter((item) => clean(item.status) === "paid")
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const pendingPayouts = payouts
      .filter((item) => ["pending", "approved"].includes(clean(item.status)))
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const refundAmount = refunds
      .filter((item) => ["paid", "approved", "refunded"].includes(clean(item.status)))
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const netRevenue = platformRevenue - refundAmount;
    const averageBooking = revenueRows.length ? grossRevenue / revenueRows.length : 0;

    const cityRevenue = Object.entries(
      revenueRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.city] = (acc[row.city] || 0) + row.amount;
        return acc;
      }, {})
    )
      .map(([city, amount]) => ({ city, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    const routeRevenue = Object.entries(
      revenueRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.route] = (acc[row.route] || 0) + row.amount;
        return acc;
      }, {})
    )
      .map(([route, amount]) => ({ route, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    const driverLeaderboard = Object.entries(
      revenueRows.reduce<Record<string, { trips: number; amount: number; platformFee: number }>>(
        (acc, row) => {
          if (!acc[row.driverEmail]) acc[row.driverEmail] = { trips: 0, amount: 0, platformFee: 0 };
          acc[row.driverEmail].trips += 1;
          acc[row.driverEmail].amount += row.amount;
          acc[row.driverEmail].platformFee += row.platformFee;
          return acc;
        },
        {}
      )
    )
      .map(([driverEmail, data]) => ({ driverEmail, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const monthlyBuckets = Array.from({ length: 6 }).map((_, index) => {
      const now = new Date();
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const label = date.toLocaleString([], { month: "short" });

      const amount = bookings
        .filter((item) => {
          const itemDate = getDate(item.completedAt || item.createdAt);
          return (
            clean(item.status) === "completed" &&
            itemDate.getMonth() === date.getMonth() &&
            itemDate.getFullYear() === date.getFullYear()
          );
        })
        .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

      return { label, amount };
    });

    return {
      rows: revenueRows,
      grossRevenue,
      platformRevenue,
      driverRevenue,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      yearRevenue,
      paidPayouts,
      pendingPayouts,
      refundAmount,
      netRevenue,
      averageBooking,
      cityRevenue,
      routeRevenue,
      driverLeaderboard,
      monthlyBuckets,
      completedTrips: revenueRows.length,
      activeRides: rides.filter((item) => ["active", "full"].includes(clean(item.status))).length,
    };
  }, [bookings, payouts, refunds, rides, period]);

  const filteredRows = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return revenue.rows;

    return revenue.rows.filter(
      (item) =>
        item.id.toLowerCase().includes(value) ||
        item.driverEmail.toLowerCase().includes(value) ||
        item.passengerEmail.toLowerCase().includes(value) ||
        item.route.toLowerCase().includes(value) ||
        item.city.toLowerCase().includes(value) ||
        item.status.toLowerCase().includes(value)
    );
  }, [revenue.rows, search]);

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Revenue <span>Center</span></h1>
          <p>{message || "Checking admin access..."}</p>
          <Link href="/dashboard" className="navButton">Back to Dashboard</Link>
        </section>
        <Styles />
      </main>
    );
  }

  const maxMonth = Math.max(...revenue.monthlyBuckets.map((item) => item.amount), 1);
  const maxCity = Math.max(...revenue.cityRevenue.map((item) => item.amount), 1);
  const maxRoute = Math.max(...revenue.routeRevenue.map((item) => item.amount), 1);

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/admin-console" className="navButton">← Admin Console</Link>
          <Link href="/admin/finance" className="navButton">Finance</Link>
          <Link href="/admin/invoices" className="navButton">Invoices</Link>
          <Link href="/admin/pricing" className="navButton">Pricing</Link>
          <Link href="/admin/analytics" className="navButton">Analytics</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Revenue Intelligence</p>
            <h1>Revenue <span>Center</span></h1>
            <p className="subtitle">
              Track gross revenue, RoadLink commissions, driver payouts, refunds, top routes,
              top cities and revenue performance by period.
            </p>
          </div>

          <div className={revenue.netRevenue >= 0 ? "revenueOrb" : "revenueOrb dangerOrb"}>
            <strong>{money(revenue.netRevenue)}</strong>
            <span>Net Revenue</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="controls">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Revenue Period</h2>
          </div>

          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search driver, passenger, route, city or booking ID..."
          />
        </section>

        <section className="stats">
          <Metric icon="💰" label="Gross Revenue" value={money(revenue.grossRevenue)} />
          <Metric icon="🏛️" label="RoadLink Revenue" value={money(revenue.platformRevenue)} />
          <Metric icon="🚗" label="Driver Revenue" value={money(revenue.driverRevenue)} />
          <Metric icon="📈" label="Net Revenue" value={money(revenue.netRevenue)} />
          <Metric icon="📅" label="Today" value={money(revenue.todayRevenue)} />
          <Metric icon="📆" label="Week" value={money(revenue.weekRevenue)} />
          <Metric icon="🗓️" label="Month" value={money(revenue.monthRevenue)} />
          <Metric icon="📊" label="Year" value={money(revenue.yearRevenue)} />
          <Metric icon="🔄" label="Refunds" value={money(revenue.refundAmount)} />
          <Metric icon="🏦" label="Paid Payouts" value={money(revenue.paidPayouts)} />
          <Metric icon="⏳" label="Pending Payouts" value={money(revenue.pendingPayouts)} />
          <Metric icon="🎟️" label="Avg Booking" value={money(revenue.averageBooking)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Growth</p>
            <h2>Monthly Revenue</h2>

            {revenue.monthlyBuckets.map((item) => (
              <Bar key={item.label} label={item.label} value={item.amount} max={maxMonth} />
            ))}
          </section>

          <section className="panel">
            <p className="eyebrow">City Revenue</p>
            <h2>Top Origin Cities</h2>

            {revenue.cityRevenue.length === 0 ? (
              <Empty text="No city revenue yet." />
            ) : (
              revenue.cityRevenue.map((item) => (
                <Bar key={item.city} label={item.city} value={item.amount} max={maxCity} />
              ))
            )}
          </section>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Top Routes</p>
            <h2>Most Profitable Routes</h2>

            {revenue.routeRevenue.length === 0 ? (
              <Empty text="No route revenue yet." />
            ) : (
              revenue.routeRevenue.map((item) => (
                <Bar key={item.route} label={item.route} value={item.amount} max={maxRoute} />
              ))
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Top Drivers</p>
            <h2>Driver Revenue Leaders</h2>

            {revenue.driverLeaderboard.length === 0 ? (
              <Empty text="No driver revenue yet." />
            ) : (
              <div className="rankList">
                {revenue.driverLeaderboard.map((driver, index) => (
                  <article key={driver.driverEmail} className="rankItem">
                    <div className="rankNumber">#{index + 1}</div>

                    <div>
                      <strong>{driver.driverEmail}</strong>
                      <p>{driver.trips} completed trips</p>
                    </div>

                    <span>{money(driver.amount)}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="panel">
          <div className="sectionTop">
            <div>
              <p className="eyebrow">Revenue Rows</p>
              <h2>{filteredRows.length} Completed Revenue Records</h2>
            </div>

            <div className="exportBox">
              <strong>Export Ready</strong>
              <span>CSV / PDF / Excel prepared</span>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <Empty text="No revenue records found." />
          ) : (
            <div className="revenueList">
              {filteredRows.slice(0, 100).map((row) => (
                <article key={row.id} className="revenueRow">
                  <div className="rowIcon">💰</div>

                  <div>
                    <h3>{row.route}</h3>
                    <p>Driver: {row.driverEmail}</p>
                    <small>Passenger: {row.passengerEmail}</small>
                    <small>{formatDate(row.createdAt)}</small>
                  </div>

                  <div className="rowMoney">
                    <strong>{money(row.amount)}</strong>
                    <span>Fee {money(row.platformFee)}</span>
                    <small>Driver {money(row.driverPayout)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <Styles />
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

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(4, Math.min(100, Math.round((value / max) * 100)));

  return (
    <div className="barRow">
      <div className="barTop">
        <span>{label}</span>
        <strong>${Number(value || 0).toFixed(2)}</strong>
      </div>

      <div className="bar">
        <div style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <h3>No data</h3>
      <p>{text}</p>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .page {
        min-height: 100vh;
        padding: 24px;
        padding-bottom: 130px;
        color: white;
        font-family: Arial, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 35%),
          radial-gradient(circle at bottom left, rgba(59,130,246,0.14), transparent 35%),
          linear-gradient(135deg, #020617, #030712, #0f172a);
      }

      .container {
        max-width: 1240px;
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
      }

      .hero,
      .metric,
      .panel,
      .controls,
      .revenueRow,
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
      .revenueOrb strong,
      .rowMoney strong,
      .rankItem span {
        color: #22c55e;
      }

      .subtitle,
      .empty p,
      .locked p,
      .rankItem p,
      .revenueRow p,
      .revenueRow small {
        color: #a1a1aa;
        max-width: 780px;
        line-height: 1.5;
        font-size: 18px;
        margin: 0;
      }

      .revenueOrb {
        min-width: 140px;
        height: 140px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        text-align: center;
        padding: 14px;
      }

      .dangerOrb {
        background: rgba(239,68,68,0.13);
        border-color: rgba(239,68,68,0.35);
      }

      .dangerOrb strong {
        color: #fca5a5;
      }

      .revenueOrb strong {
        font-size: 22px;
      }

      .revenueOrb span {
        color: #d4d4d8;
        font-weight: 900;
        font-size: 12px;
      }

      .message {
        color: #22c55e;
        text-align: center;
        font-weight: 900;
      }

      .controls {
        border-radius: 30px;
        padding: 22px;
        margin-bottom: 20px;
        display: grid;
        grid-template-columns: 1fr 220px 1.5fr;
        gap: 14px;
        align-items: center;
      }

      input,
      select {
        width: 100%;
        padding: 15px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: white;
        font-size: 16px;
        outline: none;
      }

      option {
        color: black;
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
        margin-bottom: 20px;
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

      .barTop span {
        color: #a1a1aa;
        font-weight: 900;
        overflow-wrap: anywhere;
      }

      .barTop strong {
        color: #e5e7eb;
        white-space: nowrap;
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

      .rankList {
        display: grid;
        gap: 12px;
      }

      .rankItem {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .rankNumber {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #22c55e;
        font-weight: 900;
      }

      .sectionTop {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        margin-bottom: 18px;
      }

      .exportBox {
        padding: 12px 16px;
        border-radius: 18px;
        background: rgba(34,197,94,0.1);
        border: 1px solid rgba(34,197,94,0.3);
      }

      .exportBox strong {
        color: #22c55e;
        display: block;
      }

      .exportBox span {
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 900;
      }

      .revenueList {
        display: grid;
        gap: 12px;
      }

      .revenueRow {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 14px;
        align-items: center;
        padding: 16px;
        border-radius: 20px;
        box-shadow: none;
      }

      .rowIcon {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(34,197,94,0.13);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }

      .revenueRow h3 {
        margin: 0 0 5px;
        overflow-wrap: anywhere;
      }

      .revenueRow small {
        display: block;
        font-size: 13px;
      }

      .rowMoney {
        text-align: right;
      }

      .rowMoney strong,
      .rowMoney span,
      .rowMoney small {
        display: block;
      }

      .rowMoney span {
        color: #d4d4d8;
        font-weight: 900;
        margin-top: 5px;
      }

      .empty {
        min-height: 180px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        border-radius: 20px;
        padding: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .empty h3 {
        margin: 0 0 8px;
      }

      @media (max-width: 1050px) {
        .hero,
        .controls,
        .grid,
        .sectionTop {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: flex-start;
        }

        .stats {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 44px;
        }
      }

      @media (max-width: 600px) {
        .page {
          padding: 16px;
          padding-bottom: 120px;
        }

        .hero,
        .panel,
        .controls {
          padding: 22px;
          border-radius: 26px;
        }

        .revenueRow,
        .rankItem {
          grid-template-columns: 1fr;
        }

        .rowMoney {
          text-align: left;
        }
      }
    `}</style>
  );
      }
