// The keepsake at the end: "case file 0418", a one-page PDF made in the browser from the
// player's own session, in the project's look (ink background, grain, mono metadata, the
// serif of the mails, the PARALLAX V, E.V.'s badge, the Sign, one cyan). The page is drawn
// on a canvas and wrapped in a minimal PDF by hand: no library, no server, nothing sent.

import { clock, duration } from "./time";

export type CaseFacts = {
  name: string;
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
  right("CASE 0418 · OPEN", W - L, 186, `22px ${mono}`, NEON, 4);
  x.fillStyle = "rgba(255,255,255,0.1)";
  x.fillRect(L, 250, W - 2 * L, 1.5);

  // title, in her world's serif
  text("Case file 0418", L, 380, `400 92px ${serif}`, TEXT);
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
    ["case", "#0415 · open"],
  ];
  known.forEach(([label, val], i) => {
    const y = sy + 64 + i * 42;
    text(label, L + 180, y, `24px ${mono}`, MUTED);
    text(val, L + 360, y, `24px ${mono}`, i === 1 ? ACCENT : TEXT);
  });

  // one line from the invitation
  text("“It ends when you stop looking for the edges.”", L, 1520, `italic 400 38px ${serif}`, TEXT);
  text("PARALLAX · enrolment 0418", L, 1566, `20px ${mono}`, MUTED, 2);

  // footer
  x.drawImage(sign, L - 4, H - 150, 44, 44);
  text(`No frames or audio left your device. This file was written on it at ${clock(f.closedAt)}.`, L + 56, H - 120, `19px ${sans}`, MUTED);

  // film grain and faint scan lines over everything
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
  return c;
}

/** One JPEG, one page, A4: the smallest PDF that holds the drawing. */
function pdf(jpeg: Uint8Array, w: number, h: number): Blob {
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
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, [
    `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    "\nendstream",
  ]);
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, "<< /Title (Case file 0418) /Creator (RECOVERY/4) >>");
  const xref = size;
  push(`xref\n0 7\n0000000000 65535 f \n`);
  for (let n = 1; n <= 6; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

/** Draws the case file and hands it to the player as a download. */
export async function downloadCaseFile(f: CaseFacts) {
  const c = await draw(f);
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("case file: JPEG encoding failed"))), "image/jpeg", 0.9),
  );
  const file = pdf(new Uint8Array(await blob.arrayBuffer()), W, H);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  const slug = f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "operator";
  a.download = `case-file-0418-${slug}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
