import { useEffect, useRef, useState } from "react";
import { Printer, AlertTriangle, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiRelayPoll, apiRelayAck, apiRelayRetry, apiRelayStatus } from "@/lib/api";
import { isRelayStation, subscribeRelayStation } from "@/lib/relayStation";
import { printHtmlInFrame } from "@/lib/printFrame";
import { renderJobHtml } from "@/components/printing/relayRender";

const POLL_MS = 2500; // poll του σταθμού
const STATUS_MS = 30000; // έλεγχος «ζει ο σταθμός;» από τις άλλες συσκευές
const STALE_MS = 30000; // χωρίς poll για 30" → ο σταθμός θεωρείται κλειστός

const KIND_LABELS = { receipt: "Απόδειξη", kitchen: "Κουζίνα", zreport: "Αναφορά Z", test: "Δοκιμή" };

const jobTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
};

// ---------- Ο σταθμός: poll → εκτύπωση σε κρυφό iframe → ack ----------
function StationLoop({ user }) {
  const [printedToday, setPrintedToday] = useState(0);
  const [failed, setFailed] = useState([]);
  const [connected, setConnected] = useState(true);
  const [open, setOpen] = useState(false);
  const busyRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (stopped || busyRef.current) return;
      busyRef.current = true;
      try {
        const res = await apiRelayPoll();
        if (stopped) return;
        setConnected(true);
        setFailed(res.failed || []);
        setPrintedToday(res.printed_today || 0);
        // Σειριακή εκτύπωση — τα jobs είναι ήδη claimed, δεν τυπώνονται δύο φορές
        for (const job of res.jobs || []) {
          if (stopped) break;
          try {
            await printHtmlInFrame(renderJobHtml(job, userRef.current));
            await apiRelayAck(job.id, "printed");
            setPrintedToday((n) => n + 1);
          } catch (e) {
            await apiRelayAck(job.id, "failed", String(e?.message || "Σφάλμα εκτύπωσης")).catch(() => {});
          }
        }
      } catch {
        if (!stopped) setConnected(false);
      } finally {
        busyRef.current = false;
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);

  const retry = async (jid) => {
    try {
      await apiRelayRetry(jid);
      setFailed((list) => list.filter((f) => f.id !== jid));
    } catch {
      // θα ξαναφανεί στο επόμενο poll αν απέτυχε το retry
    }
  };

  return (
    <div className="print:hidden fixed bottom-3 right-3 z-40 flex flex-col items-end gap-2" data-testid="relay-station-pill">
      {open && failed.length > 0 && (
        <div className="w-72 max-h-64 overflow-y-auto bg-[#1d090e] border border-[#723645] rounded-md shadow-xl p-2 space-y-1.5">
          <div className="text-[11px] font-bold text-red-400 px-1">Αποτυχημένες εκτυπώσεις</div>
          {failed.map((f) => (
            <div key={f.id} className="flex items-center gap-2 bg-[#2A0E14] border border-[#723645] rounded px-2 py-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-neutral-200">
                  {KIND_LABELS[f.kind] || f.kind} · {jobTime(f.created_at)}
                </div>
                {f.error && <div className="text-[10px] text-neutral-500 truncate">{f.error}</div>}
              </div>
              <button
                onClick={() => retry(f.id)}
                data-testid={`relay-retry-${f.id}`}
                className="shrink-0 flex items-center gap-1 h-7 px-2 rounded border border-flame/60 text-flame text-[11px] font-bold hover:bg-flame/15"
              >
                <RotateCcw className="w-3 h-3" /> Ξανά
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="relay-station-status"
        className={`flex items-center gap-2 h-9 px-3 rounded-full border text-xs font-bold shadow-lg transition-colors ${
          !connected
            ? "bg-[#2A0E14] border-red-500/60 text-red-400"
            : failed.length > 0
              ? "bg-[#2A0E14] border-gold/60 text-gold"
              : "bg-[#2A0E14] border-green-500/50 text-green-400"
        }`}
      >
        <Printer className="w-3.5 h-3.5" />
        {!connected
          ? "Σταθμός εκτύπωσης: χωρίς σύνδεση"
          : `Σταθμός εκτύπωσης: ενεργός · ${printedToday} ${printedToday === 1 ? "εκτύπωση" : "εκτυπώσεις"} σήμερα`}
        {failed.length > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" /> {failed.length}
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </span>
        )}
      </button>
    </div>
  );
}

// ---------- Οι άλλες συσκευές: banner όταν ο σταθμός δεν κάνει poll ----------
function StationDownBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const res = await apiRelayStatus();
        if (stopped) return;
        const seen = res.last_seen ? new Date(res.last_seen).getTime() : 0;
        setStale(!seen || Date.now() - seen > STALE_MS);
      } catch {
        // δεν ξέρουμε — μην τρομάζουμε με banner
      }
    };
    check();
    const t = setInterval(check, STATUS_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);

  if (!stale) return null;
  return (
    <div
      className="print:hidden shrink-0 flex items-center gap-2 px-3 sm:px-4 h-10 bg-gold/15 border-b border-gold/40 text-gold text-xs sm:text-sm font-bold"
      data-testid="relay-station-down-banner"
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="truncate">
        Ο σταθμός εκτύπωσης φαίνεται κλειστός — οι εκτυπώσεις δεν θα βγουν μέχρι να ανοίξει
      </span>
    </div>
  );
}

// Kiosk Relay: στον σταθμό τρέχει το poll/print loop + status pill, στις άλλες
// συσκευές μόνο το warning banner. Δεν κάνει τίποτα στα άλλα print modes.
export default function RelayAgent() {
  const { user } = useAuth();
  const [station, setStation] = useState(isRelayStation);

  useEffect(() => subscribeRelayStation(setStation), []);

  if (!user || user === false || user.print_mode !== "kiosk_relay") return null;
  return station ? <StationLoop user={user} /> : <StationDownBanner />;
}
