import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
const TOKEN_KEY = "peinokio_token";

export const api = axios.create({ baseURL: API });

// attach token if present
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const setToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

// AUTH
export const apiRegister = (payload) => api.post("/auth/register", payload).then((r) => r.data);
export const apiLogin = (payload) => api.post("/auth/login", payload).then((r) => r.data);
export const apiMe = () => api.get("/auth/me").then((r) => r.data);

// MENU
export const apiGetMenuConfig = () => api.get("/menu/config").then((r) => r.data);
export const apiCreateCategory = (payload) => api.post("/menu/categories", payload).then((r) => r.data);
export const apiUpdateCategory = (id, payload) => api.put(`/menu/categories/${id}`, payload).then((r) => r.data);
export const apiDeleteCategory = (id) => api.delete(`/menu/categories/${id}`).then((r) => r.data);
export const apiCreateItem = (payload) => api.post("/menu/items", payload).then((r) => r.data);
export const apiUpdateItem = (id, payload) => api.put(`/menu/items/${id}`, payload).then((r) => r.data);
export const apiDeleteItem = (id) => api.delete(`/menu/items/${id}`).then((r) => r.data);
export const apiUpdateCustomization = (payload) => api.put("/menu/customization", payload).then((r) => r.data);

// ORDERS
export const fetchNextOrderNumber = async () => (await api.get("/orders/next-number")).data.next_order_number;
export const submitOrder = (payload) => api.post("/orders", payload).then((r) => r.data);
export const fetchOrders = (dateFrom, dateTo) =>
  api.get("/orders", { params: { date_from: dateFrom, date_to: dateTo } }).then((r) => r.data);

// ANALYTICS
export const fetchAnalytics = (dateFrom, dateTo) =>
  api.get("/analytics", { params: { date_from: dateFrom, date_to: dateTo } }).then((r) => r.data);

// Error helper
export function formatApiError(e) {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message || "Σφάλμα";
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d.map((x) => (x && typeof x.msg === "string" ? x.msg : JSON.stringify(x))).join(" · ");
  if (d && typeof d.msg === "string") return d.msg;
  return String(d);
}
