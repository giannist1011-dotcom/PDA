import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, X } from "lucide-react";
import { apiFleetReportProblem } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";

const REASONS = [
  ["no_answer", "Δεν απαντάει"],
  ["wrong_address", "Λάθος διεύθυνση"],
  ["other", "Άλλο"],
];

// Αναφορά προβλήματος από τον οδηγό σε claimed παραγγελία — η σημαία φτάνει
// στον πίνακα του συντονιστή, που αποφασίζει (επεξεργασία/αποδέσμευση/ακύρωση).
export default function ProblemModal({ order, onClose, onReported }) {
  const [reason, setReason] = useState("no_answer");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await apiFleetReportProblem(order.id, reason, text.trim());
      toast.success("Το πρόβλημα στάλθηκε στη διαχείριση");
      onReported?.();
      onClose();
    } catch (err) {
      toast.error(formatApiError(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#3D1620] border border-[#723645] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-gold" />
          <h2 className="font-heading font-bold text-lg flex-1">Πρόβλημα στην #{order.number}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-neutral-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          {REASONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setReason(key)}
              data-testid={`fleet-problem-${key}`}
              className={`w-full h-12 rounded-lg border text-sm font-semibold transition-colors ${
                reason === key
                  ? "border-flame bg-flame/10 text-white"
                  : "border-[#723645] bg-[#2A0E14] text-neutral-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Λεπτομέρειες (προαιρετικό)"
          data-testid="fleet-problem-text"
          className="w-full mt-3 p-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame resize-none"
        />
        <button
          disabled={busy || (reason === "other" && !text.trim())}
          onClick={submit}
          data-testid="fleet-problem-submit"
          className="w-full h-12 mt-3 rounded-lg bg-brand hover:bg-brand-hover text-white font-bold disabled:opacity-60"
        >
          Αποστολή στη διαχείριση
        </button>
      </div>
    </div>
  );
}
