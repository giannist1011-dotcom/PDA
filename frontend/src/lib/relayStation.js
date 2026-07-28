// Kiosk Relay — σημαία «Αυτός ο υπολογιστής εκτυπώνει» ανά ΣΥΣΚΕΥΗ (localStorage).
// Ο σταθμός εκτύπωσης είναι το kiosk PC με Chrome --kiosk-printing: κάνει poll τα
// print_jobs και τα τυπώνει αθόρυβα· οι υπόλοιπες συσκευές απλώς δημιουργούν jobs.

const KEY = "orderdeck_relay_station";
const EVENT = "orderdeck-relay-station-change";

export const isRelayStation = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export const setRelayStation = (on) => {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // localStorage unavailable — η σημαία δεν αποθηκεύεται
  }
  window.dispatchEvent(new Event(EVENT));
};

// Ενημέρωση components όταν αλλάξει η σημαία (ίδιο tab ή άλλο tab της συσκευής)
export const subscribeRelayStation = (cb) => {
  const notify = () => cb(isRelayStation());
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
};
