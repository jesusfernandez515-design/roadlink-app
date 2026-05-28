import { MapPin, ArrowRight } from "lucide-react";

const routes = [
  { from: "New York", to: "Boston", rides: 234, price: "$25" },
  { from: "Los Angeles", to: "San Francisco", rides: 189, price: "$35" },
  { from: "Chicago", to: "Detroit", rides: 156, price: "$20" },
  { from: "Miami", to: "Orlando", rides: 145, price: "$18" },
  { from: "Seattle", to: "Portland", rides: 123, price: "$22" },
  { from: "Austin", to: "Houston", rides: 98, price: "$15" },
];

export function PopularRoutes() {
  return (
    <section className="bg-[var(--muted)] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Popular routes
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted-foreground)]">
            Discover the most traveled routes on Roadlink.
          </p>
        </div>

        {/* Routes Grid */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {routes.map((route) => (
            <a
              key={`${route.from}-${route.to}`}
              href={`/search?from=${route.from}&to=${route.to}`}
              className="group flex items-center justify-between rounded-xl bg-[var(--card)] p-5 shadow-sm transition-all hover:shadow-md border border-[var(--border)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10">
                  <MapPin className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-medium text-[var(--foreground)]">
                    <span>{route.from}</span>
                    <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                    <span>{route.to}</span>
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {route.rides} rides available
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-[var(--primary)]">
                  From {route.price}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* View All Link */}
        <div className="mt-10 text-center">
          <a
            href="/routes"
            className="inline-flex items-center gap-2 text-[var(--primary)] font-medium hover:underline"
          >
            View all routes
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
