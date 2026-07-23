import { createContext, useContext, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Lock,
  LayoutDashboard,
  Store,
  CreditCard,
  Users,
  Ticket,
  Images,
  Megaphone,
  LogOut,
  Truck,
} from "lucide-react";
import { apiAdminPing, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Ένα κοινό password gate για όλη την admin περιοχή (PROMO_ADMIN_PASSWORD)
const PW_KEY = "orderdeck_admin_pw";

const AdminCtx = createContext(null);
export const useAdminPw = () => useContext(AdminCtx);

const NAV = [
  { to: "/admin", label: "Επισκόπηση", icon: LayoutDashboard, end: true },
  { to: "/admin/shops", label: "Μαγαζιά", icon: Store },
  { to: "/admin/fleet", label: "Εταιρίες Delivery", icon: Truck },
  { to: "/admin/subscriptions", label: "Συνδρομές", icon: CreditCard },
  { to: "/admin/leads", label: "Leads", icon: Users },
  { to: "/admin/promo", label: "Κωδικοί", icon: Ticket },
  { to: "/admin/announcements", label: "Ανακοινώσεις", icon: Megaphone },
  { to: "/admin/stock-photos", label: "Φωτογραφίες", icon: Images },
];

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame";

export default function AdminShell({ title, subtitle, actions, children }) {
  const [pw, setPw] = useState(() => sessionStorage.getItem(PW_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Αυτόματη σύνδεση αν υπάρχει ήδη password στο session
  useEffect(() => {
    if (!pw) return;
    apiAdminPing(pw)
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
      await apiAdminPing(pwInput);
      sessionStorage.setItem(PW_KEY, pwInput);
      setPw(pwInput);
      setAuthed(true);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(PW_KEY);
    setPw("");
    setAuthed(false);
    navigate("/admin");
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-4">
        <form
          onSubmit={login}
          className="w-full max-w-sm bg-[#3D1620] border border-[#723645] rounded-lg p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-flame" />
            <h1 className="font-heading text-xl font-bold">Διαχείριση OrderDeck</h1>
          </div>
          <p className="text-sm text-neutral-400">
            Πρόσβαση μόνο για τον διαχειριστή της πλατφόρμας.
          </p>
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
              Κωδικός διαχειριστή
            </label>
            <input
              type="password"
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              autoFocus
              data-testid="admin-pw"
              className={`${inputCls} mt-1`}
            />
          </div>
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

  return (
    <AdminCtx.Provider value={pw}>
      <div className="min-h-screen bg-[#2A0E14] text-white">
        {/* HEADER + NAV */}
        <div className="border-b border-[#723645] bg-[#3D1620]/60">
          <div className="max-w-6xl mx-auto px-4 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center font-heading font-bold">
                  OD
                </div>
                <div>
                  <div className="font-heading text-lg font-bold leading-tight">
                    Διαχείριση OrderDeck
                  </div>
                  <div className="text-[11px] text-neutral-500">Admin panel πλατφόρμας</div>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                data-testid="admin-logout"
                className="h-9 px-3 rounded-md bg-[#2A0E14] border border-[#723645] hover:border-flame text-neutral-300 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Έξοδος
              </button>
            </div>
            <nav className="flex gap-1 mt-4 overflow-x-auto" data-testid="admin-nav">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3.5 h-10 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                      isActive
                        ? "border-flame text-white"
                        : "border-transparent text-neutral-400 hover:text-white"
                    }`
                  }
                >
                  <Icon className="w-4 h-4" /> {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* CONTENT */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          {(title || actions) && (
            <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
              <div>
                {title && <h1 className="font-heading text-2xl font-bold">{title}</h1>}
                {subtitle && <div className="text-xs text-neutral-500 mt-0.5">{subtitle}</div>}
              </div>
              {actions && <div className="flex gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </div>
    </AdminCtx.Provider>
  );
}
