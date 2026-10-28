import { ApiError } from "./firebase-admin";

export type GuestPassenger = { name: string; phone: string; notes: string };
export function guestPassenger(body: Record<string, unknown>): GuestPassenger | null {
  if (body.travelFor !== "guest") {
    if (body.travelFor && body.travelFor !== "self") throw new ApiError(400, "Selecciona quién viajará.");
    return null;
  }
  const guest = body.guest as Record<string, unknown> | undefined;
  if (!guest || body.guestConsent !== true) throw new ApiError(400, "Confirma que tienes permiso para compartir los datos del invitado.");
  const name = typeof guest.name === "string" ? guest.name.trim() : "";
  const phone = typeof guest.phone === "string" ? guest.phone.trim() : "";
  const notes = typeof guest.notes === "string" ? guest.notes.trim() : "";
  if (name.length < 2 || name.length > 80 || !/^\+?[\d ()-]{7,25}$/.test(phone) || phone.replace(/\D/g, "").length < 7 || notes.length > 300) {
    throw new ApiError(400, "Introduce el nombre y teléfono del invitado. Las instrucciones pueden tener hasta 300 caracteres.");
  }
  return { name, phone, notes };
}
