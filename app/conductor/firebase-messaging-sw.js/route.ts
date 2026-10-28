export async function GET() {
  if (process.env.NEXT_PUBLIC_ROADLINK_ENV !== "test") return new Response("Push unavailable", { status: 503 });
  const config = { apiKey: "AIzaSyC2TM9Wjpg68oVsN1GlQeav5eiagPevG_c", authDomain: "roadlink-pruebas.firebaseapp.com",
    projectId: "roadlink-pruebas", messagingSenderId: "993730173251", appId: "1:993730173251:web:b0464b9a8d90d49ce9b7f6" };
  // Notification messages are displayed by FCM. No custom second display, token logging or page cache.
  const script = `importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");
firebase.initializeApp(${JSON.stringify(config)});
firebase.messaging();`;
  return new Response(script, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache", "Service-Worker-Allowed": "/conductor/" } });
}
