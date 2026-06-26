// Formatting + open/closed helpers driven by the structured per-day `hours[]`
// that the admin edits. This is the single source of truth for hours display
// across the admin table and the customer location selectors.

import { getZonedNow, type DayHours } from "@/lib/time-slots";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// "17:00" → "5pm", "23:30" → "11:30pm" (matches the existing UI aesthetic).
function fmtTime(value: string): string {
  const total = parseHHMM(value);
  if (total == null) return value;
  const h24 = Math.floor(total / 60);
  const min = total % 60;
  const ampm = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return min === 0 ? `${h12}${ampm}` : `${h12}:${String(min).padStart(2, "0")}${ampm}`;
}

function sameHours(a: DayHours, b: DayHours): boolean {
  if (a.closed && b.closed) return true;
  return !a.closed && !b.closed && a.open === b.open && a.close === b.close;
}

function dayLabel(start: number, end: number): string {
  return start === end
    ? DAY_LABELS[start]
    : `${DAY_LABELS[start]} - ${DAY_LABELS[end]}`;
}

// Groups consecutive days (Sun..Sat) with identical hours into readable lines,
// e.g. ["Sun - Thu: 10am - 10pm", "Fri: 5am - 11pm", "Sat: 10am - 11pm"].
export function formatHoursLines(hours?: DayHours[]): string[] {
  if (!Array.isArray(hours) || hours.length < 7) return [];

  const lines: string[] = [];
  let start = 0;

  for (let i = 1; i <= 7; i++) {
    if (i < 7 && sameHours(hours[i], hours[start])) continue;

    const group = hours[start];
    const label = dayLabel(start, i - 1);
    lines.push(
      group.closed
        ? `${label}: Closed`
        : `${label}: ${fmtTime(group.open)} - ${fmtTime(group.close)}`
    );
    start = i;
  }

  // Collapse a single all-week open line to "Daily: ...".
  if (lines.length === 1 && !hours[0].closed) {
    return [
      `Daily: ${fmtTime(hours[0].open)} - ${fmtTime(hours[0].close)}`,
    ];
  }

  return lines;
}

export function formatHoursText(hours?: DayHours[]): string {
  return formatHoursLines(hours).join("\n");
}

// Whether the store is currently open, evaluated in its own timezone.
export function isStoreOpenNow(
  hours: DayHours[] | undefined,
  timezone: string
): boolean {
  if (!Array.isArray(hours) || hours.length < 7) return false;

  const now = getZonedNow(timezone || "America/New_York");
  if (now.weekdayIndex < 0) return false;

  const dh = hours[now.weekdayIndex];
  if (!dh || dh.closed) return false;

  const open = parseHHMM(dh.open);
  const close = parseHHMM(dh.close);
  if (open == null || close == null) return false;

  return now.minutes >= open && now.minutes < close;
}
