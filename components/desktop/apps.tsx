import type { ReactNode } from "react";
import type { AppId, Stage } from "@/lib/story/store";
import Backup from "./views/Backup";
import Camera from "./views/Camera";
import { Invitation, Manual, Screenshot } from "./views/Docs";
import History from "./views/History";
import Mail from "./views/Mail";
import Messages from "./views/Messages";
import Notes from "./views/Notes";
import Phone from "./views/Phone";
import Photos from "./views/Photos";
import Locate from "./views/Locate";
import Session from "./views/Session";
import Trash from "./views/Trash";

export type AppDef = {
  id: AppId;
  title: string;
  /** Lowest stage at which the icon shows on the desktop; null = never an icon (opens by itself). */
  iconFrom: Stage | null;
  /** "file" = a loose file on the right of the desktop instead of an app in the left column. */
  place?: "file";
  size: { w: number; h: number };
  glyph: ReactNode;
  body: ReactNode;
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const g = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
    {d}
  </svg>
);

const doc = g(<><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v3h3" /></>);

export const APPS: AppDef[] = [
  { id: "mail", title: "Mail", iconFrom: 1, size: { w: 820, h: 560 },
    glyph: g(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
    body: <Mail /> },
  { id: "photos", title: "Photos", iconFrom: 1, size: { w: 680, h: 540 },
    glyph: g(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" /></>),
    body: <Photos /> },
  { id: "messages", title: "Messages", iconFrom: 1, size: { w: 700, h: 540 },
    glyph: g(<path d="M4 5h16v11H9l-5 4z" />),
    body: <Messages /> },
  { id: "notes", title: "Notes", iconFrom: 1, size: { w: 620, h: 420 },
    glyph: g(<><path d="M6 3h9l3 3v15H6z" /><path d="M9 10h6M9 14h6M9 18h3" /></>),
    body: <Notes /> },
  { id: "history", title: "History", iconFrom: 1, size: { w: 560, h: 420 },
    glyph: g(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>),
    body: <History /> },
  { id: "phone", title: "Phone", iconFrom: 1, size: { w: 620, h: 440 },
    glyph: g(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />),
    body: <Phone /> },
  { id: "trash", title: "Trash", iconFrom: 1, size: { w: 600, h: 380 },
    glyph: g(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />),
    body: <Trash /> },
  { id: "backup", title: "backup_you", iconFrom: 2, size: { w: 560, h: 360 },
    glyph: g(<path d="M3 6h6l2 2h10v11H3z" />),
    body: <Backup /> },
  { id: "invitation", title: "invitation.pdf", iconFrom: 1, place: "file", size: { w: 460, h: 480 },
    glyph: doc, body: <Invitation /> },
  { id: "manual", title: "operator_manual.pdf", iconFrom: 1, place: "file", size: { w: 560, h: 380 },
    glyph: doc, body: <Manual /> },
  { id: "screenshot", title: "Screenshot 23.02.png", iconFrom: 1, place: "file", size: { w: 520, h: 400 },
    glyph: g(<><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="M3 9h18" /></>), body: <Screenshot /> },
  { id: "camera", title: "Camera", iconFrom: null, size: { w: 320, h: 240 },
    glyph: g(<><rect x="3" y="6" width="14" height="12" rx="2" /><path d="m17 10 4-2v8l-4-2" /></>),
    body: <Camera /> },
  { id: "session", title: "session_0418.log", iconFrom: null, size: { w: 660, h: 330 },
    glyph: doc, body: <Session /> },
  { id: "locate", title: "Find My", iconFrom: null, size: { w: 820, h: 560 },
    glyph: g(<><circle cx="12" cy="10" r="3" /><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /></>),
    body: <Locate /> },
];

export const APP = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<AppId, AppDef>;
