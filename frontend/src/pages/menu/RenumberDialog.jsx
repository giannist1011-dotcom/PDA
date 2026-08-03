import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { apiRenumberItems, formatApiError } from "@/lib/api";

/**
 * «Επαναρίθμηση όλων»: προεπισκόπηση (παλιός → νέος κωδικός) πριν την εφαρμογή.
 * Η προεπισκόπηση έρχεται από τον server (dry_run) με start=1 και μετατοπίζεται
 * τοπικά όταν αλλάξει ο αριθμός εκκίνησης — ίδια σειρά με αυτήν της λίστας.
 */
export default function RenumberDialog({ open, setOpen, onDone }) {
  const [start, setStart] = useState("1");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const startNum = Math.max(0, parseInt(start, 10) || 0);

  useEffect(() => {
    if (!open) return;
    setStart("1");
    setLoading(true);
    apiRenumberItems({ start: 1, dry_run: true })
      .then((r) => setRows(r.changes || []))
      .catch((e) => toast.error(formatApiError(e)))
      .finally(() => setLoading(false));
  }, [open]);

  const preview = rows.map((r, idx) => ({ ...r, new_code: String(startNum + idx) }));
  const changedCount = preview.filter((r) => r.old_code !== r.new_code).length;

  const apply = async () => {
    setSaving(true);
    try {
      const r = await apiRenumberItems({ start: startNum, dry_run: false });
      setOpen(false);
      toast.success(
        r.affected > 0 ? `Επαναριθμήθηκαν ${r.affected} προϊόντα` : "Οι κωδικοί ήταν ήδη σωστοί"
      );
      await onDone();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent
        className="bg-[#2A0E14] border-[#723645] text-white max-w-lg"
        data-testid="renumber-dialog"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl">Επαναρίθμηση όλων;</AlertDialogTitle>
          <AlertDialogDescription className="text-neutral-400">
            Θα δοθούν καθαροί διαδοχικοί κωδικοί σε ΟΛΑ τα προϊόντα, με τη σειρά που φαίνονται στη
            λίστα. Οι υπάρχοντες κωδικοί θα αντικατασταθούν — η ενέργεια δεν αναιρείται.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-3">
          <label className="text-sm text-neutral-300 shrink-0" htmlFor="renumber-start">
            Ξεκίνα από
          </label>
          <Input
            id="renumber-start"
            type="number"
            min="0"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            data-testid="renumber-start-input"
            className="h-11 w-28 bg-[#3D1620] border-[#723645] text-white"
          />
          <span className="text-sm text-neutral-500">
            {changedCount} από {preview.length} θα αλλάξουν
          </span>
        </div>

        <div
          className="max-h-64 overflow-y-auto rounded-lg border border-[#723645] divide-y divide-[#431A25]"
          data-testid="renumber-preview"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-neutral-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Υπολογισμός…
            </div>
          ) : preview.length === 0 ? (
            <div className="py-8 text-center text-neutral-500 text-sm">Δεν υπάρχουν προϊόντα</div>
          ) : (
            preview.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 truncate">
                  {r.name}
                  {r.category ? <span className="text-neutral-500"> · {r.category}</span> : null}
                </span>
                <span className="text-neutral-500 tabular-nums w-12 text-right">
                  {r.old_code || "—"}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                <span
                  className={`tabular-nums w-12 font-bold ${
                    r.old_code === r.new_code ? "text-neutral-500" : "text-flame"
                  }`}
                >
                  {r.new_code}
                </span>
              </div>
            ))
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            data-testid="renumber-cancel"
            className="bg-[#3D1620] border-[#723645] text-neutral-300 hover:bg-[#431A25] hover:text-white"
          >
            Άκυρο
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              apply();
            }}
            disabled={saving || loading || preview.length === 0}
            data-testid="renumber-confirm"
            className="bg-brand hover:bg-brand-hover text-white font-bold disabled:opacity-50"
          >
            {saving ? "Εφαρμογή…" : "Επαναρίθμηση"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
