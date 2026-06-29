"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Booking = {
  id: string;
  driverId?: string;
  passengerEmail?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  distanceMiles?: number;
  durationMinutes?: number;
  from?: string;
  to?: string;
  createdAt?: string;
  completedAt?: string;
};

type Rating = {
  id: string;
  driverId?: string;
  stars?: number;
  rating?: number;
  comment?: string;
  createdAt?: string;
};

export default function DriverInsightsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [status, setStatus] = useState("Loading driver insights...");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setStatus("");
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const unsubscribeBookings = onSnapshot(
      query(collection(db, "bookings"), where("driverId", "==", userId)),
      (snapshot) => {
        setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Booking[]);
      },
      (error) => setStatus(error.message)
    );

    const unsubscribeRatings = onSnapshot(
      query(collection(db, "ratings"), where("driverId", "==", userId)),
      (snapshot) => {
        setRatings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Rating[]);
      },
      (error) => setStatus(error.message)
    );

    return () => {
      unsubscribeBookings();
      unsubscribeRatings();
    };
  }, [userId]);

  function money(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function cleanStatus(value?: string) {
    return String(value || "").toLowerCase();
  }

  const insights = useMemo(() => {
    const completed = bookings.filter((item) => cleanStatus(item.status) === "completed");
    const cancelled = bookings.filter((item) => cleanStatus(item.status) === "cancelled");
    const active = bookings.filter((item) =>
      ["reserved", "confirmed", "pending"].includes(cleanStatus(item.status))
    );

    const earnings = completed.reduce(
      (total, item) => total + Number(item.price || 0) * Number(item.seatsBooked || 1),
      0
    );

    const passengers = completed.reduce(
      (total, item) => total + Number(item.seatsBooked || 1),
      0
    );

    const miles = completed.reduce(
      (total, item) => total + Number(item.distanceMiles || 0),
      0
    );

    const minutes = completed.reduce(
      (total, item) => total + Number(item.durationMinutes || 0),
      0
    );

    const avgRating =
      ratings.length > 0
        ? ratings.reduce((total, item) => total + Number(item.stars || item.rating || 0), 0) /
          ratings.length
        : 0;

    const avgPerTrip = completed.length ? earnings / completed.length : 0;
    const avgPerMile = miles ? earnings / miles : 0;
    const avgOccupancy = completed.length ? passengers / completed.length : 0;
    const cancellationRate = bookings.length ? Math.round((cancelled.length / bookings.length) * 100) : 0;

    const score = Math.min(
      100,
      Math.round(
        completed.length * 4 +
          avgRating * 12 +
          avgPerMile * 8 +
          avgOccupancy * 5 -
          cancellationRate
      )
    );

    const projectedNextWeek = Math.round((earnings / Math.max(completed.length, 1)) * Math.max(active.length + 3, 3));

    const bestRoute = completed.reduce<Record<string, number>>((acc, item) => {
      const key = `${item.from || "Origin"} → ${item.to || "Destination"}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topRoute =
      Object.entries(bestRoute).sort((a, b) => b[1] - a[1])[0]?.[0] || "Not enough data yet";

    const frequentPassenger = completed.reduce<Record<string, number>>((acc, item) => {
      const key = item.passengerEmail || "Passenger";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topPassenger =
      Object.entries(frequentPassenger).sort((a, b) => b[1] - a[1])[0]?.[0] || "Not enough data yet";

    return {
      completed,
      cancelled,
      active,
      earnings,
      passengers,
      miles,
      minutes,
      avgRating,
      avgPerTrip,
      avgPerMile,
      avgOccupancy,
      cancellationRate,
      score,
      projectedNextWeek,
      topRoute,
      topPassenger,
    };
  }, [bookings, ratings]);

  const recommendations = useMemo(() => {
    const items: string[] = [];

    if (insights.avgRating < 4.7 && ratings.length > 0) {
      items.push("Improve communication before pickup to raise passenger ratings.");
    }

    if (insights.cancellationRate > 15) {
      items.push("Reduce cancellations to improve trust score and leaderboard rank.");
    }

    if (insights.avgPerMile < 0.7 && insights.completed.length > 0) {
      items.push("Prioritize longer trips or higher price routes to increase earnings per mile.");
    }

    if (insights.active.length === 0) {
      items.push("Post at least one active ride to keep your profile visible.");
    }

    if (items.length === 0) {
      items.push("Your driver performance looks strong. Keep completing rides consistently.");
    }

    return items;
  }, [insights, ratings.length]);

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/driver-earnings" className="navButton">Earnings</Link>
          <Link href="/driver-leaderboard" className="navButton">Leaderboard</Link>
          <Link href="/achievements" className="navButton">Achievements</Link>
          <Link href="/trip-history" className="navButton">Trip History</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink AI Intelligence</p>
            <h1>Driver <span>Insights</span></h1>
            <p className="subtitle">
              Smart performance analysis for earnings, ratings, routes, cancellations, passenger activity and growth opportunities.
            </p>
          </div>

          <div className="scoreOrb">
            <strong>{insights.score}</strong>
            <span>AI Score</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="🤖" label="AI Score" value={`${insights.score}/100`} />
          <Metric icon="💰" label="Earnings" value={money(insights.earnings)} />
          <Metric icon="📈" label="Next Week Est." value={money(insights.projectedNextWeek)} />
          <Metric icon="🚗" label="Completed Trips" value={String(insights.completed.length)} />
          <Metric icon="👥" label="Passengers" value={String(insights.passengers)} />
          <Metric icon="🛣️" label="Miles" value={`${insights.miles.toFixed(1)} mi`} />
          <Metric icon="💵" label="Avg / Trip" value={money(insights.avgPerTrip)} />
          <Metric icon="📍" label="Avg / Mile" value={money(insights.avgPerMile)} />
          <Metric icon="⭐" label="Rating" value={insights.avgRating ? insights.avgRating.toFixed(1) : "New"} />
          <Metric icon="❌" label="Cancel Rate" value={`${insights.cancellationRate}%`} />
          <Metric icon="⏱️" label="Drive Hours" value={`${(insights.minutes / 60).toFixed(1)} h`} />
          <Metric icon="🟢" label="Active Bookings" value={String(insights.active.length)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">AI Recommendation</p>
            <h2>Growth Plan</h2>

            <div className="recommendations">
              {recommendations.map((item) => (
                <div key={item} className="recommendation">
                  <span>💡</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Route Intelligence</p>
            <h2>Best Route</h2>

            <div className="bigInsight">
              <strong>{insights.topRoute}</strong>
              <p>Your most frequent completed route based on current bookings.</p>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Passenger Intelligence</p>
            <h2>Top Passenger</h2>

            <div className="bigInsight">
              <strong>{insights.topPassenger}</strong>
              <p>Your most frequent passenger from completed trips.</p>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Performance Health</p>
            <h2>Driver KPIs</h2>

            <Info label="Average occupancy" value={insights.avgOccupancy.toFixed(1)} />
            <Info label="Average earnings per trip" value={money(insights.avgPerTrip)} />
            <Info label="Average earnings per mile" value={money(insights.avgPerMile)} />
            <Info label="Cancellation rate" value={`${insights.cancellationRate}%`} />
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Recent Rating Signals</p>
          <h2>Passenger Feedback</h2>

          {ratings.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">⭐</div>
              <h3>No ratings yet</h3>
              <p>Passenger reviews will help generate stronger AI insights.</p>
            </div>
          ) : (
            <div className="ratingList">
              {ratings.slice(0, 6).map((rating) => (
                <article key={rating.id} className="ratingCard">
                  <strong>{Number(rating.stars || rating.rating || 0).toFixed(1)} ⭐</strong>
                  <p>{rating.comment || "No written comment."}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 24px;
          padding-bottom: 120px;
          color: white;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 35%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.14), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

        .topBar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }

        .navButton {
          color: white;
          text-decoration: none;
          font-weight: 900;
          padding: 12px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .hero,
        .metric,
        .panel,
        .recommendation,
        .ratingCard {
          background: rgba(8,13,25,0.9);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding: 35px;
          border-radius: 32px;
          margin-bottom: 20px;
        }

        .eyebrow {
          color: #22c55e;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 13px;
          margin: 0 0 10px;
        }

        h1 {
          margin: 0 0 16px;
          font-size: 60px;
          line-height: 1;
        }

        h1 span,
        h2,
        .metric strong,
        .scoreOrb strong,
        .bigInsight strong {
          color: #22c55e;
        }

        .subtitle,
        .bigInsight p,
        .recommendation p,
        .empty p,
        .ratingCard p {
          color: #a1a1aa;
          max-width: 760px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .scoreOrb {
          min-width: 130px;
          height: 130px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          justify-content: center;
          align-items: center;
          flex-direction: column;
          text-align: center;
        }

        .scoreOrb strong {
          font-size: 42px;
        }

        .scoreOrb span {
          color: #d4d4d8;
          font-weight: 900;
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .metric {
          padding: 18px;
          border-radius: 22px;
        }

        .metricIcon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .metric span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .metric strong {
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .panel {
          border-radius: 30px;
          padding: 30px;
          margin-bottom: 20px;
        }

        .recommendations {
          display: grid;
          gap: 12px;
        }

        .recommendation {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          padding: 16px;
          border-radius: 20px;
          box-shadow: none;
        }

        .recommendation span {
          font-size: 26px;
        }

        .bigInsight {
          padding: 20px;
          border-radius: 22px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .bigInsight strong {
          display: block;
          font-size: 24px;
          margin-bottom: 8px;
          overflow-wrap: anywhere;
        }

        .info {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          margin-bottom: 10px;
        }

        .info span {
          color: #a1a1aa;
          font-weight: 900;
        }

        .info strong {
          color: #e5e7eb;
        }

        .ratingList {
          display: grid;
          gap: 12px;
        }

        .ratingCard {
          padding: 18px;
          border-radius: 20px;
          box-shadow: none;
        }

        .ratingCard strong {
          color: #22c55e;
          display: block;
          margin-bottom: 8px;
          font-size: 20px;
        }

        .empty {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .emptyIcon {
          width: 82px;
          height: 82px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          margin-bottom: 16px;
        }

        @media (max-width: 900px) {
          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .grid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 44px;
          }
        }

        @media (max-width: 600px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .panel {
            padding: 22px;
            border-radius: 26px;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
      }
