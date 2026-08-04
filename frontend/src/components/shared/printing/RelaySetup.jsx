import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Copy, Check, RefreshCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/shared/AuthContext";
import { apiCreatePrintJob, apiGetPrintJob, apiRelayStatus, formatApiError } from "@/lib/api";
import { receiptTexts, sampleOrder } from "@/lib/receiptText";
import { isRelayStation, setRelayStation, subscribeRelayStation } from "@/lib/relayStation";
import { printHtmlInFrame } from "@/lib/printFrame";
import { renderJobHtml } from "@/components/shared/printing/relayRender";

const KIOSK_CMD = 'chrome.exe --kiosk-printing --app=' + window.location.origin + '/app';

// Ο σταθμός θεωρείται «ενεργός» αν έκανε poll τα τελευταία 30"
const ONLINE_MS = 30 * 1000;

// Ρύθμιση «Kiosk Relay»: όλες οι συσκευές τυπώνουν μέσω του πάντα-ανοιχτού
// kiosk PC του καταστήματος — χωρίς desktop εφαρμογή.
export default function RelaySetup() {
  const { user } = useAuth();
  const [station, setStation] = useState(isRelayStation);
  const [lastSeen, setLastSeen] = useState(null);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => subscribeRelayStation(setStation), []);

  const loadStatus = async () => {
    try {
      const res = await apiRelayStatus();
      setLastSeen(res.last_seen || null);
    } catch {
      // αδιάφορο — μόνο ένδειξη
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const online = lastSeen && Date.now() - new Date(lastSeen).getTime() < ONLINE_MS;

  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(KIOSK_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Αποτυχία αντιγραφής");
    }
  };

  const testPrint = async () => {
    const order = sampleOrder(user);
    if (station) {
      // Ο σταθμός τυπώνει απευθείας — ίδια διαδρομή render με τα relay jobs
      try {
        await printHtmlInFrame(renderJobHtml({ payload: { order } }, user));
        toast.success("Η δοκιμαστική απόδειξη στάλθηκε στον εκτυπωτή");
      } catch {
        toast.error("Αποτυχία εκτύπωσης");
      }
      return;
    }
    setTesting(true);
    try {
      const job = await apiCreatePrintJob({
        texts: receiptTexts(order, user),
        kind: "test",
        payload: { order },
      });
      // Περίμενε τον σταθμό να το τυπώσει (poll ~12")
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await apiGetPrintJob(job.id);
        if (st.status === "printed") {
          toast.success("Η δοκιμαστική απόδειξη τυπώθηκε στον σταθμό ✓");
          setTesting(false);
          return;
        }
        if (st.status === "failed") {
          toast.error(`Αποτυχία εκτύπωσης: ${st.error || "άγνωστο σφάλμα"}`);
          setTesting(false);
          return;
        }
      }
      toast.warning("Η εκτύπωση στάλθηκε αλλά ο σταθμός δεν απάντησε ακόμα — ελέγξτε ότι το kiosk PC είναι ανοιχτό με την εφαρμογή");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setTesting(false);
      loadStatus();
    }
  };

  return (
    <div className="px-4 py-3 bg-[#2A0E14] border border-[#723645] rounded-md space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">Σταθμός εκτύπωσης (kiosk PC)</div>
          <div className="text-xs text-neutral-500">
            Το πάντα-ανοιχτό PC του ταμείου τυπώνει τις παραγγελίες από όλες τις
            συσκευές (tablet, κινητά) — χωρίς εγκατάσταση εφαρμογής
          </div>
        </div>
        <span
          data-testid="relay-status"
          className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full border ${
            online
              ? "text-green-400 border-green-500/50 bg-green-500/10"
              : "text-neutral-400 border-[#723645] bg-[#1d090e]"
          }`}
        >
          {online ? "● Ενεργός" : "○ Κλειστός"}
        </span>
      </div>

      <div className="flex items-center justify-between bg-[#1d090e] border border-[#723645] rounded-md px-3 py-2.5">
        <div>
          <div className="font-semibold text-sm">Αυτός ο υπολογιστής εκτυπώνει</div>
          <div className="text-xs text-neutral-500">
            Ενεργοποιήστε το ΜΟΝΟ στο kiosk PC που είναι συνδεδεμένος ο εκτυπωτής
          </div>
        </div>
        <Switch
          checked={station}
          onCheckedChange={(v) => setRelayStation(!!v)}
          data-testid="relay-station-switch"
        />
      </div>

      <ol className="text-xs text-neutral-400 space-y-1.5 list-decimal pl-4">
        <li>
          Στο kiosk PC: ορίστε τον θερμικό εκτυπωτή (π.χ. HPRT TP80N) ως{" "}
          <b>προεπιλεγμένο εκτυπωτή</b> των Windows, με χαρτί <b>80mm</b> και περιθώρια 0.
        </li>
        <li>
          Ανοίγετε εκεί την εφαρμογή ΠΑΝΤΑ μέσω Chrome με τη σημαία{" "}
          <code>--kiosk-printing</code> — φτιάξτε συντόμευση με γραμμή εντολής:
        </li>
      </ol>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] bg-[#1d090e] border border-[#723645] rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
          {KIOSK_CMD}
        </code>
        <button
          onClick={copyCmd}
          data-testid="relay-copy-cmd"
          className="h-8 px-2 rounded-md border border-[#723645] hover:border-flame text-neutral-300"
          title="Αντιγραφή"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="text-xs text-neutral-500">
        Ενεργοποιήστε τον διακόπτη στο kiosk PC και αφήστε την εφαρμογή ανοιχτή — κάθε
        εκτύπωση από οποιαδήποτε συσκευή του καταστήματος θα βγαίνει εκεί αυτόματα.
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={testPrint}
          disabled={testing}
          data-testid="relay-test-print"
          className="flex items-center gap-2 h-10 px-4 rounded-md bg-flame/15 text-flame border border-flame/60 text-sm font-bold hover:bg-flame/25 transition-colors disabled:opacity-60"
        >
          <Printer className="w-4 h-4" /> {testing ? "Εκτύπωση…" : "Δοκιμαστική εκτύπωση"}
        </button>
        <button
          onClick={loadStatus}
          data-testid="relay-refresh"
          className="flex items-center gap-2 h-10 px-3 rounded-md border border-[#723645] hover:border-flame text-sm text-neutral-300 transition-colors"
          title="Ανανέωση κατάστασης"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
