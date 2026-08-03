// Ήχοι ειδοποίησης πλατφορμών: κατεβαίνουν ΑΠΟ ΤΟ ΔΙΚΟ ΜΑΣ API (προεπιλεγμένος
// ανά πλατφόρμα ή ο custom του καταστήματος), γίνονται blob στη συσκευή και
// μένουν cached — ένα κατέβασμα ανά πλατφόρμα, μετά παίζουν χωρίς δίκτυο.
//
// Όσο υπάρχει εισερχόμενη παραγγελία σε αναμονή, ο ήχος επαναλαμβάνεται κάθε 30".
import { apiFetchPlatformSound } from "@/lib/api";

const REPEAT_MS = 30000;

const cache = new Map(); // platform → HTMLAudioElement
const pending = new Map(); // platform → Promise (αποφυγή διπλού fetch)

// Τα browsers μπλοκάρουν ήχο πριν ο χρήστης αγγίξει τη σελίδα — το θυμόμαστε
// ώστε να μη γεμίζει η κονσόλα με NotAllowedError
let unlocked = false;
const markUnlocked = () => {
  unlocked = true;
};
if (typeof window !== "undefined") {
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, markUnlocked, { once: true, passive: true })
  );
}

async function loadAudio(platform) {
  if (cache.has(platform)) return cache.get(platform);
  if (!pending.has(platform)) {
    pending.set(
      platform,
      apiFetchPlatformSound(platform)
        .then((blob) => {
          const audio = new Audio(URL.createObjectURL(blob));
          audio.preload = "auto";
          cache.set(platform, audio);
          return audio;
        })
        .catch(() => null)
        .finally(() => pending.delete(platform))
    );
  }
  return pending.get(platform);
}

/** Προφόρτωση (π.χ. όταν ανοίγει η καρτέλα της πλατφόρμας). */
export const preloadPlatformSound = (platform) => loadAudio(platform);

/** Καθαρίζει το cache όταν το κατάστημα αλλάξει/επαναφέρει τον ήχο του. */
export const clearPlatformSound = (platform) => {
  if (platform) cache.delete(platform);
  else cache.clear();
};

export async function playPlatformSound(platform) {
  if (!unlocked) return false;
  const audio = await loadAudio(platform);
  if (!audio) return false;
  try {
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    return false; // autoplay policy — θα ξαναπαίξει στο επόμενο repeat
  }
}

/**
 * Επαναλαμβανόμενη ειδοποίηση όσο εκκρεμούν παραγγελίες.
 * Κάθε φορά που αλλάζει το σύνολο των εκκρεμών: νέα παραγγελία → άμεσος ήχος,
 * καμία εκκρεμής → σταματά. Επιστρέφει συνάρτηση καθαρισμού.
 */
export function createPlatformAlarm() {
  let timer = null;
  let platforms = [];

  const ring = () => platforms.forEach((p) => playPlatformSound(p));

  return {
    /** platformsWithPending: λίστα πλατφορμών που έχουν εισερχόμενη σε αναμονή */
    update(platformsWithPending, { ringNow = false } = {}) {
      platforms = platformsWithPending;
      if (platforms.length === 0) {
        if (timer) clearInterval(timer);
        timer = null;
        return;
      }
      if (ringNow) ring();
      if (!timer) timer = setInterval(ring, REPEAT_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      platforms = [];
    },
  };
}
