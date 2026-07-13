import { User as UserIcon } from "lucide-react";
import AppShell from "@/components/AppShell";
import ProfilesManager from "@/components/ProfilesManager";

// Manager view: manage waiter profiles only.
export default function Waiters() {
  return (
    <AppShell title="Σερβιτόροι">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[900px] mx-auto w-full">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <UserIcon className="w-6 h-6 text-[#00E676]" />
            <h2 className="font-heading text-2xl font-bold">Σερβιτόροι</h2>
          </div>
          <p className="text-sm text-neutral-400">
            Προσθήκη και διαχείριση προφίλ σερβιτόρων (όνομα + PIN)
          </p>
        </div>

        <div className="p-6 bg-[#3D1620] border border-[#5E2A3A] rounded-lg">
          <ProfilesManager waiterOnly />
        </div>
      </main>
    </AppShell>
  );
}
