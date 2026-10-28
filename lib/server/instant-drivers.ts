import { ApiError, type serverFirebase } from "./firebase-admin";

export async function instantDrivers(db: ReturnType<typeof serverFirebase>["db"]) {
  const pilot = "XmpCtSTIS6cf7r8UMc2UxLFj6qH3";
  const rows = await db.collection("instantDrivers").where("enabled", "==", true).limit(101).get();
  if (rows.size > 100) throw new ApiError(503, "No se pudo cargar el directorio completo de conductores.");
  const allowed = new Set([pilot, "DefaRi3pT2c5ZKs5gwc66lywFWN2"]);
  return [...new Set([pilot, ...rows.docs.map(row => row.id).filter(id => allowed.has(id))])];
}
