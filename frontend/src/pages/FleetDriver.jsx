import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CloudOff } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import {
  apiFleetDriverBoard,
  apiFleetClaimOrder,
  apiFleetOrderStatus,
  apiFleetDriverShift,
} from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import FleetShell from "@/pages/fleet/FleetShell";
import { DriverCard } from "@/pages/fleet/DriverCard";
import EmptyState from "@/components/EmptyState";
import DriverStats from "@/pages/fleet/DriverStats";
import DriverMineTab from "@/pages/fleet/DriverMineTab";
import ProblemModal from "@/pages/fleet/ProblemModal";
import { notify } from "@/pages/fleet/alerts";
import { NEXT_ACTION, useAccountCenter } from "@/pages/fleet/utils";
import { ensurePushOnShiftStart, pushSupport } from "@/lib/push";

const POLL_MS = 5000;
const QUEUE_KEY = "orderdeck_fleet_status_queue";

// Ουρά αλλαγών κατάστασης για offline: αν το δίκτυο λείπει, η αλλαγή γράφεται
// τοπικά και συγχρονίζεται στο επόμενο poll. Το claim ΔΕΝ μπαίνει ποτέ σε ουρά
// (πρέπει να είναι ατομικό στον server).
const readQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
};
const writeQueue = (q) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));

