import { useCallback, useEffect, useState } from "react";
import { useFleet } from "@/context/FleetAuthContext";
import { apiFleetBoard } from "@/lib/fleetApi";
import FleetShell from "@/pages/fleet/FleetShell";
import NewOrderForm from "@/pages/fleet/NewOrderForm";
import OrderCard from "@/pages/fleet/OrderCard";
import DayTotals from "@/pages/fleet/DayTotals";
import { BOARD_COLUMNS, STATUS_META, fmtTime } from "@/pages/fleet/utils";

const POLL_MS = 6000;

// Ο πίνακας λειτουργίας του συντονιστή: καταχώρηση παραγγελίας, στήλες ανά
// κατάσταση (🔴→🟡→🟢→🔵), live feed γεγονότων, σύνολα ημέρας. Polling 6''.
export default function FleetDispatch() {
  const { team } = useFleet();
  const [board, setBoard] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
  const cancelled = orders.filter((o) => o.status === "cancelled");

  return (
    <FleetShell>
      <div className="space-y-4">
        <NewOrderForm city={team?.city || ""} onCreated={load} />

        <div className="grid gap-4 lg:grid-cols-4">
          {BOARD_COLUMNS.map((status) => {
            const meta = STATUS_META[status];
            const list = orders.filter((o) => o.status === status);
            return (
              <div key={status} data-testid={`fleet-column-${status}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span>{meta.emoji}</span>
                  <span className="text-sm font-bold">{meta.label}</span>
                  <span className="text-xs text-neutral-500">({list.length})</span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 ? (
                    <div className="border border-dashed border-[#723645]/60 rounded-lg p-4 text-center text-xs text-neutral-600">
                      Καμία παραγγελία
                    </div>
                  ) : (
                    list.map((o) => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        drivers={drivers}
                        city={team?.city || ""}
                        onChanged={load}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {cancelled.length > 0 && (
          <div>
            <div className="text-sm font-bold mb-2 text-neutral-400">
              ⚪ Ακυρωμένες ({cancelled.length})
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              {cancelled.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  drivers={drivers}
                  city={team?.city || ""}
                  onChanged={load}
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <DayTotals refreshKey={refreshKey} />
          <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
            <h2 className="font-heading font-bold text-sm mb-3">Ζωντανή ροή</h2>
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
        </div>
      </div>
    </FleetShell>
  );
}
