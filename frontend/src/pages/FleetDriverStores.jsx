import FleetShell from "@/pages/fleet/FleetShell";
import PartnerStoresView from "@/pages/fleet/PartnerStoresView";

// «Μαγαζιά» του διανομέα: ίδιος χάρτης + λίστα με τη σελίδα του διαχειριστή,
// read-only — όνομα, διεύθυνση (tap → Google Maps), τηλέφωνο (tap-to-call).
// Χωρίς στατιστικά/πλήθη παραγγελιών: αυτά μένουν στη διαχείριση.
export default function FleetDriverStores() {
  return (
    <FleetShell title="Μαγαζιά">
      <PartnerStoresView />
    </FleetShell>
  );
}
