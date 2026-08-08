import { Store, Users } from "lucide-react";
import AppShell from "@/components/shared/AppShell";
import ProfilesManager from "@/components/pos/ProfilesManager";
import StoreDetailsSettings from "@/components/pos/StoreDetailsSettings";

// «Ρυθμίσεις» (FleetDeck καταστήματος, μόνο Ιδιοκτήτης): στοιχεία επιχείρησης
// (όνομα, πόλη, διεύθυνση + pin, τηλέφωνα — χωρίς τα extras δημόσιου καταλόγου)
// και διαχείριση προφίλ — μόνο ρόλοι Ιδιοκτήτης/Υπάλληλος (δεν υπάρχει POS).
export default function StoreFleetSettings() {
  return (
    <AppShell title="Ρυθμίσεις">
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 max-w-[900px] mx-auto w-full">
        <section>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Store className="w-6 h-6 text-flame" />
              <h2 className="font-heading text-2xl font-bold">Στοιχεία επιχείρησης</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Η πόλη και το pin κεντράρουν τους χάρτες και τις προτάσεις διευθύνσεων
              — και η πόλη ταιριάζει το κατάστημα με εταιρείες διανομής της περιοχής
            </p>
          </div>
          <div className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg">
            {/* Χωρίς εκτύπωση: το FleetDeck καταστήματος μόνο ανεβάζει παραγγελίες */}
            <StoreDetailsSettings catalogExtras={false} printing={false} />
          </div>
        </section>

        <section>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-6 h-6 text-flame" />
              <h2 className="font-heading text-2xl font-bold">Προσωπικό</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Προφίλ με όνομα, ρόλο (Ιδιοκτήτης ή Υπάλληλος) και 4-ψήφιο PIN
            </p>
          </div>
          <div className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg">
            <ProfilesManager allowedRoles={["owner", "employee"]} />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
