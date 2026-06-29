"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  photoURL?: string;
  city?: string;
  state?: string;
  verified?: boolean;
  driverVerified?: boolean;
  ratingAverage?: number;
  ratingCount?: number;
  followers?: string[];
};

type Booking = {
  id: string;
  driverId?: string;
  driverEmail?: string;
  status?: string;
  price?: number;
  seatsBooked?: number;
  distanceMiles?: number;
};

type Rating = {
  id: string;
  driverId?: string;
  stars?: number;
  rating?: number;
};

type DriverRank = {
  userId: string;
  name: string;
  email: string;
  photoURL: string;
  location: string;
  verified: boolean;
  completedTrips: number;
  passengers: number;
  earnings: number;
  miles: number;
  rating: number;
  reviews: number;
  followers: number;
  score: number;
};

type FilterKey = "score" | "earnings" | "trips" | "rating" | "miles";

export default function DriverLeaderboardPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [filter, setFilter] = useState<FilterKey>("score");
  const [status, setStatus] = useState("Loading driver leaderboard...");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setStatus("Please sign in to view leaderboard.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setStatus("");
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setUsers(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as UserProfile[]
        );
      },
      (error) => setStatus(error.message)
    );

    const unsubBookings = onSnapshot(
      query(collection(db, "bookings")),
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

    const unsubRatings = onSnapshot(
      query(collection(db, "ratings")),
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
      unsubUsers();
      unsubBookings();
      unsubRatings();
    };
  }, []);

  function cleanStatus(value?: string) {
    return String(value || "").toLowerCase();
  }

  function money(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  const rankings = useMemo(() => {
    const driverIds = new Set<string>();

    users.forEach((user) => {
      if (user.driverVerified || user.verified || user.ratingCount || user.ratingAverage) {
        driverIds.add(user.id);
      }
    });

    bookings.forEach((booking) => {
      if (booking.driverId) driverIds.add(booking.driverId);
    });

    ratings.forEach((rating) => {
      if (rating.driverId) driverIds.add(rating.driverId);
    });

    const data: DriverRank[] = Array.from(driverIds).map((driverId) => {
      const profile = users.find((user) => user.id === driverId);

      const driverBookings = bookings.filter(
        (booking) =>
          booking.driverId === driverId &&
          cleanStatus(booking.status) === "completed"
      );

      const driverRatings = ratings.filter((rating) => rating.driverId === driverId);

      const earnings = driverBookings.reduce(
        (total, booking) =>
          total + Number(booking.price || 0) * Number(booking.seatsBooked || 1),
        0
      );

      const miles = driverBookings.reduce(
        (total, booking) => total + Number(booking.distanceMiles || 0),
        0
      );

      const passengers = driverBookings.reduce(
        (total, booking) => total + Number(booking.seatsBooked || 1),
        0
      );

      const rating =
        driverRatings.length > 0
          ? driverRatings.reduce(
              (total, item) => total + Number(item.stars || item.rating || 0),
              0
            ) / driverRatings.length
          : Number(profile?.ratingAverage || 0);

      const reviews = Math.max(driverRatings.length, Number(profile?.ratingCount || 0));
      const followers = Array.isArray(profile?.followers) ? profile.followers.length : 0;
      const verified = Boolean(profile?.driverVerified || profile?.verified);

      const score = Math.round(
        driverBookings.length * 18 +
          passengers * 6 +
          miles * 0.4 +
          rating * 40 +
          reviews * 4 +
          followers * 2 +
          (verified ? 50 : 0)
      );

      const location =
        profile?.city || profile?.state
          ? `${profile.city || ""}${profile.city && profile.state ? ", " : ""}${profile.state || ""}`
          : "RoadLink";

      return {
        userId: driverId,
        name: profile?.name || profile?.email || "RoadLink Driver",
        email:
          profile?.email ||
          bookings.find((booking) => booking.driverId === driverId)?.driverEmail ||
          "Driver",
        photoURL: profile?.photoURL || "",
        location,
        verified,
        completedTrips: driverBookings.length,
        passengers,
        earnings,
        miles,
        rating,
        reviews,
        followers,
        score,
      };
    });

    return data.sort((a, b) => Number(b[filter]) - Number(a[filter]));
  }, [users, bookings, ratings, filter]);

  const topDriver = rankings[0];

  const stats = useMemo(() => {
    const totalEarnings = rankings.reduce((total, driver) => total + driver.earnings, 0);
    const totalTrips = rankings.reduce((total, driver) => total + driver.completedTrips, 0);
    const totalMiles = rankings.reduce((total, driver) => total + driver.miles, 0);
    const avgRating =
      rankings.length > 0
        ? rankings.reduce((total, driver) => total + driver.rating, 0) / rankings.length
        : 0;

    return {
      drivers: rankings.length,
      totalEarnings,
      totalTrips,
      totalMiles,
      avgRating,
    };
  }, [rankings]);

  const filters: { key: FilterKey; label: string; icon: string }[] = [
    { key: "score", label: "Score", icon: "🏆" },
    { key: "earnings", label: "Earnings", icon: "💰" },
    { key: "trips", label: "Trips", icon: "🚗" },
    { key: "rating", label: "Rating", icon: "⭐" },
    { key: "miles", label: "Miles", icon: "🛣️" },
  ];

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/driver-earnings" className="navButton">Driver Earnings</Link>
          <Link href="/reviews" className="navButton">Reviews</Link>
          <Link href="/analytics-center" className="navButton">Analytics</Link>
          <Link href="/community" className="navButton">Community</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Competition</p>
            <h1>Driver <span>Leaderboard</span></h1>
            <p className="subtitle">
              Premium ranking of RoadLink drivers by score, earnings, completed trips, rating and miles.
            </p>
          </div>

          <div className="liveOrb">
            <strong>#{topDriver ? 1 : 0}</strong>
            <span>{topDriver?.name || "No drivers"}</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="👥" label="Ranked Drivers" value={String(stats.drivers)} />
          <Metric icon="💰" label="Total Earnings" value={money(stats.totalEarnings)} />
          <Metric icon="🚗" label="Completed Trips" value={String(stats.totalTrips)} />
          <Metric icon="🛣️" label="Total Miles" value={`${stats.totalMiles.toFixed(1)} mi`} />
          <Metric icon="⭐" label="Avg Rating" value={stats.avgRating ? stats.avgRating.toFixed(1) : "New"} />
        </section>

        <section className="filters">
          {filters.map((item) => (
            <button
              key={item.key}
              className={filter === item.key ? "filterButton activeFilter" : "filterButton"}
              onClick={() => setFilter(item.key)}
            >
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </section>

        {topDriver && (
          <section className="champion">
            <div className="championBadge">🏆</div>

            <div>
              <p className="eyebrow">Top Driver</p>
              <h2>{topDriver.name}</h2>
              <p>{topDriver.email}</p>

              <div className="championMeta">
                <span>Score {topDriver.score}</span>
                <span>{topDriver.completedTrips} trips</span>
                <span>{money(topDriver.earnings)}</span>
                <span>{topDriver.rating ? topDriver.rating.toFixed(1) : "New"} rating</span>
              </div>
            </div>

            <Link href={`/driver-profile?driverId=${topDriver.userId}`} className="profileButton">
              View Profile
            </Link>
          </section>
        )}

        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Rankings</p>
              <h2>{rankings.length} Drivers</h2>
            </div>
          </div>

          {rankings.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🏆</div>
              <h3>No ranked drivers yet</h3>
              <p>Drivers will appear here after completed bookings, reviews, or verification activity.</p>
            </div>
          ) : (
            <div className="list">
              {rankings.map((driver, index) => {
                const isCurrentUser = driver.userId === userId;

                return (
                  <article
                    key={driver.userId}
                    className={isCurrentUser ? "driverCard currentUser" : "driverCard"}
                  >
                    <div className="rank">
                      #{index + 1}
                    </div>

                    <div className="driverAvatar">
                      {driver.photoURL ? (
                        <img src={driver.photoURL} alt={driver.name} />
                      ) : (
                        <span>{driver.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>

                    <div className="driverInfo">
                      <div className="driverTop">
                        <div>
                          <h3>
                            {driver.name} {driver.verified ? "✓" : ""}
                          </h3>
                          <p>{driver.email}</p>
                          <small>📍 {driver.location}</small>
                        </div>

                        <div className="scoreBox">
                          <strong>{driver.score}</strong>
                          <span>Score</span>
                        </div>
                      </div>

                      <div className="metricsGrid">
                        <Info label="Trips" value={String(driver.completedTrips)} />
                        <Info label="Earnings" value={money(driver.earnings)} />
                        <Info label="Miles" value={`${driver.miles.toFixed(1)} mi`} />
                        <Info label="Passengers" value={String(driver.passengers)} />
                        <Info label="Rating" value={driver.rating ? `${driver.rating.toFixed(1)}/5` : "New"} />
                        <Info label="Reviews" value={String(driver.reviews)} />
                        <Info label="Followers" value={String(driver.followers)} />
                        <Info label="Status" value={driver.verified ? "Verified" : "Member"} />
                      </div>

                      <div className="actions">
                        <Link href={`/driver-profile?driverId=${driver.userId}`} className="actionButton greenButton">
                          View Driver
                        </Link>

                        <Link href={`/chat?driverId=${driver.userId}`} className="actionButton">
                          Message
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
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
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
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

        .navButton,
        .actionButton,
        .profileButton {
          color: white;
          text-decoration: none;
          font-weight: 900;
          padding: 12px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          display: inline-flex;
          justify-content: center;
        }

        .hero,
        .metric,
        .filters,
        .champion,
        .panel,
        .driverCard {
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
        .liveOrb strong,
        .scoreBox strong {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          max-width: 760px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .liveOrb {
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
          padding: 16px;
        }

        .liveOrb strong {
          font-size: 28px;
        }

        .liveOrb span {
          color: #d4d4d8;
          font-size: 12px;
          font-weight: 900;
          max-width: 90px;
        }

        .status {
          color: #22c55e;
          text-align: center;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
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

        .filters {
          border-radius: 26px;
          padding: 14px;
          margin-bottom: 20px;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .filterButton {
          border-radius: 18px;
          padding: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .activeFilter {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.4);
        }

        .filterButton span {
          display: block;
          font-size: 24px;
          margin-bottom: 6px;
        }

        .filterButton strong {
          display: block;
        }

        .champion {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 20px;
          align-items: center;
          border-radius: 30px;
          padding: 30px;
          margin-bottom: 20px;
        }

        .championBadge {
          width: 86px;
          height: 86px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
        }

        .champion h2 {
          margin: 0 0 8px;
          font-size: 34px;
        }

        .champion p {
          color: #a1a1aa;
          margin: 0;
        }

        .championMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .championMeta span {
          color: #d4d4d8;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 13px;
          font-weight: 900;
        }

        .profileButton,
        .greenButton {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
        }

        .panel {
          border-radius: 30px;
          padding: 30px;
        }

        .sectionHeader {
          margin-bottom: 20px;
        }

        .list {
          display: grid;
          gap: 16px;
        }

        .driverCard {
          display: grid;
          grid-template-columns: auto auto 1fr;
          gap: 16px;
          border-radius: 26px;
          padding: 22px;
          box-shadow: none;
        }

        .currentUser {
          border-color: rgba(34,197,94,0.5);
          background: rgba(34,197,94,0.08);
        }

        .rank {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
          font-weight: 900;
        }

        .driverAvatar,
        .driverAvatar img,
        .driverAvatar span {
          width: 64px;
          height: 64px;
          border-radius: 50%;
        }

        .driverAvatar img {
          object-fit: cover;
          border: 2px solid rgba(34,197,94,0.45);
        }

        .driverAvatar span {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          font-weight: 900;
        }

        .driverTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 14px;
        }

        .driverTop h3 {
          margin: 0 0 5px;
          font-size: 24px;
          overflow-wrap: anywhere;
        }

        .driverTop p,
        .driverTop small {
          color: #a1a1aa;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .scoreBox {
          min-width: 90px;
          text-align: center;
          padding: 12px;
          border-radius: 18px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.3);
        }

        .scoreBox strong {
          display: block;
          font-size: 28px;
        }

        .scoreBox span {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
        }

        .metricsGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 14px;
        }

        .info {
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .info span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .info strong {
          display: block;
          color: #e5e7eb;
          overflow-wrap: anywhere;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .empty {
          min-height: 260px;
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

        .empty p {
          color: #a1a1aa;
        }

        @media (max-width: 1000px) {
          .stats,
          .filters,
          .metricsGrid {
            grid-template-columns: 1fr 1fr;
          }

          .hero,
          .champion,
          .driverTop {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .driverCard {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 44px;
          }

          .scoreBox {
            text-align: left;
          }
        }

        @media (max-width: 650px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .champion,
          .panel,
          .driverCard {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .filters,
          .metricsGrid {
            grid-template-columns: 1fr;
          }

          .actions {
            display: grid;
          }

          .actionButton,
          .profileButton {
            width: 100%;
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
