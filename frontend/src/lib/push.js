// Web Push (FleetDeck): subscribe/unsubscribe της συσκευής στις ειδοποιήσεις.
// Το push καλύπτει background/κλειστή εφαρμογή — ο ήχος+δόνηση (fleet/alerts.js)
// μένει για το foreground. Προτίμηση ανά επιφάνεια στο localStorage:
// "1" = ενεργό, "0" = ο χρήστης το έκλεισε ρητά, απουσία = αναποφάσιστος
// (→ αυτόματη ενεργοποίηση στην έναρξη βάρδιας του οδηγού).
import {
  apiFleetPushSubscribe,
  apiFleetPushUnsubscribe,
  apiFleetPushVapidKey,
} from "./fleetApi";

const prefKey = (surface) => `orderdeck_fleet_push_${surface}`;

export const isPushEnabled = (surface) => localStorage.getItem(prefKey(surface)) === "1";
export const isPushDeclined = (surface) => localStorage.getItem(prefKey(surface)) === "0";

// Υποστήριξη της συσκευής/browser — με φιλικό μήνυμα όταν λείπει (π.χ. iOS
// Safari χωρίς εγκατάσταση στην αρχική οθόνη)
export function pushSupport() {
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
    return { ok: true };
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone;
  return {
    ok: false,
    reason:
      isIOS && !standalone
        ? "Στο iPhone/iPad οι ειδοποιήσεις δουλεύουν μόνο αν προσθέσετε την εφαρμογή στην αρχική οθόνη (Κοινοποίηση → Προσθήκη στην αρχική οθόνη)."
        : "Αυτός ο browser δεν υποστηρίζει ειδοποιήσεις push.",
  };
}

// Το applicationServerKey θέλει Uint8Array από το base64url VAPID public key
function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Πλήρης ροή ενεργοποίησης: άδεια → VAPID key → subscribe → αποθήκευση στον
// server. Πετάει Error με ελληνικό μήνυμα σε κάθε εμπόδιο.
export async function enablePush(surface) {
  const support = pushSupport();
  if (!support.ok) throw new Error(support.reason);
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    // Ρητό "denied" → μην ξαναρωτήσουμε αυτόματα· απλό dismiss → άλλη φορά
    if (perm === "denied") localStorage.setItem(prefKey(surface), "0");
    throw new Error("Οι ειδοποιήσεις είναι μπλοκαρισμένες — ενεργοποιήστε τις από τις ρυθμίσεις του browser.");
  }
  const { key } = await apiFleetPushVapidKey();
  if (!key) throw new Error("Οι ειδοποιήσεις push δεν είναι διαθέσιμες αυτή τη στιγμή.");
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error("Οι ειδοποιήσεις δεν είναι διαθέσιμες σε αυτό το περιβάλλον.");
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  await apiFleetPushSubscribe(surface, sub.toJSON());
  localStorage.setItem(prefKey(surface), "1");
}

export async function disablePush(surface) {
  localStorage.setItem(prefKey(surface), "0");
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await apiFleetPushUnsubscribe(sub.endpoint).catch(() => {});
      await sub.unsubscribe();
    }
  } catch {
    /* η προτίμηση έχει ήδη σβήσει — αρκεί */
  }
}

// Έναρξη βάρδιας οδηγού: αυτόματη (ξανα)ενεργοποίηση εκτός αν ο χρήστης το
// έχει κλείσει ρητά ή έχει αρνηθεί την άδεια. Επιστρέφει true αν ενεργό.
export async function ensurePushOnShiftStart(surface) {
  if (isPushDeclined(surface)) return false;
  if ("Notification" in window && Notification.permission === "denied") return false;
  try {
    await enablePush(surface);
    return true;
  } catch {
    return false;
  }
}
