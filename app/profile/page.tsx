export default function ProfilePage() {
  return (
    <main className="page">
      <section className="card">
        <div className="top">
          <div className="avatar">J</div>

          <div>
            <h1>Jesús Fernández</h1>
            <p>Driver & Passenger · United States</p>
            <p className="verified">Verified RoadLink Member</p>
          </div>
        </div>

        <div className="stats">
          <Box title="Rating" value="4.9" />
          <Box title="Trips Completed" value="28" />
          <Box title="Member Since" value="2026" />
        </div>

        <section className="section">
          <h2>Profile Details</h2>

          <div className="detail">
            <span>Full Name</span>
            <strong>Jesús Fernández</strong>
          </div>

          <div className="detail">
            <span>Location</span>
            <strong>United States</strong>
          </div>

          <div className="detail">
            <span>Account Type</span>
            <strong>Driver / Passenger</strong>
          </div>

          <div className="detail">
            <span>Verification</span>
            <strong>Identity Pending</strong>
          </div>
        </section>

        <section className="section">
          <h2>Trust & Safety</h2>

          <div className="badges">
            <span>Email Verified</span>
            <span>Phone Pending</span>
            <span>Driver Check Pending</span>
          </div>
        </section>

        <button>Edit Profile</button>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: linear-gradient(135deg,#000,#0f172a,#111827);
          color: white;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .card {
          max-width: 850px;
          margin: 0 auto;
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 28px;
          padding: 28px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.6);
        }

        .top {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .avatar {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          background: #22c55e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          font-weight: 900;
          flex-shrink: 0;
        }

        h1 {
          margin: 0;
          font-size: 36px;
        }

        p {
          color: #a1a1aa;
          margin: 6px 0;
        }

        .verified {
          color: #22c55e;
          font-weight: 700;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-top: 32px;
        }

        .box {
          background: #111;
          border: 1px solid #222;
          border-radius: 18px;
          padding: 18px;
        }

        .box h3 {
          color: #a1a1aa;
          font-size: 14px;
          margin: 0 0 10px;
        }

        .box p {
          color: #22c55e;
          font-size: 26px;
          font-weight: 900;
          margin: 0;
        }

        .section {
          margin-top: 34px;
        }

        .detail {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          background: #111;
          border: 1px solid #222;
          border-radius: 16px;
          padding: 16px;
          margin-top: 12px;
        }

        .detail span {
          color: #a1a1aa;
        }

        .badges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .badges span {
          background: #111;
          border: 1px solid #222;
          border-radius: 999px;
          padding: 10px 14px;
          color: #d4d4d8;
        }

        button {
          width: 100%;
          margin-top: 30px;
          padding: 17px;
          border-radius: 999px;
          border: none;
          background: #22c55e;
          color: white;
          font-size: 17px;
          font-weight: 800;
        }

        @media (max-width: 600px) {
          .card {
            padding: 22px;
          }

          .top {
            align-items: flex-start;
          }

          h1 {
            font-size: 28px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .detail {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}

function Box({ title, value }: any) {
  return (
    <div className="box">
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
}
