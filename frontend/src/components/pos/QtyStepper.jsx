import { Minus, Plus } from "lucide-react";

// Ο ΕΝΑΣ επιλογέας ποσότητας του POS: − / αριθμός / +.
// Ίδιος παντού — γραμμές του δελτίου (διόρθωση) και sheets προσθήκης
// (ορισμός ποσότητας ΠΡΙΝ μπει το προϊόν). size="lg" για τα sheets.
export default function QtyStepper({
  value,
  onDecrement,
  onIncrement,
  min = 1,
  size = "sm",
  decrementTestId,
  valueTestId,
  incrementTestId,
}) {
  const lg = size === "lg";
  const btn = lg ? "w-14 h-14" : "w-10 h-10";
  const icon = lg ? "w-6 h-6" : "w-4 h-4";
  const num = lg ? "w-16 text-3xl" : "w-8 text-lg";

  return (
    <div className="inline-flex items-center gap-2 bg-[#2A0E14] border border-[#723645] rounded-md p-1">
      <button
        type="button"
        onClick={onDecrement}
        disabled={value <= min}
        data-testid={decrementTestId}
        className={`${btn} rounded flex items-center justify-center text-white hover:bg-[#4A1B27] active:scale-95 disabled:opacity-40 no-select`}
      >
        <Minus className={icon} />
      </button>
      <span
        className={`${num} text-center font-mono font-bold tabular-nums`}
        data-testid={valueTestId}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        data-testid={incrementTestId}
        className={`${btn} rounded flex items-center justify-center text-white hover:bg-[#4A1B27] active:scale-95 no-select`}
      >
        <Plus className={icon} />
      </button>
    </div>
  );
}
