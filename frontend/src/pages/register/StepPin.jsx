import { KeyRound } from "lucide-react";
import { BUSINESS_TYPES } from "@/lib/business";
import { Field } from "./FieldYesNo";
import { inputCls } from "./utils";

export default function StepPin({ form, set, promoInfo }) {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
        <KeyRound className="w-6 h-6 text-flame" /> PIN Ιδιοκτήτη
      </h1>
      <p className="text-sm text-neutral-400">
        Με αυτό το 4-ψήφιο PIN θα συνδέεστε στο προφίλ Ιδιοκτήτη και θα εγκρίνετε
        ευαίσθητες ενέργειες (εκπτώσεις, ακυρώσεις).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN (4 ψηφία)">
          <input
            inputMode="numeric"
            maxLength={4}
            value={form.owner_pin}
            onChange={(e) => set("owner_pin", e.target.value.replace(/\D/g, "").slice(0, 4))}
            data-testid="register-pin"
            className={`${inputCls} font-mono text-xl tracking-widest text-center`}
          />
        </Field>
        <Field label="Επιβεβαίωση">
          <input
            inputMode="numeric"
            maxLength={4}
            value={form.owner_pin2}
            onChange={(e) => set("owner_pin2", e.target.value.replace(/\D/g, "").slice(0, 4))}
            data-testid="register-pin2"
            className={`${inputCls} font-mono text-xl tracking-widest text-center`}
          />
        </Field>
      </div>
      <div className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md text-xs text-neutral-400 space-y-1">
        <div className="font-bold uppercase tracking-widest text-neutral-500 mb-1">Σύνοψη</div>
        <div>Επιχείρηση: <span className="text-white">{form.restaurant_name}</span></div>
        <div>
          Τύπος:{" "}
          <span className="text-white">
            {BUSINESS_TYPES.find((b) => b.key === form.business_type)?.label}
          </span>
        </div>
        <div>Τραπέζια: <span className="text-white">{form.has_tables ? "Ναι (8 έτοιμα)" : "Όχι"}</span></div>
        <div>Σερβιτόροι: <span className="text-white">{form.has_waiters ? "Ναι" : "Όχι"}</span></div>
        {form.promo_code.trim() && (
          <div>
            Εκπτωτικός κωδικός:{" "}
            <span className="text-gold font-mono">{form.promo_code.trim().toUpperCase()}</span>
            {promoInfo?.description && <span className="text-neutral-400"> — {promoInfo.description}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
