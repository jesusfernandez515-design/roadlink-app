"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type PerformanceStatus = "excellent" | "good" | "watch" | "risk";

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
  online?: boolean;
  lastSeen?: string;
  createdAt?: string;
};

type RideItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  from?: string;
  to?: string;
  price?: number;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  rideId?: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type RatingItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  rating?: number;
  comment?: string;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  targetUserId?: string;
  targetUserEmail?: string;
  priority?: string;
  reason?: string;
  createdAt?: string;
};

type PayoutItem = {
  id: string;
  userId?: string;
  driverEmail?: string;
  email?: string;
  status?: string;
  amount?: number;
  createdAt?: string;
};

type DriverPerformance = {
  id: string;
  driverId: string;
  name: string;
  email: string;
  score: number;
  status: PerformanceStatus;
  rides: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  bookings: number;
  completedBookings: number;
  cancelledBookings: number;
  passengers: number;
  revenue: number;
  payoutExposure: number;
  averageRating: number;
  ratings: number;
  reports: number;
  urgentReports: number;
  suspended: boolean;
  verified: boolean;
  online: boolean;
  insight: string;
};

export default function AdminDriverPerformancePage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [selected, setSelected] = useState<DriverPerformance | null>(null);
  const [filter, setFilter] = useState<"all" | PerformanceStatus>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading driver performance...");
  const [loadingId, setLoadingId] = useState("");

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

    const unsubUsers = listen<UserItem>("users", setUsers);
    const unsubRides = listen<RideItem>("rides", setRides);
    const unsubBookings = listen<BookingItem>("bookings", setBookings);
    const unsubRatings = listen<RatingItem>("ratings", setRatings);
    const unsubReports = listen<ReportItem>("reports", setReports);
    const unsubPayouts = listen<PayoutItem>("payoutRequests", setPayouts);

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubRatings();
      unsubReports();
      unsubPayouts();
    };
  }, []);

  const drivers = useMemo<DriverPerformance[]>(() => {
    return users
      .filter(
        (user) =>
          user.driverVerified ||
          user.verified ||
          rides.some((ride) => ride.driverId === user.id || ride.driverEmail === user.email) ||
          bookings.some((booking) => booking.driverId === user.id || booking.driverEmail === user.email)
      )
      .map((driver) => {
        const driverEmail = driver.email || "No email";

        const driverRides = rides.filter(
          (ride) => ride.driverId === driver.id || ride.driverEmail === driver.email
        );

        const driverBookings = bookings.filter(
          (booking) => booking.driverId === driver.id || booking.driverEmail === driver.email
        );

        const driverRatings = ratings.filter(
          (rating) => rating.driverId === driver.id || rating.driverEmail === driver.email
        );

        const driverReports = reports.filter(
          (report) => report.targetUserId === driver.id || report.targetUserEmail === driver.email
        );

        const driverPayouts = payouts.filter(
          (payout) =>
            payout.userId === driver.id ||
            payout.driverEmail === driver.email ||
            payout.email === driver.email
        );

        const activeRides = driverRides.filter(
          (ride) =>
            ride.status === "active" ||
            ride.status === "open" ||
            ride.status === "full" ||
            ride.status === "in_progress"
        ).length;

        const completedRides = driverRides.filter((ride) => ride.status === "completed").length;

        const cancelledRides = driverRides.filter(
          (ride) => ride.status === "cancelled" || ride.status === "rejected"
        ).length;

        const completedBookings = driverBookings.filter(
          (booking) => booking.status === "completed"
        ).length;

        const cancelledBookings = driverBookings.filter(
          (booking) =>
            booking.status === "cancelled" ||
            booking.status === "rejected" ||
            booking.status === "no_show"
        ).length;

        const passengers = driverBookings.reduce(
          (total, booking) => total + Number(booking.seatsBooked || 1),
          0
        );

        const revenue = driverBookings.reduce(
          (total, booking) =>
            total +
            Number(booking.price || booking.amount || 0) *
              Number(booking.seatsBooked || 1),
          0
        );

        const payoutExposure = driverPayouts
          .filter((payout) => payout.status === "pending" || payout.status === "approved")
          .reduce((total, payout) => total + Number(payout.amount || 0), 0);

        const averageRating =
          driverRatings.length > 0
            ? driverRatings.reduce((total, rating) => total + Number(rating.rating || 0), 0) /
              driverRatings.length
            : 5;

        const urgentReports = driverReports.filter(
          (report) => report.priority === "urgent" || report.priority === "critical"
        ).length;

        let score = 100;

        score += completedRides * 2;
        score += completedBookings * 2;
        score += averageRating >= 4.8 ? 8 : 0;
        score += revenue >= 500 ? 8 : revenue >= 100 ? 4 : 0;

        score -= cancelledRides * 8;
        score -= cancelledBookings * 6;
        score -= driverReports.length * 12;
        score -= urgentReports * 18;
        score -= averageRating < 4.5 ? 10 : 0;
        score -= averageRating < 4 ? 18 : 0;
        score -= driver.suspended ? 35 : 0;
        score -= !driver.driverVerified ? 10 : 0;

        score = Math.max(Math.min(score, 100), 0);

        const status: PerformanceStatus =
          score >= 88 ? "excellent" : score >= 72 ? "good" : score >= 50 ? "watch" : "risk";

        const online = Boolean(driver.online) || (() => {
          if (!driver.lastSeen) return false;
          const lastSeen = new Date(driver.lastSeen).getTime();
          if (Number.isNaN(lastSeen)) return false;
          return Date.now() - lastSeen <= 15 * 60 * 1000;
        })();

        const insight =
          status === "excellent"
            ? "Top performing driver. Prioritize retention, incentives and premium routes."
            : status === "good"
            ? "Reliable driver with healthy activity. Keep monitoring growth and ratings."
            : status === "watch"
            ? "Driver needs monitoring due to cancellations, ratings, reports or low activity."
            : "High-risk performance. Review safety, reports and account status before scaling.";

        return {
          id: driver.id,
          driverId: driver.id,
          name: driver.name || "RoadLink Driver",
          email: driverEmail,
          score,
          status,
          rides: driverRides.length,
          activeRides,
          completedRides,
          cancelledRides,
          bookings: driverBookings.length,
          completedBookings,
          cancelledBookings,
          passengers,
          revenue,
          payoutExposure,
          averageRating,
          ratings: driverRatings.length,
          reports: driverReports.length,
          urgentReports,
          suspended: Boolean(driver.suspended),
          verified: Boolean(driver.driverVerified || driver.verified),
          online,
          insight,
        };
      })
      .sort((a, b) => b.score + b.revenue / 100 - (a.score + a.revenue / 100));
  }, [users, rides, bookings, ratings, reports, payouts]);

  const filteredDrivers = useMemo(() => {
    const text = search.toLowerCase().trim();

    return drivers.filter((driver) => {
      const matchesSearch =
        !text ||
        driver.name.toLowerCase().includes(text) ||
        driver.email.toLowerCase().includes(text) ||
        driver.driverId.toLowerCase().includes(text) ||
        driver.insight.toLowerCase().includes(text);

      const matchesFilter = filter === "all" || driver.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [drivers, search, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredDrivers.length === 0) return null;
      if (!current) return filteredDrivers[0];
      return filteredDrivers.find((item) => item.id === current.id) || filteredDrivers[0];
    });
  }, [filteredDrivers]);

  const excellent = drivers.filter((item) => item.status === "excellent").length;
  const good = drivers.filter((item) => item.status === "good").length;
  const watch = drivers.filter((item) => item.status === "watch").length;
  const risk = drivers.filter((item) => item.status === "risk").length;
  const online = drivers.filter((item) => item.online).length;
  const totalRevenue = drivers.reduce((total, item) => total + item.revenue, 0);

  async function savePerformanceInsight(item: DriverPerformance) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "driverPerformanceInsights", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `driver-performance-${item.id}-${Date.now()}`),
        {
          userId: item.driverId,
          userEmail: item.email,
          action: "Driver Performance Insight Saved",
          targetId: item.id,
          targetType: "driverPerformance",
          details: item.insight,
          severity: item.status === "risk" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Driver performance insight saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save driver performance.");
    } finally {
      setLoadingId("");
    }
  }

  function statusLabel(status: PerformanceStatus) {
    if (status === "excellent") return "Excellent";
    if (status === "good") return "Good";
    if (status === "watch") return "Watch";
    return "Risk";
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function shortText(value?: string, max = 44) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/driver-risk" className="miniButton">Driver Risk</Link>
          <Link href="/admin/fleet" className="miniButton">Fleet</Link>
          <Link href="/admin/rides" className="miniButton">Rides</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Driver Intelligence</p>
            <h1>Driver <span>Performance</span></h1>
            <p className="subtitle">
              Rank drivers by completed rides, bookings, revenue, ratings, cancellations,
              reports, payout exposure, online status and safety performance.
            </p>
          </div>

          <div className={risk > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{drivers.length}</strong>
            <span>Drivers</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🏆" label="Excellent" value={String(excellent)} />
          <Metric icon="✅" label="Good" value={String(good)} />
          <Metric icon="👀" label="Watch" value={String(watch)} danger={watch > 0} />
          <Metric icon="🚨" label="Risk" value={String(risk)} danger={risk > 0} />
          <Metric icon="🟢" label="Online" value={String(online)} />
          <Metric icon="💰" label="Driver Revenue" value={money(totalRevenue)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search driver, email, UID or insight..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | PerformanceStatus)}
          >
            <option value="all">All drivers</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="watch">Watch</option>
            <option value="risk">Risk</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="driversCard">
            <p className="eyebrow">Driver Rankings</p>
            <h2>Performance Board</h2>

            {filteredDrivers.length === 0 ? (
              <div className="empty">
                <h3>No drivers found</h3>
                <p>Drivers will appear after accounts, rides or bookings exist.</p>
              </div>
            ) : (
              <div className="driverList">
                {filteredDrivers.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => setSelected(driver)}
                    className={selected?.id === driver.id ? "driverRow activeDriver" : "driverRow"}
                  >
                    <div className={`driverIcon ${driver.status}`}>
                      {driver.status === "excellent"
                        ? "🏆"
                        : driver.status === "good"
                        ? "✅"
                        : driver.status === "watch"
                        ? "👀"
                        : "🚨"}
                    </div>

                    <div className="driverInfo">
                      <strong>{shortText(driver.name)}</strong>
                      <span>{shortText(driver.email)}</span>
                      <small>Score {driver.score}/100 • {money(driver.revenue)}</small>
                    </div>

                    <em className={`status ${driver.status}`}>
                      {statusLabel(driver.status)}
                    </em>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Driver</p>
                    <h2>{shortText(selected.name, 54)}</h2>
                    <p className="email">{selected.email}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>Performance Score</span>
                  <strong>{selected.score}/100</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="scoreBar">
                  <div style={{ width: `${selected.score}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Driver ID" value={selected.driverId} />
                  <Info label="Verified" value={selected.verified ? "Yes" : "No"} />
                  <Info label="Online" value={selected.online ? "Yes" : "No"} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                  <Info label="Total Rides" value={String(selected.rides)} />
                  <Info label="Active Rides" value={String(selected.activeRides)} />
                  <Info label="Completed Rides" value={String(selected.completedRides)} />
                  <Info label="Cancelled Rides" value={String(selected.cancelledRides)} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Completed Bookings" value={String(selected.completedBookings)} />
                  <Info label="Cancelled Bookings" value={String(selected.cancelledBookings)} />
                  <Info label="Passengers" value={String(selected.passengers)} />
                  <Info label="Revenue" value={money(selected.revenue)} />
                  <Info label="Payout Exposure" value={money(selected.payoutExposure)} />
                  <Info label="Average Rating" value={selected.averageRating.toFixed(1)} />
                  <Info label="Ratings" value={String(selected.ratings)} />
                  <Info label="Reports" value={String(selected.reports)} />
                  <Info label="Urgent Reports" value={String(selected.urgentReports)} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Performance Recommendation</p>
                  <h2>
                    {selected.status === "excellent"
                      ? "Prioritize this driver"
                      : selected.status === "good"
                      ? "Keep growing this driver"
                      : selected.status === "watch"
                      ? "Monitor closely"
                      : "Review before scaling"}
                  </h2>
                  <p>{selected.insight}</p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => savePerformanceInsight(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Insight
                  </button>

                  <Link href="/admin/driver-risk" className="linkButton">
                    Driver Risk
                  </Link>

                  <Link href="/admin/rides" className="linkButton">
                    Rides
                  </Link>

                  <Link href="/admin/payouts" className="dangerButton">
                    Payouts
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a driver</h3>
                <p>Choose a driver to view performance details.</p>
              </div>
            )}
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
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
        .filters,
        .driversCard,
        .detailsCard {
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
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .email,
        .empty p,
        .insightBox p,
        .summaryBox p {
          color: #a1a1aa;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .scoreOrb {
          min-width: 96px;
          height: 96px;
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
          font-size: 30px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fca5a5;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
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

        .dangerMetric .metricValue {
          color: #ef4444;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
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

        select option { color: black; }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.95fr 1.45fr;
          gap: 24px;
        }

        .driversCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .driverList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .driverRow {
          width: 100%;
          display: grid;
          grid-template-columns: 52px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeDriver {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .driverIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .driverIcon.watch {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .driverIcon.risk {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .driverInfo { min-width: 0; }

        .driverInfo strong,
        .driverInfo span,
        .driverInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .driverInfo span,
        .driverInfo small {
          color: #a1a1aa;
          margin-top: 4px;
        }

        .status,
        .statusPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .status.excellent,
        .status.good,
        .statusPill.excellent,
        .statusPill.good {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.watch,
        .statusPill.watch {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .status.risk,
        .statusPill.risk {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .insightBox,
        .summaryBox {
          padding: 22px;
          border-radius: 22px;
          margin-bottom: 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .insightBox.watch {
          background: rgba(250,204,21,0.1);
          border-color: rgba(250,204,21,0.35);
        }

        .insightBox.risk {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.35);
        }

        .insightBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .insightBox strong {
          color: #22c55e;
          font-size: 42px;
          font-weight: 900;
        }

        .insightBox.watch strong {
          color: #fde68a;
        }

        .insightBox.risk strong {
          color: #fca5a5;
        }

        .scoreBar {
          width: 100%;
          height: 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          margin-bottom: 20px;
        }

        .scoreBar div {
          height: 100%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-radius: 999px;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .infoBox {
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

        .actionRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .saveButton,
        .linkButton,
        .dangerButton {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
        }

        .saveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .linkButton {
          background: rgba(59,130,246,0.13);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .dangerButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 16px;
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 22px;
        }

        @media (max-width: 1100px) {
          .stats { grid-template-columns: repeat(3, 1fr); }
          .adminGrid { grid-template-columns: 1fr; }
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
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .driverRow {
            grid-template-columns: 46px 1fr;
          }

          .driverRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .driverIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader { flex-direction: column; }
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
