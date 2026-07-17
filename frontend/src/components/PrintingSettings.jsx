import { useState } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { apiUpdatePrinting, formatApiError } from "@/lib/api";

const PRESETS = [1, 2];

export default function PrintingSettings() {
  const { user, refreshMe } = useAuth();
  const initial = Math.max(1, Math.min(10, Number(user?.print_copies) || 1));
  const [copies, setCopies] = useState(initial);
  const [customMode, setCustomMode] = useState(!PRESETS.includes(initial));
  const [copyLabels, setCopyLabels] = useState(!!user?.print_copy_labels);
  const [doublePrint, setDoublePrint] = useState(!!user?.print_double);
  const [saving, setSaving] = useState(false);

  const save = async (next) => {
    setSaving(true);
    try {
      await apiUpdatePrinting({
        copies: next.copies ?? copies,
        copy_labels: next.copy_labels ?? copyLabels,
        double_print: next.double_print ?? doublePrint,
      });
      await refreshMe(); // οι αποδείξεις διαβάζουν τις ρυθμίσεις από το user object
      toast.success("Οι ρυθμίσεις εκτύπωσης αποθηκεύτηκαν");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const pickPreset = (n) => {
    setCustomMode(false);
    setCopies(n);
    save({ copies: n });
  };

  const pickCustom = () => {
    setCustomMode(true);
    if (copies < 2) setCopies(2);
  };

  const commitCustom = (val) => {
    const n = Math.max(2, Math.min(10, Number(val) || 2));
    setCopies(n);
    save({ copies: n });
  };

  const btnCls = (active) =>
    `h-10 px-4 rounded-md border text-sm font-bold transition-colors ${
      active
        ? "bg-flame/15 text-flame border-flame/60"
        : "bg-[#2A0E14] text-neutral-300 border-[#723645] hover:border-flame"
    }`;

  return (
    <div className="space-y-4">
      {/* Αντίγραφα */}
      <div className="px-4 py-3 bg-[#2A0E14] border border-[#723645] rounded-md">
        <div className="font-semibold text-sm">Αντίγραφα ανά παραγγελία</div>
        <div className="text-xs text-neutral-500 mb-3">
          Πόσες αποδείξεις τυπώνονται σε κάθε παραγγελία (π.χ. μία για τον πάγκο, μία για τη σακούλα)
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => pickPreset(n)}
              disabled={saving}
              data-testid={`print-copies-${n}`}
              className={btnCls(!customMode && copies === n)}
            >
              {n}
            </button>
          ))}
          <button
            onClick={pickCustom}
            disabled={saving}
            data-testid="print-copies-custom"
            className={btnCls(customMode)}
          >
            Άλλο
          </button>
          {customMode && (
            <input
              type="number"
              min={2}
              max={10}
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
              onBlur={(e) => commitCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitCustom(e.target.value)}
              data-testid="print-copies-input"
              className="w-20 h-10 px-3 rounded-md bg-[#2A0E14] border border-[#723645] focus:border-flame outline-none text-sm font-bold"
            />
          )}
        </div>
      </div>

      {/* Ετικέτες αντιγράφων */}
      {(customMode || copies > 1) && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#2A0E14] border border-[#723645] rounded-md">
          <div>
            <div className="font-semibold text-sm">Ετικέτα σε κάθε αντίγραφο</div>
            <div className="text-xs text-neutral-500">
              Το 1ο αντίγραφο γράφει «ΚΟΥΖΙΝΑ», το 2ο «ΠΕΛΑΤΗΣ»
            </div>
          </div>
          <Switch
            checked={copyLabels}
            disabled={saving}
            onCheckedChange={(v) => {
              setCopyLabels(!!v);
              save({ copy_labels: !!v });
            }}
            data-testid="print-labels-switch"
          />
        </div>
      )}

      {/* Διπλή εκτύπωση */}
      <div className="px-4 py-3 bg-[#2A0E14] border border-[#723645] rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Διπλή εκτύπωση (2ος εκτυπωτής)</div>
            <div className="text-xs text-neutral-500">
              Κάθε παραγγελία ανοίγει δύο εκτυπώσεις στη σειρά — μία για κάθε εκτυπωτή
            </div>
          </div>
          <Switch
            checked={doublePrint}
            disabled={saving}
            onCheckedChange={(v) => {
              setDoublePrint(!!v);
              save({ double_print: !!v });
            }}
            data-testid="print-double-switch"
          />
        </div>
        {doublePrint && (
          <div className="mt-3 flex gap-2 text-xs text-neutral-400 bg-[#3D1620] border border-[#723645] rounded-md p-3">
            <Info className="w-4 h-4 shrink-0 text-gold mt-0.5" />
            <div>
              Ο browser δεν επιτρέπει αυτόματη επιλογή εκτυπωτή. Στο πρώτο παράθυρο εκτύπωσης
              επιλέξτε τον 1ο εκτυπωτή (π.χ. ταμείο) και στο δεύτερο τον 2ο (π.χ. κουζίνα) —
              ο browser θυμάται την τελευταία επιλογή. Για εκτύπωση χωρίς παράθυρα (kiosk mode),
              ο δεύτερος εκτυπωτής πρέπει να οριστεί ως προεπιλογή σε ξεχωριστή συσκευή/browser.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
