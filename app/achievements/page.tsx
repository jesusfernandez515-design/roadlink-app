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
  passengerId?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  distanceMiles?: number;
  createdAt?: string;
  completedAt?: string;
};

type Rating = {
  id: string;
  driverId?: string;
  passengerId?: string;
  rating?: number;
  stars?: number;
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  goal: number;
  progress: number;
  reward: string;
};

export default function AchievementsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [status, setStatus] = useState("Loading achievements...");

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
        setBookings(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Booking[]
        );
      },
      (error) => setStatus(error.message)
    );

    const unsubscribeRatings = onSnapshot(
      query(collection(db, "ratings"), where("driverId", "==", userId)),
      (snapshot) => {
        setRatings(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Rating[]
        );
      },
      (error) => setStatus(error.message)
    );

    return () => {
      unsubscribeBookings();
      unsubscribeRatings();
    };
  }, [userId]);

  const stats = useMemo(() => {
    const completed = bookings.filter((item) => item.status === "completed");

    const trips = completed.length;

    const passengers = completed.reduce(
      (total, item) => total + Number(item.seatsBooked || 1),
      0
    );

    const miles = completed.reduce(
      (total, item) => total + Number(item.distanceMiles || 0),
      0
    );

    const earnings = completed.reduce(
      (total, item) =>
        total + Number(item.price || 0) * Number(item.seatsBooked || 1),
      0
    );

    const averageRating =
      ratings.length > 0
        ? ratings.reduce(
            (total, item) => total + Number(item.stars || item.rating || 0),
            0
          ) / ratings.length
        : 0;

    const xp =
      trips * 100 +
      passengers * 30 +
      Math.round(miles * 5) +
      ratings.length * 40 +
      Math.round(averageRating * 100);

    return {
      trips,
      passengers,
      miles,
      earnings,
      reviews: ratings.length,
      averageRating,
      xp,
    };
  }, [bookings, ratings]);

  const level = useMemo(() => {
    if (stats.xp >= 25000) return { name: "Diamond", icon: "💎", next: 30000 };
    if (stats.xp >= 15000) return { name: "Platinum", icon: "🏆", next: 25000 };
    if (stats.xp >= 8000) return { name: "Gold", icon: "🥇", next: 15000 };
    if (stats.xp >= 3000) return { name: "Silver", icon: "🥈", next: 8000 };
    return { name: "Bronze", icon: "🥉", next: 3000 };
  }, [stats.xp]);

  const achievements: Achievement[] = [
    {
      id: "first-trip",
      title: "First RoadLink Trip",
      description: "Complete your first trip as a driver.",
      icon: "🚗",
      goal: 1,
      progress: stats.trips,
      reward: "+100 XP",
    },
    {
      id: "ten-trips",
      title: "Trusted Driver",
      description: "Complete 10 successful trips.",
      icon: "✅",
      goal: 10,
      progress: stats.trips,
      reward: "+500 XP",
    },
    {
      id: "fifty-trips",
      title: "Elite Road Warrior",
      description: "Complete 50 trips on RoadLink.",
      icon: "🏆",
      goal: 50,
      progress: stats.trips,
      reward: "+2,500 XP",
    },
    {
      id: "passengers",
      title: "People Mover",
      description: "Transport 25 passengers safely.",
      icon: "👥",
      goal: 25,
      progress: stats.passengers,
      reward: "+750 XP",
    },
    {
      id: "miles",
      title: "Highway Master",
      description: "Drive 500 RoadLink miles.",
      icon: "🛣️",
      goal: 500,
      progress: Math.round(stats.miles),
      reward: "+1,000 XP",
    },
    {
      id: "earnings",
      title: "Money Maker",
      description: "Earn $1,000 from completed trips.",
      icon: "💰",
      goal: 1000,
      progress: Math.round(stats.earnings),
      reward: "+1,500 XP",
    },
    {
      id: "reviews",
      title: "Reviewed Driver",
      description: "Receive 10 passenger reviews.",
      icon: "⭐",
      goal: 10,
      progress: stats.reviews,
      reward: "+800 XP",
    },
    {
      id: "rating",
      title: "Five Star Energy",
      description: "Reach a 4.8 average rating.",
      icon: "🌟",
      goal: 48,
      progress: Math.round(stats.averageRating * 10),
      reward: "+1,200 XP",
    },
  ];

  function percent(progress: number, goal: number) {
    return Math.min(100, Math.round((progress / goal) * 100));
  }

  const unlocked = achievements.filter((item) => item.progress >= item.goal).length;
  const levelProgress = Math.min(100, Math.round((stats.xp / level.next) * 100));

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/driver-leaderboard" className="navButton">Leaderboard</Link>
          <Link href="/driver-earnings" className="navButton">Earnings</Link>
          <Link href="/trip-history" className="navButton">Trip History</Link>
          <Link href="/reviews" className="navButton">Reviews</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Gamification</p>
            <h1>Achievement <span>Center</span></h1>
            <p className="subtitle">
              Unlock badges, earn XP, level up your driver profile and track your RoadLink progress.
            </p>
          </div>

          <div className="levelOrb">
            <strong>{level.icon}</strong>
            <span>{level.name}</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="levelCard">
          <div>
            <p className="eyebrow">Driver Level</p>
            <h2>{level.name} Driver</h2>
            <p>{stats.xp.toLocaleString()} XP / {level.next.toLocaleString()} XP</p>
          </div>

          <div className="progressBox">
            <div className="progressTop">
              <span>Level Progress</span>
              <strong>{levelProgress}%</strong>
            </div>

            <div className="bar">
              <div style={{ width: `${levelProgress}%` }} />
            </div>
          </div>
        </section>

        <section className="stats">
          <Metric icon="⚡" label="XP" value={stats.xp.toLocaleString()} />
          <Metric icon="🏆" label="Unlocked" value={`${unlocked}/${achievements.length}`} />
          <Metric icon="🚗" label="Trips" value={String(stats.trips)} />
          <Metric icon="👥" label="Passengers" value={String(stats.passengers)} />
          <Metric icon="🛣️" label="Miles" value={`${stats.miles.toFixed(1)} mi`} />
          <Metric icon="💰" label="Earnings" value={`$${stats.earnings.toFixed(2)}`} />
          <Metric icon="⭐" label="Rating" value={stats.averageRating ? stats.averageRating.toFixed(1) : "New"} />
          <Metric icon="📝" label="Reviews" value={String(stats.reviews)} />
        </section>

        <section className="missions">
          <p className="eyebrow">Daily Missions</p>
          <h2>RoadLink Missions</h2>

          <div className="missionGrid">
            <Mission icon="🚗" title="Complete 1 Trip" text="Finish one ride today." />
            <Mission icon="💬" title="Message Passenger" text="Coordinate pickup clearly." />
            <Mission icon="⭐" title="Earn a Review" text="Deliver a five-star experience." />
          </div>
        </section>

        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Badges</p>
              <h2>Achievements</h2>
            </div>
          </div>

          <div className="achievementGrid">
            {achievements.map((item) => {
              const done = item.progress >= item.goal;
              const progress = percent(item.progress, item.goal);

              return (
                <article key={item.id} className={done ? "achievement unlocked" : "achievement"}>
                  <div className="badgeIcon">{item.icon}</div>

                  <div>
                    <div className="achievementTop">
                      <h3>{item.title}</h3>
                      <span>{done ? "Unlocked" : `${progress}%`}</span>
                    </div>

                    <p>{item.description}</p>

                    <div className="smallBar">
                      <div style={{ width: `${progress}%` }} />
                    </div>

                    <div className="achievementMeta">
                      <small>{Math.min(item.progress, item.goal)} / {item.goal}</small>
                      <strong>{item.reward}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
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
            radial-gradient(circle at bottom left, rgba(250,204,21,0.12), transparent 35%),
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
        .levelCard,
        .metric,
        .missions,
        .panel,
        .achievement,
        .mission {
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
        .levelOrb span,
        .achievementMeta strong {
          color: #22c55e;
        }

        .subtitle,
        .levelCard p,
        .achievement p,
        .mission p {
          color: #a1a1aa;
          max-width: 760px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .levelOrb {
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

        .levelOrb strong {
          font-size: 42px;
        }

        .levelOrb span {
          font-size: 14px;
          font-weight: 900;
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        .levelCard {
          border-radius: 30px;
          padding: 30px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 20px;
        }

        .levelCard h2 {
          margin: 0 0 8px;
          font-size: 42px;
        }

        .progressBox {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .progressTop {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-weight: 900;
        }

        .progressTop span {
          color: #a1a1aa;
        }

        .progressTop strong {
          color: #22c55e;
        }

        .bar,
        .smallBar {
          height: 14px;
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
          overflow: hidden;
        }

        .bar div,
        .smallBar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
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

        .missions,
        .panel {
          border-radius: 30px;
          padding: 30px;
          margin-bottom: 20px;
        }

        .missionGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .mission {
          border-radius: 22px;
          padding: 20px;
          box-shadow: none;
        }

        .missionIcon {
          font-size: 32px;
          margin-bottom: 10px;
        }

        .achievementGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .achievement {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 16px;
          padding: 20px;
          border-radius: 24px;
          box-shadow: none;
        }

        .unlocked {
          background: rgba(34,197,94,0.1);
          border-color: rgba(34,197,94,0.4);
        }

        .badgeIcon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
        }

        .achievementTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .achievementTop h3 {
          margin: 0;
          font-size: 20px;
        }

        .achievementTop span {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .smallBar {
          height: 10px;
          margin: 14px 0;
        }

        .achievementMeta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .achievementMeta small {
          color: #a1a1aa;
          font-weight: 900;
        }

        @media (max-width: 900px) {
          .hero,
          .levelCard {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .missionGrid,
          .achievementGrid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 44px;
          }

          .achievement {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .levelCard,
          .missions,
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

function Mission({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="mission">
      <div className="missionIcon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
      }
