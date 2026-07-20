import { Check, Ticket } from "lucide-react";
import { Field } from "./FieldYesNo";
import { inputCls } from "./utils";

export default function StepAccount({ form, set, promoInfo, setPromoInfo }) {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Λογαριασμός</h1>
      <Field label="Email">
        <input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          data-testid="register-email"
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Κωδικός" hint="Τουλάχιστον 4 χαρακτήρες">
          <input
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            data-testid="register-password"
            className={inputCls}
          />
        </Field>
        <Field label="Επιβεβαίωση">
          <input
            type="password"
            value={form.password2}
            onChange={(e) => set("password2", e.target.value)}
            data-testid="register-password2"
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Ονοματεπώνυμο">
        <input
          value={form.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          placeholder="π.χ. Γιάννης Παπαδόπουλος"
          data-testid="register-fullname"
          className={inputCls}
        />
      </Field>
      <Field label="Τηλέφωνο">
        <input
          inputMode="tel"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="π.χ. 6912345678"
          data-testid="register-phone"
          className={inputCls}
        />
      </Field>
      <Field label="Εκπτωτικός κωδικός" optional>
        <div className="relative">
          <Ticket className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={form.promo_code}
            onChange={(e) => {
              set("promo_code", e.target.value.toUpperCase());
              setPromoInfo(null);
            }}
            placeholder="π.χ. WELCOME10"
            data-testid="register-promo"
            className={`${inputCls} pl-9 font-mono tracking-wider`}
          />
        </div>
        {promoInfo && promoInfo.code === form.promo_code.trim().toUpperCase() && (
          <div className="text-xs text-gold mt-1 flex items-center gap-1" data-testid="register-promo-ok">
            <Check className="w-3.5 h-3.5" /> {promoInfo.description}
          </div>
        )}
      </Field>
    </div>
  );
}
