// Kiosk Relay — αποδίδει ένα print_job σε HTML string για το κρυφό print iframe
// του σταθμού. Επαναχρησιμοποιεί τα ΙΔΙΑ components με την απευθείας εκτύπωση
// (ReceiptCopy / KitchenSlip / ZReportPrint) ώστε το χαρτί να βγαίνει πανομοιότυπο.
import { renderToStaticMarkup } from "react-dom/server";
import { ReceiptCopy } from "@/components/Receipt";
import KitchenSlip from "@/pages/table-order/KitchenSlip";
import ZReportPrint from "@/pages/day-close/ZReportPrint";
import { copyLabel } from "@/lib/receiptText";

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderJobHtml(job, user) {
  const p = job.payload || null;
  if (p?.order) {
    // Αντίγραφα/ετικέτες: ίδια λογική με το <Receipt /> — ρυθμίσεις του λογαριασμού
    const copies = Math.max(1, Math.min(10, Number(user?.print_copies) || 1));
    const withLabels = copies > 1 && !!user?.print_copy_labels;
    const inner = Array.from({ length: copies }, (_, i) =>
      `<div${i < copies - 1 ? ' style="break-after:page"' : ""}>` +
      renderToStaticMarkup(
        <ReceiptCopy order={p.order} label={withLabels ? copyLabel(i) : null} />
      ) +
      "</div>"
    ).join("");
    return `<div id="print-area">${inner}</div>`;
  }
  if (p?.slip) return renderToStaticMarkup(<KitchenSlip slip={p.slip} />);
  if (p?.report) {
    return renderToStaticMarkup(
      <ZReportPrint report={p.report} restaurantName={p.restaurant_name} />
    );
  }
  // Fallback: jobs μόνο με plain text (42 στήλες) — π.χ. παλιά jobs του Print Bridge
  const texts = job.texts || [];
  return (
    '<div id="print-area">' +
    texts
      .map(
        (t, i) =>
          `<pre${i < texts.length - 1 ? ' style="break-after:page"' : ""}>${escapeHtml(t)}</pre>`
      )
      .join("") +
    "</div>"
  );
}
