import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import { apiFleetUpdateCompany } from "@/lib/fleetApi";
import BusinessDetailsForm from "@/components/BusinessDetailsForm";
import FleetShell from "@/pages/fleet/FleetShell";

// «Ρυθμίσεις» εταιρείας διανομής (μόνο διαχειριστής): στοιχεία επιχείρησης —
// όνομα, πόλη, διεύθυνση με pin, τηλέφωνα. Πόλη/pin κεντράρουν τους χάρτες και
// τις προτάσεις διευθύνσεων, και η πόλη ταιριάζει την εταιρεία με καταστήματα
// της περιοχής στην αναζήτηση συνεργασιών.
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

  return (
    <FleetShell title="Ρυθμίσεις">
      <section className="max-w-[900px]">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-flame" />
            <h2 className="font-heading text-lg font-bold">Στοιχεία επιχείρησης</h2>
          </div>
          <p className="text-sm text-neutral-400">
            Η πόλη και το pin κεντράρουν τον χάρτη παραγγελιών και τις προτάσεις
            διευθύνσεων — και η πόλη εμφανίζει την εταιρεία σε καταστήματα της
            περιοχής που ψάχνουν συνεργασία
          </p>
        </div>
        <div className="p-4 md:p-6 bg-[#3D1620] border border-[#723645] rounded-lg">
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
        </div>
      </section>
    </FleetShell>
  );
}
