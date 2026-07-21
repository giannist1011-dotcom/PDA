import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { apiAdminResetProfilePin, formatApiError } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { inputCls } from "./utils";

// Λίστα προφίλ του μαγαζιού με ενέργεια "Επαναφορά PIN" ανά προφίλ (admin panel).
// Ο admin ορίζει προσωρινό 4-ψήφιο PIN → καθαρίζει το lockout και ο χρήστης
// υποχρεώνεται να ορίσει νέο PIN στο επόμενο login.
function PinResetSection({ pw, shopId, profiles, onChanged }) {
  const [resetId, setResetId] = useState(null); // ποιο προφίλ έχει ανοιχτή φόρμα
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const openReset = (pid) => {
    setResetId(pid === resetId ? null : pid);
    setPin("");
  };

  const doReset = async (prof) => {
    setBusy(true);
    try {
      await apiAdminResetProfilePin(pw, shopId, prof.id, pin);
      toast.success(
        `Το PIN του προφίλ «${prof.name}» επαναφέρθηκε — θα ζητηθεί νέο PIN στο επόμενο login`
      );
      setResetId(null);
      setPin("");
      onChanged();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!profiles?.length) return null;

  return (
    <div className="p-5 border-t border-[#723645]">
      <h3 className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-2">
        Προφίλ & PIN
      </h3>
      <div className="space-y-1.5">
        {profiles.map((p) => {
          const locked = p.pin_lock_until && new Date(p.pin_lock_until) > new Date();
          return (
            <div key={p.id} className="bg-[#2A0E14] border border-[#723645]/60 rounded-md px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-semibold">{p.name}</span>{" "}
                  <span className="text-neutral-500 text-xs">
                    {ROLE_LABELS[p.role] || p.role}
                  </span>
                  {p.must_change_pin && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                      Εκκρεμεί αλλαγή PIN
                    </span>
                  )}
                  {locked && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-[#FF6961]">
                      Κλειδωμένο
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => openReset(p.id)}
                  disabled={busy}
                  data-testid={`profile-reset-pin-${p.id}`}
                  className="h-8 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-neutral-300 text-xs font-bold"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Επαναφορά PIN
                </Button>
              </div>
              {resetId === p.id && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    placeholder="Προσωρινό PIN (4 ψηφία)"
                    data-testid={`profile-reset-pin-input-${p.id}`}
                    className={`${inputCls} max-w-[220px] h-9`}
                  />
                  <Button
                    type="button"
                    onClick={() => doReset(p)}
                    disabled={busy || pin.length !== 4}
                    data-testid={`profile-reset-pin-confirm-${p.id}`}
                    className="h-9 px-4 bg-brand hover:bg-brand-hover text-white text-xs font-bold disabled:opacity-40"
                  >
                    Επαναφορά
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-neutral-500 mt-2">
        Η επαναφορά καθαρίζει τυχόν κλείδωμα από λάθος προσπάθειες και υποχρεώνει τον χρήστη να
        ορίσει δικό του PIN στην επόμενη είσοδο.
      </p>
    </div>
  );
}

export default PinResetSection;