// Η οθόνη του οδηγού (κινητό), σε τρία tabs: «Ελεύθερες» (μεγάλο «Την παίρνω»),
// «Δικές μου» (κουμπιά προόδου + παραδομένες σήμερα + ιστορικό με φίλτρο
// περιόδου) και «Στατιστικά». Tap στη διεύθυνση → Google Maps.
export default function FleetDriver() {
  const { team } = useFleet();
  const [board, setBoard] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [pending, setPending] = useState(readQueue().length);
  // Η καρτέλα ζει στο URL (?tab=) ώστε να την οδηγεί και το burger menu —
  // κενή μέχρι το πρώτο board, όπου ορίζεται ανάλογα με τις ενεργές
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const setTab = useCallback(
    (t) => setSearchParams({ tab: t }, { replace: true }),
    [setSearchParams]
  );
  const setDefaultTab = useCallback(
    (t) =>
      setSearchParams(
        (prev) => (prev.get("tab") ? prev : new URLSearchParams({ tab: t })),
        { replace: true }
      ),
    [setSearchParams]
  );
  const [shiftBusy, setShiftBusy] = useState(false);
  const [problemOrder, setProblemOrder] = useState(null);
  // Tap σε pin του χάρτη → η κάρτα της παραγγελίας φωτίζεται και σκρολάρει σε θέα
  const [highlightId, setHighlightId] = useState(null);
  // Default κέντρο του συμπαγούς χάρτη: pin εταιρείας → geocode πόλης → Ελλάδα
  const mapCenter = useAccountCenter(team?.lat, team?.lng, team?.city);
  const highlightTimer = useRef(null);
  // Γνωστή κατάσταση για ανίχνευση αλλαγών μεταξύ polls (ειδοποιήσεις)
  const seenRef = useRef(null); // {available:Set, mine:Set, updated:Map(id→updated_at)}

  const highlightOrder = (id) => {
    setHighlightId(id);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 3000);
    document
      .querySelector(`[data-testid="fleet-drv-order-${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  const flushQueue = useCallback(async () => {
    const q = readQueue();
    if (!q.length) return;
    const rest = [];
    for (const item of q) {
      try {
        await apiFleetOrderStatus(item.id, item.status);
      } catch (err) {
        // Network down → κράτα το για αργότερα· απάντηση server (π.χ. 400) → πέτα το
        if (!err?.response) rest.push(item);
      }
    }
    writeQueue(rest);
    setPending(rest.length);
  }, []);

  // Σύγκριση με το προηγούμενο poll → ήχος/δόνηση για νέα ελεύθερη (μόνο σε
  // βάρδια), απευθείας ανάθεση από διαχειριστή, ή επεξεργασία claimed παραγγελίας
  const detectChanges = useCallback((b) => {
    const prev = seenRef.current;
    if (prev) {
      let ring = false;
      for (const o of b.available) {
        if (!prev.available.has(o.id) && !prev.mine.has(o.id) && b.on_shift) {
          toast.message(o.urgent ? `⚡ Επείγουσα παραγγελία #${o.number}` : `Νέα παραγγελία #${o.number}`);
          ring = true;
        }
      }
      for (const o of b.mine) {
        // Το δικό μας claim μπαίνει στο seenRef άμεσα (στο claim) — ό,τι νέο
        // εμφανίζεται εδώ είναι απευθείας ανάθεση από τον διαχειριστή
        if (!prev.mine.has(o.id)) {
          toast.message(`Σας ανατέθηκε η #${o.number}`);
          ring = true;
        } else if (prev.mine.has(o.id)) {
          const prevUpd = prev.updated.get(o.id);
          if (o.updated_at && o.updated_at !== prevUpd) {
            toast.message(`Η #${o.number} ενημερώθηκε`);
            ring = true;
          }
        }
      }
      if (ring) notify();
    }
    seenRef.current = {
      available: new Set(b.available.map((o) => o.id)),
      mine: new Set(b.mine.map((o) => o.id)),
      updated: new Map(b.mine.map((o) => [o.id, o.updated_at])),
    };
  }, []);

  const load = useCallback(() => {
    flushQueue().then(() =>
      apiFleetDriverBoard()
        .then((b) => {
          detectChanges(b);
          setBoard(b);
          setDefaultTab(b.mine.length ? "mine" : "free");
        })
        .catch(() => {})
    );
  }, [flushQueue, detectChanges, setDefaultTab]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const claim = async (o) => {
    setBusyId(o.id);
    try {
      const doc = await apiFleetClaimOrder(o.id);
      toast.success(`Η #${o.number} είναι δική σας`);
      // Στο seenRef αμέσως — να μην ηχήσει «Σας ανατέθηκε» στο επόμενο poll
      if (seenRef.current) {
        seenRef.current.mine.add(o.id);
        seenRef.current.available.delete(o.id);
      }
      // Άμεση μετακίνηση στο «Δικές μου» + αλλαγή tab, πριν το επόμενο poll
      setBoard((b) =>
        b && {
          ...b,
          available: b.available.filter((x) => x.id !== o.id),
          mine: [...b.mine, doc],
        }
      );
      setTab("mine");
    } catch (err) {
      if (err?.response?.status === 409) toast.error("Πάρθηκε από άλλον οδηγό");
      else toast.error(formatApiError(err));
    } finally {
      setBusyId(null);
      load();
    }
  };

  const advance = async (o) => {
    const next = NEXT_ACTION[o.status];
    if (!next) return;
    setBusyId(o.id);
    try {
      await apiFleetOrderStatus(o.id, next.status);
    } catch (err) {
      if (!err?.response) {
        // Offline: γράψε στην ουρά + αισιόδοξη ενημέρωση της οθόνης
        const q = readQueue();
        q.push({ id: o.id, status: next.status });
        writeQueue(q);
        setPending(q.length);
        setBoard((b) =>
          b && {
            ...b,
            mine:
              next.status === "delivered"
                ? b.mine.filter((x) => x.id !== o.id)
                : b.mine.map((x) => (x.id === o.id ? { ...x, status: next.status } : x)),
            delivered:
              next.status === "delivered"
                ? [{ ...o, status: "delivered" }, ...(b.delivered || [])]
                : b.delivered,
            delivered_today: b.delivered_today + (next.status === "delivered" ? 1 : 0),
          }
        );
        toast.message("Χωρίς σύνδεση — θα συγχρονιστεί αυτόματα");
      } else {
        toast.error(formatApiError(err));
      }
    } finally {
      setBusyId(null);
      load();
    }
  };

  const toggleShift = async () => {
    if (!board) return;
    setShiftBusy(true);
    try {
      const r = await apiFleetDriverShift(!board.on_shift);
      setBoard((b) => b && { ...b, on_shift: r.on_shift });
      toast.success(r.on_shift ? "Καλή βάρδια! 🛵" : "Τέλος βάρδιας — καλή ξεκούραση");
      if (r.on_shift) {
        // Έναρξη βάρδιας (user gesture) → άδεια + συνδρομή push, εκτός αν ο
        // οδηγός το έχει κλείσει ρητά. Σε μη υποστηριζόμενο setup (π.χ. iOS
        // χωρίς εγκατάσταση) μία διακριτική υπόδειξη ανά συσκευή.
        const support = pushSupport();
        if (!support.ok) {
          if (!localStorage.getItem("orderdeck_fleet_push_notice")) {
            localStorage.setItem("orderdeck_fleet_push_notice", "1");
            toast.message(support.reason);
          }
        } else {
          ensurePushOnShiftStart("driver").then(() =>
            window.dispatchEvent(new Event("orderdeck-push-changed"))
          );
        }
      }
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setShiftBusy(false);
    }
  };

  const available = board?.available || [];
  const mine = board?.mine || [];
  const delivered = board?.delivered || [];
  const onShift = !!board?.on_shift;

  const tabBtn = (key, label, count = null) => (
    <button
      onClick={() => setTab(key)}
      data-testid={`fleet-drv-tab-${key}`}
      className={`h-14 rounded-lg font-bold text-sm transition-colors ${
        tab === key
          ? "bg-brand text-white"
          : "bg-[#3D1620] border border-[#723645] text-neutral-300 active:bg-[#4a1c28]"
      }`}
    >
      {label}
      {count !== null && (
        <span className={tab === key ? "text-white/80" : "text-neutral-500"}> ({count})</span>
      )}
    </button>
  );

  return (
    <FleetShell
      actions={
        pending > 0 ? (
          <span
            className="flex items-center gap-1 text-[11px] text-gold px-2"
            title="Αλλαγές σε αναμονή συγχρονισμού"
            data-testid="fleet-drv-pending"
          >
            <CloudOff className="w-3.5 h-3.5" /> {pending}
          </span>
        ) : null
      }
    >
      <div className="max-w-md mx-auto space-y-4">
        {board && (
          <button
            onClick={toggleShift}
            disabled={shiftBusy}
            data-testid="fleet-drv-shift"
            className={`w-full h-12 rounded-lg font-bold text-sm border transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${
              onShift
                ? "border-[#34C759]/50 bg-[#34C759]/10 text-[#5BD778]"
                : "border-[#723645] bg-[#3D1620] text-neutral-300"
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${onShift ? "bg-[#34C759]" : "bg-neutral-600"}`} />
            {onShift ? "Σε βάρδια — Τέλος βάρδιας;" : "Ξεκινάω βάρδια 🛵"}
          </button>
        )}
        {board && !onShift && (
          <div className="text-[11px] text-neutral-500 text-center -mt-2">
            Εκτός βάρδιας δεν θα ακούτε ειδοποιήσεις για νέες παραγγελίες
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {tabBtn("free", "Ελεύθερες 🔴", available.length)}
          {tabBtn("mine", "Δικές μου", mine.length)}
          {tabBtn("stats", "Στατιστικά")}
        </div>

        {board && tab !== "stats" && (
          <div className="text-xs text-neutral-400 text-center">
            Σημερινές παραδόσεις σας: <span className="text-white font-bold">{board.delivered_today}</span>
          </div>
        )}

        {tab === "free" && (
          <section>
            {available.length === 0 ? (
              <EmptyState text="Καμία διαθέσιμη παραγγελία" />
            ) : (
              <div className="space-y-3">
                {available.map((o) => (
                  <DriverCard key={o.id} o={o} city={team?.city || ""}>
                    <button
                      disabled={busyId === o.id}
                      onClick={() => claim(o)}
                      data-testid={`fleet-claim-${o.id}`}
                      className="w-full h-14 mt-3 rounded-lg bg-[#34C759] hover:bg-[#2eb350] text-black font-bold text-base disabled:opacity-60"
                    >
                      Την παίρνω 🛵
                    </button>
                  </DriverCard>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "mine" && (
          <DriverMineTab
            mine={mine}
            delivered={delivered}
            city={team?.city || ""}
            mapCenter={mapCenter}
            busyId={busyId}
            onAdvance={advance}
            onProblem={setProblemOrder}
            highlightId={highlightId}
            onPinTap={highlightOrder}
          />
        )}

        {tab === "stats" && <DriverStats />}
      </div>

      {problemOrder && (
        <ProblemModal
          order={problemOrder}
          onClose={() => setProblemOrder(null)}
          onReported={load}
        />
      )}
    </FleetShell>
  );
}
