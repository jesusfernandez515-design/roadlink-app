"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useAppExperience } from "./AppExperience";
import { appPath } from "../../lib/app-experience";

export default function AppLink({ href, ...props }: ComponentProps<typeof Link>) {
  const mode = useAppExperience();
  const destination = typeof href === "string" ? appPath(href, mode) : { ...href, pathname: href.pathname ? appPath(href.pathname, mode) : href.pathname };
  return <Link {...props} href={destination} />;
}
