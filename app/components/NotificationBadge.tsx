"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

type NotificationBadgeProps = {
  className?: string;
};

export default function NotificationBadge({ className = "" }: NotificationBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUnreadCount(0);
        return;
      }

      unsubscribeNotifications = onSnapshot(
        query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("read", "==", false)
        ),
        (snapshot) => {
          setUnreadCount(snapshot.size);
        },
        () => {
          setUnreadCount(0);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  if (unreadCount <= 0) return null;

  return (
    <span className={`notificationBadge ${className}`}>
      {unreadCount > 99 ? "99+" : unreadCount}

      <style>{`
        .notificationBadge {
          position: absolute;
          top: -8px;
          right: -8px;
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          border-radius: 999px;
          background: #ef4444;
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 900;
          border: 2px solid #020617;
          box-shadow: 0 8px 24px rgba(239,68,68,0.45);
          z-index: 20;
        }
      `}</style>
    </span>
  );
}
