"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection } from "firebase/firestore";

export default function SupportPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Loading support center...");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setStatus("Please sign in to contact support.");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setStatus("");
    });

    return () => unsubscribe();
  }, []);

  async function submitTicket() {
    if (!userId) {
      setStatus("Please sign in first.");
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setStatus("Please add a subject and message.");
      return;
    }

    try {
      setSending(true);
      setStatus("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "supportTickets"), {
        userId,
        userEmail,
        subject: subject.trim(),
        category,
        priority,
        message: message.trim(),
        status: "open",
        adminReply: "",
        readByAdmin: false,
        readByUser: true,
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId,
        type: "support",
        title: "Support Ticket Created",
        message: "Your support request was submitted successfully.",
        read: false,
        createdAt: now,
        actionUrl: "/support",
      });

      setSubject("");
      setMessage("");
      setCategory("general");
      setPriority("normal");
      setStatus("Support ticket submitted successfully.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="topNav">
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
          <Link href="/profile" className="miniButton">Profile</Link>
          <Link href="/notifications" className="miniButton">Notifications</Link>
        </div>

        <p className="eyebrow">RoadLink Support</p>
        <h1>Support <span>Center</span></h1>
        <p className="subtitle">
          Need help with a ride, booking, payout, verification, or account issue?
          Send a support request to RoadLink.
        </p>

        {status && <p className="status">{status}</p>}

        <label>Subject</label>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Example: I need help with my payout"
        />

        <label>Category</label>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="general">General Support</option>
          <option value="ride">Ride Issue</option>
          <option value="booking">Booking Issue</option>
          <option value="payment">Payment / Wallet</option>
          <option value="verification">Driver Verification</option>
          <option value="safety">Safety Concern</option>
          <option value="account">Account</option>
        </select>

        <label>Priority</label>
        <select value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <label>Message</label>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Explain what happened..."
        />

        <button onClick={submitTicket} disabled={sending} className="submitButton">
          {sending ? "Submitting..." : "Submit Support Ticket"}
        </button>
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
          padding: 20px;
          padding-bottom: 120px;
          font-family: Arial, sans-serif;
        }

        .card {
          max-width: 760px;
          margin: auto;
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 34px;
          padding: 30px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 28px;
        }

        .miniButton {
          padding: 11px 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
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
          font-size: 50px;
          line-height: 1;
          margin: 0 0 14px;
        }

        h1 span {
          color: #22c55e;
        }

        .subtitle {
          color: #a1a1aa;
          font-size: 18px;
          line-height: 1.5;
          margin-bottom: 22px;
        }

        .status {
          color: #22c55e;
          font-weight: 900;
          margin: 16px 0;
        }

        label {
          display: block;
          font-weight: 900;
          margin: 16px 0 8px;
        }

        input,
        select,
        textarea {
          width: 100%;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
          font-family: Arial, sans-serif;
        }

        option {
          color: black;
        }

        textarea {
          min-height: 150px;
          resize: vertical;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        .submitButton {
          width: 100%;
          margin-top: 24px;
          padding: 18px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        }

        .submitButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 700px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .card {
            padding: 24px;
            border-radius: 28px;
          }

          h1 {
            font-size: 42px;
          }
        }
      `}</style>
    </main>
  );
}
