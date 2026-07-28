import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Μετά την αποθήκευση επεξεργασίας: «Επανεκτύπωση;» — με σήμανση «+ ΠΡΟΣΘΗΚΗ»
// ώστε η κουζίνα να φτιάξει μόνο τα νέα είδη, ή πλήρης, ή καθόλου.
export default function ReprintPromptModal({ open, orderNumber, addedCount, onPrintMarked, onPrintFull, onSkip }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="reprint-prompt-modal"
    >
      <div className="bg-[#3D1620] border border-[#723645] rounded-lg w-full max-w-sm">
        <div className="flex items-start justify-between p-5 border-b border-[#431A25]">
          <div>
            <h3 className="font-heading text-xl font-bold">Επανεκτύπωση;</h3>
            <div className="text-sm text-neutral-400 mt-1">
              Η #{String(orderNumber || 0).padStart(3, "0")} ενημερώθηκε
            </div>
          </div>
          <button
            onClick={onSkip}
            data-testid="reprint-prompt-close"
            className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-2">
          {addedCount > 0 && (
            <>
              <div className="text-sm text-neutral-300 mb-3">
                {addedCount} {addedCount === 1 ? "νέο είδος" : "νέα είδη"} — η εκτύπωση με σήμανση
                δείχνει τις προσθήκες σε ξεχωριστή ενότητα «+ ΠΡΟΣΘΗΚΗ», ώστε η κουζίνα να μην
                ξαναφτιάξει όλη την παραγγελία.
              </div>
              <Button
                onClick={onPrintMarked}
                data-testid="reprint-marked-btn"
                className="w-full h-12 bg-brand hover:bg-brand-hover font-bold flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Εκτύπωση με σήμανση προσθηκών
              </Button>
            </>
          )}
          <Button
            onClick={onPrintFull}
            data-testid="reprint-full-btn"
            className={`w-full h-12 font-bold flex items-center justify-center gap-2 ${
              addedCount > 0
                ? "bg-[#4A1B27] border border-[#7E3B50] hover:bg-[#582233] text-white"
                : "bg-brand hover:bg-brand-hover"
            }`}
          >
            <Printer className="w-4 h-4" /> Πλήρης επανεκτύπωση
          </Button>
          <Button
            onClick={onSkip}
            variant="ghost"
            data-testid="reprint-skip-btn"
            className="w-full h-12 font-bold text-neutral-300 hover:text-white"
          >
            Χωρίς εκτύπωση
          </Button>
        </div>
      </div>
    </div>
  );
}
