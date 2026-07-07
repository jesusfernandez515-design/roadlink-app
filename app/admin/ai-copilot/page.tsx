"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  driverVerified?: boolean;
  suspended?: boolean;
};

type RideItem = {
  id: string;
  from?: string;
  to?: string;
  status?: string;
  driverEmail?: string;
  price?: number;
};

type BookingItem = {
  id: string;
  status?: string;
  passengerEmail?: string;
  driverEmail?: string;
  price?: number;
  amount?: number;
  seatsBooked?: number;
};

type ReportItem = {
  id: string;
  status?: string;
  priority?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

const QUICK_PROMPTS = [
  "Why are bookings low?",
  "What should I fix today?",
  "Which area should I launch next?",
  "How can I increase revenue?",
  "Do we have enough drivers?",
  "What are the biggest risks?",
];

export default function AdminAICopilotPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("Loading AI Copilot...");
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as UserItem[]);
      setMessage("");
    });

    const unsubRides = onSnapshot(query(collection(db, "rides")), (snapshot) => {
      setRides(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RideItem[]);
    });

    const unsubBookings = onSnapshot(query(collection(db, "bookings")), (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as BookingItem[]);
    });

    const unsubReports = onSnapshot(query(collection(db, "reports")), (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ReportItem[]);
    });

    return () => {
      unsubUsers();
      unsubRides();
      unsubBookings();
      unsubReports();
    };
  }, []);

  const data = useMemo(() => {
    const drivers = users.filter((item) => item.driverVerified);
    const passengers = users.filter((item) => !item.driverVerified);
    const suspendedUsers = users.filter((item) => item.suspended);

    const activeRides = rides.filter((item) =>
      ["active", "open", "full", "in_progress"].includes(String(item.status || ""))
    );

    const completedBookings = bookings.filter((item) => item.status === "completed");
    const cancelledBookings = bookings.filter((item) =>
      ["cancelled", "rejected", "no_show"].includes(String(item.status || ""))
    );

    const activeBookings = bookings.filter((item) =>
      ["pending", "reserved", "confirmed"].includes(String(item.status || ""))
    );

    const openReports = reports.filter((item) => !item.status || item.status === "open");
    const urgentReports = reports.filter((item) => item.priority === "urgent" || item.priority === "critical");

    const revenue = completedBookings.reduce(
      (total, booking) =>
        total + Number(booking.price || booking.amount || 0) * Number(booking.seatsBooked || 1),
      0
    );

    const bookingRate = users.length > 0 ? Math.round((bookings.length / users.length) * 100) : 0;
    const cancelRate = bookings.length > 0 ? Math.round((cancelledBookings.length / bookings.length) * 100) : 0;

    let healthScore = 100;
    healthScore -= urgentReports.length * 18;
    healthScore -= openReports.length * 5;
    healthScore -= suspendedUsers.length * 7;
    healthScore -= Math.min(cancelRate, 25);
    healthScore -= drivers.length < 3 ? 15 : 0;
    healthScore -= activeRides.length < 3 ? 15 : 0;

    return {
      drivers,
      passengers,
      suspendedUsers,
      activeRides,
      activeBookings,
      completedBookings,
      cancelledBookings,
      openReports,
      urgentReports,
      revenue,
      bookingRate,
      cancelRate,
      healthScore: Math.max(0, Math.min(100, healthScore)),
    };
  }, [users, rides, bookings, reports]);

  function money(value: number) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  function generateAnswer(question: string) {
    const q = question.toLowerCase();

    if (q.includes("booking") || q.includes("reserva")) {
      if (data.activeRides.length < 3) {
        return "Bookings are low mainly because active ride supply is weak. Add more active routes first, then push passengers to book. Your next action should be recruiting verified drivers and publishing at least three active rides.";
      }

      if (data.drivers.length < 3) {
        return "Bookings may be low because driver supply is not strong enough yet. RoadLink needs more verified drivers before spending money on passenger marketing.";
      }

      return "Bookings are building, but the next improvement is conversion. Add reminders, better route visibility, coupons, and a stronger call-to-action on available rides.";
    }

    if (q.includes("revenue") || q.includes("income") || q.includes("money") || q.includes("ingreso")) {
      return `Current completed booking revenue is ${money(data.revenue)}. To increase revenue, focus on completed trips, reduce cancellations, activate Stripe when ready, and promote the routes with the highest demand.`;
    }

    if (q.includes("driver") || q.includes("conductor")) {
      return `RoadLink currently has ${data.drivers.length} verified driver(s). For launch, aim for at least three to ten verified drivers in the first target area. Driver supply is the most important growth lever right now.`;
    }

    if (q.includes("risk") || q.includes("fraud") || q.includes("riesgo")) {
      return `Current risk signals: ${data.openReports.length} open report(s), ${data.urgentReports.length} urgent report(s), ${data.suspendedUsers.length} suspended user(s), and ${data.cancelRate}% cancellation rate. Resolve urgent reports first.`;
    }

    if (q.includes("city") || q.includes("ciudad") || q.includes("launch")) {
      return "Open the next city only where you can create route density. Start with one strong corridor, recruit drivers there, publish rides, then add coupons for passengers. Do not expand too wide too early.";
    }

    if (q.includes("today") || q.includes("hoy") || q.includes("fix")) {
      if (data.urgentReports.length > 0) return "Fix urgent reports first. Safety issues are the highest priority.";
      if (data.drivers.length < 3) return "Today you should recruit and verify more drivers. Without supply, passengers cannot book.";
      if (data.activeRides.length < 3) return "Today you should publish more active rides and test the booking flow.";
      return "Today you should review bookings, check payouts, create one promo campaign, and save a new AI Decision Report.";
    }

    return `RoadLink summary: ${users.length} users, ${data.drivers.length} verified drivers, ${data.activeRides.length} active rides, ${bookings.length} bookings, ${money(data.revenue)} revenue, and ${data.healthScore}/100 health score. Best next move: strengthen driver supply and active route density before scaling marketing.`;
  }

  async function askCopilot(customPrompt?: string) {
    const question = (customPrompt || input).trim();
    if (!question) {
      setMessage("Write a question first.");
      return;
    }

    try {
      setThinking(true);
      setMessage("");

      const now = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: question,
        createdAt: now,
      };

      const answer = generateAnswer(question);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: answer,
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current, userMessage, assistantMessage]);
      setInput("");

      await addDoc(collection(db, "aiCopilotChats"), {
        question,
        answer,
        metrics: {
          users: users.length,
          drivers: data.drivers.length,
          activeRides: data.activeRides.length,
          bookings: bookings.length,
          revenue: data.revenue,
          healthScore: data.healthScore,
        },
        createdAt: now,
        createdBy: auth.currentUser?.email || "admin",
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "AI Copilot Asked",
        targetType: "aiCopilot",
        details: question,
        severity: "info",
        adminEmail: auth.currentUser?.email || "",
        createdAt: now,
        resolved: true,
      });
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not ask AI Copilot.");
    } finally {
      setThinking(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/admin" className="miniButton">Admin</Link>
          <Link href="/admin/ai-decision-center" className="miniButton">AI Decision</Link>
          <Link href="/admin/ai-predict" className="miniButton">AI Predict</Link>
          <Link href="/admin/mission-control" className="miniButton">Mission Control</Link>
          <Link href="/admin/business-intelligence" className="miniButton">Business Intelligence</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink AI Assistant</p>
            <h1>AI <span>Copilot</span></h1>
            <p className="subtitle">
              Ask RoadLink questions about bookings, drivers, revenue, risk, growth, launch readiness and daily admin actions.
            </p>
          </div>

          <div className={data.healthScore >= 75 ? "scoreOrb" : "scoreOrb warning"}>
            <strong>{data.healthScore}</strong>
            <span>Platform Health</span>
          </div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="👥" label="Users" value={String(users.length)} />
          <Metric icon="🚘" label="Drivers" value={String(data.drivers.length)} />
          <Metric icon="🛣️" label="Active Rides" value={String(data.activeRides.length)} />
          <Metric icon="🎟️" label="Bookings" value={String(bookings.length)} />
          <Metric icon="💰" label="Revenue" value={money(data.revenue)} />
          <Metric icon="📉" label="Cancel Rate" value={`${data.cancelRate}%`} danger={data.cancelRate >= 20} />
          <Metric icon="⚠️" label="Reports" value={String(data.openReports.length)} danger={data.openReports.length > 0} />
          <Metric icon="🚨" label="Urgent" value={String(data.urgentReports.length)} danger={data.urgentReports.length > 0} />
        </section>

        <section className="copilotGrid">
          <section className="chatPanel">
            <p className="eyebrow">Ask Copilot</p>
            <h2>RoadLink Admin Assistant</h2>

            <div className="quickPrompts">
              {QUICK_PROMPTS.map((prompt) => (
                <button key={prompt} onClick={() => askCopilot(prompt)} disabled={thinking}>
                  {prompt}
                </button>
              ))}
            </div>

            <div className="chatBox">
              {messages.length === 0 ? (
                <div className="empty">
                  <h3>Ask your first question</h3>
                  <p>Example: Why are bookings low? What should I fix today?</p>
                </div>
              ) : (
                messages.map((item) => (
                  <div key={item.id} className={item.role === "assistant" ? "bubble ai" : "bubble user"}>
                    <strong>{item.role === "assistant" ? "RoadLink AI" : "You"}</strong>
                    <p>{item.text}</p>
                  </div>
                ))
              )}
            </div>

            <div className="inputRow">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") askCopilot();
                }}
                placeholder="Ask: What should I do today?"
              />

              <button onClick={() => askCopilot()} disabled={thinking}>
                {thinking ? "Thinking..." : "Ask"}
              </button>
            </div>
          </section>

          <section className="sidePanel">
            <p className="eyebrow">AI Context</p>
            <h2>Live Business Data</h2>

            <div className="infoGrid">
              <Info label="Verified Drivers" value={String(data.drivers.length)} />
              <Info label="Passengers" value={String(data.passengers.length)} />
              <Info label="Active Bookings" value={String(data.activeBookings.length)} />
              <Info label="Completed Bookings" value={String(data.completedBookings.length)} />
              <Info label="Cancelled Bookings" value={String(data.cancelledBookings.length)} />
              <Info label="Booking Rate" value={`${data.bookingRate}%`} />
              <Info label="Open Reports" value={String(data.openReports.length)} />
              <Info label="Suspended Users" value={String(data.suspendedUsers.length)} />
            </div>

            <div className={data.healthScore >= 75 ? "summaryBox" : "summaryBox dangerBox"}>
              <strong>{data.healthScore >= 75 ? "Stable" : "Needs Attention"}</strong>
              <p>
                {data.healthScore >= 75
                  ? "RoadLink has no major platform blocker right now."
                  : "RoadLink needs driver supply, active rides, lower cancellations, or report resolution."}
              </p>
            </div>
          </section>
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          color: white;
          padding: 24px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.24), transparent 34%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.16), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container { max-width: 1240px; margin: auto; }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .miniButton {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
        }

        .hero,
        .metric,
        .chatPanel,
        .sidePanel {
          background: rgba(8,13,25,0.92);
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
          font-size: 60px;
          line-height: 1;
          margin: 0 0 16px;
        }

        h1 span,
        h2,
        .metricValue,
        .scoreOrb strong {
          color: #22c55e;
        }

        h2 {
          font-size: 30px;
          margin: 0 0 14px;
        }

        .subtitle,
        .empty p,
        .bubble p,
        .summaryBox p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          margin: 14px 0;
        }

        .scoreOrb {
          min-width: 116px;
          height: 116px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .scoreOrb.warning {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.35);
        }

        .scoreOrb.warning strong { color: #fca5a5; }

        .scoreOrb strong {
          font-size: 36px;
          font-weight: 900;
        }

        .scoreOrb span {
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }

        .metric {
          border-radius: 22px;
          padding: 16px;
        }

        .dangerMetric {
          border-color: rgba(239,68,68,0.35);
          background: rgba(127,29,29,0.20);
        }

        .metricIcon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          margin-bottom: 10px;
        }

        .metricLabel {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          display: block;
          margin-bottom: 6px;
        }

        .metricValue {
          font-size: 22px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .copilotGrid {
          display: grid;
          grid-template-columns: 1.35fr 0.65fr;
          gap: 20px;
        }

        .chatPanel,
        .sidePanel {
          border-radius: 30px;
          padding: 24px;
        }

        .quickPrompts {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }

        button {
          padding: 13px 16px;
          border-radius: 999px;
          border: none;
          color: white;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .chatBox {
          min-height: 420px;
          max-height: 520px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 16px;
        }

        .bubble {
          max-width: 82%;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .bubble.user {
          align-self: flex-end;
          background: rgba(59,130,246,0.16);
        }

        .bubble.ai {
          align-self: flex-start;
          background: rgba(34,197,94,0.10);
          border-color: rgba(34,197,94,0.25);
        }

        .bubble strong {
          display: block;
          color: #22c55e;
          margin-bottom: 6px;
        }

        .bubble p {
          margin: 0;
        }

        .inputRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
        }

        input {
          width: 100%;
          padding: 15px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .info {
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .info span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .info strong {
          display: block;
          color: white;
          overflow-wrap: anywhere;
        }

        .summaryBox,
        .empty {
          padding: 20px;
          border-radius: 22px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.28);
          margin-top: 18px;
        }

        .dangerBox {
          background: rgba(127,29,29,0.18);
          border-color: rgba(239,68,68,0.35);
        }

        .summaryBox strong {
          display: block;
          color: #22c55e;
          margin-bottom: 8px;
        }

        .dangerBox strong {
          color: #fca5a5;
        }

        .empty {
          margin: auto;
          text-align: center;
        }

        .empty h3 {
          margin: 0 0 8px;
        }

        @media (max-width: 1050px) {
          .hero,
          .copilotGrid {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          h1 { font-size: 46px; }
        }

        @media (max-width: 650px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .chatPanel,
          .sidePanel {
            padding: 22px;
            border-radius: 26px;
          }

          .stats,
          .quickPrompts,
          .inputRow {
            grid-template-columns: 1fr;
          }

          .bubble {
            max-width: 100%;
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
  danger,
}: {
  icon: string;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? "metric dangerMetric" : "metric"}>
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <strong className="metricValue">{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
                                                                                                                                                                                     }
