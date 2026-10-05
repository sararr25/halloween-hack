// The keepsake at the end: "case file 0418" (the player's own case, lib/story/caseno.ts), a one-page PDF made in the browser from the
// player's own session, in the project's look (ink background, grain, mono metadata, the
// serif of the mails, the PARALLAX V, E.V.'s badge, the Sign, one cyan). The page is drawn
// on a canvas and wrapped in a minimal PDF by hand: no library, no server, nothing sent.

import { pickFrames, type Frame } from "./frames";
import { clock, duration } from "./time";
import { caseId, EV_CASE, tomorrowCase } from "./caseno";

export type CaseFacts = {
  name: string;
  /** the player's case number along the chain */
  caseNo: number;
  openedAt: number;
  closedAt: number;
  camera: "granted" | "denied" | null;
  verifiedAt: number | null;
  figureMs: number | null;
  backupMs: number | null;
  wrongCodes: number;
  lookedAway: number;
  blinks: number;
  call: "answered" | "declined" | "missed" | null;
};

// A4 at 150 dpi
const W = 1240;
const H = 1754;
const INK = "#06080d";
const TEXT = "#d8dce5";
const MUTED = "#646b7a";
const ACCENT = "#eef0f4";
const NEON = "#00f0ff";

const cssFont = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "monospace";

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`case file: image missing ${src}`));
    img.src = src;
  });
}

/** Grain and faint scan lines over a whole page. */
function grain(x: CanvasRenderingContext2D) {
  const img = x.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = (Math.random() - 0.5) * 14;
    const line = Math.floor(i / 4 / W) % 3 === 0 ? -3 : 0;
    d[i] += g + line;
    d[i + 1] += g + line;
    d[i + 2] += g + line;
  }
  x.putImageData(img, 0, 0);
}

/** A frame as CCTV keeps it: grey, crushed, grain, a timestamp burned in. */
function cctv(x: CanvasRenderingContext2D, fr: HTMLCanvasElement | null, px: number, py: number, w: number, h: number, stamp: string, mono: string, missing: string) {
  x.fillStyle = "#0b0d12";
  x.fillRect(px, py, w, h);
  if (fr) {
    x.save();
    x.filter = "grayscale(1) contrast(1.35) brightness(0.85)";
    x.drawImage(fr, px, py, w, h);
    x.restore();
    const img = x.getImageData(px, py, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const row = Math.floor(i / 4 / w);
      const g = (Math.random() - 0.5) * 38 + (row % 2 ? -10 : 0);
      d[i] += g;
      d[i + 1] += g;
      d[i + 2] += g;
    }
    x.putImageData(img, px, py);
  } else {
    x.font = `20px ${mono}`;
    x.fillStyle = MUTED;
    x.fillText("frame unavailable", px + 24, py + h / 2);
    x.fillText(missing, px + 24, py + h / 2 + 30);
  }
  x.strokeStyle = "rgba(255,255,255,0.18)";
  x.lineWidth = 1.5;
  x.strokeRect(px, py, w, h);
  x.font = `18px ${mono}`;
  x.fillStyle = "#e8e8e8";
  x.fillText(stamp, px + 14, py + h - 16);
  x.fillStyle = "#ff3b30";
  x.beginPath();
  x.arc(px + w - 22, py + 22, 6, 0, Math.PI * 2);
  x.fill();
}

