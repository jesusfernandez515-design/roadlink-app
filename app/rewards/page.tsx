"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Booking = {
  id: string;
  driverId?: string;
  passengerId?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  distanceMiles?: number;
};

type Rating = {
  id: string;
  driverId?: string;
  rating?: number;
  stars?: number;
};

type RewardClaim = {
  id: string;
  userId?: string;
  rewardTitle?: string;
  rewardCost?: number;
  status?: string;
  createdAt?: string;
};

type Reward = {
  id: string;
  title: string;
  description: string;
  icon: string;
  cost: number;
  tier: string;
  category: string;
};

const rewards: Reward[] = [
  {
    id: "fee-discount",
    title: "RoadLink Fee Discount",
    description: "Get a future platform fee discount when payouts are processed.",
    icon: "💸",
    cost: 1500,
    tier: "Bronze",
    category: "Driver Benefit",
  },
  {
    id: "priority-badge",
    title: "Priority Driver Badge",
    description: "Show a premium badge on your driver profile.",
    icon: "🏅",
    cost: 2500,
    tier: "Silver",
    category: "Profile",
  },
  {
    id: "gas-credit",
    title: "Gas Credit Reward",
    description: "Future partner gas credit reward for active drivers.",
    icon: "⛽",
    cost: 5000,
    tier: "Gold",
    category: "Partner",
  },
  {
    id: "featured-driver",
    title: "Featured Driver Boost",
    description: "Get featured in RoadLink community and leaderboard sections.",
    icon: "🚀",
    cost: 7500,
    tier: "Gold",
    category: "Growth",
  },
  {
    id: "coffee-coupon",
    title: "Coffee Coupon",
    description: "Future café partner coupon for high-performing drivers.",
    icon: "☕",
    cost: 3000,
    tier: "Silver",
    category: "Partner",
  },
  {
    id: "hotel-benefit",
    title: "Hotel Partner Benefit",
    description: "Future hotel partner benefit for long-distance drivers.",
    icon: "🏨",
    cost: 10000,
    tier: "Platinum",
    category: "Travel",
  },
  {
    id: "diamond-exclusive",
    title: "Diamond Exclusive Reward",
    description: "Exclusive reward reserved for top RoadLink drivers.",
    icon: "💎",
    cost: 20000,
    tier: "Diamond",
    category: "Elite",
  },
];

