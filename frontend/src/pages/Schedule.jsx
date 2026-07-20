import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Share2,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
import ShiftModal from "./schedule/ShiftModal";
import ScheduleGrid from "./schedule/ScheduleGrid";
import ShareDialog from "./schedule/ShareDialog";
import { printSchedule, buildScheduleText, copyToClipboard } from "./schedule/utils";

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

        <ScheduleGrid
          loading={loading}
          employees={employees}
          days={days}
          editingId={editingId}
          editingName={editingName}
          setEditingId={setEditingId}
          setEditingName={setEditingName}
          saveEmployeeName={saveEmployeeName}
          findShift={findShift}
          openShiftModal={openShiftModal}
          removeEmployee={removeEmployee}
        />
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

      <ShareDialog
        shareOpen={shareOpen}
        setShareOpen={setShareOpen}
        weekStart={weekStart}
        handlePrintSchedule={handlePrintSchedule}
        handleCopySchedule={handleCopySchedule}
      />
    </AppShell>
  );
}
