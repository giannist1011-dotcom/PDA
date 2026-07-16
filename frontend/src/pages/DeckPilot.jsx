import AppShell from "@/components/AppShell";
import DeckPilotChat from "@/components/DeckPilotChat";

export default function DeckPilot() {
  return (
    <AppShell title="DeckPilot">
      <main className="flex-1 min-h-0 flex flex-col max-w-3xl mx-auto w-full">
        <DeckPilotChat />
      </main>
    </AppShell>
  );
}
