import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Truck,
  LogOut,
  Users,
  KeyRound,
  ShoppingCart,
  Map as MapIcon,
  BarChart3,
  Bike,
  ShieldCheck,
  PackageSearch,
  RefreshCw,
  Menu,
  X,
  Check,
} from "lucide-react";
import { useFleet } from "@/context/fleet/FleetAuthContext";
import { apiFleetAdminDriverMode, apiFleetSetAdminName, setFleetToken } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";

// Πλοήγηση FleetDeck — ίδια δομή με το NAV του AppShell (OrderDeck): μία λίστα
// ανά επιφάνεια, κάθε εγγραφή με εικονίδιο + ελληνική ετικέτα. Οι εγγραφές με
// `tab` δείχνουν σε καρτέλα της ίδιας σελίδας (?tab=…) — ίδια ροή, μία πλοήγηση.
const NAV_ADMIN = [
  { to: "/fleet", tab: "active", label: "Παραγγελίες", icon: ShoppingCart, testId: "fleet-drawer-orders" },
  { to: "/fleet", tab: "map", label: "Χάρτης", icon: MapIcon, testId: "fleet-drawer-map" },
  { to: "/fleet/members", label: "Διανομείς", icon: Users, testId: "fleet-drawer-members" },
  { to: "/fleet/stats", label: "Στατιστικά", icon: BarChart3, testId: "fleet-drawer-stats" },
  { to: "/fleet/settings", label: "Ρυθμίσεις", icon: KeyRound, testId: "fleet-drawer-settings" },
];

const NAV_DRIVER = [
  { to: "/fleet/driver", tab: "free", label: "Ελεύθερες", icon: PackageSearch, testId: "fleet-drawer-free" },
  { to: "/fleet/driver", tab: "mine", label: "Οι παραγγελίες μου", icon: Bike, testId: "fleet-drawer-mine" },
  { to: "/fleet/driver", tab: "stats", label: "Στατιστικά", icon: BarChart3, testId: "fleet-drawer-drv-stats" },
  { to: "/fleet/driver/settings", label: "Ρυθμίσεις", icon: KeyRound, testId: "fleet-drawer-drv-settings" },
];

