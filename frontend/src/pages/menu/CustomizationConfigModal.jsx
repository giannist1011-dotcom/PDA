import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import PricedOptionList from "./PricedOptionList";

// ---------- Customization Modal ----------
// Options may be stored as plain strings (legacy) or {name, price} dicts.
const toPricedOption = (x) =>
  typeof x === "string"
    ? { name: x, price: 0 }
    : { name: x?.name || "", price: Number(x?.price || 0) };

export default function CustomizationConfigModal({ open, config, onClose, onSave }) {
  const [bread, setBread] = useState([]);
  const [extras, setExtras] = useState([]);
  const [sauces, setSauces] = useState([]);
  const [price, setPrice] = useState("1.50");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && config) {
      setBread((config.bread_options || []).map(toPricedOption));
      setExtras((config.extras_options || []).map(toPricedOption));
      setSauces((config.sauces_options || []).map(toPricedOption));
      setPrice(String(config.double_meat_price ?? 1.5));
    }
  }, [config, open]);

  const cleanRows = (rows) =>
    rows
      .map((r) => ({
        name: (r.name || "").trim(),
        price: parseFloat(String(r.price).replace(",", ".")) || 0,
      }))
      .filter((r) => r.name);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        bread_options: cleanRows(bread),
        extras_options: cleanRows(extras),
        sauces_options: cleanRows(sauces),
        double_meat_price: parseFloat(String(price).replace(",", ".")) || 0,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#2A0E14] border-[#723645] text-white"
        data-testid="cust-config-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Επιλογές παραμετροποίησης σάντουιτς
          </DialogTitle>
          <p className="text-sm text-neutral-400 mt-1">
            Ορίστε τις διαθέσιμες επιλογές και την επιπλέον χρέωση καθεμιάς (0 = δωρεάν)
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <PricedOptionList
            label="Τύποι ψωμιού"
            hint="μία επιλογή ανά σάντουιτς"
            rows={bread}
            setRows={setBread}
            testPrefix="cust-bread"
          />
          <PricedOptionList
            label="Υλικά"
            hint="πολλαπλές επιλογές"
            rows={extras}
            setRows={setExtras}
            testPrefix="cust-extras"
          />
          <PricedOptionList
            label="Αλοιφές"
            hint="πολλαπλές επιλογές"
            rows={sauces}
            setRows={setSauces}
            testPrefix="cust-sauces"
          />
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              Χρέωση διπλής μερίδας κρέατος (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.10"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              data-testid="cust-price-input"
              className="w-full h-11 px-3 mt-1 bg-[#3D1620] border border-[#723645] rounded-md text-white font-mono focus:outline-none focus:border-flame"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-neutral-300">
              Άκυρο
            </Button>
            <Button
              type="submit"
              disabled={busy}
              data-testid="cust-save-btn"
              className="bg-brand hover:bg-brand-hover font-bold"
            >
              <Save className="w-4 h-4 mr-2" /> Αποθήκευση
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
