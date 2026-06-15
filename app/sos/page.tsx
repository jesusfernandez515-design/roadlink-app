"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
} from "firebase/firestore";

export default function SOSPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      setUserId(user.uid);
      setUserEmail(user.email || "");
    });

    return () => unsubscribe();
  }, []);

  async function sendSOS() {
    try {
      setSending(true);
      setMessage("");

      let latitude = null;
      let longitude = null;

      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: true,
                timeout: 10000,
              }
            );
          }
        );

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {}

      await addDoc(collection(db, "emergencyAlerts"), {
        userId,
        userEmail,
        status: "active",
        priority: "critical",
        latitude,
        longitude,
        createdAt: new Date().toISOString(),
      });

      await addDoc(collection(db, "notifications"), {
        type: "emergency",
        userId,
        title: "Emergency Alert Sent",
        message:
          "Your SOS emergency alert was successfully submitted.",
        read: false,
        createdAt: new Date().toISOString(),
        actionUrl: "/sos",
      });

      setMessage("Emergency alert sent successfully.");
    } catch (error: any) {
      setMessage(error.message || "Failed to send emergency alert.");
    } finally {
      setSending(false);
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

          <Link href="/notifications" className="button">
            Notifications
          </Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">
              RoadLink Safety Center
            </p>

            <h1>
              Emergency <span>SOS</span>
            </h1>

            <p className="subtitle">
              Use this emergency center if you feel unsafe,
              have an accident, medical emergency,
              harassment issue, or need immediate assistance.
            </p>
          </div>

          <div className="heroIcon">
            🚨
          </div>
        </section>

        {message && (
          <p className="message">
            {message}
          </p>
        )}

        <section className="card">
          <div className="icon">
            🚨
          </div>

          <h2>Emergency Alert</h2>

          <p>
            Pressing the button below creates a critical
            emergency alert inside RoadLink and stores
            your current location when available.
          </p>

          <button
            className="sosButton"
            onClick={sendSOS}
            disabled={sending}
          >
            {sending
              ? "Sending Alert..."
              : "SEND SOS ALERT"}
          </button>
        </section>

        <section className="tips">
          <div className="tip">
            <h3>🚔 Safety</h3>
            <p>
              If you are in immediate danger,
              contact local emergency services.
            </p>
          </div>

          <div className="tip">
            <h3>📍 Location</h3>
            <p>
              RoadLink attempts to save your GPS
              coordinates automatically.
            </p>
          </div>

          <div className="tip">
            <h3>📞 Support</h3>
            <p>
              Emergency incidents can later be reviewed
              by administrators.
            </p>
          </div>
        </section>

      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          padding: 24px;
          color: white;
          font-family: Arial,sans-serif;
          background:
            radial-gradient(circle at top right, rgba(239,68,68,.25), transparent 30%),
            linear-gradient(135deg,#020617,#030712,#0f172a);
        }

        .container {
          max-width: 1000px;
          margin:auto;
        }

        .topNav {
          display:flex;
          gap:12px;
          flex-wrap:wrap;
          margin-bottom:20px;
        }

        .button {
          text-decoration:none;
          color:white;
          padding:12px 18px;
          border-radius:999px;
          background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.1);
          font-weight:900;
        }

        .hero,
        .card,
        .tip {
          background:rgba(8,13,25,.92);
          border:1px solid rgba(255,255,255,.1);
          box-shadow:0 24px 80px rgba(0,0,0,.5);
        }

        .hero {
          padding:34px;
          border-radius:30px;
          display:flex;
          justify-content:space-between;
          gap:20px;
          margin-bottom:20px;
        }

        .eyebrow {
          color:#ef4444;
          font-weight:900;
          margin:0 0 10px;
        }

        h1 {
          font-size:58px;
          margin:0 0 16px;
        }

        h1 span {
          color:#ef4444;
        }

        .subtitle {
          color:#a1a1aa;
          max-width:650px;
        }

        .heroIcon {
          font-size:56px;
        }

        .message {
          color:#22c55e;
          font-weight:900;
          margin-bottom:20px;
        }

        .card {
          border-radius:30px;
          padding:40px;
          text-align:center;
          margin-bottom:20px;
        }

        .icon {
          font-size:80px;
          margin-bottom:16px;
        }

        .sosButton {
          margin-top:24px;
          width:100%;
          padding:24px;
          border:none;
          border-radius:20px;
          font-size:24px;
          font-weight:900;
          color:white;
          cursor:pointer;
          background:linear-gradient(
            135deg,
            #ef4444,
            #991b1b
          );
        }

        .tips {
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:16px;
        }

        .tip {
          padding:22px;
          border-radius:22px;
        }

        .tip p {
          color:#a1a1aa;
        }

        @media(max-width:800px) {
          h1 {
            font-size:42px;
          }

          .hero {
            flex-direction:column;
          }

          .tips {
            grid-template-columns:1fr;
          }
        }
      `}</style>
    </main>
  );
}