// Κοινό κέλυφος των FleetDeck σελίδων: ίδιο header/burger menu με το AppShell
// του OrderDeck (ίδια tokens, ίδια δομή drawer), με FleetDeck branding και
// δυναμικό όνομα εταιρείας.
export default function FleetShell({ title, children, actions = null }) {
  const { team, refresh, logout, exitMember } = useFleet();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [busyDriverMode, setBusyDriverMode] = useState(false);
  // Μία φορά: αν ο διαχειριστής δεν έχει ορίσει προσωπικό όνομα, ζητείται πριν
  // την πρώτη εναλλαγή σε προφίλ οδηγού (αποθηκεύεται στο ίδιο πεδίο των ρυθμίσεων)
  const [nameModal, setNameModal] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const isAdmin = team && team.role === "fleet_admin";
  const isDriver = team && team.role === "driver";
  // Ο γρήγορος εναλλάκτης προφίλ (όπως στο POS) εμφανίζεται στον διαχειριστή και
  // στο προσωπικό driver προφίλ του — όχι σε απλούς οδηγούς
  const canSwitch = isAdmin || (isDriver && team.is_admin_driver);

  // Τίτλος tab: όνομα εταιρείας — FleetDeck. Και δικό του PWA manifest ώστε η
  // εγκατεστημένη εφαρμογή οδηγού να λέγεται FleetDeck (όχι OrderDeck).
  useEffect(() => {
    const name = team && team !== false ? team.name : null;
    document.title = name ? `${name} — FleetDeck` : "FleetDeck";
    const link = document.querySelector('link[rel="manifest"]');
    const prev = link?.getAttribute("href");
    if (link) link.setAttribute("href", "/manifest-fleet.json");
    return () => {
      document.title = "OrderDeck — POS για την εστίασή σου";
      if (link && prev) link.setAttribute("href", prev);
    };
  }, [team]);

  const changeMember = async () => {
    await exitMember();
    navigate("/fleet/select");
  };

  // Προφίλ «Οδηγός»: driver token του διαχειριστή → driver κλειδί (κατά ρόλο
  // token) — το session διαχειριστή μένει άθικτο στο δικό του κλειδί.
  const enterDriverMode = async () => {
    setBusyDriverMode(true);
    try {
      const data = await apiFleetAdminDriverMode();
      setFleetToken(data.token);
      setOpen(false);
      setNameModal(false);
      navigate("/fleet/driver");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusyDriverMode(false);
    }
  };

  const switchToDriver = async () => {
    if (isDriver) return setOpen(false);
    // Χωρίς προσωπικό όνομα ακόμα → one-time prompt πριν την πρώτη εναλλαγή
    if (isAdmin && !team.admin_display_name) {
      setNameDraft("");
      setOpen(false);
      setNameModal(true);
      return;
    }
    await enterDriverMode();
  };

  // Προφίλ «Διαχειριστής»: το admin session ζει στο δικό του κλειδί — απλή
  // αλλαγή επιφάνειας, ο provider επαναφορτώνει το σωστό token
  const switchToAdmin = () => {
    setOpen(false);
    if (!isAdmin) navigate("/fleet");
  };

  const saveNameAndSwitch = async (e) => {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name) return;
    setBusyDriverMode(true);
    try {
      await apiFleetSetAdminName(name);
      await refresh();
    } catch (err) {
      toast.error(formatApiError(err));
      setBusyDriverMode(false);
      return;
    }
    await enterDriverMode();
  };

  const nav = isDriver ? NAV_DRIVER : isAdmin ? NAV_ADMIN : [];
  const currentTab = searchParams.get("tab");

  const renderNavLink = (n) => {
    const Icon = n.icon;
    const samePath = location.pathname === n.to;
    const active = n.tab ? samePath && currentTab === n.tab : samePath;
    return (
      <Link
        key={n.testId}
        to={n.tab ? `${n.to}?tab=${n.tab}` : n.to}
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
      </Link>
    );
  };

  // Badge προφίλ — ίδιο σχήμα με του OrderDeck (χρώμα ρόλου, κεφαλαία)
  const roleColor = isDriver ? "#F97316" : "#D4A017";
  const profileBadge = team && team !== false && team.role ? (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest"
      style={{ backgroundColor: `${roleColor}26`, color: roleColor }}
      data-testid="fleet-profile-badge"
    >
      {isDriver ? <Bike className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
      <span className="max-w-[110px] truncate">
        {isDriver ? team.member_name || "Οδηγός" : "Διαχείριση"}
      </span>
    </span>
  ) : null;

  const drawerBtn =
    "w-full flex items-center gap-3 px-4 py-3 rounded-md mb-1 text-neutral-200 hover:bg-[#3D1620] border border-transparent disabled:opacity-60";

  const brandMark = (
    <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center shrink-0">
      <Truck className="w-5 h-5 text-white" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 md:px-6 h-14 lg:h-16 border-b border-[#723645] bg-[#2A0E14]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setOpen(true)}
            data-testid="fleet-burger-btn"
            aria-label="Μενού"
            className="w-11 h-11 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center text-white transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          {brandMark}
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="font-heading text-lg lg:text-xl font-bold tracking-tight truncate"
              data-testid="fleet-team-name"
            >
              {team && team !== false ? team.name : "FleetDeck"}
            </span>
            {title && (
              <span className="text-xs uppercase tracking-widest text-neutral-500 hidden sm:inline shrink-0">
                · {title}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <div className="hidden sm:block">{profileBadge}</div>
        </div>
      </header>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            data-testid="fleet-drawer-backdrop"
          />
          <aside
            className="fixed left-0 top-0 bottom-0 z-50 w-[320px] bg-[#2A0E14] border-r border-[#723645] flex flex-col"
            data-testid="fleet-drawer"
          >
            <div className="flex items-center justify-between px-5 h-16 border-b border-[#723645]">
              <div className="flex items-center gap-3 min-w-0">
                {brandMark}
                <div className="min-w-0">
                  <div className="font-heading text-lg font-bold leading-tight truncate">
                    {team && team !== false ? team.name : "FleetDeck"}
                  </div>
                  <div className="mt-0.5">{profileBadge}</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                data-testid="fleet-drawer-close-btn"
                className="w-10 h-10 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 overflow-y-auto">
              {nav.map(renderNavLink)}

              {/* Εναλλαγή προφίλ Διαχειριστής ↔ προσωπικό προφίλ οδηγού — στη
                  θέση της «Αλλαγής προφίλ» του OrderDeck, χωρίς logout */}
              {canSwitch && (
                <div className="mt-2 pt-2 border-t border-[#723645]">
                  <div className="px-4 pt-1 pb-2 text-[10px] uppercase tracking-widest font-bold text-neutral-500">
                    Προφίλ
                  </div>
                  <button
                    onClick={switchToAdmin}
                    className={drawerBtn}
                    data-testid="fleet-profile-admin"
                  >
                    <ShieldCheck className="w-5 h-5 text-gold" />
                    <span className="font-semibold">Διαχείριση</span>
                    {isAdmin && <Check className="w-4 h-4 ml-auto text-flame" />}
                  </button>
                  <button
                    onClick={switchToDriver}
                    disabled={busyDriverMode}
                    className={drawerBtn}
                    data-testid="fleet-profile-driver"
                  >
                    <Bike className="w-5 h-5 text-flame" />
                    <span className="font-semibold">Οδηγός</span>
                    {isDriver && <Check className="w-4 h-4 ml-auto text-flame" />}
                  </button>
                </div>
              )}

              {/* Αλλαγή μέλους μόνο στο dashboard — ο οδηγός μπαίνει πάντα στη
                  μία εταιρεία του λογαριασμού του, χωρίς switcher */}
              {!isDriver && (
                <button
                  onClick={() => {
                    setOpen(false);
                    changeMember();
                  }}
                  className={drawerBtn}
                  data-testid="fleet-change-member"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span className="font-semibold">Αλλαγή μέλους</span>
                </button>
              )}
            </nav>
            <div className="p-3 border-t border-[#723645]">
              <button
                onClick={() => {
                  logout();
                  navigate(isDriver ? "/fleet/driver-login" : "/fleet/login");
                }}
                data-testid="fleet-logout"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-neutral-300 hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] border border-[#723645] hover:border-[#FF3B30] transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-semibold">Αποσύνδεση</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {title && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <h1 className="font-heading text-xl font-bold">{title}</h1>
        </div>
      )}
      <main className="max-w-6xl mx-auto px-4 py-4">{children}</main>

      {nameModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={saveNameAndSwitch}
            className="w-full max-w-sm bg-[#3D1620] border border-[#723645] rounded-lg p-4 space-y-3"
            data-testid="fleet-admin-name-modal"
          >
            <h3 className="font-heading font-bold">Το όνομά σας</h3>
            <p className="text-xs text-neutral-400">
              Στο προφίλ οδηγού εμφανίζεστε με το προσωπικό σας όνομα (όπως κάθε
              διανομέας) — όχι με το όνομα της εταιρείας. Ορίστε το μία φορά·
              αλλάζει από τους «Διανομείς».
            </p>
            <input
              autoFocus
              required
              maxLength={40}
              placeholder="π.χ. Γιάννης"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame"
              data-testid="fleet-admin-name-input"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busyDriverMode || !nameDraft.trim()}
                className="flex-1 h-11 rounded-md bg-brand hover:bg-brand-hover text-white text-sm font-bold disabled:opacity-60"
                data-testid="fleet-admin-name-save"
              >
                Αποθήκευση & συνέχεια
              </button>
              <button
                type="button"
                onClick={() => setNameModal(false)}
                className="h-11 px-4 rounded-md border border-[#723645] text-neutral-300 text-sm hover:bg-white/5"
              >
                Άκυρο
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
