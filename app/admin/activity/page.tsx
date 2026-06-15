"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ActivityType =
  | "user"
  | "ride"
  | "booking"
  | "payout"
  | "verification"
  | "report"
  | "sos"
  | "system";

type ActivityItem = {
  id: string;
  type?: ActivityType | string;
  title?: string;
  description?: string;
  userEmail?: string;
  amount?: number;
  status?: string;
  priority?: string;
  createdAt?: string;
};

type BasicItem = {
  id: string;
  email?: string;
  userEmail?: string;
  driverEmail?: string;
  passengerEmail?: string;
  from?: string;
  to?: string;
  amount?: number;
  status?: string;
  priority?: string;
  createdAt?: string;
  submittedAt?: string;
};

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [users, setUsers] = useState<BasicItem[]>([]);
  const [rides, setRides] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [payouts, setPayouts] = useState<BasicItem[]>([]);
  const [verifications, setVerifications] = useState<BasicItem[]>([]);
  const [reports, setReports] = useState<BasicItem[]>([]);
  const [sosAlerts, setSosAlerts] = useState<BasicItem[]>([]);
  const [filter, setFilter] = useState<"all" | ActivityType>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading activity center...");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const unsubActivity = onSnapshot(
      query(collection(db, "activityFeed")),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ActivityItem[];

        data.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );

        setActivities(data);
        setMessage("");
      },
      () => setActivities([])
    );

    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BasicItem[]);
      },
      () => setUsers([])
    );

    const unsubRides = onSnapshot(
      query(collection(db, "rides")),
      (snapshot) => {
        setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BasicItem[]);
      },
      () => setRides([])
    );

    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
      (snapshot) => {
        setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BasicItem[]);
      },
      () => setBookings([])
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, "payoutRequests")),
      (snapshot) => {
        setPayouts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BasicItem[]);
      },
      () => setPayouts([])
    );

    const unsubVerifications = onSnapshot(
      query(collection(db, "driverVerifications")),
      (snapshot) => {
        setVerifications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BasicItem[]);
      },
      () => setVerifications([])
    );

    const unsubReports = onSnapshot(
      query(collection(db, "reports")),
      (snapshot) => {
        setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BasicItem[]);
      },
      () => setReports([])
    );

    const unsubSos = onSnapshot(
      query(collection(db, "emergencyAlerts")),
      (snapshot) => {
        setSosAlerts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BasicItem[]);
      },
      () => setSosAlerts([])
    );

    return () => {
      unsubActivity();
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubPayouts();
      unsubVerifications();
      unsubReports();
      unsubSos();
    };
  }, []);

  const generatedActivity = useMemo<ActivityItem[]>(() => {
    const data: ActivityItem[] = [];

    users.forEach((item) => {
      data.push({
        id: `user-${item.id}`,
        type: "user",
        title: "New User Registered",
        description: item.email || item.userEmail || "RoadLink user",
        createdAt: item.createdAt,
      });
    });

    rides.forEach((item) => {
      data.push({
        id: `ride-${item.id}`,
        type: "ride",
        title: "Ride Published",
        description: `${item.from || "Starting point"} → ${item.to || "Destination"}`,
        status: item.status,
        createdAt: item.createdAt,
      });
    });

    bookings.forEach((item) => {
      data.push({
        id: `booking-${item.id}`,
        type: "booking",
        title: "Booking Activity",
        description: item.passengerEmail || item.driverEmail || "RoadLink booking",
        status: item.status,
        createdAt: item.createdAt,
      });
    });

    payouts.forEach((item) => {
      data.push({
        id: `payout-${item.id}`,
        type: "payout",
        title: "Payout Request",
        description: item.driverEmail || item.email || "Driver payout",
        amount: item.amount,
        status: item.status,
        createdAt: item.createdAt,
      });
    });

    verifications.forEach((item) => {
      data.push({
        id: `verification-${item.id}`,
        type: "verification",
        title: "Driver Verification",
        description: item.email || item.userEmail || "Verification request",
        status: item.status,
        createdAt: item.submittedAt || item.createdAt,
      });
    });

    reports.forEach((item) => {
      data.push({
        id: `report-${item.id}`,
        type: "report",
        title: "Safety Report",
        description: item.priority === "urgent" ? "Urgent report submitted" : "Report submitted",
        priority: item.priority,
        status: item.status,
        createdAt: item.createdAt,
      });
    });

    sosAlerts.forEach((item) => {
      data.push({
        id: `sos-${item.id}`,
        type: "sos",
        title: "SOS Emergency Alert",
        description: item.userEmail || "Emergency alert activated",
        priority: item.priority || "critical",
        status: item.status,
        createdAt: item.createdAt,
      });
    });

    return data
      .filter((item) => item.createdAt)
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
  }, [users, rides, bookings, payouts, verifications, reports, sosAlerts]);

  const sourceActivity = activities.length > 0 ? activities : generatedActivity;

  const visibleActivity = useMemo(() => {
    const text = search.toLowerCase().trim();

    return sourceActivity.filter((item) => {
      const matchesFilter = filter === "all" || item.type === filter;

      const matchesSearch =
        !text ||
        item.title?.toLowerCase().includes(text) ||
        item.description?.toLowerCase().includes(text) ||
        item.status?.toLowerCase().includes(text) ||
        item.type?.toLowerCase().includes(text);

      return matchesFilter && matchesSearch;
    });
  }, [sourceActivity, filter, search]);

  const counts = useMemo(() => {
    const critical = sourceActivity.filter(
      (item) =>
        item.type === "sos" ||
        item.type === "report" ||
        item.priority === "critical" ||
        item.priority === "urgent"
    ).length;

    const activityScore = Math.max(100 - critical * 8, 0);

    return {
      all: sourceActivity.length,
      user: sourceActivity.filter((item) => item.type === "user").length,
      ride: sourceActivity.filter((item) => item.type === "ride").length,
      booking: sourceActivity.filter((item) => item.type === "booking").length,
      payout: sourceActivity.filter((item) => item.type === "payout").length,
      verification: sourceActivity.filter((item) => item.type === "verification").length,
      report: sourceActivity.filter((item) => item.type === "report").length,
      sos: sourceActivity.filter((item) => item.type === "sos").length,
      critical,
      activityScore,
    };
  }, [sourceActivity]);

  async function seedActivityFeed() {
    try {
      setSeeding(true);
      setMessage("");

      const source = generatedActivity.slice(0, 40);

      if (source.length === 0) {
        setMessage("No activity available to seed yet.");
        return;
      }

      await Promise.all(
        source.map((item) =>
          setDoc(
            doc(db, "activityFeed", item.id),
            {
              type: item.type || "system",
              title: item.title || "RoadLink Activity",
              description: item.description || "Platform activity",
              status: item.status || "",
              priority: item.priority || "",
              amount: Number(item.amount || 0),
              createdAt: item.createdAt || new Date().toISOString(),
            },
            { merge: true }
          )
        )
      );

      setMessage("Activity feed seeded successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not seed activity feed.");
    } finally {
      setSeeding(false);
    }
  }

  function iconFor(type?: string) {
    if (type === "user") return "👥";
    if (type === "ride") return "🚘";
    if (type === "booking") return "🎟️";
    if (type === "payout") return "🏦";
    if (type === "verification") return "🛡️";
    if (type === "report") return "⚠️";
    if (type === "sos") return "🚨";
    return "📡";
  }

  function labelFor(type?: string) {
    if (type === "user") return "User";
    if (type === "ride") return "Ride";
    if (type === "booking") return "Booking";
    if (type === "payout") return "Payout";
    if (type === "verification") return "Verification";
    if (type === "report") return "Report";
    if (type === "sos") return "SOS";
    return "System";
  }

  function timeAgo(value?: string) {
    if (!value) return "Recently";

    try {
      const date = new Date(value);
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

      if (seconds < 60) return "Just now";

      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} min ago`;

      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hr ago`;

      const days = Math.floor(hours / 24);
      return `${days} day${days === 1 ? "" : "s"} ago`;
    } catch {
      return "Recently";
    }
  }

  function shortText(value?: string, max = 42) {
    if (!value) return "RoadLink activity";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
  }

  function isDanger(item: ActivityItem) {
    return item.type === "sos" || item.type === "report" || item.priority === "urgent" || item.priority === "critical";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/emergency" className="miniButton dangerLink">SOS</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Activity <span>Center</span></h1>
            <p className="subtitle">
              Live timeline for users, rides, bookings, payouts, verifications, reports and SOS events.
            </p>
          </div>

          <div className={counts.activityScore < 80 ? "scoreOrb warningScore" : "scoreOrb"}>
            <strong>{counts.activityScore}</strong>
            <span>Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📡" label="Events" value={String(counts.all)} />
          <Metric icon="🔥" label="Critical" value={String(counts.critical)} danger={counts.critical > 0} />
          <Metric icon="👥" label="Users" value={String(counts.user)} />
          <Metric icon="🚘" label="Rides" value={String(counts.ride)} />
          <Metric icon="🎟️" label="Bookings" value={String(counts.booking)} />
          <Metric icon="🚨" label="SOS" value={String(counts.sos)} danger={counts.sos > 0} />
        </section>

        <section className="toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activity..."
          />

          <button onClick={seedActivityFeed} disabled={seeding}>
            {seeding ? "Seeding..." : "Seed Feed"}
          </button>
        </section>

        <section className="filters">
          {(["all", "user", "ride", "booking", "payout", "verification", "report", "sos"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={filter === item ? "activeFilter" : ""}
            >
              {item === "all" ? "All" : labelFor(item)}
            </button>
          ))}
        </section>

        <section className="feedCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Realtime Timeline</p>
              <h2>Platform Activity</h2>
            </div>

            <div className="liveBadge">
              <span></span>
              LIVE · {visibleActivity.length}
            </div>
          </div>

          {visibleActivity.length === 0 ? (
            <div className="empty">
              <h3>No activity found</h3>
              <p>Activity will appear here when users interact with RoadLink.</p>
            </div>
          ) : (
            <div className="activityList">
              {visibleActivity.map((item) => (
                <article
                  key={item.id}
                  className={isDanger(item) ? "activityRow dangerActivity" : "activityRow"}
                >
                  <div className="activityIcon">{iconFor(item.type)}</div>

                  <div className="activityContent">
                    <div className="titleRow">
                      <strong>{shortText(item.title || "RoadLink Activity", 34)}</strong>
                      <em>{timeAgo(item.createdAt)}</em>
                    </div>

                    <p>{shortText(item.description || "Platform update", 70)}</p>

                    <div className="metaRow">
                      <span>{labelFor(item.type)}</span>
                      {item.status && <span>{item.status}</span>}
                      {item.priority && <span>{item.priority}</span>}
                      {Number(item.amount || 0) > 0 && <span>${Number(item.amount || 0)}</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        html,
        body {
          overflow-x: hidden;
        }

        .page {
          width: 100%;
          min-height: 100vh;
          color: white;
          padding: 12px;
          padding-bottom: 150px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 32%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.12), transparent 36%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          width: 100%;
          max-width: 980px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .miniButton,
        .filters button,
        .toolbar button {
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .dangerLink {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .hero,
        .metric,
        .toolbar,
        .feedCard {
          background: rgba(8,13,25,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 16px 44px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 12px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: center;
        }

        .eyebrow {
          margin: 0 0 7px;
          color: #22c55e;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 34px;
          line-height: 0.98;
          margin: 0 0 10px;
        }

        h1 span,
        h2,
        .metricValue {
          color: #22c55e;
        }

        h2 {
          margin: 0;
          font-size: 24px;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.45;
          margin: 0;
        }

        .scoreOrb {
          min-width: 68px;
          width: 68px;
          height: 68px;
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
          background: rgba(250,204,21,0.12);
          border-color: rgba(250,204,21,0.35);
        }

        .scoreOrb strong {
          color: #22c55e;
          font-size: 22px;
          font-weight: 900;
        }

        .warningScore strong {
          color: #fde68a;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 9px;
          font-weight: 900;
        }

        .message {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }

        .metric {
          border-radius: 16px;
          padding: 11px;
          min-height: 58px;
          display: grid;
          grid-template-columns: 34px 1fr auto;
          gap: 8px;
          align-items: center;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.2);
        }

        .metricIcon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
        }

        .dangerMetric .metricIcon {
          background: rgba(239,68,68,0.16);
        }

        .dangerMetric .metricValue {
          color: #ef4444;
        }

        .metricLabel {
          display: block;
          color: #a1a1aa;
          font-size: 10px;
          font-weight: 900;
        }

        .metricValue {
          display: block;
          font-size: 20px;
          font-weight: 900;
        }

        .toolbar {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          padding: 12px;
          border-radius: 18px;
          margin-bottom: 12px;
        }

        .toolbar input {
          width: 100%;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: white;
          outline: none;
        }

        .toolbar button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .filters .activeFilter {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
        }

        .feedCard {
          border-radius: 22px;
          padding: 14px;
        }

        .sectionHeader {
          position: sticky;
          top: 0;
          z-index: 2;
          background: rgba(8,13,25,0.96);
          border-radius: 18px;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 10px 0 14px;
          margin-bottom: 8px;
        }

        .liveBadge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 999px;
          border: 1px solid rgba(34,197,94,0.4);
          background: rgba(34,197,94,0.12);
          color: #22c55e;
          font-size: 10px;
          font-weight: 900;
          padding: 8px 10px;
          white-space: nowrap;
        }

        .liveBadge span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 1.3s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70% { box-shadow: 0 0 0 9px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }

        .activityList {
          display: grid;
          gap: 8px;
        }

        .activityRow {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 10px;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .dangerActivity {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.18);
        }

        .activityIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .dangerActivity .activityIcon {
          background: rgba(239,68,68,0.16);
        }

        .activityContent {
          min-width: 0;
        }

        .titleRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
        }

        .titleRow strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
        }

        .titleRow em {
          color: #a1a1aa;
          font-size: 10px;
          font-style: normal;
          white-space: nowrap;
        }

        .activityContent p {
          color: #d4d4d8;
          margin: 5px 0;
          font-size: 12px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .metaRow {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .metaRow span {
          padding: 5px 8px;
          border-radius: 999px;
          color: #a1a1aa;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 9px;
          font-weight: 900;
          text-transform: capitalize;
        }

        .empty {
          padding: 20px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 18px;
        }

        .empty p {
          color: #a1a1aa;
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 720px) {
          .toolbar {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 430px) {
          h1 {
            font-size: 31px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .sectionHeader {
            align-items: flex-start;
          }

          .titleRow {
            grid-template-columns: 1fr;
            gap: 3px;
          }
        }

        @media (min-width: 900px) {
          .page {
            padding: 24px;
          }

          .stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .feedCard {
            padding: 18px;
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
      <strong className="metricValue">{value}</strong>
    </div>
  );
}
