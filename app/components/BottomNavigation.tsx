"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNavigation() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/dashboard",
      label: "Home",
      icon: "🏠",
    },
    {
      href: "/find-ride",
      label: "Find",
      icon: "🔍",
    },
    {
      href: "/offer-ride",
      label: "Offer",
      icon: "➕",
    },
    {
      href: "/messages",
      label: "Messages",
      icon: "💬",
    },
    {
      href: "/profile",
      label: "Profile",
      icon: "👤",
    },
  ];

  return (
    <>
      <nav className="bottomNav">
        {navItems.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`navItem ${active ? "active" : ""}`}
            >
              <div className="iconWrapper">
                <span className="icon">{item.icon}</span>
              </div>

              <span className="label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <style jsx>{`
        .bottomNav {
          position: fixed;
          bottom: 12px;
          left: 12px;
          right: 12px;
          height: 78px;

          display: flex;
          justify-content: space-around;
          align-items: center;

          background: rgba(3, 7, 18, 0.95);

          backdrop-filter: blur(20px);

          border: 1px solid rgba(255, 255, 255, 0.08);

          border-radius: 28px;

          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.6),
            0 0 30px rgba(34, 197, 94, 0.08);

          z-index: 99999;
        }

        .navItem {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          text-decoration: none;

          color: #9ca3af;

          min-width: 60px;

          transition: all 0.25s ease;
        }

        .iconWrapper {
          width: 42px;
          height: 42px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 14px;

          transition: all 0.25s ease;
        }

        .icon {
          font-size: 22px;
        }

        .label {
          margin-top: 4px;
          font-size: 11px;
          font-weight: 800;
        }

        .active {
          color: #22c55e;
        }

        .active .iconWrapper {
          background: rgba(34, 197, 94, 0.12);

          border: 1px solid rgba(34, 197, 94, 0.3);

          box-shadow:
            0 0 25px rgba(34, 197, 94, 0.25),
            inset 0 0 20px rgba(34, 197, 94, 0.08);
        }

        .active .icon {
          transform: scale(1.15);
        }

        .active .label {
          color: #22c55e;
        }

        @media (min-width: 768px) {
          .bottomNav {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
