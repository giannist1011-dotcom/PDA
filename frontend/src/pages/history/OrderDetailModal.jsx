import {
  Printer,
  Ban,
  Trash2,
  X,
  Phone,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { eur, formatGRDateTime } from "@/lib/format";
import { actorLabel } from "@/lib/roles";
import ScheduledBadge from "./ScheduledBadge";
import { typeLabel, sourceBadgeCls } from "./utils";

const summarize = (c) => {
  if (!c) return null;
  const parts = [];
  if (c.bread) parts.push(c.bread);
  if (c.double_meat) parts.push("Διπλό κρέας");
  if (c.extras?.length) parts.push(`Υλικά: ${c.extras.join(", ")}`);
  if (c.sauces?.length) parts.push(`Αλοιφές: ${c.sauces.join(", ")}`);
  if (c.selections?.length) {
    c.selections.forEach((sel) => {
      const names = sel.choices.map((ch) => ch.name).join(", ");
      if (names) parts.push(`${sel.group_name}: ${names}`);
    });
  }
  return parts.join(" · ");
};

// ---------- Order detail modal ----------
export default function OrderDetailModal({ order, canManage, canCancel = true, onClose, onReprint, onCancel, onDelete }) {
  if (!order) return null;
  const d = order.delivery;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="order-detail-modal"
    >
      <div className="bg-[#3D1620] border border-[#723645] rounded-lg w-full max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-[#431A25]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading text-xl font-bold">
                Παραγγελία #{String(order.order_number).padStart(3, "0")}
              </h3>
              <span
                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                  sourceBadgeCls[order.source] || "bg-[#723645] text-neutral-300"
                }`}
              >
                {order.source}
              </span>
              {order.cancelled && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#FF3B30]/20 text-[#FF6961]">
                  Ακυρωμένη
                </span>
              )}
              <ScheduledBadge order={order} />
            </div>
            <div className="text-sm text-neutral-400 mt-1">
              {formatGRDateTime(order.created_at)} · {typeLabel(order)}
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="order-detail-close"
            className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {d && (d.name || d.phone || d.address) && (
            <div className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md space-y-1 text-sm">
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">
                Στοιχεία πελάτη
              </div>
              {d.name && <div className="text-white font-semibold">{d.name}</div>}
              {d.phone && (
                <div className="flex items-center gap-2 text-neutral-300">
                  <Phone className="w-3.5 h-3.5 text-flame" /> {d.phone}
                </div>
              )}
              {d.address && (
                <div className="flex items-center gap-2 text-neutral-300">
                  <MapPin className="w-3.5 h-3.5 text-flame" />
                  {d.address}
                  {d.floor ? ` · Όροφος: ${d.floor}` : ""}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
              Προϊόντα
            </div>
            <ul className="space-y-2">
              {order.items.map((it, idx) => (
                <li
                  key={idx}
                  className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md"
                  data-testid={`order-detail-item-${idx}`}
                >
                  <div className="flex justify-between gap-3">
                    <span className="text-white font-semibold">
                      {it.quantity}x {it.name}
                    </span>
                    <span className="font-mono font-bold text-white shrink-0">
                      {eur(it.line_total)}
                    </span>
                  </div>
                  {it.customization && summarize(it.customization) && (
                    <div className="text-xs text-neutral-400 mt-1">
                      {summarize(it.customization)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 bg-[#2A0E14] border border-flame/40 rounded-md space-y-1">
            {order.discount?.amount > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase tracking-widest text-neutral-500">
                    Υποσύνολο
                  </span>
                  <span className="font-mono text-sm text-neutral-400">{eur(order.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center" data-testid="order-detail-discount">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#00E676]">
                    Έκπτωση{order.discount.type === "percent" ? ` ${order.discount.value}%` : ""}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#00E676]">
                    -{eur(order.discount.amount)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Σύνολο
              </span>
              <span className="font-mono text-xl font-bold text-gold">
                {eur(order.total)}
              </span>
            </div>
          </div>

          {(order.taken_by?.name || order.discount?.applied_by || order.cancelled_by) && (
            <div className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md space-y-1 text-xs text-neutral-400" data-testid="order-audit">
              <div className="font-bold uppercase tracking-widest text-neutral-500 mb-1">
                Καταγραφή ενεργειών
              </div>
              {order.taken_by?.name && (
                <div>
                  Παραγγελία από:{" "}
                  <span className="text-white">
                    {actorLabel(order.taken_by.name, order.taken_by.role)}
                  </span>
                </div>
              )}
              {order.discount?.applied_by && (
                <div>
                  Έκπτωση από:{" "}
                  <span className="text-white">
                    {actorLabel(order.discount.applied_by, order.discount.applied_by_role)}
                  </span>
                  {order.discount.applied_at ? ` · ${formatGRDateTime(order.discount.applied_at)}` : ""}
                </div>
              )}
              {order.cancelled_by && (
                <div>
                  Ακύρωση από:{" "}
                  <span className="text-[#FF6961]">
                    {actorLabel(order.cancelled_by, order.cancelled_by_role)}
                  </span>
                  {order.cancelled_at ? ` · ${formatGRDateTime(order.cancelled_at)}` : ""}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[#431A25] flex flex-wrap gap-2 justify-end">
          {canCancel && (
            <Button
              onClick={() => onDelete(order)}
              data-testid="order-delete-btn"
              title={canManage ? "" : "Απαιτείται PIN ιδιοκτήτη/υπευθύνου"}
              className="h-11 bg-[#FF3B30] hover:bg-[#FF5A50] text-white font-bold mr-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Διαγραφή
            </Button>
          )}
          {canCancel && !order.cancelled && (
            <Button
              onClick={() => onCancel(order)}
              data-testid="order-cancel-btn"
              title={canManage ? "" : "Απαιτείται PIN ιδιοκτήτη/υπευθύνου"}
              className="h-11 bg-transparent border border-[#FF3B30]/50 text-[#FF6961] hover:bg-[#FF3B30]/10 hover:border-[#FF3B30]"
            >
              <Ban className="w-4 h-4 mr-2" /> Ακύρωση
            </Button>
          )}
          <Button
            onClick={() => onReprint(order)}
            data-testid="order-reprint-btn"
            className="h-11 bg-brand hover:bg-brand-hover font-bold"
          >
            <Printer className="w-4 h-4 mr-2" /> Επανεκτύπωση
          </Button>
        </div>
      </div>
    </div>
  );
}
