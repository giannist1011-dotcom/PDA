import { eur, formatGRDateTime } from "@/lib/format";
import { TYPE_LABELS } from "./utils";

// ---------- Printable Z-report (uses the global 80mm #print-area CSS) ----------
export default function ZReportPrint({ report, restaurantName }) {
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
