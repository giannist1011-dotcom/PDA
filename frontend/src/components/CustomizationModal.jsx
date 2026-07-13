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
        ? "border-flame bg-flame/10 text-white"
        : "border-[#5E2A3A] bg-[#3D1620] hover:border-[#666] text-neutral-200"
    }`}
  >
    <span className="text-base font-semibold">{label}</span>
    <span className="flex items-center gap-2">
      {badge && <span className="text-xs font-mono text-gold">{badge}</span>}
      <span
        className={`w-6 h-6 rounded-md border flex items-center justify-center ${
          selected ? "bg-brand border-brand" : "border-[#7A3E52]"
        }`}
      >
        {selected && <Check className="w-4 h-4 text-white" />}
      </span>
    </span>
  </button>
);

// Options may arrive as plain strings (legacy accounts) or {name, price} dicts.
export const normalizeOption = (x) =>
  typeof x === "string"
    ? { name: x, price: 0 }
    : { name: x?.name || "", price: Number(x?.price || 0) };

const priceBadge = (price) => (price > 0 ? `+${eur(price)}` : null);

function LegacyOptions({ item, breadOptions, extrasOptions, saucesOptions, doubleMeatPrice, state, setState }) {
  const toggleList = (key, name) => {
    setState((s) => ({
      ...s,
      [key]: s[key].includes(name) ? s[key].filter((v) => v !== name) : [...s[key], name],
    }));
  };

  return (
    <>
      {breadOptions.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-flame mb-3">Ψωμί</h3>
          <div className="grid grid-cols-3 gap-3">
            {breadOptions.map((b) => (
              <OptionTile
                key={b.name}
                selected={state.bread === b.name}
                label={b.name}
                badge={priceBadge(b.price)}
                testId={`bread-${b.name}`}
                onClick={() => setState((s) => ({ ...s, bread: b.name }))}
              />
            ))}
          </div>
        </section>
      )}
      {extrasOptions.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-flame mb-3">Υλικά</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {extrasOptions.map((e) => (
              <OptionTile
                key={e.name}
                selected={state.extras.includes(e.name)}
                label={e.name}
                badge={priceBadge(e.price)}
                testId={`extra-${e.name}`}
                onClick={() => toggleList("extras", e.name)}
              />
            ))}
          </div>
        </section>
      )}
      {saucesOptions.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-flame mb-3">Αλοιφές</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {saucesOptions.map((s) => (
              <OptionTile
                key={s.name}
                selected={state.sauces.includes(s.name)}
                label={s.name}
                badge={priceBadge(s.price)}
                testId={`sauce-${s.name}`}
                onClick={() => toggleList("sauces", s.name)}
              />
            ))}
          </div>
        </section>
      )}
      {item.double_meat_eligible && doubleMeatPrice > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-flame mb-3">
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
        <h3 className="text-xs font-bold uppercase tracking-widest text-flame mb-3">
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
                badge={
                  opt.price > 0
                    ? g.price_mode === "replace"
                      ? eur(opt.price)
                      : `+${eur(opt.price)}`
                    : null
                }
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

export default function CustomizationModal({
  item,
  config,
  open,
  onClose,
  onConfirm,
  mode = "add",
  initialCustomization = null,
}) {
  const legacyMode =
    !!item?.customizable && (!item?.option_groups || item.option_groups.length === 0);
  const groups = item?.option_groups || [];

  const breadOptions = (config?.bread_options || []).map(normalizeOption);
  const extrasOptions = (config?.extras_options || []).map(normalizeOption);
  const saucesOptions = (config?.sauces_options || []).map(normalizeOption);

  const [state, setState] = useState({
    bread: "",
    extras: [],
    sauces: [],
    double_meat: false,
  });
  const [selections, setSelections] = useState({});

  useEffect(() => {
    if (!open || !item) return;
    if (legacyMode) {
      const firstBread = (config?.bread_options || []).map(normalizeOption)[0]?.name || "";
      setState({
        bread: initialCustomization?.bread || firstBread,
        extras: initialCustomization?.extras ? [...initialCustomization.extras] : [],
        sauces: initialCustomization?.sauces ? [...initialCustomization.sauces] : [],
        double_meat: !!initialCustomization?.double_meat,
      });
    } else {
      const init = {};
      groups.forEach((g) => (init[g.id] = []));
      if (initialCustomization?.selections) {
        initialCustomization.selections.forEach((s) => {
          if (init[s.group_id] !== undefined) init[s.group_id] = [...s.choices];
        });
      }
      setSelections(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, config, initialCustomization]);

  if (!item) return null;

  const doubleMeatPrice = config?.double_meat_price ?? 0;
  const priceOf = (list, name) => list.find((o) => o.name === name)?.price || 0;
  let basePrice = Number(item.price);
  let extra = 0;
  if (legacyMode) {
    extra += priceOf(breadOptions, state.bread);
    for (const n of state.extras) extra += priceOf(extrasOptions, n);
    for (const n of state.sauces) extra += priceOf(saucesOptions, n);
    if (state.double_meat && item.double_meat_eligible) extra += doubleMeatPrice;
  } else {
    for (const g of groups) {
      const list = selections[g.id] || [];
      if (g.price_mode === "replace" && list.length > 0) {
        // e.g. pizza sizes: the chosen option's price REPLACES the base price
        basePrice = Number(list[0].price || 0);
      } else {
        for (const c of list) extra += Number(c.price || 0);
      }
    }
  }
  const finalPrice = basePrice + extra;

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

  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-testid="customization-modal"
        className="max-w-3xl bg-[#2A0E14] border-[#5E2A3A] text-white p-0"
      >
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">{item.name}</DialogTitle>
            <p className="text-sm text-neutral-400 mt-1">
              {isEdit ? "Ενημερώστε τις επιλογές" : "Επιλέξτε τις προτιμήσεις σας"}
            </p>
          </DialogHeader>
        </div>

        <div className="px-6 pb-2 max-h-[65vh] overflow-y-auto space-y-6">
          {legacyMode ? (
            <LegacyOptions
              item={item}
              breadOptions={breadOptions}
              extrasOptions={extrasOptions}
              saucesOptions={saucesOptions}
              doubleMeatPrice={doubleMeatPrice}
              state={state}
              setState={setState}
            />
          ) : (
            <GroupsOptions groups={groups} selections={selections} setSelections={setSelections} />
          )}
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-[#431A25] flex flex-row items-center justify-between gap-4 sm:justify-between">
          <div className="text-left">
            <div className="text-xs text-neutral-400 uppercase tracking-widest">
              {isEdit ? "Νέα τιμή" : "Σύνολο"}
            </div>
            <div className="text-2xl font-bold font-mono">{eur(finalPrice)}</div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              data-testid="customization-cancel"
              className="h-14 px-6 text-base text-neutral-300 hover:text-white hover:bg-[#3D1620]"
            >
              Άκυρο
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={missingRequired}
              data-testid="customization-confirm"
              className="h-14 px-8 text-base font-bold bg-brand hover:bg-brand-hover text-white disabled:opacity-50"
            >
              {isEdit ? "Ενημέρωση" : "Προσθήκη"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
