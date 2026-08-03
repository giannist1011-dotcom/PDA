import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BarChart3, Bell, FlaskConical, History as HistoryIcon, Menu, Power, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePlatformOrders } from "@/context/PlatformOrdersContext";
import {
  apiSetPlatformStoreOpen,
  apiCreateTestPlatformOrder,
  apiGetOrder,
  formatApiError,
} from "@/lib/api";
import { platformById } from "@/lib/platforms";
import { preloadPlatformSound } from "@/lib/platformSound";
import { printReceiptJob } from "@/lib/print";
import { receiptStoreName } from "@/lib/receiptText";
import IncomingCard from "./IncomingCard";
import ActiveCard from "./ActiveCard";
import RecentOrdersModal from "./RecentOrdersModal";

// Η καρτέλα μιας πλατφόρμας: πάνω οι «Εισερχόμενες» (απαιτούν απάντηση), από
// κάτω οι «Σε εξέλιξη» με countdown και «ΚΑΘ' ΟΔΟΝ». Το μικρό burger έχει τις
// πρόσφατες παραγγελίες και τα στατιστικά της πλατφόρμας.
export default function PlatformTab({ platform, onPrint }) {
  const { user, isOwner } = useAuth();
  const navigate = useNavigate();
  const {
    pending, active, settings, accept, reject, setReadyTime, outForDelivery,
    complete, setStoreOpenLocal, canTestOrders,
  } = usePlatformOrders();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [busyOpen, setBusyOpen] = useState(false);

  const meta = platformById(platform);
  const cfg = settings.find((s) => s.platform === platform);
  const canToggleOpen = !!cfg?.capabilities?.store_open;

  useEffect(() => {
    preloadPlatformSound(platform);
  }, [platform]);

  const mine = useMemo(() => pending.filter((o) => o.platform === platform), [pending, platform]);
  const mineActive = useMemo(
    () => active.filter((o) => o.platform === platform), [active, platform]
  );

  // Οι πρόσφατες δίνουν ήδη την παραγγελία POS· η κάρτα «σε εξέλιξη» κρατά μόνο
  // το order_id της, οπότε τη φέρνουμε πριν την επανεκτύπωση
  const reprint = (order) => {
    const merged = { ...order, restaurant_name: receiptStoreName(user) };
    onPrint(merged);
    setTimeout(() => printReceiptJob(user, merged), 150);
  };

  const reprintPlatform = async (po) => {
    if (!po.order_id) return;
    reprint(await apiGetOrder(po.order_id));
  };

  const toggleStoreOpen = async () => {
    setBusyOpen(true);
    try {
      const res = await apiSetPlatformStoreOpen(platform, !cfg?.store_open);
      setStoreOpenLocal(platform, res.store_open);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyOpen(false);
    }
  };

  const makeTestOrder = async () => {
    setMenuOpen(false);
    try {
      await apiCreateTestPlatformOrder(platform);
      toast.success("Δοκιμαστική παραγγελία στάλθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <section
      className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 xl:p-6"
      data-testid={`platform-tab-${platform}`}
    >
      {/* Κεφαλίδα: κατάσταση καταστήματος στην πλατφόρμα + μενού καρτέλας */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={canToggleOpen ? toggleStoreOpen : undefined}
          disabled={!canToggleOpen || busyOpen}
          title={canToggleOpen ? "" : "μη διαθέσιμο από την πλατφόρμα"}
          data-testid={`platform-store-open-${platform}`}
          data-state={cfg?.store_open ? "open" : "closed"}
          className={`h-11 px-4 rounded-md border font-bold text-sm flex items-center gap-2 transition-colors ${
            !canToggleOpen
              ? "border-[#723645] text-neutral-500 cursor-not-allowed"
              : cfg?.store_open
                ? "border-[#00E676]/50 bg-[#00E676]/10 text-[#00E676] hover:border-[#00E676]"
                : "border-[#FF3B30]/50 bg-[#FF3B30]/10 text-[#FF6961] hover:border-[#FF3B30]"
          }`}
        >
          <Power className="w-4 h-4" />
          {cfg?.store_open ? `Ανοιχτό στο ${meta?.label}` : `Κλειστό στο ${meta?.label}`}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            data-testid={`platform-menu-${platform}`}
            aria-label="Μενού καρτέλας"
            className="w-11 h-11 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-12 z-40 w-64 p-1.5 rounded-lg border border-[#723645] bg-[#2A0E14] shadow-xl shadow-black/50">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setRecentOpen(true);
                  }}
                  data-testid={`platform-menu-recent-${platform}`}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-neutral-200 hover:bg-[#3D1620]"
                >
                  <HistoryIcon className="w-4 h-4 text-flame" />
                  <span className="font-semibold text-sm">Πρόσφατες παραγγελίες</span>
                </button>
                {isOwner && (
                  <button
                    onClick={() => navigate(`/app/analytics?source=${platform}`)}
                    data-testid={`platform-menu-stats-${platform}`}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-neutral-200 hover:bg-[#3D1620]"
                  >
                    <BarChart3 className="w-4 h-4 text-flame" />
                    <span className="font-semibold text-sm">Στατιστικά {meta?.label}</span>
                  </button>
                )}
                {canTestOrders && (
                  <button
                    onClick={makeTestOrder}
                    data-testid={`platform-menu-test-${platform}`}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-gold hover:bg-[#3D1620]"
                  >
                    <FlaskConical className="w-4 h-4" />
                    <span className="font-semibold text-sm">Δοκιμαστική παραγγελία</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Εισερχόμενες */}
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-4 h-4" style={{ color: meta?.accent }} />
        <h2 className="font-heading font-bold text-lg">Εισερχόμενες</h2>
        {mine.length > 0 && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: meta?.accent }}
            data-testid={`platform-incoming-count-${platform}`}
          >
            {mine.length}
          </span>
        )}
      </div>
      {mine.length === 0 ? (
        <div className="mb-6 py-8 text-center text-neutral-500 border border-dashed border-[#723645] rounded-lg">
          Καμία εισερχόμενη παραγγελία
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 xl:grid-cols-2 gap-3">
          {mine.map((o) => (
            <IncomingCard key={o.id} order={o} onAccept={accept} onReject={reject} />
          ))}
        </div>
      )}

      {/* Σε εξέλιξη */}
      <div className="flex items-center gap-2 mb-2">
        <h2 className="font-heading font-bold text-lg">Σε εξέλιξη</h2>
        <span className="text-sm text-neutral-500">({mineActive.length})</span>
      </div>
      {mineActive.length === 0 ? (
        <div className="py-8 text-center text-neutral-500 border border-dashed border-[#723645] rounded-lg">
          Καμία παραγγελία σε εξέλιξη
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {mineActive.map((o) => (
            <ActiveCard
              key={o.id}
              order={o}
              onOut={outForDelivery}
              onComplete={complete}
              onReadyTime={setReadyTime}
              onReprint={reprintPlatform}
            />
          ))}
        </div>
      )}

      {recentOpen && (
        <RecentOrdersModal
          platform={platform}
          onClose={() => setRecentOpen(false)}
          onReprint={reprint}
        />
      )}
    </section>
  );
}
