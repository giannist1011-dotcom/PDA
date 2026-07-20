import { Trash2, X } from "lucide-react";
import { formatGRDayMonth } from "@/lib/format";

// Weekly schedule grid: employees x days
export default function ScheduleGrid({
  loading,
  employees,
  days,
  editingId,
  editingName,
  setEditingId,
  setEditingName,
  saveEmployeeName,
  findShift,
  openShiftModal,
  removeEmployee,
}) {
  return loading ? (
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
                  {formatGRDayMonth(d.date)}
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
  );
}
