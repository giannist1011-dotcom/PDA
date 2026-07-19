// Small helper for building the current-week Monday, formatting dates, etc.

export const DAY_LABELS = ["Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"];
export const DAY_SHORT = ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"];

export const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Monday of the ISO week for the given date
export const mondayOf = (d) => {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  const dow = nd.getDay(); // 0=Sun..6=Sat
  const diff = (dow + 6) % 7; // Mon=0..Sun=6
  nd.setDate(nd.getDate() - diff);
  return nd;
};

export const addDays = (d, n) => {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
};

// Η τρέχουσα ημερολογιακή ημέρα στην Ελλάδα (YYYY-MM-DD) — ανεξάρτητη από το
// timezone της συσκευής, συνεπής με το φιλτράρισμα Europe/Athens του backend
// (core.local_day_range). Το locale "sv" δίνει πάντα μορφή YYYY-MM-DD.
export const athensToday = () =>
  new Date().toLocaleDateString("sv", { timeZone: "Europe/Athens" });

// Κοινά presets περιόδου (Ιστορικό / Στατιστικά / Έξοδα)
export const PERIOD_PRESETS = [
  { key: "today", label: "Σήμερα" },
  { key: "yesterday", label: "Χθες" },
  { key: "last7", label: "7 ημέρες" },
  { key: "thisMonth", label: "Αυτός ο μήνας" },
  { key: "last3m", label: "3 μήνες" },
  { key: "all", label: "Πάντα" },
];

// Εύρος {from, to} (ISO ημέρες Ελλάδας) για preset · null = χωρίς φίλτρο ("Πάντα")
export const presetRange = (key) => {
  const today = athensToday();
  const shift = (fn) => {
    const d = new Date(today + "T00:00:00");
    fn(d);
    return isoDate(d);
  };
  switch (key) {
    case "yesterday": {
      const y = shift((d) => d.setDate(d.getDate() - 1));
      return { from: y, to: y };
    }
    case "last7":
      return { from: shift((d) => d.setDate(d.getDate() - 6)), to: today };
    case "thisMonth":
      return { from: today.slice(0, 8) + "01", to: today };
    case "last3m":
      return { from: shift((d) => d.setMonth(d.getMonth() - 3)), to: today };
    case "all":
      return null;
    default: // "today"
      return { from: today, to: today };
  }
};

export const formatWeekRange = (mondayIso) => {
  const mon = new Date(mondayIso + "T00:00:00");
  const sun = addDays(mon, 6);
  const fmt = (dt) =>
    `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(mon)} — ${fmt(sun)}`;
};
