// Κοινά για τις σελίδες Fleet: καταστάσεις, πληρωμές, μορφοποίηση.

export const STATUS_META = {
  waiting: { label: "Αναμονή", emoji: "🔴", badge: "bg-[#FF3B30]/15 text-[#FF6961] border-[#FF3B30]/40" },
  pickup: { label: "Σε παραλαβή", emoji: "🟡", badge: "bg-[#FFC300]/10 text-gold border-[#FFC300]/40" },
  enroute: { label: "Σε διαδρομή", emoji: "🟢", badge: "bg-[#34C759]/10 text-[#5BD778] border-[#34C759]/40" },
  delivered: { label: "Παραδόθηκε", emoji: "🔵", badge: "bg-[#0A84FF]/10 text-[#5CA8FF] border-[#0A84FF]/40" },
  cancelled: { label: "Ακυρώθηκε", emoji: "⚪", badge: "bg-white/5 text-neutral-400 border-white/15" },
};

export const BOARD_COLUMNS = ["waiting", "pickup", "enroute", "delivered"];

export const PAYMENT_LABELS = { cash: "Μετρητά", card: "Κάρτα", paid: "Πληρωμένη" };

export const fmtMoney = (n) =>
  `${Number(n || 0).toFixed(2).replace(".", ",")} €`;

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
