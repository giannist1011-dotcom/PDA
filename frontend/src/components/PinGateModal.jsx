import { useEffect, useState } from "react";
import { X, Delete, Lock, ShieldCheck } from "lucide-react";
import { apiVerifyOwnerPin, formatApiError } from "@/lib/api";

const fmtCountdown = (sec) => {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
};

/**
 * Owner-PIN gate for sensitive actions when the employee profile is active.
 * onSuccess(pin) fires with the verified PIN so the caller can pass it to
 * the protected backend call.
 */
export default function PinGateModal({ open, title, onClose, onSuccess }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  if (!open) return null;

  const lockedFor = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const locked = lockedFor > 0;

  const press = (d) => {
    if (locked || busy) return;
    setError(null);
    setPin((p) => (p.length >= 8 ? p : p + d));
  };
  const backspace = () => setPin((p) => p.slice(0, -1));

  const submit = async () => {
    if (pin.length < 4 || busy || locked) return;
    setBusy(true);
    try {
      const res = await apiVerifyOwnerPin(pin);
      if (res.ok) {
        const verified = pin;
        setPin("");
        onSuccess(verified);
      } else if (res.locked_for) {
        setLockedUntil(Date.now() + res.locked_for * 1000);
        setPin("");
        setError(null);
      } else {
        setError(`Λάθος PIN — απομένουν ${res.attempts_left} προσπάθειες`);
        setPin("");
      }
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
      data-testid="pin-gate-modal"
    >
      <div className="bg-[#1A1A1A] border border-[#333] rounded-lg w-full max-w-xs p-5">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#FF6B00]" />
            <h3 className="font-heading text-lg font-bold">PIN ιδιοκτήτη</h3>
          </div>
          <button
            onClick={onClose}
            data-testid="pin-gate-close"
            className="w-8 h-8 rounded-md border border-[#333] hover:border-[#FF6B00] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {title && <p className="text-xs text-neutral-400 mb-3">{title}</p>}

        {locked ? (
          <div
            className="py-8 text-center"
            data-testid="pin-gate-locked"
          >
            <Lock className="w-8 h-8 mx-auto text-[#FF6961] mb-3" />
            <div className="text-sm text-[#FF6961] font-bold">
              Πολλές λανθασμένες προσπάθειες
            </div>
            <div className="font-mono text-3xl font-bold text-white mt-2" data-testid="pin-lock-countdown">
              {fmtCountdown(lockedFor)}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Η ενέργεια κλειδώθηκε προσωρινά
            </div>
          </div>
        ) : (
          <>
            {/* PIN dots */}
            <div className="flex justify-center gap-2 my-4" data-testid="pin-dots">
              {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
                <span
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border ${
                    i < pin.length ? "bg-[#FF6B00] border-[#FF6B00]" : "border-[#555]"
                  }`}
                />
              ))}
            </div>
            {error && (
              <div className="text-xs text-[#FF6961] text-center mb-3" data-testid="pin-gate-error">
                {error}
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {keys.map((k) => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  data-testid={`pin-key-${k}`}
                  className="h-14 rounded-md bg-[#0D0D0D] border border-[#333] text-white text-xl font-mono font-bold hover:border-[#FF6B00] active:scale-95 transition-all"
                >
                  {k}
                </button>
              ))}
              <button
                onClick={() => setPin("")}
                data-testid="pin-key-clear"
                className="h-14 rounded-md bg-[#0D0D0D] border border-[#333] text-neutral-400 text-sm font-bold hover:border-[#FF3B30] hover:text-[#FF6961] active:scale-95"
              >
                C
              </button>
              <button
                onClick={() => press("0")}
                data-testid="pin-key-0"
                className="h-14 rounded-md bg-[#0D0D0D] border border-[#333] text-white text-xl font-mono font-bold hover:border-[#FF6B00] active:scale-95"
              >
                0
              </button>
              <button
                onClick={backspace}
                data-testid="pin-key-backspace"
                className="h-14 rounded-md bg-[#0D0D0D] border border-[#333] text-neutral-300 flex items-center justify-center hover:border-[#FF6B00] active:scale-95"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={submit}
              disabled={pin.length < 4 || busy}
              data-testid="pin-gate-submit"
              className="w-full h-12 mt-3 rounded-md bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "Έλεγχος..." : "Επιβεβαίωση"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
