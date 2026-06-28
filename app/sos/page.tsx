"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../lib/firebase";

type EmergencyType =
  | "medical"
  | "accident"
  | "harassment"
  | "robbery"
  | "breakdown"
  | "danger"
  | "other";

type Priority = "high" | "critical" | "life_threatening";

type EmergencyAlert = {
  id: string;
  userId?: string;
  userEmail?: string;
  emergencyType?: EmergencyType;
  priority?: Priority;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  note?: string;
  photoUrls?: string[];
  createdAt?: string;
};

type UserProfile = {
  name?: string;
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

const emergencyTypes: {
  key: EmergencyType;
  title: string;
  icon: string;
}[] = [
  { key: "medical", title: "Medical Emergency", icon: "🚑" },
  { key: "accident", title: "Car Accident", icon: "💥" },
  { key: "harassment", title: "Harassment", icon: "⚠️" },
  { key: "robbery", title: "Robbery", icon: "🚨" },
  { key: "breakdown", title: "Vehicle Breakdown", icon: "🔧" },
  { key: "danger", title: "Immediate Danger", icon: "🆘" },
  { key: "other", title: "Other", icon: "📍" },
];

export default function SOSPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [emergencyType, setEmergencyType] = useState<EmergencyType>("danger");
  const [priority, setPriority] = useState<Priority>("critical");
  const [note, setNote] = useState("");

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<EmergencyAlert[]>([]);

  const [message, setMessage] = useState("Loading SOS center...");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeAlerts: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("Please sign in to use SOS.");
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setMessage("");

      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email || "",
          online: true,
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      unsubscribeProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          setProfile((snapshot.data() as UserProfile) || null);
        },
        (error) => setMessage(error.message)
      );

      unsubscribeAlerts = onSnapshot(
        query(collection(db, "emergencyAlerts"), where("userId", "==", user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as EmergencyAlert[];

          data.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
          setRecentAlerts(data.slice(0, 6));
        },
        (error) => setMessage(error.message)
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeAlerts) unsubscribeAlerts();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [router]);

  const selectedEmergency = useMemo(() => {
    return emergencyTypes.find((item) => item.key === emergencyType) || emergencyTypes[0];
  }, [emergencyType]);

  const mapUrl =
    latitude !== null && longitude !== null
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : "";

  async function getLocation() {
    if (!navigator.geolocation) {
      setMessage("GPS is not available on this device.");
      return null;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
      setAccuracy(coords.accuracy);

      return coords;
    } catch {
      setMessage("GPS permission denied or unavailable. SOS can still be sent.");
      return null;
    }
  }

  async function uploadPhoto(file: File) {
    if (!userId) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please upload an image file.");
      return;
    }

    try {
      setUploading(true);
      setMessage("");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `sosUploads/${userId}/${Date.now()}_${safeName}`;
      const fileRef = ref(storage, filePath);

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      setPhotoUrls((previous) => [...previous, url]);
      setMessage("Photo attached to SOS report.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not upload photo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function startCountdown() {
    setCountdown(10);
    setMessage("SOS countdown started. You can cancel before it sends.");

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          sendSOS();
          return 0;
        }

        return current - 1;
      });
    }, 1000);
  }

  function cancelCountdown() {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCountdown(0);
    setMessage("SOS cancelled before sending.");
  }

  async function sendSOS() {
    if (!userId) {
      setMessage("Please sign in first.");
      return;
    }

    try {
      setSending(true);
      setCountdown(0);
      setMessage("");

      const location = await getLocation();
      const now = new Date().toISOString();

      const alertDoc = await addDoc(collection(db, "emergencyAlerts"), {
        userId,
        userEmail,
        userName: profile?.name || "",
        userPhone: profile?.phone || "",
        emergencyContactName: profile?.emergencyContactName || "",
        emergencyContactPhone: profile?.emergencyContactPhone || "",
        emergencyType,
        emergencyTitle: selectedEmergency.title,
        priority,
        status: "active",
        note: note.trim(),
        photoUrls,
        latitude: location?.latitude ?? latitude,
        longitude: location?.longitude ?? longitude,
        accuracy: location?.accuracy ?? accuracy,
        mapUrl:
          location?.latitude && location?.longitude
            ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
            : mapUrl,
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        type: "emergency",
        userId,
        title: "Emergency Alert Sent",
        message: `${selectedEmergency.title} SOS alert was submitted.`,
        read: false,
        createdAt: now,
        actionUrl: "/sos",
        emergencyAlertId: alertDoc.id,
      });

      await addDoc(collection(db, "activityLogs"), {
        type: "emergency",
        userId,
        userEmail,
        title: "Emergency Alert Sent",
        message: `${userEmail} sent a ${selectedEmergency.title} SOS alert.`,
        createdAt: now,
        actionUrl: "/admin-console",
      });

      setMessage("Emergency alert sent successfully.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Failed to send emergency alert.");
    } finally {
      setSending(false);
    }
  }

  async function closeAlert(alertId: string) {
    try {
      await updateDoc(doc(db, "emergencyAlerts", alertId), {
        status: "closed",
        closedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setMessage("SOS incident closed.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not close SOS incident.");
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topNav">
          <Link href="/dashboard" className="button">← Dashboard</Link>
          <Link href="/profile" className="button">Profile</Link>
          <Link href="/notifications" className="button">Notifications</Link>
          <Link href="/activity-feed" className="button">Activity</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Safety Center</p>
            <h1>Emergency <span>SOS</span></h1>
            <p className="subtitle">
              Send a critical RoadLink alert with GPS location, emergency type, priority level,
              photos and incident notes.
            </p>
          </div>

          <div className="heroIcon">🚨</div>
        </section>

        {message && <p className="message">{message}</p>}

        <section className="stats">
          <Metric icon="📍" label="GPS" value={latitude && longitude ? "Ready" : "Pending"} />
          <Metric icon="🚨" label="Priority" value={priority.replace("_", " ")} />
          <Metric icon="📷" label="Photos" value={String(photoUrls.length)} />
          <Metric icon="🧾" label="Incidents" value={String(recentAlerts.length)} />
        </section>

        <section className="mainGrid">
          <section className="card emergencyCard">
            <div className="bigIcon">{selectedEmergency.icon}</div>
            <h2>{selectedEmergency.title}</h2>
            <p>
              Choose the emergency type, attach details, then start the SOS countdown.
            </p>

            {countdown > 0 ? (
              <div className="countdownBox">
                <strong>{countdown}</strong>
                <span>Sending SOS...</span>
                <button className="cancelButton" onClick={cancelCountdown}>
                  Cancel SOS
                </button>
              </div>
            ) : (
              <button className="sosButton" onClick={startCountdown} disabled={sending}>
                {sending ? "Sending Alert..." : "START SOS COUNTDOWN"}
              </button>
            )}

            <a className="callButton" href="tel:911">
              📞 Call Emergency Services
            </a>
          </section>

          <section className="card">
            <p className="eyebrow">Incident Details</p>
            <h2>Report Information</h2>

            <label>Emergency Type</label>
            <div className="typeGrid">
              {emergencyTypes.map((item) => (
                <button
                  key={item.key}
                  className={emergencyType === item.key ? "typeButton activeType" : "typeButton"}
                  onClick={() => setEmergencyType(item.key)}
                >
                  <span>{item.icon}</span>
                  <strong>{item.title}</strong>
                </button>
              ))}
            </div>

            <label>Priority Level</label>
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              <option value="high">High</option>
              <option value="critical">Critical</option>
              <option value="life_threatening">Life Threatening</option>
            </select>

            <label>Incident Notes</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Describe what is happening..."
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadPhoto(file);
              }}
            />

            <button className="uploadButton" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading..." : "📷 Attach Photo"}
            </button>
          </section>
        </section>

        <section className="card">
          <p className="eyebrow">Location</p>
          <h2>GPS Coordinates</h2>

          <div className="locationGrid">
            <Info label="Latitude" value={latitude !== null ? String(latitude) : "Not captured"} />
            <Info label="Longitude" value={longitude !== null ? String(longitude) : "Not captured"} />
            <Info label="Accuracy" value={accuracy !== null ? `${Math.round(accuracy)} meters` : "Unknown"} />
          </div>

          <button className="locationButton" onClick={getLocation}>
            Refresh GPS Location
          </button>

          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="mapButton">
              Open Location in Google Maps
            </a>
          )}
        </section>

        <section className="card">
          <p className="eyebrow">SOS History</p>
          <h2>Recent Incidents</h2>

          {recentAlerts.length === 0 ? (
            <div className="empty">
              <h3>No SOS alerts yet</h3>
              <p>Your emergency alert history will appear here.</p>
            </div>
          ) : (
            <div className="alertList">
              {recentAlerts.map((alert) => (
                <article key={alert.id} className="alertCard">
                  <div>
                    <strong>{alert.emergencyType || "Emergency"} · {alert.priority || "critical"}</strong>
                    <p>Status: {alert.status || "active"}</p>
                    <small>{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "Recently"}</small>
                  </div>

                  <button onClick={() => closeAlert(alert.id)} disabled={alert.status === "closed"}>
                    {alert.status === "closed" ? "Closed" : "Close"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          padding: 24px;
          padding-bottom: 120px;
          color: white;
          font-family: Arial, sans-serif;
          background:
            radial-gradient(circle at top right, rgba(239,68,68,0.30), transparent 34%),
            radial-gradient(circle at bottom left, rgba(34,197,94,0.12), transparent 34%),
            linear-gradient(135deg,#020617,#030712,#0f172a);
        }

        .container {
          max-width: 1100px;
          margin: auto;
        }

        .topNav {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .button,
        .callButton,
        .mapButton {
          text-decoration: none;
          color: white;
          padding: 12px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          font-weight: 900;
          display: inline-flex;
          justify-content: center;
        }

        .hero,
        .card,
        .metric {
          background: rgba(8,13,25,.92);
          border: 1px solid rgba(255,255,255,.1);
          box-shadow: 0 24px 80px rgba(0,0,0,.5);
          backdrop-filter: blur(16px);
        }

        .hero {
          padding: 34px;
          border-radius: 32px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
          align-items: center;
        }

        .eyebrow {
          color: #ef4444;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin: 0 0 10px;
        }

        h1 {
          font-size: 58px;
          margin: 0 0 16px;
          line-height: 1;
        }

        h1 span {
          color: #ef4444;
        }

        h2 {
          color: #ef4444;
          margin-top: 0;
        }

        .subtitle,
        .card p,
        .empty p {
          color: #a1a1aa;
          line-height: 1.5;
        }

        .heroIcon {
          font-size: 64px;
        }

        .message {
          color: #22c55e;
          font-weight: 900;
          text-align: center;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .metric {
          border-radius: 22px;
          padding: 18px;
        }

        .metricIcon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .metricLabel {
          color: #a1a1aa;
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .metricValue {
          color: #ef4444;
          font-size: 22px;
          font-weight: 900;
          text-transform: capitalize;
        }

        .mainGrid {
          display: grid;
          grid-template-columns: .85fr 1.15fr;
          gap: 20px;
        }

        .card {
          border-radius: 30px;
          padding: 30px;
          margin-bottom: 20px;
        }

        .emergencyCard {
          text-align: center;
        }

        .bigIcon {
          font-size: 86px;
          margin-bottom: 12px;
        }

        .sosButton,
        .cancelButton,
        .uploadButton,
        .locationButton,
        .alertCard button {
          width: 100%;
          margin-top: 16px;
          padding: 18px;
          border: none;
          border-radius: 999px;
          font-weight: 900;
          color: white;
          cursor: pointer;
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        .callButton,
        .mapButton {
          width: 100%;
          margin-top: 12px;
          border-color: rgba(239,68,68,.35);
          background: rgba(239,68,68,.12);
        }

        .cancelButton {
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
        }

        .uploadButton,
        .locationButton {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .countdownBox {
          margin-top: 18px;
          padding: 22px;
          border-radius: 24px;
          background: rgba(239,68,68,.13);
          border: 1px solid rgba(239,68,68,.35);
        }

        .countdownBox strong {
          display: block;
          font-size: 72px;
          color: #ef4444;
          line-height: 1;
        }

        .countdownBox span {
          color: #fecaca;
          font-weight: 900;
        }

        label {
          display: block;
          font-weight: 900;
          margin: 16px 0 8px;
        }

        .typeGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .typeButton {
          border-radius: 18px;
          padding: 14px;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.04);
          color: white;
          text-align: left;
          cursor: pointer;
        }

        .activeType {
          border-color: rgba(239,68,68,.5);
          background: rgba(239,68,68,.13);
        }

        .typeButton span {
          display: block;
          font-size: 24px;
          margin-bottom: 6px;
        }

        select,
        textarea {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.05);
          color: white;
          font-size: 16px;
          outline: none;
          font-family: Arial, sans-serif;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
        }

        option {
          color: black;
        }

        .hidden {
          display: none;
        }

        .locationGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .info {
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.09);
        }

        .info span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .info strong {
          overflow-wrap: anywhere;
        }

        .alertList {
          display: grid;
          gap: 12px;
        }

        .alertCard {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border-radius: 20px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.09);
        }

        .alertCard strong {
          color: #ef4444;
          text-transform: capitalize;
        }

        .alertCard p,
        .alertCard small {
          color: #a1a1aa;
          margin: 0;
        }

        .alertCard button {
          width: auto;
          margin: 0;
          padding: 12px 16px;
        }

        .empty {
          padding: 20px;
          border-radius: 20px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.09);
        }

        @media(max-width:900px) {
          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          h1 {
            font-size: 42px;
          }

          .stats,
          .mainGrid,
          .locationGrid,
          .typeGrid {
            grid-template-columns: 1fr;
          }

          .alertCard {
            grid-template-columns: 1fr;
          }
        }

        @media(max-width:600px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .card {
            padding: 22px;
            border-radius: 26px;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span className="metricLabel">{label}</span>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
            }
