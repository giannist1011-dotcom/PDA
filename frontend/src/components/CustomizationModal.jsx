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

const OptionTile = ({ selected, label, badge, onClick, testId }) => (
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

// Legacy sandwich-style customization (bread/extras/sauces/double_meat)
function LegacyOptions({ item, config, state, setState }) {
  const breadOptions = config?.bread_options ?? [];
  const extrasOptions = config?.extras_options ?? [];
  const saucesOptions = config?.sauces_options ?? [];
  const doubleMeatPrice = config?.double_meat_price ?? 0;

  const toggleList = (key, value) => {
    setState((s) => ({
      ...s,
      [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value],
    }));
  };

  return (
    <>
      {breadOptions.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] mb-3">Ψωμί</h3>
          <div className="grid grid-cols-3 gap-3">
            {breadOptions.map((b) => (
              <OptionTile
                key={b}
                selected={state.bread === b}
                label={b}
                testId={`bread-${b}`}
                onClick={() => setState((s) => ({ ...s, bread: b }))}
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
                selected={state.extras.includes(e)}
                label={e}
                testId={`extra-${e}`}
                onClick={() => toggleList("extras", e)}
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
                selected={state.sauces.includes(s)}
                label={s}
                testId={`sauce-${s}`}
                onClick={() => toggleList("sauces", s)}
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
            selected={state.double_meat}
            label="Διπλή μερίδα κρέας"
            badge={`+${eur(doubleMeatPrice)}`}
            testId="double-meat"
            onClick={() => setState((s) => ({ ...s, double_meat: !s.double_meat }))}
          />
        </section>
      )}
    </>
  );
}

// Generic option groups on any item
function GroupsOptions({ groups, selections, setSelections }) {
  const toggleChoice = (groupIdx, opt) => {
    setSelections((prev) => {
      const cur = { ...prev };
      const g = groups[groupIdx];
      const list = cur[g.id] || [];
      let next;
      if (g.type === "single") {
        next = list.length === 1 && list[0].name === opt.name ? [] : [opt];
      } else {
        const exists = list.find((c) => c.name === opt.name);
        next = exists ? list.filter((c) => c.name !== opt.name) : [...list, opt];
      }
      cur[g.id] = next;
      return cur;
    });
  };

  return groups.map((g, gi) => {
    const list = selections[g.id] || [];
    return (
      <section key={g.id} data-testid={`group-${g.id}`}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#FF6B00] mb-3">
          {g.name}
          {g.required && <span className="text-[#FF3B30] ml-2">*</span>}
          {g.type === "single" && (
            <span className="text-[10px] text-neutral-500 ml-2 normal-case tracking-wide">
              (μία επιλογή)
            </span>
          )}
          {g.type === "multi" && (
            <span className="text-[10px] text-neutral-500 ml-2 normal-case tracking-wide">
              (πολλαπλές)
            </span>
          )}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {g.options.map((opt) => {
            const selected = !!list.find((c) => c.name === opt.name);
            return (
              <OptionTile
                key={opt.name}
                selected={selected}
                label={opt.name}
                badge={opt.price > 0 ? `+${eur(opt.price)}` : null}
                testId={`opt-${g.id}-${opt.name}`}
                onClick={() => toggleChoice(gi, opt)}
              />
            );
          })}
        </div>
      </section>
    );
  });
}

export default function CustomizationModal({ item, config, open, onClose, onConfirm }) {
  const legacyMode = !!item?.customizable && (!item?.option_groups || item.option_groups.length === 0);
  const groups = item?.option_groups || [];

  // legacy state
  const [state, setState] = useState({
    bread: config?.bread_options?.[0] || "",
    extras: [],
    sauces: [],
    double_meat: false,
  });
  // groups state
  const [selections, setSelections] = useState({});

  useEffect(() => {
    if (!open || !item) return;
    setState({
      bread: config?.bread_options?.[0] || "",
      extras: [],
      sauces: [],
      double_meat: false,
    });
    const init = {};
    (item.option_groups || []).forEach((g) => (init[g.id] = []));
    setSelections(init);
  }, [open, item, config]);

  if (!item) return null;

  // compute price
  const doubleMeatPrice = config?.double_meat_price ?? 0;
  let extra = 0;
  if (legacyMode) {
    if (state.double_meat && item.double_meat_eligible) extra += doubleMeatPrice;
  } else {
    for (const g of groups) {
      const list = selections[g.id] || [];
      for (const c of list) extra += Number(c.price || 0);
    }
  }
  const finalPrice = Number(item.price) + extra;

  // Required validation for group modes
  const missingRequired = !legacyMode
    ? groups.some((g) => g.required && (selections[g.id] || []).length === 0)
    : false;

  const handleConfirm = () => {
    if (missingRequired) return;
    let customization;
    if (legacyMode) {
      customization = {
        bread: state.bread,
        extras: state.extras,
        sauces: state.sauces,
        double_meat: !!(state.double_meat && item.double_meat_eligible),
        selections: [],
      };
    } else {
      customization = {
        bread: null,
        extras: [],
        sauces: [],
        double_meat: false,
        selections: groups
          .map((g) => ({
            group_id: g.id,
            group_name: g.name,
            choices: selections[g.id] || [],
          }))
          .filter((s) => s.choices.length > 0),
      };
    }
    onConfirm({ customization, unit_price: finalPrice });
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
            <p className="text-sm text-neutral-400 mt-1">Επιλέξτε τις προτιμήσεις σας</p>
          </DialogHeader>
        </div>

        <div className="px-6 pb-2 max-h-[65vh] overflow-y-auto space-y-6">
          {legacyMode ? (
            <LegacyOptions item={item} config={config} state={state} setState={setState} />
          ) : (
            <GroupsOptions groups={groups} selections={selections} setSelections={setSelections} />
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
              disabled={missingRequired}
              data-testid="customization-confirm"
              className="h-14 px-8 text-base font-bold bg-[#FF6B00] hover:bg-[#FF8533] text-white disabled:opacity-50"
            >
              Προσθήκη
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