/** Page 2: the evidence. Six stills of the operator, then the case that comes next. */
async function drawEvidence(f: CaseFacts, shots: Frame[]): Promise<HTMLCanvasElement> {
  const missing = f.camera === "granted" ? "no frame kept" : "operator refused the camera";
  const mono = cssFont("--font-mono");
  const serif = cssFont("--font-serif");
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  if (!x) throw new Error("case file: no 2D context");
  x.fillStyle = INK;
  x.fillRect(0, 0, W, H);
  const L = 120;
  const t = (s: string, px: number, py: number, font: string, color: string, spacing = 0, maxWidth?: number) => {
    x.font = font;
    x.fillStyle = color;
    x.letterSpacing = `${spacing}px`;
    x.fillText(s, px, py, maxWidth);
    x.letterSpacing = "0px";
  };
  t("EVIDENCE", L, 170, `20px ${mono}`, MUTED, 6);
  t("The operator, as recorded", L, 260, `400 64px ${serif}`, TEXT);
  t(`case ${caseId(f.caseNo)} · ${shots.length || "no"} frames · 17 Harrow St · flat 4A · cam 2`, L, 310, `22px ${mono}`, NEON, 1);

  // a contact sheet, 3 x 2 (owner playtest: with 2 columns the third row ran into the text)
  const cols = 3;
  const gap = 30;
  const rowGap = 80;
  const fw = (W - 2 * L - (cols - 1) * gap) / cols;
  const fh = fw * 0.75;
  const top = 380;
  const slots = (shots.length ? shots : [null, null]).slice(0, 6);
  slots.forEach((fr, i) => {
    const px = L + (i % cols) * (fw + gap);
    const py = top + Math.floor(i / cols) * (fh + rowGap);
    const stamp = fr ? `CAM 2  ${clock(fr.at, true)}` : "CAM 2  --:--:--";
    cctv(x, fr?.canvas ?? null, px, py, fw, fh, stamp, mono, missing);
    t(fr ? fr.label : "no signal", px, py + fh + 32, `18px ${mono}`, MUTED, 1, fw);
  });

  // what comes next: nothing is closed. Placed under the last row of frames, never on them
  const rows = Math.ceil(slots.length / cols);
  const gridBottom = top + rows * (fh + rowGap) - rowGap + 32;
  const by = gridBottom + 150;
  x.fillStyle = "rgba(255,255,255,0.1)";
  x.fillRect(L, by - 60, W - 2 * L, 1.5);
  const tomorrow = new Date(f.openedAt + 86_400_000).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  t("NEXT", L, by, `20px ${mono}`, MUTED, 6);
  t(`case ${caseId(tomorrowCase(f.caseNo))} · operator: ${f.name}`, L, by + 56, `28px ${mono}`, TEXT, 1);
  t(`session scheduled · ${tomorrow} · ${clock(f.openedAt)}`, L, by + 100, `28px ${mono}`, NEON, 1);
  t("“You came in at the same minute as the last one.”", L, by + 190, `italic 400 34px ${serif}`, TEXT);
  grain(x);
  return c;
}

async function draw(f: CaseFacts): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const [v, ev, sign] = await Promise.all([load("/parallax.webp"), load("/avatars/ev.webp"), load("/sign.png")]);
  const mono = cssFont("--font-mono");
  const sans = cssFont("--font-sans");
  const serif = cssFont("--font-serif");
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  if (!x) throw new Error("case file: no 2D context");

  // the desk: blue-black, a faint light from the top
  x.fillStyle = INK;
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W * 0.5, -200, 100, W * 0.5, 200, W);
  glow.addColorStop(0, "rgba(138,150,179,0.14)");
  glow.addColorStop(1, "rgba(6,8,13,0)");
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);

  // the Sign, large and faint, like a watermark
  x.globalAlpha = 0.07;
  x.drawImage(sign, W - 640, H - 820, 720, 720);
  x.globalAlpha = 1;

  // viewfinder corners, the one cyan of the page
  x.strokeStyle = NEON;
  x.lineWidth = 2;
  const m = 44;
  const k = 46;
  for (const [cx, cy, dx, dy] of [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ]) {
    x.beginPath();
    x.moveTo(cx, cy + dy * k);
    x.lineTo(cx, cy);
    x.lineTo(cx + dx * k, cy);
    x.stroke();
  }

  const L = 120; // left margin
  const text = (s: string, px: number, py: number, font: string, color: string, spacing = 0) => {
    x.font = font;
    x.fillStyle = color;
    x.letterSpacing = `${spacing}px`;
    x.fillText(s, px, py);
    x.letterSpacing = "0px";
  };
  const right = (s: string, px: number, py: number, font: string, color: string, spacing = 0) => {
    x.font = font;
    x.letterSpacing = `${spacing}px`;
    const w = x.measureText(s).width;
    text(s, px - w, py, font, color, spacing);
  };

  // header: the company that arranged it, and the case
  x.drawImage(v, L - 10, 104, 110, 110);
  text("PARALLAX", L + 118, 152, `500 26px ${mono}`, ACCENT, 8);
  text("private experiences", L + 118, 186, `20px ${mono}`, MUTED, 1);
  right("RECOVERY/4", W - L, 150, `22px ${mono}`, MUTED, 4);
  right(`CASE ${caseId(f.caseNo)} · OPEN`, W - L, 186, `22px ${mono}`, NEON, 4);
  x.fillStyle = "rgba(255,255,255,0.1)";
  x.fillRect(L, 250, W - 2 * L, 1.5);

  // title, in her world's serif
  text(`Case file ${caseId(f.caseNo)}`, L, 380, `400 92px ${serif}`, TEXT);
  text(`operator · ${f.name}`, L, 440, `26px ${mono}`, ACCENT, 1);
  const date = new Date(f.closedAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  text(date, L, 480, `22px ${mono}`, MUTED, 1);

  // the session, as the system kept it
  text("SESSION", L, 600, `20px ${mono}`, MUTED, 6);
  const verify =
    f.camera === "granted"
      ? `granted ${f.verifiedAt ? clock(f.verifiedAt, true) : ""} · operator mapped`
      : `refused ${f.verifiedAt ? clock(f.verifiedAt, true) : ""} · operator reconstructed`;
  const call = {
    answered: "answered · the operator spoke",
    declined: "declined",
    missed: "let it ring",
  } as const;
  const rows: [string, string][] = [
    ["opened", clock(f.openedAt, true)],
    ["verification", verify],
    ["the street", f.figureMs != null ? `figure found after ${duration(f.figureMs)}` : "not found"],
    ["backup_you", f.backupMs != null ? `opened after ${duration(f.backupMs)}${f.wrongCodes ? ` · ${f.wrongCodes} wrong` : ""}` : "closed"],
    ["looked away", `${f.lookedAway} ${f.lookedAway === 1 ? "time" : "times"}`],
    ["eyes closed", `${f.blinks} ${f.blinks === 1 ? "time" : "times"} · each one noticed`],
    ["Mara called", f.call ? call[f.call] : "no call"],
    ["active", duration(f.closedAt - f.openedAt)],
    ["closed", clock(f.closedAt, true)],
  ];
  rows.forEach(([label, val], i) => {
    const y = 660 + i * 50;
    text(label, L, y, `26px ${mono}`, MUTED);
    text(val, L + 280, y, `26px ${mono}`, TEXT);
  });

  // the subject: her badge and what is known
  const sy = 1180;
  x.fillStyle = "rgba(255,255,255,0.1)";
  x.fillRect(L, sy - 60, W - 2 * L, 1.5);
  text("SUBJECT", L, sy, `20px ${mono}`, MUTED, 6);
  x.drawImage(ev, L - 8, sy + 26, 150, 150);
  const known: [string, string][] = [
    ["E.V.", "photographer · 16 Harrow St"],
    ["status", "missing · 7 days"],
    ["last seen", "at the window"],
    ["case", `#${caseId(EV_CASE)} · open`],
  ];
  known.forEach(([label, val], i) => {
    const y = sy + 64 + i * 42;
    text(label, L + 180, y, `24px ${mono}`, MUTED);
    text(val, L + 360, y, `24px ${mono}`, i === 1 ? ACCENT : TEXT);
  });

  // one line from the invitation
  text("“It ends when you stop looking for the edges.”", L, 1520, `italic 400 38px ${serif}`, TEXT);
  text(`PARALLAX · enrolment ${caseId(f.caseNo)}`, L, 1566, `20px ${mono}`, MUTED, 2);

  // footer
  x.drawImage(sign, L - 4, H - 150, 44, 44);
  text(`No frames or audio left your device. This file was written on it at ${clock(f.closedAt)}.`, L + 56, H - 120, `19px ${sans}`, MUTED);

  text("continued overleaf · evidence", W - L - 330, 1566, `20px ${mono}`, NEON, 2);
  // film grain and faint scan lines over everything
  grain(x);
  return c;
}

