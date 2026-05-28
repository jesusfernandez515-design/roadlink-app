import { Search, Car, Handshake, ThumbsUp } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Search your route",
    description:
      "Enter your departure and destination cities, select your travel date, and find available rides.",
  },
  {
    icon: Handshake,
    title: "Book your seat",
    description:
      "Choose a ride that fits your schedule. Review driver profiles, ratings, and vehicle details.",
  },
  {
    icon: Car,
    title: "Travel together",
    description:
      "Meet your driver at the pickup point and enjoy the journey. Split costs and share stories.",
  },
  {
    icon: ThumbsUp,
    title: "Rate your experience",
    description:
      "After your trip, leave a review to help build a trusted community of travelers.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted-foreground)]">
            Getting started with Roadlink is easy. Find your ride in just a few
            simple steps.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-10 hidden h-0.5 w-full bg-[var(--border)] lg:block" />
              )}

              <div className="relative flex flex-col items-center text-center">
                {/* Step number & icon */}
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
                    <step.icon className="h-8 w-8 text-[var(--primary)]" />
                  </div>
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
                    {index + 1}
                  </span>
                </div>

                {/* Content */}
                <h3 className="mt-6 text-lg font-semibold text-[var(--foreground)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[var(--muted-foreground)]">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
