// Plain-text αποδόσεις των εκτυπώσεων για το Print Bridge (θερμικός 80mm).
// Κάθε builder επιστρέφει string (ένα φυσικό ticket) — τα αντίγραφα είναι
// ξεχωριστά strings στο array του print_job, με κόψιμο χαρτιού μετά το καθένα.
import { eur, formatGRDateTime, formatGRTime, formatGRSchedule } from "@/lib/format";
import { customizationLines } from "@/lib/customizationText";

const WIDTH = 42; // στήλες σε 80mm θερμικό (Font A) — ασφαλής τιμή

// Κεφαλίδα απόδειξης: το προαιρετικό «Όνομα στην απόδειξη» των ρυθμίσεων,
// αλλιώς το πλήρες όνομα καταστήματος (ο κατάλογος/app μένουν στο πλήρες)
export const receiptStoreName = (user) =>
  (user?.receipt_name || "").trim() || user?.restaurant_name || "POS";

const center = (s) => {
  const t = String(s || "").slice(0, WIDTH);
  const pad = Math.max(0, Math.floor((WIDTH - t.length) / 2));
  return " ".repeat(pad) + t;
};

const row = (left, right) => {
  const r = String(right || "");
  const maxLeft = WIDTH - r.length - 1;
  const l = String(left || "").slice(0, Math.max(0, maxLeft));
  return l + " ".repeat(Math.max(1, WIDTH - l.length - r.length)) + r;
};

const hr = "-".repeat(WIDTH);

