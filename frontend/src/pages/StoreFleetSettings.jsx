import { Store, Users } from "lucide-react";
import AppShell from "@/components/shared/AppShell";
import SettingsPage, { SettingsSection } from "@/components/shared/settings/SettingsPage";
import ProfilesManager from "@/components/pos/ProfilesManager";
import StoreDetailsSettings from "@/components/pos/StoreDetailsSettings";

// «Ρυθμίσεις» (FleetDeck καταστήματος, μόνο Ιδιοκτήτης): στοιχεία επιχείρησης
// (όνομα, πόλη, διεύθυνση + pin, τηλέφωνα — χωρίς τα extras δημόσιου καταλόγου)
// και διαχείριση προφίλ — μόνο ρόλοι Ιδιοκτήτης/Υπάλληλος (δεν υπάρχει POS).
// Ίδιο pill nav κατηγοριών με τις Ρυθμίσεις του OrderDeck.
const CATEGORIES = [
  {
    key: "store",
    label: "Στοιχεία επιχείρησης",
    icon: Store,
    render: () => (
      <SettingsSection
        icon={Store}
        title="Στοιχεία επιχείρησης"
        subtitle="Η πόλη και το pin κεντράρουν τους χάρτες και τις προτάσεις διευθύνσεων — και η πόλη ταιριάζει το κατάστημα με εταιρείες διανομής της περιοχής"
      >
        {/* Χωρίς εκτύπωση: το FleetDeck καταστήματος μόνο ανεβάζει παραγγελίες */}
        <StoreDetailsSettings catalogExtras={false} printing={false} />
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
        subtitle="Προφίλ με όνομα, ρόλο (Ιδιοκτήτης ή Υπάλληλος) και 4-ψήφιο PIN"
      >
        <ProfilesManager allowedRoles={["owner", "employee"]} />
      </SettingsSection>
    ),
  },
];

export default function StoreFleetSettings() {
  return (
    <AppShell title="Ρυθμίσεις">
      <SettingsPage categories={CATEGORIES} />
    </AppShell>
  );
}
