import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { eur } from "@/lib/format";

const OptionTile = ({ selected, label, onClick, testId, badge }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    data-state={selected ? "on" : "off"}
    className={`flex items-center justify-between px-4 py-4 rounded-lg border text-left transition-all no-select active:scale-[0.98] ${
      selected
        ? "border-[#FF6B00] bg-[#FF6B00]/10 text-white"
        : "border-[#333] bg-[#1A1A1A] hover:border-[#666] text-neutral-200"
    }`}
  >
    <span className="text-base font-semibold">{label}</span>
    <span className="flex items-center gap-2">
      {badge && <span className="text-xs font-mono text-[#FF6B00]">{badge}</span>}
      <span
        className={`w-6 h-6 rounded-md border flex items-center justify-center ${
          selected ? "bg-[#FF6B00] border-[#FF6B00]" : "border-[#555]"
        }`}
      >
        {selected && <Check className="w-4 h-4 text-white" />}
      </span>
    </span>
  </button>
);

export default function CustomizationModal({ item, config, open, onClose, onConfirm }) {
  const breadOptions = config?.bread_options ?? [];
  const extrasOptions = config?.extras_options ?? [];
  const saucesOptions = config?.sauces_options ?? [];
  const doubleMeatPrice = config?.double_meat_price ?? 0;

  const [bread, setBread] = useState(breadOptions[0] || "");
  const [extras, setExtras] = useState([]);
  const [sauces, setSauces] = useState([]);
  const [doubleMeat, setDoubleMeat] = useState(false);

  useEffect(() => {
    if (open) {
      setBread(breadOptions[0] || "");
      setExtras([]);
      setSauces([]);
      setDoubleMeat(false);
    }
  }, [open, item, breadOptions]);

  if (!item) return null;

  const toggleFromList = (list, setList, value) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const finalPrice =
    Number(item.price) + (doubleMeat && item.double_meat_eligible ? doubleMeatPrice : 0);

  const handleConfirm = () => {
    onConfirm({
      customization: {
        bread,
        extras,
        sauces,
        double_meat: doubleMeat && !!item.double_meat_eligible,
      },
      unit_price: finalPrice,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-testid="customization-modal"
        className="max-w-3xl bg-[#0D0D0D] border-[#333] text-white p-0"
      >
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">{item.name}</DialogTitle>
            <p className="text-sm text-neutral-400 mt-1">Επιλέξτε ψωμί, extras και σως</p>
          </DialogHeader>
        </div>

        <div className="px-6 pb-2 max-h-[65vh] overflow-y-auto space-y-6">
          {breadOptions.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] mb-3">Ψωμί</h3>
              <div className="grid grid-cols-3 gap-3">
                {breadOptions.map((b) => (
                  <OptionTile
                    key={b}
                    selected={bread === b}
                    label={b}
                    testId={`bread-${b}`}
                    onClick={() => setBread(b)}
                  />
                ))}
              </div>
            </section>
          )}

          {extrasOptions.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] mb-3">Extras</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {extrasOptions.map((e) => (
                  <OptionTile
                    key={e}
                    selected={extras.includes(e)}
                    label={e}
                    testId={`extra-${e}`}
                    onClick={() => toggleFromList(extras, setExtras, e)}
                  />
                ))}
              </div>
            </section>
          )}

          {saucesOptions.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] mb-3">Σως</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {saucesOptions.map((s) => (
                  <OptionTile
                    key={s}
                    selected={sauces.includes(s)}
                    label={s}
                    testId={`sauce-${s}`}
                    onClick={() => toggleFromList(sauces, setSauces, s)}
                  />
                ))}
              </div>
            </section>
          )}

          {item.double_meat_eligible && doubleMeatPrice > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] mb-3">
                Έξτρα κρέας
              </h3>
              <OptionTile
                selected={doubleMeat}
                label="Διπλή μερίδα κρέας"
                badge={`+${eur(doubleMeatPrice)}`}
                testId="double-meat"
                onClick={() => setDoubleMeat((v) => !v)}
              />
            </section>
          )}
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-[#222] flex flex-row items-center justify-between gap-4 sm:justify-between">
          <div className="text-left">
            <div className="text-xs text-neutral-400 uppercase tracking-widest">Σύνολο</div>
            <div className="text-2xl font-bold font-mono">{eur(finalPrice)}</div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              data-testid="customization-cancel"
              className="h-14 px-6 text-base text-neutral-300 hover:text-white hover:bg-[#1A1A1A]"
            >
              Άκυρο
            </Button>
            <Button
              onClick={handleConfirm}
              data-testid="customization-confirm"
              className="h-14 px-8 text-base font-bold bg-[#FF6B00] hover:bg-[#FF8533] text-white"
            >
              Προσθήκη
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
