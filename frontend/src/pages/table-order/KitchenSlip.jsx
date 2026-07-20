import { summarize, roundTime } from "./utils";

// Kitchen slip: prints ONLY the just-sent round (80mm print CSS)
export default function KitchenSlip({ slip }) {
  if (!slip) return null;
  return (
    <div id="print-area" className="hidden print:block">
      <div className="receipt-title text-center">ΚΟΥΖΙΝΑ</div>
      <div style={{ textAlign: "center", fontSize: 14, fontWeight: 800 }}>
        ΤΡΑΠΕΖΙ {slip.tableName}
      </div>
      <div style={{ textAlign: "center", fontSize: 11 }}>
        Γύρος {slip.round.round_no} · {roundTime(slip.round.sent_at)}
      </div>
      <hr />
      {slip.round.items.map((it, idx) => (
        <div key={idx} style={{ marginBottom: 5 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {it.quantity}x {it.name}
          </div>
          {it.customization && summarize(it.customization) && (
            <div style={{ fontSize: 11, paddingLeft: 8 }}>{summarize(it.customization)}</div>
          )}
        </div>
      ))}
      <hr />
      <div style={{ textAlign: "center", fontSize: 10 }}>
        {slip.sentBy ? `Σερβίρει: ${slip.sentBy}` : ""}
      </div>
    </div>
  );
}
