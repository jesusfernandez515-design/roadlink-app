"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  driverVerified?: boolean;
  createdAt?: string;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverEmail?: string;
  price?: number;
  createdAt?: string;
};

type BookingItem = {
  id: string;
  status?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
  passengerEmail?: string;
  driverEmail?: string;
  createdAt?: string;
};

export default function AdminBusinessIntelligencePage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [message, setMessage] = useState("Loading business intelligence...");

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
      setMessage("");
    });

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
    };
  }, []);

  const bi = useMemo(() => {
    const drivers = users.filter((user) => user.driverVerified);
    const passengers = users.filter((user) => !user.driverVerified);

    const completedBookings = bookings.filter((booking) => booking.status === "completed");
    const activeBookings = bookings.filter((booking) =>
      ["pending", "reserved", "confirmed"].includes(String(booking.status || ""))
    );

    const gmv = completedBookings.reduce(
      (total, booking) =>
        total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1),
      0
    );

    const takeRate = 12;
    const revenue = gmv * (takeRate / 100);
    const mrr = revenue;
    const arr = mrr * 12;
    const cac = users.length > 0 ? 8.5 : 0;
    const ltv = users.length > 0 ? revenue / Math.max(users.length, 1) * 12 : 0;
    const burnRate = 350;
    const runway = burnRate > 0 ? Math.round((revenue + 3000) / burnRate) : 0;

    const conversionToBooking =
      users.length > 0 ? Math.round((bookings.length / users.length) * 100) : 0;

    const repeatPassengers = Array.from(
      new Set(
        completedBookings
          .map((booking) => booking.passengerEmail)
          .filter((email) => email && completedBookings.filter((b) => b.passengerEmail === email).length > 1)
      )
    ).length;

    const topRoutes = rides.reduce<Record<string, number>>((acc, ride) => {
      const key = `${ride.from || "Unknown"} → ${ride.to || "Unknown"}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const routeList = Object.entries(topRoutes)
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const topDrivers = completedBookings.reduce<Record<string, number>>((acc, booking) => {
      const key = booking.driverEmail || "Unknown driver";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const driverList = Object.entries(topDrivers)
      .map(([driver, trips]) => ({ driver, trips }))
      .sort((a, b) => b.trips - a.trips)
      .slice(0, 8);

    const growthScore = Math.max(
      0,
      Math.min(
        100,
        users.length * 4 +
          rides.length * 5 +
          completedBookings.length * 6 +
          conversionToBooking -
          Math.max(0, 3 - drivers.length) * 10
      )
    );

    return {
      drivers,
      passengers,
      completedBookings,
      activeBookings,
      gmv,
      takeRate,
      revenue,
      mrr,
      arr,
      cac,
      ltv,
      burnRate,
      runway,
      conversionToBooking,
      repeatPassengers,
      routeList,
      driverList,
      growthScore: Math.round(growthScore),
      projection30: revenue * 1.35,
      projection90: revenue * 2.2,
      projection365: revenue * 8.5,
    };
  }, [users, rides, bookings]);

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/mission-control" className="miniButton">Mission Control</Link>
          <Link href="/admin/revenue" className="miniButton">Revenue</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
          <Link href="/admin/launch-readiness" className="miniButton">Launch Readiness</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink CEO Dashboard</p>
            <h1>Business <span>Intelligence</span></h1>
            <p className="subtitle">
              Executive KPIs for investors, growth, revenue, marketplace health, route demand,
              customer value and launch performance.
            </p>
          </div>

          <div className={bi.growthScore >= 70 ? "scoreOrb" : "scoreOrb warning"}>
            <strong>{bi.growthScore}</strong>
            <span>Growth Score</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💰" label="GMV" value={money(bi.gmv)} />
          <Metric icon="🏦" label="Revenue" value={money(bi.revenue)} />
          <Metric icon="📆" label="MRR" value={money(bi.mrr)} />
          <Metric icon="📈" label="ARR" value={money(bi.arr)} />
          <Metric icon="🧾" label="Take Rate" value={`${bi.takeRate}%`} />
          <Metric icon="🎯" label="CAC" value={money(bi.cac)} />
          <Metric icon="💎" label="LTV" value={money(bi.ltv)} />
          <Metric icon="⏳" label="Runway" value={`${bi.runway} mo`} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Marketplace</p>
            <h2>Core Metrics</h2>

            <div className="infoGrid">
              <Info label="Users" value={String(users.length)} />
              <Info label="Drivers" value={String(bi.drivers.length)} />
              <Info label="Passengers" value={String(bi.passengers.length)} />
              <Info label="Rides" value={String(rides.length)} />
              <Info label="Bookings" value={String(bookings.length)} />
              <Info label="Completed Bookings" value={String(bi.completedBookings.length)} />
              <Info label="Active Bookings" value={String(bi.activeBookings.length)} />
              <Info label="Booking Conversion" value={`${bi.conversionToBooking}%`} />
              <Info label="Repeat Passengers" value={String(bi.repeatPassengers)} />
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Forecast</p>
            <h2>Growth Projection</h2>

            <div className="projectionBox">
              <div>
                <span>30 Days</span>
                <strong>{money(bi.projection30)}</strong>
              </div>

              <div>
                <span>90 Days</span>
                <strong>{money(bi.projection90)}</strong>
              </div>

              <div>
                <span>365 Days</span>
                <strong>{money(bi.projection365)}</strong>
              </div>
            </div>

            <div className="aiBox">
              <strong>AI Insight</strong>
              <p>
                {bi.drivers.length < 3
                  ? "Driver supply is still the biggest growth blocker. Recruit verified drivers before paid acquisition."
                  : bi.completedBookings.length === 0
                  ? "You need completed bookings before presenting strong revenue numbers to investors."
                  : "RoadLink has early traction signals. Focus on repeat passengers, route density and verified driver supply."}
              </p>
            </div>
          </section>
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Routes</p>
            <h2>Top Routes</h2>

            {bi.routeList.length === 0 ? (
              <Empty text="No route data yet." />
            ) : (
              <div className="rankList">
                {bi.routeList.map((item, index) => (
                  <div key={item.route} className="rankItem">
                    <em>#{index + 1}</em>
                    <div>
                      <strong>{item.route}</strong>
                      <span>{item.count} ride(s)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <p className="eyebrow">Drivers</p>
            <h2>Top Drivers</h2>

            {bi.driverList.length === 0 ? (
              <Empty text="No completed driver data yet." />
            ) : (
              <div className="rankList">
                {bi.driverList.map((item, index) => (
                  <div key={item.driver} className="rankItem">
                    <em>#{index + 1}</em>
                    <div>
                      <strong>{item.driver}</strong>
                      <span>{item.trips} completed trip(s)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="quickCard">
          <p className="eyebrow">Investor View</p>
          <h2>Executive Summary</h2>

          <div className="summaryGrid">
            <Summary label="Business Model" value="Marketplace take rate" />
            <Summary label="Current Take Rate" value={`${bi.takeRate}%`} />
            <Summary label="Revenue Stage" value={bi.revenue > 0 ? "Early revenue" : "Pre-revenue"} />
            <Summary label="Main Growth Lever" value="Verified drivers + active routes" />
          </div>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1240px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .metric,
        .panel,
        .quickCard {
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
          font-size: 60px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue,
        .scoreOrb strong,
        .projectionBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .info span,
        .rankItem span,
        .aiBox p,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 14px 0;
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
        }

        .scoreOrb.warning {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb.warning strong { color: #fca5a5; }

        .scoreOrb strong {
          font-size: 36px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }

        .metric {
          border-radius: 22px;
          padding: 16px;
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          margin-bottom: 10px;
        }

        .metricLabel {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          display: block;
          margin-bottom: 6px;
        }

        .metricValue {
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .panel,
        .quickCard {
          border-radius: 30px;
          padding: 24px;
        }

        .infoGrid,
        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .info,
        .summaryItem,
        .aiBox {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .info span,
        .summaryItem span {
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
          color: #a1a1aa;
        }

        .info strong,
        .summaryItem strong {
          display: block;
          color: white;
          overflow-wrap: anywhere;
        }

        .projectionBox {
          display: grid;
          gap: 12px;
          margin-bottom: 16px;
        }

        .projectionBox div {
          padding: 18px;
          border-radius: 18px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
        }

        .projectionBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .projectionBox strong {
          font-size: 32px;
          font-weight: 900;
        }

        .aiBox strong {
          display: block;
          color: #22c55e;
          margin-bottom: 8px;
        }

        .rankList {
          display: grid;
          gap: 10px;
        }

        .rankItem {
          display: grid;
          grid-template-columns: 56px 1fr;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .rankItem em {
          color: #22c55e;
          font-style: normal;
          font-weight: 900;
          font-size: 18px;
        }

        .rankItem strong,
        .rankItem span {
          display: block;
          overflow-wrap: anywhere;
        }

        .empty {
          padding: 24px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .empty h3 {
          margin: 0 0 8px;
        }

        @media (max-width: 1050px) {
          .hero,
          .grid {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .infoGrid,
          .summaryGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          h1 { font-size: 46px; }
        }

        @media (max-width: 650px) {
          .page { padding: 16px; padding-bottom: 120px; }

          .hero,
          .panel,
          .quickCard {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .infoGrid,
          .summaryGrid {
            grid-template-columns: 1fr;
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
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <strong className="metricValue">{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="summaryItem">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <h3>No data</h3>
      <p>{text}</p>
    </div>
  );
}
