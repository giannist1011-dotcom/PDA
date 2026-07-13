import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  Wallet,
  FolderCog,
  RefreshCcw,
  Euro,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  apiListExpenseCategories,
  apiCreateExpenseCategory,
  apiUpdateExpenseCategory,
  apiDeleteExpenseCategory,
  apiListExpenses,
  apiCreateExpense,
  apiUpdateExpense,
  apiDeleteExpense,
  formatApiError,
} from "@/lib/api";
import { eur, todayISO } from "@/lib/format";

const firstOfMonthISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
};

const formatGRDate = (iso) => {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

// ---------- Expense create/edit modal ----------
function ExpenseModal({ open, onClose, categories, initial, onSubmit }) {
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
        className="bg-[#1A1A1A] border border-[#333] rounded-lg p-6 w-full max-w-md"
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
              className="w-full h-11 mt-1 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white font-mono text-sm focus:outline-none focus:border-flame"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-neutral-400">
              Ημερομηνία
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="expense-date-input"
              className="w-full h-11 mt-1 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white font-mono text-sm focus:outline-none focus:border-flame"
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
          className="w-full h-11 mt-1 mb-4 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-flame"
        />

        <label className="text-xs uppercase tracking-wider text-neutral-400">
          Κατηγορία
        </label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          data-testid="expense-category-select"
          className="w-full h-11 mt-1 mb-6 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-flame"
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
            className="h-10 px-4 rounded-md bg-[#2A2A2A] text-neutral-300 text-sm font-bold hover:bg-[#333]"
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

// ---------- Category manager modal ----------
function CategoryManagerModal({ open, onClose, categories, onCreate, onRename, onDelete }) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    if (open) {
      setNewName("");
      setEditingId(null);
    }
  }, [open]);

  if (!open) return null;

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onCreate(newName.trim());
    setNewName("");
  };

  const saveRename = async (cat) => {
    if (editingName.trim() && editingName.trim() !== cat.name) {
      await onRename(cat, editingName.trim());
    }
    setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="expense-categories-modal"
    >
      <div className="bg-[#1A1A1A] border border-[#333] rounded-lg p-6 w-full max-w-md max-h-[85vh] flex flex-col">
        <h3 className="font-heading text-xl font-bold mb-4">Κατηγορίες εξόδων</h3>

        <form onSubmit={addCategory} className="flex gap-2 mb-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Νέα κατηγορία..."
            data-testid="expense-new-category-input"
            className="flex-1 h-11 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-flame"
          />
          <Button
            type="submit"
            data-testid="expense-add-category-btn"
            className="h-11 bg-brand hover:bg-brand-hover px-3"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2">
          {categories.map((c) => (
            <div
              key={c.id}
              data-testid={`expense-cat-row-${c.id}`}
              className="flex items-center gap-2 p-3 bg-[#0D0D0D] border border-[#333] rounded-md group"
            >
              {editingId === c.id ? (
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => saveRename(c)}
                  onKeyDown={(e) => e.key === "Enter" && saveRename(c)}
                  autoFocus
                  className="flex-1 h-9 px-2 bg-[#1A1A1A] border border-flame rounded text-white text-sm"
                />
              ) : (
                <span className="flex-1 text-sm text-white font-medium">{c.name}</span>
              )}
              <button
                onClick={() => {
                  setEditingId(c.id);
                  setEditingName(c.name);
                }}
                data-testid={`expense-cat-edit-${c.id}`}
                className="p-1.5 text-neutral-400 hover:text-white"
                title="Μετονομασία"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(c)}
                data-testid={`expense-cat-delete-${c.id}`}
                className="p-1.5 text-neutral-400 hover:text-[#FF3B30]"
                title="Διαγραφή"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            data-testid="expense-categories-close-btn"
            className="h-10 px-4 rounded-md bg-[#2A2A2A] text-neutral-300 text-sm font-bold hover:bg-[#333]"
          >
            Κλείσιμο
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main page ----------
export default function Expenses() {
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [filterCat, setFilterCat] = useState("all");
  const [expenseModal, setExpenseModal] = useState({ open: false, editing: null });
  const [catModalOpen, setCatModalOpen] = useState(false);

  const loadCategories = async () => {
    try {
      setCategories(await apiListExpenseCategories());
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const loadExpenses = async (f = from, t = to) => {
    setLoading(true);
    try {
      setExpenses(await apiListExpenses({ date_from: f, date_to: t }));
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadCategories();
      await loadExpenses();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catName = (id) =>
    categories.find((c) => c.id === id)?.name || "Χωρίς κατηγορία";

  // ---- expenses CRUD ----
  const handleSaveExpense = async (payload) => {
    try {
      if (expenseModal.editing) {
        const updated = await apiUpdateExpense(expenseModal.editing.id, payload);
        setExpenses((p) =>
          p.map((x) => (x.id === expenseModal.editing.id ? { ...x, ...updated } : x))
        );
        toast.success("Το έξοδο ενημερώθηκε");
      } else {
        const created = await apiCreateExpense(payload);
        setExpenses((p) => [created, ...p]);
        toast.success("Το έξοδο καταχωρήθηκε");
      }
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const handleDeleteExpense = async (exp) => {
    if (!window.confirm(`Διαγραφή εξόδου ${eur(exp.amount)} (${exp.description || catName(exp.category_id)});`)) return;
    try {
      await apiDeleteExpense(exp.id);
      setExpenses((p) => p.filter((x) => x.id !== exp.id));
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  // ---- categories CRUD ----
  const handleCreateCategory = async (name) => {
    try {
      const created = await apiCreateExpenseCategory({ name, order: categories.length });
      setCategories((p) => [...p, created]);
      toast.success("Κατηγορία προστέθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleRenameCategory = async (cat, name) => {
    try {
      await apiUpdateExpenseCategory(cat.id, { name, order: cat.order || 0 });
      setCategories((p) => p.map((c) => (c.id === cat.id ? { ...c, name } : c)));
      toast.success("Ενημερώθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleDeleteCategory = async (cat) => {
    const count = expenses.filter((x) => x.category_id === cat.id).length;
    const msg = count
      ? `Διαγραφή κατηγορίας "${cat.name}"; Τα ${count} έξοδά της θα μείνουν χωρίς κατηγορία.`
      : `Διαγραφή κατηγορίας "${cat.name}";`;
    if (!window.confirm(msg)) return;
    try {
      await apiDeleteExpenseCategory(cat.id);
      setCategories((p) => p.filter((c) => c.id !== cat.id));
      setExpenses((p) =>
        p.map((x) => (x.category_id === cat.id ? { ...x, category_id: null } : x))
      );
      if (filterCat === cat.id) setFilterCat("all");
      toast.success("Κατηγορία διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  // ---- derived ----
  const filtered = useMemo(() => {
    if (filterCat === "all") return expenses;
    if (filterCat === "none") return expenses.filter((x) => !x.category_id);
    return expenses.filter((x) => x.category_id === filterCat);
  }, [expenses, filterCat]);

  const periodTotal = useMemo(
    () => filtered.reduce((s, x) => s + (x.amount || 0), 0),
    [filtered]
  );

  const byCategory = useMemo(() => {
    const map = new Map();
    expenses.forEach((x) => {
      const key = x.category_id || "none";
      map.set(key, (map.get(key) || 0) + (x.amount || 0));
    });
    return Array.from(map.entries())
      .map(([key, total]) => ({
        key,
        name: key === "none" ? "Χωρίς κατηγορία" : catName(key),
        total,
      }))
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, categories]);

  return (
    <AppShell title="Έξοδα">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1500px] mx-auto w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6 text-flame" />
              <h2 className="font-heading text-2xl font-bold">Έξοδα καταστήματος</h2>
            </div>
            <p className="text-sm text-neutral-400 mt-1">
              Καταχώρηση και παρακολούθηση εξόδων ανά κατηγορία
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCatModalOpen(true)}
              data-testid="expenses-manage-categories-btn"
              className="h-11 bg-[#1A1A1A] border border-[#333] hover:border-flame text-white"
            >
              <FolderCog className="w-4 h-4 mr-2" />
              Κατηγορίες
            </Button>
            <Button
              onClick={() => setExpenseModal({ open: true, editing: null })}
              data-testid="expenses-add-btn"
              className="h-11 bg-brand hover:bg-brand-hover font-bold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Νέο έξοδο
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-5 bg-[#1A1A1A] border border-[#333] rounded-lg mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Από
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                data-testid="expenses-date-from"
                className="h-12 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white font-mono focus:outline-none focus:border-flame"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Έως
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                data-testid="expenses-date-to"
                className="h-12 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white font-mono focus:outline-none focus:border-flame"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Κατηγορία
              </label>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
                data-testid="expenses-category-filter"
                className="h-12 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-flame"
              >
                <option value="all">Όλες</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="none">Χωρίς κατηγορία</option>
              </select>
            </div>
            <Button
              onClick={() => loadExpenses()}
              disabled={loading}
              data-testid="expenses-apply-filter-btn"
              className="h-12 px-6 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              {loading ? "Φόρτωση..." : "Εφαρμογή"}
            </Button>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 mb-6">
          <div
            className="p-6 bg-[#1A1A1A] border border-[#333] rounded-lg"
            data-testid="expenses-period-total"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Σύνολο περιόδου
              </span>
              <Euro className="w-5 h-5 text-flame" />
            </div>
            <div className="font-mono text-3xl font-bold text-white mt-3">
              {eur(periodTotal)}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {filtered.length} καταχωρήσεις
            </div>
          </div>

          <div
            className="p-5 bg-[#1A1A1A] border border-[#333] rounded-lg"
            data-testid="expenses-breakdown"
          >
            <div className="text-xs uppercase tracking-widest text-neutral-400 font-bold mb-3">
              Ανά κατηγορία (περίοδος)
            </div>
            {byCategory.length === 0 ? (
              <div className="text-neutral-500 text-sm py-4 text-center">
                Δεν υπάρχουν έξοδα στην περίοδο
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {byCategory.map((c) => (
                  <div
                    key={c.key}
                    data-testid={`expenses-breakdown-${c.key}`}
                    className="px-3 py-2 bg-[#0D0D0D] border border-[#333] rounded-md"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                      {c.name}
                    </div>
                    <div className="font-mono font-bold text-gold mt-0.5">
                      {eur(c.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Expense list */}
        <div className="bg-[#1A1A1A] border border-[#333] rounded-lg" data-testid="expenses-list">
          {loading ? (
            <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
          ) : filtered.length === 0 ? (
            <div className="text-neutral-500 py-16 text-center">
              Δεν υπάρχουν έξοδα σε αυτή την προβολή
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-neutral-400 border-b border-[#333]">
                    <th className="py-3 px-4">Ημερομηνία</th>
                    <th className="py-3 px-4">Περιγραφή</th>
                    <th className="py-3 px-4">Κατηγορία</th>
                    <th className="py-3 px-4 text-right">Ποσό</th>
                    <th className="py-3 px-4 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((exp) => (
                    <tr
                      key={exp.id}
                      className="border-b border-[#222] last:border-0 group"
                      data-testid={`expense-row-${exp.id}`}
                    >
                      <td className="py-3 px-4 font-mono text-neutral-300 whitespace-nowrap">
                        {formatGRDate(exp.date)}
                      </td>
                      <td className="py-3 px-4 text-white">
                        {exp.description || <span className="text-neutral-500">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded bg-flame/15 text-flame">
                          {catName(exp.category_id)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {eur(exp.amount)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setExpenseModal({ open: true, editing: exp })}
                          data-testid={`expense-edit-${exp.id}`}
                          className="p-2 text-neutral-400 hover:text-white"
                          title="Επεξεργασία"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp)}
                          data-testid={`expense-delete-${exp.id}`}
                          className="p-2 text-neutral-400 hover:text-[#FF3B30]"
                          title="Διαγραφή"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <ExpenseModal
        open={expenseModal.open}
        onClose={() => setExpenseModal({ open: false, editing: null })}
        categories={categories}
        initial={expenseModal.editing}
        onSubmit={handleSaveExpense}
      />
      <CategoryManagerModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        categories={categories}
        onCreate={handleCreateCategory}
        onRename={handleRenameCategory}
        onDelete={handleDeleteCategory}
      />
    </AppShell>
  );
}
