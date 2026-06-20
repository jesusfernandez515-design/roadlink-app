"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type RewardStatus = "elite" | "qualified" | "watch" | "not_qualified";

type BasicItem = {
  id: string;
  name?: string;
  email?: string;
  status?: string;
  amount?: number;
  price?: number;
  seatsBooked?: number;
  driverId?: string;
  driverEmail?: string;
  driverVerified?: boolean;
  verified?: boolean;
  suspended?: boolean;
  rating?: number;
  createdAt?: string;
};

type DriverReward = {
  id: string;
  driverId: string;
  name: string;
  email: string;
  rewardScore: number;
  status: RewardStatus;
  completedRides: number;
  completedBookings: number;
  cancelledBookings: number;
  passengers: number;
  revenue: number;
  averageRating: number;
  ratings: number;
  rewardAmount: number;
  bonusTier: string;
  verified: boolean;
  suspended: boolean;
  insight: string;
};

export default function AdminDriverRewardsPage() {
  const [users, setUsers] = useState<BasicItem[]>([]);
  const [rides, setRides] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [ratings, setRatings] = useState<BasicItem[]>([]);
  const [selected, setSelected] = useState<DriverReward | null>(null);
  const [filter, setFilter] = useState<"all" | RewardStatus>("all");
  const [message, setMessage] = useState("Loading driver rewards...");
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

    const unsubUsers = listen<BasicItem>("users", setUsers);
    const unsubRides = listen<BasicItem>("rides", setRides);
    const unsubBookings = listen<BasicItem>("bookings", setBookings);
    const unsubRatings = listen<BasicItem>("ratings", setRatings);

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubRatings();
    };
  }, []);

  const rewards = useMemo<DriverReward[]>(() => {
    return users
      .filter(
        (user) =>
          user.driverVerified ||
          user.verified ||
          rides.some((ride) => ride.driverId === user.id || ride.driverEmail === user.email) ||
          bookings.some((booking) => booking.driverId === user.id || booking.driverEmail === user.email)
      )
      .map((driver) => {
        const driverRides = rides.filter(
          (ride) => ride.driverId === driver.id || ride.driverEmail === driver.email
        );

        const driverBookings = bookings.filter(
          (booking) => booking.driverId === driver.id || booking.driverEmail === driver.email
        );

        const completedRides = driverRides.filter((ride) => ride.status === "completed").length;

        const completedBookings = driverBookings.filter(
          (booking) => booking.status === "completed"
        ).length;

        const cancelledBookings = driverBookings.filter(
          (booking) =>
            booking.status === "cancelled" ||
            booking.status === "rejected" ||
            booking.status === "no_show"
        ).length;

        const passengers = driverBookings.reduce(
          (total, booking) => total + Number(booking.seatsBooked || 1),
          0
        );

        const revenue = driverBookings.reduce(
          (total, booking) =>
            total +
            Number(booking.price || booking.amount || 0) *
              Number(booking.seatsBooked || 1),
          0
        );

        const driverRatings = ratings.filter(
          (rating) => rating.driverId === driver.id || rating.driverEmail === driver.email
        );

        const averageRating =
          driverRatings.length > 0
            ? driverRatings.reduce((total, item) => total + Number(item.rating || 0), 0) /
              driverRatings.length
            : 5;

        let rewardScore = 0;

        rewardScore += completedRides * 8;
        rewardScore += completedBookings * 6;
        rewardScore += passengers * 3;
        rewardScore += revenue >= 1000 ? 20 : revenue >= 500 ? 14 : revenue >= 100 ? 8 : 0;
        rewardScore += averageRating >= 4.8 ? 15 : averageRating >= 4.5 ? 8 : 0;
        rewardScore += driver.driverVerified || driver.verified ? 8 : 0;

        rewardScore -= cancelledBookings * 8;
        rewardScore -= driver.suspended ? 35 : 0;
        rewardScore -= averageRating < 4 ? 15 : 0;

        rewardScore = Math.max(Math.min(rewardScore, 100), 0);

        const status: RewardStatus =
          rewardScore >= 85
            ? "elite"
            : rewardScore >= 60
            ? "qualified"
            : rewardScore >= 35
            ? "watch"
            : "not_qualified";

        const rewardAmount =
          status === "elite"
            ? Math.max(25, Math.round(revenue * 0.05))
            : status === "qualified"
            ? Math.max(10, Math.round(revenue * 0.03))
            : 0;

        const bonusTier =
          status === "elite"
            ? "Elite Bonus"
            : status === "qualified"
            ? "Growth Bonus"
            : status === "watch"
            ? "Monitor"
            : "No Bonus";

        const insight =
          status === "elite"
            ? "Top driver. Eligible for the strongest reward tier."
            : status === "qualified"
            ? "Good driver. Eligible for a growth reward."
            : status === "watch"
            ? "Driver needs more completed rides or better reliability before rewards."
            : "Not qualified for rewards yet.";

        return {
          id: driver.id,
          driverId: driver.id,
          name: driver.name || "RoadLink Driver",
          email: driver.email || "No email",
          rewardScore,
          status,
          completedRides,
          completedBookings,
          cancelledBookings,
          passengers,
          revenue,
          averageRating,
          ratings: driverRatings.length,
          rewardAmount,
          bonusTier,
          verified: Boolean(driver.driverVerified || driver.verified),
          suspended: Boolean(driver.suspended),
          insight,
        };
      })
      .sort((a, b) => b.rewardScore + b.revenue / 100 - (a.rewardScore + a.revenue / 100));
  }, [users, rides, bookings, ratings]);

  const filteredRewards = useMemo(() => {
    if (filter === "all") return rewards;
    return rewards.filter((item) => item.status === filter);
  }, [rewards, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredRewards.length === 0) return null;
      if (!current) return filteredRewards[0];
      return filteredRewards.find((item) => item.id === current.id) || filteredRewards[0];
    });
  }, [filteredRewards]);

  const elite = rewards.filter((item) => item.status === "elite").length;
  const qualified = rewards.filter((item) => item.status === "qualified").length;
  const watch = rewards.filter((item) => item.status === "watch").length;
  const notQualified = rewards.filter((item) => item.status === "not_qualified").length;
  const totalRewards = rewards.reduce((total, item) => total + item.rewardAmount, 0);

  async function saveReward(item: DriverReward) {
    try {
      setSavingId(item.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "driverRewards", item.id),
        {
          ...item,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "notifications", `driver-reward-${item.id}-${Date.now()}`),
        {
          userId: item.driverId,
          type: "driver_reward",
          title: "Driver Reward Update",
          message:
            item.rewardAmount > 0
              ? `You may qualify for a ${item.bonusTier} of $${item.rewardAmount}.`
              : "Keep completing trips to unlock driver rewards.",
          read: false,
          actionUrl: "/wallet",
          createdAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `driver-reward-${item.id}-${Date.now()}`),
        {
          userId: item.driverId,
          userEmail: item.email,
          action: "Driver Reward Saved",
          targetId: item.id,
          targetType: "driverReward",
          details: `${item.bonusTier}: $${item.rewardAmount}`,
          severity: item.status === "elite" ? "success" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Driver reward saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save driver reward.");
    } finally {
      setSavingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function statusLabel(status: RewardStatus) {
    if (status === "elite") return "Elite";
    if (status === "qualified") return "Qualified";
    if (status === "watch") return "Watch";
    return "Not Qualified";
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
          <Link href="/admin/driver-performance" className="miniButton">Performance</Link>
          <Link href="/admin/driver-risk" className="miniButton">Driver Risk</Link>
          <Link href="/admin/payouts" className="miniButton">Payouts</Link>
          <Link href="/admin/revenue-intelligence" className="miniButton">Revenue</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Driver Growth</p>
            <h1>Driver <span>Rewards</span></h1>
            <p className="subtitle">
              Reward top drivers based on completed rides, completed bookings,
              revenue, passengers, ratings, reliability and safety status.
            </p>
          </div>

          <div className={totalRewards > 0 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{money(totalRewards)}</strong>
            <span>Total Rewards</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="🏆" label="Elite" value={String(elite)} />
          <Metric icon="✅" label="Qualified" value={String(qualified)} />
          <Metric icon="👀" label="Watch" value={String(watch)} />
          <Metric icon="⚠️" label="Not Qualified" value={String(notQualified)} danger={notQualified > 0} />
          <Metric icon="💵" label="Total Rewards" value={money(totalRewards)} />
          <Metric icon="🚘" label="Drivers" value={String(rewards.length)} />
        </section>

        <section className="filters">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | RewardStatus)}
          >
            <option value="all">All drivers</option>
            <option value="elite">Elite</option>
            <option value="qualified">Qualified</option>
            <option value="watch">Watch</option>
            <option value="not_qualified">Not Qualified</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="rewardsCard">
            <p className="eyebrow">Reward Board</p>
            <h2>Driver Rewards</h2>

            {filteredRewards.length === 0 ? (
              <div className="empty">
                <h3>No reward data found</h3>
                <p>Driver rewards will appear after drivers complete trips.</p>
              </div>
            ) : (
              <div className="rewardList">
                {filteredRewards.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "rewardRow activeReward" : "rewardRow"}
                  >
                    <div className={`rewardIcon ${item.status}`}>
                      {item.status === "elite"
                        ? "🏆"
                        : item.status === "qualified"
                        ? "✅"
                        : item.status === "watch"
                        ? "👀"
                        : "⚠️"}
                    </div>

                    <div className="rewardInfo">
                      <strong>{shortText(item.name)}</strong>
                      <span>{shortText(item.email)}</span>
                      <small>Score {item.rewardScore}/100 • Reward {money(item.rewardAmount)}</small>
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
                    <p className="eyebrow">Selected Driver</p>
                    <h2>{shortText(selected.name, 54)}</h2>
                    <p className="email">{selected.email}</p>
                  </div>

                  <span className={`statusPill ${selected.status}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className={`insightBox ${selected.status}`}>
                  <span>Reward Amount</span>
                  <strong>{money(selected.rewardAmount)}</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="scoreBar">
                  <div style={{ width: `${selected.rewardScore}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Reward Score" value={`${selected.rewardScore}/100`} />
                  <Info label="Bonus Tier" value={selected.bonusTier} />
                  <Info label="Reward Amount" value={money(selected.rewardAmount)} />
                  <Info label="Status" value={statusLabel(selected.status)} />
                  <Info label="Completed Rides" value={String(selected.completedRides)} />
                  <Info label="Completed Bookings" value={String(selected.completedBookings)} />
                  <Info label="Cancelled Bookings" value={String(selected.cancelledBookings)} />
                  <Info label="Passengers" value={String(selected.passengers)} />
                  <Info label="Revenue" value={money(selected.revenue)} />
                  <Info label="Average Rating" value={selected.averageRating.toFixed(1)} />
                  <Info label="Ratings" value={String(selected.ratings)} />
                  <Info label="Verified" value={selected.verified ? "Yes" : "No"} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                  <Info label="Driver ID" value={selected.driverId} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Reward Recommendation</p>
                  <h2>
                    {selected.status === "elite"
                      ? "Pay elite bonus"
                      : selected.status === "qualified"
                      ? "Pay growth bonus"
                      : selected.status === "watch"
                      ? "Monitor driver"
                      : "No reward yet"}
                  </h2>
                  <p>{selected.insight}</p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveReward(selected)}
                    disabled={savingId === selected.id}
                  >
                    Save Reward
                  </button>

                  <Link href="/admin/driver-performance" className="linkButton">Performance</Link>
                  <Link href="/admin/payouts" className="linkButton">Payouts</Link>
                  <Link href="/admin/revenue-intelligence" className="dangerButton">Revenue</Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a driver</h3>
                <p>Choose a driver to view reward details.</p>
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
            radial-gradient(circle at top right, rgba(250,204,21,0.18), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.14), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1280px; margin: auto; }

        .topNav { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }

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
        .rewardsCard,
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
          min-width: 110px;
          height: 110px;
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

        .warningScore { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); }
        .scoreOrb strong { color: #22c55e; font-size: 26px; font-weight: 900; }
        .warningScore strong { color: #fca5a5; }
        .scoreOrb span { color: #a1a1aa; font-size: 10px; font-weight: 900; }

        .message { color: #22c55e; font-weight: 900; margin: 16px 0; }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric { border-radius: 24px; padding: 18px; }
        .dangerMetric { border-color: rgba(239,68,68,0.35); background: rgba(127,29,29,0.2); }

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

        .metricValue { font-size: 22px; font-weight: 900; overflow-wrap: anywhere; }
        .dangerMetric .metricValue { color: #ef4444; }

        .filters {
          display: grid;
          grid-template-columns: 230px;
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

        .rewardsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .rewardList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .rewardRow {
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

        .activeReward { border-color: rgba(34,197,94,0.45); background: rgba(34,197,94,0.1); }

        .rewardIcon {
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

        .rewardIcon.watch { background: rgba(250,204,21,0.13); border-color: rgba(250,204,21,0.35); }
        .rewardIcon.not_qualified { background: rgba(239,68,68,0.13); border-color: rgba(239,68,68,0.35); }

        .rewardInfo { min-width: 0; }

        .rewardInfo strong,
        .rewardInfo span,
        .rewardInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rewardInfo span,
        .rewardInfo small {
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

        .status.elite,
        .status.qualified,
        .statusPill.elite,
        .statusPill.qualified {
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

        .status.not_qualified,
        .statusPill.not_qualified {
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

        .insightBox.not_qualified {
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
        .insightBox.not_qualified strong { color: #fca5a5; }

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

        .infoBox strong { display: block; overflow-wrap: anywhere; }

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

        .saveButton { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .linkButton { background: rgba(59,130,246,0.13); border: 1px solid rgba(59,130,246,0.35); }
        .dangerButton { background: linear-gradient(135deg, #ef4444, #991b1b); }

        button:disabled { opacity: 0.6; cursor: not-allowed; }

        .empty {
          padding: 24px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 16px;
        }

        .empty h3 { margin: 0 0 8px; font-size: 22px; }

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

          .rewardRow {
            grid-template-columns: 46px 1fr;
          }

          .rewardRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .rewardIcon {
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
