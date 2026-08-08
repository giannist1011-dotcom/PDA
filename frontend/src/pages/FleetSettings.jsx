import { toast } from "sonner";
import { Bell, Building2, SlidersHorizontal } from "lucide-react";
import { useFleet } from "@/context/fleet/FleetAuthContext";
import { apiFleetUpdateCompany } from "@/lib/fleetApi";
import SettingsPage, {
  SettingsRow,
  SettingsSection,
} from "@/components/shared/settings/SettingsPage";
import BusinessDetailsForm from "@/components/pos/BusinessDetailsForm";
import FleetShell from "@/pages/fleet/FleetShell";
import PushToggle from "@/pages/fleet/PushToggle";

// «Ρυθμίσεις» εταιρείας διανομής (μόνο διαχειριστής): στοιχεία επιχείρησης —
// όνομα, πόλη, διεύθυνση με pin, τηλέφωνα. Πόλη/pin κεντράρουν τους χάρτες και
// τις προτάσεις διευθύνσεων, και η πόλη ταιριάζει την εταιρεία με καταστήματα
// της περιοχής στην αναζήτηση συνεργασιών. Ίδιο pill nav κατηγοριών + ίδιες
// ενότητες/κάρτες με τις Ρυθμίσεις του OrderDeck.
export default function FleetSettings() {
  const { team, refresh } = useFleet();

  const save = async (core) => {
    await apiFleetUpdateCompany({
      name: core.name,
      city: core.city,
      address: core.address,
      phone: core.phone,
      lat: core.lat,
      lng: core.lng,
    });
    await refresh();
    toast.success("Τα στοιχεία επιχείρησης αποθηκεύτηκαν");
  };

  const categories = [
    {
      key: "company",
      label: "Στοιχεία επιχείρησης",
      icon: Building2,
      render: () => (
        <SettingsSection
          icon={Building2}
          title="Στοιχεία επιχείρησης"
          subtitle="Η πόλη και το pin κεντράρουν τον χάρτη παραγγελιών και τις προτάσεις διευθύνσεων — και η πόλη εμφανίζει την εταιρεία σε καταστήματα της περιοχής που ψάχνουν συνεργασία"
        >
          {team && team !== false && (
            <BusinessDetailsForm
              initial={{
                name: team.name,
                phone: team.phone,
                address: team.address,
                city: team.city,
                lat: team.lat,
                lng: team.lng,
              }}
              nameLabel="Όνομα εταιρείας"
              mapLabel="Τοποθεσία — πατήστε στον χάρτη για να βάλετε pin στην έδρα"
              onSave={save}
              testPrefix="fleet-company"
            />
          )}
        </SettingsSection>
      ),
    },
    {
      key: "misc",
      label: "Λοιπά",
      icon: SlidersHorizontal,
      render: () => (
        <SettingsSection
          icon={Bell}
          title="Ειδοποιήσεις"
          subtitle="Ειδοποιήσεις push για νέες παραγγελίες καταστημάτων και αιτήματα συνεργασίας — και με κλειστή την εφαρμογή"
          tight
        >
          <SettingsRow
            icon={Bell}
            title="Ειδοποιήσεις push"
            subtitle="Σε αυτή τη συσκευή"
            testId="fleet-set-push"
          >
            <PushToggle surface="dispatcher" />
          </SettingsRow>
        </SettingsSection>
      ),
    },
  ];

  return (
    <FleetShell title="Ρυθμίσεις">
      <SettingsPage categories={categories} testPrefix="fleet-settings" scrollable={false} />
    </FleetShell>
  );
}
