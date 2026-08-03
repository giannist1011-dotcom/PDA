// Εργάσιμη ημέρα του μαγαζιού (business day) — ΔΕΝ είναι η ημερολογιακή.
// Το όριο (cutoff, λεπτά μετά τα μεσάνυχτα) το υπολογίζει το backend από το
// ωράριο (core.business_day_cutoff) και έρχεται με το /auth/me ως
// user.business_day_cutoff. Μαγαζί που κλείνει 02:00 → οι παραγγελίες της 01:30
// ανήκουν στην ΠΡΟΗΓΟΥΜΕΝΗ ημέρα, όπως ακριβώς μετράει και το Z.

import { useAuth } from "@/context/AuthContext";
import { DAY_LABELS, DAY_SHORT } from "@/lib/dates";

export const BUSINESS_DAY_FALLBACK_MIN = 6 * 60; // 06:00 όταν δεν έχει οριστεί ωράριο

export const businessCutoffMin = (user) =>
  Number.isFinite(user?.business_day_cutoff)
    ? user.business_day_cutoff
    : BUSINESS_DAY_FALLBACK_MIN;

const athensDay = (ms) =>
  new Date(ms).toLocaleDateString("sv", { timeZone: "Europe/Athens" });

// Η ΤΡΕΧΟΥΣΑ εργάσιμη ημέρα (YYYY-MM-DD)
export const businessToday = (user) =>
  athensDay(Date.now() - businessCutoffMin(user) * 60000);

// Σε ποια εργάσιμη ημέρα ανήκει ένα ISO timestamp
export const businessDayOf = (iso, user) => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  return athensDay(t - businessCutoffMin(user) * 60000);
};

const dowIdx = (iso) => (new Date(iso + "T00:00:00").getDay() + 6) % 7; // Δευ=0

// «Τρίτη 30/07» — για επικεφαλίδες/λίστες επιλογής ημέρας
export const businessDayLabel = (iso) => {
  try {
    const d = new Date(iso + "T00:00:00");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${DAY_LABELS[dowIdx(iso)]} ${dd}/${mm}`;
  } catch {
    return iso;
  }
};

// Fallback κεφαλίδας εύρους όταν η αναφορά είναι παλιά (χωρίς range_label):
// «Τρίτη 30/07 06:00 — Τετ 31/07 06:00» με βάση το τρέχον όριο ημέρας
export const fallbackRangeLabel = (iso, user) => {
  try {
    const cut = businessCutoffMin(user);
    const hhmm = `${String(Math.floor(cut / 60)).padStart(2, "0")}:${String(cut % 60).padStart(2, "0")}`;
    const next = new Date(new Date(iso + "T00:00:00").getTime() + 86400000);
    const dd = (d) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const start = new Date(iso + "T00:00:00");
    return `${DAY_LABELS[dowIdx(iso)]} ${dd(start)} ${hhmm} — ${
      DAY_SHORT[(next.getDay() + 6) % 7]
    } ${dd(next)} ${hhmm}`;
  } catch {
    return iso;
  }
};

// Η κεφαλίδα εύρους μιας αναφοράς/σύνοψης, με fallback για παλιές αναφορές
export const reportRangeLabel = (report, user) =>
  report?.range_label || (report?.date ? fallbackRangeLabel(report.date, user) : "");

export function useBusinessDay() {
  const { user } = useAuth();
  return {
    cutoffMin: businessCutoffMin(user),
    today: businessToday(user),
    dayOf: (iso) => businessDayOf(iso, user),
    rangeLabel: (report) => reportRangeLabel(report, user),
  };
}
