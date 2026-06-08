"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNavigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Home", icon: "🏠" },
    { href: "/find-ride", label: "Find", icon: "🔍" },
    { href: "/offer-ride", label: "Offer", icon: "➕" },
    { href: "/messages", label: "Messages", icon: "💬" },
    { href: "/profile", label: "Profile", icon: "👤" },
  ];

  return (
    <nav className="bottomNav">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`navItem ${isActive ? "active" : ""}`}
          >
            <span className="icon">{item.icon}</span>
            <span className="label">{item.label}</span>
          </Link>
        );
      })}

      <style>{`
        .bottomNav {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          display: flex;
          justify-content: space-around;
          background: rgba(0,0,0,0.9);
          padding: 8px 0;
          backdrop-filter: blur(10px);
          border-top: 1px solid rgba(255,255,255,0.15);
          z-index: 1000;
        }

        .navItem {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #fff;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 8px;
          transition: all 0.2s ease-in-out;
        }

        .navItem .icon {
          font-size: 20px;
        }

        .navItem.active {
          color: #22c55e;
        }

        .navItem.active .icon {
          font-size: 22px;
        }

        @media (min-width: 700px) {
          .bottomNav {
            display: none; /* Ocultar navegación móvil en pantallas grandes */
          }
        }
      `}</style>
    </nav>
  );
}
