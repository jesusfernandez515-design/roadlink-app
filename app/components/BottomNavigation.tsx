"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type Chat = {
  id: string;
  chatId?: string;
  driverId?: string;
  passengerId?: string;
  unreadCount?: number;
};

export default function BottomNavigation() {
  const pathname = usePathname();

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let unsubscribeDriverChats: (() => void) | undefined;
    let unsubscribePassengerChats: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUnreadMessages(0);
      setUnreadNotifications(0);

      if (!user) return;

      let driverChats: Chat[] = [];
      let passengerChats: Chat[] = [];

      function updateUnreadMessages() {
        const chatMap = new Map<string, Chat>();

        [...driverChats, ...passengerChats].forEach((chat) => {
          const key = chat.chatId || chat.id;

          if (!key) return;
          if (key === "chat_abc123") return;
          if (chat.driverId === "test-driver") return;
          if (chat.passengerId === "test-passenger") return;

          chatMap.set(key, chat);
        });

        const total = Array.from(chatMap.values()).reduce(
          (sum, chat) => sum + Number(chat.unreadCount || 0),
          0
        );

        setUnreadMessages(total);
      }

      unsubscribeDriverChats = onSnapshot(
        query(collection(db, "chats"), where("driverId", "==", user.uid)),
        (snapshot) => {
          driverChats = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Chat[];

          updateUnreadMessages();
        }
      );

      unsubscribePassengerChats = onSnapshot(
        query(collection(db, "chats"), where("passengerId", "==", user.uid)),
        (snapshot) => {
          passengerChats = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Chat[];

          updateUnreadMessages();
        }
      );

      unsubscribeNotifications = onSnapshot(
        query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("read", "==", false)
        ),
        (snapshot) => {
          const unreadNonMessageNotifications = snapshot.docs.filter((document) => {
            const data = document.data();
            return data.type !== "message";
          });

          setUnreadNotifications(unreadNonMessageNotifications.length);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDriverChats) unsubscribeDriverChats();
      if (unsubscribePassengerChats) unsubscribePassengerChats();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  const navItems = useMemo(
    () => [
      { href: "/dashboard", label: "Home", icon: "🏠", badge: 0 },
      { href: "/find-ride", label: "Find", icon: "🔎", badge: 0 },
      { href: "/offer-ride", label: "Offer", icon: "➕", badge: 0 },
      { href: "/messages", label: "Messages", icon: "💬", badge: unreadMessages },
      { href: "/profile", label: "Profile", icon: "👤", badge: unreadNotifications },
    ],
    [unreadMessages, unreadNotifications]
  );

  return (
    <>
      <nav className="bottomNav">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "navItem active" : "navItem"}
            >
              <span className="navIcon">{item.icon}</span>

              {item.badge > 0 && (
                <span className="navBadge">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}

              <span className="navLabel">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <style jsx global>{`
        html,
        body {
          margin: 0;
          background: #020617;
          overflow-x: hidden;
        }

        body {
          padding-bottom: 128px !important;
        }

        main,
        .page,
        .dashboard,
        .profilePage,
        .walletPage {
          padding-bottom: 145px !important;
        }

        .bottomNav {
          position: fixed;
          left: 50%;
          bottom: 14px;
          transform: translateX(-50%);
          width: calc(100% - 28px);
          max-width: 520px;
          height: 78px;
          z-index: 9999;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 6px;
          padding: 8px;
          border-radius: 28px;
          background: rgba(8, 13, 25, 0.97);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(20px);
          overflow: visible;
        }

        .navItem {
          position: relative;
          width: 100%;
          min-width: 0;
          height: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 20px;
          color: #a1a1aa;
          text-decoration: none !important;
          font-size: 11px;
          font-weight: 900;
          line-height: 1;
          border: 1px solid transparent;
          overflow: visible;
        }

        .navIcon {
          font-size: 23px;
          line-height: 1;
        }

        .navLabel {
          width: 100%;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .navBadge {
          position: absolute;
          top: 4px;
          right: 8px;
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          font-size: 9px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.85);
          z-index: 2;
        }

        .navItem.active {
          color: #22c55e;
          background: rgba(34, 197, 94, 0.13);
          border-color: rgba(34, 197, 94, 0.38);
          box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.05),
            0 0 22px rgba(34, 197, 94, 0.14);
        }

        @media (max-width: 380px) {
          body {
            padding-bottom: 135px !important;
          }

          main,
          .page,
          .dashboard,
          .profilePage,
          .walletPage {
            padding-bottom: 150px !important;
          }

          .bottomNav {
            width: calc(100% - 18px);
            height: 76px;
            padding: 7px;
            gap: 4px;
          }

          .navItem {
            height: 60px;
            font-size: 10px;
          }

          .navIcon {
            font-size: 21px;
          }

          .navBadge {
            right: 5px;
          }
        }

        @media (min-width: 900px) {
          .bottomNav {
            display: none;
          }

          body {
            padding-bottom: 0 !important;
          }

          main,
          .page,
          .dashboard,
          .profilePage,
          .walletPage {
            padding-bottom: 40px !important;
          }
        }
      `}</style>
    </>
  );
}
