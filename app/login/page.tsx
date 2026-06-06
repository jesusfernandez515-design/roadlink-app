"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { auth } from "../../lib/firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function isValidGmail(emailValue: string) {
    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(emailValue);
  }

  function showError(error: any) {
    console.error(error);

    if (error.code === "auth/user-not-found") {
      setMessage("No RoadLink account was found with this Gmail.");
    } else if (error.code === "auth/wrong-password") {
      setMessage("Incorrect password. Please try again or reset your password.");
    } else if (error.code === "auth/invalid-email") {
      setMessage("Please enter a valid Gmail address.");
    } else if (error.code === "auth/invalid-credential") {
      setMessage("Invalid Gmail or password. Please check your information.");
    } else if (error.code === "auth/too-many-requests") {
      setMessage("Too many attempts. Please wait a moment and try again.");
    } else {
      setMessage(error.message || "Something went wrong.");
    }
  }

  async function signIn() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setMessage("Please enter your Gmail and password.");
      return;
    }

    if (!isValidGmail(cleanEmail)) {
      setMessage("Please use a valid Gmail address ending in @gmail.com.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const result = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const user = result.user;

      await user.reload();

      if (!user.emailVerified) {
        await sendEmailVerification(user, {
          url: "https://getroadlink.com/auth/action",
          handleCodeInApp: false,
        });

        await signOut(auth);

        setMessage(
          "Please verify your Gmail before signing in. We sent you a new verification email."
        );

        return;
      }

      setMessage("Signed in successfully. Redirecting...");
      router.push("/dashboard");
    } catch (error: any) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    try {
      setLoading(true);
      setMessage("");

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const cleanEmail = (user.email || "").toLowerCase();

      if (!isValidGmail(cleanEmail)) {
        await signOut(auth);
        setMessage("Please use a valid Gmail account.");
        return;
      }

      setMessage("Signed in with Google. Redirecting...");
      router.push("/dashboard");
    } catch (error: any) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessage("Please enter your Gmail address first.");
      return;
    }

    if (!isValidGmail(cleanEmail)) {
      setMessage("Please enter a valid Gmail address ending in @gmail.com.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await sendPasswordResetEmail(auth, cleanEmail, {
        url: "https://getroadlink.com/login",
        handleCodeInApp: false,
      });

      setMessage("Password reset email sent. Please check your Gmail.");
    } catch (error: any) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="brand">
          Road<span>Link</span>
        </div>

        <p className="eyebrow">Verified Access</p>

        <h1>Welcome Back</h1>

        <p className="subtitle">
          Sign in with your verified Gmail to continue your RoadLink journey.
        </p>

        <button className="social" onClick={continueWithGoogle} disabled={loading}>
          {loading ? "Please wait..." : "Continue with Google"}
        </button>

        <div className="divider">or</div>

        <input
          type="email"
          placeholder="Gmail Address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button className="forgotButton" onClick={resetPassword} disabled={loading}>
          Forgot password?
        </button>

        <button className="primary" onClick={signIn} disabled={loading}>
          {loading ? "Signing In..." : "Sign In"}
        </button>

        {message && <p className="message">{message}</p>}

        <div className="securityBox">
          <p>✅ Verified Gmail required</p>
          <p>✅ Password recovery supported</p>
          <p>✅ Google sign-in supported</p>
          <p>✅ RoadLink secure access</p>
        </div>

        <p className="footer">
          Don&apos;t have an account? <Link href="/register">Create one</Link>
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

        .brand span,
        .eyebrow,
        .message,
        .forgotButton {
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
          letter-spacing: -1px;
        }

        .subtitle {
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0;
          font-size: 17px;
        }

        input {
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

        input:focus {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        input::placeholder {
          color: #71717a;
        }

        button {
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          transition: all 0.25s ease;
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

        .social:hover {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.12);
        }

        .forgotButton {
          width: 100%;
          margin-top: 14px;
          padding: 0;
          background: transparent;
          border: none;
          font-size: 15px;
          text-align: right;
        }

        .primary {
          margin-top: 22px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: none;
          color: white;
          box-shadow: 0 18px 50px rgba(34,197,94,0.25);
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 14px;
          color: #71717a;
          margin: 24px 0;
          font-weight: 800;
        }

        .divider:before,
        .divider:after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.12);
        }

        .message {
          margin-top: 18px;
          text-align: center;
          font-weight: 900;
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

        @media (max-width: 480px) {
          .page {
            padding: 16px;
            align-items: flex-start;
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
