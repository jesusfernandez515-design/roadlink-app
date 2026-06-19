"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type PassengerStatus = "vip" | "good" | "watch" | "risk";

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  verified?: boolean;
  suspended?: boolean;
  online?: boolean;
  lastSeen?: string;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  rideId?: string;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  createdAt?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverEmail?: string;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  reporterId?: string;
  reporterEmail?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  priority?: string;
  reason?: string;
  createdAt?: string;
};

type RatingItem = {
  id: string;
  userId?: string;
  userEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  rating?: number;
  createdAt?: string;
};

type EmergencyAlert = {
  id: string;
  userId?: string;
  userEmail?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type PassengerIntelligence = {
  id: string;
  passengerId: string;
  name: string;
  email: string;
  score: number;
  status: PassengerStatus;
  bookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  seats: number;
  spend: number;
  reportsMade: number;
  reportsAgainst: number;
  urgentReports: number;
  averageRating: number;
  ratings: number;
  activeSOS: number;
  suspended: boolean;
  verified: boolean;
  online: boolean;
  favoriteRoute: string;
  insight: string;
};

export default function AdminPassengerIntelligencePage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [selected, setSelected] = useState<PassengerIntelligence | null>(null);
  const [filter, setFilter] = useState<"all" | PassengerStatus>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading passenger intelligence...");
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
    const unsubBookings = listen<BookingItem>("bookings", setBookings);
    const unsubRides = listen<RideItem>("rides", setRides);
    const unsubReports = listen<ReportItem>("reports", setReports);
    const unsubRatings = listen<RatingItem>("ratings", setRatings);
    const unsubAlerts = listen<EmergencyAlert>("emergencyAlerts", setAlerts);

    return () => {
      unsubUsers();
      unsubBookings();
      unsubRides();
      unsubReports();
      unsubRatings();
      unsubAlerts();
    };
  }, []);

  const passengers = useMemo<PassengerIntelligence[]>(() => {
    return users
      .filter((user) =>
        bookings.some(
          (booking) =>
            booking.passengerId === user.id || booking.passengerEmail === user.email
        )
      )
      .map((user) => {
        const passengerBookings = bookings.filter(
          (booking) =>
            booking.passengerId === user.id || booking.passengerEmail === user.email
        );

        const completedBookings = passengerBookings.filter(
          (booking) => booking.status === "completed"
        ).length;

        const cancelledBookings = passengerBookings.filter(
          (booking) =>
            booking.status === "cancelled" ||
            booking.status === "rejected" ||
            booking.status === "no_show"
        ).length;

        const pendingBookings = passengerBookings.filter(
          (booking) =>
            booking.status === "pending" ||
            booking.status === "reserved" ||
            booking.status === "confirmed"
        ).length;

        const seats = passengerBookings.reduce(
          (total, booking) => total + Number(booking.seatsBooked || 1),
          0
        );

        const spend = passengerBookings.reduce(
          (total, booking) =>
            total +
            Number(booking.price || booking.amount || 0) *
              Number(booking.seatsBooked || 1),
          0
        );

        const reportsMade = reports.filter(
          (report) => report.reporterId === user.id || report.reporterEmail === user.email
        );

        const reportsAgainst = reports.filter(
          (report) => report.targetUserId === user.id || report.targetUserEmail === user.email
        );

        const urgentReports = reportsAgainst.filter(
          (report) => report.priority === "urgent" || report.priority === "critical"
        ).length;

        const passengerRatings = ratings.filter(
          (rating) =>
            rating.userId === user.id ||
            rating.userEmail === user.email ||
            rating.passengerId === user.id ||
            rating.passengerEmail === user.email
        );

        const averageRating =
          passengerRatings.length > 0
            ? passengerRatings.reduce((total, rating) => total + Number(rating.rating || 0), 0) /
              passengerRatings.length
            : 5;

        const activeSOS = alerts.filter(
          (alert) =>
            alert.status === "active" &&
            (alert.userId === user.id || alert.userEmail === user.email)
        ).length;

        const routeCount = new Map<string, number>();

        passengerBookings.forEach((booking) => {
          const ride = rides.find((item) => item.id === booking.rideId);
          if (!ride) return;

          const route = `${ride.from || "Origin"} → ${ride.to || "Destination"}`;
          routeCount.set(route, (routeCount.get(route) || 0) + 1);
        });

        const favoriteRoute =
          Array.from(routeCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "Not available";

        const online = Boolean(user.online) || (() => {
          if (!user.lastSeen) return false;
          const lastSeen = new Date(user.lastSeen).getTime();
          if (Number.isNaN(lastSeen)) return false;
          return Date.now() - lastSeen <= 15 * 60 * 1000;
        })();

        let score = 100;

        score += completedBookings * 2;
        score += spend >= 500 ? 10 : spend >= 100 ? 5 : 0;
        score += averageRating >= 4.8 ? 5 : 0;

        score -= cancelledBookings * 8;
        score -= reportsAgainst.length * 14;
        score -= urgentReports * 18;
        score -= activeSOS * 12;
        score -= averageRating < 4.5 ? 8 : 0;
        score -= averageRating < 4 ? 16 : 0;
        score -= user.suspended ? 35 : 0;

        score = Math.max(Math.min(score, 100), 0);

        const status: PassengerStatus =
          score >= 88 && spend >= 100
            ? "vip"
            : score >= 72
            ? "good"
            : score >= 50
            ? "watch"
            : "risk";

        const insight =
          status === "vip"
            ? "High-value passenger. Prioritize retention, offers and premium service."
            : status === "good"
            ? "Reliable passenger with healthy booking activity."
            : status === "watch"
            ? "Passenger needs monitoring due to cancellations, reports or low trust signals."
            : "High-risk passenger. Review reports, cancellations and account status.";

        return {
          id: user.id,
          passengerId: user.id,
          name: user.name || "RoadLink Passenger",
          email: user.email || "No email",
          score,
          status,
          bookings: passengerBookings.length,
          completedBookings,
          cancelledBookings,
          pendingBookings,
          seats,
          spend,
          reportsMade: reportsMade.length,
          reportsAgainst: reportsAgainst.length,
          urgentReports,
          averageRating,
          ratings: passengerRatings.length,
          activeSOS,
          suspended: Boolean(user.suspended),
          verified: Boolean(user.verified),
          online,
          favoriteRoute,
          insight,
        };
      })
      .sort((a, b) => b.score + b.spend / 100 - (a.score + a.spend / 100));
  }, [users, bookings, rides, reports, ratings, alerts]);

  const filteredPassengers = useMemo(() => {
    const text = search.toLowerCase().trim();

    return passengers.filter((passenger) => {
      const matchesSearch =
        !text ||
        passenger.name.toLowerCase().includes(text) ||
        passenger.email.toLowerCase().includes(text) ||
        passenger.passengerId.toLowerCase().includes(text) ||
        passenger.favoriteRoute.toLowerCase().includes(text) ||
        passenger.insight.toLowerCase().includes(text);

      const matchesFilter = filter === "all" || passenger.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [passengers, search, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredPassengers.length === 0) return null;
      if (!current) return filteredPassengers[0];
      return filteredPassengers.find((item) => item.id === current.id) || filteredPassengers[0];
    });
  }, [filteredPassengers]);

  const vip = passengers.filter((item) => item.status === "vip").length;
  const good = passengers.filter((item) => item.status === "good").length;
  const watch = passengers.filter((item) => item.status === "watch").length;
  const risk = passengers.filter((item) => item.status === "risk").length;
  const totalSpend = passengers.reduce((total, item) => total + item.spend, 0);
  const online = passengers.filter((item) => item.online).length;

  async function savePassengerInsight(item: PassengerIntelligence) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "passengerIntelligenceInsights", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", item.passengerId),
        {
          passengerScore: item.score,
          passengerStatus: item.status,
          passengerInsight: item.insight,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `passenger-intel-${item.id}-${Date.now()}`),
        {
          userId: item.passengerId,
          userEmail: item.email,
          action: "Passenger Intelligence Insight Saved",
          targetId: item.id,
          targetType: "passengerIntelligence",
          details: item.insight,
          severity: item.status === "risk" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Passenger intelligence insight saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save passenger insight.");
    } finally {
      setLoadingId("");
    }
  }

  function statusLabel(status: PassengerStatus) {
    if (status === "vip") return "VIP";
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
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/bookings" className="miniButton">Bookings</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/trust-score" className="miniButton">Trust Score</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Passenger Intelligence</p>
            <h1>Passenger <span>Intelligence</span></h1>
            <p className="subtitle">
              Analyze passengers by bookings, spending, cancellations, reports,
              ratings, SOS activity, favorite routes and trust signals.
            </p>
          </div>

          <div className={risk > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{passengers.length}</strong>
            <span>Passengers</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💎" label="VIP" value={String(vip)} />
          <Metric icon="✅" label="Good" value={String(good)} />
          <Metric icon="👀" label="Watch" value={String(watch)} danger={watch > 0} />
          <Metric icon="🚨" label="Risk" value={String(risk)} danger={risk > 0} />
          <Metric icon="🟢" label="Online" value={String(online)} />
          <Metric icon="💰" label="Passenger Spend" value={money(totalSpend)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search passenger, email, route or insight..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | PassengerStatus)}
          >
            <option value="all">All passengers</option>
            <option value="vip">VIP</option>
            <option value="good">Good</option>
            <option value="watch">Watch</option>
            <option value="risk">Risk</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="passengersCard">
            <p className="eyebrow">Passenger Rankings</p>
            <h2>Intelligence Board</h2>

            {filteredPassengers.length === 0 ? (
              <div className="empty">
                <h3>No passengers found</h3>
                <p>Passengers will appear after bookings exist.</p>
              </div>
            ) : (
              <div className="passengerList">
                {filteredPassengers.map((passenger) => (
                  <button
                    key={passenger.id}
                    onClick={() => setSelected(passenger)}
                    className={selected?.id === passenger.id ? "passengerRow activePassenger" : "passengerRow"}
                  >
                    <div className={`passengerIcon ${passenger.status}`}>
                      {passenger.status === "vip"
                        ? "💎"
                        : passenger.status === "good"
                        ? "✅"
                        : passenger.status === "watch"
                        ? "👀"
                        : "🚨"}
                    </div>

                    <div className="passengerInfo">
                      <strong>{shortText(passenger.name)}</strong>
                      <span>{shortText(passenger.email)}</span>
                      <small>Score {passenger.score}/100 • {money(passenger.spend)}</small>
                    </div>

                    <em className={`status ${passenger.status}`}>
                      {statusLabel(passenger.status)}
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
                    <p className="eyebrow">Selected Passenger</p>
                    <h2>{shortText(selected.name, 54)}</h2>
                    <p className="email">{selected.email}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>Passenger Score</span>
                  <strong>{selected.score}/100</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="scoreBar">
                  <div style={{ width: `${selected.score}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Passenger ID" value={selected.passengerId} />
                  <Info label="Verified" value={selected.verified ? "Yes" : "No"} />
                  <Info label="Online" value={selected.online ? "Yes" : "No"} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Completed Bookings" value={String(selected.completedBookings)} />
                  <Info label="Pending Bookings" value={String(selected.pendingBookings)} />
                  <Info label="Cancelled / No Show" value={String(selected.cancelledBookings)} />
                  <Info label="Seats Booked" value={String(selected.seats)} />
                  <Info label="Total Spend" value={money(selected.spend)} />
                  <Info label="Favorite Route" value={selected.favoriteRoute} />
                  <Info label="Average Rating" value={selected.averageRating.toFixed(1)} />
                  <Info label="Ratings" value={String(selected.ratings)} />
                  <Info label="Reports Made" value={String(selected.reportsMade)} />
                  <Info label="Reports Against" value={String(selected.reportsAgainst)} />
                  <Info label="Urgent Reports" value={String(selected.urgentReports)} />
                  <Info label="Active SOS" value={String(selected.activeSOS)} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Passenger Recommendation</p>
                  <h2>
                    {selected.status === "vip"
                      ? "Protect this passenger"
                      : selected.status === "good"
                      ? "Healthy passenger"
                      : selected.status === "watch"
                      ? "Monitor closely"
                      : "Review account"}
                  </h2>
                  <p>{selected.insight}</p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => savePassengerInsight(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Insight
                  </button>

                  <Link href="/admin/bookings" className="linkButton">
                    Bookings
                  </Link>

                  <Link href="/admin/reports" className="linkButton">
                    Reports
                  </Link>

                  <Link href={`/admin/users?user=${selected.passengerId}`} className="dangerButton">
                    Open User
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a passenger</h3>
                <p>Choose a passenger to view intelligence details.</p>
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
            radial-gradient(circle at top right, rgba(59,130,246,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.12), transparent 35%),
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
        .passengersCard,
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

        .warningScore strong { color: #fca5a5; }

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

        .dangerMetric .metricValue { color: #ef4444; }

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

        .passengersCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .passengerList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .passengerRow {
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

        .activePassenger {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .passengerIcon {
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

        .passengerIcon.watch {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .passengerIcon.risk {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .passengerInfo { min-width: 0; }

        .passengerInfo strong,
        .passengerInfo span,
        .passengerInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .passengerInfo span,
        .passengerInfo small {
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

        .status.vip,
        .status.good,
        .statusPill.vip,
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

        .insightBox.watch strong { color: #fde68a; }
        .insightBox.risk strong { color: #fca5a5; }

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

          .passengerRow {
            grid-template-columns: 46px 1fr;
          }

          .passengerRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .passengerIcon {
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
