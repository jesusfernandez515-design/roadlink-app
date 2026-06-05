"use client";

import Link from "next/link";
import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  deleteUser,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("passenger");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function getDeviceId() {
    let deviceId = localStorage.getItem("roadlink_device_id");

    if (!deviceId) {
      deviceId = `device_${crypto.randomUUID()}`;
      localStorage.setItem("roadlink_device_id", deviceId);
    }

    return deviceId;
  }

  function isValidGmail(emailValue: string) {
    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(emailValue);
  }

  async function createAccount() {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setMessage("Please complete all fields.");
      return;
    }

    if (!isValidGmail(cleanEmail)) {
      setMessage("Please use a real Gmail address ending in @gmail.com.");
      return;
    }

    if (cleanPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (localStorage.getItem("roadlink_registered_device") === "true") {
      setMessage("This device already has a RoadLink account.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const deviceId = getDeviceId();

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        cleanPassword
      );

      const user = userCredential.user;

      const deviceRef = doc(db, "devices", deviceId);
      const deviceSnap = await getDoc(deviceRef);

      if (deviceSnap.exists()) {
        await deleteUser(user);
        await signOut(auth);
        setMessage("This device already has a RoadLink account.");
        return;
      }

      await sendEmailVerification(user);

      await setDoc(doc(db, "users", user.uid), {
        name: cleanName,
        email: cleanEmail,
        role,
        emailVerified: false,
        provider: "email",
        deviceId,
        createdAt: new Date().toISOString(),
      });

      await setDoc(deviceRef, {
        userId: user.uid,
        email: cleanEmail,
        provider: "email",
        createdAt: new Date().toISOString(),
      });

      localStorage.setItem("roadlink_registered_device", "true");

      setMessage("Account created. Please check your Gmail and verify your account before using RoadLink.");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    if (localStorage.getItem("roadlink_registered_device") === "true") {
      setMessage("This device already has a RoadLink account.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const deviceId = getDeviceId();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const cleanEmail = (user.email || "").toLowerCase();

      if (!isValidGmail(cleanEmail)) {
        await signOut(auth);
        setMessage("Please use a real Gmail account.");
        return;
      }

      const deviceRef = doc(db, "devices", deviceId);
      const deviceSnap = await getDoc(deviceRef);

      if (deviceSnap.exists()) {
        await signOut(auth);
        setMessage("This device already has a RoadLink account.");
        return;
      }

      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName || "",
        email: cleanEmail,
        role: "passenger",
        emailVerified: Boolean(user.emailVerified),
        provider: "google",
        deviceId,
        createdAt: new Date().toISOString(),
      });

      await setDoc(deviceRef, {
        userId: user.uid,
        email: cleanEmail,
        provider: "google",
        createdAt: new Date().toISOString(),
      });

      localStorage.setItem("roadlink_registered_device", "true");

      setMessage("Signed in with Google successfully.");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="brand">Road<span>Link</span></div>

        <p className="eyebrow">Secure Registration</p>
        <h1>Create your account</h1>

        <p className="subtitle">
          Join RoadLink with a verified Gmail. Each device can create only one account.
        </p>

        <button className="social" onClick={continueWithGoogle} disabled={loading}>
          {loading ? "Please wait..." : "Continue with Google"}
        </button>

        <div className="divider">or</div>

        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Gmail address" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="passenger">Passenger</option>
          <option value="driver">Driver</option>
        </select>

        <button className="primary" onClick={createAccount} disabled={loading}>
          {loading ? "Creating Account..." : "Create Account"}
        </button>

        {message && <p className="message">{message}</p>}

        <div className="securityBox">
          <p>✅ Gmail verification required</p>
          <p>✅ One account per device</p>
          <p>✅ Google sign-in supported</p>
        </div>

        <p className="footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
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
          max-width: 540px;
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 32px;
          padding: 34px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.7);
          backdrop-filter: blur(16px);
        }

        .brand {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 26px;
        }

        .brand span, .eyebrow, .message {
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
          font-size: 46px;
          margin: 0 0 14px;
          line-height: 1.05;
        }

        .subtitle {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
          font-size: 17px;
        }

        input, select {
          width: 100%;
          padding: 16px;
          margin-top: 12px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
        }

        select option { color: black; }

        button {
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .social {
          margin-top: 26px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          color: white;
        }

        .primary {
          margin-top: 22px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
          color: white;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 14px;
          color: #71717a;
          margin: 24px 0;
          font-weight: 800;
        }

        .divider:before, .divider:after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.12);
        }

        .message {
          margin-top: 18px;
          text-align: center;
          font-weight: 800;
          line-height: 1.5;
        }

        .securityBox {
          margin-top: 22px;
          padding: 16px;
          border-radius: 20px;
          background: rgba(34,197,94,0.09);
          border: 1px solid rgba(34,197,94,0.22);
        }

        .securityBox p {
          margin: 8px 0;
          color: #d4d4d8;
          font-weight: 800;
        }

        .footer {
          text-align: center;
          margin: 22px 0 0;
          color: #a1a1aa;
        }

        a {
          color: white;
          font-weight: 900;
          text-decoration: none;
        }
      `}</style>
    </main>
  );
}
