import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SearchForm } from "@/components/search-form";
import { MapPin, Clock, Star, Users, Car, Wifi, Music, Cigarette } from "lucide-react";

const mockRides = [
  {
    id: 1,
    driver: "Michael S.",
    avatar: "MS",
    rating: 4.9,
    reviews: 127,
    from: "New York",
    to: "Boston",
    date: "Tomorrow",
    time: "8:00 AM",
    price: 25,
    seats: 3,
    car: "Tesla Model 3",
    amenities: ["wifi", "music"],
  },
  {
    id: 2,
    driver: "Jennifer L.",
    avatar: "JL",
    rating: 4.8,
    reviews: 89,
    from: "New York",
    to: "Boston",
    date: "Tomorrow",
    time: "10:30 AM",
    price: 22,
    seats: 2,
    car: "Honda Accord",
    amenities: ["music"],
  },
  {
    id: 3,
    driver: "David K.",
    avatar: "DK",
    rating: 5.0,
    reviews: 54,
    from: "New York",
    to: "Boston",
    date: "Tomorrow",
    time: "2:00 PM",
    price: 28,
    seats: 4,
    car: "BMW X5",
    amenities: ["wifi", "music"],
  },
];

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header />
      
      {/* Search Section */}
      <section className="border-b border-[var(--border)] bg-[var(--accent)] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SearchForm />
        </div>
      </section>

      {/* Results */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">
                Available rides
              </h1>
              <p className="mt-1 text-[var(--muted-foreground)]">
                {mockRides.length} rides found
              </p>
            </div>
            <select className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--foreground)]">
              <option>Sort by: Earliest departure</option>
              <option>Sort by: Lowest price</option>
              <option>Sort by: Highest rated</option>
            </select>
          </div>

          <div className="space-y-4">
            {mockRides.map((ride) => (
              <div
                key={ride.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 transition-shadow hover:shadow-lg"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  {/* Driver Info */}
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-lg font-semibold text-[var(--primary-foreground)]">
                      {ride.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {ride.driver}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="text-[var(--foreground)]">{ride.rating}</span>
                        <span className="text-[var(--muted-foreground)]">
                          ({ride.reviews} reviews)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Route Info */}
                  <div className="flex-1 lg:px-8">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-[var(--primary)]" />
                        <span className="font-medium text-[var(--foreground)]">
                          {ride.from}
                        </span>
                      </div>
                      <div className="h-px flex-1 bg-[var(--border)]" />
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[var(--primary)]" />
                        <span className="font-medium text-[var(--foreground)]">
                          {ride.to}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[var(--muted-foreground)]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {ride.date}, {ride.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <Car className="h-4 w-4" />
                        {ride.car}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {ride.seats} seats left
                      </span>
                    </div>
                    {/* Amenities */}
                    <div className="mt-3 flex gap-2">
                      {ride.amenities.includes("wifi") && (
                        <span className="flex items-center gap-1 rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
                          <Wifi className="h-3 w-3" />
                          WiFi
                        </span>
                      )}
                      {ride.amenities.includes("music") && (
                        <span className="flex items-center gap-1 rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
                          <Music className="h-3 w-3" />
                          Music
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price & Book */}
                  <div className="flex items-center gap-6 lg:flex-col lg:items-end">
                    <p className="text-2xl font-bold text-[var(--primary)]">
                      ${ride.price}
                    </p>
                    <button className="rounded-full bg-[var(--primary)] px-6 py-2.5 font-semibold text-[var(--primary-foreground)] transition-all hover:opacity-90">
                      Book now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
