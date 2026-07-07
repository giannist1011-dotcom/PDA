import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  ShoppingCart,
  BarChart3,
  Settings,
  Utensils,
  Calendar,
  LogOut,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/", label: "Παραγγελίες", icon: ShoppingCart, testId: "drawer-link-pda" },
  { to: "/analytics", label: "Στατιστικά", icon: BarChart3, testId: "drawer-link-analytics" },
  { to: "/menu", label: "Διαχείριση μενού", icon: Settings, testId: "drawer-link-menu" },
  { to: "/stock", label: "Ελλείψεις", icon: ClipboardList, testId: "drawer-link-stock" },
  { to: "/schedule", label: "Πρόγραμμα υπαλλήλων", icon: Calendar, testId: "drawer-link-schedule" },
];

export default function AppShell({ title, children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-[#0D0D0D] text-white">
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
            <div className="flex items-baseline gap-2">
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
      </header>

      {/* Drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            data-testid="drawer-backdrop"
          />
          <aside
            className="fixed left-0 top-0 bottom-0 z-50 w-[300px] bg-[#0D0D0D] border-r border-[#333] flex flex-col"
            data-testid="drawer"
          >
            <div className="flex items-center justify-between px-5 h-16 border-b border-[#333]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-[#FF6B00] flex items-center justify-center">
                  <Utensils className="w-5 h-5 text-white" />
                </div>
                <span className="font-heading text-lg font-bold">
                  {user?.restaurant_name || "POS"}
                </span>
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
              {NAV.map((n) => {
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
