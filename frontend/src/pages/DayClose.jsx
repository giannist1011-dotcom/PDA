import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Printer, RefreshCcw } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  apiDaySummary,
  apiCloseDay,
  apiListDayReports,
  apiBusinessDays,
  formatApiError,
} from "@/lib/api";
import { printZReport } from "@/lib/print";
import { useBusinessDay, businessDayLabel } from "@/lib/businessDay";
import ZReportPrint from "./day-close/ZReportPrint";
import DayPicker from "./day-close/DayPicker";
import DaySummary from "./day-close/DaySummary";
import PastReports from "./day-close/PastReports";

// Το «Κλείσιμο ημέρας» δουλεύει σε ΕΡΓΑΣΙΜΕΣ ημέρες (ωράριο μαγαζιού): αν το
// μαγαζί κλείνει 02:00, οι παραγγελίες της 01:30 ανήκουν στην προηγούμενη ημέρα.
// Κλείνει πάντα η τρέχουσα· οι παλιές ημέρες είναι μόνο για επανεκτύπωση.
export default function DayClose() {
  const { user, canManage } = useAuth();
  const { today: bizToday, rangeLabel } = useBusinessDay();
  const [days, setDays] = useState([]);
  const [today, setToday] = useState(bizToday);
  const [selected, setSelected] = useState(bizToday);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [reports, setReports] = useState([]);
  const [printReport, setPrintReport] = useState(null);

  const restaurantName = user?.restaurant_name || "";
  const isCurrent = selected === today;

  const loadDays = async () => {
    try {
      const d = await apiBusinessDays();
      setDays(d.days || []);
      setToday(d.today);
      return d.today;
    } catch (e) {
      toast.error(formatApiError(e));
      return null;
    }
  };

  const loadSummary = async (day) => {
    setLoading(true);
    try {
      setSummary(await apiDaySummary(day));
    } catch (e) {
      toast.error(formatApiError(e));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    if (!canManage) return;
    try {
      setReports(await apiListDayReports());
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  useEffect(() => {
    (async () => {
      const t = await loadDays();
      if (t) setSelected(t);
      await loadSummary(t || bizToday);
      await loadReports();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickDay = (day) => {
    setSelected(day);
    loadSummary(day);
  };

  const printZ = (report) => {
    setPrintReport(report);
    setTimeout(() => printZReport(user, report, restaurantName), 150);
  };

  const handleClose = async () => {
    if (!summary) return;
    if (
      !window.confirm(
        `Κλείσιμο ημέρας ${businessDayLabel(summary.date)}; Καλύπτει ${rangeLabel(
          summary
        )}. Η αναφορά θα αποθηκευτεί και θα εκτυπωθεί.`
      )
    ) {
      return;
    }
    setClosing(true);
    try {
      const saved = await apiCloseDay(summary.date);
      printZ(saved);
      toast.success("Η ημέρα έκλεισε — η αναφορά αποθηκεύτηκε");
      await Promise.all([loadReports(), loadDays()]);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setClosing(false);
    }
  };

  // Παλιά ημέρα: επανεκτύπωση της σύνοψης όπως είναι τώρα (read-only)
  const handleReprint = () => {
    if (!summary) return;
    printZ({ ...summary, reprint: true });
  };

  return (
    <AppShell title="Κλείσιμο ημέρας">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1100px] mx-auto w-full">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-flame" />
              Κλείσιμο ημέρας
            </h2>
            <p className="text-sm text-neutral-400 mt-1" data-testid="dayclose-date">
              {summary ? rangeLabel(summary) : "…"}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <DayPicker days={days} value={selected} onChange={pickDay} today={today} />
            <div className="flex gap-2">
              <Button
                onClick={() => loadSummary(selected)}
                disabled={loading}
                data-testid="dayclose-refresh-btn"
                className="h-11 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Ανανέωση
              </Button>
              {isCurrent ? (
                <Button
                  onClick={handleClose}
                  disabled={loading || closing || !summary}
                  data-testid="dayclose-print-btn"
                  className="h-11 px-5 bg-brand hover:bg-brand-hover font-bold"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {closing ? "Κλείσιμο..." : "Εκτύπωση αναφοράς"}
                </Button>
              ) : (
                <Button
                  onClick={handleReprint}
                  disabled={loading || !summary}
                  data-testid="dayclose-reprint-btn"
                  className="h-11 px-5 bg-brand hover:bg-brand-hover font-bold"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Επανεκτύπωση
                </Button>
              )}
            </div>
          </div>
        </div>

        {!isCurrent && (
          <div
            className="mb-5 px-4 py-3 rounded-lg bg-[#4A1B27] border border-[#723645] text-sm text-neutral-300"
            data-testid="dayclose-readonly-note"
          >
            Παλαιότερη εργάσιμη ημέρα — μόνο προβολή και επανεκτύπωση. Το κλείσιμο
            αφορά πάντα την τρέχουσα ημέρα ({businessDayLabel(today)}).
          </div>
        )}

        {loading ? (
          <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
        ) : !summary ? (
          <div className="text-neutral-500 py-12 text-center">Σφάλμα φόρτωσης</div>
        ) : (
          <DaySummary summary={summary} />
        )}

        {canManage && <PastReports reports={reports} onPrint={printZ} />}
      </main>

      <ZReportPrint report={printReport} restaurantName={restaurantName} user={user} />
    </AppShell>
  );
}
