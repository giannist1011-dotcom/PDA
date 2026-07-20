import { Printer, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatWeekRange } from "@/lib/dates";

// Share dialog: print or copy the weekly schedule
export default function ShareDialog({ shareOpen, setShareOpen, weekStart, handlePrintSchedule, handleCopySchedule }) {
  return (
    <Dialog open={shareOpen} onOpenChange={setShareOpen}>
      <DialogContent className="max-w-sm bg-[#2A0E14] border-[#723645] text-white" data-testid="share-schedule-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Κοινοποίηση προγράμματος</DialogTitle>
          <p className="text-sm text-neutral-400 mt-1">Εβδομάδα {formatWeekRange(weekStart)}</p>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={handlePrintSchedule}
            data-testid="share-print-btn"
            className="flex items-center gap-2 h-11 px-4 rounded-md bg-[#3D1620] border border-[#723645] text-white text-sm font-bold hover:border-flame hover:text-flame transition-colors"
          >
            <Printer className="w-4 h-4" />
            Εκτύπωση προγράμματος
          </button>
          <button
            onClick={handleCopySchedule}
            data-testid="share-copy-btn"
            className="flex items-center gap-2 h-11 px-4 rounded-md bg-[#3D1620] border border-[#723645] text-white text-sm font-bold hover:border-flame hover:text-flame transition-colors"
          >
            <Copy className="w-4 h-4" />
            Αντιγραφή για Viber/WhatsApp
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
