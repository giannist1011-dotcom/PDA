import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Truck, Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  apiGetSubscription,
  apiRequestBillingChange,
  apiCancelBillingRequest,
  formatApiError,
} from "@/lib/api";

const PLAN_LABELS = {
  trial: "Δοκιμαστική περίοδος",
  pro: "Pro",
  pro_deckpilot: "Pro + DeckPilot",
};

const ADDON_ICONS = { deckpilot: Bot, fleet: Truck };

// Συνδρομή: τρέχον πλάνο + add-ons. Η αλλαγή γίνεται με αίτημα προς τον
// διαχειριστή της πλατφόρμας (χειροκίνητη χρέωση μέχρι να μπει Stripe).
export default function SubscriptionSettings() {
  const [sub, setSub] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setSub(await apiGetSubscription());
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const requestChange = async (addon, action) => {
    setBusy(true);
    try {
      const r = await apiRequestBillingChange(addon, action);
      setSub((s) => ({ ...s, pending_request: r.pending_request }));
      toast.success("Το αίτημα εστάλη — θα ενεργοποιηθεί από την ομάδα του OrderDeck");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async () => {
    setBusy(true);
    try {
      await apiCancelBillingRequest();
      setSub((s) => ({ ...s, pending_request: null }));
      toast.success("Το αίτημα ακυρώθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!sub) return <div className="text-neutral-500 py-6 text-center">Φόρτωση...</div>;

  const pending = sub.pending_request;

  return (
    <div className="space-y-4">
      {/* Τρέχον πλάνο */}
      <div className="px-4 py-3 bg-[#2A0E14] border border-[#723645] rounded-md flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-neutral-500 font-bold">
            Τρέχον πλάνο
          </div>
          <div className="font-heading text-lg font-bold" data-testid="sub-plan">
            {PLAN_LABELS[sub.plan] || sub.plan}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold text-gold">{sub.plan_price_eur} €</div>
          <div className="text-xs text-neutral-500">/ μήνα</div>
        </div>
      </div>

      {/* Εκκρεμές αίτημα */}
      {pending && (
        <div
          className="px-4 py-3 bg-gold/10 border border-gold/40 rounded-md flex items-center justify-between gap-3"
          data-testid="sub-pending-request"
        >
          <div className="flex items-center gap-2 text-sm text-gold font-semibold min-w-0">
            <Clock className="w-4 h-4 shrink-0" />
            <span className="truncate">
              Το αίτημα εστάλη: {pending.action === "add" ? "ενεργοποίηση" : "απενεργοποίηση"}{" "}
              {pending.addon_label} — αναμονή έγκρισης
            </span>
          </div>
          <button
            onClick={cancelRequest}
            disabled={busy}
            data-testid="sub-cancel-request"
            className="shrink-0 flex items-center gap-1 text-xs font-bold text-neutral-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" /> Ακύρωση
          </button>
        </div>
      )}

      {/* Add-ons */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-neutral-500 font-bold">
          Πρόσθετα (add-ons)
        </div>
        {Object.entries(sub.addons).map(([key, addon]) => {
          const Icon = ADDON_ICONS[key] || Bot;
          const isPendingThis = pending && pending.addon === key;
          return (
            <div
              key={key}
              className="px-4 py-3 bg-[#2A0E14] border border-[#723645] rounded-md flex items-center gap-3"
              data-testid={`sub-addon-${key}`}
            >
              <div className="w-10 h-10 rounded-md bg-brand/30 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-flame" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{addon.label}</span>
                  {addon.active ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#00E676]/15 text-[#00E676]">
                      <Check className="w-3 h-3" /> Ενεργό
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#723645]/50 text-neutral-400">
                      Ανενεργό
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500">{addon.price_eur} € / μήνα</div>
              </div>
              {isPendingThis ? (
                <span className="text-xs text-gold font-bold shrink-0">Σε αναμονή</span>
              ) : (
                <Button
                  onClick={() => requestChange(key, addon.active ? "remove" : "add")}
                  disabled={busy || !!pending}
                  data-testid={`sub-addon-${key}-btn`}
                  className={`h-9 px-3 text-xs font-bold shrink-0 ${
                    addon.active
                      ? "bg-[#2A0E14] border border-[#723645] hover:border-[#FF3B30] text-neutral-300"
                      : "bg-brand hover:bg-brand-hover text-white"
                  }`}
                >
                  {addon.active ? "Αίτημα απενεργοποίησης" : "Αίτημα ενεργοποίησης"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-neutral-500">
        Οι αλλαγές συνδρομής εγκρίνονται από την ομάδα του OrderDeck και η χρέωση γίνεται
        χειροκίνητα — δεν γίνεται καμία πληρωμή μέσα από την εφαρμογή.
      </p>
    </div>
  );
}
