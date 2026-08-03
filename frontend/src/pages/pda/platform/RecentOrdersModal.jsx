import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Printer, X } from "lucide-react";
import { apiPlatformRecent, apiGetOrder, formatApiError } from "@/lib/api";
import { formatGRDateTime } from "@/lib/format";
import { platformLabel, STATUS_LABELS } from "@/lib/platforms";
import PlatformOrderBody from "@/components/platform/PlatformOrderBody";

const PAGE = 15;

// «Πρόσφατες παραγγελίες» της πλατφόρμας: ολοκληρωμένες & απορριφθείσες, με
// επανεκτύπωση της απόδειξης (σελιδοποιημένα — ποτέ ολόκληρο το ιστορικό).
export default function RecentOrdersModal({ platform, onClose, onReprint }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(
    async (skip = 0) => {
      setLoading(true);
      try {
        const res = await apiPlatformRecent(platform, skip, PAGE);
        setRows((prev) => (skip === 0 ? res.orders : [...prev, ...res.orders]));
        setTotal(res.total || 0);
      } catch (e) {
        toast.error(formatApiError(e));
      } finally {
        setLoading(false);
      }
    },
    [platform]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const reprint = async (row) => {
    if (!row.order_id) return;
    try {
      onReprint(await apiGetOrder(row.order_id));
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed z-50 inset-x-0 bottom-0 top-10 sm:inset-y-10 sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px] bg-[#2A0E14] border border-[#723645] rounded-t-lg sm:rounded-lg flex flex-col overflow-hidden"
        data-testid="platform-recent-modal"
      >
        <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-[#723645]">
          <div className="font-heading font-bold">
            Πρόσφατες παραγγελίες · {platformLabel(platform)}
            <span className="ml-2 text-xs text-neutral-500 font-normal">({total})</span>
          </div>
          <button
            onClick={onClose}
            data-testid="platform-recent-close"
            className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {rows.length === 0 && !loading && (
            <div className="py-16 text-center text-neutral-500">Καμία πρόσφατη παραγγελία</div>
          )}
          {rows.map((r) => {
            const open = openId === r.id;
            const rejected = r.status === "rejected";
            return (
              <div
                key={r.id}
                className="rounded-md border border-[#723645] bg-[#3D1620] overflow-hidden"
                data-testid={`platform-recent-${r.id}`}
              >
                <button
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#4A1B27] transition-colors"
                >
                  <span className="font-mono font-bold text-white shrink-0">
                    #{r.platform_order_id}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-xs text-neutral-400 block truncate">
                      {formatGRDateTime(r.received_at)}
                      {r.customer?.name ? ` · ${r.customer.name}` : ""}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded shrink-0 ${
                      rejected
                        ? "bg-[#FF3B30]/20 text-[#FF6961]"
                        : "bg-[#00E676]/15 text-[#00E676]"
                    }`}
                  >
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </button>
                {open && (
                  <div className="px-3 pb-3 space-y-3 border-t border-[#431A25] pt-3">
                    <PlatformOrderBody order={r} dense />
                    {r.rejected_reason && (
                      <div className="text-xs text-[#FF6961]">Αιτία: {r.rejected_reason}</div>
                    )}
                    {r.order_id && (
                      <button
                        onClick={() => reprint(r)}
                        data-testid={`platform-recent-reprint-${r.id}`}
                        className="w-full h-10 rounded-md border border-[#723645] hover:border-flame text-neutral-300 hover:text-white text-sm font-bold flex items-center justify-center gap-2"
                      >
                        <Printer className="w-4 h-4" />
                        Επανεκτύπωση
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {rows.length < total && (
            <button
              onClick={() => load(rows.length)}
              disabled={loading}
              data-testid="platform-recent-more"
              className="w-full h-11 rounded-md bg-[#3D1620] border border-[#723645] hover:border-flame text-white font-bold flex items-center justify-center gap-2"
            >
              <ChevronDown className="w-4 h-4" />
              {loading ? "Φόρτωση..." : "Περισσότερες"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
