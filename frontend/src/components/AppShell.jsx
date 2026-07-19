import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  ShoppingCart,
  BarChart3,
  Settings as SettingsIcon,
  Calendar,
  LogOut,
  ClipboardList,
  ListChecks,
  KeyRound,
  RefreshCw,
  Crown,
  User as UserIcon,
  Image as ImageIcon,
  Wallet,
  History as HistoryIcon,
  CalendarCheck,
  LayoutGrid,
  Clapperboard,
  ArrowRight,
  Store,
  WifiOff,
  ChevronDown,
  Gauge,
  Bot,
  FileText,
  Download,
} from "lucide-react";
import DeckPilotChat from "@/components/DeckPilotChat";
import OfflineBanner from "@/components/OfflineBanner";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { useOfflineStatus } from "@/lib/offline";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABELS, ROLE_COLORS, nameMatchesRole } from "@/lib/roles";
import { businessIcon } from "@/lib/business";

// Full nav list. Each entry lists the roles that can see it.
const ALL_ROLES = ["owner", "manager", "employee", "waiter"];
const STAFF = ["owner", "manager", "employee"];
const MANAGERS = ["owner", "manager"];
const NAV_ALL = [
  { to: "/app", label: "Παραγγελίες", icon: ShoppingCart, testId: "drawer-link-pda", roles: STAFF },
  { to: "/app/tables", label: "Τραπέζια", icon: LayoutGrid, testId: "drawer-link-tables", roles: ALL_ROLES, requiresTables: true },
  { to: "/app/history", label: "Ιστορικό", icon: HistoryIcon, testId: "drawer-link-history", roles: STAFF },
  { to: "/app/menu", label: "Διαχείριση μενού", icon: SettingsIcon, testId: "drawer-link-menu", roles: MANAGERS },
  { to: "/app/stock", label: "Ελλείψεις", icon: ClipboardList, testId: "drawer-link-stock", roles: STAFF },
  { to: "/app/checklist", label: "Checklist", icon: ListChecks, testId: "drawer-link-checklist", roles: STAFF },
  { to: "/app/schedule", label: "Πρόγραμμα υπαλλήλων", icon: Calendar, testId: "drawer-link-schedule", roles: STAFF },
  { to: "/app/waiters", label: "Σερβιτόροι", icon: UserIcon, testId: "drawer-link-waiters", roles: ["manager"] },
  { to: "/app/deck", label: "Deck View", icon: Gauge, testId: "drawer-link-deck", roles: ["owner"] },
];

// Ομάδα "Κατάστημα" — collapsible στο drawer. Εμφανίζεται μόνο αν ο ρόλος
// βλέπει τουλάχιστον ένα από τα περιεχόμενά της.
const NAV_STORE = [
  { to: "/app/analytics", label: "Στατιστικά", icon: BarChart3, testId: "drawer-link-analytics", roles: ["owner"] },
  { to: "/app/deckpilot", label: "DeckPilot (AI βοηθός)", icon: Bot, testId: "drawer-link-deckpilot", roles: ["owner"], beta: true },
  { to: "/app/brief", label: "Ημερήσιο Brief", icon: FileText, testId: "drawer-link-brief", roles: ["owner"], beta: true },
  { to: "/app/day-close", label: "Κλείσιμο ημέρας", icon: CalendarCheck, testId: "drawer-link-dayclose", roles: ["owner"] },
  { to: "/app/expenses", label: "Έξοδα", icon: Wallet, testId: "drawer-link-expenses", roles: ["owner"] },
  { to: "/app/photos", label: "Βιβλιοθήκη φωτογραφιών", icon: ImageIcon, testId: "drawer-link-photos", roles: MANAGERS },
  { to: "/app/settings", label: "Ρυθμίσεις", icon: KeyRound, testId: "drawer-link-settings", roles: ["owner"] },
];

const STORE_GROUP_KEY = "orderdeck-nav-store-open";

