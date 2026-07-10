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
export const apiSetItemAvailability = (id, payload) =>
  api.patch(`/menu/items/${id}/availability`, payload).then((r) => r.data);
export const apiBulkItems = (payload) => api.post("/menu/items/bulk", payload).then((r) => r.data);

// PROFILE / ROLES
export const apiSelectProfile = (profile, pin) =>
  api.post("/profile/select", { profile, pin }).then((r) => r.data);
export const apiExitProfile = () => api.post("/profile/exit").then((r) => r.data);
export const apiChangePin = (target, new_pin) =>
  api.put("/profile/pin", { target, new_pin }).then((r) => r.data);

// SHOPPING
export const apiListShopping = () => api.get("/shopping").then((r) => r.data);
export const apiAddShopping = (text) => api.post("/shopping", { text }).then((r) => r.data);
export const apiUpdateShopping = (id, payload) => api.put(`/shopping/${id}`, payload).then((r) => r.data);
export const apiDeleteShopping = (id) => api.delete(`/shopping/${id}`).then((r) => r.data);
export const apiResetShopping = () => api.post("/shopping/reset").then((r) => r.data);

// PHOTOS
export const apiListPhotos = () => api.get("/photos").then((r) => r.data);
export const apiCreatePhoto = (payload) => api.post("/photos", payload).then((r) => r.data);
export const apiDeletePhoto = (id) => api.delete(`/photos/${id}`).then((r) => r.data);

// STOCK (independent custom inventory)
export const apiGetStockConfig = () => api.get("/stock/config").then((r) => r.data);
export const apiCreateStockCategory = (payload) =>
  api.post("/stock/categories", payload).then((r) => r.data);
export const apiUpdateStockCategory = (id, payload) =>
  api.put(`/stock/categories/${id}`, payload).then((r) => r.data);
export const apiDeleteStockCategory = (id) =>
  api.delete(`/stock/categories/${id}`).then((r) => r.data);
export const apiCreateStockItem = (payload) =>
  api.post("/stock/items", payload).then((r) => r.data);
export const apiUpdateStockItem = (id, payload) =>
  api.patch(`/stock/items/${id}`, payload).then((r) => r.data);
export const apiToggleStockItemShopping = (id, needs) =>
  api.post(`/stock/items/${id}/shopping`, { needs }).then((r) => r.data);
export const apiDeleteStockItem = (id) =>
  api.delete(`/stock/items/${id}`).then((r) => r.data);

// EMPLOYEES
export const apiListEmployees = () => api.get("/employees").then((r) => r.data);
export const apiCreateEmployee = (name) => api.post("/employees", { name }).then((r) => r.data);
export const apiUpdateEmployee = (id, name) => api.put(`/employees/${id}`, { name }).then((r) => r.data);
export const apiDeleteEmployee = (id) => api.delete(`/employees/${id}`).then((r) => r.data);

// SHIFTS
export const apiListShifts = (weekStart) =>
  api.get("/shifts", { params: { week_start: weekStart } }).then((r) => r.data);
export const apiUpsertShift = (payload) => api.put("/shifts", payload).then((r) => r.data);
export const apiDeleteShift = (employeeId, weekStart, day) =>
  api.delete("/shifts", { params: { employee_id: employeeId, week_start: weekStart, day } }).then((r) => r.data);

// ORDERS
export const fetchNextOrderNumber = async () => (await api.get("/orders/next-number")).data.next_order_number;
export const submitOrder = (payload) => api.post("/orders", payload).then((r) => r.data);
export const fetchOrders = (dateFrom, dateTo) =>
  api.get("/orders", { params: { date_from: dateFrom, date_to: dateTo } }).then((r) => r.data);

// ANALYTICS
export const fetchAnalytics = (dateFrom, dateTo) =>
  api.get("/analytics", { params: { date_from: dateFrom, date_to: dateTo } }).then((r) => r.data);

// EXPENSES
export const apiListExpenseCategories = () =>
  api.get("/expenses/categories").then((r) => r.data);
export const apiCreateExpenseCategory = (payload) =>
  api.post("/expenses/categories", payload).then((r) => r.data);
export const apiUpdateExpenseCategory = (id, payload) =>
  api.put(`/expenses/categories/${id}`, payload).then((r) => r.data);
export const apiDeleteExpenseCategory = (id) =>
  api.delete(`/expenses/categories/${id}`).then((r) => r.data);
export const apiListExpenses = (params) =>
  api.get("/expenses", { params }).then((r) => r.data);
export const apiCreateExpense = (payload) =>
  api.post("/expenses", payload).then((r) => r.data);
export const apiUpdateExpense = (id, payload) =>
  api.put(`/expenses/${id}`, payload).then((r) => r.data);
export const apiDeleteExpense = (id) =>
  api.delete(`/expenses/${id}`).then((r) => r.data);

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
