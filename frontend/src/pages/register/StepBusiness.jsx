import { BUSINESS_TYPES } from "@/lib/business";
import { Field } from "./FieldYesNo";
import { inputCls } from "./utils";

export default function StepBusiness({ form, set }) {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Η επιχείρησή σας</h1>
      <Field label="Όνομα επιχείρησης">
        <input
          value={form.restaurant_name}
          onChange={(e) => set("restaurant_name", e.target.value)}
          placeholder="π.χ. Ο Λευτέρης"
          data-testid="register-restaurant"
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Πόλη" optional>
          <input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            data-testid="register-city"
            className={inputCls}
          />
        </Field>
        <Field label="Website" optional>
          <input
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://..."
            data-testid="register-website"
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Τύπος επιχείρησης">
        <div className="grid grid-cols-2 gap-2 mt-1">
          {BUSINESS_TYPES.map((b) => {
            const Icon = b.icon;
            const active = form.business_type === b.key;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => set("business_type", b.key)}
                data-testid={`register-biz-${b.key}`}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all active:scale-[0.98] ${
                  active
                    ? "bg-flame/10 border-flame text-white"
                    : "bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-flame"
                }`}
              >
                <span
                  className={`w-12 h-12 rounded-md bg-brand flex items-center justify-center ${
                    active ? "" : "opacity-60"
                  }`}
                >
                  <Icon className="w-7 h-7 text-white" />
                </span>
                <span className="text-sm font-bold">{b.label}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <div className="text-xs text-neutral-500">
        Θα προ-φορτωθεί έτοιμο ελληνικό μενού για τον τύπο σας — το επεξεργάζεστε ελεύθερα μετά.
      </div>
    </div>
  );
}
