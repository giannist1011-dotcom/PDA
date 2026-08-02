// Μετατροπή των aggregation αποτελεσμάτων του server σε σειρές για το
// CountBarChart — κοινές για τα Στατιστικά του OrderDeck και του FleetDeck.
import { formatGRDate, formatGRDayMonth, pad2 } from "@/lib/format";
import { isoDate } from "@/lib/dates";

const MAX_DAYS = 120;

// [{day: "YYYY-MM-DD", orders}] → σειρά ημερών ΧΩΡΙΣ κενά (οι ημέρες χωρίς
// παραγγελίες μένουν στο διάγραμμα με μηδέν). Ελληνική μορφή DD/MM.
export const daySeries = (rows = [], from = "", to = "", key = "orders") => {
  const map = new Map((rows || []).map((r) => [r.day, r[key] ?? 0]));
  const days = [...map.keys()].sort();
  const start = from || days[0];
  const end = to || days[days.length - 1];
  if (!start || !end) return [];
  const out = [];
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (d <= last && out.length < MAX_DAYS) {
    const iso = isoDate(d);
    out.push({ label: formatGRDayMonth(iso), full: formatGRDate(iso), value: map.get(iso) || 0 });
    d.setDate(d.getDate() + 1);
  }
  return out;
};

// [{hour: 0-23, orders}] → 24 ώρες, 24ωρη μορφή («08:00»)
export const hourSeries = (rows = [], key = "orders") => {
  const map = new Map((rows || []).map((r) => [r.hour, r[key] ?? 0]));
  return Array.from({ length: 24 }, (_, h) => ({
    label: pad2(h),
    full: `${pad2(h)}:00 – ${pad2(h)}:59`,
    value: map.get(h) || 0,
  }));
};
