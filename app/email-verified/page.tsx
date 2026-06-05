"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function EmailVerifiedPage() {
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    const countdown = setInterval(() => {
      setSeconds((current) => current - 1);
    }, 1000);

    const redirect = setTimeout(() => {
      window.location.href = "/login";
    }, 5000);

    return () => {
      clearInterval(countdown);
      clearTimeout(redirect);
    };
  }, []);

  return (
    <main className="page">
      <section className="card">
        <div className="brand">
          Road<span>Link</span>
        </div>

        <div className="check">✓</div>

        <p className="eyebrow">Email Verified</p>

        <h1>Your Gmail has been verified.</h1>

        <p className="subtitle">
          Your RoadLink account is now active. You can sign in and continue your journey.
        </p>

        <Link href="/login" className="button">
          Continue to Login
        </Link>

        <p className="redirect">
          Redirecting to login in {seconds > 0 ? seconds : 0} seconds...
        </p>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 32%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.14), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .card {
          width: 100%;
          max-width: 560px;
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 34px;
          padding: 38px;
          text-align: center;
          box-shadow: 0 30px 90px rgba(0,0,0,0.7);
          backdrop-filter: blur(16px);
        }

        .brand {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .brand span,
        .eyebrow {
          color: #22c55e;
        }

        .check {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          font-size: 58px;
          font-weight: 900;
          box-shadow: 0 18px 60px rgba(34,197,94,0.35);
        }

        .eyebrow {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 12px;
        }

        h1 {
          font-size: 46px;
          line-height: 1.05;
          margin: 0 0 16px;
          letter-spacing: -1px;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin: 0 auto 28px;
          max-width: 440px;
        }

        .button {
          display: block;
          width: 100%;
          padding: 18px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .redirect {
          margin: 22px 0 0;
          color: #a1a1aa;
          font-weight: 800;
        }

        @media (max-width: 480px) {
          .page {
            padding: 16px;
          }

          .card {
            padding: 28px;
            border-radius: 28px;
          }

          h1 {
            font-size: 36px;
          }
        }
      `}</style>
    </main>
  );
}
