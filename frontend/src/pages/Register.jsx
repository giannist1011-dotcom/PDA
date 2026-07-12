import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Utensils,
  ArrowLeft,
  ArrowRight,
  Check,
  LayoutGrid,
  Users,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { BUSINESS_TYPES } from "@/lib/business";
import { Button } from "@/components/ui/button";

const STEPS = ["Λογαριασμός", "Επιχείρηση", "Λειτουργία", "PIN"];

const Field = ({ label, optional, children, hint }) => (
  <div>
    <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
      {label}
      {optional && <span className="text-neutral-600 normal-case tracking-normal font-normal"> (προαιρετικό)</span>}
    </label>
    <div className="mt-1">{children}</div>
    {hint && <div className="text-xs text-neutral-500 mt-1">{hint}</div>}
  </div>
);

const inputCls =
  "w-full h-12 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white focus:outline-none focus:border-[#FF6B00]";

function YesNo({ value, onChange, testId }) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-1">
      {[
        { v: true, label: "Ναι" },
        { v: false, label: "Όχι" },
      ].map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          data-testid={`${testId}-${o.v ? "yes" : "no"}`}
          className={`h-12 rounded-md border font-bold transition-colors ${
            value === o.v
              ? "bg-[#FF6B00] border-[#FF6B00] text-white"
              : "bg-[#0D0D0D] border-[#333] text-neutral-300 hover:border-[#FF6B00]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    password2: "",
    full_name: "",
    phone: "",
    restaurant_name: "",
    city: "",
    website: "",
    business_type: "souvlaki",
    has_tables: true,
    has_waiters: false,
    owner_pin: "",
    owner_pin2: "",
  });

  if (user && user !== false) return <Navigate to="/" replace />;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validateStep = () => {
    setError(null);
    if (step === 0) {
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) return "Εισάγετε έγκυρο email";
      if (form.password.length < 4) return "Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες";
      if (form.password !== form.password2) return "Οι κωδικοί δεν ταιριάζουν";
      if (!form.full_name.trim()) return "Εισάγετε ονοματεπώνυμο";
      if (!form.phone.trim()) return "Εισάγετε τηλέφωνο";
    }
    if (step === 1) {
      if (!form.restaurant_name.trim()) return "Εισάγετε όνομα επιχείρησης";
    }
    if (step === 3) {
      if (!/^\d{4}$/.test(form.owner_pin)) return "Το PIN πρέπει να είναι 4 ψηφία";
      if (form.owner_pin !== form.owner_pin2) return "Τα PIN δεν ταιριάζουν";
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        restaurant_name: form.restaurant_name.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        website: form.website.trim(),
        business_type: form.business_type,
        has_tables: form.has_tables,
        has_waiters: form.has_waiters,
        owner_pin: form.owner_pin,
      });
      toast.success("Ο λογαριασμός δημιουργήθηκε — καλωσήρθατε!");
      navigate("/");
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-11 h-11 rounded-md bg-[#FF6B00] flex items-center justify-center">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <span className="font-heading text-3xl font-bold tracking-tight">POS Suite</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-6" data-testid="register-steps">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className={`flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs font-bold ${
                  i === step
                    ? "bg-[#FF6B00] text-white"
                    : i < step
                      ? "bg-[#FF6B00]/15 text-[#FF6B00]"
                      : "bg-[#1A1A1A] text-neutral-500 border border-[#333]"
                }`}
              >
                {i < step ? <Check className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-[#333]" />}
            </div>
          ))}
        </div>

        <div className="bg-[#1A1A1A] border border-[#333] rounded-lg p-6 md:p-8">
          {/* STEP 1 — Λογαριασμός */}
          {step === 0 && (
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
            </div>
          )}

          {/* STEP 2 — Επιχείρηση */}
          {step === 1 && (
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
                            ? "bg-[#FF6B00]/10 border-[#FF6B00] text-white"
                            : "bg-[#0D0D0D] border-[#333] text-neutral-300 hover:border-[#FF6B00]"
                        }`}
                      >
                        <Icon className={`w-8 h-8 ${active ? "text-[#FF6B00]" : "text-neutral-400"}`} />
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
          )}

          {/* STEP 3 — Λειτουργία */}
          {step === 2 && (
            <div className="space-y-5">
              <h1 className="font-heading text-2xl font-bold">Πώς λειτουργείτε;</h1>
              <div className="p-4 bg-[#0D0D0D] border border-[#333] rounded-lg">
                <div className="flex items-center gap-2 font-semibold">
                  <LayoutGrid className="w-5 h-5 text-[#FF6B00]" /> Έχετε τραπέζια;
                </div>
                <div className="text-xs text-neutral-500 mt-1 mb-2">
                  Ενεργοποιεί καρτέλες ανά τραπέζι με γύρους για την κουζίνα (8 έτοιμα τραπέζια)
                </div>
                <YesNo value={form.has_tables} onChange={(v) => set("has_tables", v)} testId="register-tables" />
              </div>
              <div className="p-4 bg-[#0D0D0D] border border-[#333] rounded-lg">
                <div className="flex items-center gap-2 font-semibold">
                  <Users className="w-5 h-5 text-[#FF6B00]" /> Έχετε σερβιτόρους;
                </div>
                <div className="text-xs text-neutral-500 mt-1 mb-2">
                  Δημιουργεί έτοιμο προφίλ Σερβιτόρου (πρόσβαση μόνο στα Τραπέζια)
                </div>
                <YesNo value={form.has_waiters} onChange={(v) => set("has_waiters", v)} testId="register-waiters" />
              </div>
            </div>
          )}

          {/* STEP 4 — PIN */}
          {step === 3 && (
            <div className="space-y-4">
              <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
                <KeyRound className="w-6 h-6 text-[#FF6B00]" /> PIN Ιδιοκτήτη
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
              <div className="p-3 bg-[#0D0D0D] border border-[#333] rounded-md text-xs text-neutral-400 space-y-1">
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
              </div>
            </div>
          )}

          {error && (
            <div
              className="mt-4 p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]"
              data-testid="register-error"
            >
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-2 mt-6">
            {step > 0 && (
              <Button
                type="button"
                onClick={back}
                disabled={busy}
                data-testid="register-back"
                className="h-12 px-4 bg-[#0D0D0D] border border-[#333] hover:border-[#FF6B00] text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={next}
                data-testid="register-next"
                className="flex-1 h-12 bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold"
              >
                Συνέχεια <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={submit}
                disabled={busy}
                data-testid="register-submit"
                className="flex-1 h-12 bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold"
              >
                {busy ? "Δημιουργία..." : "Δημιουργία λογαριασμού"}
              </Button>
            )}
          </div>

          <div className="mt-6 text-sm text-neutral-400 text-center">
            Έχετε ήδη λογαριασμό;{" "}
            <Link to="/login" data-testid="go-login" className="text-[#FF6B00] hover:underline font-semibold">
              Σύνδεση
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
