// Κοινά για τις σελίδες Fleet: καταστάσεις, πληρωμές, μορφοποίηση.

export const STATUS_META = {
  waiting: { label: "Αναμονή", emoji: "🔴", dot: "#FF3B30", text: "text-[#FF6961]", badge: "bg-[#FF3B30]/15 text-[#FF6961] border-[#FF3B30]/40" },
  pickup: { label: "Σε παραλαβή", emoji: "🟡", dot: "#FFC300", text: "text-gold", badge: "bg-[#FFC300]/10 text-gold border-[#FFC300]/40" },
  enroute: { label: "Σε διαδρομή", emoji: "🟢", dot: "#34C759", text: "text-[#5BD778]", badge: "bg-[#34C759]/10 text-[#5BD778] border-[#34C759]/40" },
  delivered: { label: "Παραδόθηκε", emoji: "🔵", dot: "#0A84FF", text: "text-[#5CA8FF]", badge: "bg-[#0A84FF]/10 text-[#5CA8FF] border-[#0A84FF]/40" },
  cancelled: { label: "Ακυρώθηκε", emoji: "⚪", dot: "#8E8E93", text: "text-neutral-400", badge: "bg-white/5 text-neutral-400 border-white/15" },
};

// Αιτίες προβλήματος παράδοσης (ίδια keys με το backend)
export const PROBLEM_LABELS = {
  no_answer: "Δεν απαντάει",
  wrong_address: "Λάθος διεύθυνση",
  other: "Άλλο",
};

// Ετικέτες πεδίων στην ειδοποίηση «Η #Χ ενημερώθηκε» του οδηγού
export const EDIT_FIELD_LABELS = {
  pickup_name: "Παραλαβή",
  address: "Διεύθυνση",
  notes: "Σημείωση",
};

// Λεπτά που πέρασαν από ένα ISO timestamp (ηλικία παραγγελίας/claim)
export const minutesSince = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isNaN(ms) ? null : Math.max(0, Math.floor(ms / 60000));
};

// Χρώμα ηλικίας για παραγγελίες σε αναμονή: >15' πορτοκαλί, >25' κόκκινο
export const ageColorClass = (mins) =>
  mins > 25 ? "text-[#FF6961]" : mins > 15 ? "text-gold" : "text-neutral-500";

export const fmtTime = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("el-GR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Athens",
    });
  } catch {
    return "";
  }
};

// Σύνδεσμος πλοήγησης — tap στη διεύθυνση ανοίγει Google Maps
export const mapsUrl = (address, city) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    city ? `${address}, ${city}` : address
  )}`;
