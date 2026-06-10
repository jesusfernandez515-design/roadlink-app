"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ReviewItem = {
  id: string;
  rideId?: string;
  bookingId?: string;
  reviewerId?: string;
  reviewerEmail?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  driverId?: string;
  driverEmail?: string;
  passengerId?: string;
  passengerEmail?: string;
  rating?: number;
  comment?: string;
  review?: string;
  reported?: boolean;
  hidden?: boolean;
  status?: "active" | "hidden" | "reported" | "deleted";
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("Loading reviews...");
  const [loadingId, setLoadingId] = useState("");

  useEffect(() => {
    const unsubscribeRatings = onSnapshot(
      query(collection(db, "ratings")),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as ReviewItem[];

        data.sort((a, b) =>
          String(b.createdAt || b.updatedAt || "").localeCompare(
            String(a.createdAt || a.updatedAt || "")
          )
        );

        setReviews(data);
        setSelected((current) => {
          if (!current) return data[0] || null;
          return data.find((item) => item.id === current.id) || data[0] || null;
        });

        setMessage("");
      },
      (error) => setMessage(error.message)
    );

    return () => unsubscribeRatings();
  }, []);

  const filteredReviews = useMemo(() => {
    const value = search.toLowerCase().trim();

    return reviews.filter((review) => {
      const text = review.comment || review.review || "";

      const matchesSearch =
        !value ||
        String(review.reviewerEmail || "").toLowerCase().includes(value) ||
        String(review.targetUserEmail || "").toLowerCase().includes(value) ||
        String(review.driverEmail || "").toLowerCase().includes(value) ||
        String(review.passengerEmail || "").toLowerCase().includes(value) ||
        String(review.bookingId || "").toLowerCase().includes(value) ||
        String(review.rideId || "").toLowerCase().includes(value) ||
        String(review.id || "").toLowerCase().includes(value) ||
        String(text || "").toLowerCase().includes(value);

      const status = getReviewStatus(review);

      const matchesFilter =
        filter === "all" ||
        status === filter ||
        (filter === "reported" && Boolean(review.reported)) ||
        (filter === "hidden" && Boolean(review.hidden)) ||
        (filter === "low" && Number(review.rating || 0) <= 2) ||
        (filter === "high" && Number(review.rating || 0) >= 4);

      return matchesSearch && matchesFilter;
    });
  }, [reviews, search, filter]);

  const totalReviews = reviews.length;
  const reportedCount = reviews.filter((item) => item.reported).length;
  const hiddenCount = reviews.filter((item) => item.hidden || item.status === "hidden").length;
  const lowCount = reviews.filter((item) => Number(item.rating || 0) <= 2).length;

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;

    const total = reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);

  async function updateReview(review: ReviewItem, data: Partial<ReviewItem>, success: string) {
    try {
      setLoadingId(review.id);
      setMessage("");

      await setDoc(
        doc(db, "ratings", review.id),
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setMessage(success);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoadingId("");
    }
  }

  async function deleteReview(review: ReviewItem) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this review? This cannot be undone."
    );

    if (!confirmDelete) return;

    try {
      setLoadingId(review.id);
      setMessage("");

      await deleteDoc(doc(db, "ratings", review.id));

      setSelected(null);
      setMessage("Review deleted successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not delete review.");
    } finally {
      setLoadingId("");
    }
  }

  async function notifyTarget(review: ReviewItem) {
    const targetUserId = review.targetUserId || review.driverId || review.passengerId;

    if (!targetUserId) {
      setMessage("Target user not found for this review.");
      return;
    }

    try {
      setLoadingId(review.id);
      setMessage("");

      const now = new Date().toISOString();

      await setDoc(
        doc(db, "notifications", `${targetUserId}-review-admin-${Date.now()}`),
        {
          userId: targetUserId,
          type: "review",
          title: "Review Update",
          message: "A review on your RoadLink profile was updated by admin.",
          read: false,
          createdAt: now,
          actionUrl: "/reviews",
        },
        { merge: true }
      );

      setMessage("Target user notified.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not notify user.");
    } finally {
      setLoadingId("");
    }
  }

  function getReviewText(review: ReviewItem) {
    return review.comment || review.review || "No comment provided.";
  }

  function getReviewStatus(review: ReviewItem) {
    if (review.status === "hidden" || review.hidden) return "hidden";
    if (review.status === "reported" || review.reported) return "reported";
    if (review.status === "deleted") return "deleted";
    return "active";
  }

  function statusLabel(review: ReviewItem) {
    const status = getReviewStatus(review);

    if (status === "hidden") return "Hidden";
    if (status === "reported") return "Reported";
    if (status === "deleted") return "Deleted";
    return "Active";
  }

  function dateText(value?: string) {
    if (!value) return "Not available";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function stars(value?: number) {
    const rating = Math.max(0, Math.min(5, Number(value || 0)));
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin Home</Link>
          <Link href="/admin/users" className="miniButton">Users</Link>
          <Link href="/admin/reports" className="miniButton">Reports</Link>
          <Link href="/admin/analytics" className="miniButton">Analytics</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>
            <h1>Reviews <span>Management</span></h1>
            <p className="subtitle">
              Monitor ratings, review user reputation, hide offensive reviews,
              investigate reported feedback, and protect trust on RoadLink.
            </p>
          </div>

          <div className="heroIcon">⭐</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="⭐" label="Total Reviews" value={String(totalReviews)} />
          <Metric icon="📊" label="Average Rating" value={averageRating ? String(averageRating) : "—"} />
          <Metric icon="🚨" label="Reported" value={String(reportedCount)} />
          <Metric icon="🙈" label="Hidden" value={String(hiddenCount)} />
          <Metric icon="⚠️" label="Low Ratings" value={String(lowCount)} />
          <Metric icon="📋" label="Filtered" value={String(filteredReviews.length)} />
        </section>

        <section className="filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email, comment, ride ID, booking ID, or review ID..."
          />

          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All reviews</option>
            <option value="active">Active</option>
            <option value="reported">Reported</option>
            <option value="hidden">Hidden</option>
            <option value="high">High rating</option>
            <option value="low">Low rating</option>
          </select>
        </section>

        <section className="adminGrid">
          <div className="reviewsCard">
            <p className="eyebrow">Reviews</p>
            <h2>Reputation Feed</h2>

            {filteredReviews.length === 0 ? (
              <div className="empty">
                <h3>No reviews found</h3>
                <p>Reviews from ratings collection will appear here.</p>
              </div>
            ) : (
              <div className="reviewList">
                {filteredReviews.map((review) => (
                  <button
                    key={review.id}
                    className={
                      selected?.id === review.id
                        ? "reviewRow activeReview"
                        : "reviewRow"
                    }
                    onClick={() => setSelected(review)}
                  >
                    <div className="reviewIcon">⭐</div>

                    <div className="reviewInfo">
                      <strong>{stars(review.rating)}</strong>
                      <span>{review.reviewerEmail || "Reviewer not available"}</span>
                      <small>{getReviewText(review)}</small>
                    </div>

                    <em className={`status ${getReviewStatus(review)}`}>
                      {statusLabel(review)}
                    </em>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="detailsCard">
            {selected ? (
              <>
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Selected Review</p>
                    <h2>{stars(selected.rating)}</h2>
                    <p className="email">{selected.reviewerEmail || "No reviewer email"}</p>
                  </div>

                  <span className={`statusPill ${getReviewStatus(selected)}`}>
                    {statusLabel(selected)}
                  </span>
                </div>

                <div className="ratingBox">
                  <span>Rating</span>
                  <strong>{Number(selected.rating || 0)}/5</strong>
                </div>

                <div className="detailsBox">
                  <strong>Review Comment</strong>
                  <p>{getReviewText(selected)}</p>
                </div>

                <div className="infoGrid">
                  <Info label="Review ID" value={selected.id} />
                  <Info label="Ride ID" value={selected.rideId || "Not available"} />
                  <Info label="Booking ID" value={selected.bookingId || "Not available"} />
                  <Info label="Reviewer ID" value={selected.reviewerId || "Not available"} />
                  <Info label="Reviewer Email" value={selected.reviewerEmail || "Not available"} />
                  <Info label="Target User ID" value={selected.targetUserId || "Not available"} />
                  <Info label="Target Email" value={selected.targetUserEmail || "Not available"} />
                  <Info label="Driver ID" value={selected.driverId || "Not available"} />
                  <Info label="Driver Email" value={selected.driverEmail || "Not available"} />
                  <Info label="Passenger ID" value={selected.passengerId || "Not available"} />
                  <Info label="Passenger Email" value={selected.passengerEmail || "Not available"} />
                  <Info label="Reported" value={selected.reported ? "Yes" : "No"} />
                  <Info label="Hidden" value={selected.hidden ? "Yes" : "No"} />
                  <Info label="Created" value={dateText(selected.createdAt)} />
                  <Info label="Updated" value={dateText(selected.updatedAt)} />
                </div>

                <div className="actionRow">
                  <button
                    className="approveButton"
                    onClick={() =>
                      updateReview(
                        selected,
                        {
                          hidden: false,
                          reported: false,
                          status: "active",
                        },
                        "Review marked as active."
                      )
                    }
                    disabled={loadingId === selected.id}
                  >
                    Mark Active
                  </button>

                  <button
                    className="warningButton"
                    onClick={() =>
                      updateReview(
                        selected,
                        {
                          reported: true,
                          status: "reported",
                        },
                        "Review marked as reported."
                      )
                    }
                    disabled={loadingId === selected.id}
                  >
                    Mark Reported
                  </button>

                  <button
                    className="hiddenButton"
                    onClick={() =>
                      updateReview(
                        selected,
                        {
                          hidden: true,
                          status: "hidden",
                        },
                        "Review hidden."
                      )
                    }
                    disabled={loadingId === selected.id}
                  >
                    Hide Review
                  </button>

                  <button
                    className="notifyButton"
                    onClick={() => notifyTarget(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Notify User
                  </button>

                  <button
                    className="deleteButton"
                    onClick={() => deleteReview(selected)}
                    disabled={loadingId === selected.id}
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <h3>Select a review</h3>
                <p>Choose a review to manage reputation details.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

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
        .reviewsCard,
        .detailsCard {
          background: rgba(8, 13, 25, 0.92);
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
          font-size: 58px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue,
        .ratingBox strong {
          color: #22c55e;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 8px;
        }

        .subtitle,
        .email,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .heroIcon {
          min-width: 92px;
          height: 92px;
          border-radius: 50%;
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-bottom: 18px;
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

        .metricValue {
          font-size: 24px;
          font-weight: 900;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 24px;
        }

        .filters input,
        .filters select {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        .filters option {
          color: black;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr;
          gap: 24px;
        }

        .reviewsCard,
        .detailsCard {
          border-radius: 30px;
          padding: 28px;
        }

        .reviewList {
          display: grid;
          gap: 12px;
        }

        .reviewRow {
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

        .activeReview {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.1);
        }

        .reviewIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(250,204,21,0.13);
          border: 1px solid rgba(250,204,21,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .reviewInfo {
          min-width: 0;
        }

        .reviewInfo strong {
          color: #facc15;
        }

        .reviewInfo strong,
        .reviewInfo span,
        .reviewInfo small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .reviewInfo span,
        .reviewInfo small {
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

        .status.active,
        .statusPill.active {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
        }

        .status.reported,
        .statusPill.reported {
          color: #fca5a5;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
        }

        .status.hidden,
        .statusPill.hidden {
          color: #93c5fd;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.35);
        }

        .status.deleted,
        .statusPill.deleted {
          color: #a1a1aa;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .sectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .ratingBox,
        .detailsBox {
          padding: 22px;
          border-radius: 22px;
          background: rgba(250,204,21,0.08);
          border: 1px solid rgba(250,204,21,0.28);
          margin-bottom: 20px;
        }

        .ratingBox span {
          display: block;
          color: #a1a1aa;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .ratingBox strong {
          font-size: 44px;
          font-weight: 900;
        }

        .detailsBox p {
          color: #e5e7eb;
          line-height: 1.5;
          margin-bottom: 0;
          overflow-wrap: anywhere;
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

        .infoBox strong {
          overflow-wrap: anywhere;
        }

        .actionRow {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .approveButton,
        .warningButton,
        .hiddenButton,
        .notifyButton,
        .deleteButton {
          padding: 15px;
          border-radius: 999px;
          border: none;
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .approveButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .warningButton {
          background: linear-gradient(135deg, #f97316, #c2410c);
        }

        .hiddenButton {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .notifyButton {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .deleteButton {
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty {
          padding: 26px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .empty h3 {
          margin: 0 0 8px;
          font-size: 24px;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }

          .actionRow {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
            padding-bottom: 140px;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          h1 {
            font-size: 44px;
          }

          .stats,
          .filters,
          .infoGrid,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .reviewsCard,
          .detailsCard {
            padding: 24px;
          }

          .reviewRow {
            grid-template-columns: 46px 1fr;
          }

          .reviewRow .status {
            grid-column: 1 / -1;
            width: fit-content;
          }

          .reviewIcon {
            width: 46px;
            height: 46px;
          }

          .sectionHeader {
            flex-direction: column;
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
