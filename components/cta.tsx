import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTA() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--primary)] via-[var(--primary)] to-teal-600 px-8 py-16 sm:px-16 lg:px-24 lg:py-24">
          {/* Background decoration */}
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-1/4 top-1/2 h-64 w-64 rounded-full bg-white/5 blur-2xl" />

          <div className="relative z-10 mx-auto max-w-3xl text-center">
            {/* Badge */}
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
              Únete a +2 millones de viajeros
            </span>
            
            <h2 className="mt-8 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              ¿Listo para tu próximo viaje?
            </h2>
            <p className="mt-6 text-lg text-white/80 sm:text-xl">
              Ahorra dinero, conoce gente increíble y reduce tu huella de carbono. 
              Tu aventura comienza con un solo clic.
            </p>
            
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/search"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-[var(--primary)] shadow-xl shadow-black/20 transition-all hover:bg-white/95 hover:scale-105"
              >
                Encuentra tu viaje
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/offer"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/40 bg-white/10 px-8 py-4 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/60"
              >
                Publica un viaje
              </Link>
            </div>
            
            <p className="mt-8 text-sm text-white/60">
              Registro gratuito. Sin compromisos. Cancela cuando quieras.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
