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
  name?: string;
  role?: string;
  admin?: boolean;
  online?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  createdAt?: any;
};

type Ride = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  seats?: number;
  distanceMiles?: number;
  createdAt?: any;
};

type Booking = {
  id: string;
  rideId?: string;
  driverId?: string;
  passengerId?: string;
  driverEmail?: string;
  passengerEmail?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  distanceMiles?: number;
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
  driverId?: string;
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

type BusinessAccount = {
  id: string;
  companyName?: string;
  ownerEmail?: string;
  employees?: number;
  monthlyBudget?: number;
  createdAt?: any;
};

type FleetVehicle = {
  id: string;
  name?: string;
  ownerEmail?: string;
  status?: string;
  mileage?: number;
  fuelCost?: number;
  createdAt?: any;
};

export default function AdminEnterpriseAnalyticsPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [businesses, setBusinesses] = useState<BusinessAccount[]>([]);
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [status, setStatus] = useState("Loading enterprise analytics...");

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

          setStatus(allowed ? "" : "Access denied. Admin account required.");
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

    const unsubBusiness = onSnapshot(query(collection(db, "businessAccounts")), (s) =>
      setBusinesses(s.docs.map((d) => ({ id: d.id, ...d.data() })) as BusinessAccount[])
    );

    const unsubFleet = onSnapshot(query(collection(db, "fleetVehicles")), (s) =>
      setFleet(s.docs.map((d) => ({ id: d.id, ...d.data() })) as FleetVehicle[])
    );

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubRatings();
      unsubAlerts();
      unsubVerifications();
      unsubBusiness();
      unsubFleet();
    };
  }, [adminAllowed]);

  function clean(value?: string) {
    return String(value || "").toLowerCase();
  }

  function money(value: number) {
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

  const analytics = useMemo(() => {
    const completedBookings = bookings.filter((item) => clean(item.status) === "completed");
    const activeBookings = bookings.filter((item) =>
      ["pending", "reserved", "confirmed"].includes(clean(item.status))
    );

    const grossRevenue = completedBookings.reduce(
      (total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1),
      0
    );

    const todayRevenue = completedBookings
      .filter((item) => isToday(item.createdAt))
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

    const weekRevenue = completedBookings
      .filter((item) => isThisWeek(item.createdAt))
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

    const monthRevenue = completedBookings
      .filter((item) => isThisMonth(item.createdAt))
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1), 0);

    const platformFee = grossRevenue * 0.12;

    const paidOut = payouts
      .filter((item) => clean(item.status) === "paid")
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const pendingPayouts = payouts
      .filter((item) => ["pending", "approved"].includes(clean(item.status)))
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const totalMiles = bookings.reduce((total, item) => total + Number(item.distanceMiles || 0), 0);

    const avgRating =
      ratings.length > 0
        ? ratings.reduce((total, item) => total + Number(item.stars || item.rating || 0), 0) /
          ratings.length
        : 0;

    const ticketAverage = completedBookings.length ? grossRevenue / completedBookings.length : 0;

    const projectedGrowth = Math.round(
      users.length * 1.8 +
        completedBookings.length * 2.5 +
        grossRevenue * 0.03 +
        businesses.length * 15 +
        fleet.length * 5
    );

    const topDrivers = Object.entries(
      completedBookings.reduce<Record<string, { email: string; trips: number; revenue: number }>>(
        (acc, item) => {
          const key = item.driverId || item.driverEmail || "unknown";
          if (!acc[key]) acc[key] = { email: item.driverEmail || key, trips: 0, revenue: 0 };
          acc[key].trips += 1;
          acc[key].revenue += Number(item.price || 0) * Number(item.seatsBooked || 1);
          return acc;
        },
        {}
      )
    )
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const topCompanies = businesses
      .map((business) => ({
        id: business.id,
        name: business.companyName || "Business Account",
        employees: Number(business.employees || 0),
        budget: Number(business.monthlyBudget || 0),
      }))
      .sort((a, b) => b.budget - a.budget)
      .slice(0, 5);

    const topCities = rides.reduce<Record<string, number>>((acc, ride) => {
      const city = String(ride.from || "Unknown").split(",")[0] || "Unknown";
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});

    return {
      users: users.length,
      newUsersToday: users.filter((item) => isToday(item.createdAt)).length,
      onlineUsers: users.filter((item) => item.online).length,
      verifiedUsers: users.filter((item) => item.verified || item.driverVerified).length,
      rides: rides.length,
      activeRides: rides.filter((item) => ["active", "full"].includes(clean(item.status))).length,
      completedRides: rides.filter((item) => clean(item.status) === "completed").length,
      cancelledRides: rides.filter((item) => clean(item.status) === "cancelled").length,
      bookings: bookings.length,
      activeBookings: activeBookings.length,
      completedBookings: completedBookings.length,
      grossRevenue,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      platformFee,
      paidOut,
      pendingPayouts,
      totalMiles,
      avgRating,
      ticketAverage,
      projectedGrowth,
      activeSOS: alerts.filter((item) => clean(item.status) === "active").length,
      criticalSOS: alerts.filter((item) =>
        ["critical", "life_threatening"].includes(clean(item.priority))
      ).length,
      pendingVerifications: verifications.filter((item) => clean(item.status) === "pending").length,
      approvedVerifications: verifications.filter((item) => clean(item.status) === "approved").length,
      businesses: businesses.length,
      fleetVehicles: fleet.length,
      activeFleet: fleet.filter((item) => clean(item.status) === "active").length,
      fleetMiles: fleet.reduce((total, item) => total + Number(item.mileage || 0), 0),
      fleetFuelCost: fleet.reduce((total, item) => total + Number(item.fuelCost || 0), 0),
      topDrivers,
      topCompanies,
      topCities: Object.entries(topCities)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }, [users, rides, bookings, payouts, ratings, alerts, verifications, businesses, fleet]);

  if (!adminAllowed) {
    return (
      <main className="page">
        <section className="locked">
          <h1>Enterprise <span>Analytics</span></h1>
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
          <Link href="/analytics-center" className="navButton">Analytics Center</Link>
          <Link href="/admin-sos" className="navButton">Admin SOS</Link>
          <Link href="/business" className="navButton">Business</Link>
          <Link href="/fleet-management" className="navButton">Fleet</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">CEO Command Center</p>
            <h1>Enterprise <span>Analytics</span></h1>
            <p className="subtitle">
              Real-time command dashboard for RoadLink revenue, users, rides, bookings, SOS,
              business accounts, fleet activity, verifications and platform growth.
            </p>
          </div>

          <div className="liveOrb">
            <strong>LIVE</strong>
            <span>{analytics.users} users</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="💰" label="Gross Revenue" value={money(analytics.grossRevenue)} />
          <Metric icon="📅" label="Today Revenue" value={money(analytics.todayRevenue)} />
          <Metric icon="📆" label="Week Revenue" value={money(analytics.weekRevenue)} />
          <Metric icon="🗓️" label="Month Revenue" value={money(analytics.monthRevenue)} />
          <Metric icon="🧾" label="RoadLink Fee" value={money(analytics.platformFee)} />
          <Metric icon="👥" label="Users" value={String(analytics.users)} />
          <Metric icon="🟢" label="Online" value={String(analytics.onlineUsers)} />
          <Metric icon="🆕" label="New Today" value={String(analytics.newUsersToday)} />
          <Metric icon="🚗" label="Rides" value={String(analytics.rides)} />
          <Metric icon="✅" label="Completed Rides" value={String(analytics.completedRides)} />
          <Metric icon="🎟️" label="Bookings" value={String(analytics.bookings)} />
          <Metric icon="📌" label="Active Bookings" value={String(analytics.activeBookings)} />
          <Metric icon="💳" label="Pending Payouts" value={money(analytics.pendingPayouts)} />
          <Metric icon="⭐" label="Avg Rating" value={analytics.avgRating ? analytics.avgRating.toFixed(1) : "New"} />
          <Metric icon="🚨" label="Active SOS" value={String(analytics.activeSOS)} />
          <Metric icon="🏢" label="Businesses" value={String(analytics.businesses)} />
          <Metric icon="🚙" label="Fleet Vehicles" value={String(analytics.fleetVehicles)} />
          <Metric icon="🛣️" label="Platform Miles" value={`${analytics.totalMiles.toFixed(1)} mi`} />
          <Metric icon="💵" label="Avg Ticket" value={money(analytics.ticketAverage)} />
          <Metric icon="📈" label="Growth Score" value={String(analytics.projectedGrowth)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Revenue Intelligence</p>
            <h2>Financial Growth</h2>
            <Bar label="Today" value={analytics.todayRevenue} max={Math.max(analytics.monthRevenue, 1)} money />
            <Bar label="This Week" value={analytics.weekRevenue} max={Math.max(analytics.monthRevenue, 1)} money />
            <Bar label="This Month" value={analytics.monthRevenue} max={Math.max(analytics.monthRevenue, 1)} money />
            <Bar label="Platform Fee" value={analytics.platformFee} max={Math.max(analytics.grossRevenue, 1)} money />
          </section>

          <section className="panel">
            <p className="eyebrow">Operations</p>
            <h2>Ride Health</h2>
            <Bar label="Active Rides" value={analytics.activeRides} max={Math.max(analytics.rides, 1)} />
            <Bar label="Completed Rides" value={analytics.completedRides} max={Math.max(analytics.rides, 1)} />
            <Bar label="Cancelled Rides" value={analytics.cancelledRides} max={Math.max(analytics.rides, 1)} />
            <Bar label="Completed Bookings" value={analytics.completedBookings} max={Math.max(analytics.bookings, 1)} />
          </section>

          <section className="panel">
            <p className="eyebrow">Safety & Trust</p>
            <h2>Risk Monitor</h2>
            <Info label="Active SOS" value={String(analytics.activeSOS)} />
            <Info label="Critical SOS" value={String(analytics.criticalSOS)} />
            <Info label="Pending Verifications" value={String(analytics.pendingVerifications)} />
            <Info label="Approved Verifications" value={String(analytics.approvedVerifications)} />
          </section>

          <section className="panel">
            <p className="eyebrow">Enterprise Operations</p>
            <h2>Business & Fleet</h2>
            <Info label="Business Accounts" value={String(analytics.businesses)} />
            <Info label="Fleet Vehicles" value={String(analytics.fleetVehicles)} />
            <Info label="Active Fleet" value={String(analytics.activeFleet)} />
            <Info label="Fleet Fuel Costs" value={money(analytics.fleetFuelCost)} />
          </section>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Top Drivers</p>
            <h2>Top 10 by Revenue</h2>

            {analytics.topDrivers.length === 0 ? (
              <Empty text="No completed driver revenue yet." />
            ) : (
              <div className="rankList">
                {analytics.topDrivers.map((driver, index) => (
                  <div key={driver.id} className="rankItem">
                    <div className="rankNumber">#{index + 1}</div>
                    <div>
                      <strong>{driver.email}</strong>
                      <p>{driver.trips} completed trips</p>
                    </div>
                    <span>{money(driver.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Top Companies</p>
            <h2>Enterprise Accounts</h2>

            {analytics.topCompanies.length === 0 ? (
              <Empty text="No business accounts yet." />
            ) : (
              <div className="rankList">
                {analytics.topCompanies.map((company, index) => (
                  <div key={company.id} className="rankItem">
                    <div className="rankNumber">#{index + 1}</div>
                    <div>
                      <strong>{company.name}</strong>
                      <p>{company.employees} employees</p>
                    </div>
                    <span>{money(company.budget)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">City Activity</p>
          <h2>Top Origin Cities</h2>

          {analytics.topCities.length === 0 ? (
            <Empty text="No city activity yet." />
          ) : (
            <div className="cityGrid">
              {analytics.topCities.map((city) => (
                <div key={city.city} className="cityCard">
                  <strong>{city.city}</strong>
                  <span>{city.count} rides</span>
                </div>
              ))}
            </div>
          )}
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

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <div className="emptyIcon">📊</div>
      <p>{text}</p>
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
      .liveOrb strong,
      .rankItem span {
        color: #22c55e;
      }

      .subtitle,
      .locked p,
      .empty p {
        color: #a1a1aa;
        max-width: 800px;
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
        grid-template-columns: repeat(5, 1fr);
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
        font-size: 20px;
        overflow-wrap: anywhere;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 20px;
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
      .barTop span,
      .rankItem p,
      .cityCard span {
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

      .rankItem strong {
        overflow-wrap: anywhere;
      }

      .rankItem p {
        margin: 4px 0 0;
      }

      .cityGrid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
      }

      .cityCard {
        padding: 18px;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
      }

      .cityCard strong {
        display: block;
        margin-bottom: 6px;
      }

      .empty {
        min-height: 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      
      .emptyIcon {
        width: 76px;
        height: 76px;
        border-radius: 50%;
        background: rgba(34,197,94,0.12);
        border: 1px solid rgba(34,197,94,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 34px;
        margin-bottom: 14px;
      }

      @media (max-width: 1050px) {
        .stats {
          grid-template-columns: repeat(2, 1fr);
        }

        .grid,
        .cityGrid {
          grid-template-columns: 1fr;
        }

        .hero {
          flex-direction: column;
          align-items: flex-start;
        }

        h1 {
          font-size: 44px;
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

        .stats {
          grid-template-columns: 1fr;
        }

        .rankItem {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
        }
