"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type LoyaltyTier = "platinum" | "gold" | "silver" | "bronze" | "new";

type BasicItem = {
  id: string;
  name?: string;
  email?: string;
  status?: string;
  amount?: number;
  price?: number;
  seatsBooked?: number;
  passengerId?: string;
  passengerEmail?: string;
  driverId?: string;
  driverEmail?: string;
  suspended?: boolean;
  verified?: boolean;
  driverVerified?: boolean;
  createdAt?: string;
};

type LoyaltyProfile = {
  id: string;
  userId: string;
  name: string;
  email: string;
  tier: LoyaltyTier;
  points: number;
  trips: number;
  completedBookings: number;
  cancelledBookings: number;
  spend: number;
  cashback: number;
  freeRideCredits: number;
  loyaltyScore: number;
  suspended: boolean;
  insight: string;
};

export default function AdminLoyaltyPage() {
  const [users, setUsers] = useState<BasicItem[]>([]);
  const [bookings, setBookings] = useState<BasicItem[]>([]);
  const [rides, setRides] = useState<BasicItem[]>([]);
  const [selected, setSelected] = useState<LoyaltyProfile | null>(null);
  const [filter, setFilter] = useState<"all" | LoyaltyTier>("all");
  const [message, setMessage] = useState("Loading loyalty center...");
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
    const unsubBookings = listen<BasicItem>("bookings", setBookings);
    const unsubRides = listen<BasicItem>("rides", setRides);

    return () => {
      unsubUsers();
      unsubBookings();
      unsubRides();
    };
  }, []);

  const loyaltyProfiles = useMemo<LoyaltyProfile[]>(() => {
    return users
      .map((user) => {
        const userBookings = bookings.filter(
          (booking) =>
            booking.passengerId === user.id ||
            booking.passengerEmail === user.email ||
            booking.driverId === user.id ||
            booking.driverEmail === user.email
        );

        const userRides = rides.filter(
          (ride) => ride.driverId === user.id || ride.driverEmail === user.email
        );

        const completedBookings = userBookings.filter((item) => item.status === "completed");

        const cancelledBookings = userBookings.filter(
          (item) =>
            item.status === "cancelled" ||
            item.status === "rejected" ||
            item.status === "no_show"
        );

        const spend = userBookings.reduce(
          (total, booking) =>
            total +
            Number(booking.price || booking.amount || 0) *
              Number(booking.seatsBooked || 1),
          0
        );

        const trips = completedBookings.length + userRides.filter((ride) => ride.status === "completed").length;

        let points = 0;
        points += Math.round(spend * 10);
        points += completedBookings.length * 150;
        points += userRides.filter((ride) => ride.status === "completed").length * 200;
        points += user.verified || user.driverVerified ? 250 : 0;
        points -= cancelledBookings.length * 100;
        points -= user.suspended ? 1000 : 0;

        points = Math.max(points, 0);

        const loyaltyScore = Math.max(
          Math.min(
            Math.round(points / 50) +
              completedBookings.length * 5 +
              trips * 3 -
              cancelledBookings.length * 8 -
              (user.suspended ? 40 : 0),
            100
          ),
          0
        );

        const tier: LoyaltyTier =
          points >= 8000 || loyaltyScore >= 90
            ? "platinum"
            : points >= 4000 || loyaltyScore >= 75
            ? "gold"
            : points >= 1500 || loyaltyScore >= 55
            ? "silver"
            : points >= 300 || loyaltyScore >= 25
            ? "bronze"
            : "new";

        const cashback =
          tier === "platinum"
            ? spend * 0.08
            : tier === "gold"
            ? spend * 0.05
            : tier === "silver"
            ? spend * 0.03
            : tier === "bronze"
            ? spend * 0.01
            : 0;

        const freeRideCredits =
          tier === "platinum"
            ? 3
            : tier === "gold"
            ? 2
            : tier === "silver"
            ? 1
            : 0;

        const insight =
          tier === "platinum"
            ? "VIP user. Strong loyalty and high-value RoadLink activity."
            : tier === "gold"
            ? "Loyal user. Good candidate for rewards and premium offers."
            : tier === "silver"
            ? "Growing loyal user. Encourage more completed rides."
            : tier === "bronze"
            ? "Early loyalty signal. Use coupons to increase retention."
            : "New or inactive user. Needs onboarding and activation.";

        return {
          id: user.id,
          userId: user.id,
          name: user.name || "RoadLink User",
          email: user.email || "No email",
          tier,
          points,
          trips,
          completedBookings: completedBookings.length,
          cancelledBookings: cancelledBookings.length,
          spend,
          cashback,
          freeRideCredits,
          loyaltyScore,
          suspended: Boolean(user.suspended),
          insight,
        };
      })
      .sort((a, b) => b.loyaltyScore + b.spend / 100 - (a.loyaltyScore + a.spend / 100));
  }, [users, bookings, rides]);

  const filteredProfiles = useMemo(() => {
    if (filter === "all") return loyaltyProfiles;
    return loyaltyProfiles.filter((item) => item.tier === filter);
  }, [loyaltyProfiles, filter]);

  useEffect(() => {
    setSelected((current) => {
      if (filteredProfiles.length === 0) return null;
      if (!current) return filteredProfiles[0];
      return filteredProfiles.find((item) => item.id === current.id) || filteredProfiles[0];
    });
  }, [filteredProfiles]);

  const platinum = loyaltyProfiles.filter((item) => item.tier === "platinum").length;
  const gold = loyaltyProfiles.filter((item) => item.tier === "gold").length;
  const silver = loyaltyProfiles.filter((item) => item.tier === "silver").length;
  const bronze = loyaltyProfiles.filter((item) => item.tier === "bronze").length;
  const totalCashback = loyaltyProfiles.reduce((total, item) => total + item.cashback, 0);
  const totalPoints = loyaltyProfiles.reduce((total, item) => total + item.points, 0);

  async function saveLoyalty(profile: LoyaltyProfile) {
    try {
      setSavingId(profile.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "loyaltyProfiles", profile.id),
        {
          ...profile,
          savedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "notifications", `loyalty-${profile.id}-${Date.now()}`),
        {
          userId: profile.userId,
          type: "loyalty_update",
          title: "RoadLink Rewards Update",
          message: `You are now in the ${tierLabel(profile.tier)} tier with ${profile.points} points.`,
          read: false,
          actionUrl: "/profile",
          createdAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "auditLogs", `loyalty-${profile.id}-${Date.now()}`),
        {
          userId: profile.userId,
          userEmail: profile.email,
          action: "Loyalty Profile Saved",
          targetId: profile.id,
          targetType: "loyaltyProfile",
          details: `${tierLabel(profile.tier)} tier, ${profile.points} points`,
          severity: profile.tier === "platinum" || profile.tier === "gold" ? "success" : "info",
          createdAt: now,
        },
        { merge: true }
      );

      setMessage("Loyalty profile saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not save loyalty profile.");
    } finally {
      setSavingId("");
    }
  }

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function tierLabel(tier: LoyaltyTier) {
    if (tier === "platinum") return "Platinum";
    if (tier === "gold") return "Gold";
    if (tier === "silver") return "Silver";
    if (tier === "bronze") return "Bronze";
    return "New";
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
          <Link href="/admin/passenger-intelligence" className="miniButton">Passengers</Link>
          <Link href="/admin/coupons" className="miniButton">Coupons</Link>
          <Link href="/admin/growth-intelligence" className="miniButton">Growth</Link>
          <Link href="/admin/marketing" className="miniButton">Marketing</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Rewards</p>
            <h1>Loyalty <span>Center</span></h1>
            <p className="subtitle">
              Manage RoadLink Rewards points, loyalty tiers, cashback, free ride credits,
              VIP users, retention signals and reward notifications.
            </p>
          </div>

          <div className={platinum + gold > 0 ? "scoreOrb" : "scoreOrb warningScore"}>
            <strong>{platinum + gold}</strong>
            <span>VIP Users</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="💎" label="Platinum" value={String(platinum)} />
          <Metric icon="🥇" label="Gold" value={String(gold)} />
          <Metric icon="🥈" label="Silver" value={String(silver)} />
          <Metric icon="🥉" label="Bronze" value={String(bronze)} />
          <Metric icon="⭐" label="Total Points" value={totalPoints.toLocaleString()} />
          <Metric icon="💵" label="Cashback" value={money(totalCashback)} />
        </section>

        <section className="filters">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | LoyaltyTier)}
          >
            <option value="all">All users</option>
            <option value="platinum">Platinum</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
            <option value="new">New</option>
          </select>
        </section>

        <section className="adminGrid">
          <section className="loyaltyCard">
            <p className="eyebrow">Rewards Board</p>
            <h2>Loyalty Profiles</h2>

            {filteredProfiles.length === 0 ? (
              <div className="empty">
                <h3>No loyalty data found</h3>
                <p>Loyalty profiles will appear after users and bookings exist.</p>
              </div>
            ) : (
              <div className="loyaltyList">
                {filteredProfiles.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={selected?.id === item.id ? "loyaltyRow activeLoyalty" : "loyaltyRow"}
                  >
                    <div className={`loyaltyIcon ${item.tier}`}>
                      {item.tier === "platinum"
                        ? "💎"
                        : item.tier === "gold"
                        ? "🥇"
                        : item.tier === "silver"
                        ? "🥈"
                        : item.tier === "bronze"
                        ? "🥉"
                        : "🆕"}
                    </div>

                    <div className="loyaltyInfo">
                      <strong>{shortText(item.name)}</strong>
                      <span>{shortText(item.email)}</span>
                      <small>{item.points.toLocaleString()} points • {tierLabel(item.tier)}</small>
                    </div>

                    <em className={`status ${item.tier}`}>
                      {tierLabel(item.tier)}
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
                    <p className="eyebrow">Selected User</p>
                    <h2>{shortText(selected.name, 54)}</h2>
                    <p className="email">{selected.email}</p>
                  </div>

                  <span className={`statusPill ${selected.tier}`}>
                    {tierLabel(selected.tier)}
                  </span>
                </div>

                <div className={`insightBox ${selected.tier}`}>
                  <span>Loyalty Points</span>
                  <strong>{selected.points.toLocaleString()}</strong>
                  <p>{selected.insight}</p>
                </div>

                <div className="scoreBar">
                  <div style={{ width: `${selected.loyaltyScore}%` }} />
                </div>

                <div className="infoGrid">
                  <Info label="Tier" value={tierLabel(selected.tier)} />
                  <Info label="Loyalty Score" value={`${selected.loyaltyScore}/100`} />
                  <Info label="Points" value={selected.points.toLocaleString()} />
                  <Info label="Trips" value={String(selected.trips)} />
                  <Info label="Completed Bookings" value={String(selected.completedBookings)} />
                  <Info label="Cancelled Bookings" value={String(selected.cancelledBookings)} />
                  <Info label="Total Spend" value={money(selected.spend)} />
                  <Info label="Cashback" value={money(selected.cashback)} />
                  <Info label="Free Ride Credits" value={String(selected.freeRideCredits)} />
                  <Info label="Suspended" value={selected.suspended ? "Yes" : "No"} />
                  <Info label="User ID" value={selected.userId} />
                  <Info label="Email" value={selected.email} />
                </div>

                <section className="summaryBox">
                  <p className="eyebrow">Reward Recommendation</p>
                  <h2>
                    {selected.tier === "platinum"
                      ? "VIP retention priority"
                      : selected.tier === "gold"
                      ? "Offer premium rewards"
                      : selected.tier === "silver"
                      ? "Push toward Gold"
                      : selected.tier === "bronze"
                      ? "Send ride coupon"
                      : "Activate user"}
                  </h2>
                  <p>{selected.insight}</p>
                </section>

                <div className="actionRow">
                  <button
                    className="saveButton"
                    onClick={() => saveLoyalty(selected)}
                    disabled={savingId === selected.id}
                  >
                    Save Loyalty
                  </button>

                  <Link href="/admin/coupons" className="linkButton">Coupons</Link>
                  <Link href="/admin/passenger-intelligence" className="linkButton">Passengers</Link>
                  <Link href="/admin/growth-intelligence" className="dangerButton">Growth</Link>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select user</h3>
                <p>Choose a user to view loyalty details.</p>
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
        .loyaltyCard,
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
        .scoreOrb strong { color: #22c55e; font-size: 28px; font-weight: 900; }
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

        .loyaltyCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
          overflow: hidden;
        }

        .loyaltyList {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .loyaltyRow {
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

        .activeLoyalty { border-color: rgba(34,197,94,0.45); background: rgba(34,197,94,0.1); }

        .loyaltyIcon {
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

        .loyaltyIcon.new { background: rgba(239,68,68,0.13); border-color: rgba(239,68,68,0.35); }

        .loyaltyInfo { min-width: 0; }

        .loyaltyInfo strong,
        .loyaltyInfo span,
        .loyaltyInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .loyaltyInfo span,
        .loyaltyInfo small {
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

        .status.platinum,
        .status.gold,
        .status.silver,
        .status.bronze,
        .statusPill.platinum,
        .statusPill.gold,
        .statusPill.silver,
        .statusPill.bronze {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.new,
        .statusPill.new {
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

        .insightBox.new {
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

        .insightBox.new strong { color: #fca5a5; }

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

          .loyaltyRow {
            grid-template-columns: 46px 1fr;
          }

          .loyaltyRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .loyaltyIcon {
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
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
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
