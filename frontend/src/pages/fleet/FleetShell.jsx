import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Truck,
  Users,
  KeyRound,
  ShoppingCart,
  Map as MapIcon,
  BarChart3,
  CalendarDays,
  Bike,
  ShieldCheck,
  PackageSearch,
  Store,
  RefreshCw,
  Check,
} from "lucide-react";
import ShellHeader, { RoleBadge, LogoutButton } from "@/components/shared/shell/ShellHeader";
import NavDrawer, {
  DrawerButton,
  DrawerLink,
  DrawerSectionLabel,
} from "@/components/shared/shell/NavDrawer";
import { useFleet } from "@/context/fleet/FleetAuthContext";
import { apiFleetAdminDriverMode, apiFleetSetAdminName, setFleetToken } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";

// Πλοήγηση FleetDeck — ίδια δομή με το NAV του AppShell (OrderDeck): μία λίστα
// ανά επιφάνεια, κάθε εγγραφή με εικονίδιο + ελληνική ετικέτα. Οι εγγραφές με
// `tab` δείχνουν σε καρτέλα της ίδιας σελίδας (?tab=…) — ίδια ροή, μία πλοήγηση.
const NAV_ADMIN = [
  { to: "/fleet", tab: "active", label: "Παραγγελίες", icon: ShoppingCart, testId: "fleet-drawer-orders" },
  { to: "/fleet", tab: "map", label: "Χάρτης", icon: MapIcon, testId: "fleet-drawer-map" },
  { to: "/fleet/stores", label: "Μαγαζιά", icon: Store, testId: "fleet-drawer-stores" },
  { to: "/fleet/members", label: "Διανομείς", icon: Users, testId: "fleet-drawer-members" },
  { to: "/fleet/schedule", label: "Πρόγραμμα", icon: CalendarDays, testId: "fleet-drawer-schedule" },
  { to: "/fleet/stats", label: "Στατιστικά", icon: BarChart3, testId: "fleet-drawer-stats" },
  { to: "/fleet/settings", label: "Ρυθμίσεις", icon: KeyRound, testId: "fleet-drawer-settings" },
];

const NAV_DRIVER = [
  { to: "/fleet/driver", tab: "free", label: "Ελεύθερες", icon: PackageSearch, testId: "fleet-drawer-free" },
  { to: "/fleet/driver", tab: "mine", label: "Οι παραγγελίες μου", icon: Bike, testId: "fleet-drawer-mine" },
  { to: "/fleet/driver/stores", label: "Μαγαζιά", icon: Store, testId: "fleet-drawer-drv-stores" },
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
    const samePath = location.pathname === n.to;
    return (
      <DrawerLink
        key={n.testId}
        to={n.tab ? `${n.to}?tab=${n.tab}` : n.to}
        label={n.label}
        icon={n.icon}
        testId={n.testId}
        active={n.tab ? samePath && currentTab === n.tab : samePath}
        onClick={() => setOpen(false)}
      />
    );
  };

  // Badge προφίλ — ίδιο component με του OrderDeck (χρώμα ρόλου, κεφαλαία)
  const profileBadge =
    team && team !== false && team.role ? (
      <RoleBadge
        color={isDriver ? "#F97316" : "#D4A017"}
        icon={isDriver ? Bike : ShieldCheck}
        testId="fleet-profile-badge"
      >
        <span className="max-w-[110px] truncate">
          {isDriver ? team.member_name || "Οδηγός" : "Διαχείριση"}
        </span>
      </RoleBadge>
    ) : null;

  const brandMark = (
    <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center shrink-0">
      <Truck className="w-5 h-5 text-white" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white">
      <ShellHeader
        onBurger={() => setOpen(true)}
        burgerTestId="fleet-burger-btn"
        mark={brandMark}
        name={team && team !== false ? team.name : "FleetDeck"}
        nameTestId="fleet-team-name"
        title={title}
        actions={actions}
        badge={profileBadge}
      />

      <NavDrawer
        open={open}
        onClose={() => setOpen(false)}
        testIdPrefix="fleet-drawer"
        brand={{
          mark: brandMark,
          name: team && team !== false ? team.name : "FleetDeck",
          badge: profileBadge,
        }}
        footer={
          <LogoutButton
            testId="fleet-logout"
            onClick={() => {
              logout();
              navigate(isDriver ? "/fleet/driver-login" : "/fleet/login");
            }}
          />
        }
      >
        {nav.map(renderNavLink)}

        {/* Εναλλαγή προφίλ Διαχειριστής ↔ προσωπικό προφίλ οδηγού — στη
            θέση της «Αλλαγής προφίλ» του OrderDeck, χωρίς logout */}
        {canSwitch && (
          <div className="mt-2 pt-2 border-t border-[#723645]">
            <DrawerSectionLabel>Προφίλ</DrawerSectionLabel>
            <DrawerButton
              label="Διαχείριση"
              icon={ShieldCheck}
              iconClass="text-gold"
              onClick={switchToAdmin}
              testId="fleet-profile-admin"
              trailing={isAdmin ? <Check className="w-4 h-4 ml-auto text-flame" /> : null}
            />
            <DrawerButton
              label="Οδηγός"
              icon={Bike}
              iconClass="text-flame"
              onClick={switchToDriver}
              disabled={busyDriverMode}
              testId="fleet-profile-driver"
              trailing={isDriver ? <Check className="w-4 h-4 ml-auto text-flame" /> : null}
            />
          </div>
        )}

        {/* Αλλαγή μέλους μόνο στο dashboard — ο οδηγός μπαίνει πάντα στη
            μία εταιρεία του λογαριασμού του, χωρίς switcher */}
        {!isDriver && (
          <DrawerButton
            label="Αλλαγή μέλους"
            icon={RefreshCw}
            onClick={() => {
              setOpen(false);
              changeMember();
            }}
            testId="fleet-change-member"
          />
        )}
      </NavDrawer>

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
