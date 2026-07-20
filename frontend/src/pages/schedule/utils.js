import { toast } from "sonner";
import { formatWeekRange } from "@/lib/dates";
import { formatGRDayMonth } from "@/lib/format";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ---------- Print helper: weekly schedule table ----------
export function printSchedule({ restaurantName, weekStart, employees, shifts, days }) {
  const findShift = (employeeId, dayIdx) =>
    shifts.find((s) => s.employee_id === employeeId && s.day === dayIdx);

  const headerCells = days
    .map((d) => `<th>${escapeHtml(d.short)}<br/><span class="sub">${formatGRDayMonth(d.date)}</span></th>`)
    .join("");

  const rows = employees
    .map((emp) => {
      const cells = days
        .map((d) => {
          const sh = findShift(emp.id, d.idx);
          return `<td>${sh ? `${sh.start}–${sh.end}` : "—"}</td>`;
        })
        .join("");
      return `<tr><td class="name">${escapeHtml(emp.name)}</td>${cells}</tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="utf-8" />
<title>Πρόγραμμα — ${escapeHtml(restaurantName || "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #111; margin: 24px; }
  header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { font-size: 13px; color: #7A3E52; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #999; padding: 8px 6px; text-align: center; }
  th { background: #eee; font-size: 11px; }
  th .sub { font-weight: normal; color: #666; }
  td.name { text-align: left; font-weight: bold; }
  .empty { color: #888; font-style: italic; padding: 20px 0; }
  footer { margin-top: 24px; font-size: 11px; color: #888; text-align: right; }
  @media print { body { margin: 12mm; } .no-print { display: none; } }
</style>
</head>
<body>
  <header>
    <h1>Εβδομαδιαίο πρόγραμμα</h1>
    <div class="meta">${escapeHtml(restaurantName || "")} · Εβδομάδα ${escapeHtml(formatWeekRange(weekStart))}</div>
  </header>
  ${employees.length === 0
    ? '<div class="empty">Δεν υπάρχουν υπάλληλοι</div>'
    : `<table><thead><tr><th>Υπάλληλος</th>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`}
  <footer>Εκτυπώθηκε από το OrderDeck</footer>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 100));</script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    toast.error("Ενεργοποιήστε τα pop-ups για εκτύπωση");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ---------- Plain-text schedule for Viber/WhatsApp/SMS ----------
export function buildScheduleText({ restaurantName, weekStart, employees, shifts, days }) {
  const findShift = (employeeId, dayIdx) =>
    shifts.find((s) => s.employee_id === employeeId && s.day === dayIdx);

  const lines = [];
  lines.push(`Πρόγραμμα εβδομάδας ${formatWeekRange(weekStart)}${restaurantName ? " — " + restaurantName : ""}`);

  employees.forEach((emp) => {
    const empShifts = days
      .map((d) => ({ day: d, shift: findShift(emp.id, d.idx) }))
      .filter((x) => x.shift);
    if (empShifts.length === 0) return;
    lines.push("");
    lines.push(emp.name);
    empShifts.forEach(({ day, shift }) => {
      lines.push(`${day.label}: ${shift.start}–${shift.end}`);
    });
  });

  return lines.join("\n");
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}
