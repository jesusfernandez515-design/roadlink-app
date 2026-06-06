"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Rating = {
  id: string;
  stars?: number;
  rating?: number;
  comment?: string;
  reviewerEmail?: string;
  passengerEmail?: string;
  driverEmail?: string;
  from?: string;
  to?: string;
  createdAt?: string;
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Rating[]>([]);
  const [status, setStatus] = useState("Loading reviews...");

  useEffect(() => {
    const reviewsQuery = query(collection(db, "ratings"));

    const unsubscribe = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Rating[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setReviews(data);
        setStatus("");
      },
      (error) => {
        setStatus(error.message);
      }
    );

    return () => unsubscribe();
  }, []);

  function getStars(review: Rating) {
    return Number(review.stars || review.rating || 0);
  }

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;

    const total = reviews.reduce((sum, item) => sum + getStars(item), 0);

    return Number((total / reviews.length).toFixed(1));
  }, [reviews]);

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
    const safeCount = Math.max(0, Math.min(5, count));

    return "★".repeat(safeCount) + "☆".repeat(5 - safeCount);
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/dashboard" className="button">
            Dashboard
          </Link>

          <Link href="/profile" className="button">
            Profile
          </Link>

          <Link href="/notifications" className="button">
            Notifications
          </Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Community</p>

            <h1>
              Driver <span>Reviews</span>
            </h1>

            <p className="subtitle">
              Real rider feedback, trusted driver reputation, and public review history.
            </p>
          </div>

          <div className="heroIcon">⭐</div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <div className="card">
            <small>Average Rating</small>
            <h2>⭐ {average}</h2>
          </div>

          <div className="card">
            <small>Total Reviews</small>
            <h2>{reviews.length}</h2>
          </div>

          <div className="card">
            <small>Status</small>
            <h2>{reviews.length > 0 ? "Live" : "New"}</h2>
          </div>
        </section>

        <section className="reviewsSection">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Recent Feedback</p>
              <h2>Reviews</h2>
            </div>

            <div className="ratingPill">
              {average > 0 ? `${average} / 5` : "No rating yet"}
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">⭐</div>
              <h3>No reviews yet</h3>
              <p>
                When passengers rate drivers, their reviews will appear here.
              </p>
            </div>
          ) : (
            <div className="reviewsGrid">
              {reviews.map((review) => {
                const stars = getStars(review);

                return (
                  <article className="reviewCard" key={review.id}>
                    <div className="reviewTop">
                      <div className="reviewAvatar">
                        {(review.reviewerEmail || review.passengerEmail || "R")
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <h3>{renderStars(stars)}</h3>
                        <p className="reviewer">
                          {review.reviewerEmail ||
                            review.passengerEmail ||
                            "RoadLink User"}
                        </p>
                      </div>
                    </div>

                    <p className="comment">
                      {review.comment?.trim() || "No comment provided."}
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

                      <span>{formatDate(review.createdAt)}</span>
                    </div>

                    {review.driverEmail && (
                      <p className="driver">
                        Driver: {review.driverEmail}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 32%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          padding: 24px;
          color: white;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1050px;
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

        .button:hover {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.12);
        }

        .hero,
        .card,
        .reviewsSection,
        .reviewCard {
          background: rgba(8, 13, 25, 0.9);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          border-radius: 32px;
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

        .subtitle {
          color: #a1a1aa;
          max-width: 660px;
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
        }

        .heroIcon {
          min-width: 96px;
          height: 96px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
          box-shadow: 0 18px 55px rgba(34,197,94,0.25);
        }

        .status {
          color: #22c55e;
          text-align: center;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .card {
          border-radius: 24px;
          padding: 24px;
        }

        .card small {
          color: #a1a1aa;
          font-weight: 900;
        }

        .card h2 {
          color: #22c55e;
          font-size: 36px;
          margin: 10px 0 0;
        }

        .reviewsSection {
          border-radius: 30px;
          padding: 30px;
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          margin-bottom: 24px;
        }

        .sectionHeader h2 {
          font-size: 36px;
          margin: 0;
        }

        .ratingPill {
          padding: 11px 16px;
          border-radius: 999px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
          font-weight: 900;
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

        @media (max-width: 700px) {
          .page {
            padding: 16px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 46px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

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
