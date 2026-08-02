// HTML αποδόσεις των «μη-απόδειξη» εκτυπώσεων (λίστα ελλείψεων/αγορών,
// εβδομαδιαίο πρόγραμμα) σε πλάτος 72mm — ΙΔΙΟ χαρτί με τις αποδείξεις.
//
// Χρησιμοποιούνται από δύο σημεία, ώστε το χαρτί να βγαίνει πανομοιότυπο:
// - lib/print.js → printHtmlInFrame() όταν το κατάστημα τυπώνει από τον browser
// - components/printing/relayRender.jsx → ο σταθμός εκτύπωσης (Kiosk Relay)
//
// Κάθε builder δέχεται το ΙΔΙΟ payload που ταξιδεύει και μέσα στο print_job,
// οπότε ο σταθμός δεν χρειάζεται τίποτα από το state της σελίδας που τύπωσε.
import { formatGRDateTime } from "@/lib/format";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));

// Κοινό «φύλλο» 72mm: μαύρο σε λευκό, χωρίς γκρι (βγαίνουν αχνές κουκκίδες
// στον θερμικό) — ίδια τυπογραφική κλίμακα με τα rc-* της απόδειξης.
const DOC_CSS = `
  #print-area.doc { font-family: -apple-system, "Segoe UI", Arial, sans-serif; }
  #print-area .doc-head { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
  #print-area .doc-title { font-size: 22px; font-weight: 800; line-height: 1.2; }
  #print-area .doc-meta { font-size: 13px; font-weight: 700; }
  #print-area .doc-cat { font-size: 15px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .04em; border-bottom: 2px solid #000; margin: 10px 0 2px; padding-bottom: 2px; }
  #print-area .doc-row { display: flex; align-items: center; gap: 8px; padding: 7px 0;
    border-bottom: 1px solid #000; font-size: 18px; font-weight: 800; }
  #print-area .doc-row.done .doc-text { text-decoration: line-through; }
  #print-area .doc-check { font-size: 22px; width: 24px; text-align: center; flex-shrink: 0; }
  #print-area .doc-text { flex: 1; min-width: 0; }
  #print-area .doc-emp { font-size: 17px; font-weight: 800; text-transform: uppercase;
    border-bottom: 2px solid #000; margin: 10px 0 2px; padding-bottom: 2px; }
  #print-area .doc-day { display: flex; justify-content: space-between; gap: 8px;
    font-size: 15px; font-weight: 700; padding: 4px 0; border-bottom: 1px solid #000; }
  #print-area .doc-day .doc-off { font-weight: 400; }
  #print-area .doc-empty { font-style: italic; padding: 16px 0; }
  #print-area .doc-foot { margin-top: 12px; font-size: 11px; text-align: center; }
`;

const shell = (inner) =>
  `<style>${DOC_CSS}</style><div id="print-area" class="doc">${inner}</div>`;

const header = (title, meta) =>
  `<div class="doc-head"><div class="doc-title">${esc(title)}</div>` +
  `<div class="doc-meta">${esc(meta)}</div></div>`;

const footer = '<div class="doc-foot">Εκτυπώθηκε από το OrderDeck</div>';

// ---------- Λίστα ελλείψεων / αγορών (ομαδοποιημένη ανά κατηγορία) ----------
export function shoppingListHtml({ restaurant_name, printed_at, groups } = {}) {
  const when = printed_at || new Date().toISOString();
  const gs = (groups || []).filter((g) => (g.items || []).length > 0);
  const body = gs.length
    ? gs
        .map(
          (g) =>
            `<div class="doc-cat">${esc(g.category || "Άλλα")}</div>` +
            (g.items || [])
              .map(
                (it) =>
                  `<div class="doc-row${it.bought ? " done" : ""}">` +
                  `<span class="doc-check">${it.bought ? "☒" : "☐"}</span>` +
                  `<span class="doc-text">${esc(it.text)}</span></div>`
              )
              .join("")
        )
        .join("")
    : '<div class="doc-empty">Η λίστα είναι άδεια</div>';
  return shell(
    header(
      "Λίστα αγορών",
      `${restaurant_name || ""}${restaurant_name ? " · " : ""}${formatGRDateTime(when)}`
    ) +
      body +
      footer
  );
}

// ---------- Εβδομαδιαίο πρόγραμμα υπαλλήλων ----------
export function scheduleHtml({ restaurant_name, week_label, employees } = {}) {
  const emps = employees || [];
  const body = emps.length
    ? emps
        .map(
          (e) =>
            `<div class="doc-emp">${esc(e.name)}</div>` +
            (e.days || [])
              .map(
                (d) =>
                  `<div class="doc-day"><span>${esc(d.label)}</span>` +
                  `<span class="${d.shift ? "" : "doc-off"}">${esc(d.shift || "—")}</span></div>`
              )
              .join("")
        )
        .join("")
    : '<div class="doc-empty">Δεν υπάρχουν υπάλληλοι</div>';
  return shell(
    header(
      "Εβδομαδιαίο πρόγραμμα",
      `${restaurant_name || ""}${restaurant_name ? " · " : ""}${week_label || ""}`
    ) +
      body +
      footer
  );
}
