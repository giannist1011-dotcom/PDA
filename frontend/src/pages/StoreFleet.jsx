import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { apiStoreFleetBoard, apiStoreFleetCancelOrder } from "@/lib/api";
import OrderCard from "@/pages/fleet/OrderCard";
import StoreOrderForm from "@/pages/store-fleet/StoreOrderForm";

const POLL_MS = 6000;
// Ενεργές για το κατάστημα: και οι προγραμματισμένες (⏳ πριν τη δημοσίευση)
const ACTIVE_STATUSES = ["scheduled", "waiting", "pickup", "enroute"];

// FleetDeck καταστήματος — κύρια οθόνη: on-shift οδηγοί της επιλεγμένης
// εταιρείας, φόρμα ανεβάσματος, και οι παραγγελίες του καταστήματος ως κάρτες
// με τα ίδια tabs/χρώματα με τον πίνακα εταιρείας. Polling 6''.
export default function StoreFleet() {
  const { user } = useAuth();
  const [board, setBoard] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [tab, setTab] = useState("active");
  const [showCancelled, setShowCancelled] = useState(false);
  const teamIdRef = useRef(teamId);
  teamIdRef.current = teamId;

  const load = useCallback(() => {
    apiStoreFleetBoard(teamIdRef.current)
      .then((b) => {
        setBoard(b);
        // Auto-επιλογή εταιρείας: μία ενεργή συνεργασία → αυτή· αλλιώς η πρώτη.
        // Αν η επιλεγμένη τερματίστηκε εν τω μεταξύ, γύρνα στην πρώτη διαθέσιμη.
        const parts = b.partnerships || [];
        const current = teamIdRef.current;
        if (!current || !parts.some((p) => p.team_id === current)) {
          setTeamId(parts[0]?.team_id || null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load, teamId]);

  const partnerships = board?.partnerships || [];
  const drivers = board?.drivers || [];
  const orders = board?.orders || [];
  const active = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) =>
      !!b.urgent !== !!a.urgent ? (b.urgent ? 1 : -1) : b.created_at.localeCompare(a.created_at)
    );
  const completed = orders
    .filter((o) => o.status === "delivered")
    .sort((a, b) =>
      (b.delivered_at || b.created_at).localeCompare(a.delivered_at || a.created_at)
    );
  const cancelled = orders.filter((o) => o.status === "cancelled");
  const selectedName = partnerships.find((p) => p.team_id === teamId)?.team_name;

  const tabBtn = (key, label, count) => (
    <button
      onClick={() => setTab(key)}
      data-testid={`store-fleet-tab-${key}`}
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
      <div className="border border-dashed border-[#723645]/60 rounded-lg p-6 text-center text-sm text-neutral-500">
        {empty}
      </div>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            city={user?.store_city || ""}
            storeMode
            onCancel={(order) => apiStoreFleetCancelOrder(order.id)}
            onChanged={load}
          />
        ))}
      </div>
    );

  return (
    <AppShell title="Παραγγελίες">
      <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-6xl mx-auto w-full">
        {/* On-shift οδηγοί της επιλεγμένης εταιρείας — πράσινες κουκκίδες, live */}
        {teamId && (
          <div className="flex flex-wrap items-center gap-2" data-testid="store-fleet-drivers-strip">
            <span className="text-[11px] uppercase tracking-widest font-bold text-neutral-500">
              Οδηγοί σε βάρδια{selectedName ? ` — ${selectedName}` : ""}
            </span>
            {drivers.length === 0 ? (
              <span className="text-xs text-neutral-500">Κανένας αυτή τη στιγμή</span>
            ) : (
              drivers.map((d) => (
                <span
                  key={d.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs border-[#34C759]/50 bg-[#34C759]/10 text-white"
                >
                  <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                  {d.name}
                </span>
              ))
            )}
          </div>
        )}

        <StoreOrderForm
          storeName={board?.store_name || user?.restaurant_name || ""}
          city={user?.store_city || ""}
          storeLat={user?.store_lat ?? null}
          storeLng={user?.store_lng ?? null}
          radiusKm={user?.delivery_radius_km ?? null}
          partnerships={partnerships}
          teamId={teamId}
          onTeamChange={setTeamId}
          onCreated={load}
        />

        <div className="grid grid-cols-2 gap-2">
          {tabBtn("active", "Παραγγελίες", active.length)}
          {tabBtn("done", "Ολοκληρωμένες", completed.length)}
        </div>

        {tab === "active" && (
          <section data-testid="store-fleet-tab-panel-active">
            {cardsGrid(active, "Καμία ενεργή παραγγελία")}
          </section>
        )}

        {tab === "done" && (
          <section className="space-y-3" data-testid="store-fleet-tab-panel-done">
            {cardsGrid(completed, "Καμία ολοκληρωμένη παραγγελία σήμερα")}
            {cancelled.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCancelled((v) => !v)}
                  data-testid="store-fleet-cancelled-toggle"
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
      </main>
    </AppShell>
  );
}
