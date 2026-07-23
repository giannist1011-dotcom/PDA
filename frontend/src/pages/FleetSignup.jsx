import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Truck, Users } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import { apiFleetSignup } from "@/lib/fleetApi";
import { formatApiError, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

const inputCls =
  "w-full h-12 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame";

// Πλάνα εταιρείας διανομής — τιμολόγηση χειροκίνητη (καμία πληρωμή στην εγγραφή)
const PLANS = [
  {
    key: "fleet15",
    title: "Έως 15 προφίλ",
    price: "30 € / μήνα",
    desc: "Για ομάδες μέχρι 15 διανομείς/συντονιστές.",
  },
  {
    key: "fleet30",
    title: "30+ προφίλ",
    price: "50 € / μήνα",
    desc: "Για μεγαλύτερες ομάδες, χωρίς όριο προφίλ.",
  },
];

// Εγγραφή εταιρείας διανομής: unified λογαριασμός (ίδιο auth με τα μαγαζιά,
// account_type=fleet_company) → κατευθείαν στον πίνακα συντονιστή.
export default function FleetSignup() {
  const { adoptToken } = useFleet();
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0=στοιχεία, 1=πλάνο
  const [form, setForm] = useState({
    name: "",
    city: "",
    contact_name: "",
    phone: "",
    email: "",
    password: "",
    admin_pin: "",
    plan: "fleet15",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const nextFromDetails = () => {
    setError(null);
    if (!form.name.trim()) return setError("Εισάγετε όνομα εταιρείας");
    if (!/\S+@\S+\.\S+/.test(form.email)) return setError("Εισάγετε έγκυρο email");
    if (form.password.length < 4)
      return setError("Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες");
    if (!/^\d{4}$/.test(form.admin_pin))
      return setError("Το PIN συντονιστή πρέπει να είναι 4 ψηφία");
    setStep(1);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const data = await apiFleetSignup({
        name: form.name.trim(),
        city: form.city.trim(),
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
        admin_pin: form.admin_pin,
        plan: form.plan,
      });
      // Ενιαίος λογαριασμός: κύριο token (για μελλοντική σύνδεση από το site) + fleet session
      setToken(data.token);
      await adoptToken(data.fleet_token);
      toast.success("Η εταιρεία δημιουργήθηκε!");
      navigate("/fleet/select");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Truck className="w-8 h-8 text-flame" />
          <span className="font-heading text-2xl font-bold">OrderDeck Fleet</span>
        </div>

        <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-8">
          {step === 0 ? (
            <>
              <h1 className="font-heading text-2xl font-bold mb-1">Εγγραφή εταιρείας</h1>
              <p className="text-sm text-neutral-400 mb-6">
                Στοιχεία της εταιρείας διανομής και του συντονιστή
              </p>

              <div className="space-y-4">
                <Field label="Όνομα εταιρείας">
                  <input
                    required
                    maxLength={80}
                    value={form.name}
                    onChange={set("name")}
                    data-testid="fleet-signup-name"
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Πόλη">
                    <input
                      maxLength={60}
                      value={form.city}
                      onChange={set("city")}
                      data-testid="fleet-signup-city"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Τηλέφωνο">
                    <input
                      maxLength={20}
                      value={form.phone}
                      onChange={set("phone")}
                      data-testid="fleet-signup-phone"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Υπεύθυνος επικοινωνίας">
                  <input
                    maxLength={80}
                    placeholder="Ονοματεπώνυμο"
                    value={form.contact_name}
                    onChange={set("contact_name")}
                    data-testid="fleet-signup-contact"
                    className={inputCls}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={set("email")}
                    data-testid="fleet-signup-email"
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Κωδικός">
                    <input
                      type="password"
                      required
                      minLength={4}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={set("password")}
                      data-testid="fleet-signup-password"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="PIN συντονιστή">
                    <input
                      required
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      placeholder="4 ψηφία"
                      value={form.admin_pin}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, admin_pin: e.target.value.replace(/\D/g, "") }))
                      }
                      data-testid="fleet-signup-pin"
                      className={`${inputCls} tracking-[0.4em] text-center`}
                    />
                  </Field>
                </div>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-heading text-2xl font-bold mb-1">Πλάνο</h1>
              <p className="text-sm text-neutral-400 mb-6">
                Επιλέξτε μέγεθος ομάδας — η χρέωση ενεργοποιείται χειροκίνητα, χωρίς κάρτα.
              </p>

              <div className="space-y-3">
                {PLANS.map((p) => {
                  const active = form.plan === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, plan: p.key }))}
                      data-testid={`fleet-signup-plan-${p.key}`}
                      className={`w-full text-left p-4 rounded-lg border transition-colors ${
                        active
                          ? "border-flame bg-flame/10"
                          : "border-[#723645] bg-[#2A0E14] hover:border-flame/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-flame" />
                        <span className="font-heading font-bold flex-1">{p.title}</span>
                        <span className="font-bold text-sm">{p.price}</span>
                        {active && (
                          <span className="w-6 h-6 rounded-full bg-flame flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4 text-white" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 mt-1.5">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {error && (
            <div
              className="mt-4 p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]"
              data-testid="fleet-signup-error"
            >
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            {step === 1 && (
              <Button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(0);
                }}
                disabled={busy}
                data-testid="fleet-signup-back"
                className="h-12 px-4 bg-[#2A0E14] border border-[#723645] hover:border-flame text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {step === 0 ? (
              <Button
                type="button"
                onClick={nextFromDetails}
                data-testid="fleet-signup-next"
                className="flex-1 h-12 bg-brand hover:bg-brand-hover text-white font-bold"
              >
                Συνέχεια <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={submit}
                disabled={busy}
                data-testid="fleet-signup-submit"
                className="flex-1 h-12 bg-brand hover:bg-brand-hover text-white font-bold"
              >
                {busy ? "Δημιουργία..." : "Δημιουργία εταιρείας"}
              </Button>
            )}
          </div>

          <div className="mt-6 text-sm text-neutral-400 text-center">
            Έχετε ήδη λογαριασμό;{" "}
            <Link to="/fleet/login" className="text-flame hover:underline font-semibold">
              Σύνδεση
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
