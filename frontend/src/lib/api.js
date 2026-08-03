import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

// Αποκωδικοποίηση payload JWT ΧΩΡΙΣ επαλήθευση υπογραφής — μόνο για client-side
// έλεγχο σε ποια επιφάνεια (store/fleet/driver) και σε ποιον λογαριασμό ανήκει
// ένα αποθηκευμένο token. null αν το string δεν είναι έγκυρο JWT.
export const decodeJwtPayload = (t) => {
  try {
    const base64 = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
};

// ---------- SESSIONS ΚΑΤΑΣΤΗΜΑΤΟΣ (ανά ΛΟΓΑΡΙΑΣΜΟ, όχι ένα ενιαίο κλειδί) ----------
// Ο ίδιος browser μπορεί να έχει δύο λογαριασμούς καταστήματος ταυτόχρονα (π.χ. το
// ίδιο μαγαζί με πλάνο «orderdeck» και ένα δεύτερο με πλάνο «fleet»). Ένα κοινό
// κλειδί έκανε το login του ενός να σβήνει το session του άλλου και το refresh να
// φέρνει λάθος ταυτότητα/πλάνο. Οπότε:
//   LS  token_store_<accountId>   → το token του κάθε λογαριασμού (διαρκές)
//   LS  active_store_<surface>    → ο τελευταίος λογαριασμός ανά επιφάνεια
//                                   (αρχική τιμή για ΝΕΟ tab)
//   SS  active_store_account/_surface → ο λογαριασμός ΑΥΤΟΥ του tab — sessionStorage,
//                                   ώστε δύο tabs να μη «σκουπίζει» το ένα το άλλο
const TOKEN_PREFIX = "token_store_";
const ACTIVE_PREFIX = "active_store_";
const TAB_ACCOUNT_KEY = "active_store_account";
const TAB_SURFACE_KEY = "active_store_surface";
const LEGACY_TOKEN_KEY = "peinokio_token";

// Επιφάνειες: pos = OrderDeck POS (/app), fleet = FleetDeck καταστήματος
// (/app/fleet, πλάνο «fleet»), company = εταιρεία διανομής (/fleet)
export const STORE_SURFACES = ["pos", "fleet", "company"];

// Η επιφάνεια ΕΝΟΣ ΛΟΓΑΡΙΑΣΜΟΥ — πάντα από το ίδιο το /auth/me, ποτέ από cache UI
export const storeSurfaceForUser = (u) =>
  u?.account_type === "fleet_company" ? "company" : u?.plan === "fleet" ? "fleet" : "pos";

// Η επιφάνεια που ΠΑΕΙ ΝΑ ΑΠΟΔΩΣΕΙ ένα route — χρησιμοποιείται μόνο για να
// διαλέξει ένα ΝΕΟ tab ποιο αποθηκευμένο session θα υιοθετήσει
export const storeSurfaceForPath = (p = "") =>
  p === "/fleet" || p.startsWith("/fleet/")
    ? "company"
    : p === "/app/fleet" || p.startsWith("/app/fleet")
      ? "fleet"
      : "pos";

export const tokenAccountId = (t) => decodeJwtPayload(t)?.sub || null;

const ls = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* localStorage μη διαθέσιμο */
    }
  },
  del: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* localStorage μη διαθέσιμο */
    }
  },
};
const ss = {
  get: (k) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* sessionStorage μη διαθέσιμο */
    }
  },
  del: (k) => {
    try {
      sessionStorage.removeItem(k);
    } catch {
      /* sessionStorage μη διαθέσιμο */
    }
  },
};

const storedAccountIds = () => {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(TOKEN_PREFIX))
      .map((k) => k.slice(TOKEN_PREFIX.length));
  } catch {
    return [];
  }
};

// Μετανάστευση μία φορά από το παλιό ενιαίο κλειδί: το token πάει στο κλειδί του
// λογαριασμού του, ΧΩΡΙΣ δείκτη — η πρώτη ενυδάτωση το δένει στη σωστή επιφάνεια
// αφού μάθει το πλάνο από το /auth/me.
try {
  const legacy = ls.get(LEGACY_TOKEN_KEY);
  if (legacy) {
    const id = tokenAccountId(legacy);
    if (id) ls.set(TOKEN_PREFIX + id, legacy);
    ls.del(LEGACY_TOKEN_KEY);
  }
} catch {
  /* localStorage μη διαθέσιμο */
}

