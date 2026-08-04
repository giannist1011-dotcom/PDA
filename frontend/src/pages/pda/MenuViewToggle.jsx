import { LayoutGrid, List } from "lucide-react";

const VIEWS = [
  { id: "list", label: "Λίστα", Icon: List },
  { id: "grid", label: "Πλέγμα", Icon: LayoutGrid },
];

// Προβολή προϊόντων («Λίστα»/«Πλέγμα») — ζει στη γραμμή εργαλείων της σελίδας,
// δίπλα στις καρτέλες παραγγελιών. Η επιλογή μένει αποθηκευμένη ανά συσκευή/προφίλ.
export default function MenuViewToggle({ value, onChange, className = "" }) {
  return (
    <div className={`gap-1.5 ${className}`} data-testid="menu-view-toggle">
      {VIEWS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            data-testid={`menu-view-${id}`}
            data-state={active ? "on" : "off"}
            className={`h-10 px-3 flex items-center gap-1.5 rounded-md text-xs font-bold border transition-colors no-select ${
              active
                ? "bg-flame text-white border-flame"
                : "bg-[#4A1B27] text-neutral-300 border-[#723645] hover:border-flame"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
