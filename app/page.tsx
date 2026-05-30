export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-xl font-black text-white">
              R
            </div>
            <span className="text-2xl font-black">RoadLink</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-700 md:flex">
            <a href="#how-it-works">How it works</a>
            <a href="#benefits">Benefits</a>
            <a href="#routes">Routes</a>
          </nav>

          <a
            href="#join"
            className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-sm"
          >
            Join Beta
          </a>
        </div>
      </header>

      <section className="bg-gradient-to-b from-teal-50 to-white px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mx-auto inline-flex rounded-full bg-teal-100 px-4 py-2 text-sm font-bold text-teal-700">
              Safe shared rides between cities
            </p>

            <h1 className="mt-6 text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Share the ride,
              <span className="block text-teal-600">save on the road</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              RoadLink connects passengers and drivers traveling in the same
              direction. Split travel costs, ride with confidence, and make long
              trips more affordable.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-center text-2xl font-black">
              Find your next ride
            </h2>
            <p className="mt-2 text-center text-slate-600">
              Search safe and affordable shared routes.
            </p>

            <form className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-bold">From</label>
                <input
                  type="text"
                  placeholder="City or address"
                  className="min-h-[56px] w-full rounded-2xl border border-slate-300 px-4 text-base outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">To</label>
                <input
                  type="text"
                  placeholder="City or address"
                  className="min-h-[56px] w-full rounded-2xl border border-slate-300 px-4 text-base outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">Date</label>
                <input
                  type="date"
                  className="min-h-[56px] w-full rounded-2xl border border-slate-300 px-4 text-base outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Passengers
                </label>
                <select className="min-h-[56px] w-full rounded-2xl border border-slate-300 px-4 text-base outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100">
                  <option>1 passenger</option>
                  <option>2 passengers</option>
                  <option>3 passengers</option>
                  <option>4 passengers</option>
                </select>
              </div>

              <button
                type="submit"
                className="min-h-[60px] rounded-2xl bg-teal-600 text-lg font-black text-white shadow-lg md:col-span-2 lg:col-span-4"
              >
                Search Ride
              </button>
            </form>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-6 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-black">How RoadLink works</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              A simple way to connect with people traveling in the same
              direction.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ["1", "Search your route", "Enter your origin, destination, travel date, and number of passengers."],
              ["2", "Connect safely", "Find available drivers or passengers and review trip details before you go."],
              ["3", "Share the ride", "Split costs, travel smarter, and enjoy a more affordable trip."],
            ].map(([number, title, text]) => (
              <div
                key={title}
                className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"
              >
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-xl font-black text-white">
                  {number}
                </div>
                <h3 className="text-xl font-black">{title}</h3>
                <p className="mt-3 leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="bg-slate-50 px-6 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-black">Why choose RoadLink?</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Built for long-distance travelers who want a safer and more
              affordable way to move between cities.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Save money", "Share fuel, tolls, and travel costs."],
              ["Travel smarter", "Find people going your way."],
              ["Long-distance routes", "Designed for city-to-city travel."],
              ["Community first", "A better way to travel together."],
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <h3 className="text-xl font-black">{title}</h3>
                <p className="mt-3 leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="routes" className="px-6 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-black">Popular routes</h2>
            <p className="mt-4 text-lg text-slate-600">
              Example routes for future RoadLink travelers.
            </p>
          </div>

          <div className="mt-10 grid gap-4">
            {[
              ["Mobile", "Birmingham", "$45"],
              ["Mobile", "New Orleans", "$55"],
              ["Birmingham", "Atlanta", "$65"],
              ["Miami", "Orlando", "$49"],
            ].map(([from, to, price]) => (
              <div
                key={`${from}-${to}`}
                className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <p className="text-lg font-black">
                    {from} → {to}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Shared ride route
                  </p>
                </div>
                <p className="shrink-0 text-lg font-black text-teal-600">
                  From {price}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="join" className="bg-teal-600 px-6 py-20 text-white sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-black">Ready to share your ride?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-teal-50">
            Join the RoadLink beta and help build a better way to travel by
            road.
          </p>
          <button className="mt-8 rounded-2xl bg-white px-8 py-4 text-lg font-black text-teal-700 shadow-lg">
            Join RoadLink Beta
          </button>
        </div>
      </section>

      <footer className="bg-slate-950 px-6 py-10 text-white sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="text-2xl font-black">RoadLink</h2>
          <p className="mt-3 text-slate-400">
            Founder & CEO: Jesús Fernández Rosario
          </p>
          <p className="mt-6 text-sm text-slate-500">
            © 2026 RoadLink. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
export default function Page() {
  return (
    <main className="min-h-screen bg-white p-8 text-slate-900">
      <h1 className="text-3xl font-black">RoadLink</h1>
      <p className="mt-4 text-slate-600">This page is under construction.</p>
    </main>
  );
}
