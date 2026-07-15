import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
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
export const apiStartDemo = (payload) => api.post("/auth/demo", payload).then((r) => r.data);
export const apiMe = () => api.get("/auth/me").then((r) => r.data);

// MENU
export const apiGetMenuConfig = () => api.get("/menu/config").then((r) => r.data);
export const apiCreateCategory = (payload) => api.post("/menu/categories", payload).then((r) => r.data);
export const apiUpdateCategory = (id, payload) => api.put(`/menu/categories/${id}`, payload).then((r) => r.data);
export const apiDeleteCategory = (id) => api.delete(`/menu/categories/${id}`).then((r) => r.data);
export const apiReorderCategories = (ids) => api.post("/menu/categories/reorder", { ids }).then((r) => r.data);
export const apiReorderItems = (ids) => api.post("/menu/items/reorder", { ids }).then((r) => r.data);
export const apiCreateItem = (payload) => api.post("/menu/items", payload).then((r) => r.data);
export const apiUpdateItem = (id, payload) => api.put(`/menu/items/${id}`, payload).then((r) => r.data);
export const apiDeleteItem = (id) => api.delete(`/menu/items/${id}`).then((r) => r.data);
export const apiUpdateCustomization = (payload) => api.put("/menu/customization", payload).then((r) => r.data);
export const apiBulkItems = (payload) => api.post("/menu/items/bulk", payload).then((r) => r.data);

// PROFILES / ROLES
export const apiListProfiles = () => api.get("/profiles").then((r) => r.data);
export const apiSelectProfile = (profileId, pin) =>
  api.post("/profile/select", { profile_id: profileId, pin }).then((r) => r.data);
export const apiExitProfile = () => api.post("/profile/exit").then((r) => r.data);
export const apiCreateProfile = (payload) =>
  api.post("/profiles", payload).then((r) => r.data);
export const apiUpdateProfile = (id, payload) =>
  api.put(`/profiles/${id}`, payload).then((r) => r.data);
export const apiDeleteProfile = (id) =>
  api.delete(`/profiles/${id}`).then((r) => r.data);

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

// STOCK PHOTO LIBRARY (κοινή βιβλιοθήκη OrderDeck)
// Μαγαζιά: μόνο οι stock φωτογραφίες του δικού τους business_type + εισαγωγή ως προσωπικό αντίγραφο
export const apiListStockPhotos = () => api.get("/stock-photos").then((r) => r.data);
export const apiImportStockPhoto = (stockId) =>
  api.post(`/photos/import-stock/${stockId}`).then((r) => r.data);

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
export const fetchOrders = (params) =>
  api.get("/orders", { params }).then((r) => r.data);
export const apiGetOrder = (id) => api.get(`/orders/${id}`).then((r) => r.data);
export const apiCancelOrder = (id, pin = null) =>
  api.post(`/orders/${id}/cancel`, { pin }).then((r) => r.data);
export const apiDeleteOrder = (id, pin = null) =>
  api.delete(`/orders/${id}`, { params: pin ? { pin } : {} }).then((r) => r.data);
export const apiVerifyOwnerPin = (pin) =>
  api.post("/auth/verify-owner-pin", { pin }).then((r) => r.data);
export const apiListScheduledOrders = () =>
  api.get("/orders/scheduled").then((r) => r.data);
export const apiActivateOrder = (id) =>
  api.post(`/orders/${id}/activate`).then((r) => r.data);

// CUSTOMERS
export const apiListCustomers = () => api.get("/customers").then((r) => r.data);

// TABLES (dine-in)
export const apiTablesState = () => api.get("/tables/state").then((r) => r.data);
export const apiToggleTables = (enabled) =>
  api.put("/settings/tables", { enabled }).then((r) => r.data);
export const apiCreateTable = (name) =>
  api.post("/tables", { name }).then((r) => r.data);