// Η επιφάνεια που «παίζει» σε αυτό το tab: αν το tab είναι ήδη δεμένο κρατά τη δική
// του, αλλιώς την υποδεικνύει το route εκκίνησης (μόνο για να διαλέξει ποιο
// αποθηκευμένο session θα υιοθετήσει). Μετά το login/την ενυδάτωση ξαναβγαίνει
// ΠΑΝΤΑ από το πλάνο του λογαριασμού.
let activeSurface = "pos";
export const setStoreSurface = (s) => {
  activeSurface = STORE_SURFACES.includes(s) ? s : "pos";
};
export const getStoreSurface = () => activeSurface;

setStoreSurface(
  ss.get(TAB_ACCOUNT_KEY)
    ? ss.get(TAB_SURFACE_KEY)
    : storeSurfaceForPath(typeof window === "undefined" ? "" : window.location.pathname)
);

// Ποιον λογαριασμό χρησιμοποιεί ΑΥΤΟ το tab: πρώτα ο δικός του δείκτης (sessionStorage),
// μετά ο τελευταίος της επιφάνειας, και τέλος — μόνο αν υπάρχει ΑΚΡΙΒΩΣ ένα session
// στη συσκευή — αυτό (καλύπτει και τη μετανάστευση από το παλιό κλειδί).
export const activeAccountId = () => {
  const tab = ss.get(TAB_ACCOUNT_KEY);
  if (tab) return tab;
  const bySurface = ls.get(ACTIVE_PREFIX + activeSurface);
  if (bySurface) return bySurface;
  const ids = storedAccountIds();
  return ids.length === 1 ? ids[0] : null;
};

// Από πού προέκυψε το τρέχον session:
//   "tab"     → αυτό το tab είναι ήδη δεμένο σε λογαριασμό
//   "surface" → ο δείκτης της επιφάνειας το διεκδικεί
//   "single"  → κανένας δείκτης· υπάρχει ΑΚΡΙΒΩΣ ένα session στη συσκευή
// Στα δύο πρώτα η επιφάνεια είναι δηλωμένη και μια αναντιστοιχία πλάνου σημαίνει
// λάθος λογαριασμός· στο τρίτο το tab απλώς υιοθετεί την επιφάνεια του token.
export const storeSessionSource = () => {
  if (ss.get(TAB_ACCOUNT_KEY)) return "tab";
  if (ls.get(ACTIVE_PREFIX + activeSurface)) return "surface";
  return storedAccountIds().length === 1 ? "single" : null;
};

export const getToken = () => {
  const id = activeAccountId();
  return id ? ls.get(TOKEN_PREFIX + id) : null;
};

// Καρφώνει αυτό το tab σε λογαριασμό + επιφάνεια. Καλείται μετά το login και μετά
// από επιτυχή ενυδάτωση, ΠΑΝΤΑ με στοιχεία που προέκυψαν από το token/το /auth/me.
export const bindStoreSession = (accountId, surface) => {
  if (!accountId) return;
  setStoreSurface(surface);
  ss.set(TAB_ACCOUNT_KEY, accountId);
  ss.set(TAB_SURFACE_KEY, activeSurface);
  ls.set(ACTIVE_PREFIX + activeSurface, accountId);
  // Ο ίδιος λογαριασμός δεν μπορεί να ανήκει σε δύο επιφάνειες (π.χ. άλλαξε πλάνο)
  STORE_SURFACES.forEach((s) => {
    if (s !== activeSurface && ls.get(ACTIVE_PREFIX + s) === accountId) ls.del(ACTIVE_PREFIX + s);
  });
};

// Καθαρίζει ΜΟΝΟ τους δείκτες αυτού του tab/της επιφάνειας — το token του
// λογαριασμού μένει (χρησιμοποιείται στο mismatch: πίσω στο login χωρίς να πέσει
// το session του άλλου tab).
export const clearStorePointer = () => {
  const id = activeAccountId();
  ss.del(TAB_ACCOUNT_KEY);
  if (id && ls.get(ACTIVE_PREFIX + activeSurface) === id) ls.del(ACTIVE_PREFIX + activeSurface);
};

