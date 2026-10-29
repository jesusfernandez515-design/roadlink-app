export function pushPresentation(mode: "driver" | "passenger", kind: string) {
  const labels: Record<string, string> = {
    message: "Nuevo mensaje", instant_offer: "Nueva propuesta", payment: "Actualización de pago",
    push_test: "Prueba de notificaciones", instant_request: "Viaje de último minuto",
  };
  const appName = `RoadLink ${mode === "driver" ? "Conductor" : "Pasajero"}`;
  return {
    title: `${appName} · ${labels[kind] || "Actualización de reserva"}`,
    body: kind === "instant_request" ? "Alguien necesita viajar de inmediato. Abre la app para revisar la solicitud." : `Abre ${appName} para consultar la actualización de tu viaje.`,
    icon: mode === "driver" ? "/icons/roadlink-luxury-192.png" : "/icons/roadlink-passenger-v1-192.png",
  };
}

// Only known RoadLink app pages may be opened by foreground notifications.
export function foregroundNotice(payload: { messageId?: string; data?: { kind?: string }; fcmOptions?: { link?: string } }) {
  try {
    const url = new URL(payload.fcmOptions?.link || "");
    if (url.origin !== "https://www.getroadlink.com" || url.search || url.hash || url.username || url.password ||
        !/^\/(conductor|pasajero)\/(messages|my-rides|my-bookings|ride-now)$/.test(url.pathname)) return null;
    const presentation = pushPresentation(url.pathname.startsWith("/conductor/") ? "driver" : "passenger", payload.data?.kind || "booking");
    return { title: presentation.title, options: {
      body: presentation.body,
      icon: presentation.icon,
      tag: `roadlink-${payload.messageId || url.pathname}`,
      data: { roadlinkUrl: url.href },
    } };
  } catch { return null; }
}
