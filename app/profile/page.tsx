"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";

type UserProfile = {
  name?: string;
  email?: string;
  role?: string;
  createdAt?: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>({
    name: "RoadLink User",
    email: "",
    role: "member",
  });

  const [bookedTrips, setBookedTrips] = useState(0);
  const [activeRides, setActiveRides] = useState(0);
  const [avatar, setAvatar] = useState("R");
  const [message, setMessage] = useState("Loading profile...");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to view your profile.");
        return;
      }

      const userEmail = user.email || "";
      const fallbackName = user.displayName || "RoadLink User";

      setAvatar(userEmail ? userEmail.charAt(0).toUpperCase() : "R");

      try {
        const usersQuery = query(
          collection(db, "users"),
          where("email", "==", userEmail)
        );

        const usersSnapshot = await getDocs(usersQuery);

        if (!usersSnapshot.empty) {
          const userData = usersSnapshot.docs[0].data() as UserProfile;

          setProfile({
            name: userData.name || fallbackName,
            email: userData.email || userEmail,
            role: userData.role || "member",
            createdAt: userData.createdAt || "",
          });
        } else {
          setProfile({
            name: fallbackName,
            email: userEmail,
            role: "member",
            createdAt: "",
          });
        }

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("passengerEmail", "==", userEmail),
          where("status", "==", "reserved")
        );

        const bookingsSnapshot = await getDocs(bookingsQuery);
        setBookedTrips(bookingsSnapshot.size);

        const ridesQuery = query(
          collection(db, "rides"),
          where("driverEmail", "==", userEmail),
          where("status", "==", "active")
        );

        const ridesSnapshot = await getDocs(ridesQuery);
        setActiveRides(ridesSnapshot.size);

        setMessage("");
      } catch (error: any) {
        setMessage(error.message);
      }
    });

    return () => unsubscribe();
  }, []);

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <main className="page">
      <section className="card">
        <div className="top">
          <div className="avatar">{avatar}</div>

          <div>
            <h1>{profile.name}</h1>
            <p>{profile.email || "No email found"}</p>
            <p className="verified">Verified RoadLink Member</p>
          </div>
        </div>

        {message && <p className="message">{message}</p>}

        <div className="stats">
          <Box title="Rating" value="New" />
          <Box title="Booked Trips" value={String(bookedTrips)} />
          <Box title="Active Rides" value={String(activeRides)} />
        </div>

        <section className="section">
          <h2>Profile Details</h2>

          <div className="detail">
            <span>Full Name</span>
            <strong>{profile.name || "RoadLink User"}</strong>
          </div>

          <div className="detail">
            <span>Email</span>
            <strong>{profile.email || "Not available"}</strong>
          </div>

          <div className="detail">
            <span>Account Type</span>
            <strong className="capitalize">{profile.role || "member"}</strong>
          </div>

          <div className="detail">
            <span>Member Since</span>
            <strong>
              {profile.createdAt
                ? profile.createdAt.slice(0, 10)
                : "2026"}
            </strong>
          </div>

          <div className="detail">
            <span>Verification</span>
            <strong>Email Verified</strong>
          </div>
        </section>

        <section className="section">
          <h2>Quick Actions</h2>

          <div className="actions">
            <a href="/dashboard">Dashboard</a>
            <a href="/find-ride">Find a Ride</a>
            <a href="/offer-ride">Offer a Ride</a>
            <a href="/my-bookings">My Bookings</a>
            <a href="/dashboard/driver">Driver Dashboard</a>
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

        <button onClick={handleSignOut} className="signOutButton">
          Sign Out
        </button>
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

        .message {
          color: #22c55e;
          font-weight: 800;
          margin-top: 22px;
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

        .capitalize {
          text-transform: capitalize;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
        }

        .actions a {
          background: #111;
          border: 1px solid #222;
          border-radius: 16px;
          padding: 15px;
          text-align: center;
          color: white;
          text-decoration: none;
          font-weight: 800;
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

        .signOutButton {
          width: 100%;
          margin-top: 30px;
          padding: 17px;
          border-radius: 999px;
          border: none;
          background: #ef4444;
          color: white;
          font-size: 17px;
          font-weight: 800;
        }

        @media (max-width: 700px) {
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

          .actions {
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
