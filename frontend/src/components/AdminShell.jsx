import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
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
  ShieldCheck,
} from "lucide-react";
import {
  apiAdminPing,
  apiAdminLogin,
  apiAdminChangePassword,
  formatApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

// Ένα κοινό gate για όλη την admin περιοχή:
// master → σκέτο password (PROMO_ADMIN_PASSWORD), sub-admin → credential "jwt:<token>"
const PW_KEY = "orderdeck_admin_pw";
const INFO_KEY = "orderdeck_admin_info";

const AdminCtx = createContext(null);
export const useAdminPw = () => useContext(AdminCtx);

// Scope/δικαιώματα του συνδεδεμένου διαχειριστή (από το /admin/ping ή το login)
const AdminInfoCtx = createContext(null);
export const useAdminInfo = () => useContext(AdminInfoCtx);

// Τυλίγει στοιχεία UI που βλέπει ΜΟΝΟ ο master (π.χ. δημιουργία demo)
export function MasterOnly({ children }) {
  const info = useAdminInfo();
  return info?.is_master ? children : null;
}

const NAV = [
  { to: "/admin", label: "Επισκόπηση", icon: LayoutDashboard, end: true },
  { to: "/admin/shops", label: "Μαγαζιά", icon: Store, product: "orderdeck" },
  { to: "/admin/fleet", label: "Εταιρίες Delivery", icon: Truck, product: "fleet" },
  { to: "/admin/subscriptions", label: "Συνδρομές", icon: CreditCard },
  { to: "/admin/leads", label: "Leads", icon: Users },
  { to: "/admin/promo", label: "Κωδικοί", icon: Ticket },
  { to: "/admin/announcements", label: "Ανακοινώσεις", icon: Megaphone },
  { to: "/admin/stock-photos", label: "Φωτογραφίες", icon: Images },
  { to: "/admin/admins", label: "Διαχειριστές", icon: ShieldCheck },
];

// Sub-admin: μόνο οι λίστες των προϊόντων του scope του — όλα τα υπόλοιπα master-only
const navForInfo = (info) =>
  info?.is_master
    ? NAV
    : NAV.filter((n) => n.product && (info?.products || []).includes(n.product));

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame";

function LoginForm({ onAuthed }) {
  const [email, setEmail] = useState("");
  const [pwInput, setPwInput] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (email.trim()) {
        // Sub-admin: email + password → JWT
        const res = await apiAdminLogin(email.trim(), pwInput);
        onAuthed(`jwt:${res.token}`, res);
      } else {
        // Master: σκέτο password
        const info = await apiAdminPing(pwInput);
        onAuthed(pwInput, info);
      }
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

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
          Πρόσβαση μόνο για διαχειριστές της πλατφόρμας.
        </p>
        <div>
          <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
            Email (μόνο για υπο-διαχειριστές)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Κενό για τον κύριο διαχειριστή"
            data-testid="admin-email"
            className={`${inputCls} mt-1`}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
            Κωδικός
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

// Υποχρεωτική αλλαγή προσωρινού κωδικού sub-admin στην πρώτη είσοδο
// (ίδιο pattern με τους διανομείς Fleet)
function ForcePasswordChange({ cred, onDone }) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw1.length < 8) return toast.error("Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες");
    if (pw1 !== pw2) return toast.error("Οι κωδικοί δεν ταιριάζουν");
    setBusy(true);
    try {
      await apiAdminChangePassword(cred, pw1);
      toast.success("Ο κωδικός άλλαξε");
      onDone();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-[#3D1620] border border-[#723645] rounded-lg p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-flame" />
          <h1 className="font-heading text-xl font-bold">Αλλαγή κωδικού</h1>
        </div>
        <p className="text-sm text-neutral-400">
          Συνδεθήκατε με προσωρινό κωδικό — ορίστε τον δικό σας για να συνεχίσετε.
        </p>
        <input
          type="password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          placeholder="Νέος κωδικός (min 8 χαρακτήρες)"
          autoFocus
          data-testid="admin-newpw"
          className={inputCls}
        />
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="Επιβεβαίωση νέου κωδικού"
          data-testid="admin-newpw2"
          className={inputCls}
        />
        <Button
          type="submit"
          disabled={busy || !pw1 || !pw2}
          data-testid="admin-newpw-submit"
          className="w-full h-11 bg-brand hover:bg-brand-hover text-white font-bold"
        >
          {busy ? "Αποθήκευση..." : "Αποθήκευση κωδικού"}
        </Button>
      </form>
    </div>
  );
}

export default function AdminShell({ title, subtitle, actions, children }) {
  const [pw, setPw] = useState(() => sessionStorage.getItem(PW_KEY) || "");
  const [info, setInfo] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(INFO_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [authed, setAuthed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Αυτόματη σύνδεση αν υπάρχει ήδη credential στο session
  useEffect(() => {
    if (!pw) return;
    apiAdminPing(pw)
      .then((res) => {
        setInfo(res);
        sessionStorage.setItem(INFO_KEY, JSON.stringify(res));
        setAuthed(true);
      })
      .catch(() => {
        sessionStorage.removeItem(PW_KEY);
        sessionStorage.removeItem(INFO_KEY);
        setPw("");
        setInfo(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAuthed = (cred, res) => {
    sessionStorage.setItem(PW_KEY, cred);
    sessionStorage.setItem(INFO_KEY, JSON.stringify(res));
    setPw(cred);
    setInfo(res);
    setAuthed(true);
  };

  const logout = () => {
    sessionStorage.removeItem(PW_KEY);
    sessionStorage.removeItem(INFO_KEY);
    setPw("");
    setInfo(null);
    setAuthed(false);
    navigate("/admin");
  };

  if (!authed) return <LoginForm onAuthed={onAuthed} />;

  if (info?.must_change_password) {
    return (
      <ForcePasswordChange
        cred={pw}
        onDone={() => {
          const next = { ...info, must_change_password: false };
          setInfo(next);
          sessionStorage.setItem(INFO_KEY, JSON.stringify(next));
        }}
      />
    );
  }

  // Sub-admin σε master-only σελίδα (π.χ. /admin Επισκόπηση) → στην πρώτη επιτρεπτή
  const nav = navForInfo(info);
  if (!info?.is_master) {
    const allowed = nav.some((n) => n.to === location.pathname);
    if (!allowed) {
      return <Navigate to={nav[0]?.to || "/admin"} replace />;
    }
  }

  return (
    <AdminCtx.Provider value={pw}>
      <AdminInfoCtx.Provider value={info}>
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
                    <div className="text-[11px] text-neutral-500">
                      {info?.is_master
                        ? "Admin panel πλατφόρμας"
                        : `${info?.name || "Υπο-διαχειριστής"} · ${
                            info?.rights === "manage" ? "διαχείριση" : "μόνο προβολή"
                          }${info?.cities?.length ? ` · ${info.cities.join(", ")}` : ""}`}
                    </div>
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
                {nav.map(({ to, label, icon: Icon, end }) => (
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
      </AdminInfoCtx.Provider>
    </AdminCtx.Provider>
  );
}