// user: το αντικείμενο του /auth/me ή του login (για να βγει η επιφάνεια από το
// πλάνο του λογαριασμού). null token = αποσύνδεση ΑΥΤΟΥ του λογαριασμού μόνο.
export const setToken = (t, user = null) => {
  if (!t) {
    const id = activeAccountId();
    if (id) ls.del(TOKEN_PREFIX + id);
    clearStorePointer();
    return;
  }
  const id = tokenAccountId(t);
  if (!id) return;
  ls.set(TOKEN_PREFIX + id, t);
  bindStoreSession(id, user ? storeSurfaceForUser(user) : activeSurface);
};

// attach token if present — ρητό Authorization header (π.χ. exchange με άλλο token) έχει προτεραιότητα
api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t && !cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// AUTH
export const apiRegister = (payload) => api.post("/auth/register", payload).then((r) => r.data);
export const apiLogin = (payload) => api.post("/auth/login", payload).then((r) => r.data);
export const apiStartDemo = (payload) => api.post("/auth/demo", payload).then((r) => r.data);
export const apiMe = () => api.get("/auth/me").then((r) => r.data);
// Προφίλ με pin hashes για τοπική cache (offline login) — ΔΕΝ εμφανίζονται πουθενά στο UI
export const apiOfflineProfiles = () => api.get("/auth/offline-profiles").then((r) => r.data);

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
export const apiAutoNumberItems = () => api.post("/menu/items/auto-number").then((r) => r.data);
export const apiRenumberItems = (payload) => api.post("/menu/items/renumber", payload).then((r) => r.data);

// PROFILES / ROLES
export const apiListProfiles = () => api.get("/profiles").then((r) => r.data);
export const apiSelectProfile = (profileId, pin) =>
  api.post("/profile/select", { profile_id: profileId, pin }).then((r) => r.data);
export const apiExitProfile = () => api.post("/profile/exit").then((r) => r.data);
export const apiChangeOwnPin = (pin) =>
  api.post("/profile/change-pin", { pin }).then((r) => r.data);
export const apiCreateProfile = (payload) =>
  api.post("/profiles", payload).then((r) => r.data);
export const apiUpdateProfile = (id, payload) =>
  api.put(`/profiles/${id}`, payload).then((r) => r.data);
export const apiDeleteProfile = (id) =>
  api.delete(`/profiles/${id}`).then((r) => r.data);

// SHOPPING
export const apiListShopping = () => api.get("/shopping").then((r) => r.data);
export const apiAddShopping = (text, categoryId = null) =>
  api.post("/shopping", { text, category_id: categoryId }).then((r) => r.data);
export const apiUpdateShopping = (id, payload) => api.put(`/shopping/${id}`, payload).then((r) => r.data);
export const apiDeleteShopping = (id) => api.delete(`/shopping/${id}`).then((r) => r.data);
export const apiResetShopping = () => api.post("/shopping/reset").then((r) => r.data);
export const apiRecordShoppingPrint = (items) =>
  api.post("/shopping/print", { items }).then((r) => r.data);
export const apiListShoppingPrints = (skip = 0, limit = 20) =>
  api.get("/shopping/prints", { params: { skip, limit } }).then((r) => r.data);

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
export const apiReorderStockCategories = (ids) =>
  api.post("/stock/categories/reorder", { ids }).then((r) => r.data);
export const apiCreateStockItem = (payload) =>
  api.post("/stock/items", payload).then((r) => r.data);
export const apiUpdateStockItem = (id, payload) =>
  api.patch(`/stock/items/${id}`, payload).then((r) => r.data);
export const apiReorderStockItems = (ids) =>
  api.post("/stock/items/reorder", { ids }).then((r) => r.data);
export const apiToggleStockItemShopping = (id, needs) =>
  api.post(`/stock/items/${id}/shopping`, { needs }).then((r) => r.data);
export const apiToggleStockCategoryShopping = (cid, needs) =>
  api.post(`/stock/categories/${cid}/shopping`, { needs }).then((r) => r.data);
export const apiDeleteStockItem = (id) =>
  api.delete(`/stock/items/${id}`).then((r) => r.data);

