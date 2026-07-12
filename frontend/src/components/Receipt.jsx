import { eur, formatGRDateTime } from "@/lib/format";

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

export default function Receipt({ order }) {
  if (!order) return null;
  const d = order.delivery;
  return (
    <div id="print-area" className="hidden print:block">
      <div className="receipt-title text-center">
        {(order.restaurant_name || "POS").toUpperCase()}
      </div>
      <div style={{ textAlign: "center", fontSize: 11 }}>Souvlaki & Take-away</div>
      <hr />
      <div>Αρ. Παρ.: #{String(order.order_number).padStart(3, "0")}</div>
      <div>Πηγή: {order.source}</div>
      <div>Ημ/νία: {formatGRDateTime(order.created_at || new Date().toISOString())}</div>
      {d && (
        <>
          <hr />
          <div style={{ fontWeight: 800, fontSize: 13 }}>
            {d.delivery_type === "delivery" ? "★ ΠΑΡΑΔΟΣΗ" : "★ TAKEAWAY"}
          </div>
          {d.name && <div>Όνομα: {d.name}</div>}
          {d.phone && <div>Τηλ.: {d.phone}</div>}
          {d.delivery_type === "delivery" && d.address && <div>Δ/νση: {d.address}</div>}
          {d.delivery_type === "delivery" && d.floor && <div>Όροφος: {d.floor}</div>}
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
      {order.discount?.amount > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Υποσύνολο</span>
            <span>{eur(order.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              Έκπτωση{order.discount.type === "percent" ? ` ${order.discount.value}%` : ""}
            </span>
            <span>-{eur(order.discount.amount)}</span>
          </div>
        </>
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
