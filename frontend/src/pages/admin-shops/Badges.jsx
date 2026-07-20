const STATUS_BADGE = {
  active: ["Ενεργό", "bg-emerald-500/15 text-emerald-400"],
  disabled: ["Ανενεργό", "bg-[#FF3B30]/15 text-[#FF6961]"],
  demo: ["Demo", "bg-gold/15 text-gold"],
};

// Ποσοστό onboarding μαγαζιού — μίνι progress bar + %
export const OnboardingCell = ({ onboarding }) => {
  if (!onboarding) return <span className="text-neutral-500">—</span>;
  const pct = onboarding.percent ?? 0;
  const color = pct >= 100 ? "bg-emerald-400" : pct >= 50 ? "bg-gold" : "bg-[#FF6961]";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 rounded-full bg-[#2A0E14] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-neutral-300">{pct}%</span>
    </div>
  );
};

export const StatusBadge = ({ status }) => {
  const [label, cls] = STATUS_BADGE[status] || [status, "bg-neutral-500/15 text-neutral-400"];
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};
