import { LogOut, Menu } from "lucide-react";

// ---------------------------------------------------------------------------
// Το ΕΝΑ header των δύο εφαρμογών (OrderDeck AppShell & FleetDeck FleetShell):
// burger αριστερά → σήμα/όνομα λογαριασμού → τίτλος σελίδας → καρτέλες σελίδας
// → ενέργειες → badge προφίλ δεξιά. Οι καρτέλες ζουν ΜΕΣΑ στο header: από lg
// δίπλα στον τίτλο, σε στενότερα πλάτη πέφτουν σε μία λεπτή δεύτερη γραμμή.
// ---------------------------------------------------------------------------
export default function ShellHeader({
  onBurger,
  burgerTestId = "burger-btn",
  // σήμα λογαριασμού (λογότυπο ή εικονίδιο επιχείρησης)
  mark,
  name,
  nameTestId,
  title,
  tabs = null,
  actions = null,
  badge = null,
}) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-2 sm:gap-x-3 px-4 md:px-6 border-b border-[#723645] bg-[#2A0E14] shrink-0">
      <div className="order-1 flex items-center gap-2 sm:gap-3 min-w-0 h-14 lg:h-16">
        <button
          onClick={onBurger}
          data-testid={burgerTestId}
          aria-label="Μενού"
          className="w-11 h-11 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center text-white transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {mark}
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="font-heading text-lg lg:text-xl xl:text-2xl font-bold tracking-tight truncate"
              data-testid={nameTestId}
            >
              {name}
            </span>
            {title && (
              <span className="text-xs uppercase tracking-widest text-neutral-500 hidden sm:inline shrink-0">
                · {title}
              </span>
            )}
          </div>
        </div>
      </div>
      {tabs && (
        <div
          className="order-3 lg:order-2 w-full lg:w-auto lg:flex-1 min-w-0 pb-1.5 lg:pb-0 lg:h-16 flex items-center overflow-x-auto no-scrollbar"
          data-testid="header-tabs"
        >
          {tabs}
        </div>
      )}
      <div className="order-2 lg:order-3 ml-auto flex items-center gap-2 shrink-0 h-14 lg:h-16">
        {actions}
        {badge && (
          <div className="hidden sm:flex items-center" data-testid="profile-badge">
            {badge}
          </div>
        )}
      </div>
    </header>
  );
}

// Badge προφίλ/ρόλου — ίδιο σχήμα σε OrderDeck και FleetDeck
export function RoleBadge({ color = "#888", icon: Icon, children, testId }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest"
      style={{ backgroundColor: `${color}26`, color }}
      data-testid={testId}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}

// Το κουμπί «Αποσύνδεση» του drawer footer — ίδιο και στις δύο εφαρμογές
export function LogoutButton({ onClick, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-neutral-300 hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] border border-[#723645] hover:border-[#FF3B30] transition-colors"
    >
      <LogOut className="w-5 h-5" />
      <span className="font-semibold">Αποσύνδεση</span>
    </button>
  );
}
