import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Truck,
  LogOut,
  Users,
  Settings,
  LayoutGrid,
  Bike,
  ShieldCheck,
  ChevronDown,
  Check,
} from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import { apiFleetAdminDriverMode, apiFleetSetAdminName, setFleetToken } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";

// Κοινό κέλυφος των FleetDeck σελίδων: FleetDeck branding + δυναμικό όνομα
// εταιρείας στο header. Δεν χρησιμοποιεί το AppShell των μαγαζιών.
export default function FleetShell({ title, children, actions = null }) {
  const { team, refresh, logout, exitMember } = useFleet();
  const navigate = useNavigate();
  const [busyDriverMode, setBusyDriverMode] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // Μία φορά: αν ο διαχειριστής δεν έχει ορίσει προσωπικό όνομα, ζητείται πριν
  // την πρώτη εναλλαγή σε προφίλ οδηγού (αποθηκεύεται στο ίδιο πεδίο των ρυθμίσεων)
  const [nameModal, setNameModal] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const switcherRef = useRef(null);
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

  // Κλείσιμο του switcher με click εκτός
  useEffect(() => {
    if (!switcherOpen) return;
    const onDown = (e) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) setSwitcherOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [switcherOpen]);

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
      setSwitcherOpen(false);
      setNameModal(false);
      navigate("/fleet/driver");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusyDriverMode(false);
    }
  };

  const switchToDriver = async () => {
    if (isDriver) return setSwitcherOpen(false);
    // Χωρίς προσωπικό όνομα ακόμα → one-time prompt πριν την πρώτη εναλλαγή
    if (isAdmin && !team.admin_display_name) {
      setNameDraft("");
      setSwitcherOpen(false);
      setNameModal(true);
      return;
    }
    await enterDriverMode();
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

  // Προφίλ «Διαχειριστής»: το admin session ζει στο δικό του κλειδί — απλή
  // αλλαγή επιφάνειας, ο provider επαναφορτώνει το σωστό token
  const switchToAdmin = () => {
    setSwitcherOpen(false);
    if (!isAdmin) navigate("/fleet");
  };

  const menuItem =
    "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-white/5 disabled:opacity-60";

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white">
      <header className="sticky top-0 z-40 bg-[#3D1620] border-b border-[#723645]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Truck className="w-5 h-5 text-flame shrink-0" />
          <div className="min-w-0">
            <div className="font-heading font-bold leading-tight truncate">
              {team && team !== false ? team.name : "FleetDeck"}
            </div>
            {/* Στη διαχείριση σταθερή ένδειξη «Διαχείριση» — ποτέ όνομα μέλους/ρόλου */}
            <div className="text-[11px] text-neutral-400 leading-tight">
              FleetDeck{isAdmin ? " — Διαχείριση" : team?.member_name ? ` · ${team.member_name}` : ""}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {actions}
            {isAdmin && (
              <>
                <Link
                  to="/fleet"
                  className="p-2 rounded-md hover:bg-white/5 text-neutral-300"
                  title="Πίνακας"
                  data-testid="fleet-nav-board"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Link>
                <Link
                  to="/fleet/members"
                  className="p-2 rounded-md hover:bg-white/5 text-neutral-300"
                  title="Μέλη"
                  data-testid="fleet-nav-members"
                >
                  <Users className="w-4 h-4" />
                </Link>
                <Link
                  to="/fleet/settings"
                  className="p-2 rounded-md hover:bg-white/5 text-neutral-300"
                  title="Ρυθμίσεις"
                  data-testid="fleet-nav-settings"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </>
            )}
            {/* Chip προφίλ (πάνω δεξιά, όπως στο POS): tap → επιλογή προφίλ.
                Εναλλαγή Διαχειριστής ↔ προσωπικό προφίλ οδηγού, χωρίς logout */}
            {canSwitch && (
              <div className="relative" ref={switcherRef}>
                <button
                  onClick={() => setSwitcherOpen((v) => !v)}
                  data-testid="fleet-profile-chip"
                  className="flex items-center gap-1.5 px-2.5 h-9 rounded-md border border-[#723645] hover:border-flame text-xs font-bold transition-colors"
                >
                  {isDriver ? (
                    <Bike className="w-3.5 h-3.5 text-flame" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-gold" />
                  )}
                  {/* Στο προφίλ οδηγού το chip δείχνει το ΟΝΟΜΑ του ανθρώπου (όπως
                      κάθε διανομέας) — όχι γενική ετικέτα */}
                  <span className="max-w-[110px] truncate">
                    {isDriver ? team.member_name || "Οδηγός" : "Διαχείριση"}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
                      switcherOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {switcherOpen && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-52 bg-[#3D1620] border border-[#723645] rounded-lg shadow-xl shadow-black/40 overflow-hidden z-50"
                    data-testid="fleet-profile-menu"
                  >
                    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest font-bold text-neutral-500">
                      Προφίλ
                    </div>
                    <button
                      onClick={switchToAdmin}
                      className={menuItem}
                      data-testid="fleet-profile-admin"
                    >
                      <ShieldCheck className="w-4 h-4 text-gold shrink-0" />
                      <span className="font-semibold">Διαχείριση</span>
                      {isAdmin && <Check className="w-4 h-4 ml-auto text-flame shrink-0" />}
                    </button>
                    <button
                      onClick={switchToDriver}
                      disabled={busyDriverMode}
                      className={menuItem}
                      data-testid="fleet-profile-driver"
                    >
                      <Bike className="w-4 h-4 text-flame shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold block leading-tight">Οδηγός</span>
                        <span className="text-[11px] text-neutral-500 block leading-tight">
                          Claim & παραδόσεις όπως κάθε διανομέας
                        </span>
                      </div>
                      {isDriver && <Check className="w-4 h-4 ml-auto text-flame shrink-0" />}
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Αλλαγή μέλους μόνο στο dashboard — ο οδηγός μπαίνει πάντα στη
                μία εταιρεία του λογαριασμού του, χωρίς switcher */}
            {!isDriver && (
              <button
                onClick={changeMember}
                className="px-2 py-1.5 rounded-md hover:bg-white/5 text-xs text-neutral-300"
                data-testid="fleet-change-member"
              >
                Αλλαγή μέλους
              </button>
            )}
            <button
              onClick={() => {
                logout();
                navigate(isDriver ? "/fleet/driver-login" : "/fleet/login");
              }}
              className="p-2 rounded-md hover:bg-white/5 text-neutral-300"
              title="Αποσύνδεση"
              data-testid="fleet-logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      {title && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <h1 className="font-heading text-xl font-bold">{title}</h1>
        </div>
      )}
      <main className="max-w-6xl mx-auto px-4 py-4">{children}</main>
      {nameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={saveNameAndSwitch}
            className="w-full max-w-sm bg-[#3D1620] border border-[#723645] rounded-lg p-4 space-y-3"
            data-testid="fleet-admin-name-modal"
          >
            <h3 className="font-heading font-bold">Το όνομά σας</h3>
            <p className="text-xs text-neutral-400">
              Στο προφίλ οδηγού εμφανίζεστε με το προσωπικό σας όνομα (όπως κάθε
              διανομέας) — όχι με το όνομα της εταιρείας. Ορίστε το μία φορά·
              αλλάζει από τα «Μέλη ομάδας».
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
