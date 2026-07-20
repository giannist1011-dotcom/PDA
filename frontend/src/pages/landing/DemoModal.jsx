import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clapperboard, X } from "lucide-react";
import { BUSINESS_TYPES } from "@/lib/business";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

export default function DemoModal({ open, onClose }) {
  const navigate = useNavigate();
  const { startDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("souvlaki");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const inputCls =
    "mt-1 w-full h-11 px-3 bg-[#0D0D0D] border border-[#333] rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-flame";

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/\S+@\S+\.\S+/.test(email)) return setError("Εισάγετε έγκυρο email");
    if (!name.trim()) return setError("Εισάγετε όνομα επιχείρησης");
    setBusy(true);
    try {
      await startDemo({ email: email.trim(), business_name: name.trim(), business_type: type });
      navigate("/app");
    } catch (err) {
      setError(formatApiError(err));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid="demo-modal"
    >
      <div className="w-full max-w-md bg-[#141414] border border-[#333] rounded-2xl p-6 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-flame/15 border border-flame/30 flex items-center justify-center shrink-0">
              <Clapperboard className="w-5 h-5 text-flame" />
            </div>
            <div>
              <h3 className="font-heading text-xl font-extrabold leading-tight">Δοκιμαστικό demo</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Μπες κατευθείαν — χωρίς εγγραφή, χωρίς κωδικό</p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="demo-modal-close"
            className="w-9 h-9 rounded-lg border border-[#333] hover:border-flame flex items-center justify-center text-neutral-400 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              data-testid="demo-email"
              autoFocus
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
              Όνομα επιχείρησης
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="π.χ. Ο Λευτέρης"
              data-testid="demo-business-name"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
              Τύπος επιχείρησης
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {BUSINESS_TYPES.map((b) => {
                const Icon = b.icon;
                const active = type === b.key;
                return (
                  <button
                    type="button"
                    key={b.key}
                    onClick={() => setType(b.key)}
                    data-testid={`demo-biz-${b.key}`}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all active:scale-[0.98] ${
                      active
                        ? "bg-flame/10 border-flame text-white"
                        : "bg-[#1b1b1b] border-[#333] text-neutral-300 hover:border-flame"
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-lg bg-flame/15 flex items-center justify-center shrink-0 ${
                        active ? "" : "opacity-70"
                      }`}
                    >
                      <Icon className="w-5 h-5 text-flame" />
                    </span>
                    <span className="text-sm font-bold">{b.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              className="text-sm text-[#FF6961] bg-[#FF3B30]/10 border border-[#FF3B30]/40 rounded-lg p-3"
              data-testid="demo-error"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            data-testid="demo-submit"
            className="w-full h-14 rounded-xl bg-flame hover:bg-[#EA580C] text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-flame/25 transition-all disabled:opacity-50"
          >
            {busy ? "Δημιουργία demo..." : (<>Ξεκίνα το demo <ArrowRight className="w-5 h-5" /></>)}
          </button>

          <p className="text-xs text-center text-neutral-500 leading-relaxed" data-testid="demo-warning">
            🎬 Ο δοκιμαστικός λογαριασμός διαγράφεται αυτόματα μετά από 3 ώρες.
          </p>
        </form>
      </div>
    </div>
  );
}
