import FleetShell from "@/pages/fleet/FleetShell";
import PartnerStoresView from "@/pages/fleet/PartnerStoresView";

// «Μαγαζιά» (διαχειριστής): τα συνεργαζόμενα καταστήματα της εταιρείας — χάρτης
// με pins και από κάτω η λίστα, με τα πλήθη παραγγελιών της ημέρας. Η ίδια όψη
// σερβίρεται read-only στον διανομέα (FleetDriverStores).
export default function FleetStores() {
  return (
    <FleetShell title="Μαγαζιά">
      <PartnerStoresView showStats />
    </FleetShell>
  );
}
