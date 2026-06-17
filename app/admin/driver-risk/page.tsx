"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type RiskLevel = "low" | "medium" | "high";

type UserItem = {
  id: string;
  name?: string;
  email?: string;
  driverVerified?: boolean;
  suspended?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type RideItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  createdAt?: string;
};

type ReportItem = {
  id: string;
  targetUserId?: string;
  targetUserEmail?: string;
  reporterEmail?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
};

type RatingItem = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  rating?: number;
  createdAt?: string;
};

type DriverRisk = {
  id: string;
  driverId: string;
  email: string;
  name: string;
  score: number;
  risk: RiskLevel;
  rides: number;
  completedRides: number;
  cancelledRides: number;
  bookings: number;
  reports: number;
  urgentReports: number;
  averageRating: number;
  suspended: boolean;
  reason: string;
};

export default function AdminDriverRiskPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [selected, setSelected] = useState<DriverRisk | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");
  const [message, setMessage] = useState("Loading driver risk center...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
    });

    const unsubReports = onSnapshot(query(collection(db, "reports")), (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
    });

    const unsubRatings = onSnapshot(query(collection(db, "ratings")), (snapshot) => {
      setRatings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RatingItem[]);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
      unsubRatings();
    };
  }, []);

  const driverRisks = useMemo<DriverRisk[]>(() => {
    return users
      .filter((user) => user.driverVerified || rides.some((ride) => ride.driverId === user.id || ride.driverEmail === user.email))
      .map((driver) => {
        const driverEmail = driver.email || "No email";

        const driverRides = rides.filter(
          (ride) => ride.driverId === driver.id || ride.driverEmail === driver.email
        );

        const driverBookings = bookings.filter(
          (booking) => booking.driverId === driver.id || booking.driverEmail === driver.email
        );

        const driverReports = reports.filter(
          (report) =>
            report.targetUserId === driver.id ||
            report.targetUserEmail === driver.email
        );

        const driverRatings = ratings.filter(
          (rating) => rating.driverId === driver.id || rating.driverEmail === driver.email
        );

        const completedRides = driverRides.filter((ride) => ride.status === "completed").length;

        const cancelledRides = driverRides.filter(
          (ride) => ride.status === "cancelled"
        ).length;

        const cancelledBookings = driverBookings.filter(
          (booking) =>
            booking.status === "cancelled" ||
            booking.status === "rejected" ||
            booking.status === "no_show"
        ).length;

        const urgentReports = driverReports.filter((report) => report.priority === "urgent").length;

        const averageRating =
          driverRatings.length > 0
            ? driverRatings.reduce((total, item) => total + Number(item.rating || 0), 0) / driverRatings.length
            : 5;

        let score = 0;

        score += driverReports.length * 20;
        score += urgentReports * 25;
        score += cancelledRides * 12;
        score += cancelledBookings * 8;

        if (averageRating < 4.5) score += 10;
        if (averageRating < 4) score += 15;
        if (averageRating < 3.5) score += 20;
        if (driver.suspended) score += 30;

        score = Math.min(score, 100);

        const risk: RiskLevel =
          score >= 70 ? "high" : score >= 35 ? "medium" : "low";

        const reasons: string[] = [];

        if (driverReports.length > 0) reasons.push(`${driverReports.length} report(s)`);
        if (urgentReports > 0) reasons.push(`${urgentReports} urgent report(s)`);
        if (cancelledRides > 0) reasons.push(`${cancelledRides} cancelled ride(s)`);
        if (cancelledBookings > 0) reasons.push(`${cancelledBookings} cancelled booking(s)`);
        if (averageRating < 4.5) reasons.push(`low rating ${averageRating.toFixed(1)}`);
        if (driver.suspended) reasons.push("account suspended");

        return {
          id: driver.id,
          driverId: driver.id,
          email: driverEmail,
          name: driver.name || "RoadLink Driver",
          score,
          risk,
          rides: driverRides.length,
          completedRides,
          cancelledRides,
          bookings: driverBookings.length,
          reports: driverReports.length,
          urgentReports,
          averageRating,
          suspended: Boolean(driver.suspended),
          reason: reasons.length > 0 ? reasons.join(", ") : "No major driver risk signals",
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [users, rides, bookings, reports, ratings]);

  const filteredDrivers = useMemo(() => {
    const text = search.toLowerCase().trim();

    return driverRisks.filter((driver) => {
      const matchesSearch =
        !text ||
        driver.email.toLowerCase().includes(text) ||
        driver.name.toLowerCase().includes(text) ||
        driver.driverId.toLowerCase().includes(text) ||
        driver.reason.toLowerCase().includes(text);

      const matchesRisk = riskFilter === "all" || driver.risk === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [driverRisks, search, riskFilter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredDrivers.length === 0) return null;
      if (!current) return filteredDrivers[0];
      return filteredDrivers.find((item) => item.id === current.id) || filteredDrivers[0];
    });
  }, [filteredDrivers]);

  const highRisk = driverRisks.filter((item) => item.risk === "high").length;
  const mediumRisk = driverRisks.filter((item) => item.risk === "medium").length;
  const lowRisk = driverRisks.filter((item) => item.risk === "low").length;
  const suspended = driverRisks.filter((item) => item.suspended).length;

  async function updateDriverSuspension(driver: DriverRisk, suspendedStatus: boolean) {
    try {
      setLoadingId(driver.driverId);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", driver.driverId),
        {
          suspended: suspendedStatus,
          driverRiskScore: driver.score,
          driverRiskLevel: driver.risk,
          driverRiskReason: driver.reason,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `driver-risk-${driver.driverId}-${Date.now()}`),
        {
          userId: driver.driverId,
          userEmail: driver.email,
          action: suspendedStatus ? "Driver Suspended From Risk Center" : "Driver Cleared From Risk Center",
          targetId: driver.driverId,
          targetType: "driver",
          details: driver.reason,
          severity: suspendedStatus ? "danger" : "success",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage(suspendedStatus ? "Driver suspended successfully." : "Driver cleared successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function markManualReview(driver: DriverRisk) {
    try {
      setLoadingId(driver.driverId);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "users", driver.driverId),
        {
          driverReviewStatus: "manual_review",
          driverRiskScore: driver.score,
          driverRiskLevel: driver.risk,
          driverRiskReason: driver.reason,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `driver-review-${driver.driverId}-${Date.now()}`),
        {
          userId: driver.driverId,
          userEmail: driver.email,
          action: "Driver Marked For Manual Review",
          targetId: driver.driverId,
          targetType: "driver",
          details: driver.reason,
          severity: driver.risk === "high" ? "warning" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Driver marked for manual review.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not mark driver for review.");
    } finally {
      setLoadingId("");
    }
  }

  function riskLabel(risk: RiskLevel) {
    if (risk === "high") return "High Risk";
    if (risk === "medium") return "Medium Risk";
    return "Low Risk";
  }

  function shortText(value: string, max = 38) {
    if (!value) return "Not available";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/fraud" className="miniButton">Fraud</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/rides" className="miniButton">Rides</Link>
          <Link href="/admin/operations" className="miniButton">Operations</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Safety</p>
            <h1>Driver <span>Risk Center</span></h1>
            <p className="subtitle">
              Detect risky drivers using reports, cancellations, ratings, bookings, completed rides and account status.
            </p>
          </div>

          <div className={highRisk > 0 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{highRisk}</strong>
            <span>High Risk</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🚘" label="Drivers Scanned" value={String(driverRisks.length)} />
          <Metric icon="🚨" label="High Risk" value={String(highRisk)} danger={highRisk > 0} />
          <Metric icon="⚠️" label="Medium Risk" value={String(mediumRisk)} danger={mediumRisk > 0} />
          <Metric icon="✅" label="Low Risk" value={String(lowRisk)} />
          <Metric icon="⛔" label="Suspended" value={String(suspended)} danger={suspended > 0} />
          <Metric icon="📋" label="Filtered" value={String(filteredDrivers.length)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search driver, email, UID, reason..."
          />

          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as "all" | RiskLevel)}
          >
            <option value="all">All risk levels</option>
            <option value="high">High risk</option>
            <option value="medium">Medium risk</option>
            <option value="low">Low risk</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="driversCard">
            <p className="eyebrow">Risk Queue</p>
            <h2>Driver Watchlist</h2>

            {filteredDrivers.length === 0 ? (
              <div className="empty">
                <h3>No drivers found</h3>
                <p>No drivers match this search or risk filter.</p>
              </div>
            ) : (
              <div className="driverList">
                {filteredDrivers.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => setSelected(driver)}
                    className={selected?.id === driver.id ? "driverRow activeDriver" : "driverRow"}
                  >
                    <div className={`driverIcon ${driver.risk}`}>
                      {driver.risk === "high" ? "🚨" : driver.risk === "medium" ? "⚠️" : "✅"}
                    </div>

                    <div className="driverInfo">
                      <strong>{shortText(driver.name)}</strong>
                      <span>{shortText(driver.email)}</span>
                      <small>Score {driver.score}/100 • {driver.reason}</small>
                    </div>

                    <em className={`risk ${driver.risk}`}>{riskLabel(driver.risk)}</em>
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
                    <h2>{shortText(selected.name)}</h2>
                    <p className="email">{selected.email}</p>
                  </div>

                  <span className={`riskPill ${selected.risk}`}>
                    {riskLabel(selected.risk)}
                  </span>
                </div>

                <div className="scoreBox">
                  <span>Driver Risk Score</span>
                  <strong>{selected.score}/100</strong>
                </div>

                <div className="detailsBox">
                  <strong>Risk Summary</strong>
                  <p>{selected.reason}</p>
                </div>

                <div className="infoGrid">
                  <Info label="Driver ID" value={selected.driverId} />
                  <Info label="Email" value={selected.email} />
                  <Info label="Total Rides" value={String(selected.rides)} />
                  <Info label="Completed Rides" value={String(selected.completedRides)} />
                  <Info label="Cancelled Rides" value={String(selected.cancelledRides)} />
                  <Info label="Bookings" value={String(selected.bookings)} />
                  <Info label="Reports" value={String(selected.reports)} />
                  <Info label="Urgent Reports" value={String(selected.urgentReports)} />
                  <Info label="Average Rating" value={selected.averageRating.toFixed(1)} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                </div>

                <div className="actionRow">
                  <button
                    className="reviewButton"
                    onClick={() => markManualReview(selected)}
                    disabled={loadingId === selected.driverId}
                  >
                    Review
                  </button>

                  <button
                    className="suspendButton"
                    onClick={() => updateDriverSuspension(selected, true)}
                    disabled={loadingId === selected.driverId}
                  >
                    Suspend
                  </button>

                  <button
                    className="clearButton"
                    onClick={() => updateDriverSuspension(selected, false)}
                    disabled={loadingId === selected.driverId}
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a driver</h3>
                <p>Choose a driver to view risk details.</p>
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
            radial-gradient(circle at bottom left, rgba(34,197,94,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container { max-width: 1180px; margin: auto; }

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

        h1 { font-size: 58px; line-height: 1; margin: 0 0 16px; }
        h1 span, h2, .metricValue, .scoreBox strong { color: #22c55e; }
        h2 { font-size: 32px; margin: 0 0 14px; }

        .subtitle,
        .email,
        .empty p,
        .detailsBox p {
          color: #a1a1aa;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .scoreOrb {
          min-width: 92px;
          height: 92px;
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
          font-size: 10px;
          font-weight: 900;
        }

        .message { color: #22c55e; font-weight: 900; margin: 16px 0; }

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

        .metricValue { font-size: 24px; font-weight: 900; }

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
          grid-template-columns: 0.95fr 1.4fr;
          gap: 24px;
        }

        .driversCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .driverList {
          display: grid;
          gap: 12px;
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
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.25);
        }

        .driverIcon.high {
          background: rgba(239,68,68,0.13);
          border-color: rgba(239,68,68,0.35);
        }

        .driverIcon.medium {
          background: rgba(250,204,21,0.13);
          border-color: rgba(250,204,21,0.35);
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

        .risk,
        .riskPill {
          border-radius: 999px;
          padding: 8px 11px;
          font-style: normal;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }

        .risk.high,
        .riskPill.high {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .risk.medium,
        .riskPill.medium {
          color: #fde68a;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
        }

        .risk.low,
        .riskPill.low {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .scoreBox,
        .detailsBox {
          padding: 22px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
          margin-bottom: 20px;
        }

        .scoreBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .scoreBox strong {
          font-size: 46px;
          font-weight: 900;
        }

        .detailsBox strong {
          display: block;
          margin-bottom: 8px;
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
          overflow-wrap: anywhere;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .reviewButton,
        .suspendButton,
        .clearButton {
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .reviewButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .suspendButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        .clearButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 24px;
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

          .driverRow .risk {
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
