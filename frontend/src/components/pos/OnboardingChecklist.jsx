// Checklist πρώτων βημάτων νέου μαγαζιού (owner) — αυτόματο τικάρισμα από το backend.
// Εξαφανίζεται όταν ολοκληρωθούν όλα ή όταν πατηθεί «Απόκρυψη».
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Rocket, X } from "lucide-react";
import { apiOnboardingStatus, apiOnboardingHide } from "@/lib/api";

const STEPS = [
  { key: "logo", label: "Ανέβασε λογότυπο", to: "/app/settings" },
  { key: "details", label: "Όρισε στοιχεία & τοποθεσία καταστήματος", to: "/app/settings" },
  { key: "menu", label: "Έλεγξε/προσάρμοσε το μενού σου", to: "/app/menu" },
  { key: "pins", label: "Άλλαξε τα PIN", to: "/app/settings" },
  { key: "profiles", label: "Πρόσθεσε προφίλ υπαλλήλων", to: "/app/settings" },
  { key: "print", label: "Δοκίμασε μια εκτύπωση", to: "/app" },
  { key: "catalog", label: "Ενεργοποίησε τον δημόσιο κατάλογο", to: "/app/settings" },
];

export default function OnboardingChecklist() {
  const [status, setStatus] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    apiOnboardingStatus()
      .then(setStatus)
      .catch(() => {});
  }, []);

  if (!status || status.hidden || hidden || status.done >= status.total) return null;

  const hide = () => {
    setHidden(true);
    apiOnboardingHide().catch(() => {});
  };

  return (
    <div
      className="p-5 md:p-6 mb-6 bg-[#3D1620] border border-[#723645] rounded-lg"
      data-testid="onboarding-checklist"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-flame" />
          <h2 className="font-heading font-semibold text-lg">Πρώτα βήματα</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold text-gold" data-testid="onboarding-progress">
            {status.done}/{status.total} ολοκληρώθηκαν
          </span>
          <button
            type="button"
            onClick={hide}
            title="Απόκρυψη"
            data-testid="onboarding-hide"
            className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:bg-[#2A0E14] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-[#2A0E14] border border-[#431A25] overflow-hidden mb-4">
        <div
          className="h-full bg-flame rounded-full transition-all"
          style={{ width: `${Math.round((status.done / status.total) * 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {STEPS.map((s) => {
          const done = !!status.steps?.[s.key];
          return (
            <Link
              key={s.key}
              to={s.to}
              data-testid={`onboarding-step-${s.key}`}
              className={`flex items-center gap-2.5 p-3 bg-[#2A0E14] border border-[#431A25] rounded-md transition-colors ${
                done ? "opacity-60" : "hover:border-flame"
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-neutral-500 shrink-0" />
              )}
              <span
                className={`text-sm font-semibold ${
                  done ? "text-neutral-400 line-through" : "text-neutral-200"
                }`}
              >
                {s.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
