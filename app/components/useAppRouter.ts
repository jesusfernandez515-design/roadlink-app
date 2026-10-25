"use client";
import { useMemo } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { useAppExperience } from "./AppExperience";
import { appPath } from "../../lib/app-experience";

export function useAppRouter() {
  const router = useNextRouter();
  const mode = useAppExperience();
  return useMemo(() => ({ ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(appPath(href, mode), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(appPath(href, mode), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(appPath(href, mode), options),
  }), [router, mode]);
}
