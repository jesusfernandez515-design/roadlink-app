"use client";

import Link from "next/link";

export default function NotificationsPage() {
  const notifications = [
    {
      id: 1,
      title: "New Ride Booking",
      message: "A passenger reserved a seat on your trip.",
      time: "2 min ago",
      unread: true,
    },
    {
      id: 2,
      title: "New Message",
      message: "You received a message from a passenger.",
      time: "15 min ago",
      unread: true,
    },
    {
      id: 3,
      title: "Ride Completed",
      message: "Your recent trip was completed successfully.",
      time: "1 hour ago",
      unread: false,
    },
  ];

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="backButton">
            ← Dashboard
          </Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Notifications</p>

            <h1>
              Notification <span>Center</span>
            </h1>

            <p className="subtitle">
              Stay updated with bookings, messages, trip activity,
              account alerts and verification updates.
            </p>
          </div>

          <div className="bell">
            🔔
          </div>
        </section>

        <section className="stats">
          <div className="stat">
            <span>Total</span>
            <h2>{notifications.length}</h2>
          </div>

          <div className="stat">
            <span>Unread</span>
            <h2>
              {notifications.filter((n) => n.unread).length}
            </h2>
          </div>

          <div className="stat">
            <span>Status</span>
            <h2>Live</h2>
          </div>
        </section>

        <section className="card">
          <div className="header">
            <h2>Recent Notifications</h2>
          </div>

          <div className="list">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={
                  notification.unread
                    ? "notification unread"
                    : "notification"
                }
              >
                <div className="icon">
                  {notification.unread ? "🟢" : "⚪"}
                </div>

                <div className="content">
                  <h3>{notification.title}</h3>

                  <p>{notification.message}</p>

                  <span>{notification.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <style>{`
        * {
          box-sizing:border-box;
        }

        .page{
          min-height:100vh;
          padding:24px;
          color:white;

          background:
          radial-gradient(circle at top right,
          rgba(34,197,94,.25),
          transparent 35%),

          linear-gradient(
          135deg,
          #020617,
          #030712,
          #0f172a);
        }

        .container{
          max-width:1000px;
          margin:auto;
        }

        .topBar{
          margin-bottom:20px;
        }

        .backButton{
          color:white;
          text-decoration:none;
          font-weight:900;

          padding:12px 20px;

          border-radius:999px;

          background:
          rgba(255,255,255,.05);

          border:1px solid
          rgba(255,255,255,.1);
        }

        .hero{
          display:flex;
          justify-content:space-between;
          align-items:center;

          padding:35px;

          border-radius:30px;

          background:
          rgba(8,13,25,.9);

          border:1px solid
          rgba(255,255,255,.1);

          margin-bottom:20px;
        }

        .eyebrow{
          color:#22c55e;
          font-weight:900;
          text-transform:uppercase;
          font-size:13px;
        }

        h1{
          margin:10px 0;
          font-size:60px;
        }

        h1 span{
          color:#22c55e;
        }

        .subtitle{
          color:#a1a1aa;
          max-width:600px;
        }

        .bell{
          width:100px;
          height:100px;

          border-radius:50%;

          display:flex;
          align-items:center;
          justify-content:center;

          font-size:45px;

          background:
          rgba(34,197,94,.15);

          border:1px solid
          rgba(34,197,94,.3);
        }

        .stats{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:15px;
          margin-bottom:20px;
        }

        .stat{
          padding:25px;

          border-radius:24px;

          background:
          rgba(8,13,25,.9);

          border:1px solid
          rgba(255,255,255,.1);
        }

        .stat span{
          color:#a1a1aa;
        }

        .stat h2{
          color:#22c55e;
          margin-top:10px;
          font-size:34px;
        }

        .card{
          padding:30px;

          border-radius:30px;

          background:
          rgba(8,13,25,.9);

          border:1px solid
          rgba(255,255,255,.1);
        }

        .header h2{
          margin-top:0;
        }

        .list{
          display:grid;
          gap:15px;
        }

        .notification{
          display:flex;
          gap:16px;

          padding:20px;

          border-radius:20px;

          background:
          rgba(255,255,255,.04);

          border:1px solid
          rgba(255,255,255,.08);
        }

        .unread{
          border-color:
          rgba(34,197,94,.4);

          background:
          rgba(34,197,94,.08);
        }

        .icon{
          font-size:24px;
        }

        .content h3{
          margin:0 0 8px 0;
        }

        .content p{
          margin:0;
          color:#d4d4d8;
        }

        .content span{
          display:block;
          margin-top:10px;
          color:#22c55e;
          font-size:13px;
          font-weight:900;
        }

        @media(max-width:700px){

          .hero{
            flex-direction:column;
            align-items:flex-start;
          }

          h1{
            font-size:42px;
          }

          .stats{
            grid-template-columns:1fr;
          }
        }
      `}</style>
    </main>
  );
}
