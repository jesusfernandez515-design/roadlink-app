import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah M.",
    location: "New York to Boston",
    rating: 5,
    text: "I&apos;ve been using Roadlink for my weekly commute for over a year. The savings are incredible, and I&apos;ve made some great connections along the way.",
    avatar: "SM",
  },
  {
    name: "James T.",
    location: "Los Angeles to San Diego",
    rating: 5,
    text: "As a driver, Roadlink helps me offset my travel costs significantly. The app is easy to use and I&apos;ve met some really interesting people.",
    avatar: "JT",
  },
  {
    name: "Emily R.",
    location: "Chicago to Indianapolis",
    rating: 5,
    text: "I was nervous about my first ride, but the verification system and reviews gave me confidence. Now I&apos;m a regular user!",
    avatar: "ER",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Trusted by travelers
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted-foreground)]">
            See what our community has to say about their Roadlink experiences.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="flex flex-col rounded-2xl bg-[var(--card)] p-8 shadow-sm border border-[var(--border)]"
            >
              {/* Rating */}
              <div className="flex gap-1">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              {/* Text */}
              <p className="mt-4 flex-1 text-[var(--muted-foreground)]">
                {testimonial.text}
              </p>

              {/* Author */}
              <div className="mt-6 flex items-center gap-3 border-t border-[var(--border)] pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
