import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarCheck,
  Printer,
  RefreshCcw,
  Receipt as ReceiptIcon,
  Euro,
  Percent,
  Ban,
  Wallet,
  Scale,
  Truck,
  ShoppingBag,
  Store,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  apiDaySummary,
  apiCloseDay,
  apiListDayReports,
  formatApiError,
} from "@/lib/api";
import { eur, todayISO, formatGRDateTime } from "@/lib/format";

const TYPE_LABELS = { delivery: "Παράδοση", takeaway: "Takeaway", store: "Κατάστημα" };
const TYPE_ICONS = { delivery: Truck, takeaway: ShoppingBag, store: Store };

const fmtDateGR = (iso) => {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("el-GR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

// ---------- Printable Z-report (uses the global 80mm #print-area CSS) ----------
function ZReportPrint({ report, restaurantName }) {
  if (!report) return null;
  return (
    <div id="print-area" className="hidden print:block">
      <div className="receipt-title text-center">
        {(restaurantName || "POS").toUpperCase()}
      </div>
      <div style={{ textAlign: "center", fontSize: 12, fontWeight: 800 }}>
        ΚΛΕΙΣΙΜΟ ΗΜΕΡΑΣ (Z)
      </div>
      <hr />
      <div>Ημέρα: {report.date}</div>
      <div>Κλείσιμο: {formatGRDateTime(report.closed_at || new Date().toISOString())}</div>
      <hr />
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
        <span>Παραγγελίες</span>
        <span>{report.total_orders}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14 }}>
        <span>ΤΖΙΡΟΣ</span>
        <span>{eur(report.total_revenue)}</span>
      </div>
      <hr />
      <div style={{ fontWeight: 800, fontSize: 11 }}>ΑΝΑ ΠΗΓΗ</div>
      {(report.by_source || []).map((s) => (
        <div key={s.source} style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{s.source} ({s.count})</span>
          <span>{eur(s.revenue)}</span>
        </div>
      ))}
      {(report.by_type || []).length > 0 && (
        <>
          <hr />
          <div style={{ fontWeight: 800, fontSize: 11 }}>ΑΝΑ ΤΥΠΟ</div>
          {(report.by_type || []).map((t) => (
            <div key={t.type} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{TYPE_LABELS[t.type] || t.type} ({t.count})</span>
              <span>{eur(t.revenue)}</span>
            </div>
          ))}
        </>
      )}
      <hr />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Εκπτώσεις</span>
        <span>-{eur(report.total_discounts)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Ακυρωμένες</span>
        <span>{report.cancelled_count}</span>
      </div>
      {report.scheduled_pending > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Εκκρεμείς προγραμμ.</span>
          <span>{report.scheduled_pending}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Έξοδα ημέρας</span>
        <span>-{eur(report.total_expenses)}</span>
      </div>
      <hr />
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14 }}>
        <span>ΚΑΘΑΡΟ</span>
        <span>{eur(report.net_result)}</span>
      </div>
      <hr />
      <div style={{ textAlign: "center", fontSize: 10 }}>OrderDeck — Αναφορά Z</div>
    </div>
  );
}

const SummaryRow = ({ icon: Icon, label, value, valueClass = "text-white", testId }) => (
  <div
    className="flex items-center justify-between p-3 bg-[#0D0D0D] border border-[#333] rounded-md"
    data-testid={testId}
  >
    <span className="flex items-center gap-2 text-sm text-neutral-300">
      <Icon className="w-4 h-4 text-[#FF6B00]" />
      {label}
    </span>
    <span className={`font-mono font-bold ${valueClass}`}>{value}</span>
  </div>
);

