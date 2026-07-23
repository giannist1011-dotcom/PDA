// OrderDeck Fleet — ΟΛΕΣ οι κλήσεις του /fleet namespace ζουν εδώ (όπως το api.js
// για τα μαγαζιά). Ξεχωριστό token από το POS: μια συσκευή μπορεί να έχει και τα δύο.
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const FLEET_TOKEN_KEY = "orderdeck_fleet_token";

export const fleetApi = axios.create({ baseURL: `${BACKEND_URL}/api` });

fleetApi.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(FLEET_TOKEN_KEY);
  // Ρητό token (π.χ. ροή driver login πριν αποθηκευτεί session) έχει προτεραιότητα
  if (t && !cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const setFleetToken = (t) => {
  if (t) localStorage.setItem(FLEET_TOKEN_KEY, t);
  else localStorage.removeItem(FLEET_TOKEN_KEY);
};
export const getFleetToken = () => localStorage.getItem(FLEET_TOKEN_KEY);

// AUTH (εταιρεία)
// Νέα εγγραφή εταιρείας: unified λογαριασμός (users, account_type=fleet_company)
export const apiFleetSignup = (payload) =>
  fleetApi.post("/fleet/signup", payload).then((r) => r.data);
export const apiFleetLogin = (payload) =>
  fleetApi.post("/fleet/login", payload).then((r) => r.data);
export const apiFleetMe = () => fleetApi.get("/fleet/me").then((r) => r.data);

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
const bearer = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
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
