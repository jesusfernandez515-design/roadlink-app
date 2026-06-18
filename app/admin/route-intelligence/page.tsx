"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverId?: string;
  driverEmail?: string;
  price?: number;
  seats?: number;
  distanceMiles?: number;
  durationMinutes?: number;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  rideId?: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  passengerEmail?: string;
  driverEmail?: string;
  createdAt?: string;
};

type EmergencyAlert = {
  id: string;
  rideId?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  rideId?: string;
  status?: string;
  priority?: string;
  reason?: string;
  createdAt?: string;
};

type RouteProfile = {
  id: string;
  route: string;
  from: string;
  to: string;
  rides: number;
  bookings: number;
  completed: number;
  cancelled: number;
  active: number;
  sos: number;
  reports: number;
  revenue: number;
  averagePrice: number;
  averageDistance: number;
  averageDuration: number;
  riskScore: number;
  growthScore: number;
  status: "healthy" | "growing" | "watch" | "risk";
  insight: string;
};

export default function AdminRouteIntelligencePage() {
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selected, setSelected] = useState<RouteProfile | null>(null);
  const [filter, setFilter] = useState<"all" | RouteProfile["status"]>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading route intelligence...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const listen = (name: string, setter: (items: any[]) => void) =>
      onSnapshot(
        query(collection(db, name)),
        (snapshot) => {
          setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
          setMessage("");
        },
        () => setter([])
      );

    const unsubRides = listen("rides", setRides);
    const unsubBookings = listen("bookings", setBookings);
    const unsubAlerts = listen("emergencyAlerts", setAlerts);
    const unsubReports = listen("reports", setReports);

    return () => {
      unsubRides();
      unsubBookings();
      unsubAlerts();
      unsubReports();
    };
  }, []);

  const routes = useMemo<RouteProfile[]>(() => {
    const map = new Map<string, RideItem[]>();

    rides.forEach((ride) => {
      const from = (ride.from || "Unknown Origin").trim();
      const to = (ride.to || "Unknown Destination").trim();
      const key = `${from.toLowerCase()}|${to.toLowerCase()}`;

      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(ride);
    });

    return Array.from(map.entries())
      .map(([key, routeRides]) => {
        const first = routeRides[0];
        const from = first?.from || "Unknown Origin";
        const to = first?.to || "Unknown Destination";
        const route = `${from} → ${to}`;

        const rideIds = routeRides.map((ride) => ride.id);

        const routeBookings = bookings.filter((booking) =>
          rideIds.includes(booking.rideId || "")
        );

        const routeAlerts = alerts.filter(
          (alert) => alert.status === "active" && rideIds.includes(alert.rideId || "")
        );

        const routeReports = reports.filter((report) =>
          rideIds.includes(report.rideId || "")
        );

        const completed = routeRides.filter((ride) => ride.status === "completed").length;

        const cancelled = routeRides.filter(
          (ride) => ride.status === "cancelled" || ride.status === "rejected"
        ).length;

        const active = routeRides.filter(
          (ride) =>
            ride.status === "active" ||
            ride.status === "open" ||
            ride.status === "full" ||
            ride.status === "in_progress"
        ).length;

        const revenue = routeBookings.reduce((total, booking) => {
          return total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1);
        }, 0);

        const averagePrice =
          routeBookings.length > 0
            ? revenue / routeBookings.length
            : routeRides.reduce((total, ride) => total + Number(ride.price || 0), 0) /
              Math.max(routeRides.length, 1);

        const averageDistance =
          routeRides.reduce((total, ride) => total + Number(ride.distanceMiles || 0), 0) /
          Math.max(routeRides.filter((ride) => Number(ride.distanceMiles || 0) > 0).length, 1);

        const averageDuration =
          routeRides.reduce((total, ride) => total + Number(ride.durationMinutes || 0), 0) /
          Math.max(routeRides.filter((ride) => Number(ride.durationMinutes || 0) > 0).length, 1);

        let riskScore = 0;

        riskScore += routeAlerts.length * 35;
        riskScore += routeReports.length * 12;
        riskScore += cancelled * 8;

        if (routeRides.length > 0 && cancelled / routeRides.length >= 0.35) {
          riskScore += 18;
        }

        riskScore = Math.min(riskScore, 100);

        const recentRides = routeRides.filter((ride) => {
          if (!ride.createdAt) return false;
          const age = Date.now() - new Date(ride.createdAt).getTime();
          return !Number.isNaN(age) && age <= 14 * 24 * 60 * 60 * 1000;
        }).length;

        const growthScore = Math.min(
          Math.round((recentRides / Math.max(routeRides.length, 1)) * 100),
          100
        );

        const status: RouteProfile["status"] =
          riskScore >= 50
            ? "risk"
            : growthScore >= 50 && routeRides.length >= 2
            ? "growing"
            : cancelled > 0 || routeReports.length > 0
            ? "watch"
            : "healthy";

        const insight =
          status === "risk"
            ? "High route risk. Review SOS alerts, reports and cancellations before scaling this route."
            : status === "growing"
            ? "Demand is growing. Consider recruiting more drivers for this route."
            : status === "watch"
            ? "Route needs monitoring because cancellations or reports exist."
            : "Route appears healthy with normal activity.";

        return {
          id: key.replaceAll("/", "-"),
          route,
          from,
          to,
          rides: routeRides.length,
          bookings: routeBookings.length,
          completed,
          cancelled,
          active,
          sos: routeAlerts.length,
          reports: routeReports.length,
          revenue,
          averagePrice,
          averageDistance,
          averageDuration,
          riskScore,
          growthScore,
          status,
          insight,
        };
      })
      .sort((a, b) => b.revenue + b.rides * 10 - (a.revenue + a.rides * 10));
  }, [rides, bookings, alerts, reports]);

  const filteredRoutes = useMemo(() => {
    const text = search.toLowerCase().trim();

    return routes.filter((item) => {
      const matchesSearch =
        !text ||
        item.route.toLowerCase().includes(text) ||
        item.from.toLowerCase().includes(text) ||
        item.to.toLowerCase().includes(text) ||
        item.insight.toLowerCase().includes(text);

      const matchesFilter = filter === "all" || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [routes, search, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredRoutes.length === 0) return null;
      if (!current) return filteredRoutes[0];
      return filteredRoutes.find((item) => item.id === current.id) || filteredRoutes[0];
    });
  }, [filteredRoutes]);

  const totalRevenue = routes.reduce((total, item) => total + item.revenue, 0);
  const healthy = routes.filter((item) => item.status === "healthy").length;
  const growing = routes.filter((item) => item.status === "growing").length;
  const watch = routes.filter((item) => item.status === "watch").length;
  const risk = routes.filter((item) => item.status === "risk").length;

  const topRoute = routes[0]?.route || "No routes yet";
  const highestRevenue = [...routes].sort((a, b) => b.revenue - a.revenue)[0];

  async function saveRouteInsight(item: RouteProfile) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "routeInsights", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `route-intel-${item.id}-${Date.now()}`),
        {
          action: "Route Intelligence Saved",
          targetId: item.id,
          targetType: "route",
          details: item.insight,
          severity: item.status === "risk" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Route intelligence saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save route insight.");
    } finally {
      setLoadingId("");
    }
  }

  function statusLabel(status: RouteProfile["status"]) {
    if (status === "growing") return "Growing";
    if (status === "watch") return "Watch";
    if (status === "risk") return "Risk";
    return "Healthy";
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function shortText(value?: string, max = 46) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/rides" className="miniButton">Rides</Link>
          <Link href="/admin/bookings" className="miniButton">Bookings</Link>
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
          <Link href="/admin/dispatch" className="miniButton">Dispatch</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Business Intelligence</p>
            <h1>Route <span>Intelligence</span></h1>
            <p className="subtitle">
              Analyze routes, demand, bookings, revenue, cancellations, SOS signals,
              reports, growth and operational risk.
            </p>
          </div>

          <div className={risk > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{routes.length}</strong>
            <span>Total Routes</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🧭" label="Routes" value={String(routes.length)} />
          <Metric icon="🔥" label="Top Route" value={shortText(topRoute, 20)} />
          <Metric icon="💰" label="Route Revenue" value={money(totalRevenue)} />
          <Metric icon="📈" label="Growing" value={String(growing)} />
          <Metric icon="👀" label="Watch" value={String(watch)} danger={watch > 0} />
          <Metric icon="🚨" label="Risk" value={String(risk)} danger={risk > 0} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search route, city or insight..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | RouteProfile["status"])}
          >
            <option value="all">All routes</option>
            <option value="healthy">Healthy</option>
            <option value="growing">Growing</option>
            <option value="watch">Watch</option>
            <option value="risk">Risk</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="routesCard">
            <p className="eyebrow">Route Rankings</p>
            <h2>Top Routes</h2>

            {filteredRoutes.length === 0 ? (
              <div className="empty">
                <h3>No routes found</h3>
                <p>Routes will appear after rides are created.</p>
              </div>
            ) : (
              <div className="routeList">
                {filteredRoutes.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "routeRow activeRoute" : "routeRow"}
                  >
                    <div className={`routeIcon ${item.status}`}>
                      {item.status === "risk"
                        ? "🚨"
                        : item.status === "watch"
                        ? "👀"
                        : item.status === "growing"
                        ? "📈"
                        : "🧭"}
                    </div>

                    <div className="routeInfo">
                      <strong>{shortText(item.route)}</strong>
                      <span>{item.rides} ride(s) • {item.bookings} booking(s)</span>
                      <small>{money(item.revenue)} • Risk {item.riskScore}%</small>
                    </div>

                    <em className={`status ${item.status}`}>
                      {statusLabel(item.status)}
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
                    <p className="eyebrow">Selected Route</p>
                    <h2>{shortText(selected.route, 54)}</h2>
                    <p className="email">{selected.insight}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>AI Route Insight</span>
                  <strong>{selected.status === "risk" ? "Review Route" : selected.status === "growing" ? "Scale Route" : "Monitor Route"}</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="infoGrid">
                  <Info label="From" value={selected.from} />
                  <Info label="To" value={selected.to} />
                  <Info label="Total Rides" value={String(selected.rides)} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Completed" value={String(selected.completed)} />
                  <Info label="Active" value={String(selected.active)} />
                  <Info label="Cancelled" value={String(selected.cancelled)} />
                  <Info label="SOS" value={String(selected.sos)} />
                  <Info label="Reports" value={String(selected.reports)} />
                  <Info label="Revenue" value={money(selected.revenue)} />
                  <Info label="Avg Price" value={money(selected.averagePrice)} />
                  <Info label="Avg Distance" value={`${Math.round(selected.averageDistance)} mi`} />
                  <Info label="Avg Duration" value={`${Math.round(selected.averageDuration)} min`} />
                  <Info label="Risk Score" value={`${selected.riskScore}%`} />
                  <Info label="Growth Score" value={`${selected.growthScore}%`} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                </div>

                <section className="rankingBox">
                  <p className="eyebrow">Revenue Leader</p>
                  <h2>{highestRevenue ? shortText(highestRevenue.route, 44) : "No revenue yet"}</h2>
                  <p>{highestRevenue ? money(highestRevenue.revenue) : "$0"}</p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveRouteInsight(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Insight
                  </button>

                  <Link href="/admin/rides" className="linkButton">
                    View Rides
                  </Link>

                  <Link href="/admin/revenue" className="linkButton">
                    Revenue
                  </Link>

                  <Link href="/admin/dispatch" className="dangerButton">
                    Dispatch
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a route</h3>
                <p>Choose a route to view intelligence.</p>
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
        .routesCard,
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
        .rankingBox p {
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
          font-size: 24px;
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

        select option {
          color: black;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.95fr 1.45fr;
          gap: 24px;
        }

        .routesCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .routeList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .routeRow {
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

        .activeRoute {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .routeIcon {
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

        .routeIcon.watch {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .routeIcon.risk {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .routeInfo { min-width: 0; }

        .routeInfo strong,
        .routeInfo span,
        .routeInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .routeInfo span,
        .routeInfo small {
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

        .status.healthy,
        .status.growing,
        .statusPill.healthy,
        .statusPill.growing {
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
        .rankingBox {
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
          font-size: 32px;
          font-weight: 900;
        }

        .insightBox.watch strong {
          color: #fde68a;
        }

        .insightBox.risk strong {
          color: #fca5a5;
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
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
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

          .stats,
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .routeRow {
            grid-template-columns: 46px 1fr;
          }

          .routeRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .routeIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
            flex-direction: column;
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