export default function DayClose() {
  const { user, canManage } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [reports, setReports] = useState([]);
  const [printReport, setPrintReport] = useState(null);

  const restaurantName = user?.restaurant_name || "";

  const load = async () => {
    setLoading(true);
    try {
      setSummary(await apiDaySummary(todayISO()));
    } catch (e) {
      toast.error(formatApiError(e));
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
    load();
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const printZ = (report) => {
    setPrintReport(report);
    setTimeout(() => window.print(), 150);
  };

  const handleClose = async () => {
    if (!summary) return;
    if (!window.confirm(`Κλείσιμο ημέρας ${fmtDateGR(summary.date)}; Η αναφορά θα αποθηκευτεί και θα εκτυπωθεί.`)) {
      return;
    }
    setClosing(true);
    try {
      const saved = await apiCloseDay(summary.date);
      printZ(saved);
      toast.success("Η ημέρα έκλεισε — η αναφορά αποθηκεύτηκε");
      await loadReports();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setClosing(false);
    }
  };

  const bySource = summary?.by_source || [];
  const byType = summary?.by_type || [];

  return (
    <AppShell title="Κλείσιμο ημέρας">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1100px] mx-auto w-full">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-[#FF6B00]" />
              Κλείσιμο ημέρας
            </h2>
            <p className="text-sm text-neutral-400 mt-1" data-testid="dayclose-date">
              {summary ? fmtDateGR(summary.date) : "…"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={load}
              disabled={loading}
              data-testid="dayclose-refresh-btn"
              className="h-11 bg-[#1A1A1A] border border-[#333] hover:border-[#FF6B00] text-white"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Ανανέωση
            </Button>
            <Button
              onClick={handleClose}
              disabled={loading || closing || !summary}
              data-testid="dayclose-print-btn"
              className="h-11 px-5 bg-[#FF6B00] hover:bg-[#FF8533] font-bold"
            >
              <Printer className="w-4 h-4 mr-2" />
              {closing ? "Κλείσιμο..." : "Εκτύπωση αναφοράς"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
        ) : !summary ? (
          <div className="text-neutral-500 py-12 text-center">Σφάλμα φόρτωσης</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Totals */}
            <section className="p-5 bg-[#1A1A1A] border border-[#333] rounded-lg space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">
                Σύνοψη ημέρας
              </h3>
              <SummaryRow
                icon={ReceiptIcon}
                label="Παραγγελίες"
                value={summary.total_orders}
                testId="dayclose-orders"
              />
              <SummaryRow
                icon={Euro}
                label="Τζίρος"
                value={eur(summary.total_revenue)}
                valueClass="text-[#FF6B00] text-lg"
                testId="dayclose-revenue"
              />
              <SummaryRow
                icon={Percent}
                label="Σύνολο εκπτώσεων"
                value={`-${eur(summary.total_discounts)}`}
                valueClass="text-[#00E676]"
                testId="dayclose-discounts"
              />
              <SummaryRow
                icon={Ban}
                label="Ακυρωμένες παραγγελίες"
                value={summary.cancelled_count}
                valueClass="text-[#FF6961]"
                testId="dayclose-cancelled"
              />
              <SummaryRow
                icon={Wallet}
                label="Έξοδα ημέρας"
                value={`-${eur(summary.total_expenses)}`}
                valueClass="text-[#FFB300]"
                testId="dayclose-expenses"
              />
              <SummaryRow
                icon={Scale}
                label="Καθαρό αποτέλεσμα"
                value={eur(summary.net_result)}
                valueClass={summary.net_result >= 0 ? "text-[#00E676] text-lg" : "text-[#FF6961] text-lg"}
                testId="dayclose-net"
              />
            </section>

            {/* Breakdowns */}
            <section className="p-5 bg-[#1A1A1A] border border-[#333] rounded-lg">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">
                Ανά πηγή
              </h3>
              {bySource.length === 0 ? (
                <div className="text-neutral-500 text-sm py-3">Δεν υπάρχουν παραγγελίες</div>
              ) : (
                <div className="space-y-2 mb-5">
                  {bySource.map((s) => (
                    <div
                      key={s.source}
                      className="flex items-center justify-between text-sm"
                      data-testid={`dayclose-source-${s.source}`}
                    >
                      <span className="text-neutral-300">
                        {s.source} <span className="text-neutral-500">({s.count})</span>
                      </span>
                      <span className="font-mono font-bold text-white">{eur(s.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">
                Ανά τύπο
              </h3>
              {byType.length === 0 ? (
                <div className="text-neutral-500 text-sm py-3">Δεν υπάρχουν παραγγελίες</div>
              ) : (
                <div className="space-y-2">
                  {byType.map((t) => {
                    const Icon = TYPE_ICONS[t.type] || Store;
                    return (
                      <div
                        key={t.type}
                        className="flex items-center justify-between text-sm"
                        data-testid={`dayclose-type-${t.type}`}
                      >
                        <span className="flex items-center gap-2 text-neutral-300">
                          <Icon className="w-4 h-4 text-[#FF6B00]" />
                          {TYPE_LABELS[t.type] || t.type}{" "}
                          <span className="text-neutral-500">({t.count})</span>
                        </span>
                        <span className="font-mono font-bold text-white">{eur(t.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Past reports (owner only) */}
        {canManage && (
          <section className="mt-8 p-5 bg-[#1A1A1A] border border-[#333] rounded-lg" data-testid="dayclose-history">
            <h3 className="font-heading text-lg font-bold mb-4">Προηγούμενα κλεισίματα</h3>
            {reports.length === 0 ? (
              <div className="text-neutral-500 text-sm py-4 text-center">
                Δεν υπάρχουν αποθηκευμένες αναφορές
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-widest text-neutral-400 border-b border-[#333]">
                      <th className="py-2 px-3">Ημέρα</th>
                      <th className="py-2 px-3">Ώρα κλεισίματος</th>
                      <th className="py-2 px-3 text-right">Παραγγελίες</th>
                      <th className="py-2 px-3 text-right">Τζίρος</th>
                      <th className="py-2 px-3 text-right">Καθαρό</th>
                      <th className="py-2 px-3 w-14"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-[#222] last:border-0"
                        data-testid={`dayreport-row-${r.id}`}
                      >
                        <td className="py-2.5 px-3 font-mono text-white">{r.date}</td>
                        <td className="py-2.5 px-3 text-neutral-400 text-sm">
                          {formatGRDateTime(r.closed_at)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-neutral-300">
                          {r.total_orders}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#FF6B00]">
                          {eur(r.total_revenue)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold ${
                            r.net_result >= 0 ? "text-[#00E676]" : "text-[#FF6961]"
                          }`}
                        >
                          {eur(r.net_result)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => printZ(r)}
                            data-testid={`dayreport-print-${r.id}`}
                            className="p-2 text-neutral-400 hover:text-[#FF6B00]"
                            title="Επανεκτύπωση αναφοράς"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      <ZReportPrint report={printReport} restaurantName={restaurantName} />
    </AppShell>
  );
}
