import { Trash2, X } from "lucide-react";
import { formatGRDayMonth } from "@/lib/format";

// Εβδομαδιαίο πλέγμα: μέλη × ημέρες. Κοινό σε OrderDeck (υπάλληλοι) και
// FleetDeck (διαχειριστής + διανομείς) — η μετονομασία/διαγραφή μέλους
// εμφανίζεται μόνο όταν η επιφάνεια τη δίνει (memberActions).
export default function ScheduleGrid({
  loading,
  members,
  days,
  memberLabel = "Υπάλληλος",
  emptyText = "Δεν έχετε προσθέσει υπαλλήλους ακόμα",
  canRename = false,
  canRemove = false,
  editingId,
  editingName,
  setEditingId,
  setEditingName,
  saveMemberName,
  findShift,
  openShiftModal,
  removeMember,
}) {
  return loading ? (
    <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
  ) : members.length === 0 ? (
    <div className="text-neutral-500 py-16 text-center bg-[#3D1620] border border-[#723645] rounded-lg">
      {emptyText}
    </div>
  ) : (
    <div className="overflow-x-auto bg-[#3D1620] border border-[#723645] rounded-lg">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="border-b border-[#723645]">
            <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-neutral-400 font-bold w-48">
              {memberLabel}
            </th>
            {days.map((d) => (
              <th
                key={d.idx}
                className="text-center px-2 py-3 text-xs uppercase tracking-widest text-neutral-400 font-bold"
              >
                <div>{d.short}</div>
                <div className="font-mono text-[10px] text-neutral-600 font-normal">
                  {formatGRDayMonth(d.date)}
                </div>
              </th>
            ))}
            {canRemove && <th className="w-12"></th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.id}
              className="border-b border-[#431A25] last:border-0"
              data-testid={`emp-row-${m.id}`}
            >
              <td className="px-4 py-3">
                {canRename && editingId === m.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => saveMemberName(m.id)}
                      onKeyDown={(e) => e.key === "Enter" && saveMemberName(m.id)}
                      autoFocus
                      className="h-9 px-2 bg-[#2A0E14] border border-flame rounded text-white text-sm w-full"
                    />
                    <button onClick={() => setEditingId(null)} className="p-1 text-neutral-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : canRename ? (
                  <button
                    onClick={() => {
                      setEditingId(m.id);
                      setEditingName(m.name);
                    }}
                    className="text-left font-semibold text-white hover:text-flame"
                    data-testid={`emp-name-${m.id}`}
                  >
                    {m.name}
                  </button>
                ) : (
                  <div data-testid={`emp-name-${m.id}`}>
                    <div className="font-semibold text-white truncate">{m.name}</div>
                    {m.sub && (
                      <div className="text-[11px] text-neutral-500 truncate">{m.sub}</div>
                    )}
                  </div>
                )}
              </td>
              {days.map((d) => {
                const sh = findShift(m.id, d.idx);
                return (
                  <td key={d.idx} className="px-2 py-2 text-center">
                    <button
                      onClick={() => openShiftModal(m, d.idx)}
                      data-testid={`cell-${m.id}-${d.idx}`}
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
              {canRemove && (
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={() => removeMember(m.id)}
                    data-testid={`del-emp-${m.id}`}
                    className="p-2 text-neutral-500 hover:text-[#FF3B30]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
