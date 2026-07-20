import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/format";
import DatePicker from "@/components/DatePicker";

// ---------- Expense create/edit modal ----------
export default function ExpenseModal({ open, onClose, categories, initial, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(initial ? String(initial.amount) : "");
      setDescription(initial?.description || "");
      setCategoryId(initial?.category_id || categories[0]?.id || "");
      setDate(initial?.date || todayISO());
    }
  }, [open, initial, categories]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    const num = parseFloat(String(amount).replace(",", "."));
    if (!num || num <= 0) {
      toast.error("Εισάγετε έγκυρο ποσό");
      return;
    }
    if (!date) {
      toast.error("Εισάγετε ημερομηνία");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        amount: num,
        description: description.trim(),
        category_id: categoryId || null,
        date,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="expense-modal"
    >
      <form
        onSubmit={submit}
        className="bg-[#3D1620] border border-[#723645] rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="font-heading text-xl font-bold mb-4">
          {initial ? "Επεξεργασία εξόδου" : "Νέο έξοδο"}
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-neutral-400">
              Ποσό (€)
            </label>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="π.χ. 45,50"
              data-testid="expense-amount-input"
              className="w-full h-11 mt-1 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white font-mono text-sm focus:outline-none focus:border-flame"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-neutral-400">
              Ημερομηνία
            </label>
            <DatePicker
              value={date}
              onChange={setDate}
              testId="expense-date-input"
              className="w-full h-11 mt-1"
            />
          </div>
        </div>

        <label className="text-xs uppercase tracking-wider text-neutral-400">
          Περιγραφή
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="π.χ. Παραγγελία κρέατος"
          data-testid="expense-description-input"
          className="w-full h-11 mt-1 mb-4 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        />

        <label className="text-xs uppercase tracking-wider text-neutral-400">
          Κατηγορία
        </label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          data-testid="expense-category-select"
          className="w-full h-11 mt-1 mb-6 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="expense-cancel-btn"
            className="h-10 px-4 rounded-md bg-[#4F202D] text-neutral-300 text-sm font-bold hover:bg-[#723645]"
          >
            Άκυρο
          </button>
          <Button
            type="submit"
            disabled={busy}
            data-testid="expense-save-btn"
            className="h-10 bg-brand hover:bg-brand-hover px-4"
          >
            {initial ? "Αποθήκευση" : "Προσθήκη"}
          </Button>
        </div>
      </form>
    </div>
  );
}
