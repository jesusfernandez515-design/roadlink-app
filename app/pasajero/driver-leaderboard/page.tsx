import { Suspense } from "react";
import SharedPage from "../../driver-leaderboard/page";
export default function Page() { return <Suspense fallback={<p role="status">Cargando RoadLink…</p>}><SharedPage /></Suspense>; }
