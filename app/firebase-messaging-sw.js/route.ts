export async function GET() {
  if (process.env.NEXT_PUBLIC_ROADLINK_ENV !== "test") return new Response("Push unavailable", { status: 503 });
  const config = { apiKey: "AIzaSyC2TM9Wjpg68oVsN1GlQeav5eiagPevG_c", authDomain: "roadlink-pruebas.firebaseapp.com",
    projectId: "roadlink-pruebas", messagingSenderId: "993730173251", appId: "1:993730173251:web:b0464b9a8d90d49ce9b7f6" };
  // FCM displays background messages; this handler only opens foreground notices. No page cache.
  const script = `self.skipWaiting();
self.addEventListener("activate", event => event.waitUntil(clients.claim()));
self.addEventListener("notificationclick", event => {
  const target = event.notification.data && event.notification.data.roadlinkUrl;
  if (!target) return;
  try {
    const url = new URL(target);
    if (url.origin !== "https://www.getroadlink.com" || url.search || url.hash || !/^\\/(conductor|pasajero)\\/(messages|my-rides|my-bookings|ride-now)$/.test(url.pathname)) return;
    event.stopImmediatePropagation();
    event.notification.close();
    event.waitUntil(clients.openWindow(url.href));
  } catch {}
});
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");
firebase.initializeApp(${JSON.stringify(config)});
firebase.messaging();`;
  return new Response(script, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache", "Service-Worker-Allowed": "/" } });
}
