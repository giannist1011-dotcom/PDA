import { ArrowUp, ArrowDown, Minus as MinusIcon } from "lucide-react";

const ChangeBadge = ({ value, testId }) => {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "" : "±";
  const cls =
    rounded > 0
      ? "text-[#00E676] bg-[#00E676]/10 border-[#00E676]/40"
      : rounded < 0
        ? "text-[#FF6961] bg-[#FF3B30]/10 border-[#FF3B30]/40"
        : "text-neutral-400 bg-[#3D1620] border-[#723645]";
  const Icon = rounded > 0 ? ArrowUp : rounded < 0 ? ArrowDown : MinusIcon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-mono font-bold ${cls}`}
      data-testid={testId}
    >
      <Icon className="w-3 h-3" />
      {sign}
      {rounded.toString().replace(".", ",")}%
    </span>
  );
};

export default ChangeBadge;
