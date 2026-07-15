import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { pad2, todayISO, formatGRDate } from "@/lib/format";
import { DAY_SHORT } from "@/lib/dates";

// Touch-friendly calendar picker ΕΠΙΛΟΓΗΣ — εμφάνιση DD/MM/YYYY,
// εσωτερική τιμή πάντα ISO "YYYY-MM-DD".
// value: "YYYY-MM-DD" ή "" · onChange(next) · min/max: ISO (προαιρετικά)
// clearable: κουμπί «Καθαρισμός» που κάνει onChange("")

const MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];

const isoOf = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Ημερομηνία",
  className,
  testId,
  clearable = false,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  // [year, month] του προβαλλόμενου μήνα
  const [view, setView] = useState(null);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value || "");
  const baseIso = valid ? value : todayISO();
  const [vy, vm] = view || [
    Number(baseIso.slice(0, 4)),
    Number(baseIso.slice(5, 7)) - 1,
  ];

  const openChange = (v) => {
    setOpen(v);
    if (v) setView(null); // στο άνοιγμα δείξε τον μήνα της τιμής/σήμερα
  };

  const moveMonth = (delta) => {
    const d = new Date(vy, vm + delta, 1);
    setView([d.getFullYear(), d.getMonth()]);
  };

  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const firstDow = (new Date(vy, vm, 1).getDay() + 6) % 7; // Δευτέρα=0
  const today = todayISO();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isDisabled = (iso) => (min && iso < min) || (max && iso > max);

  const pick = (iso) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-testid={testId}
          className={cn(
            "h-9 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-sm font-mono flex items-center justify-center gap-1.5 focus:outline-none focus:border-flame disabled:opacity-50",
            valid ? "text-white" : "text-neutral-500",
            className
          )}
        >
          <CalendarDays className="w-3.5 h-3.5 opacity-60 shrink-0" />
          {valid ? formatGRDate(value) : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-3 bg-[#3D1620] border-[#723645] text-white"
      >
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label="Προηγούμενος μήνας"
            className="h-8 w-8 flex items-center justify-center rounded-md border border-[#723645] text-neutral-300 hover:bg-[#2A0E14]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold">
            {MONTHS[vm]} {vy}
          </span>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label="Επόμενος μήνας"
            className="h-8 w-8 flex items-center justify-center rounded-md border border-[#723645] text-neutral-300 hover:bg-[#2A0E14]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_SHORT.map((d) => (
            <span
              key={d}
              className="h-8 w-9 flex items-center justify-center text-[10px] uppercase tracking-wider text-neutral-500 font-bold"
            >
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (d === null) return <span key={`e${i}`} className="h-9 w-9" />;
            const iso = isoOf(vy, vm, d);
            const dis = isDisabled(iso);
            return (
              <button
                key={iso}
                type="button"
                disabled={dis}
                onClick={() => pick(iso)}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-md text-sm font-mono",
                  iso === value
                    ? "bg-brand text-white font-bold"
                    : dis
                    ? "text-neutral-700"
                    : "text-neutral-200 hover:bg-[#2A0E14]",
                  iso === today && iso !== value && "border border-flame/50"
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 pt-2 border-t border-[#723645]">
          <button
            type="button"
            disabled={isDisabled(today)}
            onClick={() => pick(today)}
            className="text-xs font-bold text-flame hover:underline disabled:opacity-40 disabled:no-underline"
          >
            Σήμερα
          </button>
          {clearable && (
            <button
              type="button"
              onClick={() => pick("")}
              className="text-xs font-bold text-neutral-400 hover:underline"
            >
              Καθαρισμός
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
