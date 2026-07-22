import { useEffect, useState } from "react";
import { X, Printer, ChevronDown, ChevronUp, History as HistoryIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { apiListShoppingPrints, formatApiError } from "@/lib/api";
import { formatGRTime } from "@/lib/format";
import { printShoppingList } from "./utils";

const PAGE_SIZE = 20;

const fmtDateGR = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("el-GR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

// ---------- Ιστορικό εκτυπώσεων λίστας αγορών ----------
export default function PrintHistoryModal({ open, onClose, restaurantName }) {
  const [prints, setPrints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = async ({ append = false, skip = 0 } = {}) => {
    setLoading(true);
    try {
      const docs = await apiListShoppingPrints(skip, PAGE_SIZE);
      setPrints((p) => (append ? [...p, ...docs] : docs));
      setHasMore(docs.length === PAGE_SIZE);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setExpandedId(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const reprint = (p) => {
    printShoppingList({ restaurantName, items: p.items || [], when: p.printed_at });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        data-testid="print-history-backdrop"
      />
      <div
        className="fixed z-50 inset-x-3 top-[8vh] bottom-[8vh] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px] bg-[#2A0E14] border border-[#723645] rounded-lg flex flex-col overflow-hidden"
        data-testid="print-history-modal"
      >
        <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-[#723645]">
          <div className="flex items-center gap-2 font-heading font-bold text-lg">
            <HistoryIcon className="w-5 h-5 text-flame" />
            Ιστορικό εκτυπώσεων
          </div>
          <button
            onClick={onClose}
            data-testid="print-history-close"
            className="w-10 h-10 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {prints.length === 0 && !loading && (
            <div className="py-12 text-center text-neutral-500 text-sm">
              Δεν υπάρχουν εκτυπώσεις ακόμη — κάθε «Εκτύπωση» της λίστας αγορών
              αποθηκεύεται εδώ.
            </div>
          )}
          {prints.map((p) => {
            const expanded = expandedId === p.id;
            return (
              <div
                key={p.id}
                className="bg-[#3D1620] border border-[#723645] rounded-lg overflow-hidden"
                data-testid={`print-history-entry-${p.id}`}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left"
                    data-testid={`print-history-toggle-${p.id}`}
                  >
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {fmtDateGR(p.printed_at)} · {formatGRTime(p.printed_at)}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">
                        {(p.items || []).length} είδη · από {p.printed_by || "—"}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => reprint(p)}
                    data-testid={`print-history-reprint-${p.id}`}
                    className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-md bg-[#2A0E14] border border-[#723645] text-neutral-200 text-sm font-bold hover:border-flame hover:text-flame"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Επανεκτύπωση</span>
                  </button>
                </div>
                {expanded && (
                  <ul className="border-t border-[#431A25] px-4 py-2 space-y-1">
                    {(p.items || []).map((it, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            it.bought ? "bg-[#00E676] border-[#00E676]" : "border-[#7A3E52]"
                          }`}
                        >
                          {it.bought && <Check className="w-3 h-3 text-black" />}
                        </span>
                        <span className={it.bought ? "line-through text-neutral-500" : "text-neutral-200"}>
                          {it.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={() => load({ append: true, skip: prints.length })}
              disabled={loading}
              data-testid="print-history-more"
              className="w-full h-10 rounded-md border border-[#723645] text-sm font-bold text-neutral-300 hover:border-flame hover:text-white disabled:opacity-40"
            >
              {loading ? "Φόρτωση..." : "Περισσότερα"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
