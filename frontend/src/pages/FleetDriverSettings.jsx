import { useState } from "react";
import { Bell, Volume2, VolumeX, BellOff, UserCircle2, Truck, SlidersHorizontal } from "lucide-react";
import { useFleet } from "@/context/fleet/FleetAuthContext";
import SettingsPage, {
  SettingsRow,
  SettingsSection,
} from "@/components/shared/settings/SettingsPage";
import FleetShell from "@/pages/fleet/FleetShell";
import PushToggle from "@/pages/fleet/PushToggle";
import { isMuted, setMuted } from "@/pages/fleet/alerts";

// «Ρυθμίσεις» του οδηγού: το προφίλ του και ειδοποιήσεις (push + ήχος).
// Ίδιο pill nav κατηγοριών, ίδιες ενότητες/γραμμές με τις Ρυθμίσεις του
// OrderDeck (components/shared/settings/SettingsPage).
export default function FleetDriverSettings() {
  const { team } = useFleet();
  const [muted, setMutedState] = useState(isMuted());

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  const name = (team && team !== false && team.member_name) || "—";
  const teamName = (team && team !== false && team.name) || "—";

  const categories = [
    {
      key: "profile",
      label: "Το προφίλ μου",
      icon: UserCircle2,
      render: () => (
        <SettingsSection
          icon={UserCircle2}
          title="Το προφίλ μου"
          subtitle="Τα στοιχεία σας τα διαχειρίζεται η εταιρεία από τους «Διανομείς»"
          tight
        >
          <SettingsRow icon={UserCircle2} title="Όνομα" testId="fleet-drv-set-name">
            <span className="text-sm text-neutral-300">{name}</span>
          </SettingsRow>
          <SettingsRow icon={Truck} title="Εταιρεία" testId="fleet-drv-set-team">
            <span className="text-sm text-neutral-300">{teamName}</span>
          </SettingsRow>
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
          subtitle="Πώς θα μαθαίνετε για νέες ελεύθερες παραγγελίες όσο είστε σε βάρδια"
          tight
        >
          <SettingsRow
            icon={Bell}
            title="Ειδοποιήσεις push"
            subtitle="Και με κλειστή την εφαρμογή"
            testId="fleet-drv-set-push"
          >
            <PushToggle surface="driver" />
          </SettingsRow>
          <SettingsRow
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
          </SettingsRow>
        </SettingsSection>
      ),
    },
  ];

  return (
    <FleetShell title="Ρυθμίσεις">
      <SettingsPage categories={categories} testPrefix="fleet-drv-settings" scrollable={false} />
    </FleetShell>
  );
}
