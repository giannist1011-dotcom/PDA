import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DAY_LABELS, formatWeekRange } from "@/lib/dates";
import TimePicker from "@/components/TimePicker";

// Shift editor modal
export default function ShiftModal({ open, employee, day, weekStart, initial, onClose, onSave, onDelete }) {
  const [start, setStart] = useState(initial?.start || "17:00");
  const [end, setEnd] = useState(initial?.end || "01:00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStart(initial?.start || "17:00");
      setEnd(initial?.end || "01:00");
    }
  }, [open, initial]);

  if (!employee) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!start || !end) {
      toast.error("Επιλέξτε ώρα έναρξης και λήξης");
      return;
    }
    setBusy(true);
    try {
      await onSave({ start, end });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#2A0E14] border-[#723645] text-white" data-testid="shift-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Βάρδια — {employee.name}
          </DialogTitle>
          <p className="text-sm text-neutral-400 mt-1">
            {DAY_LABELS[day]} · Εβδομάδα {formatWeekRange(weekStart)}
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Έναρξη
              </label>
              <TimePicker
                value={start}
                onChange={setStart}
                testId="shift-start"
                className="w-full h-12 mt-1 bg-[#3D1620] text-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Λήξη
              </label>
              <TimePicker
                value={end}
                onChange={setEnd}
                testId="shift-end"
                className="w-full h-12 mt-1 bg-[#3D1620] text-lg"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 flex flex-col sm:flex-row sm:justify-between gap-2">
            {initial && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                data-testid="shift-delete-btn"
                className="text-[#FF6961] hover:bg-[#FF3B30]/10"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Διαγραφή
              </Button>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <Button type="button" variant="ghost" onClick={onClose} className="text-neutral-300">
                Άκυρο
              </Button>
              <Button
                type="submit"
                disabled={busy}
                data-testid="shift-save-btn"
                className="bg-brand hover:bg-brand-hover font-bold"
              >
                <Save className="w-4 h-4 mr-2" /> Αποθήκευση
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
