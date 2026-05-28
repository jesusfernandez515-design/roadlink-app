"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MapPin, Calendar, Clock, Users, Car, DollarSign, Info } from "lucide-react";

export default function OfferPage() {
  const [step, setStep] = useState(1);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />

      <section className="py-12 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
              Ofrece un viaje
            </h1>
            <p className="mt-4 text-[var(--muted-foreground)]">
              Comparte tu viaje y gana dinero mientras ayudas a otros viajeros.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mt-10 flex items-center justify-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-4">
                <button
                  onClick={() => setStep(s)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-colors ${
                    step >= s
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {s}
                </button>
                {s < 3 && (
                  <div
                    className={`h-1 w-16 rounded ${
                      step > s ? "bg-[var(--primary)]" : "bg-[var(--muted)]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  Detalles de la ruta
                </h2>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                    Ciudad de salida
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <input
                      type="text"
                      placeholder="¿De dónde sales?"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-3 pl-11 pr-4 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                    Ciudad de destino
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <input
                      type="text"
                      placeholder="¿A dónde vas?"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-3 pl-11 pr-4 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                      Fecha
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <input
                        type="date"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-3 pl-11 pr-4 text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                      Hora
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <input
                        type="time"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-3 pl-11 pr-4 text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  Vehículo y capacidad
                </h2>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                    Vehículo
                  </label>
                  <div className="relative">
                    <Car className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <input
                      type="text"
                      placeholder="ej. Toyota Camry 2020"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-3 pl-11 pr-4 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                    Asientos disponibles
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <select className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--background)] py-3 pl-11 pr-4 text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20">
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <option key={num} value={num}>
                          {num} {num === 1 ? "asiento" : "asientos"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                    Comodidades
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {["WiFi", "Aire acondicionado", "Música", "Mascotas permitidas", "Espacio para equipaje"].map(
                      (amenity) => (
                        <label
                          key={amenity}
                          className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:border-[var(--primary)] has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary)]/10"
                        >
                          <input type="checkbox" className="sr-only" />
                          <span className="text-[var(--foreground)]">{amenity}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  Precio y preferencias
                </h2>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                    Precio por asiento
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <input
                      type="number"
                      placeholder="89"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-3 pl-11 pr-4 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
                    <Info className="h-4 w-4" />
                    Precio sugerido: $45-$119 según rutas similares
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                    Notas adicionales
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Información adicional que los pasajeros deben saber..."
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(Math.max(1, step - 1))}
                className={`rounded-lg border border-[var(--border)] px-6 py-2.5 font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] ${
                  step === 1 ? "invisible" : ""
                }`}
              >
                Atrás
              </button>
              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  className="rounded-lg bg-[var(--primary)] px-6 py-2.5 font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90"
                >
                  Continuar
                </button>
              ) : (
                <button className="rounded-lg bg-[var(--primary)] px-6 py-2.5 font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90">
                  Publicar viaje
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