// CHECKLIST (άνοιγμα/κλείσιμο καταστήματος)
export const apiChecklistToday = () => api.get("/checklist/today").then((r) => r.data);
export const apiChecklistTick = (templateId, done) =>
  api.post("/checklist/tick", { template_id: templateId, done }).then((r) => r.data);
export const apiChecklistTemplates = () =>
  api.get("/checklist/templates").then((r) => r.data);
export const apiChecklistCreateTemplate = (list, text, date = null) =>
  api.post("/checklist/templates", { list, text, date: date || null }).then((r) => r.data);
export const apiChecklistUpdateTemplate = (id, text) =>
  api.put(`/checklist/templates/${id}`, { text }).then((r) => r.data);
export const apiChecklistDeleteTemplate = (id) =>
  api.delete(`/checklist/templates/${id}`).then((r) => r.data);
export const apiChecklistReorder = (list, ids) =>
  api.post("/checklist/templates/reorder", { list, ids }).then((r) => r.data);
export const apiChecklistHistory = (days = 14) =>
  api.get("/checklist/history", { params: { days } }).then((r) => r.data);

// EMPLOYEES
export const apiListEmployees = () => api.get("/employees").then((r) => r.data);
export const apiCreateEmployee = (name) => api.post("/employees", { name }).then((r) => r.data);
export const apiUpdateEmployee = (id, name) => api.put(`/employees/${id}`, { name }).then((r) => r.data);
export const apiDeleteEmployee = (id) => api.delete(`/employees/${id}`).then((r) => r.data);

// SHIFTS
export const apiListShifts = (weekStart) =>
  api.get("/shifts", { params: { week_start: weekStart } }).then((r) => r.data);
export const apiUpsertShift = (payload) => api.put("/shifts", payload).then((r) => r.data);
export const apiListShiftWeeks = () => api.get("/shifts/weeks").then((r) => r.data);
export const apiDeleteShift = (employeeId, weekStart, day) =>
  api.delete("/shifts", { params: { employee_id: employeeId, week_start: weekStart, day } }).then((r) => r.data);

// ORDERS
export const fetchNextOrderNumber = async () => (await api.get("/orders/next-number")).data.next_order_number;
export const submitOrder = (payload) => api.post("/orders", payload).then((r) => r.data);
export const fetchOrders = (params) =>
  api.get("/orders", { params }).then((r) => r.data);
export const fetchOrdersCount = (params) =>
  api.get("/orders/count", { params }).then((r) => r.data);
export const apiGetOrder = (id) => api.get(`/orders/${id}`).then((r) => r.data);
export const apiCancelOrder = (id, pin = null) =>
  api.post(`/orders/${id}/cancel`, { pin }).then((r) => r.data);
export const apiDeleteOrder = (id, pin = null) =>
  api.delete(`/orders/${id}`, { params: pin ? { pin } : {} }).then((r) => r.data);
export const apiEditOrder = (id, payload) =>
  api.put(`/orders/${id}`, payload).then((r) => r.data);
export const apiVerifyOwnerPin = (pin) =>
  api.post("/auth/verify-owner-pin", { pin }).then((r) => r.data);
export const apiListScheduledOrders = () =>
  api.get("/orders/scheduled").then((r) => r.data);
export const apiActivateOrder = (id) =>
  api.post(`/orders/${id}/activate`).then((r) => r.data);
// Live χάρτης: παραγγελίες παράδοσης τελευταίων 30' με συντεταγμένες
export const apiLiveMapOrders = () =>
  api.get("/orders/live-map").then((r) => r.data);
export const apiClearLiveMap = () =>
  api.post("/orders/live-map/clear").then((r) => r.data);

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
// Εργάσιμες ημέρες με κίνηση — για την επιλογή παλιάς ημέρας στο Z
export const apiBusinessDays = () =>
  api.get("/reports/business-days").then((r) => r.data);

// ANALYTICS
export const fetchAnalytics = (dateFrom, dateTo, source = "all") =>
  api
    .get("/analytics", { params: { date_from: dateFrom, date_to: dateTo, source } })
    .then((r) => r.data);

export const fetchAnalyticsYoY = (dateFrom, dateTo) =>
  api.get("/analytics/yoy", { params: { date_from: dateFrom, date_to: dateTo } }).then((r) => r.data);
