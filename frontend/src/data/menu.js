// Static constants shared across all stores (order sources are the same).
// All menu items, categories & customization options now come from the backend.

// ΟΛΕΣ οι πηγές που μπορεί να έχει μια παραγγελία — φίλτρα Ιστορικού,
// Στατιστικών και ομαδοποίηση στο Z.
export const ORDER_SOURCES = ["Ταμείο", "Τηλέφωνο", "efood", "Box", "Wolt"];

// Πηγές από πλατφόρμες delivery — ομαδοποιούνται ξεχωριστά στο Z. Οι
// παραγγελίες τους ΔΕΝ καταχωρούνται με το χέρι: έρχονται από την καρτέλα
// της πλατφόρμας (αποδοχή) και γράφονται αυτόματα με τη σωστή πηγή.
export const PLATFORM_SOURCES = ["efood", "Box", "Wolt"];

// Πηγές που καταχωρεί ο χρήστης στο ταμείο — μόνο αυτές εμφανίζονται στο
// panel παραγγελίας.
export const POS_ORDER_SOURCES = ["Ταμείο", "Τηλέφωνο"];
