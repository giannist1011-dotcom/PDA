import { useEffect, useState } from "react";
import { toast } from "sonner";
import TablesEditor from "@/components/TablesEditor";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { apiTablesState, apiToggleTables, formatApiError } from "@/lib/api";

export default function TablesSettings() {
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
