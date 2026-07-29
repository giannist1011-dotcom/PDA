import { formatGRTime, formatGRDayMonthTime } from "@/lib/format";

export const schedDateTime = (iso) => {
  try {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? formatGRTime(d) : formatGRDayMonthTime(d);
  } catch {
    return "";
  }
};

// Πόσο πριν την ώρα της τυπώνεται/αναδύεται η προγραμματισμένη παραγγελία
export const FIRE_AHEAD_MS = 15 * 60 * 1000;

// Κατάσταση για τη λίστα «Προγραμματισμένες»:
// now = έφτασε η ώρα της (ενεργοποιήθηκε — τυπώθηκε, μένει ως υπενθύμιση)
// late = πέρασε η ώρα της και δεν ξεκίνησε ποτέ (π.χ. η συσκευή ήταν κλειστή)
// soon = μέσα στο παράθυρο των 15' · upcoming = αργότερα
export const schedState = (o) => {
  if (o?.status !== "scheduled") return "now";
  const t = new Date(o?.scheduled_at).getTime();
  if (Number.isNaN(t)) return "upcoming";
  const diff = t - Date.now();
  if (diff < 0) return "late";
  if (diff <= FIRE_AHEAD_MS) return "soon";
  return "upcoming";
};

export const SCHED_META = {
  now: {
    label: "ΩΡΑ ΤΗΣ: τώρα",
    box: "border-gold bg-gold/10",
    text: "text-gold",
    action: "Επανεκτύπωση",
  },
  late: {
    label: "ΕΚΠΡΟΘΕΣΜΗ",
    box: "border-[#FF3B30] bg-[#FF3B30]/10",
    text: "text-[#FF6961]",
    action: "Τύπωσε τώρα",
  },
  soon: {
    label: "Σε λίγο",
    box: "border-[#00B0FF] bg-[#00B0FF]/10",
    text: "text-[#00B0FF]",
    action: "Τύπωσε τώρα",
  },
  upcoming: {
    label: "",
    box: "border-[#00B0FF]/40 bg-[#2A0E14]",
    text: "text-[#00B0FF]",
    action: "Τύπωσε τώρα",
  },
};

// Οι πιο κοντινές πρώτες — η σειρά κρατιέται και μετά από τοπικές αλλαγές
export const sortScheduled = (list) =>
  [...(list || [])].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
