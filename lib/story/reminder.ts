// The last pop-up (docs/plan-round6.md B6.7): a real calendar event for case 0419, tomorrow
// at the minute the player came in. Made here, downloaded as .ics: no account, no server.

const DAY = 86_400_000;
const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function reminderStart(openedAt: number): number {
  const at = new Date(openedAt + DAY);
  at.setSeconds(0, 0);
  return at.getTime();
}

export function downloadReminder(openedAt: number, name: string) {
  const start = reminderStart(openedAt);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RECOVERY//case 0419//EN",
    "BEGIN:VEVENT",
    `UID:case0419-${start}@recovery`,
    `DTSTAMP:${utc(Date.now())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(start + 15 * 60_000)}`,
    "SUMMARY:case 0419",
    // the operator name is free text: commas, semicolons and backslashes are escaped
    `DESCRIPTION:operator: ${name.replace(/[\\,;]/g, (c) => `\\${c}`)}. don't be late.`,
    `URL:${window.location.origin}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:case 0419",
    "TRIGGER:-PT5M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "case-0419.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
