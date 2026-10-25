import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const productionConfig = {
  apiKey: "AIzaSyCQLennITSj2mPM7aGTi1Mdn6c7BuABmpk",
  authDomain: "roadlink-7646d.firebaseapp.com",
  projectId: "roadlink-7646d",
  storageBucket: "roadlink-7646d.firebasestorage.app",
  messagingSenderId: "792896559055",
  appId: "1:792896559055:web:6e23dfed23f2d6eae3a4ba",
  measurementId: "G-S18LV1TNB4",
};

// NEXT_PUBLIC values are embedded at build time. Set this only for test builds.
const environment = process.env.NEXT_PUBLIC_ROADLINK_ENV || "production";
if (environment !== "production" && environment !== "test") {
  throw new Error("NEXT_PUBLIC_ROADLINK_ENV must be production or test.");
}

const testConfig = {
  apiKey: "AIzaSyC2TM9Wjpg68oVsN1GlQeav5eiagPevG_c",
  authDomain: "roadlink-pruebas.firebaseapp.com",
  projectId: "roadlink-pruebas",
  storageBucket: "roadlink-pruebas.firebasestorage.app",
  messagingSenderId: "993730173251",
  appId: "1:993730173251:web:b0464b9a8d90d49ce9b7f6",
};

const firebaseConfig = environment === "test" ? testConfig : productionConfig;
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
if (app.options.projectId !== firebaseConfig.projectId) {
  throw new Error("Firebase environment changed. Restart the app before continuing.");
}

export const auth = getAuth(app);
// The isolated test project uses a named database, not Firestore's (default).
export const db = environment === "test" ? getFirestore(app, "default") : getFirestore(app);
export const storage = getStorage(app);

export default app;
