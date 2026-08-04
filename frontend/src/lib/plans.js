// ΠΛΑΝΑ ΚΑΤΑΣΤΗΜΑΤΟΣ — ο ΕΝΑΣ κανόνας πρόσβασης (μενού, routes, καρτέλες).
//
//   orderdeck        → καθαρό POS. ΤΙΠΟΤΑ fleet: ούτε σελίδα, ούτε καρτέλα, ούτε popup.
//   fleet            → το standalone store app του FleetDeck. Χωρίς POS.
//   orderdeck_fleet  → POS + FleetDeck καταστήματος, ΟΛΑ στο ίδιο session/login
//                      (καμία «αλλαγή προφίλ», καμία μετάβαση σε πίνακα εταιρείας).
//
// Οι πίνακες ΕΤΑΙΡΕΙΑΣ διανομής (/fleet — οδηγοί, μέλη, στατιστικά εταιρείας) δεν
// ανήκουν σε κανένα πλάνο καταστήματος: είναι ξεχωριστός λογαριασμός.
export const PLANS = {
  ORDERDECK: "orderdeck",
  FLEET: "fleet",
  OD_FLEET: "orderdeck_fleet",
};

export const planOf = (user) =>
  (user && user !== false ? user.plan : null) || PLANS.ORDERDECK;

// Το πλάνο δίνει POS (ταμείο, μενού, ιστορικό, στατιστικά καταστήματος);
export const hasPOS = (user) => planOf(user) !== PLANS.FLEET;

// Το πλάνο δίνει τις σελίδες FleetDeck ΚΑΤΑΣΤΗΜΑΤΟΣ (/app/fleet/*);
export const hasFleetStore = (user) =>
  [PLANS.FLEET, PLANS.OD_FLEET].includes(planOf(user));

// Το πλάνο δίνει την καρτέλα «Αποστολή παραγγελίας» + το popup εκτύπωσης
// (ανέβασμα παραγγελίας POS στους διανομείς) — μόνο OrderDeck Fleet.
export const hasDispatch = (user) => planOf(user) === PLANS.OD_FLEET;
