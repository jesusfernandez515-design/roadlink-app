import { SearchForm } from "./search-form";
import { Car, Users, Leaf } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[var(--accent)] to-[var(--background)] py-20 lg:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-[var(--primary)]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-[var(--primary)]/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[var(--primary)]/10 px-4 py-2">
            <Leaf className="h-4 w-4 text-[var(--primary)]" />
            <span className="text-sm font-medium text-[var(--primary)]">
              Eco-friendly travel
            </span>
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-6xl">
            Share your journey,{" "}
            <span className="text-[var(--primary)]">save together</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-[var(--muted-foreground)] sm:text-xl">
            Connect with travelers going your way. Save money, reduce emissions,
            and make new friends on the road.
          </p>

          {/* Stats */}
          <div className="mt-10 flex flex-wrap justify-center gap-8 sm:gap-12">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10">
                <Users className="h-6 w-6 text-[var(--primary)]" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-[var(--foreground)]">2M+</p>
                <p className="text-sm text-[var(--muted-foreground)]">Active users</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10">
                <Car className="h-6 w-6 text-[var(--primary)]" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-[var(--foreground)]">50K+</p>
                <p className="text-sm text-[var(--muted-foreground)]">Daily rides</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10">
                <Leaf className="h-6 w-6 text-[var(--primary)]" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-[var(--foreground)]">10K+</p>
                <p className="text-sm text-[var(--muted-foreground)]">Tons CO2 saved</p>
              </div>
            </div>
          </div>

          {/* Search Form */}
          <div className="mt-12 flex justify-center">
            <SearchForm />
          </div>
        </div>
      </div>
    </section>
  );
}