export const apiUpdateTable = (id, payload) =>
  api.put(`/tables/${id}`, payload).then((r) => r.data);
export const apiDeleteTable = (id) =>
  api.delete(`/tables/${id}`).then((r) => r.data);
export const apiReorderTables = (ids) =>
  api.post("/tables/reorder", { ids }).then((r) => r.data);
export const apiGetTableTab = (tableId) =>
  api.get(`/tables/${tableId}/tab`).then((r) => r.data);
export const apiSendRound = (tableId, items) =>
  api.post(`/tables/${tableId}/rounds`, { items }).then((r) => r.data);
export const apiCloseTab = (tabId) =>
  api.post(`/tabs/${tabId}/close`).then((r) => r.data);
export const apiTransferTab = (tabId, tableId) =>
  api.post(`/tabs/${tabId}/transfer`, { table_id: tableId }).then((r) => r.data);

// DAY CLOSE (Z-REPORT)
export const apiDaySummary = (date) =>
  api.get("/reports/day-summary", { params: date ? { date } : {} }).then((r) => r.data);
export const apiCloseDay = (date) =>
  api.post("/reports/day-close", { date: date || null }).then((r) => r.data);
export const apiListDayReports = () => api.get("/reports/day").then((r) => r.data);

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

// PUBLIC MENU (δημόσιος κατάλογος)
export const apiGetPublicMenuSettings = () =>
  api.get("/settings/public-menu").then((r) => r.data);
export const apiTogglePublicMenu = (enabled) =>
  api.put("/settings/public-menu", { enabled }).then((r) => r.data);
export const apiUpdatePublicSlug = (slug) =>
  api.put("/settings/public-menu/slug", { slug }).then((r) => r.data);
export const apiSetStoreLogo = (data_url) =>
  api.put("/settings/public-menu/logo", { data_url }).then((r) => r.data);
export const apiRemoveStoreLogo = () =>
  api.delete("/settings/public-menu/logo").then((r) => r.data);
// Public — χωρίς login
export const apiGetPublicMenu = (slug) =>
  api.get(`/public/menu/${encodeURIComponent(slug)}`).then((r) => r.data);

// PROMO CODES
export const apiValidatePromo = (code) =>
  api.post("/promo/validate", { code }).then((r) => r.data);
// Admin (ξεχωριστό password μέσω header — όχι JWT μαγαζιού)
const adminHeaders = (pw) => ({ headers: { "X-Admin-Password": pw } });
export const apiAdminListPromos = (pw) =>
  api.get("/admin/promo", adminHeaders(pw)).then((r) => r.data);
export const apiAdminCreatePromo = (pw, payload) =>
  api.post("/admin/promo", payload, adminHeaders(pw)).then((r) => r.data);
export const apiAdminTogglePromo = (pw, id, active) =>
  api.patch(`/admin/promo/${id}`, { active }, adminHeaders(pw)).then((r) => r.data);
export const apiAdminDeletePromo = (pw, id) =>
  api.delete(`/admin/promo/${id}`, adminHeaders(pw)).then((r) => r.data);
export const apiAdminPromoUses = (pw, id) =>
  api.get(`/admin/promo/${id}/uses`, adminHeaders(pw)).then((r) => r.data);

// STOCK PHOTOS — admin (ίδιο admin password με τους εκπτωτικούς κωδικούς)
export const apiAdminListStockPhotos = (pw, businessType) =>
  api
    .get("/admin/stock-photos", {
      ...adminHeaders(pw),
      params: businessType ? { business_type: businessType } : {},
    })
    .then((r) => r.data);
export const apiAdminCreateStockPhoto = (pw, payload) =>
  api.post("/admin/stock-photos", payload, adminHeaders(pw)).then((r) => r.data);
export const apiAdminDeleteStockPhoto = (pw, id) =>
  api.delete(`/admin/stock-photos/${id}`, adminHeaders(pw)).then((r) => r.data);

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
