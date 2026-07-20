// Υπολογισμοί ωραρίου καταστήματος για τον δημόσιο κατάλογο — πάντα σε ώρα Ελλάδας.
// Σχήμα: { mon: { closed, ranges: [{start:"HH:MM", end:"HH:MM"}] }, ... }
// Overnight βάρδια (π.χ. 19:00–01:00): end <= start σημαίνει ότι κλείνει την επόμενη ημέρα.

export const WEEK_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABELS = {
  mon: "Δευτέρα",
  tue: "Τρίτη",
  wed: "Τετάρτη",
  thu: "Πέμπτη",
  fri: "Παρασκευή",
  sat: "Σάββατο",
  sun: "Κυριακή",
};

const WEEKDAY_TO_KEY = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

const toMins = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

// Τρέχουσα ημέρα (key) + λεπτά από τα μεσάνυχτα, στη ζώνη Europe/Athens
export function athensNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Athens",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    dayKey: WEEKDAY_TO_KEY[get("weekday")] || "mon",
    mins: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function hasAnyHours(hours) {
  return WEEK_ORDER.some((k) => (hours?.[k]?.ranges || []).length > 0);
}

const dayRanges = (hours, key) => {
  const d = hours?.[key];
  if (!d || d.closed) return [];
  return (d.ranges || []).filter((r) => toMins(r.start) != null && toMins(r.end) != null);
};

// { open: bool, opensAt: { dayOffset, start } | null }
export function computeOpenState(hours) {
  if (!hasAnyHours(hours)) return { open: false, opensAt: null };
  const { dayKey, mins } = athensNow();
  const todayIdx = WEEK_ORDER.indexOf(dayKey);

  // Ανοιχτά τώρα: σημερινές βάρδιες + χθεσινές overnight που δεν έκλεισαν ακόμα
  for (const r of dayRanges(hours, dayKey)) {
    const s = toMins(r.start);
    const e = toMins(r.end);
    if (e > s ? mins >= s && mins < e : mins >= s) return { open: true, opensAt: null };
  }
  const yesterdayKey = WEEK_ORDER[(todayIdx + 6) % 7];
  for (const r of dayRanges(hours, yesterdayKey)) {
    const s = toMins(r.start);
    const e = toMins(r.end);
    if (e <= s && mins < e) return { open: true, opensAt: null };
  }

  // Κλειστά: βρες το επόμενο άνοιγμα μέσα στις επόμενες 7 ημέρες
  for (let offset = 0; offset <= 7; offset++) {
    const key = WEEK_ORDER[(todayIdx + offset) % 7];
    const starts = dayRanges(hours, key)
      .map((r) => ({ start: r.start, s: toMins(r.start) }))
      .filter((r) => (offset === 0 ? r.s > mins : true))
      .sort((a, b) => a.s - b.s);
    if (starts.length) return { open: false, opensAt: { dayOffset: offset, start: starts[0].start } };
  }
  return { open: false, opensAt: null };
}

export function opensAtLabel(opensAt) {
  if (!opensAt) return null;
  const { dayOffset, start } = opensAt;
  if (dayOffset === 0) return `ανοίγουμε στις ${start}`;
  if (dayOffset === 1) return `ανοίγουμε αύριο ${start}`;
  const { dayKey } = athensNow();
  const key = WEEK_ORDER[(WEEK_ORDER.indexOf(dayKey) + dayOffset) % 7];
  return `ανοίγουμε ${DAY_LABELS[key]} ${start}`;
}

export function dayScheduleLabel(hours, key) {
  const d = hours?.[key];
  if (!d || d.closed || !(d.ranges || []).length) return "Κλειστά";
  return d.ranges.map((r) => `${r.start}–${r.end}`).join(" & ");
}
