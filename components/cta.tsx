import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[var(--primary)] px-8 py-16 sm:px-16 lg:px-24 lg:py-20">
          {/* Background decoration */}
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--primary-foreground)] sm:text-4xl">
              Ready to share your journey?
            </h2>
            <p className="mt-4 text-lg text-[var(--primary-foreground)]/80">
              Join millions of travelers saving money and reducing their carbon
              footprint. Start your journey with Roadlink today.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 font-semibold text-[var(--primary)] shadow-lg transition-all hover:bg-white/90"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/offer"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 px-8 py-3.5 font-semibold text-[var(--primary-foreground)] transition-all hover:bg-white/10"
              >
                Offer a ride
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
