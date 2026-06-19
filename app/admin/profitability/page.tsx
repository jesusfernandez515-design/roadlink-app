"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ProfitStatus = "profitable" | "growing" | "watch" | "loss";
type ProfitType = "route" | "driver" | "platform";

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
  driverEmail?: string;
  passengerEmail?: string;
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

type PaymentItem = {
  id: string;
  status?: string;
  amount?: number;
  fee?: number;
  processorFee?: number;
  platformFee?: number;
  driverEmail?: string;
  rideId?: string;
  createdAt?: string;
};

type ProfitProfile = {
  id: string;
  title: string;
  type: ProfitType;
  grossRevenue: number;
  platformFees: number;
  payoutExposure: number;
  processingFees: number;
  estimatedCosts: number;
  netProfit: number;
  margin: number;
  bookings: number;
  completed: number;
  cancelled: number;
  status: ProfitStatus;
  insight: string;
};

export default function AdminProfitabilityPage() {
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [selected, setSelected] = useState<ProfitProfile | null>(null);
  const [filter, setFilter] = useState<"all" | ProfitStatus>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading profitability center...");
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

    const unsubRides = listen<RideItem>("rides", setRides);
    const unsubBookings = listen<BookingItem>("bookings", setBookings);
    const unsubPayouts = listen<PayoutItem>("payoutRequests", setPayouts);
    const unsubPayments = listen<PaymentItem>("payments", setPayments);

    return () => {
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubPayments();
    };
  }, []);

  const profiles = useMemo<ProfitProfile[]>(() => {
    const calculateStatus = (netProfit: number, margin: number): ProfitStatus => {
      if (netProfit < 0 || margin < 0) return "loss";
      if (margin >= 30) return "profitable";
      if (margin >= 12) return "growing";
      return "watch";
    };

    const buildInsight = (status: ProfitStatus, type: ProfitType) => {
      if (status === "profitable") {
        return `${type} is profitable. Keep scaling while monitoring payout exposure.`;
      }

      if (status === "growing") {
        return `${type} is growing but margin can improve with better pricing or lower costs.`;
      }

      if (status === "loss") {
        return `${type} is losing money. Review payouts, cancellations and pricing immediately.`;
      }

      return `${type} needs monitoring. Profit margin is low or activity is still limited.`;
    };

    const rideRevenue = (rideIds: string[]) => {
      const relatedBookings = bookings.filter((booking) =>
        rideIds.includes(booking.rideId || "")
      );

      const grossRevenue = relatedBookings.reduce(
        (total, booking) =>
          total +
          Number(booking.price || booking.amount || 0) *
            Number(booking.seatsBooked || 1),
        0
      );

      const completed = relatedBookings.filter(
        (booking) => booking.status === "completed"
      ).length;

      const cancelled = relatedBookings.filter(
        (booking) =>
          booking.status === "cancelled" ||
          booking.status === "rejected" ||
          booking.status === "no_show"
      ).length;

      return {
        relatedBookings,
        grossRevenue,
        completed,
        cancelled,
      };
    };

    const routeMap = new Map<string, RideItem[]>();

    rides.forEach((ride) => {
      const from = ride.from || "Unknown Origin";
      const to = ride.to || "Unknown Destination";
      const key = `${from} → ${to}`;

      if (!routeMap.has(key)) routeMap.set(key, []);
      routeMap.get(key)?.push(ride);
    });

    const routeProfiles: ProfitProfile[] = Array.from(routeMap.entries()).map(
      ([route, routeRides]) => {
        const rideIds = routeRides.map((ride) => ride.id);
        const revenueData = rideRevenue(rideIds);

        const routePayments = payments.filter((payment) =>
          rideIds.includes(payment.rideId || "")
        );

        const platformFees =
          routePayments.reduce(
            (total, payment) => total + Number(payment.platformFee || payment.fee || 0),
            0
          ) || revenueData.grossRevenue * 0.12;

        const processingFees =
          routePayments.reduce(
            (total, payment) => total + Number(payment.processorFee || 0),
            0
          ) || revenueData.grossRevenue * 0.03;

        const driverEmails = routeRides
          .map((ride) => ride.driverEmail)
          .filter(Boolean) as string[];

        const payoutExposure = payouts
          .filter(
            (payout) =>
              (payout.status === "pending" || payout.status === "approved") &&
              driverEmails.includes(payout.driverEmail || payout.email || "")
          )
          .reduce((total, payout) => total + Number(payout.amount || 0), 0);

        const estimatedCosts = processingFees + revenueData.cancelled * 4;
        const netProfit = platformFees - estimatedCosts;
        const margin =
          revenueData.grossRevenue > 0 ? (netProfit / revenueData.grossRevenue) * 100 : 0;

        const status = calculateStatus(netProfit, margin);

        return {
          id: `route-${route.toLowerCase().replaceAll("/", "-")}`,
          title: route,
          type: "route",
          grossRevenue: revenueData.grossRevenue,
          platformFees,
          payoutExposure,
          processingFees,
          estimatedCosts,
          netProfit,
          margin,
          bookings: revenueData.relatedBookings.length,
          completed: revenueData.completed,
          cancelled: revenueData.cancelled,
          status,
          insight: buildInsight(status, "route"),
        };
      }
    );

    const driverMap = new Map<string, BookingItem[]>();

    bookings.forEach((booking) => {
      const driver = booking.driverEmail || "No driver";
      if (!driverMap.has(driver)) driverMap.set(driver, []);
      driverMap.get(driver)?.push(booking);
    });

    const driverProfiles: ProfitProfile[] = Array.from(driverMap.entries()).map(
      ([driver, driverBookings]) => {
        const grossRevenue = driverBookings.reduce(
          (total, booking) =>
            total +
            Number(booking.price || booking.amount || 0) *
              Number(booking.seatsBooked || 1),
          0
        );

        const completed = driverBookings.filter(
          (booking) => booking.status === "completed"
        ).length;

        const cancelled = driverBookings.filter(
          (booking) =>
            booking.status === "cancelled" ||
            booking.status === "rejected" ||
            booking.status === "no_show"
        ).length;

        const driverPayouts = payouts.filter(
          (payout) => payout.driverEmail === driver || payout.email === driver
        );

        const payoutExposure = driverPayouts
          .filter((payout) => payout.status === "pending" || payout.status === "approved")
          .reduce((total, payout) => total + Number(payout.amount || 0), 0);

        const platformFees = grossRevenue * 0.12;
        const processingFees = grossRevenue * 0.03;
        const estimatedCosts = processingFees + cancelled * 4;
        const netProfit = platformFees - estimatedCosts;
        const margin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
        const status = calculateStatus(netProfit, margin);

        return {
          id: `driver-${driver.toLowerCase().replaceAll("/", "-")}`,
          title: driver,
          type: "driver",
          grossRevenue,
          platformFees,
          payoutExposure,
          processingFees,
          estimatedCosts,
          netProfit,
          margin,
          bookings: driverBookings.length,
          completed,
          cancelled,
          status,
          insight: buildInsight(status, "driver"),
        };
      }
    );

    const grossRevenue = bookings.reduce(
      (total, booking) =>
        total +
        Number(booking.price || booking.amount || 0) *
          Number(booking.seatsBooked || 1),
      0
    );

    const platformFees =
      payments.reduce(
        (total, payment) => total + Number(payment.platformFee || payment.fee || 0),
        0
      ) || grossRevenue * 0.12;

    const processingFees =
      payments.reduce(
        (total, payment) => total + Number(payment.processorFee || 0),
        0
      ) || grossRevenue * 0.03;

    const payoutExposure = payouts
      .filter((payout) => payout.status === "pending" || payout.status === "approved")
      .reduce((total, payout) => total + Number(payout.amount || 0), 0);

    const completed = bookings.filter((booking) => booking.status === "completed").length;

    const cancelled = bookings.filter(
      (booking) =>
        booking.status === "cancelled" ||
        booking.status === "rejected" ||
        booking.status === "no_show"
    ).length;

    const estimatedCosts = processingFees + cancelled * 4;
    const netProfit = platformFees - estimatedCosts;
    const margin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    const status = calculateStatus(netProfit, margin);

    const platformProfile: ProfitProfile = {
      id: "platform-overview",
      title: "RoadLink Platform",
      type: "platform",
      grossRevenue,
      platformFees,
      payoutExposure,
      processingFees,
      estimatedCosts,
      netProfit,
      margin,
      bookings: bookings.length,
      completed,
      cancelled,
      status,
      insight: buildInsight(status, "platform"),
    };

    return [platformProfile, ...routeProfiles, ...driverProfiles].sort(
      (a, b) => b.netProfit + b.grossRevenue - (a.netProfit + a.grossRevenue)
    );
  }, [rides, bookings, payouts, payments]);

  const filteredProfiles = useMemo(() => {
    const text = search.toLowerCase().trim();

    return profiles.filter((item) => {
      const matchesSearch =
        !text ||
        item.title.toLowerCase().includes(text) ||
        item.type.toLowerCase().includes(text) ||
        item.insight.toLowerCase().includes(text);

      const matchesFilter = filter === "all" || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [profiles, search, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredProfiles.length === 0) return null;
      if (!current) return filteredProfiles[0];
      return filteredProfiles.find((item) => item.id === current.id) || filteredProfiles[0];
    });
  }, [filteredProfiles]);

  const platform = profiles.find((item) => item.type === "platform");
  const profitable = profiles.filter((item) => item.status === "profitable").length;
  const growing = profiles.filter((item) => item.status === "growing").length;
  const watch = profiles.filter((item) => item.status === "watch").length;
  const loss = profiles.filter((item) => item.status === "loss").length;

  async function saveProfitInsight(item: ProfitProfile) {
    try {
      setLoadingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "profitabilityInsights", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `profitability-${item.id}-${Date.now()}`),
        {
          action: "Profitability Insight Saved",
          targetId: item.id,
          targetType: "profitabilityInsight",
          details: item.insight,
          severity: item.status === "loss" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Profitability insight saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save profitability insight.");
    } finally {
      setLoadingId("");
    }
  }

  function money(value?: number) {
    return `$${Math.round(value || 0).toLocaleString()}`;
  }

  function percent(value?: number) {
    return `${Math.round(value || 0)}%`;
  }

  function shortText(value?: string, max = 44) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  function statusLabel(status: ProfitStatus) {
    if (status === "profitable") return "Profitable";
    if (status === "growing") return "Growing";
    if (status === "loss") return "Loss";
    return "Watch";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/revenue-intelligence" className="miniButton">Revenue Intel</Link>
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/route-intelligence" className="miniButton">Routes</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Finance Intelligence</p>
            <h1>Profitability <span>Center</span></h1>
            <p className="subtitle">
              Track gross revenue, platform fees, payout exposure, processing costs,
              estimated operating costs, net profit and margins by platform, route and driver.
            </p>
          </div>

          <div className={loss > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{money(platform?.netProfit)}</strong>
            <span>Net Profit</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💰" label="Gross Revenue" value={money(platform?.grossRevenue)} />
          <Metric icon="📊" label="Platform Fees" value={money(platform?.platformFees)} />
          <Metric icon="💵" label="Net Profit" value={money(platform?.netProfit)} danger={(platform?.netProfit || 0) < 0} />
          <Metric icon="📈" label="Margin" value={percent(platform?.margin)} danger={(platform?.margin || 0) < 10} />
          <Metric icon="✅" label="Profitable" value={String(profitable)} />
          <Metric icon="🚨" label="Loss Signals" value={String(loss)} danger={loss > 0} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search platform, route, driver or insight..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | ProfitStatus)}
          >
            <option value="all">All profitability</option>
            <option value="profitable">Profitable</option>
            <option value="growing">Growing</option>
            <option value="watch">Watch</option>
            <option value="loss">Loss</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="profitCard">
            <p className="eyebrow">Profit Rankings</p>
            <h2>Profitability Signals</h2>

            {filteredProfiles.length === 0 ? (
              <div className="empty">
                <h3>No profitability data</h3>
                <p>Profit signals will appear after bookings, payouts or payments exist.</p>
              </div>
            ) : (
              <div className="profitList">
                {filteredProfiles.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "profitRow activeProfit" : "profitRow"}
                  >
                    <div className={`profitIcon ${item.status}`}>
                      {item.status === "loss"
                        ? "🚨"
                        : item.status === "profitable"
                        ? "💰"
                        : item.status === "growing"
                        ? "📈"
                        : "👀"}
                    </div>

                    <div className="profitInfo">
                      <strong>{shortText(item.title)}</strong>
                      <span>{item.type.toUpperCase()} • Margin {percent(item.margin)}</span>
                      <small>{money(item.netProfit)} net • {money(item.grossRevenue)} gross</small>
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
                    <p className="eyebrow">Selected Profit Signal</p>
                    <h2>{shortText(selected.title, 54)}</h2>
                    <p className="email">{selected.insight}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>Net Profit</span>
                  <strong>{money(selected.netProfit)}</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="marginBar">
                  <div style={{ width: `${Math.max(Math.min(selected.margin, 100), 0)}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Type" value={selected.type} />
                  <Info label="Gross Revenue" value={money(selected.grossRevenue)} />
                  <Info label="Platform Fees" value={money(selected.platformFees)} />
                  <Info label="Payout Exposure" value={money(selected.payoutExposure)} />
                  <Info label="Processing Fees" value={money(selected.processingFees)} />
                  <Info label="Estimated Costs" value={money(selected.estimatedCosts)} />
                  <Info label="Net Profit" value={money(selected.netProfit)} />
                  <Info label="Profit Margin" value={percent(selected.margin)} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Completed" value={String(selected.completed)} />
                  <Info label="Cancelled / Failed" value={String(selected.cancelled)} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Profit Formula</p>
                  <h2>Platform fees minus costs</h2>
                  <p>
                    Profit is estimated using platform fees minus payment processing fees,
                    cancellation cost estimates and other operational exposure.
                  </p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveProfitInsight(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Save Insight
                  </button>

                  <Link href="/admin/revenue-intelligence" className="linkButton">
                    Revenue Intel
                  </Link>

                  <Link href="/admin/payouts" className="linkButton">
                    Payouts
                  </Link>

                  <Link href="/admin/route-intelligence" className="dangerButton">
                    Routes
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select profitability data</h3>
                <p>Choose a profit signal to view details.</p>
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
        .profitCard,
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

        .profitCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .profitList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .profitRow {
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

        .activeProfit {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .profitIcon {
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

        .profitIcon.watch {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
        }

        .profitIcon.loss {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .profitInfo { min-width: 0; }

        .profitInfo strong,
        .profitInfo span,
        .profitInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profitInfo span,
        .profitInfo small {
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

        .status.profitable,
        .status.growing,
        .statusPill.profitable,
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

        .status.loss,
        .statusPill.loss {
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

        .insightBox.loss {
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

        .insightBox.loss strong {
          color: #fca5a5;
        }

        .marginBar {
          width: 100%;
          height: 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          margin-bottom: 20px;
        }

        .marginBar div {
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

          .profitRow {
            grid-template-columns: 46px 1fr;
          }

          .profitRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .profitIcon {
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
