"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Rating = {
  id: string;
  stars?: number;
  comment?: string;
  reviewerEmail?: string;
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Rating[]>([]);
  const [average, setAverage] = useState(0);

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    try {
      const snapshot = await getDocs(collection(db, "ratings"));

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Rating[];

      setReviews(data);

      if (data.length > 0) {
        const total = data.reduce(
          (sum, item) => sum + Number(item.stars || 0),
          0
        );

        setAverage(Number((total / data.length).toFixed(1)));
      }
    } catch (error) {
      console.error(error);
    }
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
        </div>

        <div className="hero">
          <p>ROADLINK COMMUNITY</p>
          <h1>
            Driver <span>Reviews</span>
          </h1>

          <div className="stats">
            <div className="card">
              <small>Average Rating</small>
              <h2>⭐ {average}</h2>
            </div>

            <div className="card">
              <small>Total Reviews</small>
              <h2>{reviews.length}</h2>
            </div>
          </div>
        </div>

        <div className="reviewsGrid">
          {reviews.length === 0 ? (
            <div className="empty">
              No reviews yet.
            </div>
          ) : (
            reviews.map((review) => (
              <div className="reviewCard" key={review.id}>
                <h3>
                  {"⭐".repeat(Number(review.stars || 0))}
                </h3>

                <p>{review.comment || "No comment provided."}</p>

                <small>
                  {review.reviewerEmail || "RoadLink User"}
                </small>
              </div>
            ))
          )}
        </div>

      </section>

      <style>{`
        .page{
          min-height:100vh;
          background:
          radial-gradient(circle at top right,rgba(34,197,94,.22),transparent 32%),
          linear-gradient(135deg,#020617,#030712,#0f172a);
          padding:24px;
          color:white;
          font-family:Arial;
        }

        .container{
          max-width:1000px;
          margin:auto;
        }

        .topNav{
          display:flex;
          gap:12px;
          margin-bottom:20px;
        }

        .button{
          text-decoration:none;
          color:white;
          padding:12px 18px;
          border-radius:999px;
          background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.12);
        }

        .hero{
          background:#08111c;
          border-radius:28px;
          padding:32px;
          margin-bottom:20px;
          border:1px solid rgba(255,255,255,.1);
        }

        .hero p{
          color:#22c55e;
          font-weight:900;
        }

        .hero h1{
          font-size:56px;
          margin:0;
        }

        .hero span{
          color:#22c55e;
        }

        .stats{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:16px;
          margin-top:20px;
        }

        .card{
          background:#0b1727;
          border-radius:20px;
          padding:20px;
        }

        .card h2{
          color:#22c55e;
        }

        .reviewsGrid{
          display:grid;
          gap:16px;
        }

        .reviewCard{
          background:#08111c;
          border-radius:24px;
          padding:24px;
          border:1px solid rgba(255,255,255,.1);
        }

        .reviewCard p{
          color:#d4d4d8;
        }

        .reviewCard small{
          color:#22c55e;
        }

        .empty{
          background:#08111c;
          padding:40px;
          border-radius:24px;
          text-align:center;
        }
      `}</style>
    </main>
  );
}
