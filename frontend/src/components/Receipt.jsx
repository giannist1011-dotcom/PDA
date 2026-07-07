import { eur, formatGRDateTime } from "@/lib/format";

const summarizeCustomization = (c) => {
  if (!c) return null;
  const parts = [];
  if (c.bread) parts.push(c.bread);
  if (c.double_meat) parts.push("Διπλό κρέας");
  if (c.extras?.length) parts.push(`Extras: ${c.extras.join(", ")}`);
  if (c.sauces?.length) parts.push(`Σως: ${c.sauces.join(", ")}`);
  return parts.join(" · ");
};

export default function Receipt({ order }) {
  if (!order) return null;
  return (
    <div id="print-area" className="hidden print:block">
      <div className="receipt-title text-center">ΠΕΙΝΩΚΙΟ</div>
      <div style={{ textAlign: "center", fontSize: 11 }}>Souvlaki & Take-away</div>
      <hr />
      <div>Αρ. Παρ.: #{String(order.order_number).padStart(3, "0")}</div>
      <div>Πηγή: {order.source}</div>
      <div>Ημ/νία: {formatGRDateTime(order.created_at || new Date().toISOString())}</div>
      <hr />
      {order.items.map((it, idx) => (
        <div key={idx} style={{ marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{it.quantity}x {it.name}</span>
            <span>{eur(it.line_total)}</span>
          </div>
          {it.customization && (
            <div style={{ fontSize: 10, paddingLeft: 8 }}>
              {summarizeCustomization(it.customization)}
            </div>
          )}
        </div>
      ))}
      <hr />
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
      <div style={{ textAlign: "center", fontSize: 10 }}>
        Ευχαριστούμε! Καλή όρεξη
      </div>
    </div>
  );
}
