import { summarize, roundTime } from "./utils";

// Kitchen slip: prints ONLY the just-sent round (80mm print CSS)
export default function KitchenSlip({ slip }) {
  if (!slip) return null;
  return (
    <div id="print-area" className="hidden print:block">
      <div className="receipt-title text-center">ΚΟΥΖΙΝΑ</div>
      <div className="rc-big" style={{ textAlign: "center" }}>
        ΤΡΑΠΕΖΙ {slip.tableName}
      </div>
      <div style={{ textAlign: "center" }}>
        Γύρος {slip.round.round_no} · {roundTime(slip.round.sent_at)}
      </div>
      <hr />
      {slip.round.items.map((it, idx) => (
        <div key={idx} style={{ marginBottom: 6 }}>
          <div className="rc-item">
            {it.quantity}x {it.name}
          </div>
          {it.customization && summarize(it.customization) && (
            <div className="rc-mod">{summarize(it.customization)}</div>
          )}
        </div>
      ))}
      <hr />
      <div className="rc-foot">
        {slip.sentBy ? `Σερβίρει: ${slip.sentBy}` : ""}
      </div>
    </div>
  );
}
