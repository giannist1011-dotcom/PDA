import { useState } from "react";
import SectionHeader from "@/components/shared/SectionHeader";

// ---------------------------------------------------------------------------
// Η ΜΙΑ δομή «Ρυθμίσεων» της πλατφόρμας — OrderDeck (Ρυθμίσεις καταστήματος,
// FleetDeck καταστήματος) και FleetDeck (εταιρία, διανομέας).
//
//   pill nav κατηγοριών στην κορυφή (οριζόντιο scroll σε κινητό)
//   → μία κατηγορία ορατή κάθε φορά
//   → ενότητες με ίδια επικεφαλίδα και ίδια κάρτα
//
// `categories`: [{ key, label, icon, render: () => node }]
// ---------------------------------------------------------------------------

// Ενότητα ρυθμίσεων: επικεφαλίδα + κάρτα περιεχομένου
export function SettingsSection({ icon, title, subtitle, children, tight = false, testId }) {
  return (
    <section data-testid={testId}>
      <SectionHeader icon={icon} title={title} subtitle={subtitle} />
      <div
        className={`${tight ? "px-4" : "p-4 md:p-6"} bg-[#3D1620] border border-[#723645] rounded-lg`}
      >
        {children}
      </div>
    </section>
  );
}

// Γραμμή ρύθμισης μέσα σε `tight` ενότητα: εικονίδιο + τίτλος/περιγραφή
// αριστερά, χειριστήριο δεξιά
export function SettingsRow({ icon: Icon, title, subtitle, children, testId }) {
  return (
    <div
      className="flex items-center gap-3 py-3 border-b border-[#723645]/40 last:border-0"
      data-testid={testId}
    >
      <Icon className="w-5 h-5 text-flame shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm">{title}</div>
        {subtitle && <div className="text-xs text-neutral-500 mt-0.5">{subtitle}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage({
  categories,
  testPrefix = "settings",
  // true όταν η σελίδα ζει μέσα σε flex κέλυφος που δεν κυλά (AppShell)
  scrollable = true,
}) {
  const [cat, setCat] = useState(categories[0]?.key);
  const current = categories.find((c) => c.key === cat) || categories[0];

  return (
    <div
      className={`${
        scrollable ? "flex-1 overflow-y-auto p-4 md:p-8" : ""
      } max-w-[900px] mx-auto w-full`}
    >
      {categories.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {categories.map((c) => {
            const Icon = c.icon;
            const active = current?.key === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                data-testid={`${testPrefix}-cat-${c.key}`}
                className={`shrink-0 flex items-center gap-2 h-10 px-4 rounded-full border text-sm font-bold transition-colors ${
                  active
                    ? "bg-flame/15 text-flame border-flame/50"
                    : "bg-[#3D1620] text-neutral-300 border-[#723645] hover:border-flame/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-8 pb-8">{current?.render()}</div>
    </div>
  );
}