// Σπάσιμο μεγάλων γραμμών (π.χ. διεύθυνση, σημείωση) σε πλάτος WIDTH
const wrap = (s, indent = 0) => {
  const words = String(s || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  const avail = WIDTH - indent;
  for (const w of words) {
    if ((cur + " " + w).trim().length > avail) {
      if (cur) lines.push(cur);
      cur = w.slice(0, avail);
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => " ".repeat(indent) + l);
};

// Μετά από επεξεργασία: αφαιρεί τις «προσθήκες» από τις γραμμές ώστε η απόδειξη
// να τις δείξει σε ξεχωριστή ενότητα «+ ΠΡΟΣΘΗΚΗ» (η κουζίνα φτιάχνει μόνο τα νέα)
export const subtractAdded = (items, added) => {
  const remaining = (added || []).map((a) => ({ ...a, left: a.quantity }));
  const out = [];
  for (const it of items || []) {
    let qty = it.quantity;
    for (const a of remaining) {
      if (
        a.left > 0 &&
        a.item_id === it.item_id &&
        a.name === it.name &&
        a.unit_price === it.unit_price &&
        JSON.stringify(a.customization || null) === JSON.stringify(it.customization || null)
      ) {
        const take = Math.min(a.left, qty);
        qty -= take;
        a.left -= take;
      }
    }
    if (qty > 0) {
      out.push({ ...it, quantity: qty, line_total: Math.round(it.unit_price * qty * 100) / 100 });
    }
  }
  return out;
};

// Προγραμματισμένη παραγγελία: έντονη κεφαλίδα ώστε η κουζίνα να ξέρει ότι δεν
// είναι για τώρα. Όταν έφτασε η ώρα της (status «active») η επανεκτύπωση το λέει.
export const scheduledHeader = (order) => {
  if (!order?.scheduled_at) return null;
  return order.status === "scheduled"
    ? `ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΗ — ${formatGRSchedule(order.scheduled_at)}`
    : `ΩΡΑ ΤΗΣ: ΤΩΡΑ — ${formatGRTime(order.scheduled_at)}`;
};

// Επανάληψη της ώρας κοντά στα σύνολα
export const scheduledTotalLine = (order) =>
  order?.scheduled_at ? `ΓΙΑ ΤΙΣ: ${formatGRSchedule(order.scheduled_at)}` : null;

export const copyLabel = (idx) => {
  if (idx === 0) return "ΚΟΥΖΙΝΑ";
  if (idx === 1) return "ΠΕΛΑΤΗΣ";
  return `ΑΝΤΙΓΡΑΦΟ ${idx + 1}`;
};

// ---------- Απόδειξη παραγγελίας (ένα αντίγραφο) ----------
export function receiptText(order, label = null) {
  const L = [];
  if (label) L.push(center(`== ${label} ==`), "");
  L.push(center((order.restaurant_name || "POS").toUpperCase()));
  const schedHead = scheduledHeader(order);
  if (schedHead) {
    L.push(hr);
    L.push(center(`** ${schedHead} **`));
  }
  L.push(hr);
  L.push(`Αρ. Παρ.: #${String(order.order_number).padStart(3, "0")}`);
  L.push(`Πηγή: ${order.source}`);
  if (order.table_name) L.push(`ΤΡΑΠΕΖΙ: ${order.table_name}`);
  L.push(`Ημ/νία: ${formatGRDateTime(order.created_at || new Date().toISOString())}`);
  if (order.modified_at) L.push(`Τροποποιήθηκε: ${formatGRTime(order.modified_at)}`);
  const d = order.delivery;
  if (d) {
    L.push(hr);
    L.push(d.delivery_type === "delivery" ? "* ΠΑΡΑΔΟΣΗ *" : "* TAKEAWAY *");
    if (d.delivery_type === "delivery") {
      L.push(`Παραγγέλθηκε: ${formatGRTime(order.created_at || new Date().toISOString())}`);
    }
    // Σταθερή σειρά για τον διανομέα: διεύθυνση → όροφος → όνομα → τηλέφωνο
    if (d.delivery_type === "delivery" && d.address) L.push(...wrap(`Δ/νση: ${d.address}`));
    if (d.delivery_type === "delivery" && d.floor) L.push(`Όροφος: ${d.floor}`);
    if (d.name) L.push(`Όνομα: ${d.name}`);
    if (d.phone) L.push(`Τηλ.: ${d.phone}`);
  }
  if (order.note) {
    L.push(hr);
    L.push(...wrap(`ΣΗΜΕΙΩΣΗ: ${order.note}`));
  }
  L.push(hr);
  const added = order.added_items || [];
  const mainItems = added.length ? subtractAdded(order.items, added) : order.items || [];
  const pushItem = (it) => {
    L.push(row(`${it.quantity}x ${it.name}`, eur(it.line_total)));
    // Μία γραμμή ανά κατηγορία, σταθερή σειρά: ψωμί, διπλό, υλικά, λοιπά, σως
    customizationLines(it.customization).forEach((line) => L.push(...wrap(line, 3)));
  };
  mainItems.forEach(pushItem);
  if (added.length) {
    L.push(hr);
    L.push(center("+++ ΠΡΟΣΘΗΚΗ +++"));
    added.forEach(pushItem);
  }
  L.push(hr);
  if (order.discount?.amount > 0 || order.delivery_fee > 0) {
    L.push(row("Υποσύνολο", eur(order.subtotal)));
  }
  if (order.discount?.amount > 0) {
    const lbl = `Έκπτωση${order.discount.type === "percent" ? ` ${order.discount.value}%` : ""}`;
    L.push(row(lbl, `-${eur(order.discount.amount)}`));
  }
  if (order.delivery_fee > 0) L.push(row("Χρέωση delivery", `+${eur(order.delivery_fee)}`));
  L.push(row("ΣΥΝΟΛΟ", eur(order.total)));
  const schedTotal = scheduledTotalLine(order);
  if (schedTotal) L.push(center(schedTotal));
  L.push(hr);
  L.push(center("Ευχαριστούμε! Καλή όρεξη"));
  return L.join("\n");
}

// Όλα τα αντίγραφα μιας παραγγελίας με βάση τις ρυθμίσεις του λογαριασμού
export function receiptTexts(order, user) {
  const copies = Math.max(1, Math.min(10, Number(user?.print_copies) || 1));
  const withLabels = copies > 1 && !!user?.print_copy_labels;
  return Array.from({ length: copies }, (_, i) =>
    receiptText(order, withLabels ? copyLabel(i) : null)
  );
}

// ---------- Δελτίο κουζίνας (γύρος τραπεζιού) ----------
export function kitchenSlipText(slip) {
  const L = [];
  L.push(center("ΚΟΥΖΙΝΑ"));
  L.push(center(`ΤΡΑΠΕΖΙ ${slip.tableName}`));
  L.push(center(`Γύρος ${slip.round.round_no} · ${formatGRTime(slip.round.sent_at)}`));
  L.push(hr);
  (slip.round.items || []).forEach((it) => {
    L.push(`${it.quantity}x ${it.name}`);
    customizationLines(it.customization).forEach((line) => L.push(...wrap(line, 3)));
  });
  L.push(hr);
  if (slip.sentBy) L.push(center(`Σερβίρει: ${slip.sentBy}`));
  return L.join("\n");
}

// ---------- Αναφορά Z (κλείσιμο ημέρας) ----------
const TYPE_LABELS = { delivery: "Παράδοση", takeaway: "Takeaway", store: "Κατάστημα" };

export function zReportText(report, restaurantName) {
  const L = [];
  L.push(center((restaurantName || "POS").toUpperCase()));
  L.push(center("ΚΛΕΙΣΙΜΟ ΗΜΕΡΑΣ (Z)"));
  L.push(hr);
  L.push(`Ημέρα: ${report.date}`);
  L.push(`Κλείσιμο: ${formatGRDateTime(report.closed_at || new Date().toISOString())}`);
  L.push(hr);
  L.push(row("Παραγγελίες", String(report.total_orders)));
  L.push(row("ΤΖΙΡΟΣ", eur(report.total_revenue)));
  L.push(hr, "ΑΝΑ ΠΗΓΗ");
  (report.by_source || []).forEach((s) => L.push(row(`${s.source} (${s.count})`, eur(s.revenue))));
  if ((report.by_type || []).length > 0) {
    L.push(hr, "ΑΝΑ ΤΥΠΟ");
    (report.by_type || []).forEach((t) =>
      L.push(row(`${TYPE_LABELS[t.type] || t.type} (${t.count})`, eur(t.revenue)))
    );
  }
  L.push(hr);
  L.push(row("Εκπτώσεις", `-${eur(report.total_discounts)}`));
  L.push(row("Ακυρωμένες", String(report.cancelled_count)));
  if (report.scheduled_pending > 0) {
    L.push(row("Εκκρεμείς προγραμμ.", String(report.scheduled_pending)));
  }
  L.push(row("Έξοδα ημέρας", `-${eur(report.total_expenses)}`));
  L.push(hr);
  L.push(row("ΚΑΘΑΡΟ", eur(report.net_result)));
  L.push(hr);
  L.push(center("OrderDeck — Αναφορά Z"));
  return L.join("\n");
}

// ---------- Δείγμα για τη «Δοκιμαστική εκτύπωση» των ρυθμίσεων ----------
export function sampleOrder(user) {
  return {
    restaurant_name: (user?.receipt_name || "").trim() || user?.restaurant_name || "OrderDeck",
    order_number: 999,
    source: "Δοκιμή",
    created_at: new Date().toISOString(),
    note: "Δοκιμαστική εκτύπωση — δεν είναι πραγματική παραγγελία",
    items: [
      { quantity: 1, name: "Δοκιμαστικό είδος Α", line_total: 3.5 },
      { quantity: 2, name: "Δοκιμαστικό είδος Β", line_total: 5.0 },
    ],
    subtotal: 8.5,
    total: 8.5,
  };
}
