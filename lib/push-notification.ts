// Only known RoadLink app pages may be opened by foreground notifications.
export function foregroundNotice(payload: { messageId?: string; fcmOptions?: { link?: string } }) {
  try {
    const url = new URL(payload.fcmOptions?.link || "");
    if (url.origin !== "https://www.getroadlink.com" || url.search || url.hash || url.username || url.password ||
        !/^\/(conductor|pasajero)\/(messages|my-rides|my-bookings|ride-now)$/.test(url.pathname)) return null;
    return { title: "RoadLink · Nueva notificación", options: {
      body: "Tienes una actualización de tu viaje. Pulsa para abrir RoadLink.",
      icon: url.pathname.startsWith("/conductor/") ? "/icons/roadlink-luxury-192.png" : "/icons/roadlink-passenger-v1-192.png",
      tag: `roadlink-${payload.messageId || url.pathname}`,
      data: { roadlinkUrl: url.href },
    } };
  } catch { return null; }
}
