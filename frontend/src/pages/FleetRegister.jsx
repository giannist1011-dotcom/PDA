import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import { apiFleetRegister } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

const inputCls =
  "w-full h-12 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame";

// Εγγραφή εταιρείας διανομής: στοιχεία εταιρείας + PIN συντονιστή.
export default function FleetRegister() {
  const { adoptToken } = useFleet();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    city: "",
    email: "",
    password: "",
    admin_name: "",
    admin_pin: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(form.admin_pin)) {
      setError("Το PIN συντονιστή πρέπει να είναι 4 ψηφία");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const data = await apiFleetRegister({
        ...form,
        admin_name: form.admin_name.trim() || "Συντονιστής",
      });
      await adoptToken(data.token);
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
          <h1 className="font-heading text-2xl font-bold mb-1">Εγγραφή εταιρείας</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Δημιουργήστε τον λογαριασμό της εταιρείας διανομής σας
          </p>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Όνομα εταιρείας">
              <input
                required
                maxLength={80}
                value={form.name}
                onChange={set("name")}
                data-testid="fleet-reg-name"
                className={inputCls}
              />
            </Field>
            <Field label="Πόλη">
              <input
                maxLength={60}
                value={form.city}
                onChange={set("city")}
                data-testid="fleet-reg-city"
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
                data-testid="fleet-reg-email"
                className={inputCls}
              />
            </Field>
            <Field label="Κωδικός">
              <input
                type="password"
                required
                minLength={4}
                autoComplete="new-password"
                value={form.password}
                onChange={set("password")}
                data-testid="fleet-reg-password"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Όνομα συντονιστή">
                <input
                  maxLength={40}
                  placeholder="Συντονιστής"
                  value={form.admin_name}
                  onChange={set("admin_name")}
                  data-testid="fleet-reg-admin-name"
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
                  data-testid="fleet-reg-admin-pin"
                  className={`${inputCls} tracking-[0.4em] text-center`}
                />
              </Field>
            </div>

            {error && (
              <div className="p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961]">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              data-testid="fleet-reg-submit"
              className="w-full h-14 bg-brand hover:bg-brand-hover text-white font-bold text-base"
            >
              {busy ? "Δημιουργία..." : "Δημιουργία εταιρείας"}
            </Button>
          </form>

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
