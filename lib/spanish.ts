const statuses: Record<string, string> = {
  active: "Activo", full: "Sin asientos", reserved: "Reservado",
  pending: "Pendiente", payment_pending: "Pago pendiente", unpaid: "Sin pagar",
  paid: "Pagado", confirmed: "Confirmado", completed: "Completado",
  cancelled: "Cancelado", rejected: "Rechazado", refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
};

export function statusInSpanish(value?: string) {
  return statuses[value || ""] || "Sin datos";
}

// Older rides stored these generated labels in English. Preserve their numbers.
export function estimateInSpanish(value?: string) {
  return (value || "No disponible")
    .replace(/\bmi estimated\b/g, "mi estimadas")
    .replace(/\bmin estimated\b/g, "min estimados");
}

const notificationText: Record<string, string> = {
  "New Ride Booking": "Nueva reserva de viaje",
  "A passenger reserved a seat.": "Un pasajero reservó un asiento.",
  "Booking cancelled": "Reserva cancelada",
  "A passenger cancelled a booking.": "Un pasajero canceló una reserva.",
  "Ride Completed": "Viaje completado",
  "Ride Cancelled": "Viaje cancelado",
  "Rate Your Driver": "Califica al conductor",
  "Payout Update": "Actualización de retiros",
  "Support Ticket Created": "Solicitud de soporte creada",
  "Emergency Alert Sent": "Alerta de emergencia enviada",
};

// Translate known system copy only; user messages and route names stay intact.
export function notificationInSpanish(value: string) {
  if (notificationText[value]) return notificationText[value];
  const cancellation = value.match(/^([^\s]+@[^\s]+) cancelled a booking\.$/);
  if (cancellation) return `${cancellation[1]} canceló una reserva.`;
  return value;
}
