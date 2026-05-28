import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Shield, Users, Leaf, Award, MapPin, Heart } from "lucide-react";

const stats = [
  { label: "Active Users", value: "2M+" },
  { label: "Rides Completed", value: "15M+" },
  { label: "Countries", value: "25+" },
  { label: "CO2 Saved (tons)", value: "10K+" },
];

const values = [
  {
    icon: Shield,
    title: "Safety First",
    description:
      "We verify all drivers and provide safety features like ride tracking, emergency contacts, and 24/7 support.",
  },
  {
    icon: Users,
    title: "Community Driven",
    description:
      "Our platform is built on trust and community. Ratings and reviews help everyone make informed decisions.",
  },
  {
    icon: Leaf,
    title: "Sustainability",
    description:
      "Every shared ride reduces carbon emissions. Together, we are making transportation more sustainable.",
  },
  {
    icon: Heart,
    title: "Accessibility",
    description:
      "Affordable travel for everyone. We believe getting from A to B should not break the bank.",
  },
];

const team = [
  { name: "Alex Chen", role: "CEO & Co-founder", avatar: "AC" },
  { name: "Maria Garcia", role: "CTO & Co-founder", avatar: "MG" },
  { name: "James Wilson", role: "Head of Operations", avatar: "JW" },
  { name: "Sarah Johnson", role: "Head of Trust & Safety", avatar: "SJ" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />

      {/* Hero */}
      <section className="bg-[var(--accent)] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
              About Roadlink
            </h1>
            <p className="mt-6 text-lg text-[var(--muted-foreground)]">
              We are on a mission to make travel more accessible, affordable, and
              sustainable by connecting travelers going the same way.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-[var(--border)] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-[var(--primary)]">
                  {stat.value}
                </p>
                <p className="mt-1 text-[var(--muted-foreground)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-[var(--foreground)]">
                Our Story
              </h2>
              <div className="mt-6 space-y-4 text-[var(--muted-foreground)]">
                <p>
                  Roadlink was born from a simple idea: empty seats in cars traveling
                  the same routes represent a massive untapped opportunity for
                  connection and sustainability.
                </p>
                <p>
                  Founded in 2020, we set out to build a platform that makes
                  carpooling easy, safe, and enjoyable. Today, we connect millions
                  of travelers across 25+ countries, helping them save money while
                  reducing their carbon footprint.
                </p>
                <p>
                  Our vision goes beyond just rides. We are building a community of
                  travelers who share not just their journeys, but their stories,
                  experiences, and perspectives.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl bg-[var(--muted)] flex items-center justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)]/10">
                  <MapPin className="h-12 w-12 text-[var(--primary)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-[var(--muted)] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">
              Our Values
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--muted-foreground)]">
              These core principles guide everything we do at Roadlink.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl bg-[var(--card)] p-6 text-center border border-[var(--border)]"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--primary)]/10">
                  <value.icon className="h-7 w-7 text-[var(--primary)]" />
                </div>
                <h3 className="mt-4 font-semibold text-[var(--foreground)]">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">
              Our Team
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--muted-foreground)]">
              Meet the people behind Roadlink.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <div key={member.name} className="text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)] text-2xl font-bold text-[var(--primary-foreground)]">
                  {member.avatar}
                </div>
                <h3 className="mt-4 font-semibold text-[var(--foreground)]">
                  {member.name}
                </h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {member.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