export default function RewardsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [status, setStatus] = useState("Loading rewards...");
  const [claimingId, setClaimingId] = useState("");

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

    const unsubscribeClaims = onSnapshot(
      query(collection(db, "rewardClaims"), where("userId", "==", userId)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as RewardClaim[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setClaims(data);
      },
      (error) => setStatus(error.message)
    );

    return () => {
      unsubscribeBookings();
      unsubscribeRatings();
      unsubscribeClaims();
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

    const totalXP =
      trips * 100 +
      passengers * 30 +
      Math.round(miles * 5) +
      ratings.length * 40 +
      Math.round(averageRating * 100);

    const spentXP = claims.reduce(
      (total, item) => total + Number(item.rewardCost || 0),
      0
    );

    const availableXP = Math.max(totalXP - spentXP, 0);

    return {
      trips,
      passengers,
      miles,
      earnings,
      averageRating,
      totalXP,
      spentXP,
      availableXP,
    };
  }, [bookings, ratings, claims]);

  const tier = useMemo(() => {
    if (stats.totalXP >= 25000) return "Diamond";
    if (stats.totalXP >= 15000) return "Platinum";
    if (stats.totalXP >= 8000) return "Gold";
    if (stats.totalXP >= 3000) return "Silver";
    return "Bronze";
  }, [stats.totalXP]);

  function tierAllowed(rewardTier: string) {
    const order = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
    return order.indexOf(tier) >= order.indexOf(rewardTier);
  }

  async function claimReward(reward: Reward) {
    if (!userId) return;

    if (!tierAllowed(reward.tier)) {
      setStatus(`You need ${reward.tier} level to claim this reward.`);
      return;
    }

    if (stats.availableXP < reward.cost) {
      setStatus("Not enough available XP to claim this reward.");
      return;
    }

    try {
      setClaimingId(reward.id);
      setStatus("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "rewardClaims"), {
        userId,
        rewardId: reward.id,
        rewardTitle: reward.title,
        rewardCost: reward.cost,
        rewardTier: reward.tier,
        rewardCategory: reward.category,
        status: "claimed",
        createdAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId,
        type: "reward",
        title: "Reward Claimed",
        message: `You claimed ${reward.title}.`,
        read: false,
        createdAt: now,
        actionUrl: "/rewards",
      });

      setStatus("Reward claimed successfully.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not claim reward.");
    } finally {
      setClaimingId("");
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/achievements" className="navButton">Achievements</Link>
          <Link href="/driver-leaderboard" className="navButton">Leaderboard</Link>
          <Link href="/driver-earnings" className="navButton">Earnings</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Loyalty</p>
            <h1>Rewards <span>Center</span></h1>
            <p className="subtitle">
              Redeem XP for RoadLink benefits, profile boosts, future partner rewards and exclusive driver perks.
            </p>
          </div>

          <div className="rewardOrb">
            <strong>🎁</strong>
            <span>{tier}</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="balanceCard">
          <div>
            <p className="eyebrow">Available XP</p>
            <h2>{stats.availableXP.toLocaleString()}</h2>
            <p>Total XP: {stats.totalXP.toLocaleString()} · Spent XP: {stats.spentXP.toLocaleString()}</p>
          </div>

          <div className="tierPill">
            {tier} Member
          </div>
        </section>

        <section className="stats">
          <Metric icon="⚡" label="Available XP" value={stats.availableXP.toLocaleString()} />
          <Metric icon="🏆" label="Tier" value={tier} />
          <Metric icon="🎁" label="Claimed" value={String(claims.length)} />
          <Metric icon="🚗" label="Trips" value={String(stats.trips)} />
          <Metric icon="👥" label="Passengers" value={String(stats.passengers)} />
          <Metric icon="🛣️" label="Miles" value={`${stats.miles.toFixed(1)} mi`} />
          <Metric icon="💰" label="Earnings" value={`$${stats.earnings.toFixed(2)}`} />
          <Metric icon="⭐" label="Rating" value={stats.averageRating ? stats.averageRating.toFixed(1) : "New"} />
        </section>

        <section className="panel">
          <p className="eyebrow">Reward Store</p>
          <h2>Available Rewards</h2>

          <div className="rewardGrid">
            {rewards.map((reward) => {
              const locked = !tierAllowed(reward.tier);
              const notEnoughXP = stats.availableXP < reward.cost;

              return (
                <article key={reward.id} className={locked ? "reward lockedReward" : "reward"}>
                  <div className="rewardIcon">{reward.icon}</div>

                  <div>
                    <div className="rewardTop">
                      <h3>{reward.title}</h3>
                      <span>{reward.tier}</span>
                    </div>

                    <p>{reward.description}</p>

                    <div className="rewardMeta">
                      <small>{reward.category}</small>
                      <strong>{reward.cost.toLocaleString()} XP</strong>
                    </div>

                    <button
                      onClick={() => claimReward(reward)}
                      disabled={claimingId === reward.id || locked || notEnoughXP}
                    >
                      {claimingId === reward.id
                        ? "Claiming..."
                        : locked
                        ? `Requires ${reward.tier}`
                        : notEnoughXP
                        ? "Not Enough XP"
                        : "Claim Reward"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Reward History</p>
          <h2>Claimed Rewards</h2>

          {claims.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🎁</div>
              <h3>No rewards claimed yet</h3>
              <p>Your claimed RoadLink rewards will appear here.</p>
            </div>
          ) : (
            <div className="claimList">
              {claims.map((claim) => (
                <div key={claim.id} className="claim">
                  <div className="claimIcon">🎁</div>

                  <div>
                    <strong>{claim.rewardTitle || "RoadLink Reward"}</strong>
                    <p>{Number(claim.rewardCost || 0).toLocaleString()} XP · {claim.status || "claimed"}</p>
                    <small>
                      {claim.createdAt
                        ? new Date(claim.createdAt).toLocaleString()
                        : "Recently"}
                    </small>
                  </div>
                </div>
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
        .balanceCard,
        .metric,
        .panel,
        .reward,
        .claim {
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
        .balanceCard h2,
        .rewardMeta strong {
          color: #22c55e;
        }

        .subtitle,
        .balanceCard p,
        .reward p,
        .empty p {
          color: #a1a1aa;
          max-width: 760px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .rewardOrb {
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

        .rewardOrb strong {
          font-size: 42px;
        }

        .rewardOrb span {
          color: #22c55e;
          font-weight: 900;
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        .balanceCard {
          border-radius: 30px;
          padding: 30px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
          margin-bottom: 20px;
        }

        .balanceCard h2 {
          font-size: 56px;
          margin: 0 0 8px;
        }

        .tierPill {
          padding: 14px 18px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
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

        .panel {
          border-radius: 30px;
          padding: 30px;
          margin-bottom: 20px;
        }

        .rewardGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .reward {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 16px;
          padding: 20px;
          border-radius: 24px;
          box-shadow: none;
        }

        .lockedReward {
          opacity: 0.6;
        }

        .rewardIcon {
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

        .rewardTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .rewardTop h3 {
          margin: 0;
          font-size: 20px;
        }

        .rewardTop span {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .rewardMeta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin: 14px 0;
        }

        .rewardMeta small {
          color: #a1a1aa;
          font-weight: 900;
        }

        button {
          width: 100%;
          padding: 14px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .claimList {
          display: grid;
          gap: 12px;
        }

        .claim {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 14px;
          padding: 16px;
          border-radius: 20px;
          box-shadow: none;
        }

        .claimIcon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .claim p,
        .claim small {
          color: #a1a1aa;
          margin: 4px 0 0;
        }

        .empty {
          min-height: 240px;
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
          .hero,
          .balanceCard {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .rewardGrid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 44px;
          }

          .reward {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .balanceCard,
          .panel {
            padding: 22px;
            border-radius: 26px;
          }

          .balanceCard h2 {
            font-size: 42px;
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
