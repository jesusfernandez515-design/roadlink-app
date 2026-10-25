export type AppExperience = "driver" | "passenger";
export function experienceFromPath(path: string): AppExperience | null {
  if (path === "/conductor" || path.startsWith("/conductor/")) return "driver";
  if (path === "/pasajero" || path.startsWith("/pasajero/")) return "passenger";
  return null;
}
export function experienceHome(mode: AppExperience) {
  return mode === "driver" ? "/conductor" : "/pasajero";
}
