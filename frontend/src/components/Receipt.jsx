import { eur, formatGRDateTime, formatGRTime } from "@/lib/format";
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

function ReceiptCopy({ order, label }) {
  const d = order.delivery;
  return (
    <div>
      {label && (
        <div
          style={{
            textAlign: "center",
            fontWeight: 800,
            fontSize: 13,
            border: "1px solid #000",
            padding: "1px 0",
            marginBottom: 4,
          }}
        >
          {label}
        </div>
      )}
      <div className="receipt-title text-center">
        {(order.restaurant_name || "POS").toUpperCase()}
      </div>
      <div style={{ textAlign: "center", fontSize: 11 }}>Souvlaki & Take-away</div>
      <hr />
      <div>Αρ. Παρ.: #{String(order.order_number).padStart(3, "0")}</div>
      <div>Πηγή: {order.source}</div>
      {order.table_name && (
        <div style={{ fontWeight: 800, fontSize: 13 }}>Τραπέζι: {order.table_name}</div>
      )}
      <div>Ημ/νία: {formatGRDateTime(order.created_at || new Date().toISOString())}</div>
      {d && (
        <>
          <hr />
          <div style={{ fontWeight: 800, fontSize: 13 }}>
            {d.delivery_type === "delivery" ? "★ ΠΑΡΑΔΟΣΗ" : "★ TAKEAWAY"}
          </div>
          {d.delivery_type === "delivery" && (
            <div style={{ fontWeight: 800, fontSize: 13 }}>
              Παραγγέλθηκε: {orderTime(order.created_at || new Date().toISOString())}
            </div>
          )}
          {d.name && <div>Όνομα: {d.name}</div>}
          {d.phone && <div>Τηλ.: {d.phone}</div>}
          {d.delivery_type === "delivery" && d.address && <div>Δ/νση: {d.address}</div>}
          {d.delivery_type === "delivery" && d.floor && <div>Όροφος: {d.floor}</div>}
        </>
      )}
      {order.note && (
        <>
          <hr />
          <div
            style={{
              border: "1px solid #000",
              padding: "2px 4px",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            ΣΗΜΕΙΩΣΗ: {order.note}
          </div>
        </>
      )}
      <hr />
      {order.items.map((it, idx) => (
        <div key={idx} style={{ marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{it.quantity}x {it.name}</span>
            <span>{eur(it.line_total)}</span>
          </div>
          {it.customization && (
            <div style={{ fontSize: 10, paddingLeft: 8 }}>{summarize(it.customization)}</div>
          )}
        </div>
      ))}
      <hr />
      {(order.discount?.amount > 0 || order.delivery_fee > 0) && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Υποσύνολο</span>
          <span>{eur(order.subtotal)}</span>
        </div>
      )}
      {order.discount?.amount > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>
            Έκπτωση{order.discount.type === "percent" ? ` ${order.discount.value}%` : ""}
          </span>
          <span>-{eur(order.discount.amount)}</span>
        </div>
      )}
      {order.delivery_fee > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Χρέωση delivery</span>
          <span>+{eur(order.delivery_fee)}</span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        <span>ΣΥΝΟΛΟ</span>
        <span>{eur(order.total)}</span>
      </div>
      <hr />
      <div style={{ textAlign: "center", fontSize: 10 }}>Ευχαριστούμε! Καλή όρεξη</div>
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
