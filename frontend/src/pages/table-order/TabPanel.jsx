import {
  Send,
  ReceiptText,
  ArrowLeftRight,
  Minus,
  Plus,
  Trash2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { eur } from "@/lib/format";
import { summarize, roundTime } from "./utils";

// Tab panel: existing rounds + new (unsent) round + fixed action footer
export default function TabPanel({
  mobileTab,
  tab,
  newItems,
  updateQty,
  removeLine,
  grandTotal,
  newTotal,
  busy,
  handleSend,
  handleClose,
  openTransfer,
}) {
  return (
    <aside
      className={`flex-col bg-[#3D1620] border-t lg:border-t-0 lg:border-l border-[#723645] flex-1 sm:flex-none min-h-0 overflow-hidden sm:overflow-visible lg:overflow-hidden lg:h-full ${
        mobileTab === "order" ? "flex" : "hidden"
      } sm:flex`}
    >
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Existing rounds */}
        {(tab?.rounds || []).map((r) => (
          <div
            key={r.round_no}
            data-testid={`tab-round-${r.round_no}`}
            className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md"
          >
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-widest">
                <Clock className="w-3.5 h-3.5 text-flame" />
                Γύρος {r.round_no} · {roundTime(r.sent_at)}
              </span>
              <span className="font-mono font-bold text-neutral-300">
                {eur(r.items.reduce((s, it) => s + (it.line_total || 0), 0))}
              </span>
            </div>
            <ul className="space-y-1">
              {r.items.map((it, idx) => (
                <li key={idx} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-white">
                      {it.quantity}x {it.name}
                    </span>
                    <span className="font-mono text-neutral-400 shrink-0">
                      {eur(it.line_total)}
                    </span>
                  </div>
                  {it.customization && summarize(it.customization) && (
                    <div className="text-[11px] text-neutral-500 leading-snug">
                      {summarize(it.customization)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* New (unsent) round */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[#00E676] mb-2">
            Νέος γύρος
          </div>
          {newItems.length === 0 ? (
            <div className="text-neutral-500 text-sm py-6 text-center border border-dashed border-[#723645] rounded-md">
              Επιλέξτε προϊόντα από το μενού
            </div>
          ) : (
            <div className="space-y-2">
              {newItems.map((it) => (
                <div
                  key={it.line_id}
                  data-testid={`new-line-${it.line_id}`}
                  className="p-2.5 bg-[#2A0E14] border border-[#00E676]/40 rounded-md"
                >
                  <div className="flex justify-between gap-2 items-start">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white leading-tight">
                        {it.name}
                      </div>
                      {it.customization && summarize(it.customization) && (
                        <div className="text-[11px] text-neutral-500 leading-snug mt-0.5">
                          {summarize(it.customization)}
                        </div>
                      )}
                    </div>
                    <span className="font-mono font-bold text-white shrink-0">
                      {eur(it.line_total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 bg-[#3D1620] rounded-md p-0.5">
                      <button
                        onClick={() => updateQty(it.line_id, -1)}
                        data-testid={`new-dec-${it.line_id}`}
                        className="w-9 h-9 rounded flex items-center justify-center text-white hover:bg-[#4A1B27] active:scale-95"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-7 text-center font-mono font-bold">
                        {it.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(it.line_id, 1)}
                        data-testid={`new-inc-${it.line_id}`}
                        className="w-9 h-9 rounded flex items-center justify-center text-white hover:bg-[#4A1B27] active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeLine(it.line_id)}
                      data-testid={`new-remove-${it.line_id}`}
                      className="p-2 text-neutral-400 hover:text-[#FF3B30]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fixed action footer */}
      <div className="px-4 py-3 border-t border-[#723645] bg-[#33111A] shrink-0 sticky bottom-0">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] text-neutral-400 uppercase tracking-widest font-bold">
            Σύνολο καρτέλας
          </span>
          <span className="font-mono text-2xl font-bold text-white" data-testid="tab-total">
            {eur(grandTotal)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            onClick={handleSend}
            disabled={newItems.length === 0 || busy}
            data-testid="round-send-btn"
            className="h-12 text-sm font-bold bg-[#00E676] hover:bg-[#33EB91] text-black disabled:opacity-40"
          >
            <Send className="w-4 h-4 mr-1.5" />
            Αποστολή {newItems.length > 0 ? `(${eur(newTotal)})` : ""}
          </Button>
          <Button
            onClick={handleClose}
            disabled={!tab || busy}
            data-testid="tab-close-btn"
            className="h-12 text-sm font-bold bg-brand hover:bg-brand-hover text-white disabled:opacity-40"
          >
            <ReceiptText className="w-4 h-4 mr-1.5" />
            Κλείσιμο
          </Button>
        </div>
        {tab && (
          <button
            onClick={openTransfer}
            data-testid="tab-transfer-btn"
            className="w-full h-9 mt-1.5 rounded-md bg-[#4A1B27] border border-[#723645] text-neutral-200 hover:border-[#00B0FF] hover:text-[#00B0FF] text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Μεταφορά σε άλλο τραπέζι
          </button>
        )}
      </div>
    </aside>
  );
}
