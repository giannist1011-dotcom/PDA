import { useEffect, useState } from "react";
import {
  Sunrise,
  Moon,
  CheckCircle2,
  Circle,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Settings2,
  History as HistoryIcon,
  ListChecks,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  apiChecklistToday,
  apiChecklistTick,
  apiChecklistCreateTemplate,
  apiChecklistUpdateTemplate,
  apiChecklistDeleteTemplate,
  apiChecklistReorder,
  apiChecklistHistory,
} from "@/lib/api";
import { formatGRTime } from "@/lib/format";

const LIST_META = {
  open: { label: "Άνοιγμα", icon: Sunrise, color: "text-gold" },
  close: { label: "Κλείσιμο", icon: Moon, color: "text-flame" },
};

const fmtDateGR = (iso) => {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("el-GR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
};

// ---------- Λίστα χρήσης (τικάρισμα) ----------
function TickList({ list, items, onTick, busyId }) {
  const meta = LIST_META[list];
  const Icon = meta.icon;
  const done = items.filter((i) => i.done).length;
  return (
    <div className="bg-[#3D1620] border border-[#723645] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#723645]">
        <div className="flex items-center gap-2 font-heading font-semibold text-lg">
          <Icon className={`w-5 h-5 ${meta.color}`} />
          {meta.label}
        </div>
        <span
          className={`font-mono text-sm font-bold ${
            items.length > 0 && done === items.length ? "text-[#00E676]" : "text-neutral-400"
          }`}
          data-testid={`checklist-count-${list}`}
        >
          {done}/{items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-neutral-500 text-sm px-4">
          Δεν έχουν οριστεί εργασίες. Ο ιδιοκτήτης τις προσθέτει από τη «Διαχείριση».
        </div>
      ) : (
        <div className="divide-y divide-[#431A25]">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => onTick(it)}
              disabled={busyId === it.id}
              data-testid={`checklist-item-${it.id}`}
              className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-[#4A1B27] transition-colors disabled:opacity-60"
            >
              {it.done ? (
                <CheckCircle2 className="w-6 h-6 text-[#00E676] shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-6 h-6 text-neutral-500 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={`font-semibold ${
                    it.done ? "text-neutral-400 line-through" : "text-white"
                  }`}
                >
                  {it.text}
                </div>
                {it.done && (
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {it.done_by} · {formatGRTime(it.done_at)}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Διαχείριση (owner) ----------
function ManageList({ list, items, onChanged }) {
  const meta = LIST_META[list];
  const Icon = meta.icon;
  const [newText, setNewText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const text = newText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await apiChecklistCreateTemplate(list, text);
      setNewText("");
      await onChanged();
    } catch {
      toast.error("Σφάλμα προσθήκης");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    const text = editText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await apiChecklistUpdateTemplate(editId, text);
      setEditId(null);
      await onChanged();
    } catch {
      toast.error("Σφάλμα αποθήκευσης");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (it) => {
    if (!window.confirm(`Διαγραφή «${it.text}»;`)) return;
    setBusy(true);
    try {
      await apiChecklistDeleteTemplate(it.id);
      await onChanged();
    } catch {
      toast.error("Σφάλμα διαγραφής");
    } finally {
      setBusy(false);
    }
  };

  const move = async (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length || busy) return;
    const ids = items.map((i) => i.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setBusy(true);
    try {
      await apiChecklistReorder(list, ids);
      await onChanged();
    } catch {
      toast.error("Σφάλμα αναδιάταξης");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#3D1620] border border-[#723645] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#723645] font-heading font-semibold text-lg">
        <Icon className={`w-5 h-5 ${meta.color}`} />
        {meta.label}
      </div>
      <div className="divide-y divide-[#431A25]">
        {items.map((it, idx) => (
          <div key={it.id} className="flex items-center gap-2 px-3 py-2.5">
            {editId === it.id ? (
              <>
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  autoFocus
                  className="flex-1 min-w-0 h-10 px-3 rounded-md bg-[#2A0E14] border border-[#723645] text-white focus:border-flame outline-none"
                  data-testid={`checklist-edit-input-${it.id}`}
                />
                <button
                  onClick={saveEdit}
                  data-testid={`checklist-edit-save-${it.id}`}
                  className="w-10 h-10 shrink-0 rounded-md bg-[#00E676]/15 text-[#00E676] flex items-center justify-center"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="w-10 h-10 shrink-0 rounded-md border border-[#723645] text-neutral-400 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0 || busy}
                    aria-label="Πάνω"
                    className="w-8 h-5 flex items-center justify-center text-neutral-500 hover:text-white disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    disabled={idx === items.length - 1 || busy}
                    aria-label="Κάτω"
                    className="w-8 h-5 flex items-center justify-center text-neutral-500 hover:text-white disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <span className="flex-1 min-w-0 text-white font-semibold truncate">
                  {it.text}
                </span>
                <button
                  onClick={() => {
                    setEditId(it.id);
                    setEditText(it.text);
                  }}
                  data-testid={`checklist-edit-btn-${it.id}`}
                  className="w-10 h-10 shrink-0 rounded-md border border-[#723645] text-neutral-300 hover:border-flame flex items-center justify-center"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove(it)}
                  data-testid={`checklist-delete-btn-${it.id}`}
                  className="w-10 h-10 shrink-0 rounded-md border border-[#723645] text-neutral-300 hover:border-[#FF3B30] hover:text-[#FF3B30] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-3 border-t border-[#723645]">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Νέα εργασία (π.χ. Άναψε τη σχάρα)"
          data-testid={`checklist-add-input-${list}`}
          className="flex-1 min-w-0 h-11 px-3 rounded-md bg-[#2A0E14] border border-[#723645] text-white placeholder-neutral-600 focus:border-flame outline-none"
        />
        <button
          onClick={add}
          disabled={!newText.trim() || busy}
          data-testid={`checklist-add-btn-${list}`}
          className="h-11 px-4 shrink-0 rounded-md bg-flame text-white font-bold flex items-center gap-1.5 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Προσθήκη</span>
        </button>
      </div>
    </div>
  );
}

// ---------- Ιστορικό (owner) ----------
function HistoryTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiChecklistHistory(14)
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error)
    return <div className="text-[#FF3B30] p-4">Σφάλμα φόρτωσης ιστορικού</div>;
  if (!data) return <div className="text-neutral-500 p-4">Φόρτωση…</div>;
  if (data.days.length === 0)
    return (
      <div className="py-12 text-center text-neutral-500">
        Δεν υπάρχει ακόμη ιστορικό — θα εμφανιστεί μόλις τικαριστούν εργασίες.
      </div>
    );

  return (
    <div className="space-y-4">
      {data.days.map((day) => (
        <div
          key={day.date}
          className="bg-[#3D1620] border border-[#723645] rounded-lg overflow-hidden"
          data-testid={`checklist-history-${day.date}`}
        >
          <div className="px-4 py-3 border-b border-[#723645] font-heading font-semibold capitalize">
            {fmtDateGR(day.date)}
            <span className="ml-2 font-mono text-xs text-neutral-500">{day.date}</span>
          </div>
          <div className="divide-y divide-[#431A25]">
            {["open", "close"].map((list) => {
              const ticks = day.ticks.filter((t) => t.list === list);
              const missing = day.missing.filter((m) => m.list === list);
              if (ticks.length === 0 && missing.length === 0) return null;
              const meta = LIST_META[list];
              const Icon = meta.icon;
              return (
                <div key={list} className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-neutral-300 mb-2">
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                    {meta.label}
                    <span className="font-mono text-xs text-neutral-500">
                      {ticks.length}/{ticks.length + missing.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {ticks.map((t) => (
                      <div key={t.template_id} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
                        <span className="text-neutral-200 flex-1 min-w-0">{t.text}</span>
                        <span className="text-xs text-neutral-500 shrink-0">
                          {t.by} · {formatGRTime(t.at)}
                        </span>
                      </div>
                    ))}
                    {missing.map((m) => (
                      <div key={m.id} className="flex items-start gap-2 text-sm">
                        <Circle className="w-4 h-4 text-[#FF6961] shrink-0 mt-0.5" />
                        <span className="text-neutral-500 flex-1 min-w-0">{m.text}</span>
                        <span className="text-xs text-[#FF6961] shrink-0 font-bold">
                          Δεν έγινε
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Σελίδα ----------
export default function Checklist() {
  const { role } = useAuth();
  const isOwner = role === "owner";
  const [tab, setTab] = useState("today"); // today | manage | history
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const d = await apiChecklistToday();
      setData(d);
      setError(false);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onTick = async (it) => {
    setBusyId(it.id);
    try {
      await apiChecklistTick(it.id, !it.done);
      await load();
    } catch {
      toast.error("Σφάλμα — δοκίμασε ξανά");
    } finally {
      setBusyId(null);
    }
  };

  const items = data?.items ?? [];
  const openItems = items.filter((i) => i.list === "open");
  const closeItems = items.filter((i) => i.list === "close");

  const tabs = [
    { key: "today", label: "Σήμερα", icon: ListChecks },
    ...(isOwner
      ? [
          { key: "manage", label: "Διαχείριση", icon: Settings2 },
          { key: "history", label: "Ιστορικό", icon: HistoryIcon },
        ]
      : []),
  ];

  return (
    <AppShell title="Checklist">
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-[900px] mx-auto w-full">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="text-sm text-neutral-400">
            Checklist ανοίγματος & κλεισίματος
            {data?.date && (
              <span className="ml-2 font-mono text-neutral-500">· {data.date}</span>
            )}
          </div>
          {tabs.length > 1 && (
            <div className="flex gap-1 bg-[#3D1620] border border-[#723645] rounded-md p-1">
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    data-testid={`checklist-tab-${t.key}`}
                    className={`h-9 px-3 rounded text-sm font-bold flex items-center gap-1.5 transition-colors ${
                      tab === t.key
                        ? "bg-flame text-white"
                        : "text-neutral-300 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 mb-6 border border-[#FF3B30] bg-[#FF3B30]/10 rounded-md text-[#FF3B30]">
            Σφάλμα φόρτωσης — δοκίμασε ανανέωση.
          </div>
        )}

        {tab === "today" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TickList list="open" items={openItems} onTick={onTick} busyId={busyId} />
            <TickList list="close" items={closeItems} onTick={onTick} busyId={busyId} />
          </div>
        )}

        {tab === "manage" && isOwner && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ManageList list="open" items={openItems} onChanged={load} />
            <ManageList list="close" items={closeItems} onChanged={load} />
          </div>
        )}

        {tab === "history" && isOwner && <HistoryTab />}
      </main>
    </AppShell>
  );
}