// Σελίδες που ΔΕΝ δουλεύουν εκτός σύνδεσης (χρειάζονται live δεδομένα server)
const OFFLINE_BLOCKED = {
  "/app/analytics": "Στατιστικά",
  "/app/history": "Ιστορικό",
  "/app/deckpilot": "DeckPilot",
  "/app/brief": "Ημερήσιο Brief",
  "/app/menu": "Διαχείριση μενού",
  "/app/settings": "Ρυθμίσεις",
  "/app/day-close": "Κλείσιμο ημέρας",
  "/app/expenses": "Έξοδα",
  "/app/deck": "Deck View & χάρτης",
  "/app/photos": "Βιβλιοθήκη φωτογραφιών",
};

// Μικρό badge "beta" για features υπό δοκιμή
const BetaBadge = () => (
  <span
    className="px-1.5 py-0.5 rounded text-[9px] font-bold lowercase tracking-wider bg-gold/20 text-gold shrink-0"
    data-testid="beta-badge"
  >
    beta
  </span>
);

// ---------- Demo banner (κάτω από το header όταν ο λογαριασμός είναι δοκιμαστικός) ----------
const remainingMs = (iso) => {
  const t = new Date(iso).getTime() - Date.now();
  return Number.isFinite(t) ? t : 0;
};