export const apiOrdersHeatmap = (dateFrom, dateTo) =>
  api.get("/orders/heatmap", { params: { date_from: dateFrom, date_to: dateTo } }).then((r) => r.data);

// DECK VIEW (live overview ημέρας)
export const fetchDeckOverview = (source = "all") =>
  api.get("/deck/overview", { params: { source } }).then((r) => r.data);

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
// Ρυθμίσεις καταλόγου (owner) — ελάχιστη παραγγελία, χρέωση delivery, σύνδεσμοι πλατφορμών
export const apiUpdateCatalogSettings = (payload) =>
  api.put("/settings/catalog", payload).then((r) => r.data);
// Στοιχεία καταστήματος (owner) — όνομα, τηλέφωνο, διεύθυνση, τοποθεσία
export const apiUpdateStoreDetails = (payload) =>
  api.put("/settings/store", payload).then((r) => r.data);
// Γνωστές διευθύνσεις πελατών (από προηγούμενες παραγγελίες) για autocomplete στη φόρμα παράδοσης
export const apiAddressBook = () => api.get("/orders/address-book").then((r) => r.data);
// Autocomplete διευθύνσεων μέσω Photon (komoot) — δωρεάν geocoder που ΕΠΙΤΡΕΠΕΙ typeahead
// (το Nominatim το απαγορεύει στο usage policy του). Bias στις συντεταγμένες του καταστήματος.
// ΧΩΡΙΣ lang param: το Photon δεν υποστηρίζει "el" (γυρνάει HTTP 400) — το default δίνει τα τοπικά ονόματα
export const photonSearch = (q, { lat, lon, bbox, signal } = {}) => {
  const params = new URLSearchParams({ q, limit: "5" });
  if (lat != null && lon != null) {
    params.set("lat", lat);
    params.set("lon", lon);
  }
  // bbox = "minLon,minLat,maxLon,maxLat" — κόβει στο API αποτελέσματα εκτός ζώνης διανομής
  if (bbox) params.set("bbox", bbox);
  return fetch(`https://photon.komoot.io/api/?${params.toString()}`, { signal }).then((r) => {
    if (!r.ok) {
      console.warn(`Photon geocoder: HTTP ${r.status}`);
      return { features: [] };
    }
    return r.json();
  });
};
// Geocoding μέσω Nominatim (OpenStreetMap) — δωρεάν, χωρίς API key
export const geocodeAddress = (q) =>
  fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
    { headers: { "Accept-Language": "el" } }
  ).then((r) => r.json());
