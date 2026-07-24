import { useState } from "react";
import { toast } from "sonner";
import { X, Sparkles } from "lucide-react";
import { apiAdminCreateDemo, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAdminPw } from "@/components/AdminShell";
import { CredRow } from "./DemoCredentials";
import { inputCls } from "./utils";

const TYPES = [
  { key: "store", label: "Κατάστημα" },
  { key: "fleet", label: "Εταιρία Delivery" },
];

const BUSINESS_TYPES = [
  { key: "souvlaki", label: "Σουβλατζίδικο" },
  { key: "cafe", label: "Καφετέρια" },
  { key: "pizzeria", label: "Πιτσαρία" },
  { key: "burger", label: "Burger" },
];

// Δημιουργία demo λογαριασμού (μαγαζί ή εταιρία delivery) από τον admin
export default function CreateDemoModal({ defaultType = "store", onClose }) {
  const pw = useAdminPw();
  const [type, setType] = useState(defaultType);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [businessType, setBusinessType] = useState("souvlaki");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiAdminCreateDemo(pw, {
        type,
        name: name.trim(),
        city: city.trim(),
        business_type: businessType,
      });
      setResult(res);
      toast.success("Ο demo λογαριασμός δημιουργήθηκε");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4"
      onClick={() => onClose(!!result)}
    >
      <div
        className="w-full max-w-md bg-[#3D1620] border border-[#723645] rounded-lg my-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#723645]">
          <div className="font-heading text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" /> Δημιουργία demo
          </div>
          <button
            type="button"
            onClick={() => onClose(!!result)}
            data-testid="demo-modal-close"
            className="w-9 h-9 rounded-md hover:bg-[#2A0E14] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <p className="text-sm text-neutral-300">
              Ο demo λογαριασμός <span className="font-bold">{name}</span> είναι έτοιμος.
              Συνδέεται από το κανονικό login.
            </p>
            <div className="bg-[#2A0E14] border border-gold/40 rounded-lg p-4">
              <div className="text-xs uppercase tracking-widest font-bold text-gold mb-2">
                Στοιχεία σύνδεσης — διαθέσιμα και στην καρτέλα του demo
              </div>
              <CredRow label="Email" value={result.email} />
              <CredRow label="Κωδικός" value={result.password} />
              <CredRow label="PIN προφίλ" value={result.pin} />
            </div>
            {result.drivers?.length > 0 && (
              <div className="bg-[#2A0E14] border border-[#723645] rounded-lg p-4">
                <div className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-2">
                  Demo οδηγοί (είσοδος οδηγού από κινητό)
                </div>
                {result.drivers.map((d) => (
                  <div key={d.phone} className="py-1 border-b border-[#723645]/40 last:border-0">
                    <div className="text-sm font-semibold">{d.name}</div>
                    <CredRow label="Τηλέφωνο" value={d.phone} />
                    <CredRow label="Κωδικός" value={d.password} />
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              onClick={() => onClose(true)}
              data-testid="demo-done"
              className="w-full h-10 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              Εντάξει
            </Button>
          </div>
        ) : (
          <form onSubmit={create} className="p-5 space-y-4">
            <div>
              <label className="text-xs text-neutral-400 font-semibold">Τύπος λογαριασμού</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(t.key)}
                    data-testid={`demo-type-${t.key}`}
                    className={`h-10 rounded-md border text-sm font-bold ${
                      type === t.key
                        ? "bg-brand border-brand text-white"
                        : "bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-flame"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-400 font-semibold">Όνομα</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === "store" ? "π.χ. Demo Σουβλατζίδικο" : "π.χ. Demo Delivery"}
                data-testid="demo-name"
                className={`${inputCls} mt-1`}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 font-semibold">Πόλη</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="π.χ. Θεσσαλονίκη"
                data-testid="demo-city"
                className={`${inputCls} mt-1`}
              />
            </div>
            {type === "store" && (
              <div>
                <label className="text-xs text-neutral-400 font-semibold">Preset μενού</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  data-testid="demo-business-type"
                  className={`${inputCls} mt-1`}
                >
                  {BUSINESS_TYPES.map((b) => (
                    <option key={b.key} value={b.key}>{b.label}</option>
                  ))}
                </select>
              </div>
            )}
            <p className="text-xs text-neutral-500">
              {type === "store"
                ? "Θα δημιουργηθεί μαγαζί με έτοιμο μενού από το preset, τραπέζια και προφίλ (PIN 0000)."
                : "Θα δημιουργηθεί εταιρία με 3 demo οδηγούς και δείγμα παραγγελιών ώστε ο πίνακας να δείχνει ζωντανός."}
            </p>
            <Button
              type="submit"
              disabled={busy || !name.trim()}
              data-testid="demo-create"
              className="w-full h-10 bg-brand hover:bg-brand-hover text-white font-bold disabled:opacity-40"
            >
              {busy ? "Δημιουργία..." : "Δημιουργία demo"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
