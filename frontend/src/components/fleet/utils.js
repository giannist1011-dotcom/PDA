// Κοινά για τις σελίδες Fleet: καταστάσεις, πληρωμές, μορφοποίηση.
import { useEffect, useMemo, useState } from "react";
import { geocodeCityCenter, photonSearch } from "@/lib/api";
import { splitHouseNumber } from "@/components/shared/AddressAutocomplete";

// Default κέντρο χαρτών του λογαριασμού: αποθηκευμένο pin → geocode της
// αποθηκευμένης πόλης → null (θέα Ελλάδας στον χάρτη). Σταθερό object
// (useMemo) ώστε το recenter effect του FleetOrdersMap να μην ξαναπυροδοτείται
// σε κάθε poll.
export const useAccountCenter = (lat, lng, city) => {
  const hasPin = lat != null && lng != null;
  const [cityCenter, setCityCenter] = useState(null);
  useEffect(() => {
    if (hasPin || !city) return undefined;
    let alive = true;
    geocodeCityCenter(city).then((c) => alive && c && setCityCenter(c));
    return () => {
      alive = false;
    };
  }, [hasPin, city]);
  return useMemo(() => (hasPin ? { lat, lng } : cityCenter), [hasPin, lat, lng, cityCenter]);
};

// Auto-geocode όταν ο χρήστης ΔΕΝ διάλεξε πρόταση/pin: πρώτο αποτέλεσμα του
// Photon για «διεύθυνση, πόλη». Αν η πλήρης διεύθυνση δεν βρεθεί, δεύτερη
// προσπάθεια ΜΟΝΟ με την οδό — στις ελληνικές επαρχιακές πόλεις οι αριθμοί
// σπιτιών λείπουν από το OSM και το pin της οδού είναι αρκετό για τον χάρτη.
// null σε αποτυχία/offline — η παραγγελία αποθηκεύεται κανονικά, εκτός χάρτη.
export const geocodeFleetAddress = async (address, city) => {
  const first = async (term) => {
    const q = city ? `${term}, ${city}` : term;
    const data = await photonSearch(q);
    const [lon, lat] = data?.features?.[0]?.geometry?.coordinates || [];
    return lat != null && lon != null ? { lat, lng: lon } : null;
  };
  try {
    const hit = await first(address);
    if (hit) return hit;
    const split = splitHouseNumber(address);
    return split?.street ? await first(split.street) : null;
  } catch {
    return null;
  }
};

export const STATUS_META = {
  waiting: { label: "Αναμονή", emoji: "🔴", dot: "#FF3B30", text: "text-[#FF6961]", badge: "bg-[#FF3B30]/15 text-[#FF6961] border-[#FF3B30]/40" },
  pickup: { label: "Σε παραλαβή", emoji: "🟡", dot: "#FFC300", text: "text-gold", badge: "bg-[#FFC300]/10 text-gold border-[#FFC300]/40" },
  enroute: { label: "Σε διαδρομή", emoji: "🟢", dot: "#34C759", text: "text-[#5BD778]", badge: "bg-[#34C759]/10 text-[#5BD778] border-[#34C759]/40" },
  delivered: { label: "Παραδόθηκε", emoji: "🔵", dot: "#0A84FF", text: "text-[#5CA8FF]", badge: "bg-[#0A84FF]/10 text-[#5CA8FF] border-[#0A84FF]/40" },
  cancelled: { label: "Ακυρώθηκε", emoji: "⚪", dot: "#8E8E93", text: "text-neutral-400", badge: "bg-white/5 text-neutral-400 border-white/15" },
  // Προγραμματισμένη δημοσίευση (FleetDeck καταστήματος) — δεν την βλέπουν ακόμα οι οδηγοί
  scheduled: { label: "Προγραμματισμένη", emoji: "⏳", dot: "#B48CFF", text: "text-[#C9A8FF]", badge: "bg-[#B48CFF]/10 text-[#C9A8FF] border-[#B48CFF]/40" },
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

// Επόμενο βήμα της ροής οδηγού ανά κατάσταση (κουμπί προόδου στις «Δικές μου»)
export const NEXT_ACTION = {
  pickup: { status: "enroute", label: "Ξεκινάω διαδρομή 🟢" },
  enroute: { status: "delivered", label: "Παραδόθηκε 🔵" },
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
