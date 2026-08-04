// Κοινά για την «Αποστολή παραγγελίας»: ανέβασμα παραγγελίας POS στους διανομείς
// της συνεργαζόμενης εταιρείας — ίδιος μηχανισμός με το standalone store app
// (POST /store/fleet/orders, με ρητό pos_order_id για τη σύνδεση των δύο πλευρών).
import { apiStoreFleetCreateOrder } from "@/lib/api";
import { geocodeFleetAddress } from "@/components/fleet/utils";

// Presets του popup εκτύπωσης — τα λεπτά είναι επεξεργάσιμα, το backend δέχεται
// οποιονδήποτε αριθμό έως MAX_PUBLISH_DELAY
export const DELAY_PRESETS = [10, 15, 20, 30];
export const DEFAULT_DELAY = 15;

// Παραγγελία POS (ό,τι επιστρέφει το /orders ή το /store/fleet/dispatch) →
// κοινή μορφή κάρτας. Δέχεται και τις δύο (nested delivery ή flat πεδία).
export const toDispatchCard = (o) => {
  const d = o.delivery || {};
  return {
    id: o.id,
    order_number: o.order_number,
    created_at: o.created_at,
    address: (o.address ?? d.address ?? "").trim(),
    floor: (o.floor ?? d.floor ?? "").trim(),
    phone: (o.phone ?? d.phone ?? "").trim(),
    customer_name: (o.customer_name ?? d.name ?? "").trim(),
    note: o.note || "",
    items_count:
      o.items_count ??
      (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
  };
};

// Ανέβασμα μίας κάρτας. delayMinutes 0 = άμεσα στις «Ελεύθερες» + push στους
// οδηγούς σε βάρδια· >0 = προγραμματισμένο στο backend (επιβιώνει από refresh).
export const uploadDispatchCard = async (card, { teamId, city, delayMinutes = 0 }) => {
  const address = (card.address || "").trim();
  // Χωρίς pin από τον χρήστη → auto-geocode ώστε η παραγγελία να βγαίνει στον
  // χάρτη της εταιρείας· αποτυχία δεν εμποδίζει το ανέβασμα
  const c = await geocodeFleetAddress(address, city);
  return apiStoreFleetCreateOrder({
    team_id: teamId,
    address,
    floor: card.floor || "",
    phone: card.phone || "",
    notes: [card.customer_name, card.note].filter(Boolean).join(" · ").slice(0, 300),
    urgent: false,
    delay_minutes: delayMinutes,
    lat: c?.lat ?? null,
    lng: c?.lng ?? null,
    pos_order_id: card.id,
  });
};
