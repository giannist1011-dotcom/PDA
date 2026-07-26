// Ειδοποιήσεις οδηγού (foreground): σύντομος ήχος με Web Audio + δόνηση.
// Χωρίς εξωτερικά αρχεία ήχου — καθαρός beep από oscillator.

const MUTE_KEY = "orderdeck_fleet_mute";

export const isMuted = () => localStorage.getItem(MUTE_KEY) === "1";
export const setMuted = (m) => {
  if (m) localStorage.setItem(MUTE_KEY, "1");
  else localStorage.removeItem(MUTE_KEY);
};

let ctx = null;

// Δύο τόνοι «ντιν-ντον» — αρκετά διακριτός μέσα σε μαγαζί/μηχανάκι
export function playAlert() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime;
    [[880, 0], [1175, 0.18]].forEach(([freq, dt]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + dt);
      gain.gain.exponentialRampToValueAtTime(0.4, t0 + dt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.4);
    });
  } catch {
    /* χωρίς ήχο (π.χ. πριν από user gesture) — μένει η δόνηση/toast */
  }
}

export function vibrate() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* μη διαθέσιμο */
  }
}

// Ήχος + δόνηση μαζί, αν δεν είναι σε σίγαση
export function notify() {
  if (isMuted()) return;
  playAlert();
  vibrate();
}
