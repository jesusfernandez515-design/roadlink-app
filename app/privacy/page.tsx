import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="page">
      <section className="card">
        <Link href="/register" className="backButton">
          ← Back to Register
        </Link>

        <div className="brand">
          Road<span>Link</span>
        </div>

        <p className="eyebrow">Legal</p>

        <h1>Privacy Policy</h1>

        <p className="updated">Last updated: June 2026</p>

        <div className="content">
          <p>
            RoadLink respects your privacy. This Privacy Policy explains what
            information we collect, how we use it, and how we protect it.
          </p>

          <h2>1. Information We Collect</h2>
          <p>
            We may collect your name, email address, account role, profile
            information, ride details, bookings, messages, ratings, and other
            information needed to operate RoadLink.
          </p>

          <h2>2. How We Use Information</h2>
          <p>
            We use your information to create your account, verify your email,
            connect drivers and passengers, manage bookings, display profiles,
            support messaging, improve safety, and operate the platform.
          </p>

          <h2>3. Account Security</h2>
          <p>
            RoadLink uses Firebase Authentication and email verification to help
            protect user accounts. Users are responsible for keeping their login
            information secure.
          </p>

          <h2>4. Messages and Ride Data</h2>
          <p>
            Messages, rides, and bookings may be stored to help users coordinate
            trips and maintain a record of platform activity.
          </p>

          <h2>5. Sharing Information</h2>
          <p>
            We may show basic profile and ride information to other users when
            needed for rides, bookings, messages, reviews, or safety features.
          </p>

          <h2>6. Data Protection</h2>
          <p>
            We aim to protect your information using reasonable technical and
            organizational safeguards, but no online system is guaranteed to be
            completely secure.
          </p>

          <h2>7. Your Choices</h2>
          <p>
            You may update your profile information or stop using RoadLink at any
            time. Future versions may include additional account deletion and
            privacy control tools.
          </p>

          <h2>8. Updates</h2>
          <p>
            RoadLink may update this Privacy Policy as the platform grows.
            Continued use of RoadLink means you accept the updated policy.
          </p>
        </div>

        <Link href="/register" className="mainButton">
          Back to Registration
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
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .card {
          width: 100%;
          max-width: 880px;
          margin: 0 auto;
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 32px;
          padding: 36px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.7);
          backdrop-filter: blur(16px);
        }

        .backButton {
          display: inline-flex;
          margin-bottom: 28px;
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .brand {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 20px;
        }

        .brand span,
        .eyebrow {
          color: #22c55e;
        }

        .eyebrow {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 10px;
        }

        h1 {
          font-size: 54px;
          margin: 0 0 10px;
          line-height: 1.05;
          letter-spacing: -1px;
        }

        .updated {
          color: #a1a1aa;
          margin-bottom: 28px;
          font-weight: 800;
        }

        .content {
          display: grid;
          gap: 18px;
        }

        h2 {
          color: #22c55e;
          font-size: 24px;
          margin: 20px 0 0;
        }

        p {
          color: #d4d4d8;
          line-height: 1.7;
          margin: 0;
          font-size: 17px;
        }

        .mainButton {
          display: block;
          margin-top: 32px;
          padding: 18px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          text-align: center;
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        @media (max-width: 480px) {
          .page {
            padding: 16px;
          }

          .card {
            padding: 26px;
            border-radius: 28px;
          }

          h1 {
            font-size: 38px;
          }
        }
      `}</style>
    </main>
  );
}
