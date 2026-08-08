import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Share2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/lib/api";
import { DAY_LABELS, DAY_SHORT, isoDate, mondayOf, addDays, formatWeekRange } from "@/lib/dates";
import ShiftModal from "./ShiftModal";
import ScheduleGrid from "./ScheduleGrid";
import ShareDialog from "./ShareDialog";
import AutofillDialog from "./AutofillDialog";
import { buildScheduleText, copyToClipboard } from "./utils";

// ΕΝΙΑΙΟ εβδομαδιαίο πρόγραμμα — μία υλοποίηση για OrderDeck (υπάλληλοι
// μαγαζιού) και FleetDeck (μέλη εταιρείας: διαχειριστής + διανομείς).
// Η κάθε επιφάνεια δίνει μόνο τα δικά της API adapters (πάντα με `member_id`)
// και το πώς εκτυπώνει — τα υπόλοιπα (πλοήγηση εβδομάδων, ιστορικό μόνο για
// προβολή, βάρδιες, κοινοποίηση, αυτοσυμπλήρωση) είναι κοινά.
export default function ScheduleBoard({
  api,                 // { listMembers, listShifts, listWeeks, upsertShift, deleteShift, autofill }
  canManage = false,
  memberActions = null, // { add, rename, remove } — μόνο όπου διαχειρίζονται τα μέλη εδώ
  labels = {},
  orgName = "",
  onPrint,
  onReadOnlyChange,
}) {
  const {
    member: memberLabel = "Υπάλληλος",
    empty: emptyText = "Δεν έχετε προσθέσει υπαλλήλους ακόμα",
    addPlaceholder = "Όνομα υπαλλήλου...",
    added: addedToast = "Ο υπάλληλος προστέθηκε",
    removeConfirm = "Διαγραφή υπαλλήλου και όλων των βαρδιών του;",
  } = labels;

  const currentMonday = isoDate(mondayOf(new Date()));
  const [members, setMembers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [weekStart, setWeekStart] = useState(currentMonday);
  // Εβδομάδες με αποθηκευμένες βάρδιες — για το ιστορικό (παλιές = μόνο προβολή)
  const [historyWeeks, setHistoryWeeks] = useState([]);
  const isPastWeek = weekStart < currentMonday;
  const readOnly = !canManage || isPastWeek;
  const [newMember, setNewMember] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCtx, setModalCtx] = useState({ member: null, day: 0, initial: null });
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [autofill, setAutofill] = useState(null); // { source, preview, skipped, overwrite }
  const [autofillBusy, setAutofillBusy] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      setMembers(await api.listMembers());
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, [api]);

  const loadShifts = useCallback(async () => {
    try {
      setShifts(await api.listShifts(weekStart));
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, [api, weekStart]);

  const loadWeeks = useCallback(async () => {
    try {
      const res = await api.listWeeks();
      setHistoryWeeks(res.weeks || []);
    } catch {
      // σιωπηλά — το ιστορικό εβδομάδων είναι βοηθητικό, το πρόγραμμα δουλεύει και χωρίς αυτό
    }
  }, [api]);

  useEffect(() => {
    (async () => {
      await loadMembers();
      await loadShifts();
      await loadWeeks();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  useEffect(() => {
    onReadOnlyChange?.(readOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  const addMember = async (e) => {
    e?.preventDefault();
    if (!newMember.trim()) return;
    try {
      const m = await memberActions.add(newMember.trim());
      setMembers((p) => [...p, m]);
      setNewMember("");
      toast.success(addedToast);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const saveMemberName = async (id) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await memberActions.rename(id, editingName.trim());
      setMembers((p) => p.map((m) => (m.id === id ? { ...m, name: editingName.trim() } : m)));
      setEditingId(null);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const removeMember = async (id) => {
    if (!window.confirm(removeConfirm)) return;
    try {
      await memberActions.remove(id);
      setMembers((p) => p.filter((m) => m.id !== id));
      setShifts((p) => p.filter((s) => s.member_id !== id));
      toast.success("Διαγράφηκε");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const changeWeek = (delta) => {
    const cur = new Date(weekStart + "T00:00:00");
    setWeekStart(isoDate(addDays(cur, delta * 7)));
  };

  const goToday = () => setWeekStart(currentMonday);

  const findShift = (memberId, day) =>
    shifts.find((s) => s.member_id === memberId && s.day === day);

  const openShiftModal = (member, day) => {
    if (readOnly) return;
    setModalCtx({ member, day, initial: findShift(member.id, day) });
    setModalOpen(true);
  };

  const saveShift = async ({ start, end }) => {
    try {
      const saved = await api.upsertShift({
        member_id: modalCtx.member.id,
        week_start: weekStart,
        day: modalCtx.day,
        start,
        end,
      });
      setShifts((p) => [
        ...p.filter((s) => !(s.member_id === saved.member_id && s.day === saved.day)),
        saved,
      ]);
      setHistoryWeeks((p) => (p.includes(weekStart) ? p : [weekStart, ...p].sort().reverse()));
      setModalOpen(false);
      toast.success("Η βάρδια αποθηκεύτηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const deleteShift = async () => {
    try {
      await api.deleteShift(modalCtx.member.id, weekStart, modalCtx.day);
      setShifts((p) =>
        p.filter((s) => !(s.member_id === modalCtx.member.id && s.day === modalCtx.day))
      );
      setModalOpen(false);
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  // Επιλογές του dropdown ιστορικού: τρέχουσα + προβαλλόμενη + όσες έχουν βάρδιες
  const weekOptions = useMemo(() => {
    const set = new Set([currentMonday, weekStart, ...historyWeeks]);
    return Array.from(set).sort().reverse();
  }, [currentMonday, weekStart, historyWeeks]);

  const days = useMemo(() => {
    const mon = new Date(weekStart + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i);
      return { idx: i, label: DAY_LABELS[i], short: DAY_SHORT[i], date: d };
    });
  }, [weekStart]);

  // ---------- Αυτοσυμπλήρωση: πρώτα προεπισκόπηση, μετά εφαρμογή ----------
  const openAutofill = async () => {
    const source = isoDate(addDays(new Date(weekStart + "T00:00:00"), -7));
    setAutofillBusy(true);
    try {
      const src = await api.listShifts(source);
      const byMember = new Map();
      let skipped = 0;
      src.forEach((s) => {
        const member = members.find((m) => m.id === s.member_id);
        if (!member) {
          skipped += 1;
          return;
        }
        if (!byMember.has(member.id)) byMember.set(member.id, { member, cells: [] });
        byMember.get(member.id).cells.push({ day: s.day, shift: s });
      });
      const preview = Array.from(byMember.values()).map((row) => ({
        ...row,
        cells: row.cells.sort((a, b) => a.day - b.day),
      }));
      const targets = new Set(preview.flatMap((r) => r.cells.map((c) => `${r.member.id}|${c.day}`)));
      const overwrite = shifts.filter((s) => targets.has(`${s.member_id}|${s.day}`)).length;
      setAutofill({ source, preview, skipped, overwrite });
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setAutofillBusy(false);
    }
  };

  const applyAutofill = async () => {
    setAutofillBusy(true);
    try {
      const res = await api.autofill(weekStart, autofill.source);
      await loadShifts();
      await loadWeeks();
      setAutofill(null);
      toast.success(
        `Αντιγράφηκαν ${res.copied} βάρδιες` +
          (res.skipped ? ` — ${res.skipped} παραλείφθηκαν` : "")
      );
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setAutofillBusy(false);
    }
  };

  const handlePrintSchedule = () => {
    onPrint?.({ orgName, weekStart, members, shifts, days });
    setShareOpen(false);
  };

  const handleCopySchedule = async () => {
    try {
      await copyToClipboard(buildScheduleText({ orgName, weekStart, members, shifts, days }));
      toast.success("Το πρόγραμμα αντιγράφηκε στο πρόχειρο");
      setShareOpen(false);
    } catch {
      toast.error("Αποτυχία αντιγραφής");
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-flame" />
            {readOnly ? "Εβδομαδιαίο πρόγραμμα (προβολή)" : "Εβδομαδιαίο πρόγραμμα"}
          </h2>
          <p className="text-sm text-neutral-400 mt-1" data-testid="week-range">
            Εβδομάδα: {formatWeekRange(weekStart)}
            {isPastWeek && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gold/20 text-gold">
                Ιστορικό — μόνο προβολή
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            data-testid="week-history-select"
            className="h-11 px-3 rounded-md bg-[#3D1620] border border-[#723645] text-white text-sm font-bold focus:outline-none focus:border-flame"
            title="Ιστορικό εβδομάδων"
          >
            {weekOptions.map((w) => (
              <option key={w} value={w}>
                {formatWeekRange(w)} · {w.slice(0, 4)}
                {w === currentMonday ? " (τρέχουσα)" : w < currentMonday ? " — ιστορικό" : ""}
              </option>
            ))}
          </select>
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
          {!readOnly && (
            <Button
              onClick={openAutofill}
              disabled={autofillBusy || members.length === 0}
              data-testid="autofill-btn"
              className="h-11 bg-[#3D1620] border border-[#723645] hover:border-flame hover:text-flame text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              title="Αντιγραφή των βαρδιών της προηγούμενης εβδομάδας"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Αυτοσυμπλήρωση
            </Button>
          )}
          <Button
            onClick={() => setShareOpen(true)}
            disabled={members.length === 0}
            data-testid="share-schedule-btn"
            className="h-11 bg-[#3D1620] border border-[#723645] hover:border-flame hover:text-flame text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            title="Εκτύπωση ή αντιγραφή προγράμματος"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Κοινοποίηση
          </Button>
        </div>
      </div>

      {/* Προσθήκη μέλους — μόνο όπου τα μέλη διαχειρίζονται από εδώ */}
      {!readOnly && memberActions?.add && (
        <form
          onSubmit={addMember}
          className="flex gap-2 mb-5 p-4 bg-[#3D1620] border border-[#723645] rounded-lg"
        >
          <input
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            placeholder={addPlaceholder}
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
        members={members}
        days={days}
        memberLabel={memberLabel}
        emptyText={emptyText}
        canRename={!readOnly && !!memberActions?.rename}
        canRemove={!readOnly && !!memberActions?.remove}
        editingId={editingId}
        editingName={editingName}
        setEditingId={setEditingId}
        setEditingName={setEditingName}
        saveMemberName={saveMemberName}
        findShift={findShift}
        openShiftModal={openShiftModal}
        removeMember={removeMember}
      />

      <ShiftModal
        open={modalOpen}
        member={modalCtx.member}
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

      <AutofillDialog
        open={!!autofill}
        onClose={() => setAutofill(null)}
        onApply={applyAutofill}
        busy={autofillBusy}
        weekStart={weekStart}
        sourceWeekStart={autofill?.source || weekStart}
        days={days}
        preview={autofill?.preview || []}
        skippedCount={autofill?.skipped || 0}
        overwriteCount={autofill?.overwrite || 0}
      />
    </>
  );
}
