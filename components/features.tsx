import { Wallet, Shield, Leaf, Clock, Star, Users } from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "Save Money",
    description:
      "Split travel costs with fellow passengers. Save up to 75% compared to traveling alone.",
  },
  {
    icon: Shield,
    title: "Safe & Verified",
    description:
      "All drivers are verified. View ratings, reviews, and complete profiles before booking.",
  },
  {
    icon: Leaf,
    title: "Eco-Friendly",
    description:
      "Reduce your carbon footprint by sharing rides. One less car on the road makes a difference.",
  },
  {
    icon: Clock,
    title: "Flexible Options",
    description:
      "Find rides any time of day. Filter by departure time, amenities, and more.",
  },
  {
    icon: Star,
    title: "Quality Rides",
    description:
      "Choose from comfortable vehicles. Many drivers offer amenities like WiFi and snacks.",
  },
  {
    icon: Users,
    title: "Build Community",
    description:
      "Meet interesting people on your journey. Many passengers become friends for life.",
  },
];

export function Features() {
  return (
    <section className="bg-[var(--muted)] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Why choose Roadlink
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted-foreground)]">
            Join millions of travelers who trust Roadlink for their journeys.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl bg-[var(--card)] p-8 shadow-sm transition-all hover:shadow-lg border border-[var(--border)]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--primary)]/10 transition-colors group-hover:bg-[var(--primary)]/20">
                <feature.icon className="h-7 w-7 text-[var(--primary)]" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--foreground)]">
                {feature.title}
              </h3>
              <p className="mt-2 text-[var(--muted-foreground)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
