import type { ReactNode } from "react";
import { notFound } from "next/navigation";

// The test benches (/lab, /lab/figure, /lab/scan) are for development only: on the live
// site they answer 404 (owner, 2026-10-05).
export default function LabLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
