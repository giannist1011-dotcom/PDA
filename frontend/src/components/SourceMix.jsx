import { PieChart } from "lucide-react";
import { eur } from "@/lib/format";
import { SOURCE_COLORS } from "@/lib/platforms";

// Μείγμα προέλευσης (ταμείο vs πλατφόρμες) — στοιβαγμένη μπάρα με υπόμνημα.
// Εμφανίζεται ΜΟΝΟ στην «all-around» προβολή, όπου έχει νόημα η αναλογία.
export default function SourceMix({ mix, title = "Μείγμα προέλευσης" }) {
  const rows = (mix || []).filter((r) => r.count > 0);
  if (rows.length < 2) return null;

  return (
    <div
      className="p-5 bg-[#3D1620] border border-[#723645] rounded-lg"
      data-testid="source-mix"
    >
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="w-4 h-4 text-flame" />
        <h2 className="font-heading font-semibold text-lg">{title}</h2>
      </div>

      <div className="flex h-4 rounded-full overflow-hidden bg-[#2A0E14] mb-4">
        {rows.map((r) => (
          <div
            key={r.key}
            title={`${r.label}: ${r.share}%`}
            data-testid={`source-mix-bar-${r.key}`}
            style={{ width: `${r.share}%`, backgroundColor: SOURCE_COLORS[r.key] || "#723645" }}
          />
        ))}
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center justify-between gap-3"
            data-testid={`source-mix-row-${r.key}`}
          >
            <span className="flex items-center gap-2 text-neutral-200 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: SOURCE_COLORS[r.key] || "#723645" }}
              />
              {r.label}
            </span>
            <span className="font-mono text-sm">
              <span className="text-neutral-500 mr-2">{r.count} παρ.</span>
              <span className="text-gold font-bold mr-2">{eur(r.revenue)}</span>
              <span className="text-neutral-400">{r.share}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