/** One JPEG per page, A4: the smallest PDF that holds the drawings. */
function pdf(pages: Uint8Array[], w: number, h: number, title: string): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (p: Uint8Array | string) => {
    const b = typeof p === "string" ? enc.encode(p) : p;
    parts.push(b);
    size += b.length;
  };
  const obj = (n: number, body: string | (Uint8Array | string)[]) => {
    offsets[n] = size;
    push(`${n} 0 obj\n`);
    if (typeof body === "string") push(body);
    else body.forEach(push);
    push("\nendobj\n");
  };
  const pw = 595.28;
  const ph = 841.89;
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  // objects: 1 catalog, 2 pages, 3 info, then per page: page, image, content
  const page = (i: number) => 4 + i * 3;
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${page(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  obj(3, `<< /Title (${title}) /Creator (RECOVERY/4) >>`);
  pages.forEach((jpeg, i) => {
    const n = page(i);
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${n + 1} 0 R >> >> /Contents ${n + 2} 0 R >>`);
    obj(n + 1, [
      `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      jpeg,
      "\nendstream",
    ]);
    obj(n + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  const count = 4 + pages.length * 3;
  const xref = size;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

/** Draws the case file and hands it to the player as a download. */
export async function downloadCaseFile(f: CaseFacts) {
  const canvases = [await draw(f), await drawEvidence(f, pickFrames(6))];
  const jpegs = await Promise.all(
    canvases.map(
      (c) =>
        new Promise<Uint8Array>((resolve, reject) =>
          c.toBlob(
            (b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a))) : reject(new Error("case file: JPEG encoding failed"))),
            "image/jpeg",
            0.9,
          ),
        ),
    ),
  );
  const file = pdf(jpegs, W, H, `Case file ${caseId(f.caseNo)}`);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  const slug = f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "operator";
  a.download = `case-file-${caseId(f.caseNo)}-${slug}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
