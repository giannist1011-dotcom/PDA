import { formatWeekRange } from "@/lib/dates";
import { formatGRDayMonth } from "@/lib/format";
import { printHtmlInFrame } from "@/lib/printFrame";

// ---------- Απλό κείμενο για Viber/WhatsApp/SMS ----------
export function buildScheduleText({ orgName, weekStart, members, shifts, days }) {
  const findShift = (memberId, dayIdx) =>
    shifts.find((s) => s.member_id === memberId && s.day === dayIdx);

  const lines = [];
  lines.push(`Πρόγραμμα εβδομάδας ${formatWeekRange(weekStart)}${orgName ? " — " + orgName : ""}`);

  members.forEach((m) => {
    const rows = days
      .map((d) => ({ day: d, shift: findShift(m.id, d.idx) }))
      .filter((x) => x.shift);
    if (rows.length === 0) return;
    lines.push("");
    lines.push(m.name);
    rows.forEach(({ day, shift }) => {
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

// ---------- Εκτύπωση από τον browser (A4) ----------
// Για επιφάνειες ΧΩΡΙΣ σταθμό εκτύπωσης (π.χ. εταιρεία διανομής): ολόκληρο το
// εβδομαδιαίο πλέγμα σε μία σελίδα, μέσα από το κοινό κρυφό iframe.
const A4_CSS = `
  @page { size: A4 landscape; margin: 12mm; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif; color: #000; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { font-size: 12px; color: #444; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 6px 5px; font-size: 12px; text-align: center; }
  th { background: #eee; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  th.name, td.name { text-align: left; width: 22%; font-weight: 700; }
  td.off { color: #999; }
  .foot { margin-top: 10px; font-size: 10px; color: #666; }
`;

const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

export function printScheduleInBrowser({ orgName, weekStart, members, shifts, days }) {
  const findShift = (memberId, dayIdx) =>
    shifts.find((s) => s.member_id === memberId && s.day === dayIdx);

  const head =
    `<tr><th class="name">Μέλος</th>` +
    days
      .map((d) => `<th>${esc(d.short)}<br><span>${esc(formatGRDayMonth(d.date))}</span></th>`)
      .join("") +
    `</tr>`;

  const body = members.length
    ? members
        .map(
          (m) =>
            `<tr><td class="name">${esc(m.name)}</td>` +
            days
              .map((d) => {
                const sh = findShift(m.id, d.idx);
                return sh
                  ? `<td>${esc(sh.start)}–${esc(sh.end)}</td>`
                  : `<td class="off">—</td>`;
              })
              .join("") +
            `</tr>`
        )
        .join("")
    : `<tr><td class="name">—</td><td colspan="${days.length}">Δεν υπάρχουν μέλη</td></tr>`;

  return printHtmlInFrame(
    `<h1>Εβδομαδιαίο πρόγραμμα${orgName ? ` — ${esc(orgName)}` : ""}</h1>` +
      `<p class="sub">Εβδομάδα ${esc(formatWeekRange(weekStart))}</p>` +
      `<table><thead>${head}</thead><tbody>${body}</tbody></table>` +
      `<p class="foot">OrderDeck</p>`,
    A4_CSS
  );
}
