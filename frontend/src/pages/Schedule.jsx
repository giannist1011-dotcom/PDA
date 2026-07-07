import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  X,
  Save,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  apiListEmployees,
  apiCreateEmployee,
  apiUpdateEmployee,
  apiDeleteEmployee,
  apiListShifts,
  apiUpsertShift,
  apiDeleteShift,
  formatApiError,
} from "@/lib/api";
import { DAY_LABELS, DAY_SHORT, isoDate, mondayOf, addDays, formatWeekRange } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";

// Shift editor modal
function ShiftModal({ open, employee, day, weekStart, initial, onClose, onSave, onDelete }) {
  const [start, setStart] = useState(initial?.start || "17:00");
  const [end, setEnd] = useState(initial?.end || "01:00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStart(initial?.start || "17:00");
      setEnd(initial?.end || "01:00");
    }
  }, [open, initial]);

  if (!employee) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({ start, end });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#0D0D0D] border-[#333] text-white" data-testid="shift-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Βάρδια — {employee.name}
          </DialogTitle>
          <p className="text-sm text-neutral-400 mt-1">
            {DAY_LABELS[day]} · Εβδομάδα {formatWeekRange(weekStart)}
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Έναρξη
              </label>
              <input
                type="time"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
                data-testid="shift-start"
                className="w-full h-12 px-3 mt-1 bg-[#1A1A1A] border border-[#333] rounded-md text-white font-mono text-lg focus:outline-none focus:border-[#FF6B00]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Λήξη
              </label>
              <input
                type="time"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                data-testid="shift-end"
                className="w-full h-12 px-3 mt-1 bg-[#1A1A1A] border border-[#333] rounded-md text-white font-mono text-lg focus:outline-none focus:border-[#FF6B00]"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 flex flex-col sm:flex-row sm:justify-between gap-2">
            {initial && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                data-testid="shift-delete-btn"
                className="text-[#FF6961] hover:bg-[#FF3B30]/10"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Διαγραφή
              </Button>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <Button type="button" variant="ghost" onClick={onClose} className="text-neutral-300">
                Άκυρο
              </Button>
              <Button
                type="submit"
                disabled={busy}
                data-testid="shift-save-btn"
                className="bg-[#FF6B00] hover:bg-[#FF8533] font-bold"
              >
                <Save className="w-4 h-4 mr-2" /> Αποθήκευση
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Schedule() {
  const { isOwner } = useAuth();
  const readOnly = !isOwner;
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [weekStart, setWeekStart] = useState(isoDate(mondayOf(new Date())));
  const [newEmp, setNewEmp] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCtx, setModalCtx] = useState({ employee: null, day: 0, initial: null });
  const [loading, setLoading] = useState(true);

  const loadEmployees = async () => {
    try {
      setEmployees(await apiListEmployees());
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const loadShifts = async () => {
    try {
      const s = await apiListShifts(weekStart);
      setShifts(s);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  useEffect(() => {
    (async () => {
      await loadEmployees();
      await loadShifts();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const addEmployee = async (e) => {
    e?.preventDefault();
    if (!newEmp.trim()) return;
    try {
      const emp = await apiCreateEmployee(newEmp.trim());
      setEmployees((p) => [...p, emp]);
      setNewEmp("");
      toast.success("Ο υπάλληλος προστέθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const saveEmployeeName = async (id) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await apiUpdateEmployee(id, editingName.trim());
      setEmployees((p) => p.map((e) => (e.id === id ? { ...e, name: editingName.trim() } : e)));
      setEditingId(null);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const removeEmployee = async (id) => {
    if (!window.confirm("Διαγραφή υπαλλήλου και όλων των βαρδιών του;")) return;
    try {
      await apiDeleteEmployee(id);
      setEmployees((p) => p.filter((e) => e.id !== id));
      setShifts((p) => p.filter((s) => s.employee_id !== id));
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const changeWeek = (delta) => {
    const cur = new Date(weekStart + "T00:00:00");
    setWeekStart(isoDate(addDays(cur, delta * 7)));
  };

  const goToday = () => setWeekStart(isoDate(mondayOf(new Date())));

  const findShift = (employeeId, day) =>
    shifts.find((s) => s.employee_id === employeeId && s.day === day);

  const openShiftModal = (employee, day) => {
    if (readOnly) return;
    setModalCtx({ employee, day, initial: findShift(employee.id, day) });
    setModalOpen(true);
  };

  const saveShift = async ({ start, end }) => {
    try {
      const saved = await apiUpsertShift({
        employee_id: modalCtx.employee.id,
        week_start: weekStart,
        day: modalCtx.day,
        start,
        end,
      });
      setShifts((p) => {
        const filtered = p.filter(
          (s) => !(s.employee_id === saved.employee_id && s.day === saved.day)
        );
        return [...filtered, saved];
      });
      setModalOpen(false);
      toast.success("Η βάρδια αποθηκεύτηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const deleteShift = async () => {
    try {
      await apiDeleteShift(modalCtx.employee.id, weekStart, modalCtx.day);
      setShifts((p) =>
        p.filter((s) => !(s.employee_id === modalCtx.employee.id && s.day === modalCtx.day))
      );
      setModalOpen(false);
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const days = useMemo(() => {
    const mon = new Date(weekStart + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i);
      return { idx: i, label: DAY_LABELS[i], short: DAY_SHORT[i], date: d };
    });
  }, [weekStart]);

  return (
    <AppShell title={readOnly ? "Πρόγραμμα (προβολή)" : "Πρόγραμμα υπαλλήλων"}>
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1600px] mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-[#FF6B00]" />
              {readOnly ? "Εβδομαδιαίο πρόγραμμα (προβολή)" : "Εβδομαδιαίο πρόγραμμα"}
            </h2>
            <p className="text-sm text-neutral-400 mt-1" data-testid="week-range">
              Εβδομάδα: {formatWeekRange(weekStart)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => changeWeek(-1)}
              data-testid="prev-week-btn"
              className="h-11 bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              onClick={goToday}
              data-testid="today-btn"
              className="h-11 bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] text-white font-bold"
            >
              Τρέχουσα
            </Button>
            <Button
              onClick={() => changeWeek(1)}
              data-testid="next-week-btn"
              className="h-11 bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Add employee (owner only) */}
        {!readOnly && (
          <form
            onSubmit={addEmployee}
            className="flex gap-2 mb-5 p-4 bg-[#1A1A1A] border border-[#333] rounded-lg"
          >
            <input
              value={newEmp}
              onChange={(e) => setNewEmp(e.target.value)}
              placeholder="Όνομα υπαλλήλου..."
              data-testid="new-employee-input"
              className="flex-1 h-11 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#FF6B00]"
            />
            <Button
              type="submit"
              data-testid="add-employee-btn"
              className="h-11 bg-[#FF6B00] hover:bg-[#FF8533] px-5 font-bold"
            >
              <Plus className="w-4 h-4 mr-1" /> Προσθήκη
            </Button>
          </form>
        )}

        {loading ? (
          <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
        ) : employees.length === 0 ? (
          <div className="text-neutral-500 py-16 text-center bg-[#1A1A1A] border border-[#333] rounded-lg">
            Δεν έχετε προσθέσει υπαλλήλους ακόμα
          </div>
        ) : (
          <div className="overflow-x-auto bg-[#1A1A1A] border border-[#333] rounded-lg">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-neutral-400 font-bold w-48">
                    Υπάλληλος
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.idx}
                      className="text-center px-2 py-3 text-xs uppercase tracking-widest text-neutral-400 font-bold"
                    >
                      <div>{d.short}</div>
                      <div className="font-mono text-[10px] text-neutral-600 font-normal">
                        {d.date.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" })}
                      </div>
                    </th>
                  ))}
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b border-[#222] last:border-0"
                    data-testid={`emp-row-${emp.id}`}
                  >
                    <td className="px-4 py-3">
                      {editingId === emp.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => saveEmployeeName(emp.id)}
                            onKeyDown={(e) => e.key === "Enter" && saveEmployeeName(emp.id)}
                            autoFocus
                            className="h-9 px-2 bg-[#0D0D0D] border border-[#FF6B00] rounded text-white text-sm w-full"
                          />
                          <button onClick={() => setEditingId(null)} className="p-1 text-neutral-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(emp.id);
                            setEditingName(emp.name);
                          }}
                          className="text-left font-semibold text-white hover:text-[#FF6B00]"
                          data-testid={`emp-name-${emp.id}`}
                        >
                          {emp.name}
                        </button>
                      )}
                    </td>
                    {days.map((d) => {
                      const sh = findShift(emp.id, d.idx);
                      return (
                        <td key={d.idx} className="px-2 py-2 text-center">
                          <button
                            onClick={() => openShiftModal(emp, d.idx)}
                            data-testid={`cell-${emp.id}-${d.idx}`}
                            className={`w-full h-14 rounded-md border font-mono text-sm transition-all active:scale-[0.98] ${
                              sh
                                ? "bg-[#FF6B00]/15 border-[#FF6B00]/40 text-[#FF6B00] hover:bg-[#FF6B00]/25 font-bold"
                                : "bg-[#0D0D0D] border-[#333] text-neutral-600 hover:border-[#FF6B00] hover:text-[#FF6B00]"
                            }`}
                          >
                            {sh ? `${sh.start}–${sh.end}` : "+"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => removeEmployee(emp.id)}
                        data-testid={`del-emp-${emp.id}`}
                        className="p-2 text-neutral-500 hover:text-[#FF3B30]"
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
      </main>

      <ShiftModal
        open={modalOpen}
        employee={modalCtx.employee}
        day={modalCtx.day}
        weekStart={weekStart}
        initial={modalCtx.initial}
        onClose={() => setModalOpen(false)}
        onSave={saveShift}
        onDelete={deleteShift}
      />
    </AppShell>
  );
}
