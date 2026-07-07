import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Crown, User as UserIcon, Delete, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

function PinPad({ profile, onSubmit, onCancel, busy }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);

  const push = (v) => {
    setError(null);
    if (v === "clear") return setPin("");
    if (v === "back") return setPin((p) => p.slice(0, -1));
    setPin((p) => (p.length < 4 ? p + v : p));
  };

  useEffect(() => {
    if (pin.length === 4) {
      onSubmit(pin).catch((err) => {
        setError(formatApiError(err));
        setPin("");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const isOwner = profile === "owner";
  const Icon = isOwner ? Crown : UserIcon;
  const label = isOwner ? "Ιδιοκτήτης" : "Υπάλληλος";

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${
              isOwner ? "bg-[#FF6B00]" : "bg-[#00B0FF]"
            }`}
          >
            <Icon className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-heading text-3xl font-bold" data-testid="pin-profile-label">
            {label}
          </h1>
          <p className="text-sm text-neutral-400 mt-2">Πληκτρολογήστε τον 4-ψήφιο κωδικό</p>
        </div>

        <div className="flex justify-center gap-3 mb-6" data-testid="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center font-mono text-2xl font-bold ${
                pin.length > i
                  ? "border-[#FF6B00] bg-[#FF6B00]/10 text-white"
                  : "border-[#333] bg-[#1A1A1A] text-neutral-600"
              }`}
            >
              {pin.length > i ? "•" : ""}
            </div>
          ))}
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-md border border-[#FF3B30] bg-[#FF3B30]/10 text-sm text-[#FF6961] text-center"
            data-testid="pin-error"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-6">
          {KEYS.map((k) => {
            const isDigit = /^\d$/.test(k);
            const label =
              k === "clear" ? "C" : k === "back" ? <Delete className="w-6 h-6 mx-auto" /> : k;
            return (
              <button
                key={k}
                onClick={() => push(k)}
                disabled={busy}
                data-testid={`pin-key-${k}`}
                className={`h-20 rounded-xl font-heading text-2xl font-bold transition-all active:scale-95 no-select ${
                  isDigit
                    ? "bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] text-white"
                    : k === "clear"
                    ? "bg-[#1A1A1A] border border-[#333] hover:border-[#FF3B30] text-neutral-400 hover:text-[#FF3B30]"
                    : "bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] text-neutral-400"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <button
          onClick={onCancel}
          data-testid="pin-cancel-btn"
          className="w-full h-12 rounded-md border border-[#333] hover:border-[#FF6B00] text-neutral-300 hover:text-white font-semibold"
        >
          ← Επιλογή άλλου προφίλ
        </button>
      </div>
    </div>
  );
}

export default function ProfileSelect() {
  const { user, hasProfile, selectProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user === null) return null;
  if (user === false) return <Navigate to="/login" replace />;
  if (hasProfile) return <Navigate to="/" replace />;

  const handleSubmit = async (pin) => {
    setBusy(true);
    try {
      await selectProfile(chosen, pin);
      toast.success(chosen === "owner" ? "Καλωσήρθατε Ιδιοκτήτη" : "Καλωσήρθατε");
      navigate("/");
    } catch (err) {
      throw err;
    } finally {
      setBusy(false);
    }
  };

  if (chosen) {
    return (
      <PinPad
        profile={chosen}
        onSubmit={handleSubmit}
        onCancel={() => setChosen(null)}
        busy={busy}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
            {user.restaurant_name}
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold">Ποιος συνδέεται;</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setChosen("owner")}
            data-testid="profile-owner-card"
            className="group flex flex-col items-center justify-center gap-4 p-10 bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] rounded-2xl transition-all active:scale-[0.98]"
          >
            <div className="w-28 h-28 rounded-3xl bg-[#FF6B00] group-hover:scale-105 transition-transform flex items-center justify-center">
              <Crown className="w-14 h-14 text-white" />
            </div>
            <div className="font-heading text-2xl font-bold">Ιδιοκτήτης</div>
            <div className="text-sm text-neutral-400 text-center">Πλήρη πρόσβαση</div>
          </button>

          <button
            onClick={() => setChosen("employee")}
            data-testid="profile-employee-card"
            className="group flex flex-col items-center justify-center gap-4 p-10 bg-[#1A1A1A] border border-[#333] hover:border-[#00B0FF] rounded-2xl transition-all active:scale-[0.98]"
          >
            <div className="w-28 h-28 rounded-3xl bg-[#00B0FF] group-hover:scale-105 transition-transform flex items-center justify-center">
              <UserIcon className="w-14 h-14 text-white" />
            </div>
            <div className="font-heading text-2xl font-bold">Υπάλληλος</div>
            <div className="text-sm text-neutral-400 text-center">Παραγγελίες & πρόγραμμα</div>
          </button>
        </div>

        <div className="text-center mt-10">
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            data-testid="profile-full-logout"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md border border-[#333] hover:border-[#FF3B30] text-neutral-300 hover:text-[#FF3B30] text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" /> Αποσύνδεση καταστήματος
          </button>
        </div>

        {(!user.owner_pin_set || !user.employee_pin_set) && (
          <div className="mt-6 text-center text-xs text-neutral-500">
            Προεπιλεγμένοι κωδικοί: <span className="font-mono text-neutral-300">0000</span>. Αλλάξτε
            τους από τις Ρυθμίσεις.
          </div>
        )}
      </div>
    </div>
  );
}
