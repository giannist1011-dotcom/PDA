import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import { apiFleetBoard } from "@/lib/fleetApi";
import EmptyState from "@/components/EmptyState";
import FleetShell from "@/pages/fleet/FleetShell";
import NewOrderForm from "@/pages/fleet/NewOrderForm";
import OrderCard from "@/pages/fleet/OrderCard";
import PartnershipRequests from "@/pages/fleet/PartnershipRequests";
import FleetOrdersMap from "@/pages/fleet/FleetOrdersMap";
import DayTotals from "@/pages/fleet/DayTotals";
import { fmtTime, useAccountCenter } from "@/pages/fleet/utils";

const POLL_MS = 6000;
const ACTIVE_STATUSES = ["waiting", "pickup", "enroute"];

// Ο πίνακας διαχείρισης: καταχώρηση παραγγελίας, δύο tabs («Παραγγελίες» =
// ενεργές 🔴🟡🟢, «Ολοκληρωμένες» = 🔵 σήμερα) με κάρτες, συμπτυσσόμενη
// ζωντανή ροή κάτω από τα tabs, σύνολα ημέρας. Polling 6''.
export default function FleetDispatch() {
  const { team } = useFleet();
  const [board, setBoard] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Η καρτέλα ζει στο URL (?tab=) ώστε να την οδηγεί και το burger menu
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "active";
  const setTab = (t) => setSearchParams({ tab: t }, { replace: true });
  const [showEvents, setShowEvents] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  // Default κέντρο χάρτη: pin εταιρείας → geocode πόλης → θέα Ελλάδας
  const mapCenter = useAccountCenter(team?.lat, team?.lng, team?.city);

  const load = useCallback(() => {
    apiFleetBoard()
      .then((b) => {
        setBoard(b);
        setRefreshKey((k) => k + 1);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const orders = board?.orders || [];
  const drivers = board?.drivers || [];
  const events = board?.events || [];
  // Ενεργές: νεότερες πρώτα, ⚡ επείγουσες καρφιτσωμένες στην κορυφή
  const active = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) =>
      !!b.urgent !== !!a.urgent ? (b.urgent ? 1 : -1) : b.created_at.localeCompare(a.created_at)
    );
  // Ολοκληρωμένες: πιο πρόσφατα παραδομένες πρώτα
  const completed = orders
    .filter((o) => o.status === "delivered")
    .sort((a, b) =>
      (b.delivered_at || b.created_at).localeCompare(a.delivered_at || a.created_at)
    );
  const cancelled = orders.filter((o) => o.status === "cancelled");

  const tabBtn = (key, label, count) => (
    <button
      onClick={() => setTab(key)}
      data-testid={`fleet-tab-${key}`}
      className={`h-12 rounded-lg font-bold text-sm transition-colors ${
        tab === key
          ? "bg-brand text-white"
          : "bg-[#3D1620] border border-[#723645] text-neutral-300 hover:bg-[#4a1c28]"
      }`}
    >
      {label}
      <span className={tab === key ? "text-white/80" : "text-neutral-500"}> ({count})</span>
    </button>
  );

  const cardsGrid = (list, empty) =>
    list.length === 0 ? (
      <EmptyState text={empty} />
    ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            drivers={drivers}
            city={team?.city || ""}
            companyLat={team?.lat ?? null}
            companyLng={team?.lng ?? null}
            onChanged={load}
          />
        ))}
      </div>
    );

  return (
    <FleetShell>
      <div className="space-y-4">
        {/* Αιτήματα συνεργασίας καταστημάτων — πάνω από τη φόρμα όταν υπάρχουν */}
        <PartnershipRequests requests={board?.partnership_requests} onChanged={load} />

        <NewOrderForm
          city={team?.city || ""}
          companyLat={team?.lat ?? null}
          companyLng={team?.lng ?? null}
          onCreated={load}
        />

        {drivers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" data-testid="fleet-drivers-strip">
            <span className="text-[11px] uppercase tracking-widest font-bold text-neutral-500">
              Οδηγοί
            </span>
            {drivers.map((d) => (
              <span
                key={d.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs ${
                  d.on_shift
                    ? "border-[#34C759]/50 bg-[#34C759]/10 text-white"
                    : "border-[#723645] text-neutral-500"
                }`}
                title={d.on_shift ? "Σε βάρδια" : "Εκτός βάρδιας"}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    d.on_shift ? "bg-[#34C759]" : "bg-neutral-600"
                  }`}
                />
                {d.name}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {tabBtn("active", "Παραγγελίες", active.length)}
          {tabBtn("map", "Χάρτης", active.filter((o) => o.lat != null && o.lng != null).length)}
          {tabBtn("done", "Ολοκληρωμένες", completed.length)}
        </div>

        {tab === "active" && (
          <section data-testid="fleet-tab-panel-active">
            {cardsGrid(active, "Καμία ενεργή παραγγελία")}
          </section>
        )}

        {/* Χάρτης: όλες οι ενεργές (🔴🟡🟢) ως pins ανά κατάσταση — tap σε pin
            ανοίγει την κάρτα (popup)· ανανεώνεται με το ίδιο polling, τα 🔵
            παραδομένα φεύγουν μόνα τους (δεν είναι πια στις ενεργές) */}
        {tab === "map" && (
          <section data-testid="fleet-tab-panel-map">
            <FleetOrdersMap orders={active} defaultCenter={mapCenter} />
          </section>
        )}

        {tab === "done" && (
          <section className="space-y-3" data-testid="fleet-tab-panel-done">
            {cardsGrid(completed, "Καμία ολοκληρωμένη παραγγελία σήμερα")}
            {cancelled.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCancelled((v) => !v)}
                  data-testid="fleet-cancelled-toggle"
                  className="w-full h-11 rounded-lg border border-[#723645]/60 text-sm text-neutral-400 flex items-center justify-center gap-2 hover:bg-[#3D1620]"
                >
                  ⚪ Ακυρωμένες ({cancelled.length})
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showCancelled ? "rotate-180" : ""}`}
                  />
                </button>
                {showCancelled && <div className="mt-3">{cardsGrid(cancelled, "")}</div>}
              </div>
            )}
          </section>
        )}

        {/* Ζωντανή ροή γεγονότων — συμπαγής συμπτυσσόμενη λωρίδα κάτω από τα
            tabs (κλειστή δείχνει το τελευταίο γεγονός), όχι μαζί με τις κάρτες */}
        <div className="bg-[#3D1620] border border-[#723645] rounded-lg">
          <button
            onClick={() => setShowEvents((v) => !v)}
            data-testid="fleet-events-toggle"
            className="w-full px-4 h-11 flex items-center gap-2 text-sm"
          >
            <span className="font-heading font-bold shrink-0">
              Ζωντανή ροή{events.length ? ` (${events.length})` : ""}
            </span>
            {!showEvents && events.length > 0 && (
              <span className="truncate text-xs text-neutral-400">
                {fmtTime(events[0].created_at)} · {events[0].text}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 ml-auto shrink-0 text-neutral-400 transition-transform ${
                showEvents ? "rotate-180" : ""
              }`}
            />
          </button>
          {showEvents && (
            <div className="px-4 pb-3">
              {events.length === 0 ? (
                <div className="text-xs text-neutral-500">Κανένα γεγονός σήμερα</div>
              ) : (
                <ul className="space-y-1.5 max-h-64 overflow-y-auto" data-testid="fleet-events">
                  {events.map((ev) => (
                    <li key={ev.id} className="text-sm text-neutral-300 flex gap-2">
                      <span className="text-xs text-neutral-500 shrink-0 w-10">
                        {fmtTime(ev.created_at)}
                      </span>
                      <span>{ev.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DayTotals refreshKey={refreshKey} />
      </div>
    </FleetShell>
  );
}
