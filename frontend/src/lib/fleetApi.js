// OrderDeck Fleet — ΟΛΕΣ οι κλήσεις του /fleet namespace ζουν εδώ (όπως το api.js
// για τα μαγαζιά). Ξεχωριστό token από το POS: μια συσκευή μπορεί να έχει και τα δύο.
import axios from "axios";
import { decodeJwtPayload } from "./api";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
// Ξεχωριστό κλειδί ΑΝΑ ΕΠΙΦΑΝΕΙΑ: το login του driver PWA δεν πατάει ποτέ το
// session του dashboard συντονιστή (και αντίστροφα) στον ίδιο browser.
const TOKEN_KEYS = {
  fleet_admin: "orderdeck_fleet_admin_token",
  driver: "orderdeck_fleet_driver_token",
};
const LEGACY_TOKEN_KEY = "orderdeck_fleet_token";

// Σε ποια επιφάνεια ανήκει ένα fleet token — από το claim role του ίδιου του JWT
// (team-level token χωρίς μέλος = dashboard, οδηγεί σε επιλογή μέλους εκεί)
export const fleetTokenSurface = (t) =>
  decodeJwtPayload(t)?.role === "driver" ? "driver" : "fleet_admin";

// Μία φορά: μετανάστευση από το παλιό ενιαίο κλειδί στο κλειδί της επιφάνειάς του
try {
  const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacy) {
    const key = TOKEN_KEYS[fleetTokenSurface(legacy)];
    if (!localStorage.getItem(key)) localStorage.setItem(key, legacy);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
} catch {
  /* localStorage μη διαθέσιμο */
}

// Η ενεργή επιφάνεια του tab — την ορίζει το FleetAuthProvider από το route
let activeSurface = "fleet_admin";
export const setFleetSurface = (s) => {
  activeSurface = TOKEN_KEYS[s] ? s : "fleet_admin";
};

export const fleetApi = axios.create({ baseURL: `${BACKEND_URL}/api` });

fleetApi.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEYS[activeSurface]);
  // Ρητό token (π.χ. ροή driver login πριν αποθηκευτεί session) έχει προτεραιότητα
  if (t && !cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Αποθήκευση στο κλειδί που αντιστοιχεί στον ρόλο ΤΟΥ TOKEN (όχι της ενεργής
// επιφάνειας): επιλογή οδηγού με PIN από το tablet γράφει στο driver key και
// αφήνει άθικτο το team session του dashboard. null → καθαρίζει ΜΟΝΟ το κλειδί
// της ενεργής επιφάνειας (logout της μίας δεν ρίχνει την άλλη).
export const setFleetToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEYS[fleetTokenSurface(t)], t);
  else localStorage.removeItem(TOKEN_KEYS[activeSurface]);
};
export const getFleetToken = () => localStorage.getItem(TOKEN_KEYS[activeSurface]);
// Υπάρχει αποθηκευμένο session στη ΣΥΓΚΕΚΡΙΜΕΝΗ επιφάνεια; (ανεξάρτητα από την ενεργή)
export const hasFleetSession = (s) => !!localStorage.getItem(TOKEN_KEYS[s] || TOKEN_KEYS.fleet_admin);

const bearer = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

// AUTH (εταιρεία)
// Νέα εγγραφή εταιρείας: unified λογαριασμός (users, account_type=fleet_company)
export const apiFleetSignup = (payload) =>
  fleetApi.post("/fleet/signup", payload).then((r) => r.data);
export const apiFleetLogin = (payload) =>
  fleetApi.post("/fleet/login", payload).then((r) => r.data);
// Προαιρετικό ρητό token: επαλήθευση ταυτότητας ενός token που ΔΕΝ είναι
// (ακόμα) το αποθηκευμένο της ενεργής επιφάνειας
export const apiFleetMe = (token) =>
  fleetApi.get("/fleet/me", token ? bearer(token) : undefined).then((r) => r.data);

// ΜΕΛΗ
export const apiFleetMembers = () => fleetApi.get("/fleet/members").then((r) => r.data);
export const apiFleetCreateMember = (payload) =>
  fleetApi.post("/fleet/members", payload).then((r) => r.data);
export const apiFleetUpdateMember = (id, payload) =>
  fleetApi.put(`/fleet/members/${id}`, payload).then((r) => r.data);
export const apiFleetDeleteMember = (id) =>
  fleetApi.delete(`/fleet/members/${id}`).then((r) => r.data);
export const apiFleetSelectMember = (memberId, pin) =>
  fleetApi.post("/fleet/member/select", { member_id: memberId, pin }).then((r) => r.data);
export const apiFleetExitMember = () =>
  fleetApi.post("/fleet/member/exit").then((r) => r.data);
export const apiFleetResetMemberPassword = (id) =>
  fleetApi.post(`/fleet/members/${id}/reset-password`).then((r) => r.data);

// ΔΙΑΝΟΜΕΙΣ — προσωπικός λογαριασμός (τηλέφωνο/email + κωδικός). Το token της
// ροής περνιέται ρητά μέχρι την τελική επιλογή εταιρείας (adoptToken).
export const apiFleetDriverLogin = (identifier, password) =>
  fleetApi.post("/fleet/driver/login", { identifier, password }).then((r) => r.data);
export const apiFleetDriverChangePassword = (token, password) =>
  fleetApi.post("/fleet/driver/change-password", { password }, bearer(token)).then((r) => r.data);
export const apiFleetDriverSelect = (token, memberId) =>
  fleetApi.post("/fleet/driver/select", { member_id: memberId }, bearer(token)).then((r) => r.data);

// ΠΑΡΑΓΓΕΛΙΕΣ
export const apiFleetCreateOrder = (payload) =>
  fleetApi.post("/fleet/orders", payload).then((r) => r.data);
export const apiFleetBoard = (date) =>
  fleetApi.get("/fleet/board", { params: date ? { date } : {} }).then((r) => r.data);
export const apiFleetDriverBoard = () =>
  fleetApi.get("/fleet/driver/board").then((r) => r.data);
export const apiFleetClaimOrder = (id) =>
  fleetApi.post(`/fleet/orders/${id}/claim`).then((r) => r.data);
export const apiFleetOrderStatus = (id, status) =>
  fleetApi.post(`/fleet/orders/${id}/status`, { status }).then((r) => r.data);
export const apiFleetAssignOrder = (id, memberId) =>
  fleetApi.post(`/fleet/orders/${id}/assign`, { member_id: memberId }).then((r) => r.data);
export const apiFleetCancelOrder = (id) =>
  fleetApi.post(`/fleet/orders/${id}/cancel`).then((r) => r.data);

// AUTOCOMPLETE + ΣΥΝΟΛΑ
export const apiFleetPickupNames = () =>
  fleetApi.get("/fleet/pickup-names").then((r) => r.data);
export const apiFleetAddressBook = () =>
  fleetApi.get("/fleet/address-book").then((r) => r.data);
export const apiFleetDaySummary = (date) =>
  fleetApi.get("/fleet/day-summary", { params: date ? { date } : {} }).then((r) => r.data);
