"use client";

import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("passenger");
  const [message, setMessage] = useState("");

  async function createAccount() {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
      });

      setMessage("Account created successfully.");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function continueWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName || "",
        email: user.email || "",
        role: "passenger",
        createdAt: new Date().toISOString(),
      });

      setMessage("Signed in with Google.");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h2>Road<span>Link</span></h2>
        <h1>Create your account</h1>
        <p>Join RoadLink as a passenger or driver.</p>

        <button className="social" onClick={continueWithGoogle}>
          Continue with Google
        </button>

        <div className="divider">or</div>

        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="passenger">Passenger</option>
          <option value="driver">Driver</option>
        </select>

        <button className="primary" onClick={createAccount}>
          Create Account
        </button>

        {message && <p className="message">{message}</p>}

        <p className="footer">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, #000, #020617, #0f172a);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .card {
          width: 100%;
          max-width: 520px;
          background: #0b0b0b;
          border: 1px solid #222;
          border-radius: 30px;
          padding: 32px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.7);
        }

        h2 {
          font-size: 28px;
          margin: 0 0 24px;
        }

        h2 span { color: #22c55e; }

        h1 {
          font-size: 42px;
          margin: 0 0 12px;
          line-height: 1.1;
        }

        p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        input, select {
          width: 100%;
          padding: 16px;
          margin-top: 12px;
          border-radius: 16px;
          border: 1px solid #333;
          background: #111;
          color: white;
          font-size: 16px;
        }

        button {
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }

        .social {
          margin-top: 24px;
          background: #18181b;
          border: 1px solid #333;
          color: white;
        }

        .primary {
          margin-top: 22px;
          background: #22c55e;
          border: none;
          color: white;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 14px;
          color: #71717a;
          margin: 24px 0;
        }

        .divider:before,
        .divider:after {
          content: "";
          flex: 1;
          height: 1px;
          background: #333;
        }

        .message {
          color: #22c55e;
          margin-top: 18px;
          text-align: center;
        }

        .footer {
          text-align: center;
          margin-top: 20px;
        }

        a {
          color: white;
          font-weight: 800;
          text-decoration: none;
        }

        @media (max-width: 480px) {
          .card {
            padding: 26px;
            border-radius: 26px;
          }

          h1 {
            font-size: 36px;
          }
        }
      `}</style>
    </main>
  );
}
