import { LayoutGrid, List } from "lucide-react";

const VIEWS = [
  { id: "list", label: "Λίστα", Icon: List },
  { id: "grid", label: "Πλέγμα", Icon: LayoutGrid },
];

// Προβολή προϊόντων («Λίστα»/«Πλέγμα») — inline ΔΕΞΙΑ στη ΓΡΑΜΜΗ ΤΗΣ ΑΝΑΖΗΤΗΣΗΣ
// προϊόντων (δεν παίρνει δική του σειρά). Ίδιο ύψος με το πεδίο (h-10).
// Κάτω από md μένουν μόνο τα εικονίδια, ώστε να μη στενεύει η αναζήτηση σε
// tablet portrait. Η επιλογή μένει αποθηκευμένη ανά συσκευή/προφίλ.
export default function MenuViewToggle({ value, onChange, className = "" }) {
  return (
    <div className={`flex gap-1.5 shrink-0 ${className}`} data-testid="menu-view-toggle">
      {VIEWS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            data-testid={`menu-view-${id}`}
            data-state={active ? "on" : "off"}
            title={label}
            aria-label={label}
            className={`h-10 px-2.5 md:px-3 flex items-center gap-1.5 rounded-md text-xs font-bold border transition-colors no-select ${
              active
                ? "bg-flame text-white border-flame"
                : "bg-[#4A1B27] text-neutral-300 border-[#723645] hover:border-flame"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden md:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
