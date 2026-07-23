import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError, apiValidatePromo, apiFleetExchange } from "@/lib/api";
import { setFleetToken } from "@/lib/fleetApi";
import { Button } from "@/components/ui/button";
import StepAccount from "./register/StepAccount";
import StepBusiness from "./register/StepBusiness";
import StepPlan from "./register/StepPlan";
import StepOperation from "./register/StepOperation";
import StepPin from "./register/StepPin";

const ALL_STEPS = [
  { key: "account", label: "Λογαριασμός" },
  { key: "business", label: "Επιχείρηση" },
  { key: "plan", label: "Πλάνο" },
  { key: "operation", label: "Λειτουργία" },
  { key: "pin", label: "PIN" },
];

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [promoInfo, setPromoInfo] = useState(null); // επιτυχής validation → {code, description}
  const [form, setForm] = useState({
    promo_code: (searchParams.get("promo") || "").toUpperCase(),
    email: "",
    password: "",
    password2: "",
    full_name: "",
    phone: "",
    restaurant_name: "",
    city: "",
    website: "",
    business_type: "souvlaki",
    plan: "orderdeck",
    has_tables: true,
    has_waiters: false,
    owner_pin: "",
    owner_pin2: "",
  });

  // Fleet-only πλάνο: το βήμα «Λειτουργία» (τραπέζια/σερβιτόροι) δεν έχει νόημα
  const steps = form.plan === "fleet" ? ALL_STEPS.filter((s) => s.key !== "operation") : ALL_STEPS;
  const stepKey = steps[Math.min(step, steps.length - 1)].key;

  // Οι δοκιμαστικοί (demo) χρήστες επιτρέπεται να περάσουν στο wizard για πλήρη εγγραφή
  // (όχι redirect όσο τρέχει το submit — για fleet πλάνο πλοηγούμαστε χειροκίνητα στο /fleet)
  if (user && user !== false && !user.is_demo && !busy) return <Navigate to="/app" replace />;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validateStep = () => {
    setError(null);
    if (stepKey === "account") {
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) return "Εισάγετε έγκυρο email";
      if (form.password.length < 4) return "Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες";
      if (form.password !== form.password2) return "Οι κωδικοί δεν ταιριάζουν";
      if (!form.full_name.trim()) return "Εισάγετε ονοματεπώνυμο";
      if (!form.phone.trim()) return "Εισάγετε τηλέφωνο";
    }
    if (stepKey === "business") {
      if (!form.restaurant_name.trim()) return "Εισάγετε όνομα επιχείρησης";
    }
    if (stepKey === "pin") {
      if (!/^\d{4}$/.test(form.owner_pin)) return "Το PIN πρέπει να είναι 4 ψηφία";
      if (form.owner_pin !== form.owner_pin2) return "Τα PIN δεν ταιριάζουν";
    }
    return null;
  };

  const next = async () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    // Έλεγχος εκπτωτικού κωδικού πριν προχωρήσουμε από το πρώτο βήμα
    if (stepKey === "account" && form.promo_code.trim()) {
      if (!promoInfo || promoInfo.code !== form.promo_code.trim().toUpperCase()) {
        setBusy(true);
        try {
          const info = await apiValidatePromo(form.promo_code.trim());
          setPromoInfo(info);
        } catch (e) {
          setError(formatApiError(e));
          return;
        } finally {
          setBusy(false);
        }
      }
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
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
        plan: form.plan,
        has_tables: form.plan !== "fleet" && form.has_tables,
        has_waiters: form.plan !== "fleet" && form.has_waiters,
        owner_pin: form.owner_pin,
        promo_code: form.promo_code.trim() || null,
      });
      toast.success("Ο λογαριασμός δημιουργήθηκε — καλωσήρθατε!");
      if (form.plan === "fleet") {
        // Fleet-only: κατευθείαν στον πίνακα διανομής — το fleet token βγαίνει από το exchange
        try {
          const ex = await apiFleetExchange();
          setFleetToken(ex.token);
        } catch {
          // αποτυχία exchange → το /fleet θα ζητήσει σύνδεση
        }
        navigate("/fleet/select");
      } else {
        navigate("/app");
      }
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex items-center mb-6 justify-center">
          <img src="/logo-dark.svg" alt="OrderDeck" className="h-12" />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-6" data-testid="register-steps">
          {steps.map(({ key, label }, i) => (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className={`flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs font-bold ${
                  i === step
                    ? "bg-brand text-white"
                    : i < step
                      ? "bg-flame/15 text-flame"
                      : "bg-[#3D1620] text-neutral-500 border border-[#723645]"
                }`}
              >
                {i < step ? <Check className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < steps.length - 1 && <div className="w-4 h-px bg-[#723645]" />}
            </div>
          ))}
        </div>

        <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-6 md:p-8">
          {stepKey === "account" && (
            <StepAccount form={form} set={set} promoInfo={promoInfo} setPromoInfo={setPromoInfo} />
          )}
          {stepKey === "business" && <StepBusiness form={form} set={set} />}
          {stepKey === "plan" && <StepPlan form={form} set={set} />}
          {stepKey === "operation" && <StepOperation form={form} set={set} />}
          {stepKey === "pin" && <StepPin form={form} set={set} promoInfo={promoInfo} />}

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
                className="h-12 px-4 bg-[#2A0E14] border border-[#723645] hover:border-flame text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button
                type="button"
                onClick={next}
                disabled={busy}
                data-testid="register-next"
                className="flex-1 h-12 bg-brand hover:bg-brand-hover text-white font-bold"
              >
                Συνέχεια <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={submit}
                disabled={busy}
                data-testid="register-submit"
                className="flex-1 h-12 bg-brand hover:bg-brand-hover text-white font-bold"
              >
                {busy ? "Δημιουργία..." : "Δημιουργία λογαριασμού"}
              </Button>
            )}
          </div>

          <div className="mt-6 text-sm text-neutral-400 text-center">
            Έχετε ήδη λογαριασμό;{" "}
            <Link to="/app/login" data-testid="go-login" className="text-flame hover:underline font-semibold">
              Σύνδεση
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
