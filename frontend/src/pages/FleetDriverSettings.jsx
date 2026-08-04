import { useState } from "react";
import { Bell, Volume2, VolumeX, BellOff, UserCircle2, Truck } from "lucide-react";
import { useFleet } from "@/context/fleet/FleetAuthContext";
import FleetShell from "@/pages/fleet/FleetShell";
import PushToggle from "@/pages/fleet/PushToggle";
import { isMuted, setMuted } from "@/pages/fleet/alerts";

// Γραμμή ρύθμισης: εικονίδιο + τίτλος/περιγραφή αριστερά, χειριστήριο δεξιά —
// ίδιο μοτίβο με τις ρυθμίσεις του OrderDeck.
function Row({ icon: Icon, title, subtitle, children, testId }) {
  return (
    <div
      className="flex items-center gap-3 py-3 border-b border-[#723645]/40 last:border-0"
      data-testid={testId}
    >
      <Icon className="w-5 h-5 text-flame shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm">{title}</div>
        {subtitle && <div className="text-xs text-neutral-500 mt-0.5">{subtitle}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// «Ρυθμίσεις» του οδηγού: ειδοποιήσεις push, ήχος ειδοποιήσεων και στοιχεία
// του προφίλ. Ίδια tokens/δομή με τις ρυθμίσεις του OrderDeck.
export default function FleetDriverSettings() {
  const { team } = useFleet();
  const [muted, setMutedState] = useState(isMuted());

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  return (
    <FleetShell title="Ρυθμίσεις">
      <section className="max-w-[560px] space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-flame" />
            <h2 className="font-heading text-lg font-bold">Ειδοποιήσεις</h2>
          </div>
          <p className="text-sm text-neutral-400 mb-4">
            Πώς θα μαθαίνετε για νέες ελεύθερες παραγγελίες όσο είστε σε βάρδια
          </p>
          <div className="px-4 bg-[#3D1620] border border-[#723645] rounded-lg">
            <Row
              icon={Bell}
              title="Ειδοποιήσεις push"
              subtitle="Και με κλειστή την εφαρμογή"
              testId="fleet-drv-set-push"
            >
              <PushToggle surface="driver" />
            </Row>
            <Row
              icon={muted ? VolumeX : Volume2}
              title="Ήχος ειδοποιήσεων"
              subtitle={muted ? "Σε σίγαση" : "Ήχος & δόνηση σε νέα παραγγελία"}
              testId="fleet-drv-set-sound"
            >
              <button
                onClick={toggleMute}
                data-testid="fleet-drv-mute"
                className={`h-9 px-3 rounded-md border text-xs font-bold transition-colors ${
                  muted
                    ? "border-[#723645] text-neutral-400 hover:border-flame"
                    : "border-gold/50 bg-gold/10 text-gold"
                }`}
              >
                {muted ? (
                  <span className="flex items-center gap-1.5">
                    <BellOff className="w-3.5 h-3.5" /> Σίγαση
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" /> Ενεργός
                  </span>
                )}
              </button>
            </Row>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCircle2 className="w-5 h-5 text-flame" />
            <h2 className="font-heading text-lg font-bold">Το προφίλ μου</h2>
          </div>
          <p className="text-sm text-neutral-400 mb-4">
            Τα στοιχεία σας τα διαχειρίζεται η εταιρεία από τους «Διανομείς»
          </p>
          <div className="px-4 bg-[#3D1620] border border-[#723645] rounded-lg">
            <Row icon={UserCircle2} title="Όνομα" testId="fleet-drv-set-name">
              <span className="text-sm text-neutral-300">
                {(team && team !== false && team.member_name) || "—"}
              </span>
            </Row>
            <Row icon={Truck} title="Εταιρεία" testId="fleet-drv-set-team">
              <span className="text-sm text-neutral-300">
                {(team && team !== false && team.name) || "—"}
              </span>
            </Row>
          </div>
        </div>
      </section>
    </FleetShell>
  );
}
