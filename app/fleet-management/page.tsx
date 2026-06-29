"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type FleetVehicle = {
  id: string;
  ownerId?: string;
  ownerEmail?: string;
  name?: string;
  make?: string;
  model?: string;
  year?: string;
  plate?: string;
  vin?: string;
  driverName?: string;
  driverEmail?: string;
  status?: string;
  mileage?: number;
  fuelCost?: number;
  insuranceStatus?: string;
  licenseStatus?: string;
  nextMaintenanceMiles?: number;
  createdAt?: string;
};

type MaintenanceRecord = {
  id: string;
  ownerId?: string;
  vehicleId?: string;
  vehicleName?: string;
  serviceType?: string;
  cost?: number;
  mileage?: number;
  status?: string;
  notes?: string;
  createdAt?: string;
};

export default function FleetManagementPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [status, setStatus] = useState("Loading fleet management...");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [mileage, setMileage] = useState("");
  const [fuelCost, setFuelCost] = useState("");
  const [nextMaintenanceMiles, setNextMaintenanceMiles] = useState("");

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [serviceMileage, setServiceMileage] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email || "");
      setStatus("");
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const unsubscribeVehicles = onSnapshot(
      query(collection(db, "fleetVehicles"), where("ownerId", "==", userId)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as FleetVehicle[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setVehicles(data);
      },
      (error) => setStatus(error.message)
    );

    const unsubscribeMaintenance = onSnapshot(
      query(collection(db, "fleetMaintenance"), where("ownerId", "==", userId)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as MaintenanceRecord[];

        data.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );

        setMaintenance(data);
      },
      (error) => setStatus(error.message)
    );

    return () => {
      unsubscribeVehicles();
      unsubscribeMaintenance();
    };
  }, [userId]);

  const stats = useMemo(() => {
    const active = vehicles.filter((item) => item.status === "active").length;
    const maintenanceDue = vehicles.filter((item) => {
      const current = Number(item.mileage || 0);
      const next = Number(item.nextMaintenanceMiles || 0);
      return next > 0 && current >= next;
    }).length;

    const totalMiles = vehicles.reduce(
      (total, item) => total + Number(item.mileage || 0),
      0
    );

    const fuel = vehicles.reduce(
      (total, item) => total + Number(item.fuelCost || 0),
      0
    );

    const maintenanceCost = maintenance.reduce(
      (total, item) => total + Number(item.cost || 0),
      0
    );

    return {
      total: vehicles.length,
      active,
      maintenanceDue,
      totalMiles,
      fuel,
      maintenanceCost,
      totalCost: fuel + maintenanceCost,
    };
  }, [vehicles, maintenance]);

  function money(value?: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  async function addVehicle() {
    if (!userId) return;

    if (!name.trim() && !plate.trim()) {
      setStatus("Vehicle name or plate is required.");
      return;
    }

    try {
      setSaving(true);
      setStatus("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "fleetVehicles"), {
        ownerId: userId,
        ownerEmail: userEmail,
        name: name.trim(),
        make: make.trim(),
        model: model.trim(),
        year: year.trim(),
        plate: plate.trim(),
        vin: vin.trim(),
        driverName: driverName.trim(),
        driverEmail: driverEmail.trim(),
        mileage: Number(mileage || 0),
        fuelCost: Number(fuelCost || 0),
        nextMaintenanceMiles: Number(nextMaintenanceMiles || 0),
        insuranceStatus: "valid",
        licenseStatus: "valid",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId,
        type: "fleet",
        title: "Fleet Vehicle Added",
        message: `${name || plate} was added to your RoadLink fleet.`,
        read: false,
        createdAt: now,
        actionUrl: "/fleet-management",
      });

      setName("");
      setMake("");
      setModel("");
      setYear("");
      setPlate("");
      setVin("");
      setDriverName("");
      setDriverEmail("");
      setMileage("");
      setFuelCost("");
      setNextMaintenanceMiles("");
      setStatus("Vehicle added successfully.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not add vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function addMaintenanceRecord() {
    if (!userId) return;

    if (!selectedVehicleId) {
      setStatus("Select a vehicle first.");
      return;
    }

    if (!serviceType.trim()) {
      setStatus("Service type is required.");
      return;
    }

    const vehicle = vehicles.find((item) => item.id === selectedVehicleId);

    try {
      setSaving(true);
      setStatus("");

      const now = new Date().toISOString();

      await addDoc(collection(db, "fleetMaintenance"), {
        ownerId: userId,
        ownerEmail: userEmail,
        vehicleId: selectedVehicleId,
        vehicleName: vehicle?.name || vehicle?.plate || "Fleet Vehicle",
        serviceType: serviceType.trim(),
        cost: Number(serviceCost || 0),
        mileage: Number(serviceMileage || 0),
        status: "completed",
        notes: notes.trim(),
        createdAt: now,
        updatedAt: now,
      });

      await addDoc(collection(db, "notifications"), {
        userId,
        type: "fleet",
        title: "Maintenance Logged",
        message: `${serviceType} was logged for ${vehicle?.name || vehicle?.plate || "vehicle"}.`,
        read: false,
        createdAt: now,
        actionUrl: "/fleet-management",
      });

      setSelectedVehicleId("");
      setServiceType("");
      setServiceCost("");
      setServiceMileage("");
      setNotes("");
      setStatus("Maintenance record added.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not add maintenance record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="container">
        <div className="topBar">
          <Link href="/dashboard" className="navButton">← Dashboard</Link>
          <Link href="/business" className="navButton">Business</Link>
          <Link href="/analytics-center" className="navButton">Analytics</Link>
          <Link href="/trip-history" className="navButton">Trip History</Link>
        </div>

        <section className="hero">
          <div>
            <p className="eyebrow">RoadLink Enterprise Operations</p>
            <h1>Fleet <span>Management</span></h1>
            <p className="subtitle">
              Manage vehicles, assigned drivers, mileage, fuel costs, maintenance,
              insurance status and fleet operating expenses.
            </p>
          </div>

          <div className="fleetOrb">
            <strong>🚗</strong>
            <span>{stats.total} Vehicles</span>
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="stats">
          <Metric icon="🚗" label="Vehicles" value={String(stats.total)} />
          <Metric icon="🟢" label="Active" value={String(stats.active)} />
          <Metric icon="🔧" label="Maintenance Due" value={String(stats.maintenanceDue)} />
          <Metric icon="🛣️" label="Fleet Miles" value={`${stats.totalMiles.toFixed(1)} mi`} />
          <Metric icon="⛽" label="Fuel Costs" value={money(stats.fuel)} />
          <Metric icon="🧾" label="Maintenance Costs" value={money(stats.maintenanceCost)} />
          <Metric icon="💰" label="Total Costs" value={money(stats.totalCost)} />
          <Metric icon="📄" label="Records" value={String(maintenance.length)} />
        </section>

        <section className="grid">
          <section className="panel">
            <p className="eyebrow">Vehicle Registration</p>
            <h2>Add Fleet Vehicle</h2>

            <label>Vehicle Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Unit 01, Van A, Company SUV..." />

            <label>Make</label>
            <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota, Ford, Nissan..." />

            <label>Model</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Sienna, Transit, Altima..." />

            <label>Year</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" inputMode="numeric" />

            <label>Plate</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="Plate number" />

            <label>VIN</label>
            <input value={vin} onChange={(e) => setVin(e.target.value)} placeholder="VIN number" />

            <label>Assigned Driver</label>
            <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver name" />

            <label>Driver Email</label>
            <input value={driverEmail} onChange={(e) => setDriverEmail(e.target.value)} placeholder="driver@email.com" />

            <label>Current Mileage</label>
            <input value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="Mileage" inputMode="decimal" />

            <label>Fuel Cost</label>
            <input value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} placeholder="Fuel cost" inputMode="decimal" />

            <label>Next Maintenance Miles</label>
            <input value={nextMaintenanceMiles} onChange={(e) => setNextMaintenanceMiles(e.target.value)} placeholder="Next maintenance mileage" inputMode="decimal" />

            <button onClick={addVehicle} disabled={saving}>
              {saving ? "Saving..." : "Add Vehicle"}
            </button>
          </section>

          <section className="panel">
            <p className="eyebrow">Maintenance</p>
            <h2>Log Maintenance</h2>

            <label>Vehicle</label>
            <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)}>
              <option value="">Select vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name || vehicle.plate || vehicle.id}
                </option>
              ))}
            </select>

            <label>Service Type</label>
            <input value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="Oil change, tires, brakes..." />

            <label>Service Cost</label>
            <input value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} placeholder="Cost" inputMode="decimal" />

            <label>Service Mileage</label>
            <input value={serviceMileage} onChange={(e) => setServiceMileage(e.target.value)} placeholder="Mileage at service" inputMode="decimal" />

            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Maintenance notes..." />

            <button onClick={addMaintenanceRecord} disabled={saving || vehicles.length === 0}>
              {saving ? "Saving..." : "Log Maintenance"}
            </button>

            <div className="summaryBox">
              <strong>Preventive Maintenance</strong>
              <p>
                Vehicles with mileage greater than or equal to next maintenance miles
                will be counted as maintenance due.
              </p>
            </div>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Fleet Vehicles</p>
          <h2>Vehicle Overview</h2>

          {vehicles.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🚗</div>
              <h3>No vehicles yet</h3>
              <p>Add your first vehicle to begin managing your RoadLink fleet.</p>
            </div>
          ) : (
            <div className="vehicleList">
              {vehicles.map((vehicle) => {
                const maintenanceDue =
                  Number(vehicle.nextMaintenanceMiles || 0) > 0 &&
                  Number(vehicle.mileage || 0) >= Number(vehicle.nextMaintenanceMiles || 0);

                return (
                  <article key={vehicle.id} className={maintenanceDue ? "vehicleCard due" : "vehicleCard"}>
                    <div className="vehicleIcon">🚗</div>

                    <div>
                      <div className="vehicleTop">
                        <div>
                          <h3>{vehicle.name || `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`}</h3>
                          <p>{vehicle.plate || "No plate"} · {vehicle.vin || "No VIN"}</p>
                        </div>

                        <span className={maintenanceDue ? "duePill" : "okPill"}>
                          {maintenanceDue ? "Maintenance Due" : vehicle.status || "active"}
                        </span>
                      </div>

                      <div className="infoGrid">
                        <Info label="Driver" value={vehicle.driverName || "Not assigned"} />
                        <Info label="Driver Email" value={vehicle.driverEmail || "Not assigned"} />
                        <Info label="Mileage" value={`${Number(vehicle.mileage || 0).toFixed(1)} mi`} />
                        <Info label="Fuel Cost" value={money(vehicle.fuelCost)} />
                        <Info label="Insurance" value={vehicle.insuranceStatus || "valid"} />
                        <Info label="License" value={vehicle.licenseStatus || "valid"} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Maintenance History</p>
          <h2>Service Records</h2>

          {maintenance.length === 0 ? (
            <div className="empty">
              <div className="emptyIcon">🔧</div>
              <h3>No maintenance records</h3>
              <p>Maintenance records will appear here.</p>
            </div>
          ) : (
            <div className="maintenanceList">
              {maintenance.map((record) => (
                <article key={record.id} className="maintenanceCard">
                  <div className="vehicleIcon">🔧</div>

                  <div>
                    <div className="vehicleTop">
                      <div>
                        <h3>{record.serviceType || "Maintenance"}</h3>
                        <p>{record.vehicleName || "Fleet Vehicle"} · {record.status || "completed"}</p>
                      </div>

                      <strong>{money(record.cost)}</strong>
                    </div>

                    <div className="meta">
                      <span>{Number(record.mileage || 0).toFixed(1)} mi</span>
                      <span>{record.createdAt ? new Date(record.createdAt).toLocaleString() : "Recently"}</span>
                      {record.notes && <span>{record.notes}</span>}
                    </div>
                  </div>
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
            radial-gradient(circle at top right, rgba(34,197,94,0.25), transparent 35%),
            radial-gradient(circle at bottom left, rgba(59,130,246,0.14), transparent 35%),
            linear-gradient(135deg, #020617, #030712, #0f172a);
        }

        .container {
          max-width: 1180px;
          margin: auto;
        }

        .topBar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }

        .navButton {
          color: white;
          text-decoration: none;
          font-weight: 900;
          padding: 12px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .hero,
        .metric,
        .panel,
        .vehicleCard,
        .maintenanceCard,
        .summaryBox {
          background: rgba(8,13,25,0.9);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          backdrop-filter: blur(16px);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding: 35px;
          border-radius: 32px;
          margin-bottom: 20px;
        }

        .eyebrow {
          color: #22c55e;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 13px;
          margin: 0 0 10px;
        }

        h1 {
          margin: 0 0 16px;
          font-size: 60px;
          line-height: 1;
        }

        h1 span,
        h2,
        .metric strong,
        .vehicleTop strong {
          color: #22c55e;
        }

        .subtitle,
        .empty p,
        .summaryBox p,
        .vehicleTop p {
          color: #a1a1aa;
          max-width: 760px;
          line-height: 1.5;
          font-size: 18px;
          margin: 0;
        }

        .fleetOrb {
          min-width: 130px;
          height: 130px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          justify-content: center;
          align-items: center;
          flex-direction: column;
          text-align: center;
          padding: 14px;
        }

        .fleetOrb strong {
          font-size: 42px;
        }

        .fleetOrb span {
          color: #22c55e;
          font-weight: 900;
          font-size: 12px;
        }

        .status {
          text-align: center;
          color: #22c55e;
          font-weight: 900;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .metric {
          padding: 18px;
          border-radius: 22px;
        }

        .metricIcon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .metric span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .metric strong {
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .panel {
          border-radius: 30px;
          padding: 30px;
          margin-bottom: 20px;
        }

        label {
          display: block;
          font-weight: 900;
          margin: 14px 0 8px;
        }

        input,
        select,
        textarea {
          width: 100%;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 16px;
          outline: none;
          font-family: Arial, sans-serif;
        }

        textarea {
          min-height: 110px;
          resize: vertical;
        }

        option {
          color: black;
        }

        button {
          width: 100%;
          margin-top: 18px;
          padding: 16px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .summaryBox {
          box-shadow: none;
          border-radius: 20px;
          padding: 18px;
          margin-top: 18px;
          background: rgba(34,197,94,0.08);
          border-color: rgba(34,197,94,0.28);
        }

        .summaryBox strong {
          color: #22c55e;
        }

        .vehicleList,
        .maintenanceList {
          display: grid;
          gap: 14px;
        }

        .vehicleCard,
        .maintenanceCard {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 14px;
          padding: 18px;
          border-radius: 22px;
          box-shadow: none;
        }

        .vehicleCard.due {
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.08);
        }

        .vehicleIcon {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(34,197,94,0.13);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
        }

        .vehicleTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .vehicleTop h3 {
          margin: 0 0 5px;
          font-size: 20px;
          overflow-wrap: anywhere;
        }

        .okPill,
        .duePill {
          padding: 8px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          text-transform: capitalize;
        }

        .okPill {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: #22c55e;
        }

        .duePill {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
          color: #fca5a5;
        }

        .infoGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .info {
          padding: 13px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .info span {
          display: block;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .info strong {
          display: block;
          color: white;
          overflow-wrap: anywhere;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .meta span {
          color: #d4d4d8;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 13px;
          font-weight: 900;
        }

        .empty {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .emptyIcon {
          width: 82px;
          height: 82px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          margin-bottom: 16px;
        }

        @media (max-width: 900px) {
          .hero,
          .grid,
          .vehicleTop {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: flex-start;
          }

          .stats,
          .infoGrid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 44px;
          }

          .vehicleCard,
          .maintenanceCard {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .page {
            padding: 16px;
            padding-bottom: 120px;
          }

          .hero,
          .panel {
            padding: 22px;
            border-radius: 26px;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; value: string; label: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
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
