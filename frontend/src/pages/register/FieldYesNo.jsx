export const Field = ({ label, optional, children, hint }) => (
  <div>
    <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
      {label}
      {optional && <span className="text-neutral-600 normal-case tracking-normal font-normal"> (προαιρετικό)</span>}
    </label>
    <div className="mt-1">{children}</div>
    {hint && <div className="text-xs text-neutral-500 mt-1">{hint}</div>}
  </div>
);

export function YesNo({ value, onChange, testId }) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-1">
      {[
        { v: true, label: "Ναι" },
        { v: false, label: "Όχι" },
      ].map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          data-testid={`${testId}-${o.v ? "yes" : "no"}`}
          className={`h-12 rounded-md border font-bold transition-colors ${
            value === o.v
              ? "bg-brand border-brand text-white"
              : "bg-[#2A0E14] border-[#723645] text-neutral-300 hover:border-flame"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
