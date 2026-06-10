"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

type Follow = {
  id: string;
  followerId?: string;
  followerEmail?: string;
  followingId?: string;
  createdAt?: string;
};

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  photoURL?: string;
  city?: string;
  state?: string;
  bio?: string;
};

export default function FollowersPage() {
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [message, setMessage] = useState("Loading followers...");

  useEffect(() => {
    let unsubscribeFollowers: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setFollowers([]);
        setMessage("Please sign in to view your followers.");
        return;
      }

      unsubscribeFollowers = onSnapshot(
        query(collection(db, "followers"), where("followingId", "==", user.uid)),
        async (snapshot) => {
          const followData = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Follow[];

          const users = await Promise.all(
            followData.map(async (follow) => {
              if (!follow.followerId) {
                return null;
              }

              const userSnap = await getDoc(doc(db, "users", follow.followerId));
              const data = userSnap.data();

              return {
                id: follow.followerId,
                name: data?.name || "RoadLink User",
                email: data?.email || follow.followerEmail || "",
                photoURL: data?.photoURL || "",
                city: data?.city || "",
                state: data?.state || "",
                bio: data?.bio || "",
              } as UserProfile;
            })
          );

          setFollowers(users.filter(Boolean) as UserProfile[]);
          setMessage("");
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFollowers) unsubscribeFollowers();
    };
  }, []);

  return (
    <main className="page">
      <section className="header">
        <div className="topNav">
          <Link href="/profile" className="miniButton">Profile</Link>
          <Link href="/following" className="miniButton">Following</Link>
          <Link href="/dashboard" className="miniButton">Dashboard</Link>
        </div>

        <p className="eyebrow">RoadLink Community</p>
        <h1>Your <span>Followers</span></h1>
        <p className="subtitle">
          People who follow your RoadLink profile and activity.
        </p>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="list">
        {followers.length === 0 && !message ? (
          <div className="emptyCard">
            <h2>No followers yet</h2>
            <p>When someone follows you, they will appear here.</p>
          </div>
        ) : (
          followers.map((user) => (
            <Link key={user.id} href={`/profile/${user.id}`} className="userCard">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.name || "User"} className="avatarImage" />
              ) : (
                <div className="avatar">{(user.name || "R").charAt(0).toUpperCase()}</div>
              )}

              <div className="info">
                <strong>{user.name || "RoadLink User"}</strong>
                <p>{user.email || "No email available"}</p>
                <small>
                  {user.city || user.state
                    ? `${user.city || ""}${user.city && user.state ? ", " : ""}${user.state || ""}`
                    : "Location not set"}
                </small>
              </div>

              <span className="arrow">›</span>
            </Link>
          ))
        )}
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(34,197,94,0.2), transparent 34%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.12), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
          color: white;
          padding: 16px;
          padding-bottom: 140px;
          font-family: Arial, sans-serif;
        }

        .header,
        .list {
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        .header,
        .userCard,
        .emptyCard {
          background: rgba(8, 13, 25, 0.92);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 18px 60px rgba(0,0,0,0.45);
          backdrop-filter: blur(16px);
        }

        .header {
          border-radius: 28px;
          padding: 24px;
          margin-bottom: 14px;
        }

        .topNav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 22px;
        }

        .miniButton {
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          text-decoration: none;
          font-weight: 900;
          font-size: 13px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #22c55e;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        h1 {
          font-size: 42px;
          line-height: 1;
          margin: 0 0 12px;
        }

        h1 span,
        h2 {
          color: #22c55e;
        }

        .subtitle,
        .message,
        .emptyCard p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .message {
          max-width: 860px;
          margin: 0 auto 14px;
          font-weight: 900;
          color: #22c55e;
        }

        .list {
          display: grid;
          gap: 12px;
        }

        .userCard {
          display: grid;
          grid-template-columns: 64px 1fr auto;
          gap: 14px;
          align-items: center;
          border-radius: 22px;
          padding: 16px;
          color: white;
          text-decoration: none;
        }

        .avatar,
        .avatarImage {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 2px solid rgba(34,197,94,0.5);
        }

        .avatar {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 900;
        }

        .avatarImage {
          object-fit: cover;
        }

        .info {
          min-width: 0;
        }

        .info strong {
          display: block;
          margin-bottom: 5px;
          font-size: 17px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .info p,
        .info small {
          display: block;
          color: #a1a1aa;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .arrow {
          color: #22c55e;
          font-size: 30px;
          font-weight: 900;
        }

        .emptyCard {
          border-radius: 24px;
          padding: 24px;
        }

        @media (max-width: 420px) {
          h1 {
            font-size: 36px;
          }

          .userCard {
            grid-template-columns: 54px 1fr auto;
          }

          .avatar,
          .avatarImage {
            width: 54px;
            height: 54px;
          }
        }
      `}</style>
    </main>
  );
}
