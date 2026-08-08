import { CopyCheck, Wand2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatWeekRange } from "@/lib/dates";

// Προεπισκόπηση αυτοσυμπλήρωσης: τι ΑΚΡΙΒΩΣ θα αντιγραφεί από την προηγούμενη
// εβδομάδα, πριν γραφτεί τίποτα. Μετά την εφαρμογή το πρόγραμμα παραμένει
// πλήρως επεξεργάσιμο (απλές βάρδιες σαν όλες τις άλλες).
export default function AutofillDialog({
  open,
  onClose,
  onApply,
  busy,
  weekStart,
  sourceWeekStart,
  days,
  preview,          // [{ member, cells: [{ day, shift }] }]
  skippedCount,     // βάρδιες μελών που δεν υπάρχουν πια
  overwriteCount,   // βάρδιες που ήδη υπάρχουν στην εβδομάδα-στόχο
}) {
  const total = preview.reduce((n, row) => n + row.cells.length, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl bg-[#2A0E14] border-[#723645] text-white"
        data-testid="autofill-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-flame" />
            Αυτοσυμπλήρωση από προηγούμενη εβδομάδα
          </DialogTitle>
          <p className="text-sm text-neutral-400 mt-1">
            {formatWeekRange(sourceWeekStart)} → {formatWeekRange(weekStart)}
          </p>
        </DialogHeader>

        {total === 0 ? (
          <div className="py-8 text-center text-neutral-400 text-sm" data-testid="autofill-empty">
            Η προηγούμενη εβδομάδα δεν έχει βάρδιες για αντιγραφή.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-[#723645]">
              <table className="w-full text-sm">
                <tbody>
                  {preview.map((row) => (
                    <tr
                      key={row.member.id}
                      className="border-b border-[#431A25] last:border-0 align-top"
                      data-testid={`autofill-row-${row.member.id}`}
                    >
                      <td className="px-3 py-2 font-semibold w-40 truncate">{row.member.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {row.cells.map((c) => (
                            <span
                              key={c.day}
                              className="px-2 py-0.5 rounded border border-flame/40 bg-flame/10 text-flame font-mono text-[11px] font-bold"
                            >
                              {days[c.day]?.short} {c.shift.start}–{c.shift.end}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-neutral-400 flex items-center gap-2">
              <CopyCheck className="w-4 h-4 text-flame shrink-0" />
              Θα αντιγραφούν {total} βάρδιες σε {preview.length} άτομα. Μετά την
              εφαρμογή μπορείτε να τις επεξεργαστείτε κανονικά.
            </p>

            {skippedCount > 0 && (
              <p
                className="text-xs text-gold flex items-center gap-2"
                data-testid="autofill-skipped"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {skippedCount} βάρδιες παραλείπονται — τα άτομά τους δεν είναι πια
                ενεργά μέλη.
              </p>
            )}

            {overwriteCount > 0 && (
              <p
                className="text-xs text-[#FF6961] flex items-center gap-2"
                data-testid="autofill-overwrite"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {overwriteCount} υπάρχουσες βάρδιες αυτής της εβδομάδας θα
                αντικατασταθούν.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="pt-2 flex flex-col sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} className="text-neutral-300">
            Άκυρο
          </Button>
          <Button
            type="button"
            onClick={onApply}
            disabled={busy || total === 0}
            data-testid="autofill-apply-btn"
            className="bg-brand hover:bg-brand-hover font-bold disabled:opacity-40"
          >
            <Wand2 className="w-4 h-4 mr-2" /> Εφαρμογή
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
