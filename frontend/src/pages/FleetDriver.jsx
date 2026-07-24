import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, StickyNote, CloudOff, ChevronDown } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import { apiFleetDriverBoard, apiFleetClaimOrder, apiFleetOrderStatus } from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import FleetShell from "@/pages/fleet/FleetShell";
import { PAYMENT_LABELS, fmtMoney, fmtTime, mapsUrl } from "@/pages/fleet/utils";

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

const NEXT_ACTION = {
  pickup: { status: "enroute", label: "Ξεκινάω διαδρομή 🟢" },
  enroute: { status: "delivered", label: "Παραδόθηκε 🔵" },
};

// Κάρτα παραγγελίας οδηγού — module-level ώστε να μην γίνεται remount σε κάθε poll
function DriverCard({ o, city, dim = false, children }) {
  return (
    <div
      className={`bg-[#3D1620] border border-[#723645] rounded-lg p-4 ${dim ? "opacity-60" : ""}`}
      data-testid={`fleet-drv-order-${o.id}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-bold text-lg">#{o.number}</span>
        <span className="truncate text-neutral-300">{o.pickup_name}</span>
        <span className="ml-auto text-xs text-neutral-500">{fmtTime(o.created_at)}</span>
      </div>
      <a
        href={mapsUrl(o.address, city)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 mt-2 text-white active:text-flame"
      >
        <MapPin className="w-4 h-4 text-flame shrink-0" />
        <span className="underline underline-offset-2">{o.address}</span>
      </a>
      <div className="flex items-center gap-2 mt-2">
        <span className="font-bold text-gold text-lg">{fmtMoney(o.amount)}</span>
        <span className="text-sm text-neutral-400">{PAYMENT_LABELS[o.payment]}</span>
      </div>
      {o.notes && (
        <div className="flex items-start gap-1.5 mt-2 text-sm text-neutral-400">
          <StickyNote className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{o.notes}</span>
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="border border-dashed border-[#723645]/60 rounded-lg p-6 text-center text-sm text-neutral-500">
      {text}
    </div>
  );
}

// Η οθόνη του οδηγού (κινητό), σε δύο tabs: «Ελεύθερες» (μεγάλο «Την παίρνω»)
// και «Οι παραγγελίες μου» (κουμπιά προόδου + παραδομένες σήμερα στο κάτω μέρος).
// Tap στη διεύθυνση → Google Maps.
export default function FleetDriver() {
  const { team } = useFleet();
  const [board, setBoard] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [pending, setPending] = useState(readQueue().length);
  const [tab, setTab] = useState(null); // null μέχρι το πρώτο board → default ανά ενεργές
  const [showDelivered, setShowDelivered] = useState(false);

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

  const load = useCallback(() => {
    flushQueue().then(() =>
      apiFleetDriverBoard()
        .then((b) => {
          setBoard(b);
          setTab((t) => t ?? (b.mine.length ? "mine" : "free"));
        })
        .catch(() => {})
    );
  }, [flushQueue]);

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
      // Άμεση μετακίνηση στο «Οι παραγγελίες μου» + αλλαγή tab, πριν το επόμενο poll
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

  const available = board?.available || [];
  const mine = board?.mine || [];
  const delivered = board?.delivered || [];

  const tabBtn = (key, label, count) => (
    <button
      onClick={() => setTab(key)}
      data-testid={`fleet-drv-tab-${key}`}
      className={`h-14 rounded-lg font-bold text-base transition-colors ${
        tab === key
          ? "bg-brand text-white"
          : "bg-[#3D1620] border border-[#723645] text-neutral-300 active:bg-[#4a1c28]"
      }`}
    >
      {label} <span className={tab === key ? "text-white/80" : "text-neutral-500"}>({count})</span>
    </button>
  );

  return (
    <FleetShell
      actions={
        pending > 0 ? (
          <span className="flex items-center gap-1 text-[11px] text-gold px-2">
            <CloudOff className="w-3.5 h-3.5" /> {pending}
          </span>
        ) : null
      }
    >
      <div className="max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {tabBtn("free", "Ελεύθερες 🔴", available.length)}
          {tabBtn("mine", "Οι παραγγελίες μου", mine.length)}
        </div>

        {board && (
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
          <section className="space-y-4">
            {mine.length === 0 ? (
              <EmptyState text="Καμία ενεργή παραγγελία" />
            ) : (
              <div className="space-y-3">
                {mine.map((o) => (
                  <DriverCard key={o.id} o={o} city={team?.city || ""}>
                    <button
                      disabled={busyId === o.id}
                      onClick={() => advance(o)}
                      data-testid={`fleet-advance-${o.id}`}
                      className="w-full h-14 mt-3 rounded-lg bg-brand hover:bg-brand-hover text-white font-bold text-base disabled:opacity-60"
                    >
                      {NEXT_ACTION[o.status]?.label}
                    </button>
                  </DriverCard>
                ))}
              </div>
            )}

            {delivered.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDelivered((v) => !v)}
                  data-testid="fleet-drv-delivered-toggle"
                  className="w-full h-12 rounded-lg border border-[#723645]/60 text-sm text-neutral-400 flex items-center justify-center gap-2 active:bg-[#3D1620]"
                >
                  Παραδομένες σήμερα 🔵 ({delivered.length})
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDelivered ? "rotate-180" : ""}`} />
                </button>
                {showDelivered && (
                  <div className="space-y-3 mt-3">
                    {delivered.map((o) => (
                      <DriverCard key={o.id} o={o} city={team?.city || ""} dim />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </FleetShell>
  );
}
