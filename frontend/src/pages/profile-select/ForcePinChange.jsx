import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { apiChangeOwnPin, formatApiError } from "@/lib/api";
import { rememberPinOffline } from "@/lib/offline";

// Υποχρεωτική αλλαγή του default PIN 0000 στο πρώτο επιτυχές login — χωρίς skip.
export default function ForcePinChange({ profile, onDone }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const clean = (v) => v.replace(/\D/g, "").slice(0, 4);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (pin.length !== 4) return setError("Το νέο PIN πρέπει να είναι 4 ψηφία");
    if (pin === "0000") return setError("Το PIN δεν μπορεί να είναι 0000");
    if (pin !== confirm) return setError("Τα PIN δεν ταιριάζουν");
    setBusy(true);
    try {
      await apiChangeOwnPin(pin);
      // Ανανέωση τοπικού hash για offline είσοδο με το νέο PIN
      rememberPinOffline(profile.id, pin, { name: profile.name, role: profile.role });
      toast.success("Το PIN άλλαξε");
      onDone();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full h-14 rounded-lg bg-[#3D1620] border border-[#723645] focus:border-flame focus:outline-none text-center font-mono text-2xl tracking-[0.5em] text-white";

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-6 py-8">
      <form onSubmit={submit} className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-flame/20 border border-flame flex items-center justify-center mb-3">
            <KeyRound className="w-8 h-8 text-flame" />
          </div>
          <h1 className="font-heading text-3xl font-bold">Αλλαγή PIN</h1>
          <p className="text-sm text-neutral-400 mt-2">
            Το προφίλ <span className="text-white font-semibold">{profile.name}</span> χρησιμοποιεί
            ακόμα το αρχικό PIN 0000. Για λόγους ασφαλείας, ορίστε νέο 4-ψήφιο PIN για να συνεχίσετε.
          </p>
        </div>

        <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Νέο PIN
        </label>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(clean(e.target.value))}
          data-testid="force-pin-new"
          className={`${inputCls} mb-4`}
          autoFocus
        />

        <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-2">
          Επιβεβαίωση PIN
        </label>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(clean(e.target.value))}
          data-testid="force-pin-confirm"
          className={`${inputCls} mb-4`}
        />

        {error && (
          <div
            className="mb-4 p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961] text-center"
            data-testid="force-pin-error"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || pin.length !== 4 || confirm.length !== 4}
          data-testid="force-pin-submit"
          className="w-full h-14 rounded-md bg-flame hover:bg-flame/90 disabled:opacity-40 text-white font-heading text-lg font-bold"
        >
          {busy ? "Αποθήκευση..." : "Αποθήκευση & είσοδος"}
        </button>
      </form>
    </div>
  );
}
