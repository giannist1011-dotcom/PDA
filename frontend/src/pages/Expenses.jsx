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
import { eur, formatGRDate } from "@/lib/format";
import PeriodFilter, { periodLabel } from "@/components/PeriodFilter";
import { presetRange } from "@/lib/dates";
import ExpenseModal from "./expenses/ExpenseModal";
import CategoryManagerModal from "./expenses/CategoryManagerModal";

// ---------- Main page ----------
export default function Expenses() {
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  // Κοινό pattern presets περιόδου — default «Αυτός ο μήνας» (όπως πριν)
  const [period, setPeriod] = useState(() => ({
    preset: "thisMonth",
    ...presetRange("thisMonth"),
  }));
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

  const loadExpenses = async (f = period.from, t = period.to) => {
    setLoading(true);
    try {
      setExpenses(await apiListExpenses({ date_from: f, date_to: t }));
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  // Preset → άμεση εφαρμογή· custom ημερομηνία → πατάει «Εφαρμογή»
  const handlePeriodChange = (next, meta) => {
    setPeriod(next);
    if (meta.fromPreset) loadExpenses(next.from, next.to);
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
              className="h-11 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
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
        <div className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg mb-6 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <PeriodFilter
              value={period}
              onChange={handlePeriodChange}
              testIdPrefix="expenses"
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                Κατηγορία
              </label>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
                data-testid="expenses-category-filter"
                className="h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
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
              className="h-11 px-6 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              {loading ? "Φόρτωση..." : "Εφαρμογή"}
            </Button>
          </div>
          <div className="pt-3 border-t border-[#431A25] text-sm text-neutral-300">
            Εύρος:{" "}
            <span className="font-mono font-bold text-white" data-testid="expenses-period-label">
              {periodLabel(period)}
            </span>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 mb-6">
          <div
            className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg"
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
            className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg"
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
                    className="px-3 py-2 bg-[#2A0E14] border border-[#723645] rounded-md"
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
        <div className="bg-[#3D1620] border border-[#723645] rounded-lg" data-testid="expenses-list">
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
                  <tr className="text-left text-xs uppercase tracking-widest text-neutral-400 border-b border-[#723645]">
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
                      className="border-b border-[#431A25] last:border-0 group"
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
