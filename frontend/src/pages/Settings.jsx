import { useState } from "react";
import { Users, Globe, Store, CreditCard, SlidersHorizontal, LayoutGrid, Printer } from "lucide-react";
import AppShell from "@/components/AppShell";
import StoreDetailsSettings from "@/components/StoreDetailsSettings";
import ProfilesManager from "@/components/ProfilesManager";
import PublicMenuSettings from "@/components/PublicMenuSettings";
import PrintingSettings from "@/components/PrintingSettings";
import TablesSettings from "./settings/TablesSettings";
import SubscriptionSettings from "./settings/SubscriptionSettings";

// Κατηγορίες ρυθμίσεων — pill nav στην κορυφή, μία κατηγορία ορατή κάθε φορά
const CATEGORIES = [
  { key: "store", label: "Στοιχεία καταστήματος", icon: Store },
  { key: "catalog", label: "Κατάλογος", icon: Globe },
  { key: "staff", label: "Προσωπικό", icon: Users },
  { key: "subscription", label: "Συνδρομή", icon: CreditCard },
  { key: "misc", label: "Λοιπά", icon: SlidersHorizontal },
];

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-6 h-6 text-flame" />
          <h2 className="font-heading text-2xl font-bold">{title}</h2>
        </div>
        {subtitle && <p className="text-sm text-neutral-400">{subtitle}</p>}
      </div>
      <div className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg">{children}</div>
    </section>
  );
}

export default function Settings() {
  const [cat, setCat] = useState("store");

  return (
    <AppShell title="Ρυθμίσεις">
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-[900px] mx-auto w-full">
        {/* Pill nav κατηγοριών — οριζόντιο scroll σε κινητό */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                data-testid={`settings-cat-${c.key}`}
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

        <div className="space-y-8 pb-8">
          {cat === "store" && (
            <Section
              icon={Store}
              title="Στοιχεία καταστήματος"
              subtitle="Όνομα, τηλέφωνο, πόλη, διεύθυνση και pin χάρτη, ζώνη διανομής, ωράριο και Google reviews"
            >
              <StoreDetailsSettings />
            </Section>
          )}

          {cat === "catalog" && (
            <Section
              icon={Globe}
              title="Κατάλογος"
              subtitle="Λογότυπο και δημόσια σελίδα μενού με σύνδεσμο και QR κώδικα για τους πελάτες σας"
            >
              <PublicMenuSettings />
            </Section>
          )}

          {cat === "staff" && (
            <Section
              icon={Users}
              title="Προσωπικό"
              subtitle="Προφίλ με όνομα, ρόλο, PIN και δικαιώματα λειτουργιών ανά προφίλ"
            >
              <ProfilesManager />
            </Section>
          )}

          {cat === "subscription" && (
            <Section
              icon={CreditCard}
              title="Συνδρομή"
              subtitle="Το πλάνο σας και τα πρόσθετα — οι αλλαγές εγκρίνονται από την ομάδα του OrderDeck"
            >
              <SubscriptionSettings />
            </Section>
          )}

          {cat === "misc" && (
            <>
              <Section
                icon={LayoutGrid}
                title="Τραπέζια"
                subtitle="Ενεργοποιήστε τη λειτουργία και ορίστε τα τραπέζια του καταστήματος"
              >
                <TablesSettings />
              </Section>
              <Section
                icon={Printer}
                title="Εκτύπωση"
                subtitle="Αντίγραφα ανά παραγγελία και ταυτόχρονη εκτύπωση σε δεύτερο εκτυπωτή"
              >
                <PrintingSettings />
              </Section>
            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}
