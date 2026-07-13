import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Ticket,
  Plus,
  Trash2,
  Power,
  Store,
  Lock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  apiAdminListPromos,
  apiAdminCreatePromo,
  apiAdminTogglePromo,
  apiAdminDeletePromo,
  apiAdminPromoUses,
  formatApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

const PW_KEY = "orderdeck_admin_pw";

const TYPE_LABELS = {
  percentage: "Ποσοστό (%)",
  fixed: "Σταθερό ποσό (€)",
  free_months: "Δωρεάν μήνες",
  lifetime_discount: "Μόνιμη έκπτωση (%)",
};

const DURATION_LABELS = {
  one_time: "Εφάπαξ",
  "1_month": "1 μήνας",
  "3_months": "3 μήνες",
  "6_months": "6 μήνες",
  "12_months": "12 μήνες",
  lifetime: "Εφ' όρου ζωής",
};

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#5E2A3A] rounded-md text-white focus:outline-none focus:border-flame";

const fmtEur = (v) => `${Number(v).toFixed(2).replace(".", ",")} €`;

function promoValueLabel(p) {
  if (p.type === "percentage" || p.type === "lifetime_discount") return `-${p.value}%`;
  if (p.type === "fixed") return `-${fmtEur(p.value)}`;
  if (p.type === "free_months") return `${p.value} δωρεάν ${p.value === 1 ? "μήνας" : "μήνες"}`;
  return String(p.value);
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("el-GR");
}

const Field = ({ label, optional, children }) => (
  <div>
    <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
      {label}
      {optional && (
        <span className="text-neutral-600 normal-case tracking-normal font-normal"> (προαιρετικό)</span>
      )}
    </label>
    <div className="mt-1">{children}</div>
  </div>
);

