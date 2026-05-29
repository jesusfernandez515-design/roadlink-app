"use client";

import { useState } from "react";
import { Search, MapPin, Calendar, Users } from "lucide-react";

export function SearchForm() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [passengers, setPassengers] = useState("1");

  return (
<div className="w-full max-w-6xl mx-auto px-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
            Origen
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Ciudad o dirección"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
     className="w-full h-12 pl-12 rounded-lg border ..."     </div>
        </div>

        {/* To */}
        <div className="relative">
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
            Destino
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Ciudad o dirección"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-3 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20
              className="w-full h-12 pl-12 rounded-lg border ..."
     className="w-full h-12 pl-12 rounded-lg border ..."     </div>
        </div>

        {/* Date */}
        <div className="relative">
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
            Fecha
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-3 pl-10 pr-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>
        </div>

        {/* Passengers */}
        <div className="relative">
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
            Pasajeros
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <select
              value={passengers}
              onChange={(e) => setPassengers(e.target.value)}
              className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--background)] py-3 pl-10 pr-8 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            >
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Button */}
        <div className="flex items-end">
          <button
            type="submit"
            className="flex h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-6 font-semibold text-[var(--primary-foreground)] transition-all hover:opacity-90 md:w-auto"
          >
            <Search className="h-4 w-4" />
            <span className="md:hidden lg:inline">Buscar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
