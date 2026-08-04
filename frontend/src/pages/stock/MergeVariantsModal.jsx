import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiStockVariantSuggestions, formatApiError } from "@/lib/api";

// ---------- Μετατροπή παλιών ειδών σε παραλλαγές ----------
// Παλιότερα το «Σακούλες 35άρες / 40άρες / 45άρες» ήταν τρία ξεχωριστά είδη.
// Εδώ προτείνονται οι ομάδες και ο ιδιοκτήτης εγκρίνει όποιες θέλει.
export default function MergeVariantsModal({ open, onClose, onApply }) {
  const [groups, setGroups] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiStockVariantSuggestions()
      .then((res) => {
        setGroups(res.groups || []);
        setChosen([]);
      })
      .catch((e) => toast.error(formatApiError(e)))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const keyOf = (g) => `${g.category_id}:${g.base_name}`;
  const toggle = (g) =>
    setChosen((p) => (p.includes(keyOf(g)) ? p.filter((k) => k !== keyOf(g)) : [...p, keyOf(g)]));

  const apply = async () => {
    const picked = groups.filter((g) => chosen.includes(keyOf(g)));
    if (!picked.length) return;
    setSaving(true);
    try {
      await onApply(
        picked.map((g) => ({
          item_ids: g.items.map((i) => i.id),
          base_name: g.base_name,
        }))
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="stock-merge-modal"
    >
      <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-6 w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-flame" />
          <h3 className="font-heading text-xl font-bold">Μετατροπή σε παραλλαγές</h3>
        </div>
        <p className="text-sm text-neutral-400 mt-1 mb-4">
          Ξεχωριστά είδη που μοιάζουν να είναι παραλλαγές του ίδιου πράγματος.
          Επιλέξτε όσα θέλετε να ενωθούν σε ένα είδος με παραλλαγές.
        </p>

        <div className="space-y-2 overflow-y-auto flex-1 -mx-1 px-1">
          {loading ? (
            <div className="text-neutral-500 py-8 text-center">Φόρτωση...</div>
          ) : groups.length === 0 ? (
            <div className="text-neutral-500 py-8 text-center">
              Δεν βρέθηκαν είδη προς μετατροπή
            </div>
          ) : (
            groups.map((g) => {
              const on = chosen.includes(keyOf(g));
              return (
                <button
                  key={keyOf(g)}
                  type="button"
                  onClick={() => toggle(g)}
                  data-testid={`stock-merge-group-${g.category_id}-${g.base_name}`}
                  className={`w-full p-3 rounded-lg border flex items-start gap-3 text-left transition-colors ${
                    on
                      ? "border-flame bg-flame/10"
                      : "border-[#723645] bg-[#2A0E14] hover:border-[#7A3E52]"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      on ? "bg-brand border-brand" : "border-[#7A3E52]"
                    }`}
                  >
                    {on && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-heading font-semibold text-white">
                      {g.base_name}
                      <span className="text-neutral-500 font-normal">
                        {" "}
                        · {g.category_name}
                      </span>
                    </span>
                    <span className="block text-xs text-neutral-400 mt-0.5">
                      {g.items.map((i) => i.variant).join(" / ")}
                    </span>
                    <span className="block text-[11px] text-neutral-500 mt-1">
                      {g.items.length} είδη → 1 είδος με {g.items.length} παραλλαγές
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            data-testid="stock-merge-cancel"
            className="h-10 px-4 rounded-md bg-[#4F202D] text-neutral-300 text-sm font-bold hover:bg-[#723645]"
          >
            Άκυρο
          </button>
          <Button
            type="button"
            onClick={apply}
            disabled={chosen.length === 0 || saving}
            data-testid="stock-merge-apply"
            className="h-10 bg-brand hover:bg-brand-hover px-4"
          >
            {saving ? "Μετατροπή..." : `Μετατροπή (${chosen.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
