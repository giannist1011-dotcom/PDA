import { ChevronDown, X } from "lucide-react";
import { Link } from "react-router-dom";

// ---------------------------------------------------------------------------
// ΤΟ burger menu της πλατφόρμας — ένα component για OrderDeck (AppShell) και
// FleetDeck (FleetShell: εταιρία, μαγαζί, διανομέας). Ίδια θέση, ίδιο πλάτος,
// ίδιο animation, ίδια τυπογραφία/εικονίδια, ίδιο ενεργό state.
//
// Σειρά λογικής παντού: λειτουργίες πάνω → ομάδες → ενέργειες λογαριασμού →
// «Ρυθμίσεις» τελευταία στη λίστα λειτουργιών → Αποσύνδεση στο footer.
// ---------------------------------------------------------------------------

// Το ΕΝΑ σχήμα κουμπιού/συνδέσμου του drawer
export const DRAWER_ROW =
  "w-full flex items-center gap-3 px-4 py-3 rounded-md mb-1 transition-colors border";
const IDLE = "text-neutral-200 hover:bg-[#3D1620] border-transparent";
const ACTIVE = "bg-flame/15 text-flame border-flame/40";

export const DRAWER_BTN = `${DRAWER_ROW} ${IDLE} disabled:opacity-60`;

export function DrawerLink({ to, label, icon: Icon, active = false, testId, onClick, trailing }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      data-testid={testId}
      className={`${DRAWER_ROW} ${active ? ACTIVE : IDLE}`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-semibold">{label}</span>
      {trailing}
    </Link>
  );
}

export function DrawerButton({
  label,
  icon: Icon,
  onClick,
  testId,
  disabled = false,
  iconClass = "",
  trailing,
}) {
  return (
    <button onClick={onClick} disabled={disabled} data-testid={testId} className={DRAWER_BTN}>
      <Icon className={`w-5 h-5 ${iconClass}`} />
      <span className="font-semibold">{label}</span>
      {trailing}
    </button>
  );
}

// Ετικέτα ομάδας ενεργειών (π.χ. «Προφίλ»)
export function DrawerSectionLabel({ children }) {
  return (
    <div className="px-4 pt-1 pb-2 text-[10px] uppercase tracking-widest font-bold text-neutral-500">
      {children}
    </div>
  );
}

// Ομάδα συνδέσμων που ανοίγει/κλείνει (π.χ. «Κατάστημα» στο OrderDeck)
export function DrawerGroup({ label, icon: Icon, open, onToggle, active, testId, children }) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        data-testid={testId}
        aria-expanded={open}
        className={`${DRAWER_ROW} border-transparent hover:bg-[#3D1620] ${
          active && !open ? "text-flame" : "text-neutral-200"
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-semibold flex-1 text-left">{label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="ml-4 pl-3 border-l border-[#723645]">{children}</div>}
    </div>
  );
}

export default function NavDrawer({
  open,
  onClose,
  // { mark: node, name: string, badge: node }
  brand,
  testIdPrefix = "drawer",
  children,
  footer,
}) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm pk-fade-in"
        onClick={onClose}
        data-testid={`${testIdPrefix}-backdrop`}
      />
      <aside
        className="fixed left-0 top-0 bottom-0 z-50 w-[320px] bg-[#2A0E14] border-r border-[#723645] flex flex-col pk-drawer-in"
        data-testid={testIdPrefix}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-[#723645]">
          <div className="flex items-center gap-3 min-w-0">
            {brand?.mark}
            <div className="min-w-0">
              <div className="font-heading text-lg font-bold leading-tight truncate">
                {brand?.name}
              </div>
              {brand?.badge && <div className="mt-0.5">{brand.badge}</div>}
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid={`${testIdPrefix}-close-btn`}
            className="w-10 h-10 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">{children}</nav>
        {footer && <div className="p-3 border-t border-[#723645]">{footer}</div>}
      </aside>
    </>
  );
}
