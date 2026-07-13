import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import {
  Euro,
  FolderInput,
  ListPlus,
  Trash2,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { apiBulkItems, formatApiError } from "@/lib/api";

// ---------- Price change modal ----------
function PriceChangeDialog({ open, count, onClose, onApply }) {
  const [mode, setMode] = useState("set"); // set | adjust | pct
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const num = parseFloat(String(value).replace(",", "."));
    if (Number.isNaN(num)) {
      toast.error("Άκυρη τιμή");
      return;
    }
    setBusy(true);
    try {
      await onApply(mode, num);
      onClose();
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  const Mode = ({ k, label }) => (
    <button
      type="button"
      onClick={() => setMode(k)}
      data-testid={`price-mode-${k}`}
      className={`h-12 rounded-md text-sm font-bold border transition-all ${
        mode === k
          ? "bg-brand border-brand text-white"
          : "bg-[#1A1A1A] border-[#333] text-neutral-300 hover:border-flame"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#0D0D0D] border-[#333] text-white" data-testid="bulk-price-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Αλλαγή τιμής</DialogTitle>
          <p className="text-sm text-neutral-400 mt-1">
            Θα εφαρμοστεί σε {count} επιλεγμένα προϊόντα
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Mode k="set" label="Νέα τιμή" />
            <Mode k="adjust" label="+/- €" />
            <Mode k="pct" label="+/- %" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              {mode === "set" && "Νέα τιμή (€)"}
              {mode === "adjust" && "Μεταβολή (€, μπορεί να είναι αρνητική)"}
              {mode === "pct" && "Ποσοστό (%, μπορεί να είναι αρνητικό)"}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "set" ? "3,50" : mode === "adjust" ? "+0,20 ή -0,50" : "+10 ή -5"}
              data-testid="bulk-price-input"
              required
              className="w-full h-12 px-3 mt-1 bg-[#1A1A1A] border border-[#333] rounded-md text-white font-mono text-lg focus:outline-none focus:border-flame"
            />
            {mode === "pct" && (
              <div className="text-xs text-neutral-500 mt-1">
                π.χ. +10 για αύξηση 10%, -5 για μείωση 5%
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="text-neutral-300">
              Άκυρο
            </Button>
            <Button
              type="submit"
              disabled={busy || !value}
              data-testid="bulk-price-apply"
              className="bg-brand hover:bg-brand-hover font-bold"
            >
              Εφαρμογή
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Move-to-category modal ----------
function CategoryDialog({ open, count, categories, onClose, onApply }) {
  const [cid, setCid] = useState(categories[0]?.id || "");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!cid) return;
    setBusy(true);
    try {
      await onApply(cid);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#0D0D0D] border-[#333] text-white" data-testid="bulk-cat-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Μετακίνηση σε κατηγορία</DialogTitle>
          <p className="text-sm text-neutral-400 mt-1">
            {count} επιλεγμένα προϊόντα θα μετακινηθούν
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <select
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            data-testid="bulk-cat-select"
            className="w-full h-12 px-3 bg-[#1A1A1A] border border-[#333] rounded-md text-white focus:outline-none focus:border-flame"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="text-neutral-300">
              Άκυρο
            </Button>
            <Button
              type="submit"
              disabled={busy}
              data-testid="bulk-cat-apply"
              className="bg-brand hover:bg-brand-hover font-bold"
            >
              Μετακίνηση
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Add option group modal ----------
const shortId = () => Math.random().toString(36).slice(2, 8);

function OptionGroupDialog({ open, count, onClose, onApply }) {
  const [group, setGroup] = useState({
    id: shortId(),
    name: "",
    type: "single",
    required: false,
    price_mode: "add",
    options: [{ name: "", price: 0 }],
  });
  const [busy, setBusy] = useState(false);

  const reset = () =>
    setGroup({
      id: shortId(),
      name: "",
      type: "single",
      required: false,
      price_mode: "add",
      options: [{ name: "", price: 0 }],
    });

  const submit = async (e) => {
    e.preventDefault();
    const cleaned = {
      ...group,
      name: group.name.trim(),
      options: group.options
        .map((o) => ({
          name: (o.name || "").trim(),
          price: parseFloat(String(o.price).replace(",", ".")) || 0,
        }))
        .filter((o) => o.name),
    };
    if (!cleaned.name || cleaned.options.length === 0) {
      toast.error("Δώστε όνομα και τουλάχιστον μία επιλογή");
      return;
    }
    setBusy(true);
    try {
      await onApply(cleaned);
      onClose();
      reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0D0D0D] border-[#333] text-white max-h-[85vh] overflow-y-auto" data-testid="bulk-group-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Ανάθεση ομάδας επιλογών</DialogTitle>
          <p className="text-sm text-neutral-400 mt-1">
            Η ομάδα θα προστεθεί/αντικατασταθεί σε {count} προϊόντα
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={group.name}
              onChange={(e) => setGroup({ ...group, name: e.target.value })}
              placeholder="Όνομα ομάδας (π.χ. Μέγεθος)"
              data-testid="bulk-group-name"
              required
              className="flex-1 h-11 px-3 bg-[#1A1A1A] border border-[#333] rounded-md text-white focus:outline-none focus:border-flame"
            />
            <select
              value={group.type}
              onChange={(e) => setGroup({ ...group, type: e.target.value })}
              data-testid="bulk-group-type"
              className="h-11 px-2 bg-[#1A1A1A] border border-[#333] rounded-md text-white"
            >
              <option value="single">Μία</option>
              <option value="multi">Πολλές</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={group.required}
                onChange={(e) => setGroup({ ...group, required: e.target.checked })}
                data-testid="bulk-group-required"
              />
              Υποχρ.
            </label>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-400 block mb-1">
              Τύπος τιμής
            </label>
            <select
              value={group.price_mode}
              onChange={(e) => setGroup({ ...group, price_mode: e.target.value })}
              data-testid="bulk-group-price-mode"
              className="w-full h-11 px-3 bg-[#1A1A1A] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-flame"
            >
              <option value="add">Προσαύξηση (+€ πάνω στη βάση)</option>
              <option value="replace">Καθορισμός τιμής (αντικαθιστά τη βασική)</option>
            </select>
          </div>
          {group.options.map((o, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                value={o.name}
                onChange={(e) =>
                  setGroup({
                    ...group,
                    options: group.options.map((x, i) =>
                      i === oi ? { ...x, name: e.target.value } : x
                    ),
                  })
                }
                placeholder="Επιλογή"
                data-testid={`bulk-opt-name-${oi}`}
                className="flex-1 h-10 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm"
              />
              <input
                type="number"
                step="0.10"
                min="0"
                value={o.price}
                onChange={(e) =>
                  setGroup({
                    ...group,
                    options: group.options.map((x, i) =>
                      i === oi ? { ...x, price: e.target.value } : x
                    ),
                  })
                }
                placeholder="+€"
                data-testid={`bulk-opt-price-${oi}`}
                className="w-24 h-10 px-2 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm font-mono"
              />
              <button
                type="button"
                onClick={() =>
                  setGroup({
                    ...group,
                    options: group.options.filter((_, i) => i !== oi),
                  })
                }
                className="p-1 text-neutral-500 hover:text-[#FF3B30]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            onClick={() =>
              setGroup({ ...group, options: [...group.options, { name: "", price: 0 }] })
            }
            data-testid="bulk-add-option-row"
            className="w-full h-10 bg-transparent border border-dashed border-[#444] hover:border-flame text-neutral-400 hover:text-white text-xs"
          >
            <Plus className="w-3 h-3 mr-1" /> Προσθήκη επιλογής
          </Button>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="text-neutral-300">
              Άκυρο
            </Button>
            <Button
              type="submit"
              disabled={busy}
              data-testid="bulk-group-apply"
              className="bg-brand hover:bg-brand-hover font-bold"
            >
              Ανάθεση
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main bar ----------
export default function BulkActionsBar({ selected, categories, onDone, onClear }) {
  const count = selected.length;
  const ids = selected;
  const [priceOpen, setPriceOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (payload, successMsg) => {
    try {
      const r = await apiBulkItems(payload);
      toast.success(successMsg || `Ενημερώθηκαν ${r.affected} προϊόντα`);
      await onDone();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const applyPrice = async (mode, value) => {
    if (mode === "set") return run({ ids, action: "set_price", price: value });
    if (mode === "adjust") return run({ ids, action: "adjust_price", delta: value });
    if (mode === "pct") return run({ ids, action: "adjust_price_pct", pct: value });
  };

  const applyCategory = async (cid) => run({ ids, action: "set_category", category: cid });
  const applyGroup = async (group) => run({ ids, action: "add_option_group", group });
  const doDelete = async () => {
    await run({ ids, action: "delete" }, `Διαγράφηκαν ${count} προϊόντα`);
    setConfirmDelete(false);
    onClear();
  };

  if (count === 0) return null;

  return (
    <>
      <div
        className="sticky bottom-4 z-30 mt-4 p-3 bg-[#1A1A1A] border border-flame/40 rounded-xl shadow-2xl shadow-black/40 flex flex-wrap items-center gap-2"
        data-testid="bulk-bar"
      >
        <div className="px-3 py-2 rounded-md bg-flame/15 text-flame font-bold text-sm" data-testid="bulk-count">
          {count} επιλεγμένα
        </div>
        <div className="flex flex-wrap gap-2 flex-1">
          <Button
            onClick={() => setPriceOpen(true)}
            data-testid="bulk-btn-price"
            className="h-10 bg-[#0D0D0D] border border-[#333] hover:border-flame text-white text-sm"
          >
            <Euro className="w-4 h-4 mr-1" /> Τιμή
          </Button>
          <Button
            onClick={() => setCatOpen(true)}
            data-testid="bulk-btn-category"
            className="h-10 bg-[#0D0D0D] border border-[#333] hover:border-flame text-white text-sm"
          >
            <FolderInput className="w-4 h-4 mr-1" /> Κατηγορία
          </Button>
          <Button
            onClick={() => setGroupOpen(true)}
            data-testid="bulk-btn-group"
            className="h-10 bg-[#0D0D0D] border border-[#333] hover:border-flame text-white text-sm"
          >
            <ListPlus className="w-4 h-4 mr-1" /> Προσθέστε επιλογές
          </Button>
          <Button
            onClick={() => setConfirmDelete(true)}
            data-testid="bulk-btn-delete"
            className="h-10 bg-[#FF3B30]/10 border border-[#FF3B30]/50 hover:bg-[#FF3B30]/20 text-[#FF6961] text-sm"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Διαγραφή
          </Button>
        </div>
        <button
          onClick={onClear}
          data-testid="bulk-clear"
          className="p-2 text-neutral-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <PriceChangeDialog open={priceOpen} count={count} onClose={() => setPriceOpen(false)} onApply={applyPrice} />
      <CategoryDialog open={catOpen} count={count} categories={categories} onClose={() => setCatOpen(false)} onApply={applyCategory} />
      <OptionGroupDialog open={groupOpen} count={count} onClose={() => setGroupOpen(false)} onApply={applyGroup} />

      <AlertDialog open={confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(false)}>
        <AlertDialogContent className="bg-[#0D0D0D] border-[#333] text-white" data-testid="bulk-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl">
              Διαγραφή {count} προϊόντων;
            </AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              Η ενέργεια είναι μη αναστρέψιμη.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="bulk-delete-cancel"
              className="bg-[#1A1A1A] border-[#333] text-neutral-300 hover:bg-[#222] hover:text-white"
            >
              Άκυρο
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              data-testid="bulk-delete-confirm"
              className="bg-[#FF3B30] hover:bg-[#FF5A50] text-white"
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
