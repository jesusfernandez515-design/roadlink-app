"use client";

export type GuestChoice = { travelFor: "self" | "guest"; guest: { name: string; phone: string; notes: string }; guestConsent: boolean };
export const emptyGuestChoice: GuestChoice = { travelFor: "self", guest: { name: "", phone: "", notes: "" }, guestConsent: false };
export function GuestPassengerForm({ value, onChange }: { value: GuestChoice; onChange: (value: GuestChoice) => void }) {
  const edit = (key: keyof GuestChoice["guest"], text: string) => onChange({ ...value, guest: { ...value.guest, [key]: text } });
  return <fieldset style={{ border: "1px solid #64748b", borderRadius: 16, padding: 18, margin: "18px 0" }}>
    <legend>¿Quién viajará?</legend>
    <label><input type="radio" name="travel-for" checked={value.travelFor === "self"} onChange={() => onChange({ ...value, travelFor: "self" })} /> Yo</label>{" "}
    <label><input type="radio" name="travel-for" checked={value.travelFor === "guest"} onChange={() => onChange({ ...value, travelFor: "guest" })} /> Otra persona / invitado</label>
    {value.travelFor === "guest" && <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      <p>Tú reservas, pagas y coordinas desde tu cuenta. El conductor verá a quién debe recoger; el invitado no necesita una cuenta.</p>
      <label>Nombre del invitado<input required maxLength={80} autoComplete="off" value={value.guest.name} onChange={e => edit("name", e.target.value)} /></label>
      <label>Teléfono del invitado<input required type="tel" maxLength={25} autoComplete="off" value={value.guest.phone} onChange={e => edit("phone", e.target.value)} /></label>
      <label>Instrucciones para recogerlo<textarea maxLength={300} value={value.guest.notes} onChange={e => edit("notes", e.target.value)} placeholder="Por ejemplo: preguntar por María en la entrada." /></label>
      <label><input type="checkbox" checked={value.guestConsent} onChange={e => onChange({ ...value, guestConsent: e.target.checked })} /> Tengo permiso para compartir sus datos con el conductor de este viaje.</label>
    </div>}
  </fieldset>;
}
export function GuestPassengerSummary({ guest }: { guest?: { name?: string; phone?: string; notes?: string } | null }) {
  if (!guest) return null;
  return <aside style={{ border: "1px solid #b4975a", borderRadius: 12, padding: 12, margin: "12px 0" }}>
    <strong>Viaje para invitado: {guest.name}</strong>
    <p>Recoger a esta persona. La cuenta que hizo la reserva paga y coordina.</p>
    {guest.phone && <p>Contacto del invitado: <a href={`tel:${guest.phone.replace(/[^+\d]/g, "")}`}>{guest.phone}</a></p>}
    {guest.notes && <p>{guest.notes}</p>}
  </aside>;
}
