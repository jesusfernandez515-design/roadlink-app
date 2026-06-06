"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { applyActionCode } from "firebase/auth";
import { auth } from "../../../lib/firebase";

export default function AuthActionPage() {
  const [status, setStatus] = useState("Verifying your RoadLink account...");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function verifyEmail() {
      try {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get("mode");
        const oobCode = params.get("oobCode");

        if (mode !== "verifyEmail" || !oobCode) {
          setStatus("Invalid verification link.");
          setSuccess(false);
          return;
        }

        await applyActionCode(auth, oobCode);

        setSuccess(true);
        setStatus("Your RoadLink account has been verified successfully.");
      } catch (error: any) {
        console.error(error);
        setSuccess(false);
        setStatus("This verification link is invalid or has already been used.");
      }
    }

    verifyEmail();
  }, []);

  return (
    <main className="page">
      <section className="card">
        <div className="brand">
          Road<span>Link</span>
        </div>

        <div className="icon">{success ? "✅" : "⚠️"}</div>

        <p className="eyebrow">{success ? "Verified Access" : "Verification Status"}</p>

        <h1>{success ? "Email Verified" : "Verification Needed"}</h1>

        <p className="subtitle">{status}</p>

        <Link href="/login" className="button">
          Continue to Login
        </Link>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.22), transparent 32%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.13), transparent 35%),
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
          max-width: 620px;
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 34px;
          padding: 42px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.7);
          backdrop-filter: blur(16px);
          text-align: center;
        }

        .brand {
          font-size: 42px;
          font-weight: 900;
          margin-bottom: 28px;
        }

        .brand span,
        .eyebrow {
          color: #22c55e;
        }

        .icon {
          width: 104px;
          height: 104px;
          margin: 0 auto 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 54px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          box-shadow: 0 0 50px rgba(34,197,94,0.22);
        }

        .eyebrow {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 12px;
        }

        h1 {
          font-size: 54px;
          margin: 0 0 18px;
          line-height: 1.05;
          letter-spacing: -1px;
        }

        .subtitle {
          color: #a1a1aa;
          line-height: 1.6;
          margin: 0 auto 30px;
          font-size: 18px;
          max-width: 460px;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 360px;
          padding: 18px 24px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 17px;
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        @media (max-width: 480px) {
          .page {
            padding: 16px;
            align-items: flex-start;
          }

          .card {
            padding: 30px 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 40px;
          }

          .brand {
            font-size: 36px;
          }
        }
      `}</style>
    </main>
  );
}