// Κέντρο πόλης για default θέα χαρτών όταν δεν υπάρχει αποθηκευμένο pin —
// cached ανά πόλη στο session (και τα null: μη βρεθείσα πόλη δεν ξαναζητιέται)
const cityCenterCache = new Map();
export const geocodeCityCenter = async (city) => {
  const key = (city || "").trim().toLowerCase();
  if (!key) return null;
  if (cityCenterCache.has(key)) return cityCenterCache.get(key);
  try {
    const results = await geocodeAddress(city.trim());
    const c = results?.[0]
      ? { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
      : null;
    cityCenterCache.set(key, c);
    return c;
  } catch {
    return null; // offline/σφάλμα — ΔΕΝ γράφεται στο cache, θα ξαναδοκιμαστεί
  }
};
// Ρυθμίσεις εκτύπωσης (owner)
export const apiUpdatePrinting = (payload) =>
  api.put("/settings/printing", payload).then((r) => r.data);

// Print Bridge — jobs από κάθε προφίλ, token μόνο owner
export const apiCreatePrintJob = (payload) =>
  api.post("/print/jobs", payload).then((r) => r.data);
export const apiGetPrintJob = (id) => api.get(`/print/jobs/${id}`).then((r) => r.data);
export const apiGetBridgeToken = () => api.get("/print/bridge/token").then((r) => r.data);
export const apiRotateBridgeToken = () =>
  api.post("/print/bridge/token").then((r) => r.data);
export const apiRelayPoll = () => api.post("/print/relay/poll").then((r) => r.data);
// SSE stream νέων print jobs για τον σταθμό — με fetch (όχι EventSource) ώστε το
// JWT να πάει σε Authorization header και όχι σε query string.
export const relayJobsStream = (signal) =>
  fetch(`${API}/print/jobs/stream`, {
    headers: { Authorization: `Bearer ${getToken() || ""}` },
    signal,
  });
export const apiRelayAck = (id, status, error = null) =>
  api.post(`/print/relay/jobs/${id}/ack`, { status, error }).then((r) => r.data);
export const apiRelayRetry = (id) =>
  api.post(`/print/relay/jobs/${id}/retry`).then((r) => r.data);
export const apiRelayStatus = () => api.get("/print/relay/status").then((r) => r.data);

// Branding (λογότυπο μαγαζιού) — προσβάσιμο από κάθε συνδεδεμένο προφίλ
export const apiGetBranding = () => api.get("/branding").then((r) => r.data);
// Public — χωρίς login
export const apiGetPublicMenu = (slug) =>
  api.get(`/public/menu/${encodeURIComponent(slug)}`).then((r) => r.data);

// PROMO CODES
export const apiValidatePromo = (code) =>
  api.post("/promo/validate", { code }).then((r) => r.data);
// Admin auth (όχι JWT μαγαζιού): master = σκέτο password → X-Admin-Password,
// sub-admin = credential "jwt:<token>" → X-Admin-Token (ίδιο /admin gate)
const adminHeaders = (pw) =>
  pw && pw.startsWith("jwt:")
    ? { headers: { "X-Admin-Token": pw.slice(4) } }
    : { headers: { "X-Admin-Password": pw } };
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

// ADMIN PANEL — επισκόπηση, μαγαζιά, συνδρομές, leads (ίδιο admin password)
export const apiAdminPing = (pw) =>
  api.get("/admin/ping", adminHeaders(pw)).then((r) => r.data);
export const apiAdminOverview = (pw) =>
  api.get("/admin/overview", adminHeaders(pw)).then((r) => r.data);
export const apiAdminListShops = (pw, params) =>
  api.get("/admin/shops", { ...adminHeaders(pw), params }).then((r) => r.data);
export const apiAdminShopDetail = (pw, id) =>
  api.get(`/admin/shops/${id}`, adminHeaders(pw)).then((r) => r.data);
export const apiAdminUpdateShop = (pw, id, payload) =>
  api.patch(`/admin/shops/${id}`, payload, adminHeaders(pw)).then((r) => r.data);
export const apiAdminResetProfilePin = (pw, shopId, profileId, pin) =>
  api
    .post(`/admin/shops/${shopId}/profiles/${profileId}/reset-pin`, { pin }, adminHeaders(pw))
    .then((r) => r.data);
export const apiAdminDeleteShop = (pw, id, confirm) =>
  api
    .delete(`/admin/shops/${id}`, { ...adminHeaders(pw), params: { confirm } })
    .then((r) => r.data);
export const apiAdminExpiringSubs = (pw) =>
  api.get("/admin/subscriptions/expiring", adminHeaders(pw)).then((r) => r.data);
export const apiAdminLeads = (pw, params) =>
  api.get("/admin/leads", { ...adminHeaders(pw), params }).then((r) => r.data);

// ΕΤΑΙΡΙΕΣ DELIVERY (OrderDeck Fleet) — admin (ίδιο admin password)
export const apiAdminListFleet = (pw, params) =>
  api.get("/admin/fleet", { ...adminHeaders(pw), params }).then((r) => r.data);
export const apiAdminFleetDetail = (pw, id) =>
  api.get(`/admin/fleet/${id}`, adminHeaders(pw)).then((r) => r.data);
export const apiAdminUpdateFleet = (pw, id, payload) =>
  api.patch(`/admin/fleet/${id}`, payload, adminHeaders(pw)).then((r) => r.data);
export const apiAdminDeleteFleet = (pw, id, confirm) =>
  api
    .delete(`/admin/fleet/${id}`, { ...adminHeaders(pw), params: { confirm } })
    .then((r) => r.data);

// DEMO ΛΟΓΑΡΙΑΣΜΟΙ — δημιουργία/επαναφορά/διαγραφή από τον admin (μαγαζί ή εταιρία)
export const apiAdminCreateDemo = (pw, payload) =>
  api.post("/admin/demos", payload, adminHeaders(pw)).then((r) => r.data);
export const apiAdminResetDemo = (pw, id) =>
  api.post(`/admin/demos/${id}/reset`, {}, adminHeaders(pw)).then((r) => r.data);
export const apiAdminResetDemoPassword = (pw, id) =>
  api.post(`/admin/demos/${id}/reset-password`, {}, adminHeaders(pw)).then((r) => r.data);
export const apiAdminDeleteDemo = (pw, id) =>
  api.delete(`/admin/demos/${id}`, adminHeaders(pw)).then((r) => r.data);

// ΑΝΑΚΟΙΝΩΣΕΙΣ — admin CRUD (ίδιο admin password) + active για την εφαρμογή
export const apiAdminListAnnouncements = (pw) =>
  api.get("/admin/announcements", adminHeaders(pw)).then((r) => r.data);
export const apiAdminCreateAnnouncement = (pw, payload) =>
  api.post("/admin/announcements", payload, adminHeaders(pw)).then((r) => r.data);
export const apiAdminUpdateAnnouncement = (pw, id, payload) =>
  api.patch(`/admin/announcements/${id}`, payload, adminHeaders(pw)).then((r) => r.data);
export const apiAdminDeleteAnnouncement = (pw, id) =>
  api.delete(`/admin/announcements/${id}`, adminHeaders(pw)).then((r) => r.data);
export const apiActiveAnnouncement = () =>
  api.get("/announcements/active").then((r) => r.data);

// ΔΙΑΧΕΙΡΙΣΤΕΣ (sub-admins) — login/αλλαγή κωδικού για sub-admin, CRUD+audit μόνο master
export const apiAdminLogin = (email, password) =>
  api.post("/admin/auth/login", { email, password }).then((r) => r.data);
export const apiAdminChangePassword = (pw, password) =>
  api.post("/admin/auth/change-password", { password }, adminHeaders(pw)).then((r) => r.data);
export const apiAdminListAdmins = (pw) =>
  api.get("/admin/admins", adminHeaders(pw)).then((r) => r.data);
export const apiAdminCreateAdmin = (pw, payload) =>
  api.post("/admin/admins", payload, adminHeaders(pw)).then((r) => r.data);
export const apiAdminUpdateAdmin = (pw, id, payload) =>
  api.put(`/admin/admins/${id}`, payload, adminHeaders(pw)).then((r) => r.data);
export const apiAdminResetAdminPassword = (pw, id) =>
  api.post(`/admin/admins/${id}/reset-password`, {}, adminHeaders(pw)).then((r) => r.data);
export const apiAdminDeleteAdmin = (pw, id) =>
  api.delete(`/admin/admins/${id}`, adminHeaders(pw)).then((r) => r.data);
export const apiAdminAudit = (pw, params) =>
  api.get("/admin/audit", { ...adminHeaders(pw), params }).then((r) => r.data);

// ONBOARDING (checklist πρώτων βημάτων νέου μαγαζιού — owner)
export const apiOnboardingStatus = () => api.get("/onboarding/status").then((r) => r.data);
export const apiOnboardingHide = () => api.post("/onboarding/hide").then((r) => r.data);
export const apiOnboardingMarkPrint = () =>
  api.post("/onboarding/print-test").then((r) => r.data);

// AI — DeckPilot & ημερήσιο brief (owner only)
export const apiAiChat = (messages) =>
  api.post("/ai/chat", { messages }).then((r) => r.data);
export const apiGetBrief = (mode) =>
  api.get("/ai/brief", { params: { mode } }).then((r) => r.data);
export const apiCreateBrief = (mode, force = false) =>
  api.post("/ai/brief", { mode, force }).then((r) => r.data);

// ΣΥΝΔΡΟΜΗ — self-service ιδιοκτήτη (χειροκίνητη χρέωση μέχρι το Stripe)
export const apiGetSubscription = () =>
  api.get("/billing/subscription").then((r) => r.data);
export const apiRequestBillingChange = (addon, action) =>
  api.post("/billing/request-change", { addon, action }).then((r) => r.data);
export const apiCancelBillingRequest = () =>
  api.delete("/billing/request-change").then((r) => r.data);

// Unified auth → OrderDeck Fleet: ανταλλαγή του token λογαριασμού με team-level
// fleet token (λογαριασμοί fleet_company ή store plan fleet/orderdeck_fleet)
// Προαιρετικό ρητό token: το FleetLogin ανταλλάσσει unified credentials ΧΩΡΙΣ να
// αγγίξει το αποθηκευμένο store session αυτού του browser
export const apiFleetExchange = (token) =>
  api
    .post("/fleet/exchange", null, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
    .then((r) => r.data);

// FLEETDECK ΚΑΤΑΣΤΗΜΑΤΟΣ (πλάνο «fleet») — store JWT, όχι fleet token:
// συνεργασίες με εταιρείες διανομής + ανέβασμα παραγγελιών στους οδηγούς τους
export const apiStoreFleetCompanies = () =>
  api.get("/store/fleet/companies").then((r) => r.data);
export const apiStoreFleetRequestPartner = (teamId) =>
  api.post(`/store/fleet/partners/${teamId}/request`).then((r) => r.data);
export const apiStoreFleetEndPartnership = (pid) =>
  api.post(`/store/fleet/partnerships/${pid}/end`).then((r) => r.data);
export const apiStoreFleetBoard = (teamId) =>
  api
    .get("/store/fleet/board", { params: teamId ? { team_id: teamId } : {} })
    .then((r) => r.data);
export const apiStoreFleetCreateOrder = (payload) =>
  api.post("/store/fleet/orders", payload).then((r) => r.data);
export const apiStoreFleetCancelOrder = (id) =>
  api.post(`/store/fleet/orders/${id}/cancel`).then((r) => r.data);
export const apiStoreFleetAddressBook = () =>
  api.get("/store/fleet/address-book").then((r) => r.data);
export const apiStoreFleetStats = (params) =>
  api.get("/store/fleet/stats", { params }).then((r) => r.data);

// ---------- Πλατφόρμες delivery (efood / Box / Wolt) ----------
export const apiPlatformSettings = () => api.get("/platforms/settings").then((r) => r.data);
export const apiTogglePlatform = (platform, enabled) =>
  api.put(`/platforms/${platform}/enabled`, { enabled }).then((r) => r.data);
export const apiSetPlatformStoreOpen = (platform, isOpen) =>
  api.put(`/platforms/${platform}/store-open`, { is_open: isOpen }).then((r) => r.data);
export const apiUploadPlatformSound = (platform, dataUrl, name) =>
  api.put(`/platforms/${platform}/sound`, { data_url: dataUrl, name }).then((r) => r.data);
export const apiResetPlatformSound = (platform) =>
  api.delete(`/platforms/${platform}/sound`).then((r) => r.data);
// Ο ήχος έρχεται ως bytes από το ΔΙΚΟ ΜΑΣ API και γίνεται blob στη συσκευή (cached)
export const apiFetchPlatformSound = (platform) =>
  api.get(`/platforms/${platform}/sound`, { responseType: "blob" }).then((r) => r.data);
export const apiPlatformOrders = (platform) =>
  api.get("/platforms/orders", { params: platform ? { platform } : {} }).then((r) => r.data);
export const apiPlatformRecent = (platform, skip = 0, limit = 20) =>
  api.get("/platforms/orders/recent", { params: { platform, skip, limit } }).then((r) => r.data);
export const apiAcceptPlatformOrder = (id, readyMinutes) =>
  api.post(`/platforms/orders/${id}/accept`, { ready_minutes: readyMinutes }).then((r) => r.data);
export const apiRejectPlatformOrder = (id, reason = null) =>
  api.post(`/platforms/orders/${id}/reject`, { reason }).then((r) => r.data);
export const apiPlatformReadyTime = (id, readyMinutes) =>
  api.post(`/platforms/orders/${id}/ready-time`, { ready_minutes: readyMinutes }).then((r) => r.data);
export const apiPlatformOutForDelivery = (id) =>
  api.post(`/platforms/orders/${id}/out-for-delivery`).then((r) => r.data);
export const apiCompletePlatformOrder = (id) =>
  api.post(`/platforms/orders/${id}/complete`).then((r) => r.data);
export const apiCreateTestPlatformOrder = (platform) =>
  api.post("/platforms/test-order", { platform }).then((r) => r.data);

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
