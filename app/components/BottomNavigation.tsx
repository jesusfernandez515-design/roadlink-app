"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNavigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Home", icon: "🏠" },
    { href: "/find-ride", label: "Find", icon: "🔎" },
    { href: "/offer-ride", label: "Offer", icon: "➕" },
    { href: "/messages", label: "Messages", icon: "💬" },
    { href: "/profile", label: "Profile", icon: "👤" },
  ];

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
              <span className="navLabel">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <style jsx global>{`
        body {
          margin: 0;
          padding-bottom: 90px;
          background: #020617;
        }

        .bottomNav {
          position: fixed;
          left: 50%;
          bottom: 14px;
          transform: translateX(-50%);
          width: calc(100% - 24px);
          max-width: 520px;
          height: 72px;
          z-index: 9999;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          padding: 8px;
          border-radius: 28px;
          background: rgba(8, 13, 25, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(18px);
        }

        .navItem {
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
        }

        .navItem * {
          text-decoration: none !important;
        }

        .navIcon {
          font-size: 20px;
          line-height: 1;
        }

        .navLabel {
          text-decoration: none !important;
        }

        .navItem.active {
          color: #22c55e;
          background: rgba(34, 197, 94, 0.14);
          border: 1px solid rgba(34, 197, 94, 0.34);
          box-shadow: 0 0 24px rgba(34, 197, 94, 0.14);
        }

        @media (min-width: 900px) {
          .bottomNav {
            display: none;
          }

          body {
            padding-bottom: 0;
          }
        }
      `}</style>
    </>
  );
}
