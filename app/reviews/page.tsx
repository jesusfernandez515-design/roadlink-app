"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

type Rating = {
  id: string;
  stars?: number;
  rating?: number;
  comment?: string;
  reviewerEmail?: string;
  passengerEmail?: string;
  driverEmail?: string;
  driverId?: string;
  passengerId?: string;
  from?: string;
  to?: string;
  vehicle?: string;
  createdAt?: string;
};

type ViewMode = "mine" | "given" | "all";
type StarFilter = "all" | "5" | "4plus" | "low";

export default function ReviewsPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [allReviews, setAllReviews] = useState<Rating[]>([]);
  const [myDriverReviews, setMyDriverReviews] = useState<Rating[]>([]);
  const [givenReviews, setGivenReviews] = useState<Rating[]>([]);
  const [status, setStatus] = useState("Loading reviews...");
  const [viewMode, setViewMode] = useState<ViewMode>("mine");
  const [starFilter, setStarFilter] = useState<StarFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let unsubscribeAll: (() => void) | undefined;
    let unsubscribeMine: (() => void) | undefined;
    let unsubscribeGivenByPassengerId: (() => void) | undefined;
    let unsubscribeGivenByEmail: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId("");
        setUserEmail("");
        setStatus("Please sign in to view reviews.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setStatus("");

      unsubscribeAll = onSnapshot(
        query(collection(db, "ratings")),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Rating[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setAllReviews(data);
        },
        (error) => setStatus(error.message)
      );

      unsubscribeMine = onSnapshot(
        query(collection(db, "ratings"), where("driverId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Rating[];

          data.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

          setMyDriverReviews(data);
        },
        (error) => setStatus(error.message)
      );

      unsubscribeGivenByPassengerId = onSnapshot(
        query(collection(db, "ratings"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Rating[];

          setGivenReviews((previous) => mergeReviews(previous, data));
        },
        (error) => setStatus(error.message)
      );

      if (user.email) {
        unsubscribeGivenByEmail = onSnapshot(
          query(collection(db, "ratings"), where("reviewerEmail", "==", user.email)),
          (snapshot) => {
            const data = snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })) as Rating[];

            setGivenReviews((previous) => mergeReviews(previous, data));
          },
          (error) => setStatus(error.message)
        );
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeAll) unsubscribeAll();
      if (unsubscribeMine) unsubscribeMine();
      if (unsubscribeGivenByPassengerId) unsubscribeGivenByPassengerId();
      if (unsubscribeGivenByEmail) unsubscribeGivenByEmail();
    };
  }, []);

  function mergeReviews(a: Rating[], b: Rating[]) {
    const map = new Map<string, Rating>();

    [...a, ...b].forEach((review) => {
      map.set(review.id, review);
    });

    return Array.from(map.values()).sort((x, y) =>
      String(y.createdAt || "").localeCompare(String(x.createdAt || ""))
    );
  }

  function getStars(review: Rating) {
    return Number(review.stars || review.rating || 0);
  }

  const sourceReviews =
    viewMode === "mine"
      ? myDriverReviews
      : viewMode === "given"
      ? givenReviews
      : allReviews;

  const visibleReviews = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return sourceReviews.filter((review) => {
      const stars = getStars(review);
      const combined = [
        review.comment,
        review.reviewerEmail,
        review.passengerEmail,
        review.driverEmail,
        review.from,
        review.to,
        review.vehicle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (starFilter === "5" && stars !== 5) return false;
      if (starFilter === "4plus" && stars < 4) return false;
      if (starFilter === "low" && stars >= 4) return false;

      if (!searchText) return true;

      return combined.includes(searchText);
    });
  }, [sourceReviews, search, starFilter]);

  const average = useMemo(() => {
    if (visibleReviews.length === 0) return 0;

    const total = visibleReviews.reduce((sum, item) => sum + getStars(item), 0);

    return Number((total / visibleReviews.length).toFixed(1));
  }, [visibleReviews]);

  const fiveStarReviews = visibleReviews.filter((review) => getStars(review) === 5).length;
  const fourPlusReviews = visibleReviews.filter((review) => getStars(review) >= 4).length;
  const lowReviews = visibleReviews.filter((review) => getStars(review) > 0 && getStars(review) < 4).length;

  const excellentRate =
    visibleReviews.length > 0
      ? Math.round((fourPlusReviews / visibleReviews.length) * 100)
      : 0;

  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = visibleReviews.filter((review) => getStars(review) === stars).length;
    const percent = visibleReviews.length > 0 ? Math.round((count / visibleReviews.length) * 100) : 0;

    return { stars, count, percent };
  });

  function formatDate(value?: string) {
    if (!value) return "Recently";

    try {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) return "Recently";

      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  function renderStars(count: number) {
    const safeCount = Math.max(0, Math.min(5, Math.round(count)));
    return "★".repeat(safeCount) + "☆".repeat(5 - safeCount);
  }

  function getInitial(review: Rating) {
    return (review.reviewerEmail || review.passengerEmail || review.driverEmail || "R")
      .charAt(0)
      .toUpperCase();
  }

  function activeTitle() {
    if (viewMode === "mine") return "Reviews About You";
    if (viewMode === "given") return "Reviews You Gave";
    return "Community Reviews";
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/dashboard" className="button">Dashboard</Link>
          <Link href="/profile" className="button">Profile</Link>
          <Link href="/rate-driver" className="button">Rate Driver</Link>
          <Link href="/notifications" className="button">Notifications</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Reputation Center</p>

            <h1>
              Reviews <span>Center</span>
            </h1>

            <p className="subtitle">
              Track driver reputation, passenger feedback, trusted trip history,
              your reviews, community feedback and RoadLink trust signals.
            </p>

            <div className="modeButtons">
              <button
                className={viewMode === "mine" ? "modeButton activeMode" : "modeButton"}
                onClick={() => setViewMode("mine")}
              >
                My Driver Reviews
              </button>

              <button
                className={viewMode === "given" ? "modeButton activeMode" : "modeButton"}
                onClick={() => setViewMode("given")}
              >
                Reviews I Gave
              </button>

              <button
                className={viewMode === "all" ? "modeButton activeMode" : "modeButton"}
                onClick={() => setViewMode("all")}
              >
                Community Reviews
              </button>
            </div>
          </div>

          <div className="heroScore">
            <strong>{visibleReviews.length > 0 ? average : "New"}</strong>
            <span>{visibleReviews.length} review{visibleReviews.length === 1 ? "" : "s"}</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric label="Average Rating" value={visibleReviews.length ? `${average}/5` : "New"} icon="⭐" />
          <Metric label="Total Reviews" value={String(visibleReviews.length)} icon="📝" />
          <Metric label="5-Star Reviews" value={String(fiveStarReviews)} icon="🏆" />
          <Metric label="Excellent Rate" value={`${excellentRate}%`} icon="📈" />
          <Metric label="Low Reviews" value={String(lowReviews)} icon="⚠️" />
          <Metric label="Mode" value={viewMode === "mine" ? "Mine" : viewMode === "given" ? "Given" : "All"} icon="🔎" />
        </section>

        <section className="controls">
          <div>
            <p className="eyebrow">Review Filters</p>
            <h2>Search & Rating Filters</h2>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by comment, email, route or vehicle..."
          />

          <div className="filterGrid">
            <FilterButton label="All" value="all" current={starFilter} setStarFilter={setStarFilter} count={sourceReviews.length} />
            <FilterButton label="5 Stars" value="5" current={starFilter} setStarFilter={setStarFilter} count={fiveStarReviews} />
            <FilterButton label="4+ Stars" value="4plus" current={starFilter} setStarFilter={setStarFilter} count={fourPlusReviews} />
            <FilterButton label="Below 4" value="low" current={starFilter} setStarFilter={setStarFilter} count={lowReviews} />
          </div>
        </section>

        <section className="distributionCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Rating Breakdown</p>
              <h2>Star Distribution</h2>
            </div>

            <div className="ratingPill">
              {visibleReviews.length > 0 ? `${average} / 5` : "No rating yet"}
            </div>
          </div>

          <div className="distributionList">
            {distribution.map((row) => (
              <div className="distributionRow" key={row.stars}>
                <span>{row.stars}★</span>
                <div className="bar">
                  <div style={{ width: `${row.percent}%` }} />
                </div>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="reviewsSection">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">
                {viewMode === "mine"
                  ? "Your Reputation"
                  : viewMode === "given"
                  ? "Your Feedback"
                  : "Community Reputation"}
              </p>

              <h2>{activeTitle()}</h2>
            </div>

            <div className="ratingPill">
              {visibleReviews.length > 0 ? `${average} / 5` : "No rating yet"}
            </div>
          </div>

          {visibleReviews.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">⭐</div>

              <h3>No reviews found</h3>

              <p>
                When passengers rate completed trips, reviews will appear here
                and improve RoadLink reputation.
              </p>

              <Link href="/dashboard" className="mainButton">
                Back to Dashboard
              </Link>
            </div>
          ) : (
            <div className="reviewsGrid">
              {visibleReviews.map((review) => {
                const stars = getStars(review);

                return (
                  <article className="reviewCard" key={review.id}>
                    <div className="reviewTop">
                      <div className="reviewAvatar">{getInitial(review)}</div>

                      <div>
                        <h3>{renderStars(stars)}</h3>

                        <p className="reviewer">
                          {review.reviewerEmail ||
                            review.passengerEmail ||
                            "RoadLink Passenger"}
                        </p>
                      </div>
                    </div>

                    <p className="comment">
                      {review.comment?.trim() || "No written comment provided."}
                    </p>

                    <div className="meta">
                      <span>{stars} star{stars === 1 ? "" : "s"}</span>

                      {review.from || review.to ? (
                        <span>
                          {review.from || "Starting point"} → {review.to || "Destination"}
                        </span>
                      ) : (
                        <span>RoadLink trip</span>
                      )}

                      {review.vehicle && <span>🚘 {review.vehicle}</span>}

                      <span>{formatDate(review.createdAt)}</span>
                    </div>

                    {review.driverEmail && (
                      <p className="driver">Driver: {review.driverEmail}</p>
                    )}

                    {review.driverId && (
                      <Link
                        href={`/driver-profile?driverId=${review.driverId}`}
                        className="profileLink"
                      >
                        View Driver Profile
                      </Link>
                    )}
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
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 32%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          padding: 24px;
          padding-bottom: 120px;
          color: white;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1080px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }

        .button {
          text-decoration: none;
          color: white;
          padding: 12px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          font-weight: 900;
        }

        .hero,
        .metric,
        .reviewsSection,
        .reviewCard,
        .controls,
        .distributionCard {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 34px;
          padding: 34px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
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
          font-size: 60px;
          line-height: 1;
          margin: 0 0 16px;
          letter-spacing: -1px;
        }

        h1 span {
          color: #22c55e;
        }

        h2 {
          font-size: 32px;
          margin: 0;
        }

        .subtitle {
          color: #a1a1aa;
          max-width: 680px;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
        }

        .modeButtons {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
        }

        .modeButton {
          padding: 12px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .activeMode {
          background: rgba(34,197,94,0.14);
          border-color: rgba(34,197,94,0.4);
          color: #22c55e;
        }

        .heroScore {
          min-width: 120px;
          height: 120px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          box-shadow: 0 18px 55px rgba(34,197,94,0.25);
          text-align: center;
        }

        .heroScore strong {
          color: #22c55e;
          font-size: 32px;
          font-weight: 900;
        }

        .heroScore span {
          color: #d4d4d8;
          font-size: 12px;
          font-weight: 900;
        }

        .status {
          color: #22c55e;
          text-align: center;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .metric {
          border-radius: 24px;
          padding: 18px;
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 23px;
          margin-bottom: 12px;
        }

        .metricLabel {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          display: block;
          margin-bottom: 7px;
        }

        .metricValue {
          color: #22c55e;
          font-size: 24px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .controls,
        .distributionCard,
        .reviewsSection {
          border-radius: 30px;
          padding: 28px;
          margin-bottom: 20px;
        }

        .controls {
          display: grid;
          gap: 16px;
        }

        input {
          width: 100%;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          outline: none;
          font-size: 16px;
        }

        input:focus {
          border-color: rgba(34,197,94,0.55);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.08);
        }

        .filterGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .filterButton {
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: white;
          cursor: pointer;
          font-weight: 900;
          text-align: left;
        }

        .activeFilter {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.12);
        }

        .filterButton span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .filterButton strong {
          color: #22c55e;
          font-size: 22px;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          margin-bottom: 24px;
        }

        .ratingPill {
          padding: 11px 16px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
        }

        .distributionList {
          display: grid;
          gap: 12px;
        }

        .distributionRow {
          display: grid;
          grid-template-columns: 48px 1fr 40px;
          align-items: center;
          gap: 12px;
        }

        .distributionRow span,
        .distributionRow strong {
          color: #d4d4d8;
          font-weight: 900;
        }

        .bar {
          height: 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }

        .bar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .empty {
          min-height: 310px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
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
          margin-bottom: 18px;
        }

        .empty h3 {
          font-size: 30px;
          margin: 0 0 10px;
        }

        .empty p {
          color: #a1a1aa;
          max-width: 520px;
          line-height: 1.5;
          margin: 0;
        }

        .mainButton {
          display: inline-flex;
          margin-top: 22px;
          padding: 16px 28px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          text-decoration: none;
        }

        .reviewsGrid {
          display: grid;
          gap: 16px;
        }

        .reviewCard {
          border-radius: 24px;
          padding: 24px;
        }

        .reviewTop {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 18px;
        }

        .reviewAvatar {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: 900;
          box-shadow: 0 12px 35px rgba(34,197,94,0.25);
        }

        .reviewCard h3 {
          color: #facc15;
          font-size: 25px;
          margin: 0 0 6px;
          letter-spacing: 2px;
        }

        .reviewer {
          color: #a1a1aa;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .comment {
          color: #e5e7eb;
          font-size: 18px;
          line-height: 1.5;
          margin: 0 0 18px;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .meta span {
          color: #d4d4d8;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 13px;
          font-weight: 900;
        }

        .driver {
          margin: 16px 0 0;
          color: #22c55e;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .profileLink {
          display: inline-flex;
          margin-top: 16px;
          padding: 12px 16px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
          text-decoration: none;
        }

        @media (max-width: 980px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .filterGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 800px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 46px;
          }

          .heroScore {
            min-width: 100px;
            height: 100px;
          }

          .stats,
          .filterGrid {
            grid-template-columns: 1fr;
          }

          .controls,
          .distributionCard,
          .reviewsSection {
            padding: 22px;
            border-radius: 28px;
          }

          .sectionHeader {
            flex-direction: column;
            align-items: flex-start;
          }

          .ratingPill {
            width: 100%;
            text-align: center;
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
      <div className="metricValue">{value}</div>
    </div>
  );
}

function FilterButton({
  label,
  value,
  current,
  setStarFilter,
  count,
}: {
  label: string;
  value: StarFilter;
  current: StarFilter;
  setStarFilter: (value: StarFilter) => void;
  count: number;
}) {
  return (
    <button
      type="button"
      className={current === value ? "filterButton activeFilter" : "filterButton"}
      onClick={() => setStarFilter(value)}
    >
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
                                           }
