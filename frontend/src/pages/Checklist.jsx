import { useEffect, useState } from "react";
import {
  Settings2,
  History as HistoryIcon,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { apiChecklistToday, apiChecklistTick, apiChecklistTemplates } from "@/lib/api";
import TickList from "./checklist/TickList";
import ManageList from "./checklist/ManageList";
import HistoryTab from "./checklist/HistoryTab";

// ---------- Σελίδα ----------
export default function Checklist() {
  const { role } = useAuth();
  const isOwner = role === "owner";
  const [tab, setTab] = useState("today"); // today | manage | history
  const [data, setData] = useState(null);
  // Templates για τη «Διαχείριση»: περιλαμβάνουν και έκτακτες ΜΕΛΛΟΝΤΙΚΕΣ εργασίες
  // που δεν εμφανίζονται στο «Σήμερα»
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const d = await apiChecklistToday();
      setData(d);
      if (isOwner) setTemplates(await apiChecklistTemplates());
      setError(false);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTick = async (it) => {
    setBusyId(it.id);
    try {
      await apiChecklistTick(it.id, !it.done);
      await load();
    } catch {
      toast.error("Σφάλμα — δοκίμασε ξανά");
    } finally {
      setBusyId(null);
    }
  };

  const items = data?.items ?? [];
  const openItems = items.filter((i) => i.list === "open");
  const closeItems = items.filter((i) => i.list === "close");

  const tabs = [
    { key: "today", label: "Σήμερα", icon: ListChecks },
    ...(isOwner
      ? [
          { key: "manage", label: "Διαχείριση", icon: Settings2 },
          { key: "history", label: "Ιστορικό", icon: HistoryIcon },
        ]
      : []),
  ];

  return (
    <AppShell title="Checklist">
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-[900px] mx-auto w-full">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="text-sm text-neutral-400">
            Checklist ανοίγματος & κλεισίματος
            {data?.date && (
              <span className="ml-2 font-mono text-neutral-500">· {data.date}</span>
            )}
          </div>
          {tabs.length > 1 && (
            <div className="flex gap-1 bg-[#3D1620] border border-[#723645] rounded-md p-1">
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    data-testid={`checklist-tab-${t.key}`}
                    className={`h-9 px-3 rounded text-sm font-bold flex items-center gap-1.5 transition-colors ${
                      tab === t.key
                        ? "bg-flame text-white"
                        : "text-neutral-300 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 mb-6 border border-[#FF3B30] bg-[#FF3B30]/10 rounded-md text-[#FF3B30]">
            Σφάλμα φόρτωσης — δοκίμασε ανανέωση.
          </div>
        )}

        {tab === "today" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TickList list="open" items={openItems} onTick={onTick} busyId={busyId} />
            <TickList list="close" items={closeItems} onTick={onTick} busyId={busyId} />
          </div>
        )}

        {tab === "manage" && isOwner && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ManageList
              list="open"
              items={templates.filter((t) => t.list === "open")}
              onChanged={load}
            />
            <ManageList
              list="close"
              items={templates.filter((t) => t.list === "close")}
              onChanged={load}
            />
          </div>
        )}

        {tab === "history" && isOwner && <HistoryTab />}
      </main>
    </AppShell>
  );
}