export default function AdminPromo() {
  const [pw, setPw] = useState(() => sessionStorage.getItem(PW_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(null); // promo id → uses list
  const [uses, setUses] = useState({});
  const [form, setForm] = useState({
    code: "",
    type: "percentage",
    value: "",
    duration: "3_months",
    max_uses: "",
    expires_at: "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = async (password) => {
    const data = await apiAdminListPromos(password);
    setCodes(data);
  };

  // Αυτόματη σύνδεση αν υπάρχει ήδη password στο session
  useEffect(() => {
    if (!pw) return;
    load(pw)
      .then(() => setAuthed(true))
      .catch(() => {
        sessionStorage.removeItem(PW_KEY);
        setPw("");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await load(pwInput);
      sessionStorage.setItem(PW_KEY, pwInput);
      setPw(pwInput);
      setAuthed(true);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    try {
      await load(pw);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const create = async (e) => {
    e.preventDefault();
    const value = parseFloat(String(form.value).replace(",", "."));
    if (!value || value <= 0) {
      toast.error("Εισάγετε έγκυρη τιμή έκπτωσης");
      return;
    }
    setBusy(true);
    try {
      await apiAdminCreatePromo(pw, {
        code: form.code.trim() || null,
        type: form.type,
        value,
        duration: form.type === "lifetime_discount" ? "lifetime" : form.duration,
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
        expires_at: form.expires_at || null,
      });
      toast.success("Ο κωδικός δημιουργήθηκε");
      setForm({ code: "", type: "percentage", value: "", duration: "3_months", max_uses: "", expires_at: "" });
      setShowCreate(false);
      await load(pw);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p) => {
    try {
      await apiAdminTogglePromo(pw, p.id, !p.active);
      setCodes((cs) => cs.map((c) => (c.id === p.id ? { ...c, active: !p.active } : c)));
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Διαγραφή του κωδικού ${p.code};`)) return;
    try {
      await apiAdminDeletePromo(pw, p.id);
      setCodes((cs) => cs.filter((c) => c.id !== p.id));
      toast.success("Ο κωδικός διαγράφηκε");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const toggleUses = async (p) => {
    if (expanded === p.id) {
      setExpanded(null);
      return;
    }
    setExpanded(p.id);
    if (!uses[p.id]) {
      try {
        const data = await apiAdminPromoUses(pw, p.id);
        setUses((u) => ({ ...u, [p.id]: data.shops }));
      } catch (err) {
        toast.error(formatApiError(err));
      }
    }
  };

  // ============ PASSWORD GATE ============
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-4">
        <form onSubmit={login} className="w-full max-w-sm bg-[#3D1620] border border-[#5E2A3A] rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-flame" />
            <h1 className="font-heading text-xl font-bold">Διαχείριση εκπτωτικών κωδικών</h1>
          </div>
          <p className="text-sm text-neutral-400">
            Πρόσβαση μόνο για τον διαχειριστή του OrderDeck.
          </p>
          <Field label="Κωδικός διαχειριστή">
            <input
              type="password"
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              autoFocus
              data-testid="admin-pw"
              className={inputCls}
            />
          </Field>
          <Button
            type="submit"
            disabled={busy || !pwInput}
            data-testid="admin-login"
            className="w-full h-11 bg-brand hover:bg-brand-hover text-white font-bold"
          >
            {busy ? "Έλεγχος..." : "Είσοδος"}
          </Button>
        </form>
      </div>
    );
  }

  // ============ MAIN ============
  return (
    <div className="min-h-screen bg-[#2A0E14] text-white px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-brand flex items-center justify-center">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Εκπτωτικοί κωδικοί</h1>
              <div className="text-xs text-neutral-500">Διαχείριση OrderDeck</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={refresh}
              className="h-10 px-3 bg-[#3D1620] border border-[#5E2A3A] hover:border-flame text-white"
              data-testid="admin-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              onClick={() => setShowCreate((s) => !s)}
              data-testid="admin-new-promo"
              className="h-10 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              <Plus className="w-4 h-4 mr-1" /> Νέος κωδικός
            </Button>
          </div>
        </div>

        {/* CREATE FORM */}
        {showCreate && (
          <form onSubmit={create} className="bg-[#3D1620] border border-[#5E2A3A] rounded-lg p-5 mb-6 space-y-4">
            <h2 className="font-heading text-lg font-bold">Νέος εκπτωτικός κωδικός</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Κωδικός" optional>
                <input
                  value={form.code}
                  onChange={(e) => set("code", e.target.value.toUpperCase())}
                  placeholder="Κενό = αυτόματη δημιουργία"
                  data-testid="promo-code-input"
                  className={`${inputCls} font-mono tracking-wider`}
                />
              </Field>
              <Field label="Τύπος έκπτωσης">
                <select
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                  data-testid="promo-type"
                  className={inputCls}
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field
                label={
                  form.type === "fixed"
                    ? "Ποσό (€)"
                    : form.type === "free_months"
                      ? "Αριθμός μηνών"
                      : "Ποσοστό (%)"
                }
              >
                <input
                  inputMode="decimal"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  placeholder={form.type === "free_months" ? "π.χ. 3" : "π.χ. 20"}
                  data-testid="promo-value"
                  className={inputCls}
                />
              </Field>
              {form.type !== "lifetime_discount" && form.type !== "free_months" && (
                <Field label="Διάρκεια ισχύος για τον πελάτη">
                  <select
                    value={form.duration}
                    onChange={(e) => set("duration", e.target.value)}
                    data-testid="promo-duration"
                    className={inputCls}
                  >
                    {Object.entries(DURATION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Όριο χρήσεων" optional>
                <input
                  inputMode="numeric"
                  value={form.max_uses}
                  onChange={(e) => set("max_uses", e.target.value.replace(/\D/g, ""))}
                  placeholder="Χωρίς όριο"
                  data-testid="promo-max-uses"
                  className={inputCls}
                />
              </Field>
              <Field label="Λήξη κωδικού" optional>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => set("expires_at", e.target.value)}
                  data-testid="promo-expires"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={busy}
                data-testid="promo-create"
                className="h-11 bg-brand hover:bg-brand-hover text-white font-bold"
              >
                {busy ? "Δημιουργία..." : "Δημιουργία"}
              </Button>
              <Button
                type="button"
                onClick={() => setShowCreate(false)}
                className="h-11 bg-[#2A0E14] border border-[#5E2A3A] hover:border-flame text-white"
              >
                Άκυρο
              </Button>
            </div>
          </form>
        )}

        {/* LIST */}
        {codes.length === 0 ? (
          <div className="text-center text-neutral-500 py-16 border border-dashed border-[#5E2A3A] rounded-lg">
            Δεν υπάρχουν εκπτωτικοί κωδικοί ακόμα.
          </div>
        ) : (
          <div className="space-y-3" data-testid="promo-list">
            {codes.map((p) => (
              <div
                key={p.id}
                className={`bg-[#3D1620] border rounded-lg p-4 ${
                  p.active ? "border-[#5E2A3A]" : "border-[#5E2A3A] opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-mono text-lg font-bold tracking-wider text-gold">{p.code}</div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-flame/15 text-flame">
                    {promoValueLabel(p)}
                  </span>
                  <span className="text-xs text-neutral-400">{DURATION_LABELS[p.duration] || p.duration}</span>
                  {!p.active && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FF3B30]/15 text-[#FF6961]">
                      Ανενεργός
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      type="button"
                      onClick={() => toggle(p)}
                      title={p.active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                      data-testid={`promo-toggle-${p.code}`}
                      className={`h-9 px-3 border text-xs font-bold ${
                        p.active
                          ? "bg-[#2A0E14] border-[#5E2A3A] hover:border-flame text-neutral-300"
                          : "bg-brand border-brand hover:bg-brand-hover text-white"
                      }`}
                    >
                      <Power className="w-4 h-4 mr-1" />
                      {p.active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => remove(p)}
                      title="Διαγραφή"
                      data-testid={`promo-delete-${p.code}`}
                      className="h-9 px-3 bg-[#2A0E14] border border-[#5E2A3A] hover:border-[#FF3B30] text-[#FF6961]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-xs text-neutral-400">
                  <div>
                    Χρήσεις:{" "}
                    <span className="text-white font-semibold">
                      {p.used_count}
                      {p.max_uses ? ` / ${p.max_uses}` : ""}
                    </span>
                  </div>
                  <div>
                    Λήξη κωδικού: <span className="text-white">{fmtDate(p.expires_at)}</span>
                  </div>
                  <div>
                    Δημιουργήθηκε: <span className="text-white">{fmtDate(p.created_at)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleUses(p)}
                    data-testid={`promo-uses-${p.code}`}
                    className="flex items-center gap-1 text-flame hover:underline font-semibold"
                  >
                    <Store className="w-3.5 h-3.5" />
                    {p.shops_count} {p.shops_count === 1 ? "μαγαζί" : "μαγαζιά"}
                    {expanded === p.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {expanded === p.id && (
                  <div className="mt-3 border-t border-[#5E2A3A] pt-3">
                    {!uses[p.id] ? (
                      <div className="text-xs text-neutral-500">Φόρτωση...</div>
                    ) : uses[p.id].length === 0 ? (
                      <div className="text-xs text-neutral-500">Κανένα μαγαζί δεν έχει χρησιμοποιήσει τον κωδικό.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {uses[p.id].map((s, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-x-3 text-sm">
                            <span className="font-semibold text-white">{s.restaurant_name || "—"}</span>
                            <span className="text-neutral-400">{s.email}</span>
                            {s.city && <span className="text-neutral-500">{s.city}</span>}
                            <span className="text-neutral-500 text-xs ml-auto">{fmtDate(s.applied_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
