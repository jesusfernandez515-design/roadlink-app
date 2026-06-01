import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCQLennITSj2mPM7aGTi1Mdn6c7BuABmpk",
  authDomain: "roadlink-7646d.firebaseapp.com",
  projectId: "roadlink-7646d",
  storageBucket: "roadlink-7646d.firebasestorage.app",
  messagingSenderId: "792896559055",
  appId: "1:792896559055:web:6e23dfed23f2d6eae3a4ba",
  measurementId: "G-S18LV1TNB4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
