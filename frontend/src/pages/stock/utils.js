import { toast } from "sonner";
import { formatGRTime } from "@/lib/format";

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Εκτύπωση λίστας αγορών — χρησιμοποιείται από το κουμπί «Εκτύπωση» (Stock.jsx)
// και από την επανεκτύπωση στο ιστορικό εκτυπώσεων (PrintHistoryModal.jsx).
// when: προαιρετική ημερομηνία (ISO) για επανεκτύπωση παλιάς λίστας — default τώρα.
export function printShoppingList({ restaurantName, items, when = null }) {
  const now = when ? new Date(when) : new Date();
  const dateStr = now.toLocaleDateString("el-GR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = formatGRTime(now);

  const rows = items
    .map(
      (it) => `
      <li class="row ${it.bought ? "bought" : ""}">
        <span class="check">${it.bought ? "☒" : "☐"}</span>
        <span class="text">${escapeHtml(it.text)}</span>
      </li>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="utf-8" />
<title>Λίστα αγορών — ${escapeHtml(restaurantName || "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #111; margin: 24px; }
  header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { font-size: 13px; color: #7A3E52; }
  ul { list-style: none; padding: 0; margin: 0; }
  .row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px dashed #999; font-size: 16px; }
  .row.bought .text { text-decoration: line-through; color: #888; }
  .check { font-size: 20px; width: 22px; text-align: center; }
  .empty { color: #888; font-style: italic; padding: 20px 0; }
  footer { margin-top: 24px; font-size: 11px; color: #888; text-align: right; }
  @media print { body { margin: 12mm; } .no-print { display: none; } }
</style>
</head>
<body>
  <header>
    <h1>Λίστα αγορών</h1>
    <div class="meta">${escapeHtml(restaurantName || "")} · ${dateStr} · ${timeStr}</div>
  </header>
  ${items.length === 0 ? '<div class="empty">Η λίστα είναι άδεια</div>' : `<ul>${rows}</ul>`}
  <footer>Εκτυπώθηκε από το OrderDeck</footer>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 100));</script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) {
    toast.error("Ενεργοποιήστε τα pop-ups για εκτύπωση");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
