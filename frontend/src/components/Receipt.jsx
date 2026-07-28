import { eur, formatGRDateTime, formatGRTime } from "@/lib/format";
import { subtractAdded } from "@/lib/receiptText";
import { useAuth } from "@/context/AuthContext";

const summarize = (c) => {
  if (!c) return null;
  const parts = [];
  if (c.bread) parts.push(c.bread);
  if (c.double_meat) parts.push("Διπλό κρέας");
  if (c.extras?.length) parts.push(`Extras: ${c.extras.join(", ")}`);
  if (c.sauces?.length) parts.push(`Σως: ${c.sauces.join(", ")}`);
  if (c.selections?.length) {
    c.selections.forEach((sel) => {
      const names = sel.choices.map((ch) => ch.name).join(", ");
      if (names) parts.push(`${sel.group_name}: ${names}`);
    });
  }
  return parts.join(" · ");
};

const orderTime = (iso) => formatGRTime(iso);

// Ετικέτα ανά αντίγραφο όταν είναι ενεργή η επιλογή στις ρυθμίσεις εκτύπωσης
const copyLabel = (idx) => {
  if (idx === 0) return "ΚΟΥΖΙΝΑ";
  if (idx === 1) return "ΠΕΛΑΤΗΣ";
  return `ΑΝΤΙΓΡΑΦΟ ${idx + 1}`;
};

export function ReceiptCopy({ order, label }) {
  const d = order.delivery;
  // Μετά από επεξεργασία: οι προσθήκες σε ξεχωριστή ενότητα «+ ΠΡΟΣΘΗΚΗ»
  const added = order.added_items || [];
  const mainItems = added.length ? subtractAdded(order.items, added) : order.items;
  const itemRow = (it, idx) => (
    <div key={idx} style={{ marginBottom: 6 }}>
      <div className="rc-row rc-item">
        <span>{it.quantity}x {it.name}</span>
        <span className="rc-price">{eur(it.line_total)}</span>
      </div>
      {it.customization && (
        <div className="rc-mod">{summarize(it.customization)}</div>
      )}
    </div>
  );
  return (
    <div>
      {label && (
        <div
          className="rc-big"
          style={{ textAlign: "center", border: "2px solid #000", padding: "2px 0", marginBottom: 4 }}
        >
          {label}
        </div>
      )}
      <div className="receipt-title text-center">
        {(order.restaurant_name || "POS").toUpperCase()}
      </div>
      <hr />
      <div className="rc-big">Αρ. Παρ.: #{String(order.order_number).padStart(3, "0")}</div>
      <div>Πηγή: {order.source}</div>
      {order.table_name && <div className="rc-big">Τραπέζι: {order.table_name}</div>}
      <div className="rc-big">
        {formatGRDateTime(order.created_at || new Date().toISOString())}
      </div>
      {order.modified_at && <div>Τροποποιήθηκε: {formatGRTime(order.modified_at)}</div>}
      {d && (
        <>
          <hr />
          <div className="rc-big">
            {d.delivery_type === "delivery" ? "★ ΠΑΡΑΔΟΣΗ" : "★ TAKEAWAY"}
          </div>
          {/* Δευτερεύοντα στοιχεία πελάτη → .rc-cust (μικρά, normal weight).
              Σε ΠΑΡΑΔΟΣΗ το τηλέφωνο και η διεύθυνση μένουν μεγάλα (τα χρειάζεται ο διανομέας). */}
          {d.delivery_type === "delivery" && (
            <div className="rc-cust">Παραγγέλθηκε: {orderTime(order.created_at || new Date().toISOString())}</div>
          )}
          {d.name && <div className="rc-cust">Όνομα: {d.name}</div>}
          {d.phone && (
            <div className={d.delivery_type === "delivery" ? "rc-big" : "rc-cust"}>Τηλ.: {d.phone}</div>
          )}
          {d.delivery_type === "delivery" && d.address && (
            <div className="rc-big">Δ/νση: {d.address}</div>
          )}
          {d.delivery_type === "delivery" && d.floor && <div>Όροφος: {d.floor}</div>}
        </>
      )}
      {order.note && (
        <>
          <hr />
          <div className="rc-note">ΣΗΜΕΙΩΣΗ: {order.note}</div>
        </>
      )}
      <hr />
      {mainItems.map(itemRow)}
      {added.length > 0 && (
        <>
          <hr />
          <div
            className="rc-big"
            style={{ textAlign: "center", border: "2px solid #000", padding: "2px 0", margin: "4px 0" }}
          >
            + ΠΡΟΣΘΗΚΗ
          </div>
          {added.map(itemRow)}
        </>
      )}
      <hr />
      {(order.discount?.amount > 0 || order.delivery_fee > 0) && (
        <div className="rc-row">
          <span>Υποσύνολο</span>
          <span className="rc-price">{eur(order.subtotal)}</span>
        </div>
      )}
      {order.discount?.amount > 0 && (
        <div className="rc-row">
          <span>
            Έκπτωση{order.discount.type === "percent" ? ` ${order.discount.value}%` : ""}
          </span>
          <span className="rc-price">-{eur(order.discount.amount)}</span>
        </div>
      )}
      {order.delivery_fee > 0 && (
        <div className="rc-row">
          <span>Χρέωση delivery</span>
          <span className="rc-price">+{eur(order.delivery_fee)}</span>
        </div>
      )}
      <div className="rc-row rc-total">
        <span>ΣΥΝΟΛΟ</span>
        <span className="rc-price">{eur(order.total)}</span>
      </div>
      <hr />
      <div className="rc-foot">Ευχαριστούμε! Καλή όρεξη</div>
    </div>
  );
}

export default function Receipt({ order }) {
  const { user } = useAuth();
  if (!order) return null;
  const copies = Math.max(1, Math.min(10, Number(user?.print_copies) || 1));
  const withLabels = copies > 1 && !!user?.print_copy_labels;
  return (
    <div id="print-area" className="hidden print:block">
      {Array.from({ length: copies }, (_, i) => (
        <div key={i} style={i < copies - 1 ? { breakAfter: "page" } : undefined}>
          <ReceiptCopy order={order} label={withLabels ? copyLabel(i) : null} />
        </div>
      ))}
    </div>
  );
}
