// Offline mode (PWA): τοπική cache δεδομένων ταμείου + ουρά παραγγελιών σε IndexedDB.
//
// - cache store: menu config, ενεργό προφίλ (/auth/me), branding, next order number
// - queue store: παραγγελίες που γράφτηκαν χωρίς σύνδεση ("pending sync")
// - syncQueue(): ανεβάζει την ουρά FIFO μόλις επανέλθει σύνδεση (idempotent μέσω client_id)
//
// Το online path ΔΕΝ αλλάζει: η cache γράφεται μόνο μετά από επιτυχημένες κλήσεις
// και διαβάζεται μόνο όταν το δίκτυο αποτύχει.
import { useEffect, useState } from "react";
import { api, apiGetMenuConfig, apiMe, apiOfflineProfiles, submitOrder } from "@/lib/api";

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
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          // Το session δεν έχει ακόμα επαληθευτεί ξανά online (offline login με
          // store-level token) — ΜΗΝ πετάξεις την παραγγελία, retry μετά το re-verify
          break;
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

// ---------- Offline σύνδεση: προφίλ + τοπικά PIN hashes στη συσκευή ----------
// Ο server ΔΕΝ στέλνει ποτέ τα bcrypt hashes του. Στην cache μπαίνει μόνο η λίστα
// προφίλ (id/name/role) για εμφάνιση offline· το hash για offline επαλήθευση
// παράγεται τοπικά με Web Crypto (PBKDF2) όταν το PIN επαληθευτεί online.
export async function cacheProfilesForOffline() {
  try {
    const profiles = await apiOfflineProfiles();
    await cacheSet("offline_profiles", profiles);
    markServerUp();
    return profiles;
  } catch {
    return null; // best-effort — αν αποτύχει μένει η προηγούμενη cache
  }
}

// Λίστα προφίλ για εμφάνιση offline
export async function getCachedProfiles() {
  return (await cacheGet("offline_profiles")) || [];
}

// PBKDF2-SHA256 μέσω crypto.subtle — native στον browser, χωρίς dependencies
const PBKDF2_ITERATIONS = 100000;

const toHex = (buf) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function derivePinHash(pin, saltHex) {
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  return toHex(bits);
}

// Καλείται μετά από ΕΠΙΤΥΧΗ online είσοδο με PIN: αποθηκεύει τοπικό PBKDF2 hash
// (με τυχαίο salt) ώστε το ίδιο προφίλ να μπορεί να συνδεθεί και χωρίς δίκτυο.
export async function rememberPinOffline(profileId, pin, { name, role } = {}) {
  try {
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await derivePinHash(pin, salt);
    const pins = (await cacheGet("offline_pins")) || {};
    pins[profileId] = { salt, hash, name, role };
    await cacheSet("offline_pins", pins);
  } catch {
    /* best-effort — χωρίς crypto.subtle (π.χ. http χωρίς localhost) απλά δεν υπάρχει offline login */
  }
}

// Τοπική επαλήθευση PIN πάνω στο τοπικό PBKDF2 hash. null = το προφίλ δεν έχει
// συνδεθεί ποτέ online από αυτή τη συσκευή — όχι λάθος PIN.
export async function verifyPinOffline(profileId, pin) {
  const pins = (await cacheGet("offline_pins")) || {};
  const entry = pins[profileId];
  if (!entry) return null;
  let hash;
  try {
    hash = await derivePinHash(pin, entry.salt);
  } catch {
    return null;
  }
  if (hash !== entry.hash) return false;
  const profiles = (await cacheGet("offline_profiles")) || [];
  const prof = profiles.find((p) => p.id === profileId);
  return {
    id: profileId,
    name: prof?.name ?? entry.name,
    role: prof?.role ?? entry.role,
  };
}

// ---------- Offline σύνδεση καταστήματος (email + κωδικός) ----------
// Μετά από ΕΠΙΤΥΧΗ online σύνδεση καταστήματος αποθηκεύουμε τοπικά PBKDF2 hash
// του κωδικού (τυχαίο salt) + snapshot βασικών στοιχείων λογαριασμού, ώστε αν
// χαθεί το token/γίνει logout να μπορεί να ξαναμπεί χωρίς δίκτυο. ΠΟΤΕ δεν
// αποθηκεύεται ο κωδικός σε καθαρή μορφή ούτε ο server-side hash.
export async function rememberStoreLoginOffline(email, password, user) {
  try {
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await derivePinHash(password, salt);
    await cacheSet("offline_store_login", {
      email: (email || "").trim().toLowerCase(),
      salt,
      hash,
      user, // snapshot λογαριασμού (store name, business type, ρυθμίσεις) — ΟΧΙ διαπιστευτήρια
    });
  } catch {
    /* best-effort — χωρίς crypto.subtle απλά δεν υπάρχει offline store login */
  }
}

// Τοπική επαλήθευση σύνδεσης καταστήματος. null = δεν υπάρχουν cached credentials
// για αυτό το email σε αυτή τη συσκευή — όχι λάθος κωδικός.
export async function verifyStoreLoginOffline(email, password) {
  const entry = await cacheGet("offline_store_login");
  if (!entry || entry.email !== (email || "").trim().toLowerCase()) return null;
  let hash;
  try {
    hash = await derivePinHash(password, entry.salt);
  } catch {
    return null;
  }
  if (hash !== entry.hash) return false;
  return entry.user || null;
}

// Πλήρες reset συσκευής: σβήνει cache (credentials, PIN hashes, μενού, me) ΚΑΙ
// ουρά παραγγελιών. Καλείται μόνο από ρητή ενέργεια "Αποσύνδεση & διαγραφή
// δεδομένων συσκευής".
export async function wipeOfflineDeviceData() {
  try {
    await tx("cache", "readwrite", (s) => s.clear());
    await tx("queue", "readwrite", (s) => s.clear());
  } catch {
    /* best-effort */
  }
  await refreshPending();
}

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
