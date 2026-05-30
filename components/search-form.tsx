"use client";

import { useState } from "react";
import { Search, MapPin, Calendar, Users } from "lucide-react";

export function SearchForm() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [passengers, setPassengers] = useState("1");

  return (
    <section className="w-full">
      <div className="mx-auto max-w-5xl rounded-3xl border border-gray-100 bg-white p-5 shadow-2xl sm:p-7">
        <h2 className="text-center text-2xl font-black text-gray-900">
          Encuentra tu próximo viaje
        </h2>

        <p className="mt-2 text-center text-gray-600">
          Busca rutas compartidas seguras, económicas y verificadas.
        </p>

        <form className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Origen"
            icon={<MapPin className="h-5 w-5" />}
            placeholder="Ciudad o dirección"
            value={from}
            onChange={setFrom}
          />

          <Field
            label="Destino"
            icon={<MapPin className="h-5 w-5" />}
            placeholder="Ciudad o dirección"
            value={to}
            onChange={setTo}
          />

          <Field
            label="Fecha"
            icon={<Calendar className="h-5 w-5" />}
            type="date"
            value={date}
            onChange={setDate}
          />

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">
              Pasajeros
            </label>

            <div className="relative">
              <Users className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />

              <select
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                className="min-h-[54px] w-full appearance-none rounded-2xl border border-gray-300 bg-white pl-14 pr-4 text-base text-gray-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              >
                <option value="1">1 pasajero</option>
                <option value="2">2 pasajeros</option>
                <option value="3">3 pasajeros</option>
                <option value="4">4 pasajeros</option>
                <option value="5">5 pasajeros</option>
                <option value="6">6 pasajeros</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="flex min-h-[58px] items-center justify-center gap-3 rounded-2xl bg-teal-600 px-6 text-lg font-black text-white shadow-lg md:col-span-2 lg:col-span-4"
          >
            <Search className="h-5 w-5" />
            Buscar viaje
          </button>
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  icon,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-800">
        {label}
      </label>

      <div className="relative">
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-teal-600">
          {icon}
        </div>

        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[54px] w-full rounded-2xl border border-gray-300 bg-white pl-14 pr-4 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        />
      </div>
    </div>
  );
}
