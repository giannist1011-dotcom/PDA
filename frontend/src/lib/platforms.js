// Πλατφόρμες delivery (efood / Box / Wolt): κοινές σταθερές & helpers.
// Χρώματα ΔΙΚΑ ΜΑΣ (tokens του OrderDeck) — δεν αντιγράφουμε branding πλατφορμών.

export const PLATFORMS = [
  { id: "efood", label: "efood", accent: "#FF3B30", soft: "rgba(255,59,48,0.14)" },
  { id: "box", label: "Box", accent: "#F5A623", soft: "rgba(245,166,35,0.14)" },
  { id: "wolt", label: "Wolt", accent: "#3FA9F5", soft: "rgba(63,169,245,0.14)" },
];

export const platformById = (id) => PLATFORMS.find((p) => p.id === id) || null;
export const platformLabel = (id) => platformById(id)?.label || id;

// Η «Πηγή» με την οποία γράφεται η παραγγελία στο POS (ίδια με το backend)
export const PLATFORM_SOURCE = { efood: "efood", box: "Box", wolt: "Wolt" };

// Φίλτρο προέλευσης σε Στατιστικά & Deck View (ίδια κλειδιά με το backend)
export const SOURCE_OPTIONS = [
  { key: "all", label: "Όλα" },
  { key: "pos", label: "Ταμείο" },
  { key: "efood", label: "efood" },
  { key: "box", label: "Box" },
  { key: "wolt", label: "Wolt" },
];

export const SOURCE_COLORS = {
  pos: "#00E676",
  efood: "#FF3B30",
  box: "#F5A623",
  wolt: "#3FA9F5",
};

export const READY_PRESETS = [20, 30, 40, 50];
export const DEFAULT_READY_MINUTES = 30;

export const STATUS_LABELS = {
  pending: "Εισερχόμενη",
  accepted: "Σε εξέλιξη",
  out_for_delivery: "Καθ' οδόν",
  delivered: "Ολοκληρωμένη",
  rejected: "Απορρίφθηκε",
};

// ---------- Countdown ----------
// Δευτερόλεπτα που απομένουν έως την ώρα παράδοσης (αρνητικά = καθυστέρηση)
export const secondsLeft = (dueAt, now = Date.now()) => {
  const t = new Date(dueAt).getTime();
  return Number.isFinite(t) ? Math.round((t - now) / 1000) : 0;
};

// «22:14» / «-03:20» όταν έχει περάσει η ώρα
export const formatCountdown = (secs) => {
  const neg = secs < 0;
  const s = Math.abs(secs);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${neg ? "-" : ""}${String(m).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

// Κίτρινο κάτω από 10', κόκκινο όταν έχει περάσει η ώρα
export const countdownTone = (secs) =>
  secs < 0 ? "late" : secs < 600 ? "soon" : "ok";

export const COUNTDOWN_CLS = {
  ok: "text-[#00E676] border-[#00E676]/40 bg-[#00E676]/10",
  soon: "text-gold border-gold/50 bg-gold/10",
  late: "text-[#FF6961] border-[#FF3B30]/60 bg-[#FF3B30]/15",
};
