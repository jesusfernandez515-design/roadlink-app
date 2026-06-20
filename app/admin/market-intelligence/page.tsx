"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type MarketStatus = "excellent" | "opportunity" | "watch" | "weak";

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  driverEmail?: string;
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

type UserItem = {
  id: string;
  email?: string;
  city?: string;
  state?: string;
  driverVerified?: boolean;
  verified?: boolean;
  createdAt?: string;
};

type MarketProfile = {
  id: string;
  title: string;
  type: "route" | "city" | "state" | "platform";
  rides: number;
  bookings: number;
  completed: number;
  cancelled: number;
  users: number;
  drivers: number;
  revenue: number;
  demandScore: number;
  marketScore: number;
  status: MarketStatus;
  insight: string;
};

export default function AdminMarketIntelligencePage() {
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selected, setSelected] = useState<MarketProfile | null>(null);
  const [filter, setFilter] = useState<"all" | MarketStatus>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading market intelligence...");
  const [savingId, setSavingId] = useState("");

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

    const unsubRides = listen<RideItem>("rides", setRides);
    const unsubBookings = listen<BookingItem>("bookings", setBookings);
    const unsubUsers = listen<UserItem>("users", setUsers);

    return () => {
      unsubRides();
      unsubBookings();
      unsubUsers();
    };
  }, []);

  const markets = useMemo<MarketProfile[]>(() => {
    const getRevenue = (items: BookingItem[]) =>
      items.reduce(
        (total, booking) =>
          total +
          Number(booking.price || booking.amount || 0) *
            Number(booking.seatsBooked || 1),
        0
      );

    const getStatus = (score: number): MarketStatus => {
      if (score >= 80) return "excellent";
      if (score >= 55) return "opportunity";
      if (score >= 30) return "watch";
      return "weak";
    };

    const getInsight = (status: MarketStatus, type: string) => {
      if (status === "excellent") return `${type} is one of RoadLink's strongest market opportunities.`;
      if (status === "opportunity") return `${type} shows promising demand and may deserve more drivers or marketing.`;
      if (status === "watch") return `${type} has early signals but needs more activity before expansion.`;
      return `${type} is weak right now. Avoid heavy spending until demand improves.`;
    };

    const routeMap = new Map<string, RideItem[]>();

    rides.forEach((ride) => {
      const route = `${ride.from || "Unknown Origin"} → ${ride.to || "Unknown Destination"}`;
      if (!routeMap.has(route)) routeMap.set(route, []);
      routeMap.get(route)?.push(ride);
    });

    const routeProfiles: MarketProfile[] = Array.from(routeMap.entries()).map(([route, routeRides]) => {
      const rideIds = routeRides.map((ride) => ride.id);
      const routeBookings = bookings.filter((booking) => rideIds.includes(booking.rideId || ""));

      const completed = routeBookings.filter((item) => item.status === "completed").length;
      const cancelled = routeBookings.filter(
        (item) =>
          item.status === "cancelled" ||
          item.status === "rejected" ||
          item.status === "no_show"
      ).length;

      const revenue = getRevenue(routeBookings);

      let marketScore = 0;
      marketScore += routeRides.length * 8;
      marketScore += routeBookings.length * 10;
      marketScore += completed * 8;
      marketScore += revenue >= 500 ? 20 : revenue >= 100 ? 10 : revenue > 0 ? 5 : 0;
      marketScore -= cancelled * 8;

      marketScore = Math.max(Math.min(marketScore, 100), 0);

      const demandScore = Math.max(Math.min(routeBookings.length * 12 + routeRides.length * 6, 100), 0);
      const status = getStatus(marketScore);

      return {
        id: `route-${route.toLowerCase().replaceAll("/", "-")}`,
        title: route,
        type: "route",
        rides: routeRides.length,
        bookings: routeBookings.length,
        completed,
        cancelled,
        users: 0,
        drivers: new Set(routeRides.map((ride) => ride.driverEmail).filter(Boolean)).size,
        revenue,
        demandScore,
        marketScore,
        status,
        insight: getInsight(status, "Route"),
      };
    });

    const cityMap = new Map<string, UserItem[]>();

    users.forEach((user) => {
      const city = user.city || "Unknown City";
      if (!cityMap.has(city)) cityMap.set(city, []);
      cityMap.get(city)?.push(user);
    });

    const cityProfiles: MarketProfile[] = Array.from(cityMap.entries()).map(([city, cityUsers]) => {
      const cityDrivers = cityUsers.filter((user) => user.driverVerified || user.verified).length;

      const cityRides = rides.filter(
        (ride) =>
          ride.from?.toLowerCase().includes(city.toLowerCase()) ||
          ride.to?.toLowerCase().includes(city.toLowerCase())
      );

      const cityRideIds = cityRides.map((ride) => ride.id);
      const cityBookings = bookings.filter((booking) => cityRideIds.includes(booking.rideId || ""));

      const completed = cityBookings.filter((item) => item.status === "completed").length;
      const cancelled = cityBookings.filter(
        (item) =>
          item.status === "cancelled" ||
          item.status === "rejected" ||
          item.status === "no_show"
      ).length;

      const revenue = getRevenue(cityBookings);

      let marketScore = 0;
      marketScore += cityUsers.length * 5;
      marketScore += cityDrivers * 8;
      marketScore += cityRides.length * 6;
      marketScore += cityBookings.length * 8;
      marketScore += revenue >= 500 ? 18 : revenue >= 100 ? 10 : revenue > 0 ? 5 : 0;
      marketScore -= cancelled * 6;

      marketScore = Math.max(Math.min(marketScore, 100), 0);

      const demandScore = Math.max(Math.min(cityBookings.length * 10 + cityUsers.length * 3, 100), 0);
      const status = getStatus(marketScore);

      return {
        id: `city-${city.toLowerCase().replaceAll("/", "-")}`,
        title: city,
        type: "city",
        rides: cityRides.length,
        bookings: cityBookings.length,
        completed,
        cancelled,
        users: cityUsers.length,
        drivers: cityDrivers,
        revenue,
        demandScore,
        marketScore,
        status,
        insight: getInsight(status, "City"),
      };
    });

    const stateMap = new Map<string, UserItem[]>();

    users.forEach((user) => {
      const state = user.state || "Unknown State";
      if (!stateMap.has(state)) stateMap.set(state, []);
      stateMap.get(state)?.push(user);
    });

    const stateProfiles: MarketProfile[] = Array.from(stateMap.entries()).map(([state, stateUsers]) => {
      const stateDrivers = stateUsers.filter((user) => user.driverVerified || user.verified).length;

      const stateRides = rides.filter(
        (ride) =>
          ride.from?.toLowerCase().includes(state.toLowerCase()) ||
          ride.to?.toLowerCase().includes(state.toLowerCase())
      );

      const stateRideIds = stateRides.map((ride) => ride.id);
      const stateBookings = bookings.filter((booking) => stateRideIds.includes(booking.rideId || ""));

      const completed = stateBookings.filter((item) => item.status === "completed").length;
      const cancelled = stateBookings.filter(
        (item) =>
          item.status === "cancelled" ||
          item.status === "rejected" ||
          item.status === "no_show"
      ).length;

      const revenue = getRevenue(stateBookings);

      let marketScore = 0;
      marketScore += stateUsers.length * 4;
      marketScore += stateDrivers * 7;
      marketScore += stateRides.length * 6;
      marketScore += stateBookings.length * 8;
      marketScore += revenue >= 1000 ? 20 : revenue >= 250 ? 10 : revenue > 0 ? 5 : 0;
      marketScore -= cancelled * 6;

      marketScore = Math.max(Math.min(marketScore, 100), 0);

      const demandScore = Math.max(Math.min(stateBookings.length * 10 + stateUsers.length * 2, 100), 0);
      const status = getStatus(marketScore);

      return {
        id: `state-${state.toLowerCase().replaceAll("/", "-")}`,
        title: state,
        type: "state",
        rides: stateRides.length,
        bookings: stateBookings.length,
        completed,
        cancelled,
        users: stateUsers.length,
        drivers: stateDrivers,
        revenue,
        demandScore,
        marketScore,
        status,
        insight: getInsight(status, "State"),
      };
    });

    const totalRevenue = getRevenue(bookings);
    const completed = bookings.filter((item) => item.status === "completed").length;
    const cancelled = bookings.filter(
      (item) =>
        item.status === "cancelled" ||
        item.status === "rejected" ||
        item.status === "no_show"
    ).length;

    let platformScore = 0;
    platformScore += users.length >= 100 ? 20 : users.length >= 25 ? 12 : users.length >= 5 ? 6 : 2;
    platformScore += rides.length >= 50 ? 20 : rides.length >= 10 ? 12 : rides.length > 0 ? 6 : 0;
    platformScore += bookings.length >= 50 ? 25 : bookings.length >= 10 ? 15 : bookings.length > 0 ? 7 : 0;
    platformScore += totalRevenue >= 1000 ? 20 : totalRevenue >= 250 ? 10 : totalRevenue > 0 ? 5 : 0;
    platformScore -= cancelled * 3;

    platformScore = Math.max(Math.min(platformScore, 100), 0);

    const platformStatus = getStatus(platformScore);

    const platformProfile: MarketProfile = {
      id: "platform-market",
      title: "RoadLink Market",
      type: "platform",
      rides: rides.length,
      bookings: bookings.length,
      completed,
      cancelled,
      users: users.length,
      drivers: users.filter((item) => item.driverVerified || item.verified).length,
      revenue: totalRevenue,
      demandScore: Math.max(Math.min(bookings.length * 8 + rides.length * 4, 100), 0),
      marketScore: platformScore,
      status: platformStatus,
      insight: getInsight(platformStatus, "Platform"),
    };

    return [platformProfile, ...routeProfiles, ...cityProfiles, ...stateProfiles].sort(
      (a, b) => b.marketScore + b.revenue / 100 - (a.marketScore + a.revenue / 100)
    );
  }, [rides, bookings, users]);

  const filteredMarkets = useMemo(() => {
    const text = search.toLowerCase().trim();

    return markets.filter((item) => {
      const matchesSearch =
        !text ||
        item.title.toLowerCase().includes(text) ||
        item.type.toLowerCase().includes(text) ||
        item.insight.toLowerCase().includes(text);

      const matchesFilter = filter === "all" || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [markets, search, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredMarkets.length === 0) return null;
      if (!current) return filteredMarkets[0];
      return filteredMarkets.find((item) => item.id === current.id) || filteredMarkets[0];
    });
  }, [filteredMarkets]);

  const platform = markets.find((item) => item.id === "platform-market");
  const excellent = markets.filter((item) => item.status === "excellent").length;
  const opportunity = markets.filter((item) => item.status === "opportunity").length;
  const watch = markets.filter((item) => item.status === "watch").length;
  const weak = markets.filter((item) => item.status === "weak").length;

  async function saveMarketInsight(item: MarketProfile) {
    try {
      setSavingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "marketIntelligenceInsights", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `market-intelligence-${item.id}-${Date.now()}`),
        {
          action: "Market Intelligence Insight Saved",
          targetId: item.id,
          targetType: "marketIntelligence",
          details: item.insight,
          severity: item.status === "weak" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Market intelligence insight saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save market insight.");
    } finally {
      setSavingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status: MarketStatus) {
    if (status === "excellent") return "Excellent";
    if (status === "opportunity") return "Opportunity";
    if (status === "watch") return "Watch";
    return "Weak";
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
          <Link href="/admin/executive" className="miniButton">Executive</Link>
          <Link href="/admin/demand-heatmap" className="miniButton">Demand</Link>
          <Link href="/admin/route-intelligence" className="miniButton">Routes</Link>
          <Link href="/admin/growth-intelligence" className="miniButton">Growth</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Market Intelligence</p>
            <h1>Market <span>Intelligence</span></h1>
            <p className="subtitle">
              Analyze routes, cities, states, market demand, expansion opportunities,
              revenue concentration and RoadLink market readiness.
            </p>
          </div>

          <div className={(platform?.marketScore || 0) < 55 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{platform?.marketScore || 0}</strong>
            <span>Market Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🌎" label="Market Score" value={`${platform?.marketScore || 0}/100`} />
          <Metric icon="🛣️" label="Routes" value={String(markets.filter((item) => item.type === "route").length)} />
          <Metric icon="🏙️" label="Cities" value={String(markets.filter((item) => item.type === "city").length)} />
          <Metric icon="📍" label="States" value={String(markets.filter((item) => item.type === "state").length)} />
          <Metric icon="🏆" label="Excellent" value={String(excellent)} />
          <Metric icon="🚀" label="Opportunities" value={String(opportunity)} />
          <Metric icon="👀" label="Watch" value={String(watch)} danger={watch > 0} />
          <Metric icon="⚠️" label="Weak" value={String(weak)} danger={weak > 0} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search route, city, state or insight..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | MarketStatus)}
          >
            <option value="all">All markets</option>
            <option value="excellent">Excellent</option>
            <option value="opportunity">Opportunity</option>
            <option value="watch">Watch</option>
            <option value="weak">Weak</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="marketCard">
            <p className="eyebrow">Market Rankings</p>
            <h2>Expansion Signals</h2>

            {filteredMarkets.length === 0 ? (
              <div className="empty">
                <h3>No market data found</h3>
                <p>Market signals will appear after users, rides and bookings exist.</p>
              </div>
            ) : (
              <div className="marketList">
                {filteredMarkets.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "marketRow activeMarket" : "marketRow"}
                  >
                    <div className={`marketIcon ${item.status}`}>
                      {item.status === "excellent"
                        ? "🏆"
                        : item.status === "opportunity"
                        ? "🚀"
                        : item.status === "watch"
                        ? "👀"
                        : "⚠️"}
                    </div>

                    <div className="marketInfo">
                      <strong>{shortText(item.title)}</strong>
                      <span>{item.type.toUpperCase()} • Score {item.marketScore}/100</span>
                      <small>{item.bookings} booking(s) • {money(item.revenue)}</small>
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
                    <p className="eyebrow">Selected Market</p>
                    <h2>{shortText(selected.title, 54)}</h2>
                    <p className="email">{selected.insight}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>Market Score</span>
                  <strong>{selected.marketScore}/100</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="scoreBar">
                  <div style={{ width: `${selected.marketScore}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Type" value={selected.type} />
                  <Info label="Market Score" value={`${selected.marketScore}/100`} />
                  <Info label="Demand Score" value={`${selected.demandScore}/100`} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Users" value={String(selected.users)} />
                  <Info label="Drivers" value={String(selected.drivers)} />
                  <Info label="Rides" value={String(selected.rides)} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Completed" value={String(selected.completed)} />
                  <Info label="Cancelled" value={String(selected.cancelled)} />
                  <Info label="Revenue" value={money(selected.revenue)} />
                  <Info label="Expansion" value={selected.status === "excellent" || selected.status === "opportunity" ? "Recommended" : "Wait"} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Market Recommendation</p>
                  <h2>
                    {selected.status === "excellent"
                      ? "Scale this market"
                      : selected.status === "opportunity"
                      ? "Test expansion"
                      : selected.status === "watch"
                      ? "Monitor demand"
                      : "Do not expand yet"}
                  </h2>
                  <p>{selected.insight}</p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveMarketInsight(selected)}
                    disabled={savingId === selected.id}
                  >
                    Save Insight
                  </button>

                  <Link href="/admin/demand-heatmap" className="linkButton">Demand</Link>
                  <Link href="/admin/route-intelligence" className="linkButton">Routes</Link>
                  <Link href="/admin/growth-intelligence" className="dangerButton">Growth</Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select market</h3>
                <p>Choose a market signal to view details.</p>
              </div>
            )}
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
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
        .marketCard,
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

        h1 { font-size: 58px; line-height: 1; margin: 0 0 16px; }
        h1 span, h2, .metricValue { color: #22c55e; }
        h2 { font-size: 30px; margin: 0 0 14px; }

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
          min-width: 104px;
          height: 104px;
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
          font-size: 32px;
          font-weight: 900;
        }

        .warningScore strong { color: #fca5a5; }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
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

        .marketCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .marketList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .marketRow {
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

        .activeMarket {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .marketIcon {
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

        .marketIcon.watch {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .marketIcon.weak {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .marketInfo { min-width: 0; }

        .marketInfo strong,
        .marketInfo span,
        .marketInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .marketInfo span,
        .marketInfo small {
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
        .status.opportunity,
        .statusPill.excellent,
        .statusPill.opportunity {
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

        .status.weak,
        .statusPill.weak {
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

        .insightBox.weak {
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
        .insightBox.weak strong { color: #fca5a5; }

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
          .stats { grid-template-columns: repeat(2, 1fr); }
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

          .marketRow {
            grid-template-columns: 46px 1fr;
          }

          .marketRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .marketIcon {
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
