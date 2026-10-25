import { Suspense } from "react";
import SharedPage from "../../achievements/page";
export default function Page() { return <Suspense fallback={<p role="status">Cargando RoadLink…</p>}><SharedPage /></Suspense>; }
