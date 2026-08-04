import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Handshake } from "lucide-react";
import { useAuth } from "@/context/shared/AuthContext";
import { apiStoreFleetDispatch } from "@/lib/api";
import DispatchCard from "./dispatch/DispatchCard";

const POLL_MS = 8000;

// Καρτέλα «Αποστολή παραγγελίας» — ΜΟΝΟ στο πλάνο OrderDeck Fleet.
// Κάθε τυπωμένη παραγγελία ΠΑΡΑΔΟΣΗΣ της ημέρας (ταμείο/τηλέφωνο + αποδεκτές
// delivery παραγγελίες πλατφορμών) γίνεται κάρτα: «Αποστολή» την ανεβάζει στους
// διανομείς της συνεργαζόμενης εταιρείας (ίδιος μηχανισμός με το store app).
// Χωρίς ενεργή συνεργασία η αποστολή είναι κλειδωμένη, με παραπομπή στη σελίδα
// των συνεργασιών.
export default function DispatchTab() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const teamIdRef = useRef(teamId);
  teamIdRef.current = teamId;

  const load = useCallback(() => {
    apiStoreFleetDispatch()
      .then((d) => {
        setData(d);
        const parts = d.partnerships || [];
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
  }, [load]);

  const partnerships = data?.partnerships || [];
  const orders = data?.orders || [];
  const city = user?.store_city || "";

  return (
    <main className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 xl:p-6" data-testid="dispatch-tab">
      {/* Επιλογή εταιρείας: εμφανίζεται μόνο όταν υπάρχουν πολλές συνεργασίες */}
      {partnerships.length > 1 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] uppercase tracking-widest font-bold text-neutral-500 shrink-0">
            Εταιρεία διανομής
          </span>
          <select
            value={teamId || ""}
            onChange={(e) => setTeamId(e.target.value)}
            data-testid="dispatch-company-select"
            className="h-10 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame"
          >
            {partnerships.map((p) => (
              <option key={p.team_id} value={p.team_id}>
                {p.team_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {partnerships.length === 0 && (
        <div
          className="mb-3 p-3 rounded-lg border border-gold/40 bg-gold/10 text-sm text-gold flex items-center gap-2"
          data-testid="dispatch-no-partner"
        >
          <Handshake className="w-4 h-4 shrink-0" />
          <span>
            Καμία ενεργή συνεργασία με εταιρεία διανομής —{" "}
            <Link to="/app/fleet/partners" className="font-bold underline">
              στείλτε αίτημα συνεργασίας
            </Link>
          </span>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="w-16 h-16 rounded-full bg-[#4A1B27] border border-[#723645] flex items-center justify-center">
            <Send className="w-7 h-7 text-flame" />
          </div>
          <div className="font-heading text-xl text-white mt-4">Καμία παραγγελία παράδοσης</div>
          <div className="text-sm text-neutral-400 mt-2 max-w-sm">
            Μόλις τυπωθεί μια παραγγελία παράδοσης, θα εμφανιστεί εδώ για αποστολή στους
            διανομείς.
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((o) => (
            <DispatchCard
              key={o.id}
              order={o}
              teamId={teamId}
              city={city}
              canSend={!!teamId}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </main>
  );
}
