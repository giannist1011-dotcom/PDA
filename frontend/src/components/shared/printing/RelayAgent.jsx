import { useEffect, useRef, useState } from "react";
import { Printer, AlertTriangle, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/shared/AuthContext";
import { apiRelayPoll, apiRelayAck, apiRelayRetry, apiRelayStatus, relayJobsStream } from "@/lib/api";
import { isRelayStation, subscribeRelayStation } from "@/lib/relayStation";
import { printHtmlInFrame } from "@/lib/printFrame";
import { renderJobHtml } from "@/components/shared/printing/relayRender";

// Ο σταθμός μαθαίνει τα νέα jobs κυρίως από SSE (/print/jobs/stream) — το poll
// είναι πλέον fallback όταν πέσει το stream + αραιό δίχτυ ασφαλείας όσο ζει.
const POLL_FALLBACK_MS = 2000; // χωρίς SSE → poll κάθε 2"
const POLL_SAFETY_MS = 30000; // με ζωντανό SSE → αραιό poll ασφαλείας
const SSE_RETRY_MS = 3000; // σιωπηλό reconnect του stream
const STATUS_MS = 30000; // έλεγχος «ζει ο σταθμός;» από τις άλλες συσκευές
const STALE_MS = 30000; // χωρίς poll για 30" → ο σταθμός θεωρείται κλειστός

const KIND_LABELS = { receipt: "Απόδειξη", kitchen: "Κουζίνα", zreport: "Αναφορά Z", test: "Δοκιμή" };

const jobTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
};

// ---------- Ο σταθμός: SSE (ή fallback poll) → claim → εκτύπωση σε κρυφό iframe → ack ----------
function StationLoop({ user }) {
  const [printedToday, setPrintedToday] = useState(0);
  const [failed, setFailed] = useState([]);
  const [connected, setConnected] = useState(true);
  const [open, setOpen] = useState(false);
  // Δευτερόλεπτα από τη δημιουργία του job (πάτημα «εκτύπωση» στη συσκευή)
  // μέχρι το window.print() στον σταθμό — για επαλήθευση της ταχύτητας.
  const [lastPrintSecs, setLastPrintSecs] = useState(null);
  const busyRef = useRef(false);
  const againRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let stopped = false;
    const sseUpRef = { current: false };
    const lastPollRef = { current: 0 };

    const tick = async () => {
      if (stopped) return;
      if (busyRef.current) {
        // Ήρθε SSE event ενώ τυπώνουμε → ξανά poll μόλις τελειώσει η ουρά
        againRef.current = true;
        return;
      }
      busyRef.current = true;
      try {
        lastPollRef.current = Date.now();
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
            const ms = Date.now() - new Date(job.created_at).getTime();
            if (Number.isFinite(ms)) setLastPrintSecs(Math.max(0, ms) / 1000);
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
        if (againRef.current && !stopped) {
          againRef.current = false;
          tick();
        }
      }
    };

    // SSE μέσω fetch stream (Authorization header) — ένα "event: job" σημαίνει
    // «υπάρχει νέο print_job», και ο σταθμός κάνει αμέσως poll για να το claim-άρει.
    const abort = new AbortController();
    const connectStream = async () => {
      while (!stopped) {
        try {
          const resp = await relayJobsStream(abort.signal);
          if (!resp.ok || !resp.body) throw new Error("stream unavailable");
          sseUpRef.current = true;
          tick(); // catch-up: ό,τι δημιουργήθηκε όσο δεν είχαμε stream
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done || stopped) break;
            buf += decoder.decode(value, { stream: true });
            const blocks = buf.split("\n\n");
            buf = blocks.pop();
            if (blocks.some((b) => b.includes("event: job"))) tick();
          }
        } catch {
          // πέφτουμε στο fallback poll — σιωπηλό reconnect πιο κάτω
        }
        sseUpRef.current = false;
        if (stopped) return;
        await new Promise((r) => setTimeout(r, SSE_RETRY_MS));
      }
    };
    connectStream();
    tick();
    // Fallback/δίχτυ ασφαλείας: πυκνό poll χωρίς SSE, αραιό όσο το SSE ζει
    const t = setInterval(() => {
      const gap = sseUpRef.current ? POLL_SAFETY_MS : POLL_FALLBACK_MS;
      if (Date.now() - lastPollRef.current >= gap) tick();
    }, 500);
    return () => {
      stopped = true;
      clearInterval(t);
      abort.abort();
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
      {lastPrintSecs != null && (
        <div
          className="text-[10px] font-bold text-neutral-400 bg-[#2A0E14]/90 border border-[#3a1a22] rounded-full px-2.5 py-0.5 shadow"
          data-testid="relay-last-print-timing"
        >
          Τελευταία εκτύπωση: {lastPrintSecs.toFixed(1).replace(".", ",")}s από το πάτημα
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
      className="print:hidden shrink-0 flex items-center gap-1.5 px-3 sm:px-4 h-8 bg-gold/15 border-b border-gold/40 text-gold text-[11px] sm:text-xs font-bold leading-none"
      data-testid="relay-station-down-banner"
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
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
