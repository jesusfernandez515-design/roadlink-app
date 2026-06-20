"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type PricingStatus = "premium" | "balanced" | "low" | "risk";

type BasicItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  price?: number;
  amount?: number;
  seats?: number;
  seatsBooked?: number;
  driverEmail?: string;
  passengerEmail?: string;
  createdAt?: string;
};

type PricingProfile = {
  id: string;
  route: string;
  rides: number;
  bookings: number;
  completed: number;
  cancelled: number;
  seatsBooked: number;
  averagePrice: number;
  revenue: number;
  demandScore: number;
  recommendedPrice: number;
  minimumPrice: number;
  maximumPrice: number;
  surgeMultiplier: number;
  status: PricingStatus;
  insight: string;
};

export default function AdminDynamicPricingPage() {
  const [rides, setRides] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [selected, setSelected] = useState<PricingProfile | null>(null);
  const [filter, setFilter] = useState<"all" | PricingStatus>("all");
  const [message, setMessage] = useState("Loading dynamic pricing...");
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

    const unsubRides = listen<BasicItem>("rides", setRides);
    const unsubBookings = listen<BasicItem>("bookings", setBookings);

    return () => {
      unsubRides();
      unsubBookings();
    };
  }, []);

  const pricing = useMemo(() => {
    const routeMap = new Map<string, BasicItem[]>();

    rides.forEach((ride) => {
      const route = `${ride.from || "Unknown Origin"} → ${ride.to || "Unknown Destination"}`;
      if (!routeMap.has(route)) routeMap.set(route, []);
      routeMap.get(route)?.push(ride);
    });

    const profiles: PricingProfile[] = Array.from(routeMap.entries()).map(([route, routeRides]) => {
      const rideIds = routeRides.map((ride) => ride.id);

      const routeBookings = bookings.filter((booking) =>
        rideIds.includes(booking.id) || rideIds.includes(booking.status || "")
      );

      const relatedBookings = bookings.filter((booking) => {
        const sameRoute = routeRides.some((ride) => {
          const bookingFrom = booking.from || "";
          const bookingTo = booking.to || "";
          return (
            bookingFrom === ride.from ||
            bookingTo === ride.to ||
            route.includes(bookingFrom) ||
            route.includes(bookingTo)
          );
        });

        return sameRoute || routeBookings.includes(booking);
      });

      const completed = relatedBookings.filter((item) => item.status === "completed").length;

      const cancelled = relatedBookings.filter(
        (item) =>
          item.status === "cancelled" ||
          item.status === "rejected" ||
          item.status === "no_show"
      ).length;

      const seatsBooked = relatedBookings.reduce(
        (total, item) => total + Number(item.seatsBooked || 1),
        0
      );

      const revenue = relatedBookings.reduce(
        (total, item) =>
          total +
          Number(item.price || item.amount || 0) *
            Number(item.seatsBooked || 1),
        0
      );

      const ridePrices = routeRides
        .map((ride) => Number(ride.price || 0))
        .filter((price) => price > 0);

      const bookingPrices = relatedBookings
        .map((booking) => Number(booking.price || booking.amount || 0))
        .filter((price) => price > 0);

      const allPrices = [...ridePrices, ...bookingPrices];

      const averagePrice =
        allPrices.length > 0
          ? allPrices.reduce((total, price) => total + price, 0) / allPrices.length
          : 25;

      const demandScore = Math.max(
        Math.min(
          routeRides.length * 8 +
            relatedBookings.length * 12 +
            completed * 8 +
            seatsBooked * 4 -
            cancelled * 8,
          100
        ),
        0
      );

      let surgeMultiplier = 1;

      if (demandScore >= 85) surgeMultiplier = 1.45;
      else if (demandScore >= 70) surgeMultiplier = 1.25;
      else if (demandScore >= 50) surgeMultiplier = 1.1;
      else if (demandScore <= 20) surgeMultiplier = 0.9;

      const recommendedPrice = Math.max(Math.round(averagePrice * surgeMultiplier), 5);
      const minimumPrice = Math.max(Math.round(recommendedPrice * 0.75), 5);
      const maximumPrice = Math.max(Math.round(recommendedPrice * 1.35), recommendedPrice);

      const status: PricingStatus =
        demandScore >= 80
          ? "premium"
          : demandScore >= 50
          ? "balanced"
          : demandScore >= 25
          ? "low"
          : "risk";

      const insight =
        status === "premium"
          ? "High demand route. Premium pricing is recommended."
          : status === "balanced"
          ? "Healthy demand. Keep pricing balanced and competitive."
          : status === "low"
          ? "Low demand. Consider discounts or marketing before raising prices."
          : "Weak demand. Avoid surge pricing until activity improves.";

      return {
        id: route.toLowerCase().replaceAll("/", "-").replaceAll(" ", "-"),
        route,
        rides: routeRides.length,
        bookings: relatedBookings.length,
        completed,
        cancelled,
        seatsBooked,
        averagePrice,
        revenue,
        demandScore,
        recommendedPrice,
        minimumPrice,
        maximumPrice,
        surgeMultiplier,
        status,
        insight,
      };
    });

    return profiles.sort((a, b) => b.demandScore + b.revenue / 100 - (a.demandScore + a.revenue / 100));
  }, [rides, bookings]);

  const filteredPricing = useMemo(() => {
    if (filter === "all") return pricing;
    return pricing.filter((item) => item.status === filter);
  }, [pricing, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredPricing.length === 0) return null;
      if (!current) return filteredPricing[0];
      return filteredPricing.find((item) => item.id === current.id) || filteredPricing[0];
    });
  }, [filteredPricing]);

  const premium = pricing.filter((item) => item.status === "premium").length;
  const balanced = pricing.filter((item) => item.status === "balanced").length;
  const low = pricing.filter((item) => item.status === "low").length;
  const risk = pricing.filter((item) => item.status === "risk").length;

  const averageRecommended =
    pricing.length > 0
      ? pricing.reduce((total, item) => total + item.recommendedPrice, 0) / pricing.length
      : 0;

  async function savePricing(item: PricingProfile) {
    try {
      setSavingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "dynamicPricingInsights", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `dynamic-pricing-${item.id}-${Date.now()}`),
        {
          action: "Dynamic Pricing Insight Saved",
          targetId: item.id,
          targetType: "dynamicPricing",
          details: `${item.route}: recommended price $${item.recommendedPrice}`,
          severity: item.status === "risk" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Dynamic pricing insight saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save pricing insight.");
    } finally {
      setSavingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status: PricingStatus) {
    if (status === "premium") return "Premium";
    if (status === "balanced") return "Balanced";
    if (status === "low") return "Low";
    return "Risk";
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
          <Link href="/admin/revenue-intelligence" className="miniButton">Revenue</Link>
          <Link href="/admin/demand-heatmap" className="miniButton">Demand</Link>
          <Link href="/admin/route-intelligence" className="miniButton">Routes</Link>
          <Link href="/admin/financial-forecast" className="miniButton">Forecast</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Revenue Engine</p>
            <h1>Dynamic <span>Pricing</span></h1>
            <p className="subtitle">
              Calculate recommended prices by route using demand, bookings, completed trips,
              cancellations, seats booked, revenue and surge multipliers.
            </p>
          </div>

          <div className={risk > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{money(averageRecommended)}</strong>
            <span>Avg Price</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💎" label="Premium Routes" value={String(premium)} />
          <Metric icon="✅" label="Balanced" value={String(balanced)} />
          <Metric icon="📉" label="Low Demand" value={String(low)} danger={low > 0} />
          <Metric icon="⚠️" label="Risk Routes" value={String(risk)} danger={risk > 0} />
          <Metric icon="🛣️" label="Routes" value={String(pricing.length)} />
          <Metric icon="💰" label="Avg Recommended" value={money(averageRecommended)} />
        </section>

        <section className="filters">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | PricingStatus)}
          >
            <option value="all">All pricing routes</option>
            <option value="premium">Premium</option>
            <option value="balanced">Balanced</option>
            <option value="low">Low Demand</option>
            <option value="risk">Risk</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="pricingCard">
            <p className="eyebrow">Pricing Queue</p>
            <h2>Route Prices</h2>

            {filteredPricing.length === 0 ? (
              <div className="empty">
                <h3>No pricing data found</h3>
                <p>Dynamic pricing will appear after rides and bookings exist.</p>
              </div>
            ) : (
              <div className="pricingList">
                {filteredPricing.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "pricingRow activePricing" : "pricingRow"}
                  >
                    <div className={`pricingIcon ${item.status}`}>
                      {item.status === "premium"
                        ? "💎"
                        : item.status === "balanced"
                        ? "✅"
                        : item.status === "low"
                        ? "📉"
                        : "⚠️"}
                    </div>

                    <div className="pricingInfo">
                      <strong>{shortText(item.route)}</strong>
                      <span>Recommended {money(item.recommendedPrice)} • {item.surgeMultiplier.toFixed(2)}x</span>
                      <small>{item.bookings} booking(s) • Demand {item.demandScore}/100</small>
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
                    <h2>{shortText(selected.route, 56)}</h2>
                    <p className="email">{selected.insight}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>Recommended Price</span>
                  <strong>{money(selected.recommendedPrice)}</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="priceGrid">
                  <div>
                    <span>Minimum</span>
                    <strong>{money(selected.minimumPrice)}</strong>
                  </div>
                  <div>
                    <span>Recommended</span>
                    <strong>{money(selected.recommendedPrice)}</strong>
                  </div>
                  <div>
                    <span>Maximum</span>
                    <strong>{money(selected.maximumPrice)}</strong>
                  </div>
                </div>

                <div className="scoreBar">
                  <div style={{ width: `${selected.demandScore}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Route" value={selected.route} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Demand Score" value={`${selected.demandScore}/100`} />
                  <Info label="Surge Multiplier" value={`${selected.surgeMultiplier.toFixed(2)}x`} />
                  <Info label="Average Price" value={money(selected.averagePrice)} />
                  <Info label="Recommended Price" value={money(selected.recommendedPrice)} />
                  <Info label="Minimum Price" value={money(selected.minimumPrice)} />
                  <Info label="Maximum Price" value={money(selected.maximumPrice)} />
                  <Info label="Rides" value={String(selected.rides)} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Completed" value={String(selected.completed)} />
                  <Info label="Cancelled" value={String(selected.cancelled)} />
                  <Info label="Seats Booked" value={String(selected.seatsBooked)} />
                  <Info label="Revenue" value={money(selected.revenue)} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Pricing Recommendation</p>
                  <h2>
                    {selected.status === "premium"
                      ? "Use premium pricing"
                      : selected.status === "balanced"
                      ? "Keep balanced pricing"
                      : selected.status === "low"
                      ? "Use discounts carefully"
                      : "Do not increase price yet"}
                  </h2>
                  <p>{selected.insight}</p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => savePricing(selected)}
                    disabled={savingId === selected.id}
                  >
                    Save Pricing
                  </button>

                  <Link href="/admin/demand-heatmap" className="linkButton">Demand</Link>
                  <Link href="/admin/revenue-intelligence" className="linkButton">Revenue</Link>
                  <Link href="/admin/route-intelligence" className="dangerButton">Routes</Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a route</h3>
                <p>Choose a route to view dynamic pricing details.</p>
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
        .pricingCard,
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
          padding: 10px;
        }

        .warningScore {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 28px;
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
          grid-template-columns: repeat(3, 1fr);
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
          grid-template-columns: 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

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

        .pricingCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .pricingList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .pricingRow {
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

        .activePricing {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .pricingIcon {
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

        .pricingIcon.low {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .pricingIcon.risk {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .pricingInfo { min-width: 0; }

        .pricingInfo strong,
        .pricingInfo span,
        .pricingInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pricingInfo span,
        .pricingInfo small {
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

        .status.premium,
        .status.balanced,
        .statusPill.premium,
        .statusPill.balanced {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.low,
        .statusPill.low {
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

        .insightBox.low {
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

        .insightBox.low strong { color: #fde68a; }
        .insightBox.risk strong { color: #fca5a5; }

        .priceGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .priceGrid div {
          padding: 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .priceGrid span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .priceGrid strong {
          color: #22c55e;
          font-size: 24px;
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
          .priceGrid,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .pricingRow {
            grid-template-columns: 46px 1fr;
          }

          .pricingRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .pricingIcon {
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
