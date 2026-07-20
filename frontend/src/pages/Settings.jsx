import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, LayoutGrid, Globe, Printer, Store } from "lucide-react";
import AppShell from "@/components/AppShell";
import StoreDetailsSettings from "@/components/StoreDetailsSettings";
import ProfilesManager from "@/components/ProfilesManager";
import TablesEditor from "@/components/TablesEditor";
import PublicMenuSettings from "@/components/PublicMenuSettings";
import PrintingSettings from "@/components/PrintingSettings";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { apiTablesState, apiToggleTables, formatApiError } from "@/lib/api";

function TablesSettings() {
  const { refreshMe } = useAuth();
  const [state, setState] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setState(await apiTablesState());
      } catch (e) {
        toast.error(formatApiError(e));
      }
    })();
  }, []);

  const toggle = async (enabled) => {
    setSaving(true);
    try {
      await apiToggleTables(enabled);
      setState((s) => ({ ...s, enabled }));
      await refreshMe(); // nav visibility depends on user.tables_enabled
      toast.success(enabled ? "Τα τραπέζια ενεργοποιήθηκαν" : "Τα τραπέζια απενεργοποιήθηκαν");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!state) return <div className="text-neutral-500 py-6 text-center">Φόρτωση...</div>;

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 bg-[#2A0E14] border border-[#723645] rounded-md mb-4">
        <div>
          <div className="font-semibold text-sm">Λειτουργία τραπεζιών</div>
          <div className="text-xs text-neutral-500">
            Καρτέλες ανά τραπέζι, γύροι για την κουζίνα, σελίδα «Τραπέζια»
          </div>
        </div>
        <Switch
          checked={state.enabled}
          disabled={saving}
          onCheckedChange={(v) => toggle(!!v)}
          data-testid="tables-toggle-switch"
        />
      </div>

      {state.enabled && (
        <TablesEditor
          tables={state.tables || []}
          onChange={(next) => setState((s) => ({ ...s, tables: next }))}
        />
      )}
    </div>
  );
}

export default function Settings() {
  return (
    <AppShell title="Ρυθμίσεις">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[900px] mx-auto w-full space-y-8">
        <section>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Store className="w-6 h-6 text-flame" />
              <h2 className="font-heading text-2xl font-bold">Στοιχεία καταστήματος</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Όνομα, τηλέφωνο, διεύθυνση, ωράριο και Google reviews — χρησιμοποιούνται στον live χάρτη και στον δημόσιο κατάλογο
            </p>
          </div>
          <div className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg">
            <StoreDetailsSettings />
          </div>
        </section>

        <section>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-6 h-6 text-flame" />
              <h2 className="font-heading text-2xl font-bold">Προφίλ προσωπικού</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Δημιουργήστε προφίλ με όνομα, ρόλο και PIN — Ιδιοκτήτης, Υπεύθυνος, Υπάλληλος, Σερβιτόρος
            </p>
          </div>
          <div className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg">
            <ProfilesManager />
          </div>
        </section>

        <section>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <LayoutGrid className="w-6 h-6 text-flame" />
              <h2 className="font-heading text-2xl font-bold">Τραπέζια</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Ενεργοποιήστε τη λειτουργία και ορίστε τα τραπέζια του καταστήματος
            </p>
          </div>
          <div className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg">
            <TablesSettings />
          </div>
        </section>

        <section>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Printer className="w-6 h-6 text-flame" />
              <h2 className="font-heading text-2xl font-bold">Εκτύπωση</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Αντίγραφα ανά παραγγελία και ταυτόχρονη εκτύπωση σε δεύτερο εκτυπωτή
            </p>
          </div>
          <div className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg">
            <PrintingSettings />
          </div>
        </section>

        <section>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-6 h-6 text-flame" />
              <h2 className="font-heading text-2xl font-bold">Δημόσιος κατάλογος</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Δημόσια σελίδα μενού με λογότυπο, σύνδεσμο και QR κώδικα για τους πελάτες σας
            </p>
          </div>
          <div className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg">
            <PublicMenuSettings />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
