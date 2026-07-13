import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, LayoutGrid, Store } from "lucide-react";
import AppShell from "@/components/AppShell";
import ProfilesManager from "@/components/ProfilesManager";
import TablesEditor from "@/components/TablesEditor";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import {
  apiTablesState,
  apiToggleTables,
  apiUpdateBusinessType,
  formatApiError,
} from "@/lib/api";
import { BUSINESS_TYPES } from "@/lib/business";

function BusinessTypeSettings() {
  const { user, refreshMe } = useAuth();
  const [saving, setSaving] = useState(false);
  const current = user && user !== false ? user.business_type : "souvlaki";

  const change = async (key) => {
    if (key === current || saving) return;
    setSaving(true);
    try {
      await apiUpdateBusinessType(key);
      await refreshMe(); // header icon updates
      toast.success("Ο τύπος επιχείρησης άλλαξε");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {BUSINESS_TYPES.map((b) => {
        const Icon = b.icon;
        const active = current === b.key;
        return (
          <button
            key={b.key}
            onClick={() => change(b.key)}
            disabled={saving}
            data-testid={`biz-type-${b.key}`}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all active:scale-[0.98] ${
              active
                ? "bg-[#FF6B00]/10 border-[#FF6B00] text-white"
                : "bg-[#0D0D0D] border-[#333] text-neutral-300 hover:border-[#FF6B00]"
            }`}
          >
            <span
              className={`w-11 h-11 rounded-md bg-[#FF6B00] flex items-center justify-center ${
                active ? "" : "opacity-60"
              }`}
            >
              <Icon className="w-6 h-6 text-white" />
            </span>
            <span className="text-sm font-bold">{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}

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
      <div className="flex items-center justify-between px-4 py-3 bg-[#0D0D0D] border border-[#333] rounded-md mb-4">
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
              <Store className="w-6 h-6 text-[#FF6B00]" />
              <h2 className="font-heading text-2xl font-bold">Τύπος επιχείρησης</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Καθορίζει το εικονίδιο της επιχείρησης στο header
            </p>
          </div>
          <div className="p-6 bg-[#1A1A1A] border border-[#333] rounded-lg">
            <BusinessTypeSettings />
          </div>
        </section>

        <section>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-6 h-6 text-[#FF6B00]" />
              <h2 className="font-heading text-2xl font-bold">Προφίλ προσωπικού</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Δημιουργήστε προφίλ με όνομα, ρόλο και PIN — Ιδιοκτήτης, Υπεύθυνος, Υπάλληλος, Σερβιτόρος
            </p>
          </div>
          <div className="p-6 bg-[#1A1A1A] border border-[#333] rounded-lg">
            <ProfilesManager />
          </div>
        </section>

        <section>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <LayoutGrid className="w-6 h-6 text-[#FF6B00]" />
              <h2 className="font-heading text-2xl font-bold">Τραπέζια</h2>
            </div>
            <p className="text-sm text-neutral-400">
              Ενεργοποιήστε τη λειτουργία και ορίστε τα τραπέζια του καταστήματος
            </p>
          </div>
          <div className="p-6 bg-[#1A1A1A] border border-[#333] rounded-lg">
            <TablesSettings />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
