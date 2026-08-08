import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  X,
  ShoppingCart,
  BarChart3,
  Calendar,
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
  BookOpen,
  Gauge,
  Bot,
  FileText,
  Download,
  Truck,
  Handshake,
} from "lucide-react";
import ShellHeader, { RoleBadge, LogoutButton } from "@/components/shared/shell/ShellHeader";
import NavDrawer, {
  DrawerButton,
  DrawerGroup,
  DrawerLink,
} from "@/components/shared/shell/NavDrawer";
import DeckPilotChat from "@/components/pos/DeckPilotChat";
import OfflineBanner from "@/components/shared/OfflineBanner";
import AnnouncementBanner from "@/components/shared/AnnouncementBanner";
import RelayAgent from "@/components/shared/printing/RelayAgent";
import PlatformOrderPopup from "@/components/platforms/PlatformOrderPopup";
import { useOfflineStatus } from "@/lib/offline";
import { useAuth } from "@/context/shared/AuthContext";
import { ROLE_LABELS, ROLE_COLORS, nameMatchesRole } from "@/lib/roles";
import { can } from "@/lib/perms";
import { hasDispatch, hasPOS } from "@/lib/plans";
import { businessIcon } from "@/lib/business";

// Full nav list. Each entry lists the roles that can see it.
const ALL_ROLES = ["owner", "manager", "employee", "waiter"];
const STAFF = ["owner", "manager", "employee"];
const MANAGERS = ["owner", "manager"];
const NAV_ALL = [
  // Deck View ΠΡΩΤΟ στο μενού (πάνω από τις Παραγγελίες) — προφίλ χωρίς πρόσβαση
  // δεν το βλέπουν (navVisible) και προσγειώνονται στις Παραγγελίες όπως πριν
  { to: "/app/deck", label: "Deck View", icon: Gauge, testId: "drawer-link-deck", roles: ["owner"] },
  { to: "/app", label: "Παραγγελίες", icon: ShoppingCart, testId: "drawer-link-pda", roles: STAFF },
  { to: "/app/tables", label: "Τραπέζια", icon: LayoutGrid, testId: "drawer-link-tables", roles: ALL_ROLES, requiresTables: true },
  { to: "/app/history", label: "Ιστορικό", icon: HistoryIcon, testId: "drawer-link-history", roles: STAFF, perm: "history" },
  { to: "/app/stock", label: "Ελλείψεις", icon: ClipboardList, testId: "drawer-link-stock", roles: STAFF },
  { to: "/app/checklist", label: "Checklist", icon: ListChecks, testId: "drawer-link-checklist", roles: STAFF },
  { to: "/app/schedule", label: "Πρόγραμμα υπαλλήλων", icon: Calendar, testId: "drawer-link-schedule", roles: STAFF },
  { to: "/app/waiters", label: "Σερβιτόροι", icon: UserIcon, testId: "drawer-link-waiters", roles: ["manager"] },
];

// Ομάδα "Κατάστημα" — collapsible στο drawer. Εμφανίζεται μόνο αν ο ρόλος
// βλέπει τουλάχιστον ένα από τα περιεχόμενά της.
// Η «Διαχείριση μενού» ζει εδώ (όχι πια στο κυρίως μενού) — η διαδρομή /app/menu
// μένει ίδια, οπότε κάθε παλιός σύνδεσμος/bookmark συνεχίζει να δουλεύει.
const NAV_STORE = [
  { to: "/app/menu", label: "Διαχείριση μενού", icon: BookOpen, testId: "drawer-link-menu", roles: MANAGERS, perm: "menu" },
  { to: "/app/analytics", label: "Στατιστικά", icon: BarChart3, testId: "drawer-link-analytics", roles: ["owner"], perm: "analytics" },
  { to: "/app/deckpilot", label: "DeckPilot (AI βοηθός)", icon: Bot, testId: "drawer-link-deckpilot", roles: ["owner"], beta: true, requiresAI: true },
  { to: "/app/brief", label: "Ημερήσιο Brief", icon: FileText, testId: "drawer-link-brief", roles: ["owner"], beta: true, requiresAI: true },
  { to: "/app/day-close", label: "Κλείσιμο ημέρας", icon: CalendarCheck, testId: "drawer-link-dayclose", roles: ["owner"], perm: "day_close" },
  { to: "/app/expenses", label: "Έξοδα", icon: Wallet, testId: "drawer-link-expenses", roles: ["owner"], perm: "expenses" },
  { to: "/app/photos", label: "Βιβλιοθήκη φωτογραφιών", icon: ImageIcon, testId: "drawer-link-photos", roles: MANAGERS, perm: "menu" },
  { to: "/app/settings", label: "Ρυθμίσεις", icon: KeyRound, testId: "drawer-link-settings", roles: ["owner"], perm: "settings" },
];

