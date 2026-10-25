"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { experienceFromPath, appPath, type AppExperience } from "../../lib/app-experience";

const ExperienceContext = createContext<AppExperience | null>(null);
export const useAppExperience = () => useContext(ExperienceContext);

export default function AppExperienceProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const explicit = experienceFromPath(path);
  const [saved, setSaved] = useState<AppExperience | null>(null);
  const mode = explicit || saved;
  useEffect(() => {
    if (explicit) {
      setSaved(explicit);
      try { sessionStorage.setItem("roadlink-app", explicit); } catch { /* Navigation still works when storage is disabled. */ }
    } else {
      try {
        const value = sessionStorage.getItem("roadlink-app");
        if (value === "driver" || value === "passenger") setSaved(value);
      } catch { /* Keep the shared experience. */ }
    }
  }, [explicit]);
  useEffect(() => {
    if (!mode) return;
    const next = appPath(path + window.location.search + window.location.hash, mode);
    if (next !== path + window.location.search + window.location.hash) router.replace(next);
  }, [mode, path, router]);
  return <ExperienceContext.Provider value={mode}>{children}</ExperienceContext.Provider>;
}
