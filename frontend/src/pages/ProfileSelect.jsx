import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Crown, User as UserIcon, Delete, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiListProfiles, formatApiError } from "@/lib/api";
import { ROLE_LABELS, ROLE_COLORS, nameMatchesRole } from "@/lib/roles";

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

  const color = ROLE_COLORS[profile.role] || "#888";
  const Icon = profile.role === "owner" ? Crown : UserIcon;

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
            style={{ backgroundColor: color }}
          >
            <Icon className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-heading text-3xl font-bold" data-testid="pin-profile-label">
            {profile.name}
          </h1>
          {!nameMatchesRole(profile.name, profile.role) && (
            <div
              className="mt-1 text-[11px] font-bold uppercase tracking-widest"
              style={{ color }}
            >
              {ROLE_LABELS[profile.role] || profile.role}
            </div>
          )}
          <p className="text-sm text-neutral-400 mt-2">Πληκτρολογήστε τον 4-ψήφιο κωδικό</p>
        </div>

        <div className="flex justify-center gap-3 mb-6" data-testid="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center font-mono text-2xl font-bold ${
                pin.length > i
                  ? "border-flame bg-flame/10 text-white"
                  : "border-[#723645] bg-[#3D1620] text-neutral-600"
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
                    ? "bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
                    : k === "clear"
                    ? "bg-[#3D1620] border border-[#723645] hover:border-[#FF3B30] text-neutral-400 hover:text-[#FF3B30]"
                    : "bg-[#3D1620] border border-[#723645] hover:border-flame text-neutral-400"
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
          className="w-full h-12 rounded-md bg-[#4A1B27] border border-[#723645] hover:border-flame text-neutral-200 hover:text-white font-semibold"
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
  const [profiles, setProfiles] = useState(null); // null = loading
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user === false) return;
    (async () => {
      try {
        setProfiles(await apiListProfiles());
      } catch (e) {
        toast.error(formatApiError(e));
        setProfiles([]);
      }
    })();
  }, [user]);

  if (user === null) return null;
  if (user === false) return <Navigate to="/app/login" replace />;
  if (hasProfile) return <Navigate to="/app" replace />;

  const handleSubmit = async (pin) => {
    setBusy(true);
    try {
      await selectProfile(chosen.id, pin);
      toast.success(`Καλωσήρθες, ${chosen.name}`);
      navigate("/app");
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
    <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <img src="/logo-dark.svg" alt="OrderDeck" className="h-10 mx-auto mb-4" />
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
            {user.restaurant_name}
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold">Ποιος συνδέεται;</h1>
        </div>

        {profiles === null ? (
          <div className="text-center text-neutral-500 py-12">Φόρτωση προφίλ...</div>
        ) : profiles.length === 0 ? (
          <div className="text-center text-neutral-500 py-12">
            Δεν υπάρχουν προφίλ σε αυτόν τον λογαριασμό
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-4">
            {profiles.map((p) => {
              const color = ROLE_COLORS[p.role] || "#888";
              const Icon = p.role === "owner" ? Crown : UserIcon;
              return (
                <button
                  key={p.id}
                  onClick={() => setChosen(p)}
                  data-testid={`profile-card-${p.id}`}
                  className="group w-40 sm:w-48 flex flex-col items-center justify-center gap-3 p-6 bg-[#3D1620] border border-[#723645] rounded-2xl transition-all active:scale-[0.98] hover:border-[var(--pc)]"
                  style={{ "--pc": color }}
                >
                  <div
                    className="w-20 h-20 rounded-2xl group-hover:scale-105 transition-transform flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    <Icon className="w-10 h-10 text-white" />
                  </div>
                  <div className="font-heading text-xl font-bold truncate max-w-full">
                    {p.name}
                  </div>
                  {!nameMatchesRole(p.name, p.role) && (
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest"
                      style={{ backgroundColor: `${color}26`, color }}
                    >
                      {ROLE_LABELS[p.role] || p.role}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="text-center mt-10">
          <button
            onClick={() => {
              logout();
              navigate("/app/login");
            }}
            data-testid="profile-full-logout"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-[#4A1B27] border border-[#723645] hover:border-[#FF3B30] text-neutral-200 hover:text-[#FF3B30] text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" /> Αποσύνδεση καταστήματος
          </button>
        </div>

        {user && (!user.owner_pin_set || !user.employee_pin_set) && (
          <div className="mt-6 text-center text-xs text-neutral-500">
            Αρχικός κωδικός προφίλ: <span className="font-mono text-neutral-300">0000</span>. Αλλάξτε
            τον από τις Ρυθμίσεις.
          </div>
        )}
      </div>
    </div>
  );
}