// Πλάνο «fleet» (FleetDeck καταστήματος): χωρίς POS — μόνο αυτές οι ενότητες.
// Ρόλοι: Ιδιοκτήτης όλα, Υπάλληλος μόνο Παραγγελίες (όπως τα permissions του POS).
const NAV_FLEET_STORE = [
  { to: "/app/fleet", label: "Παραγγελίες", icon: Truck, testId: "drawer-link-fleet-orders", roles: ["owner", "employee"] },
  { to: "/app/fleet/stats", label: "Στατιστικά", icon: BarChart3, testId: "drawer-link-fleet-stats", roles: ["owner"] },
  { to: "/app/fleet/partners", label: "Αίτημα συνεργασίας", icon: Handshake, testId: "drawer-link-fleet-partners", roles: ["owner"] },
  { to: "/app/fleet/settings", label: "Ρυθμίσεις", icon: KeyRound, testId: "drawer-link-fleet-settings", roles: ["owner"] },
];

// Πλάνο «OrderDeck Fleet»: POS + FleetDeck καταστήματος στο ΙΔΙΟ session/login.
// Η σελίδα «FleetDeck» είναι ΤΟ STORE dashboard (/app/fleet) — ποτέ ο πίνακας της
// εταιρείας διανομής (/fleet), που είναι ξεχωριστός λογαριασμός.
const NAV_OD_FLEET = [
  { to: "/app/fleet", label: "FleetDeck", icon: Truck, testId: "drawer-link-fleet", roles: ["owner", "employee"] },
];
// Μέσα στην ομάδα «Κατάστημα» — διαχείριση της διανομής, μόνο Ιδιοκτήτης
const NAV_OD_FLEET_STORE = [
  { to: "/app/fleet/partners", label: "Συνεργασίες διανομής", icon: Handshake, testId: "drawer-link-fleet-partners", roles: ["owner"] },
  { to: "/app/fleet/stats", label: "Στατιστικά διανομής", icon: BarChart3, testId: "drawer-link-fleet-stats", roles: ["owner"] },
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
  "/app/fleet": "FleetDeck",
  "/app/fleet/partners": "Συνεργασίες διανομής",
  "/app/fleet/stats": "Στατιστικά διανομής",
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

export default function AppShell({ title, headerTabs, children }) {
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

  // Φίλτρο nav: ρόλος + per-profile δικαίωμα + flag AI features του λογαριασμού
  const navVisible = (n) =>
    n.roles.includes(role) &&
    (!n.requiresTables || user?.tables_enabled) &&
    (!n.perm || can(user, n.perm)) &&
    (!n.requiresAI || user?.ai_features_enabled);

  // GATING ΑΝΑ ΠΛΑΝΟ (ίδιος κανόνας με routes/καρτέλες — lib/plans.js):
  //   fleet           → μόνο το standalone store app (καθόλου POS)
  //   orderdeck       → καθαρό POS, ΤΙΠΟΤΑ fleet
  //   orderdeck_fleet → POS + FleetDeck καταστήματος στο ίδιο session
  const isFleetStore = !hasPOS(user);
  const isODFleet = hasDispatch(user);
  const baseNav = isFleetStore ? NAV_FLEET_STORE : [...NAV_ALL, ...(isODFleet ? NAV_OD_FLEET : [])];
  const nav = baseNav.filter(navVisible).map((n) => {
    // Non-managers see the schedule read-only
    if (!canManage && n.to === "/schedule") return { ...n, label: "Πρόγραμμα (προβολή)" };
    return n;
  });

  const storeNav = isFleetStore
    ? []
    : [...NAV_STORE, ...(isODFleet ? NAV_OD_FLEET_STORE : [])].filter(navVisible);
  const storeActive = storeNav.some((n) => location.pathname === n.to);

  const renderNavLink = (n) => (
    <DrawerLink
      key={n.to}
      to={n.to}
      label={n.label}
      icon={n.icon}
      testId={n.testId}
      active={location.pathname === n.to}
      onClick={() => setOpen(false)}
      trailing={n.beta ? <BetaBadge /> : null}
    />
  );

  const profileBadge = role ? (
    <RoleBadge
      color={ROLE_COLORS[role] || "#888"}
      icon={role === "owner" ? Crown : UserIcon}
    >
      {profileName && !nameMatchesRole(profileName, role) ? `${profileName} · ` : ""}
      {ROLE_LABELS[role] || role}
    </RoleBadge>
  ) : null;

  // Σήμα λογαριασμού (λογότυπο ή εικονίδιο επιχείρησης) — header & drawer
  const brandMark = (testId) =>
    storeLogo ? (
      <img
        src={storeLogo}
        alt={user?.restaurant_name || "Λογότυπο"}
        className="w-9 h-9 rounded-md object-contain bg-white/5 shrink-0"
        data-testid={testId}
      />
    ) : (
      <div
        className="w-9 h-9 rounded-md bg-brand flex items-center justify-center shrink-0"
        data-testid={testId}
      >
        <BizIcon className="w-5 h-5 text-white" />
      </div>
    );

  return (
    <div className="h-screen w-screen flex flex-col bg-[#2A0E14] text-white">
      <ShellHeader
        onBurger={() => setOpen(true)}
        burgerTestId="burger-btn"
        mark={brandMark("business-icon")}
        name={user?.restaurant_name || "POS"}
        nameTestId="restaurant-name"
        title={title}
        tabs={headerTabs}
        badge={profileBadge}
      />

      {user && user !== false && user.is_demo && user.demo_expires_at && (
        <DemoBanner expiresAt={user.demo_expires_at} />
      )}

      <AnnouncementBanner />

      <OfflineBanner />

      {/* Kiosk Relay: poll/εκτύπωση στον σταθμό, warning banner στις άλλες συσκευές.
          ΠΟΤΕ στο πλάνο «fleet» (FleetDeck καταστήματος): εκεί το μαγαζί μόνο
          ανεβάζει παραγγελίες — καμία εκτύπωση, άρα και κανένας σταθμός. */}
      {hasPOS(user) && <RelayAgent />}

      {/* Νέα παραγγελία πλατφόρμας — popup πάνω δεξιά σε κάθε οθόνη */}
      <PlatformOrderPopup />

      <NavDrawer
        open={open}
        onClose={() => setOpen(false)}
        testIdPrefix="drawer"
        brand={{
          mark: brandMark(),
          name: user?.restaurant_name || "POS",
          badge: profileBadge,
        }}
        footer={<LogoutButton onClick={handleLogout} testId="drawer-logout-btn" />}
      >
        {nav.map((n) => renderNavLink(n))}
        {storeNav.length > 0 && (
          <DrawerGroup
            label="Κατάστημα"
            icon={Store}
            open={storeOpen}
            onToggle={toggleStore}
            active={storeActive}
            testId="drawer-group-store"
          >
            {storeNav.map((n) => renderNavLink(n))}
          </DrawerGroup>
        )}
        {role === "owner" && installPrompt && (
          <DrawerButton
            label="Εγκατάσταση εφαρμογής"
            icon={Download}
            onClick={handleInstall}
            testId="drawer-install-btn"
          />
        )}
        <DrawerButton
          label="Αλλαγή προφίλ"
          icon={RefreshCw}
          onClick={() => {
            setOpen(false);
            handleSwitchProfile();
          }}
          testId="drawer-switch-profile-btn"
        />
      </NavDrawer>

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

      {/* DeckPilot — floating κουμπί κάτω δεξιά, owner-only + ενεργά AI features,
          παντού εκτός από τη σελίδα του */}
      {role === "owner" && user?.ai_features_enabled && location.pathname !== "/app/deckpilot" && (
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
