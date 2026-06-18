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
  price?: number;
  seats?: number;
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
  createdAt?: string;
};

type ReportItem = {
  id: string;
  rideId?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type EmergencyAlert = {
  id: string;
  rideId?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type CityDemand = {
  id: string;
  city: string;
  rides: number;
  bookings: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  passengers: number;
  revenue: number;
  reports: number;
  sos: number;
  demandScore: number;
  riskScore: number;
  status: "hot" | "growing" | "watch" | "low";
  insight: string;
};

export default function AdminDemandHeatmapPage() {
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [selected, setSelected] = useState<CityDemand | null>(null);
  const [filter, setFilter] = useState<"all" | CityDemand["status"]>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading demand heatmap...");
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
    const unsubReports = listen("reports", setReports);
    const unsubAlerts = listen("emergencyAlerts", setAlerts);

    return () => {
      unsubRides();
      unsubBookings();
      unsubReports();
      unsubAlerts();
    };
  }, []);

  const cities = useMemo<CityDemand[]>(() => {
    const cityMap = new Map<string, RideItem[]>();

    rides.forEach((ride) => {
      const citiesToTrack = [ride.from, ride.to]
        .filter(Boolean)
        .map((value) => String(value).trim());

      citiesToTrack.forEach((city) => {
        const key = city.toLowerCase();

        if (!cityMap.has(key)) cityMap.set(key, []);
        cityMap.get(key)?.push(ride);
      });
    });

    return Array.from(cityMap.entries())
      .map(([key, cityRides]) => {
        const city = cityRides[0]?.from?.toLowerCase() === key
          ? cityRides[0]?.from || key
          : cityRides[0]?.to || key;

        const rideIds = cityRides.map((ride) => ride.id);

        const cityBookings = bookings.filter((booking) =>
          rideIds.includes(booking.rideId || "")
        );

        const cityReports = reports.filter((report) =>
          rideIds.includes(report.rideId || "")
        );

        const citySOS = alerts.filter(
          (alert) => alert.status === "active" && rideIds.includes(alert.rideId || "")
        );

        const activeRides = cityRides.filter(
          (ride) =>
            ride.status === "active" ||
            ride.status === "open" ||
            ride.status === "full" ||
            ride.status === "in_progress"
        ).length;

        const completedRides = cityRides.filter((ride) => ride.status === "completed").length;

        const cancelledRides = cityRides.filter(
          (ride) => ride.status === "cancelled" || ride.status === "rejected"
        ).length;

        const passengers = cityBookings.reduce(
          (total, booking) => total + Number(booking.seatsBooked || 1),
          0
        );

        const revenue = cityBookings.reduce(
          (total, booking) =>
            total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1),
          0
        );

        let demandScore = 0;

        demandScore += cityRides.length * 10;
        demandScore += cityBookings.length * 12;
        demandScore += passengers * 6;
        demandScore += revenue >= 100 ? 10 : 0;
        demandScore += revenue >= 500 ? 15 : 0;
        demandScore += activeRides * 8;

        demandScore = Math.min(demandScore, 100);

        let riskScore = 0;

        riskScore += citySOS.length * 35;
        riskScore += cityReports.length * 12;
        riskScore += cancelledRides * 8;

        if (cityRides.length > 0 && cancelledRides / cityRides.length >= 0.35) {
          riskScore += 20;
        }

        riskScore = Math.min(riskScore, 100);

        const status: CityDemand["status"] =
          riskScore >= 45
            ? "watch"
            : demandScore >= 70
            ? "hot"
            : demandScore >= 35
            ? "growing"
            : "low";

        const insight =
          status === "hot"
            ? "High demand detected. Recruit more drivers and promote this city."
            : status === "growing"
            ? "Demand is growing. This city may become a strong route market."
            : status === "watch"
            ? "Demand exists, but safety or cancellation risk needs review."
            : "Low demand. Use marketing campaigns or route testing.";

        return {
          id: key.replaceAll("/", "-"),
          city,
          rides: cityRides.length,
          bookings: cityBookings.length,
          activeRides,
          completedRides,
          cancelledRides,
          passengers,
          revenue,
          reports: cityReports.length,
          sos: citySOS.length,
          demandScore,
          riskScore,
          status,
          insight,
        };
      })
      .sort((a, b) => b.demandScore + b.revenue / 10 - (a.demandScore + a.revenue / 10));
  }, [rides, bookings, reports, alerts]);

  const filteredCities = useMemo(() => {
    const text = search.toLowerCase().trim();

    return cities.filter((item) => {
      const matchesSearch =
        !text ||
        item.city.toLowerCase().includes(text) ||
        item.insight.toLowerCase().includes(text);

      const matchesFilter = filter === "all" || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [cities, search, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredCities.length === 0) return null;
      if (!current) return filteredCities[0];
      return filteredCities.find((item) => item.id === current.id) || filteredCities[0];
    });
  }, [filteredCities]);

  const hot = cities.filter((item) => item.status === "hot").length;
  const growing = cities.filter((item) => item.status === "growing").length;
  const watch = cities.filter((item) => item.status === "watch").length;
  const low = cities.filter((item) => item.status === "low").length;
  const totalRevenue = cities.reduce((total, item) => total + item.revenue, 0);
  const topCity = cities[0]?.city || "No city yet";

  async function saveCityInsight(item: CityDemand) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "demandHeatmap", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `demand-${item.id}-${Date.now()}`),
        {
          action: "Demand Heatmap Insight Saved",
          targetId: item.id,
          targetType: "cityDemand",
          details: item.insight,
          severity: item.status === "watch" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Demand insight saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save demand insight.");
    } finally {
      setLoadingId("");
    }
  }

  function statusLabel(status: CityDemand["status"]) {
    if (status === "hot") return "Hot";
    if (status === "growing") return "Growing";
    if (status === "watch") return "Watch";
    return "Low";
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
          <Link href="/admin/route-intelligence" className="miniButton">Routes</Link>
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
          <Link href="/admin/marketing" className="miniButton">Marketing</Link>
          <Link href="/admin/map-center" className="miniButton">Map</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Market Intelligence</p>
            <h1>Demand <span>Heatmap</span></h1>
            <p className="subtitle">
              Analyze demand by city using rides, bookings, passengers, revenue, SOS alerts and reports.
            </p>
          </div>

          <div className={watch > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{cities.length}</strong>
            <span>Cities</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🔥" label="Hot Cities" value={String(hot)} />
          <Metric icon="📈" label="Growing" value={String(growing)} />
          <Metric icon="👀" label="Watch" value={String(watch)} danger={watch > 0} />
          <Metric icon="🌱" label="Low Demand" value={String(low)} />
          <Metric icon="💰" label="Revenue" value={money(totalRevenue)} />
          <Metric icon="🏙️" label="Top City" value={shortText(topCity, 20)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search city or insight..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | CityDemand["status"])}
          >
            <option value="all">All cities</option>
            <option value="hot">Hot</option>
            <option value="growing">Growing</option>
            <option value="watch">Watch</option>
            <option value="low">Low</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="citiesCard">
            <p className="eyebrow">City Rankings</p>
            <h2>Demand Areas</h2>

            {filteredCities.length === 0 ? (
              <div className="empty">
                <h3>No demand areas found</h3>
                <p>Cities will appear after rides are created.</p>
              </div>
            ) : (
              <div className="cityList">
                {filteredCities.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "cityRow activeCity" : "cityRow"}
                  >
                    <div className={`cityIcon ${item.status}`}>
                      {item.status === "hot"
                        ? "🔥"
                        : item.status === "growing"
                        ? "📈"
                        : item.status === "watch"
                        ? "👀"
                        : "🌱"}
                    </div>

                    <div className="cityInfo">
                      <strong>{shortText(item.city)}</strong>
                      <span>{item.rides} ride(s) • {item.bookings} booking(s)</span>
                      <small>{money(item.revenue)} • Demand {item.demandScore}%</small>
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
                    <p className="eyebrow">Selected City</p>
                    <h2>{shortText(selected.city, 54)}</h2>
                    <p className="email">{selected.insight}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>AI Demand Insight</span>
                  <strong>{selected.demandScore}/100</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="heatBar">
                  <div style={{ width: `${selected.demandScore}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="City" value={selected.city} />
                  <Info label="Demand Score" value={`${selected.demandScore}%`} />
                  <Info label="Risk Score" value={`${selected.riskScore}%`} />
                  <Info label="Rides" value={String(selected.rides)} />
                  <Info label="Active Rides" value={String(selected.activeRides)} />
                  <Info label="Completed Rides" value={String(selected.completedRides)} />
                  <Info label="Cancelled Rides" value={String(selected.cancelledRides)} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Passengers" value={String(selected.passengers)} />
                  <Info label="Revenue" value={money(selected.revenue)} />
                  <Info label="Reports" value={String(selected.reports)} />
                  <Info label="SOS" value={String(selected.sos)} />
                </div>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveCityInsight(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Insight
                  </button>

                  <Link href="/admin/route-intelligence" className="linkButton">
                    Routes
                  </Link>

                  <Link href="/admin/revenue" className="linkButton">
                    Revenue
                  </Link>

                  <Link href="/admin/marketing" className="dangerButton">
                    Campaign
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a city</h3>
                <p>Choose a demand area to view intelligence.</p>
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
            radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 34%),
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
        .citiesCard,
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
        .insightBox p {
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

        .citiesCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .cityList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .cityRow {
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

        .activeCity {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .cityIcon {
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

        .cityIcon.hot {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .cityIcon.watch {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .cityInfo { min-width: 0; }

        .cityInfo strong,
        .cityInfo span,
        .cityInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cityInfo span,
        .cityInfo small {
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

        .status.hot,
        .statusPill.hot {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .status.growing,
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

        .status.low,
        .statusPill.low {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .insightBox {
          padding: 22px;
          border-radius: 22px;
          margin-bottom: 16px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .insightBox.hot {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.35);
        }

        .insightBox.watch {
          background: rgba(250,204,21,0.1);
          border-color: rgba(250,204,21,0.35);
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

        .insightBox.hot strong {
          color: #fca5a5;
        }

        .insightBox.watch strong {
          color: #fde68a;
        }

        .heatBar {
          width: 100%;
          height: 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          margin-bottom: 20px;
        }

        .heatBar div {
          height: 100%;
          background: linear-gradient(135deg, #22c55e, #ef4444);
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

          .cityRow {
            grid-template-columns: 46px 1fr;
          }

          .cityRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .cityIcon {
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
