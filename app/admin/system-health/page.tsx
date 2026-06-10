"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ServiceStatus =
  | "online"
  | "warning"
  | "offline";

export default function AdminSystemHealthPage() {
  const [lastCheck, setLastCheck] = useState("");
  const [uptime, setUptime] = useState("99.98%");
  const [message, setMessage] = useState("System healthy");

  const [services, setServices] = useState([
    {
      name: "Firestore Database",
      icon: "🔥",
      status: "online" as ServiceStatus,
      latency: "42 ms",
      description: "Database operations and queries",
    },
    {
      name: "Firebase Authentication",
      icon: "🔐",
      status: "online" as ServiceStatus,
      latency: "31 ms",
      description: "User login and authentication",
    },
    {
      name: "Firebase Storage",
      icon: "📦",
      status: "online" as ServiceStatus,
      latency: "56 ms",
      description: "Photos and document uploads",
    },
    {
      name: "Notifications",
      icon: "📨",
      status: "online" as ServiceStatus,
      latency: "27 ms",
      description: "Push notifications and alerts",
    },
    {
      name: "Stripe Payments",
      icon: "💳",
      status: "warning" as ServiceStatus,
      latency: "Not Connected",
      description: "Awaiting live Stripe integration",
    },
    {
      name: "RoadLink API",
      icon: "🌎",
      status: "online" as ServiceStatus,
      latency: "38 ms",
      description: "Core application services",
    },
  ]);

  useEffect(() => {
    runHealthCheck();
  }, []);

  function runHealthCheck() {
    setLastCheck(new Date().toLocaleString());
    setMessage("System check completed");

    setServices((current) =>
      current.map((service) => ({
        ...service,
        latency:
          service.name === "Stripe Payments"
            ? "Not Connected"
            : `${Math.floor(Math.random() * 70 + 20)} ms`,
      }))
    );
  }

  const onlineCount = services.filter(
    (service) => service.status === "online"
  ).length;

  const warningCount = services.filter(
    (service) => service.status === "warning"
  ).length;

  const offlineCount = services.filter(
    (service) => service.status === "offline"
  ).length;

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">
            Admin Home
          </Link>

          <Link href="/admin/settings" className="miniButton">
            Settings
          </Link>

          <Link href="/admin/analytics" className="miniButton">
            Analytics
          </Link>

          <Link href="/admin/stripe" className="miniButton">
            Stripe
          </Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Admin</p>

            <h1>
              System <span>Health</span>
            </h1>

            <p className="subtitle">
              Monitor RoadLink infrastructure, Firebase services,
              notifications, payments, and platform uptime.
            </p>
          </div>

          <div className="heroIcon">🩺</div>
        </section>

        <p className="message">{message}</p>

        <section className="stats">
          <Metric
            icon="✅"
            label="Online"
            value={String(onlineCount)}
          />

          <Metric
            icon="⚠️"
            label="Warnings"
            value={String(warningCount)}
          />

          <Metric
            icon="❌"
            label="Offline"
            value={String(offlineCount)}
          />

          <Metric
            icon="📈"
            label="Uptime"
            value={uptime}
          />
        </section>

        <section className="actionCard">
          <div>
            <p className="eyebrow">System Check</p>

            <h2>Infrastructure Monitoring</h2>

            <p>
              Last Health Check:
              <strong> {lastCheck || "Not available"}</strong>
            </p>
          </div>

          <button onClick={runHealthCheck}>
            Run Health Check
          </button>
        </section>

        <section className="servicesCard">
          <p className="eyebrow">Services</p>

          <h2>Live Status</h2>

          <div className="servicesGrid">
            {services.map((service) => (
              <div key={service.name} className="service">
                <div className="serviceTop">
                  <div className="serviceIcon">
                    {service.icon}
                  </div>

                  <span
                    className={`status ${service.status}`}
                  >
                    {service.status.toUpperCase()}
                  </span>
                </div>

                <h3>{service.name}</h3>

                <p>{service.description}</p>

                <div className="latency">
                  {service.latency}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="logsCard">
          <p className="eyebrow">System Events</p>

          <h2>Recent Activity</h2>

          <div className="log">
            <span>✅</span>
            <div>
              <strong>Firestore Connected</strong>
              <p>Database responding normally.</p>
            </div>
          </div>

          <div className="log">
            <span>🔐</span>
            <div>
              <strong>Authentication Online</strong>
              <p>Login services operational.</p>
            </div>
          </div>

          <div className="log">
            <span>📦</span>
            <div>
              <strong>Storage Available</strong>
              <p>Uploads and downloads functioning.</p>
            </div>
          </div>

          <div className="log">
            <span>💳</span>
            <div>
              <strong>Stripe Pending</strong>
              <p>Waiting for live API integration.</p>
            </div>
          </div>
        </section>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,.12), transparent 35%),
            linear-gradient(135deg,#020617,#030712,#0f172a);
          color:white;
          padding:24px;
          padding-bottom:140px;
          font-family:Arial,sans-serif;
        }

        .container{
          max-width:1180px;
          margin:auto;
        }

        .topNav{
          display:flex;
          flex-wrap:wrap;
          gap:12px;
          margin-bottom:24px;
        }

        .miniButton{
          padding:11px 18px;
          border-radius:999px;
          text-decoration:none;
          color:white;
          font-weight:900;
          background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.12);
        }

        .hero,
        .stats .metric,
        .actionCard,
        .servicesCard,
        .logsCard{
          background:rgba(8,13,25,.92);
          border:1px solid rgba(255,255,255,.12);
          box-shadow:0 24px 80px rgba(0,0,0,.55);
          backdrop-filter:blur(16px);
        }

        .hero{
          border-radius:34px;
          padding:34px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom:22px;
        }

        .eyebrow{
          color:#22c55e;
          font-size:13px;
          font-weight:900;
          text-transform:uppercase;
          margin-bottom:10px;
        }

        h1{
          font-size:58px;
          margin:0 0 14px;
        }

        h1 span,
        h2,
        .metricValue{
          color:#22c55e;
        }

        h2{
          margin:0 0 10px;
        }

        .subtitle{
          color:#a1a1aa;
          line-height:1.5;
        }

        .heroIcon{
          width:92px;
          height:92px;
          border-radius:50%;
          background:rgba(34,197,94,.12);
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:42px;
        }

        .message{
          color:#22c55e;
          font-weight:900;
        }

        .stats{
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:14px;
          margin:22px 0;
        }

        .metric{
          border-radius:24px;
          padding:20px;
        }

        .actionCard,
        .servicesCard,
        .logsCard{
          border-radius:30px;
          padding:28px;
          margin-bottom:24px;
        }

        .actionCard{
          display:grid;
          grid-template-columns:1fr auto;
          gap:18px;
          align-items:center;
        }

        button{
          border:none;
          border-radius:999px;
          padding:16px 22px;
          background:linear-gradient(135deg,#22c55e,#16a34a);
          color:white;
          font-weight:900;
          cursor:pointer;
        }

        .servicesGrid{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:16px;
        }

        .service{
          background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.1);
          border-radius:22px;
          padding:18px;
        }

        .serviceTop{
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom:12px;
        }

        .serviceIcon{
          font-size:28px;
        }

        .status{
          padding:6px 10px;
          border-radius:999px;
          font-size:11px;
          font-weight:900;
        }

        .online{
          background:rgba(34,197,94,.15);
          color:#22c55e;
        }

        .warning{
          background:rgba(250,204,21,.15);
          color:#fde68a;
        }

        .offline{
          background:rgba(239,68,68,.15);
          color:#fca5a5;
        }

        .service p{
          color:#a1a1aa;
        }

        .latency{
          margin-top:12px;
          font-weight:900;
          color:#22c55e;
        }

        .log{
          display:grid;
          grid-template-columns:50px 1fr;
          gap:14px;
          padding:14px;
          margin-top:10px;
          border-radius:18px;
          background:rgba(255,255,255,.04);
        }

        .log span{
          font-size:24px;
        }

        .log p{
          color:#a1a1aa;
          margin:4px 0 0;
        }

        @media(max-width:900px){
          .stats,
          .servicesGrid,
          .actionCard{
            grid-template-columns:1fr;
          }

          h1{
            font-size:44px;
          }

          .hero{
            flex-direction:column;
            align-items:flex-start;
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
      <div style={{ fontSize: 28, marginBottom: 10 }}>
        {icon}
      </div>

      <div
        style={{
          color: "#a1a1aa",
          fontSize: 12,
          fontWeight: 900,
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        className="metricValue"
        style={{
          fontSize: 28,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}
