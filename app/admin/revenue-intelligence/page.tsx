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

type PayoutItem = {
  id: string;
  status?: string;
  amount?: number;
  driverEmail?: string;
  email?: string;
  createdAt?: string;
};

type RevenueProfile = {
  id: string;
  title: string;
  type: "route" | "driver" | "booking";
  revenue: number;
  bookings: number;
  completed: number;
  cancelled: number;
  payoutExposure: number;
  platformFee: number;
  netRevenue: number;
  status: "strong" | "growing" | "watch" | "leak";
  insight: string;
};

export default function AdminRevenueIntelligencePage() {
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [selected, setSelected] = useState<RevenueProfile | null>(null);
  const [filter, setFilter] = useState<"all" | RevenueProfile["status"]>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading revenue intelligence...");
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
    const unsubPayouts = listen("payoutRequests", setPayouts);

    return () => {
      unsubRides();
      unsubBookings();
      unsubPayouts();
    };
  }, []);

  const revenueProfiles = useMemo<RevenueProfile[]>(() => {
    const routeMap = new Map<string, RideItem[]>();

    rides.forEach((ride) => {
      const from = ride.from || "Unknown Origin";
      const to = ride.to || "Unknown Destination";
      const key = `${from} → ${to}`;

      if (!routeMap.has(key)) routeMap.set(key, []);
      routeMap.get(key)?.push(ride);
    });

    const routeProfiles = Array.from(routeMap.entries()).map(([route, routeRides]) => {
      const rideIds = routeRides.map((ride) => ride.id);

      const routeBookings = bookings.filter((booking) =>
        rideIds.includes(booking.rideId || "")
      );

      const revenue = routeBookings.reduce(
        (total, booking) =>
          total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1),
        0
      );

      const completed = routeBookings.filter((item) => item.status === "completed").length;

      const cancelled = routeBookings.filter(
        (item) =>
          item.status === "cancelled" ||
          item.status === "rejected" ||
          item.status === "no_show"
      ).length;

      const platformFee = revenue * 0.12;
      const netRevenue = revenue - platformFee;

      const status: RevenueProfile["status"] =
        cancelled > completed && routeBookings.length > 0
          ? "leak"
          : revenue >= 500
          ? "strong"
          : revenue >= 100
          ? "growing"
          : "watch";

      const insight =
        status === "strong"
          ? "Strong revenue route. Keep promoting and recruit more drivers."
          : status === "growing"
          ? "Revenue is growing. This route may become profitable with more supply."
          : status === "leak"
          ? "Revenue leak detected. Cancellations are hurting this route."
          : "Low revenue route. Monitor demand before spending marketing budget.";

      return {
        id: `route-${route.toLowerCase().replaceAll("/", "-")}`,
        title: route,
        type: "route",
        revenue,
        bookings: routeBookings.length,
        completed,
        cancelled,
        payoutExposure: 0,
        platformFee,
        netRevenue,
        status,
        insight,
      };
    });

    const driverMap = new Map<string, BookingItem[]>();

    bookings.forEach((booking) => {
      const driver = booking.driverEmail || "No driver";
      if (!driverMap.has(driver)) driverMap.set(driver, []);
      driverMap.get(driver)?.push(booking);
    });

    const driverProfiles = Array.from(driverMap.entries()).map(([driver, driverBookings]) => {
      const revenue = driverBookings.reduce(
        (total, booking) =>
          total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1),
        0
      );

      const completed = driverBookings.filter((item) => item.status === "completed").length;

      const cancelled = driverBookings.filter(
        (item) =>
          item.status === "cancelled" ||
          item.status === "rejected" ||
          item.status === "no_show"
      ).length;

      const driverPayouts = payouts.filter(
        (payout) => payout.driverEmail === driver || payout.email === driver
      );

      const payoutExposure = driverPayouts
        .filter((item) => item.status === "pending" || item.status === "approved")
        .reduce((total, item) => total + Number(item.amount || 0), 0);

      const platformFee = revenue * 0.12;
      const netRevenue = revenue - payoutExposure;

      const status: RevenueProfile["status"] =
        payoutExposure > revenue && revenue > 0
          ? "leak"
          : revenue >= 500
          ? "strong"
          : revenue >= 100
          ? "growing"
          : "watch";

      const insight =
        status === "strong"
          ? "High value driver. Protect retention and monitor payouts."
          : status === "growing"
          ? "Driver revenue is growing. Consider incentives."
          : status === "leak"
          ? "Payout exposure is higher than revenue. Review before paying."
          : "Low revenue driver profile.";

      return {
        id: `driver-${driver.toLowerCase().replaceAll("/", "-")}`,
        title: driver,
        type: "driver",
        revenue,
        bookings: driverBookings.length,
        completed,
        cancelled,
        payoutExposure,
        platformFee,
        netRevenue,
        status,
        insight,
      };
    });

    return [...routeProfiles, ...driverProfiles].sort(
      (a, b) => b.revenue + b.netRevenue - (a.revenue + a.netRevenue)
    );
  }, [rides, bookings, payouts]);

  const filteredProfiles = useMemo(() => {
    const text = search.toLowerCase().trim();

    return revenueProfiles.filter((item) => {
      const matchesSearch =
        !text ||
        item.title.toLowerCase().includes(text) ||
        item.type.toLowerCase().includes(text) ||
        item.insight.toLowerCase().includes(text);

      const matchesFilter = filter === "all" || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [revenueProfiles, search, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredProfiles.length === 0) return null;
      if (!current) return filteredProfiles[0];
      return filteredProfiles.find((item) => item.id === current.id) || filteredProfiles[0];
    });
  }, [filteredProfiles]);

  const totalRevenue = bookings.reduce(
    (total, booking) =>
      total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1),
    0
  );

  const pendingPayoutExposure = payouts
    .filter((item) => item.status === "pending" || item.status === "approved")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const platformFees = totalRevenue * 0.12;
  const netPlatformRevenue = totalRevenue - pendingPayoutExposure;
  const strong = revenueProfiles.filter((item) => item.status === "strong").length;
  const growing = revenueProfiles.filter((item) => item.status === "growing").length;
  const watch = revenueProfiles.filter((item) => item.status === "watch").length;
  const leak = revenueProfiles.filter((item) => item.status === "leak").length;

  async function saveRevenueInsight(item: RevenueProfile) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "revenueInsights", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `revenue-intel-${item.id}-${Date.now()}`),
        {
          action: "Revenue Intelligence Saved",
          targetId: item.id,
          targetType: "revenueInsight",
          details: item.insight,
          severity: item.status === "leak" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Revenue insight saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save revenue insight.");
    } finally {
      setLoadingId("");
    }
  }

  function statusLabel(status: RevenueProfile["status"]) {
    if (status === "strong") return "Strong";
    if (status === "growing") return "Growing";
    if (status === "leak") return "Leak";
    return "Watch";
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
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/route-intelligence" className="miniButton">Routes</Link>
          <Link href="/admin/demand-heatmap" className="miniButton">Demand</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Finance Intelligence</p>
            <h1>Revenue <span>Intelligence</span></h1>
            <p className="subtitle">
              Analyze route revenue, driver revenue, payout exposure, revenue leaks,
              net platform earnings and financial growth signals.
            </p>
          </div>

          <div className={leak > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{money(totalRevenue)}</strong>
            <span>Total Revenue</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💰" label="Gross Revenue" value={money(totalRevenue)} />
          <Metric icon="🏦" label="Payout Exposure" value={money(pendingPayoutExposure)} danger={pendingPayoutExposure > 0} />
          <Metric icon="📊" label="Platform Fees" value={money(platformFees)} />
          <Metric icon="💵" label="Net Platform" value={money(netPlatformRevenue)} danger={netPlatformRevenue < 0} />
          <Metric icon="📈" label="Growing" value={String(growing)} />
          <Metric icon="🚨" label="Revenue Leaks" value={String(leak)} danger={leak > 0} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search route, driver or insight..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | RevenueProfile["status"])}
          >
            <option value="all">All revenue</option>
            <option value="strong">Strong</option>
            <option value="growing">Growing</option>
            <option value="watch">Watch</option>
            <option value="leak">Leak</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="revenueCard">
            <p className="eyebrow">Revenue Rankings</p>
            <h2>Financial Signals</h2>

            {filteredProfiles.length === 0 ? (
              <div className="empty">
                <h3>No revenue data found</h3>
                <p>Revenue profiles will appear after bookings are created.</p>
              </div>
            ) : (
              <div className="revenueList">
                {filteredProfiles.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "revenueRow activeRevenue" : "revenueRow"}
                  >
                    <div className={`revenueIcon ${item.status}`}>
                      {item.status === "leak"
                        ? "🚨"
                        : item.status === "strong"
                        ? "💰"
                        : item.status === "growing"
                        ? "📈"
                        : "👀"}
                    </div>

                    <div className="revenueInfo">
                      <strong>{shortText(item.title)}</strong>
                      <span>{item.type.toUpperCase()} • {item.bookings} booking(s)</span>
                      <small>{money(item.revenue)} gross • {money(item.netRevenue)} net</small>
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
                    <p className="eyebrow">Selected Revenue Signal</p>
                    <h2>{shortText(selected.title, 54)}</h2>
                    <p className="email">{selected.insight}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>AI Revenue Insight</span>
                  <strong>{money(selected.revenue)}</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="infoGrid">
                  <Info label="Type" value={selected.type} />
                  <Info label="Gross Revenue" value={money(selected.revenue)} />
                  <Info label="Net Revenue" value={money(selected.netRevenue)} />
                  <Info label="Platform Fee Estimate" value={money(selected.platformFee)} />
                  <Info label="Payout Exposure" value={money(selected.payoutExposure)} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Completed" value={String(selected.completed)} />
                  <Info label="Cancelled / Failed" value={String(selected.cancelled)} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Revenue Leak" value={selected.status === "leak" ? "Yes" : "No"} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Executive Summary</p>
                  <h2>{leak > 0 ? "Revenue leaks need review" : "Revenue system looks stable"}</h2>
                  <p>
                    Gross revenue is {money(totalRevenue)}, pending payout exposure is{" "}
                    {money(pendingPayoutExposure)}, and estimated platform fees are{" "}
                    {money(platformFees)}.
                  </p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveRevenueInsight(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Insight
                  </button>

                  <Link href="/admin/payouts" className="linkButton">
                    Payouts
                  </Link>

                  <Link href="/admin/revenue" className="linkButton">
                    Revenue
                  </Link>

                  <Link href="/admin/route-intelligence" className="dangerButton">
                    Routes
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select revenue data</h3>
                <p>Choose a revenue signal to view details.</p>
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
        .revenueCard,
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
          min-width: 116px;
          height: 116px;
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
          font-size: 24px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fca5a5;
        }

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

        .revenueCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .revenueList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .revenueRow {
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

        .activeRevenue {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .revenueIcon {
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

        .revenueIcon.watch {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .revenueIcon.leak {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .revenueInfo { min-width: 0; }

        .revenueInfo strong,
        .revenueInfo span,
        .revenueInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .revenueInfo span,
        .revenueInfo small {
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

        .status.strong,
        .status.growing,
        .statusPill.strong,
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

        .status.leak,
        .statusPill.leak {
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

        .insightBox.leak {
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

        .insightBox.leak strong {
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

          .revenueRow {
            grid-template-columns: 46px 1fr;
          }

          .revenueRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .revenueIcon {
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
