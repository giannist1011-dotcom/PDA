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
  Share2,
  Printer,
  Copy,
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
      <DialogContent className="max-w-md bg-[#2A0E14] border-[#723645] text-white" data-testid="shift-modal">
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
                className="w-full h-12 px-3 mt-1 bg-[#3D1620] border border-[#723645] rounded-md text-white font-mono text-lg focus:outline-none focus:border-flame"
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
                className="w-full h-12 px-3 mt-1 bg-[#3D1620] border border-[#723645] rounded-md text-white font-mono text-lg focus:outline-none focus:border-flame"
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
                className="bg-brand hover:bg-brand-hover font-bold"
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ---------- Print helper: weekly schedule table ----------
function printSchedule({ restaurantName, weekStart, employees, shifts, days }) {
  const findShift = (employeeId, dayIdx) =>
    shifts.find((s) => s.employee_id === employeeId && s.day === dayIdx);

  const headerCells = days
    .map((d) => `<th>${escapeHtml(d.short)}<br/><span class="sub">${d.date.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" })}</span></th>`)
    .join("");

  const rows = employees
    .map((emp) => {
      const cells = days
        .map((d) => {
          const sh = findShift(emp.id, d.idx);
          return `<td>${sh ? `${sh.start}–${sh.end}` : "—"}</td>`;
        })
        .join("");
      return `<tr><td class="name">${escapeHtml(emp.name)}</td>${cells}</tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="utf-8" />
<title>Πρόγραμμα — ${escapeHtml(restaurantName || "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #111; margin: 24px; }
  header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { font-size: 13px; color: #7A3E52; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #999; padding: 8px 6px; text-align: center; }
  th { background: #eee; font-size: 11px; }
  th .sub { font-weight: normal; color: #666; }
  td.name { text-align: left; font-weight: bold; }
  .empty { color: #888; font-style: italic; padding: 20px 0; }
  footer { margin-top: 24px; font-size: 11px; color: #888; text-align: right; }
  @media print { body { margin: 12mm; } .no-print { display: none; } }
</style>
</head>
<body>
  <header>
    <h1>Εβδομαδιαίο πρόγραμμα</h1>
    <div class="meta">${escapeHtml(restaurantName || "")} · Εβδομάδα ${escapeHtml(formatWeekRange(weekStart))}</div>
  </header>
  ${employees.length === 0
    ? '<div class="empty">Δεν υπάρχουν υπάλληλοι</div>'
    : `<table><thead><tr><th>Υπάλληλος</th>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`}
  <footer>Εκτυπώθηκε από το OrderDeck</footer>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 100));</script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    toast.error("Ενεργοποιήστε τα pop-ups για εκτύπωση");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ---------- Plain-text schedule for Viber/WhatsApp/SMS ----------
function buildScheduleText({ restaurantName, weekStart, employees, shifts, days }) {
  const findShift = (employeeId, dayIdx) =>
    shifts.find((s) => s.employee_id === employeeId && s.day === dayIdx);

  const lines = [];
  lines.push(`Πρόγραμμα εβδομάδας ${formatWeekRange(weekStart)}${restaurantName ? " — " + restaurantName : ""}`);

  employees.forEach((emp) => {
    const empShifts = days
      .map((d) => ({ day: d, shift: findShift(emp.id, d.idx) }))
      .filter((x) => x.shift);
    if (empShifts.length === 0) return;
    lines.push("");
    lines.push(emp.name);
    empShifts.forEach(({ day, shift }) => {
      lines.push(`${day.label}: ${shift.start}–${shift.end}`);
    });
  });

  return lines.join("\n");
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export default function Schedule() {
  const { user, canManage } = useAuth();
  const readOnly = !canManage;
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [weekStart, setWeekStart] = useState(isoDate(mondayOf(new Date())));
  const [newEmp, setNewEmp] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCtx, setModalCtx] = useState({ employee: null, day: 0, initial: null });
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

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

  const restaurantName = user?.restaurant_name || "";

  const handlePrintSchedule = () => {
    printSchedule({ restaurantName, weekStart, employees, shifts, days });
    setShareOpen(false);
  };

  const handleCopySchedule = async () => {
    const text = buildScheduleText({ restaurantName, weekStart, employees, shifts, days });
    try {
      await copyToClipboard(text);
      toast.success("Το πρόγραμμα αντιγράφηκε στο πρόχειρο");
      setShareOpen(false);
    } catch (e) {
      toast.error("Αποτυχία αντιγραφής");
    }
  };

  return (
    <AppShell title={readOnly ? "Πρόγραμμα (προβολή)" : "Πρόγραμμα υπαλλήλων"}>
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1600px] mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-flame" />
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
              className="h-11 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              onClick={goToday}
              data-testid="today-btn"
              className="h-11 bg-[#3D1620] border border-[#723645] hover:border-flame text-white font-bold"
            >
              Τρέχουσα
            </Button>
            <Button
              onClick={() => changeWeek(1)}
              data-testid="next-week-btn"
              className="h-11 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => setShareOpen(true)}
              disabled={employees.length === 0}
              data-testid="share-schedule-btn"
              className="h-11 bg-[#3D1620] border border-[#723645] hover:border-flame hover:text-flame text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              title="Εκτύπωση ή αντιγραφή προγράμματος"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Κοινοποίηση
            </Button>
          </div>
        </div>

        {/* Add employee (owner only) */}
        {!readOnly && (
          <form
            onSubmit={addEmployee}
            className="flex gap-2 mb-5 p-4 bg-[#3D1620] border border-[#723645] rounded-lg"
          >
            <input
              value={newEmp}
              onChange={(e) => setNewEmp(e.target.value)}
              placeholder="Όνομα υπαλλήλου..."
              data-testid="new-employee-input"
              className="flex-1 h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
            />
            <Button
              type="submit"
              data-testid="add-employee-btn"
              className="h-11 bg-brand hover:bg-brand-hover px-5 font-bold"
            >
              <Plus className="w-4 h-4 mr-1" /> Προσθήκη
            </Button>
          </form>
        )}

        {loading ? (
          <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
        ) : employees.length === 0 ? (
          <div className="text-neutral-500 py-16 text-center bg-[#3D1620] border border-[#723645] rounded-lg">
            Δεν έχετε προσθέσει υπαλλήλους ακόμα
          </div>
        ) : (
          <div className="overflow-x-auto bg-[#3D1620] border border-[#723645] rounded-lg">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-[#723645]">
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
                    className="border-b border-[#431A25] last:border-0"
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
                            className="h-9 px-2 bg-[#2A0E14] border border-flame rounded text-white text-sm w-full"
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
                          className="text-left font-semibold text-white hover:text-flame"
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
                                ? "bg-flame/15 border-flame/40 text-flame hover:bg-flame/25 font-bold"
                                : "bg-[#2A0E14] border-[#723645] text-neutral-600 hover:border-flame hover:text-flame"
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

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm bg-[#2A0E14] border-[#723645] text-white" data-testid="share-schedule-modal">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Κοινοποίηση προγράμματος</DialogTitle>
            <p className="text-sm text-neutral-400 mt-1">Εβδομάδα {formatWeekRange(weekStart)}</p>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handlePrintSchedule}
              data-testid="share-print-btn"
              className="flex items-center gap-2 h-11 px-4 rounded-md bg-[#3D1620] border border-[#723645] text-white text-sm font-bold hover:border-flame hover:text-flame transition-colors"
            >
              <Printer className="w-4 h-4" />
              Εκτύπωση προγράμματος
            </button>
            <button
              onClick={handleCopySchedule}
              data-testid="share-copy-btn"
              className="flex items-center gap-2 h-11 px-4 rounded-md bg-[#3D1620] border border-[#723645] text-white text-sm font-bold hover:border-flame hover:text-flame transition-colors"
            >
              <Copy className="w-4 h-4" />
              Αντιγραφή για Viber/WhatsApp
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
