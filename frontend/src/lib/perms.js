// Per-profile feature permissions (restrict-only, μέσα στα όρια του ρόλου).
// Πρέπει να συμβαδίζει με το FEATURE_KEYS του backend (core.py).

export const FEATURES = [
  { key: "history", label: "Ιστορικό παραγγελιών" },
  { key: "analytics", label: "Στατιστικά" },
  { key: "expenses", label: "Έξοδα" },
  { key: "settings", label: "Ρυθμίσεις" },
  { key: "menu", label: "Διαχείριση μενού & φωτογραφίες" },
  { key: "day_close", label: "Κλείσιμο ημέρας (Z-report)" },
  { key: "discounts", label: "Εκπτώσεις στο ταμείο" },
  { key: "cancel_orders", label: "Ακύρωση/διαγραφή παραγγελιών" },
];

// Ο Ιδιοκτήτης έχει ΠΑΝΤΑ τα πάντα. Απουσία κλειδιού = επιτρέπεται (default: όλα ενεργά).
export const can = (user, key) => {
  if (!user || user === false) return false;
  const role = user.role || user.profile;
  if (role === "owner") return true;
  return (user.perms || {})[key] !== false;
};