const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(sec)}`;
};

function DemoBanner({ expiresAt }) {
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(() => remainingMs(expiresAt));

  useEffect(() => {
    setRemaining(remainingMs(expiresAt));
    const t = setInterval(() => setRemaining(remainingMs(expiresAt)), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const expired = remaining <= 0;
  return (
    <div
      className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 h-11 bg-gold/15 border-b border-gold/40 text-gold"
      data-testid="demo-banner"
    >
      <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm font-bold">
        <Clapperboard className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {expired ? (
            "ΔΟΚΙΜΑΣΤΙΚΟΣ ΛΟΓΑΡΙΑΣΜΟΣ — έληξε"
          ) : (
            <>
              <span className="hidden sm:inline">ΔΟΚΙΜΑΣΤΙΚΟΣ ΛΟΓΑΡΙΑΣΜΟΣ — λήγει σε </span>
              <span className="sm:hidden">Demo · </span>
              <span className="font-mono" data-testid="demo-countdown">{fmtCountdown(remaining)}</span>
            </>
          )}
        </span>
      </div>
      <button
        onClick={() => navigate("/app/register")}
        data-testid="demo-banner-register"
        className="shrink-0 h-8 px-2.5 sm:px-3 rounded-md bg-gold text-black text-xs font-extrabold hover:bg-[#E3B23C] flex items-center gap-1.5 transition-colors"
      >
        <span className="hidden sm:inline">Κάνε πλήρη εγγραφή</span>
        <span className="sm:hidden">Εγγραφή</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function AppShell({ title, children }) {
  const { user, logout, exitProfile, role, canManage, profileName, storeLogo } = useAuth();
  const BizIcon = businessIcon(user && user !== false ? user.business_type : null);
  const [open, setOpen] = useState(false);
  const [pilotOpen, setPilotOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { offline } = useOfflineStatus();
  const blockedLabel = offline ? OFFLINE_BLOCKED[location.pathname] : null;

  const handleLogout = () => {
    logout();
    navigate("/app/login");
  };

  const handleSwitchProfile = async () => {
    try {
      await exitProfile();
    } catch {
      // even if it fails, navigate anyway
    }
    navigate("/app/select-profile");
  };

  // PWA install prompt (Chrome/Edge/Android) — κρατάμε το event για να το τρικάρουμε on demand
  const [installPrompt, setInstallPrompt] = useState(null);
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try {
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstallPrompt(null);
    } catch {
      // ο χρήστης έκλεισε το prompt — κρατάμε το κουμπί
    }
  };

  const [storeOpen, setStoreOpen] = useState(() => {
    try {
      return localStorage.getItem(STORE_GROUP_KEY) !== "0";
    } catch {
      return true;
    }
  });

  const toggleStore = () => {
    setStoreOpen((v) => {
      try {
        localStorage.setItem(STORE_GROUP_KEY, v ? "0" : "1");
      } catch {
        // localStorage unavailable — just toggle in-memory
      }
      return !v;
    });
  };

  const nav = NAV_ALL.filter(
    (n) => n.roles.includes(role) && (!n.requiresTables || user?.tables_enabled)
  ).map((n) => {
    // Non-managers see the schedule read-only
    if (!canManage && n.to === "/schedule") return { ...n, label: "Πρόγραμμα (προβολή)" };
    return n;
  });

  const storeNav = NAV_STORE.filter((n) => n.roles.includes(role));
  const storeActive = storeNav.some((n) => location.pathname === n.to);

  const renderNavLink = (n) => {
    const Icon = n.icon;
    const active = location.pathname === n.to;
    return (
      <Link
        key={n.to}
        to={n.to}
        onClick={() => setOpen(false)}
        data-testid={n.testId}
        className={`flex items-center gap-3 px-4 py-3 rounded-md mb-1 transition-colors ${
          active
            ? "bg-flame/15 text-flame border border-flame/40"
            : "text-neutral-200 hover:bg-[#3D1620] border border-transparent"
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-semibold">{n.label}</span>
        {n.beta && <BetaBadge />}
      </Link>
    );
  };

  const roleColor = ROLE_COLORS[role] || "#888";
  const profileBadge = role ? (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest"
      style={{ backgroundColor: `${roleColor}26`, color: roleColor }}
    >
      {role === "owner" ? <Crown className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
      {profileName && !nameMatchesRole(profileName, role) ? `${profileName} · ` : ""}
      {ROLE_LABELS[role] || role}
    </span>
  ) : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#2A0E14] text-white">
      <header className="flex items-center justify-between gap-2 px-4 md:px-6 h-14 lg:h-16 border-b border-[#723645] bg-[#2A0E14] shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setOpen(true)}
            data-testid="burger-btn"
            aria-label="Μενού"
            className="w-11 h-11 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center text-white transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {storeLogo ? (
              <img
                src={storeLogo}
                alt={user?.restaurant_name || "Λογότυπο"}
                className="w-9 h-9 rounded-md object-contain bg-white/5 shrink-0"
                data-testid="business-icon"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-md bg-brand flex items-center justify-center shrink-0"
                data-testid="business-icon"
              >
                <BizIcon className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className="font-heading text-lg lg:text-xl xl:text-2xl font-bold tracking-tight truncate"
                data-testid="restaurant-name"
              >
                {user?.restaurant_name || "POS"}
              </span>
              {title && (
                <span className="text-xs uppercase tracking-widest text-neutral-500 hidden sm:inline shrink-0">
                  · {title}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="hidden sm:block shrink-0" data-testid="profile-badge">
          {profileBadge}
        </div>
      </header>

      {user && user !== false && user.is_demo && user.demo_expires_at && (
        <DemoBanner expiresAt={user.demo_expires_at} />
      )}

      <AnnouncementBanner />

      <OfflineBanner />

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            data-testid="drawer-backdrop"
          />
          <aside
            className="fixed left-0 top-0 bottom-0 z-50 w-[320px] bg-[#2A0E14] border-r border-[#723645] flex flex-col"
            data-testid="drawer"
          >
            <div className="flex items-center justify-between px-5 h-16 border-b border-[#723645]">
              <div className="flex items-center gap-3">
                {storeLogo ? (
                  <img
                    src={storeLogo}
                    alt={user?.restaurant_name || "Λογότυπο"}
                    className="w-9 h-9 rounded-md object-contain bg-white/5"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center">
                    <BizIcon className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <div className="font-heading text-lg font-bold leading-tight">
                    {user?.restaurant_name || "POS"}
                  </div>
                  <div className="mt-0.5">{profileBadge}</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                data-testid="drawer-close-btn"
                className="w-10 h-10 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 overflow-y-auto">
              {nav.map((n) => renderNavLink(n))}
              {storeNav.length > 0 && (
                <div className="mb-1">
                  <button
                    onClick={toggleStore}
                    data-testid="drawer-group-store"
                    aria-expanded={storeOpen}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors border border-transparent ${
                      storeActive && !storeOpen
                        ? "text-flame hover:bg-[#3D1620]"
                        : "text-neutral-200 hover:bg-[#3D1620]"
                    }`}
                  >
                    <Store className="w-5 h-5" />
                    <span className="font-semibold flex-1 text-left">Κατάστημα</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${storeOpen ? "" : "-rotate-90"}`}
                    />
                  </button>
                  {storeOpen && (
                    <div className="ml-4 pl-3 border-l border-[#723645]">
                      {storeNav.map((n) => renderNavLink(n))}
                    </div>
                  )}
                </div>
              )}
              {role === "owner" && installPrompt && (
                <button
                  onClick={handleInstall}
                  data-testid="drawer-install-btn"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-md mb-1 text-neutral-200 hover:bg-[#3D1620] border border-transparent"
                >
                  <Download className="w-5 h-5" />
                  <span className="font-semibold">Εγκατάσταση εφαρμογής</span>
                </button>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  handleSwitchProfile();
                }}
                data-testid="drawer-switch-profile-btn"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-md mb-1 text-neutral-200 hover:bg-[#3D1620] border border-transparent"
              >
                <RefreshCw className="w-5 h-5" />
                <span className="font-semibold">Αλλαγή προφίλ</span>
              </button>
            </nav>
            <div className="p-3 border-t border-[#723645]">
              <button
                onClick={handleLogout}
                data-testid="drawer-logout-btn"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-neutral-300 hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] border border-[#723645] hover:border-[#FF3B30] transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-semibold">Αποσύνδεση</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {blockedLabel ? (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center"
          data-testid="offline-blocked-page"
        >
          <WifiOff className="w-10 h-10 text-[#FFB340]" />
          <div className="font-heading text-xl font-bold">
            {blockedLabel}: μη διαθέσιμο εκτός σύνδεσης
          </div>
          <div className="text-sm text-neutral-400 max-w-md">
            Αυτή η σελίδα χρειάζεται σύνδεση με τον server. Το ταμείο (Παραγγελίες) συνεχίζει να
            δουλεύει κανονικά — οι παραγγελίες αποθηκεύονται τοπικά και θα συγχρονιστούν αυτόματα.
          </div>
          <Link
            to="/app"
            className="mt-2 h-11 px-5 rounded-md bg-brand hover:bg-brand-hover text-white font-bold flex items-center"
          >
            Μετάβαση στις Παραγγελίες
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
      )}

      {/* DeckPilot — floating κουμπί κάτω δεξιά, owner-only, παντού εκτός από τη σελίδα του */}
      {role === "owner" && location.pathname !== "/app/deckpilot" && (
        <>
          <button
            onClick={() => setPilotOpen(true)}
            data-testid="deckpilot-fab"
            aria-label="DeckPilot (AI βοηθός)"
            className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-flame text-white shadow-lg shadow-black/40 flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Bot className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded text-[9px] font-bold lowercase tracking-wider bg-gold text-black shadow">
              beta
            </span>
          </button>
          {pilotOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
                onClick={() => setPilotOpen(false)}
                data-testid="deckpilot-backdrop"
              />
              <div
                className="fixed z-50 bottom-0 right-0 left-0 sm:left-auto sm:bottom-4 sm:right-4 sm:w-[420px] h-[75vh] sm:h-[600px] sm:max-h-[85vh] bg-[#2A0E14] border border-[#723645] sm:rounded-lg rounded-t-lg flex flex-col overflow-hidden"
                data-testid="deckpilot-panel"
              >
                <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-[#723645]">
                  <div className="flex items-center gap-2 font-heading font-bold">
                    <Bot className="w-4 h-4 text-flame" />
                    DeckPilot
                    <BetaBadge />
                  </div>
                  <button
                    onClick={() => setPilotOpen(false)}
                    data-testid="deckpilot-close"
                    className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <DeckPilotChat />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
