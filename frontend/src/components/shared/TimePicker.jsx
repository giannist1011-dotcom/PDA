import { useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { pad2 } from "@/lib/format";

// Touch-friendly time picker ΕΠΙΛΟΓΗΣ (όχι πληκτρολόγησης):
// δύο scrollable στήλες — Ώρες 00-23 και Λεπτά ανά 5' — πάντα 24ωρο.
// value: "HH:MM" ή "" · onChange(next: "HH:MM")

const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const ITEM_H = 36; // h-9

const buildMinutes = (currentMm) => {
  const base = Array.from({ length: 12 }, (_, i) => pad2(i * 5));
  if (currentMm && !base.includes(currentMm)) {
    base.push(currentMm);
    base.sort();
  }
  return base;
};

function Column({ items, selected, onPick, testId }) {
  // scroll στην επιλεγμένη τιμή μόνο μία φορά, στο άνοιγμα του popover
  const scrolled = useRef(false);
  const scrollRef = (el) => {
    if (!el || scrolled.current) return;
    scrolled.current = true;
    const idx = items.indexOf(selected);
    if (idx >= 0) {
      el.scrollTop = idx * ITEM_H - el.clientHeight / 2 + ITEM_H / 2;
    }
  };

  return (
    <div
      ref={scrollRef}
      className="h-48 w-16 overflow-y-auto overscroll-contain rounded-md border border-[#723645] bg-[#2A0E14]"
      data-testid={testId}
    >
      {items.map((it) => (
        <button
          key={it}
          type="button"
          onClick={() => onPick(it)}
          className={cn(
            "w-full h-9 flex items-center justify-center text-sm font-mono",
            it === selected
              ? "bg-brand text-white font-bold"
              : "text-neutral-300 hover:bg-[#3D1620]"
          )}
        >
          {it}
        </button>
      ))}
    </div>
  );
}

export default function TimePicker({
  value,
  onChange,
  placeholder = "Ώρα",
  className,
  testId,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const m = /^(\d{2}):(\d{2})$/.exec(value || "");
  const hh = m ? m[1] : "";
  const mm = m ? m[2] : "";
  const minutes = buildMinutes(mm);

  const pickHour = (h) => onChange(`${h}:${mm || "00"}`);
  const pickMinute = (min) => {
    onChange(`${hh || pad2(new Date().getHours())}:${min}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-testid={testId}
          className={cn(
            "h-9 px-2 bg-[#2A0E14] border border-[#723645] rounded-md text-sm font-mono flex items-center justify-center gap-1.5 focus:outline-none focus:border-flame disabled:opacity-50",
            value ? "text-white" : "text-neutral-500",
            className
          )}
        >
          <Clock className="w-3.5 h-3.5 opacity-60 shrink-0" />
          {value || placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-2 bg-[#3D1620] border-[#723645] text-white"
      >
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 text-center font-bold">
              Ώρες
            </span>
            <Column items={HOURS} selected={hh} onPick={pickHour} testId={testId ? `${testId}-hours` : undefined} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 text-center font-bold">
              Λεπτά
            </span>
            <Column items={minutes} selected={mm} onPick={pickMinute} testId={testId ? `${testId}-minutes` : undefined} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
