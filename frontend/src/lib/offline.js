// Offline mode (PWA): τοπική cache δεδομένων ταμείου + ουρά παραγγελιών σε IndexedDB.
//
// - cache store: menu config, ενεργό προφίλ (/auth/me), branding, next order number
// - queue store: παραγγελίες που γράφτηκαν χωρίς σύνδεση ("pending sync")
// - syncQueue(): ανεβάζει την ουρά FIFO μόλις επανέλθει σύνδεση (idempotent μέσω client_id)
//
// Το online path ΔΕΝ αλλάζει: η cache γράφεται μόνο μετά από επιτυχημένες κλήσεις
// και διαβάζεται μόνο όταν το δίκτυο αποτύχει.
import { useEffect, useState } from "react";
import { api, apiGetMenuConfig, apiMe, submitOrder } from "@/lib/api";

const DB_NAME = "orderdeck-offline";
const DB_VERSION = 1;

// ---------- IndexedDB helpers ----------
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB μη διαθέσιμη"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "key" });
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "client_id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const out = fn(store);
        t.oncomplete = () => resolve(out?.result);
        t.onerror = () => reject(t.error);
      })
  );
}

export const cacheSet = (key, value) =>
  tx("cache", "readwrite", (s) => s.put({ key, value, saved_at: new Date().toISOString() })).catch(() => {});

export const cacheGet = (key) =>
  tx("cache", "readonly", (s) => s.get(key))
    .then((row) => (row ? row.value : null))
    .catch(() => null);

// ---------- Κατάσταση σύνδεσης (browser online + προσβασιμότητα server) ----------
// Δεν αρκεί το navigator.onLine — το WiFi μπορεί να είναι πάνω αλλά ο server κάτω.
const state = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  serverDown: false,
  pending: 0,
  syncing: false,
};
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn(getOfflineState()));

export const getOfflineState = () => ({
  offline: !state.online || state.serverDown,
  pending: state.pending,
  syncing: state.syncing,
});

export const isNetworkError = (e) => !!e && !e.response; // axios: χωρίς response = δεν έφτασε στον server

export const markServerDown = () => {
  if (!state.serverDown) {
    state.serverDown = true;
    notify();
  }
};

export const markServerUp = () => {
  if (state.serverDown) {
    state.serverDown = false;
    notify();
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    state.online = true;
    notify();
    syncQueue();
  });
  window.addEventListener("offline", () => {
    state.online = false;
    notify();
  });
}

async function refreshPending() {
  const rows = await tx("queue", "readonly", (s) => s.getAll()).catch(() => []);
  state.pending = (rows || []).length;
  notify();
  return rows || [];
}

// React hook: { offline, pending, syncing }
export function useOfflineStatus() {
  const [snap, setSnap] = useState(getOfflineState());
  useEffect(() => {
    listeners.add(setSnap);
    refreshPending();
    return () => listeners.delete(setSnap);
  }, []);
  return snap;
}

// ---------- Ουρά offline παραγγελιών ----------
export async function enqueueOrder(payload) {
  const client_id = `off-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    ...payload,
    client_id,
    client_created_at: new Date().toISOString(), // ΤΟΠΙΚΗ ώρα δημιουργίας — σωστά στατιστικά
  };
  await tx("queue", "readwrite", (s) => s.put(entry));
  // Τοπική αρίθμηση: η επόμενη παραγγελία παίρνει τον επόμενο αριθμό
  await cacheSet("next_order_number", (payload.order_number || 0) + 1);
  await refreshPending();
  return entry;
}

// Ανεβάζει την ουρά με τη σειρά δημιουργίας. Σταματά στο πρώτο σφάλμα δικτύου.
let syncRunning = false;

export async function syncQueue() {
  if (syncRunning) return { synced: 0, remaining: state.pending };
  syncRunning = true;
  state.syncing = true;
  notify();
  let synced = 0;
  try {
    const rows = await refreshPending();
    rows.sort((a, b) => (a.client_created_at || "").localeCompare(b.client_created_at || ""));
    for (const entry of rows) {
      try {
        await submitOrder(entry);
        await tx("queue", "readwrite", (s) => s.delete(entry.client_id));
        synced += 1;
        markServerUp();
      } catch (e) {
        if (isNetworkError(e)) {
          markServerDown();
          break; // ο server είναι ακόμα κάτω — retry αργότερα
        }
        // Ο server απάντησε με σφάλμα (π.χ. validation) — μην μπλοκάρεις την ουρά για πάντα:
        // κράτα την παραγγελία σε ξεχωριστό αρχείο σφαλμάτων και συνέχισε.
        const failed = (await cacheGet("failed_orders")) || [];
        failed.push({ entry, error: e?.response?.data?.detail || e?.message, at: new Date().toISOString() });
        await cacheSet("failed_orders", failed.slice(-50));
        await tx("queue", "readwrite", (s) => s.delete(entry.client_id));
      }
    }
  } finally {
    syncRunning = false;
    state.syncing = false;
    await refreshPending();
  }
  return { synced, remaining: state.pending };
}

// ---------- Cached δεδομένα ταμείου ----------
// Μενού: online-first, cache fallback όταν δεν υπάρχει σύνδεση
export async function getMenuConfigCached() {
  try {
    const cfg = await apiGetMenuConfig();
    cacheSet("menu_config", cfg);
    markServerUp();
    return cfg;
  } catch (e) {
    if (isNetworkError(e)) {
      markServerDown();
      const cached = await cacheGet("menu_config");
      if (cached) return cached;
    }
    throw e;
  }
}

// Ενεργό προφίλ (/auth/me): ίδια λογική — ώστε reload χωρίς ίντερνετ να μη σε πετάει έξω
export async function getMeCached() {
  try {
    const me = await apiMe();
    cacheSet("me", me);
    markServerUp();
    return me;
  } catch (e) {
    if (isNetworkError(e)) {
      markServerDown();
      const cached = await cacheGet("me");
      if (cached) return cached;
    }
    throw e;
  }
}

// Επόμενος αριθμός παραγγελίας όταν ο server δεν απαντά
export const getCachedNextOrderNumber = async () => (await cacheGet("next_order_number")) || 1;

export const rememberNextOrderNumber = (n) => cacheSet("next_order_number", n);

// Ελαφρύ health check — χρησιμοποιείται από το banner για auto-reconnect όσο υπάρχει ουρά
export async function pingServer() {
  try {
    await api.get("/");
    markServerUp();
    return true;
  } catch (e) {
    if (isNetworkError(e)) markServerDown();
    return false;
  }
}
