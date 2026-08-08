import { Users, Globe, Store, CreditCard, SlidersHorizontal, LayoutGrid, Printer, Bike } from "lucide-react";
import AppShell from "@/components/shared/AppShell";
import SettingsPage, { SettingsSection } from "@/components/shared/settings/SettingsPage";
import StoreDetailsSettings from "@/components/pos/StoreDetailsSettings";
import ProfilesManager from "@/components/pos/ProfilesManager";
import PublicMenuSettings from "@/components/pos/PublicMenuSettings";
import PrintingSettings from "@/components/shared/PrintingSettings";
import PlatformSettings from "@/components/platforms/PlatformSettings";
import TablesSettings from "./settings/TablesSettings";
import SubscriptionSettings from "./settings/SubscriptionSettings";

// Κατηγορίες ρυθμίσεων — ίδιο pill nav με κάθε άλλη σελίδα ρυθμίσεων της
// πλατφόρμας (components/shared/settings/SettingsPage)
const CATEGORIES = [
  {
    key: "store",
    label: "Στοιχεία επιχείρησης",
    icon: Store,
    render: () => (
      <SettingsSection
        icon={Store}
        title="Στοιχεία επιχείρησης"
        subtitle="Όνομα, τηλέφωνο, πόλη, διεύθυνση και pin χάρτη, ζώνη διανομής, ωράριο και Google reviews"
      >
        <StoreDetailsSettings />
      </SettingsSection>
    ),
  },
  {
    key: "catalog",
    label: "Κατάλογος",
    icon: Globe,
    render: () => (
      <SettingsSection
        icon={Globe}
        title="Κατάλογος"
        subtitle="Λογότυπο και δημόσια σελίδα μενού με σύνδεσμο και QR κώδικα για τους πελάτες σας"
      >
        <PublicMenuSettings />
      </SettingsSection>
    ),
  },
  {
    key: "platforms",
    label: "Πλατφόρμες",
    icon: Bike,
    render: () => (
      <SettingsSection
        icon={Bike}
        title="Πλατφόρμες delivery"
        subtitle="efood, Box και Wolt: καρτέλα παραγγελιών ανά πλατφόρμα και ήχος ειδοποίησης"
      >
        <PlatformSettings />
      </SettingsSection>
    ),
  },
  {
    key: "staff",
    label: "Προσωπικό",
    icon: Users,
    render: () => (
      <SettingsSection
        icon={Users}
        title="Προσωπικό"
        subtitle="Προφίλ με όνομα, ρόλο, PIN και δικαιώματα λειτουργιών ανά προφίλ"
      >
        <ProfilesManager />
      </SettingsSection>
    ),
  },
  {
    key: "subscription",
    label: "Συνδρομή",
    icon: CreditCard,
    render: () => (
      <SettingsSection
        icon={CreditCard}
        title="Συνδρομή"
        subtitle="Το πλάνο σας και τα πρόσθετα — οι αλλαγές εγκρίνονται από την ομάδα του OrderDeck"
      >
        <SubscriptionSettings />
      </SettingsSection>
    ),
  },
  {
    key: "misc",
    label: "Λοιπά",
    icon: SlidersHorizontal,
    render: () => (
      <>
        <SettingsSection
          icon={LayoutGrid}
          title="Τραπέζια"
          subtitle="Ενεργοποιήστε τη λειτουργία και ορίστε τα τραπέζια του καταστήματος"
        >
          <TablesSettings />
        </SettingsSection>
        <SettingsSection
          icon={Printer}
          title="Εκτύπωση"
          subtitle="Τρόπος εκτύπωσης (kiosk ή Print Bridge), αντίγραφα ανά παραγγελία και δεύτερος εκτυπωτής"
        >
          <PrintingSettings />
        </SettingsSection>
      </>
    ),
  },
];

export default function Settings() {
  return (
    <AppShell title="Ρυθμίσεις">
      <SettingsPage categories={CATEGORIES} />
    </AppShell>
  );
}
