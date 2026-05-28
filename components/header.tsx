"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, MapPin, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Buscar viaje", href: "/search" },
  { name: "Publicar viaje", href: "/offer" },
  { name: "Cómo funciona", href: "#how-it-works" },
  { name: "Nosotros", href: "/about" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--card)]/80">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-teal-600 shadow-lg shadow-[var(--primary)]/25">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Roadlink
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-r from-[var(--primary)] to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--primary)]/25 transition-all hover:opacity-90 hover:shadow-xl hover:shadow-[var(--primary)]/30"
          >
            Únete gratis
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--muted)] md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span className="sr-only">Abrir menú</span>
          {mobileMenuOpen ? (
            <X className="h-6 w-6 text-[var(--foreground)]" />
          ) : (
            <Menu className="h-6 w-6 text-[var(--foreground)]" />
          )}
        </button>
      </nav>

      {/* Mobile Navigation */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out md:hidden",
          mobileMenuOpen ? "max-h-[400px]" : "max-h-0"
        )}
      >
        <div className="border-t border-[var(--border)] px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="rounded-lg px-4 py-3 text-base font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-6">
              <Link
                href="/login"
                className="rounded-lg px-4 py-3 text-center text-base font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                Iniciar sesión
              </Link>
              <Link
                href="/signup"
                className="w-full rounded-full bg-gradient-to-r from-[var(--primary)] to-teal-600 py-3.5 text-center text-base font-semibold text-white shadow-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Únete gratis
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
