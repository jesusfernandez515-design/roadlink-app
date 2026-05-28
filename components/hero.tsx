import { SearchForm } from "./search-form";
import { Car, Users, Leaf, ShieldCheck, Star } from "lucide-react";
import Image from "next/image";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[var(--accent)] to-[var(--background)] py-16 lg:py-28">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-[var(--primary)]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-[var(--primary)]/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-[var(--primary)]/10 px-5 py-2.5 ring-1 ring-[var(--primary)]/20">
            <Leaf className="h-4 w-4 text-[var(--primary)]" />
            <span className="text-sm font-medium text-[var(--primary)]">
              Viaja de forma inteligente y ecológica
            </span>
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-6xl xl:text-7xl">
            Comparte el camino,{" "}
            <span className="bg-gradient-to-r from-[var(--primary)] to-teal-500 bg-clip-text text-transparent">
              ahorra juntos
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-8 max-w-2xl text-pretty text-lg text-[var(--muted-foreground)] sm:text-xl">
            Conecta con viajeros verificados que van en tu dirección. 
            Ahorra hasta un 75% en tus viajes mientras reduces tu huella de carbono.
          </p>

          {/* Trust indicators */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--muted-foreground)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <span>Conductores verificados</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              <span>4.9 de calificación</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[var(--primary)]" />
              <span>+2M usuarios activos</span>
            </div>
          </div>

          {/* Search Form */}
          <div className="mt-12 flex justify-center">
            <SearchForm />
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-8">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-6 backdrop-blur-sm">
              <p className="text-3xl font-bold text-[var(--foreground)] lg:text-4xl">2M+</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Usuarios activos</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-6 backdrop-blur-sm">
              <p className="text-3xl font-bold text-[var(--foreground)] lg:text-4xl">50K+</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Viajes diarios</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-6 backdrop-blur-sm">
              <p className="text-3xl font-bold text-[var(--foreground)] lg:text-4xl">10K+</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Tons CO₂ ahorradas</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-6 backdrop-blur-sm">
              <p className="text-3xl font-bold text-[var(--foreground)] lg:text-4xl">$15M+</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Ahorrado por usuarios</p>
            </div>
          </div>

          {/* Social Proof Avatars */}
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <div className="flex -space-x-3">
              {[
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=48&h=48&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=48&h=48&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=48&h=48&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=48&h=48&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=48&h=48&fit=crop&crop=face",
              ].map((src, i) => (
                <Image
                  key={i}
                  src={src}
                  alt=""
                  width={48}
                  height={48}
                  className="rounded-full border-2 border-white object-cover shadow-md"
                />
              ))}
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              <span className="font-semibold text-[var(--foreground)]">+2,847 personas</span>{" "}
              se unieron esta semana
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
