import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LayoutGrid, RefreshCcw, Settings2, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import TablesEditor from "@/components/TablesEditor";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { apiTablesState, formatApiError } from "@/lib/api";
import { eur } from "@/lib/format";

export default function Tables() {
  const { canManage } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState(null); // {enabled, tables}
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setState(await apiTablesState());
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // keep waiter phones fresh
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tables = state?.tables || [];

  return (
    <AppShell title="Τραπέζια">
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-[1200px] mx-auto w-full">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-flame" />
            Τραπέζια
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={load}
              disabled={loading}
              data-testid="tables-refresh-btn"
              className="h-11 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
            >
              <RefreshCcw className="w-4 h-4" />
            </Button>
            {canManage && (
              <Button
                onClick={() => setEditorOpen(true)}
                data-testid="tables-manage-btn"
                className="h-11 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Διαχείριση
              </Button>
            )}
          </div>
        </div>

        {loading && !state ? (
          <div className="text-neutral-500 py-16 text-center">Φόρτωση...</div>
        ) : state && !state.enabled ? (
          <div className="text-neutral-500 py-16 text-center bg-[#3D1620] border border-[#723645] rounded-lg px-6">
            Η λειτουργία τραπεζιών είναι απενεργοποιημένη.
            <div className="text-xs mt-2">
              Ο ιδιοκτήτης μπορεί να την ενεργοποιήσει από τις Ρυθμίσεις.
            </div>
          </div>
        ) : tables.length === 0 ? (
          <div className="text-neutral-500 py-16 text-center bg-[#3D1620] border border-[#723645] rounded-lg px-6">
            Δεν έχουν οριστεί τραπέζια ακόμα
            {canManage && (
              <div className="mt-3">
                <button
                  onClick={() => setEditorOpen(true)}
                  className="text-flame font-bold hover:underline"
                >
                  Προσθέστε το πρώτο τραπέζι
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tables.map((t) => {
              const open = !!t.tab;
              return (
                <button
                  key={t.id}
                  onClick={() => navigate(`/app/tables/${t.id}`)}
                  data-testid={`table-card-${t.id}`}
                  className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 p-3 transition-all active:scale-[0.97] ${
                    open
                      ? "bg-flame/15 border-flame text-white"
                      : "bg-[#00E676]/10 border-[#00E676]/60 text-white hover:border-[#00E676]"
                  }`}
                >
                  <span className="font-heading text-xl md:text-2xl font-bold truncate max-w-full">
                    {t.name}
                  </span>
                  {open ? (
                    <>
                      <span className="font-mono text-lg font-bold text-gold">
                        {eur(t.tab.total)}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-flame/80">
                        {t.tab.rounds_count} {t.tab.rounds_count === 1 ? "γύρος" : "γύροι"}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest text-[#00E676]">
                      Ελεύθερο
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {editorOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          data-testid="tables-editor-modal"
        >
          <div className="bg-[#3D1620] border border-[#723645] rounded-lg w-full max-w-md max-h-[85vh] flex flex-col p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-xl font-bold">Διαχείριση τραπεζιών</h3>
              <button
                onClick={() => setEditorOpen(false)}
                data-testid="tables-editor-close"
                className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TablesEditor
                tables={tables}
                onChange={(next) => setState((s) => ({ ...s, tables: next }))}
              />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
