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

export const formatWeekRange = (mondayIso) => {
  const mon = new Date(mondayIso + "T00:00:00");
  const sun = addDays(mon, 6);
  const fmt = (dt) =>
    `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(mon)} — ${fmt(sun)}`;
};
