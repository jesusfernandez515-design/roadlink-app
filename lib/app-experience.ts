export type AppExperience = "driver" | "passenger";
export function experienceFromPath(path: string): AppExperience | null {
  if (path === "/conductor" || path.startsWith("/conductor/")) return "driver";
  if (path === "/pasajero" || path.startsWith("/pasajero/")) return "passenger";
  return null;
}
export function experienceHome(mode: AppExperience) {
  return mode === "driver" ? "/conductor/" : "/pasajero/";
}
const appScreens = new Set(["/achievements", "/auth/action", "/business", "/chat", "/community", "/dashboard", "/dashboard/driver", "/disputes", "/driver", "/driver-earnings", "/driver-insights", "/driver-leaderboard", "/driver-profile", "/driver-verification", "/driver/earnings", "/email-verified", "/find-ride", "/fleet-management", "/followers", "/following", "/live-trip", "/login", "/messages", "/my-bookings", "/my-rides", "/notifications", "/offer-ride", "/passenger-profile", "/privacy", "/profile", "/profile/edit", "/rate-driver", "/referrals", "/register", "/reviews", "/rewards", "/ride", "/ride-details", "/ride-passengers", "/sos", "/support", "/terms", "/trip-history", "/wallet", "/wallet/settings"]);
export function appPath(href: string, mode: AppExperience | null): string {
  if (!mode || !href.startsWith("/") || href.startsWith("//") || experienceFromPath(href.split(/[?#]/)[0])) return href;
  const path = href.split(/[?#]/)[0].replace(/\/$/, "");
  if (path === "/dashboard") return experienceHome(mode) + href.slice(href.split(/[?#]/)[0].length);
  return appScreens.has(path) ? experienceHome(mode) + href.slice(1) : href;
}
