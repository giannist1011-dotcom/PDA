import { useState } from "react";
import { toast } from "sonner";
import { Send, Timer, X } from "lucide-react";
import { formatApiError } from "@/lib/api";
import { DEFAULT_DELAY, DELAY_PRESETS, uploadDispatchCard } from "./dispatch/utils";

// Popup μετά την εκτύπωση παραγγελίας ΠΑΡΑΔΟΣΗΣ — εμφανίζεται ΜΟΝΟ σε πλάνο
// OrderDeck Fleet με ενεργή συνεργασία (αλλιώς δεν ανοίγει καν).
//
//   «Τώρα»       → άμεσο ανέβασμα στους διανομείς
//   «Σε Χ λεπτά» → προγραμματισμένο ΣΤΟ BACKEND (επιβιώνει από refresh)· η κάρτα
//                  στην «Αποστολή παραγγελίας» δείχνει «Ανέβασμα σε Χ'»
//   «Όχι»        → η κάρτα μένει εκεί για χειροκίνητη αποστολή
export default function DispatchPromptModal({ card, partnerships, city, onClose }) {
  const [teamId, setTeamId] = useState(partnerships[0]?.team_id || "");
  const [delay, setDelay] = useState(DEFAULT_DELAY);
  const [busy, setBusy] = useState(false);
  if (!card) return null;

  const send = async (minutes) => {
    if (!teamId) return;
    setBusy(true);
    try {
      await uploadDispatchCard(card, { teamId, city, delayMinutes: minutes });
      toast.success(
        minutes > 0
          ? `Η #${String(card.order_number).padStart(3, "0")} θα ανέβει σε ${minutes}′`
          : `Η #${String(card.order_number).padStart(3, "0")} στάλθηκε στους διανομείς`
      );
      onClose();
    } catch (e) {
      toast.error(formatApiError(e));
      setBusy(false);
    }
  };

  const delayValid = Number.isFinite(delay) && delay >= 1 && delay <= 180;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div
        className="w-full max-w-md bg-[#3D1620] border border-[#723645] rounded-lg"
        data-testid="dispatch-prompt"
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-[#723645]">
          <div className="font-heading text-lg font-bold flex items-center gap-2">
            <Send className="w-4 h-4 text-flame" /> Ανέβασμα παραγγελίας;
          </div>
          <button
            onClick={onClose}
            data-testid="dispatch-prompt-close"
            className="w-9 h-9 rounded-md hover:bg-[#2A0E14] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="text-sm text-neutral-300">
            <span className="font-mono font-bold text-white">
              #{String(card.order_number ?? 0).padStart(3, "0")}
            </span>{" "}
            · {card.address || "—"}
          </div>

          {partnerships.length > 1 && (
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              data-testid="dispatch-prompt-company"
              className="w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame"
            >
              {partnerships.map((p) => (
                <option key={p.team_id} value={p.team_id}>
                  {p.team_name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => send(0)}
            disabled={busy || !teamId}
            data-testid="dispatch-prompt-now"
            className="w-full h-12 rounded-md bg-brand hover:bg-brand-hover text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Send className="w-4 h-4" /> Τώρα
          </button>

          <div className="p-3 rounded-md border border-[#723645] bg-[#2A0E14]/60">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-neutral-400">
              <Timer className="w-3.5 h-3.5" /> Σε Χ λεπτά
            </div>
            <div className="flex gap-1.5 mt-2">
              {DELAY_PRESETS.map((m) => (
                <button
                  key={m}
                  onClick={() => setDelay(m)}
                  data-testid={`dispatch-prompt-preset-${m}`}
                  className={`flex-1 h-10 rounded-md border text-sm font-bold transition-colors ${
                    delay === m
                      ? "bg-[#B48CFF]/20 border-[#B48CFF] text-[#C9A8FF]"
                      : "border-[#723645] text-neutral-300 hover:border-[#B48CFF]/60"
                  }`}
                >
                  {m}′
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={180}
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value, 10))}
                data-testid="dispatch-prompt-minutes"
                className="w-20 h-10 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white text-center focus:outline-none focus:border-[#B48CFF]"
              />
            </div>
            <button
              onClick={() => send(delay)}
              disabled={busy || !teamId || !delayValid}
              data-testid="dispatch-prompt-later"
              className="w-full h-11 mt-2 rounded-md border border-[#B48CFF] bg-[#B48CFF]/15 text-[#C9A8FF] font-bold disabled:opacity-40"
            >
              Ανέβασμα σε {delayValid ? delay : "—"}′
            </button>
          </div>

          <button
            onClick={onClose}
            disabled={busy}
            data-testid="dispatch-prompt-no"
            className="w-full h-11 rounded-md border border-[#723645] text-neutral-300 font-bold hover:bg-[#2A0E14] disabled:opacity-40"
          >
            Όχι
          </button>
          <p className="text-[11px] text-neutral-500 text-center">
            Με «Όχι» η παραγγελία μένει στην καρτέλα «Αποστολή παραγγελίας» για χειροκίνητη
            αποστολή.
          </p>
        </div>
      </div>
    </div>
  );
}
