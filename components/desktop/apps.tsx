import type { ReactNode } from "react";
import type { AppId, Stage } from "@/lib/story/store";

export type AppDef = {
  id: AppId;
  title: string;
  /** Lowest stage at which the icon shows on the desktop; null = never an icon (opens by itself). */
  iconFrom: Stage | null;
  size: { w: number; h: number };
  glyph: ReactNode;
  /** Placeholder until the real app is built. */
  body: ReactNode;
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const g = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
    {d}
  </svg>
);

const placeholder = (text: string) => <p style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{text}</p>;

export const APPS: AppDef[] = [
  { id: "mail", title: "Mail", iconFrom: 1, size: { w: 620, h: 420 },
    glyph: g(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
    body: placeholder("mail · S2 — to be built") },
  { id: "photos", title: "Photos", iconFrom: 1, size: { w: 640, h: 460 },
    glyph: g(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" /></>),
    body: placeholder("photos · S3 — to be built") },
  { id: "messages", title: "Messages", iconFrom: 1, size: { w: 520, h: 460 },
    glyph: g(<path d="M4 5h16v11H9l-5 4z" />),
    body: placeholder("messages · S4 — to be built") },
  { id: "notes", title: "Notes", iconFrom: 1, size: { w: 460, h: 400 },
    glyph: g(<><path d="M6 3h9l3 3v15H6z" /><path d="M9 10h6M9 14h6M9 18h3" /></>),
    body: placeholder("notes · S5 — to be built") },
  { id: "history", title: "History", iconFrom: 1, size: { w: 560, h: 420 },
    glyph: g(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>),
    body: placeholder("browser history · S6 — to be built") },
  { id: "phone", title: "Phone", iconFrom: 1, size: { w: 420, h: 440 },
    glyph: g(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />),
    body: placeholder("phone · voicemail + unreliable transcript — to be built") },
  { id: "trash", title: "Trash", iconFrom: 1, size: { w: 480, h: 360 },
    glyph: g(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />),
    body: placeholder("trash — to be built") },
  { id: "backup", title: "backup_you", iconFrom: 2, size: { w: 480, h: 340 },
    glyph: g(<path d="M3 6h6l2 2h10v11H3z" />),
    body: placeholder("backup_you · S7 password — to be built") },
  { id: "camera", title: "Camera", iconFrom: null, size: { w: 320, h: 240 },
    glyph: g(<><rect x="3" y="6" width="14" height="12" rx="2" /><path d="m17 10 4-2v8l-4-2" /></>),
    body: placeholder("camera · opens by itself in stage 2 (REC) — to be built") },
];

export const APP = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<AppId, AppDef>;
