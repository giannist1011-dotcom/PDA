import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  ShoppingCart,
  BarChart3,
  Settings as SettingsIcon,
  Utensils,
  Calendar,
  LogOut,
  ClipboardList,
  KeyRound,
  RefreshCw,
  Crown,
  User as UserIcon,
  Image as ImageIcon,
  Wallet,
  History as HistoryIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Full nav list. Each entry may require owner.
const NAV_ALL = [
  { to: "/", label: "Παραγγελίες", icon: ShoppingCart, testId: "drawer-link-pda", owner: false },
  { to: "/history", label: "Ιστορικό", icon: HistoryIcon, testId: "drawer-link-history", owner: false },
  { to: "/analytics", label: "Στατιστικά", icon: BarChart3, testId: "drawer-link-analytics", owner: true },
  { to: "/expenses", label: "Έξοδα", icon: Wallet, testId: "drawer-link-expenses", owner: true },
  { to: "/menu", label: "Διαχείριση μενού", icon: SettingsIcon, testId: "drawer-link-menu", owner: true },
  { to: "/photos", label: "Βιβλιοθήκη φωτογραφιών", icon: ImageIcon, testId: "drawer-link-photos", owner: true },
  { to: "/stock", label: "Ελλείψεις", icon: ClipboardList, testId: "drawer-link-stock", owner: false },
  { to: "/schedule", label: "Πρόγραμμα υπαλλήλων", icon: Calendar, testId: "drawer-link-schedule", owner: false },
  { to: "/settings", label: "Ρυθμίσεις", icon: KeyRound, testId: "drawer-link-settings", owner: true },
];

export default function AppShell({ title, children }) {
  const { user, logout, exitProfile, isOwner } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSwitchProfile = async () => {
    try {
      await exitProfile();
    } catch {
      // even if it fails, navigate anyway
    }
    navigate("/select-profile");
  };

  const nav = NAV_ALL.filter((n) => (n.owner ? isOwner : true)).map((n) => {
    // For employee, schedule label reads "Πρόγραμμα (προβολή)"
    if (!isOwner && n.to === "/schedule") return { ...n, label: "Πρόγραμμα (προβολή)" };
    return n;
  });

  const profileBadge = user && user !== false && user.profile === "owner" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FF6B00]/15 text-[#FF6B00] text-[10px] font-bold uppercase tracking-widest">
      <Crown className="w-3 h-3" /> Ιδιοκτήτης
    </span>
  ) : user && user !== false && user.profile === "employee" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#00B0FF]/15 text-[#00B0FF] text-[10px] font-bold uppercase tracking-widest">
      <UserIcon className="w-3 h-3" /> Υπάλληλος
    </span>
  ) : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0D0D0D] text-white">
      <header className="flex items-center justify-between px-4 md:px-6 h-16 border-b border-[#333] bg-[#0D0D0D] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            data-testid="burger-btn"
            aria-label="Μενού"
            className="w-11 h-11 rounded-md border border-[#333] hover:border-[#FF6B00] flex items-center justify-center text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#FF6B00] flex items-center justify-center">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="font-heading text-xl md:text-2xl font-bold tracking-tight"
                data-testid="restaurant-name"
              >
                {user?.restaurant_name || "POS"}
              </span>
              {title && (
                <span className="text-xs uppercase tracking-widest text-neutral-500 hidden sm:inline">
                  · {title}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="hidden sm:block" data-testid="profile-badge">
          {profileBadge}
        </div>
      </header>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            data-testid="drawer-backdrop"
          />
          <aside
            className="fixed left-0 top-0 bottom-0 z-50 w-[320px] bg-[#0D0D0D] border-r border-[#333] flex flex-col"
            data-testid="drawer"
          >
            <div className="flex items-center justify-between px-5 h-16 border-b border-[#333]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-[#FF6B00] flex items-center justify-center">
                  <Utensils className="w-5 h-5 text-white" />
                </div>
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
                className="w-10 h-10 rounded-md border border-[#333] hover:border-[#FF6B00] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 overflow-y-auto">
              {nav.map((n) => {
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
                        ? "bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/40"
                        : "text-neutral-200 hover:bg-[#1A1A1A] border border-transparent"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-semibold">{n.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  setOpen(false);
                  handleSwitchProfile();
                }}
                data-testid="drawer-switch-profile-btn"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-md mb-1 text-neutral-200 hover:bg-[#1A1A1A] border border-transparent"
              >
                <RefreshCw className="w-5 h-5" />
                <span className="font-semibold">Αλλαγή προφίλ</span>
              </button>
            </nav>
            <div className="p-3 border-t border-[#333]">
              <button
                onClick={handleLogout}
                data-testid="drawer-logout-btn"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-neutral-300 hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] border border-[#333] hover:border-[#FF3B30] transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-semibold">Αποσύνδεση</span>
              </button>
            </div>
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}
