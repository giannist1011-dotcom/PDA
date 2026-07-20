import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Power, Trash2, X, Save } from "lucide-react";
import {
  apiAdminShopDetail,
  apiAdminUpdateShop,
  apiAdminDeleteShop,
  formatApiError,
} from "@/lib/api";
import { businessLabel } from "@/lib/business";
import { formatGRDate, formatGRDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/DatePicker";
import { StatusBadge } from "./Badges";
import { inputCls, PLAN_LABELS, PAYMENT_LABELS } from "./utils";

const fmtEur = (v) =>
  `${Number(v || 0).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// ============ DETAIL / EDIT MODAL ============
function ShopModal({ pw, shopId, onClose, onChanged }) {
  const [shop, setShop] = useState(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null); // null | "" | typed text

  const load = useCallback(() => {
    apiAdminShopDetail(pw, shopId)
      .then((s) => {
        setShop(s);
        setEdit({
          admin_notes: s.admin_notes || "",
          plan: s.plan || "trial",
          subscription_expires_at: s.subscription_expires_at || "",
          payment_status: s.payment_status || "pending",
        });
      })
      .catch((e) => toast.error(formatApiError(e)));
  }, [pw, shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await apiAdminUpdateShop(pw, shopId, edit);
      toast.success("Αποθηκεύτηκε");
      onChanged();
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleDisabled = async () => {
    setBusy(true);
    try {
      await apiAdminUpdateShop(pw, shopId, { disabled: !shop.disabled });
      toast.success(shop.disabled ? "Ο λογαριασμός ενεργοποιήθηκε" : "Ο λογαριασμός απενεργοποιήθηκε");
      onChanged();
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await apiAdminDeleteShop(pw, shopId, deleteConfirm);
      toast.success("Ο λογαριασμός και όλα τα δεδομένα του διαγράφηκαν");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ label, children }) => (
    <div className="flex justify-between gap-3 text-sm py-1.5 border-b border-[#723645]/40">
      <span className="text-neutral-400">{label}</span>
      <span className="text-right font-semibold">{children ?? "—"}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#3D1620] border border-[#723645] rounded-lg my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {!shop ? (
          <div className="p-8 text-center text-neutral-500">Φόρτωση...</div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b border-[#723645]">
              <div>
                <div className="font-heading text-xl font-bold flex items-center gap-2">
                  {shop.restaurant_name} <StatusBadge status={shop.status} />
                </div>
                <div className="text-xs text-neutral-500">{shop.email}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-md hover:bg-[#2A0E14] flex items-center justify-center"
                data-testid="shop-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ΣΤΟΙΧΕΙΑ & ΧΡΗΣΗ */}
              <div>
                <h3 className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-2">
                  Στοιχεία & χρήση
                </h3>
                <Row label="Τύπος">{businessLabel(shop.business_type)}</Row>
                <Row label="Υπεύθυνος">{shop.full_name || "—"}</Row>
                <Row label="Τηλέφωνο">{shop.phone || "—"}</Row>
                <Row label="Πόλη">{shop.city || "—"}</Row>
                <Row label="Εγγραφή">{formatGRDate(shop.created_at)}</Row>
                <Row label="Τελ. δραστηριότητα">
                  {shop.last_activity ? formatGRDateTime(shop.last_activity) : "—"}
                </Row>
                <Row label="Παραγγελίες">{shop.orders_count}</Row>
                <Row label="Τζίρος">{fmtEur(shop.orders_revenue)}</Row>
                <Row label="Προφίλ / Είδη">{`${shop.profiles_count} / ${shop.items_count}`}</Row>
                <Row label="DeckPilot">{shop.uses_deckpilot ? "Ναι" : "Όχι"}</Row>
                <Row label="Onboarding">
                  {shop.onboarding
                    ? `${shop.onboarding.done}/${shop.onboarding.total} (${shop.onboarding.percent}%)`
                    : "—"}
                </Row>
                <Row label="Promo">{shop.promo?.code || "—"}</Row>
              </div>

              {/* ΣΥΝΔΡΟΜΗ & ΣΗΜΕΙΩΣΕΙΣ */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-widest font-bold text-neutral-400">
                  Συνδρομή (χειροκίνητα)
                </h3>
                <div>
                  <label className="text-xs text-neutral-400 font-semibold">Πλάνο</label>
                  <select
                    value={edit.plan}
                    onChange={(e) => setEdit((f) => ({ ...f, plan: e.target.value }))}
                    data-testid="shop-plan"
                    className={`${inputCls} mt-1`}
                  >
                    {Object.entries(PLAN_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-semibold">Λήξη δοκιμής/συνδρομής</label>
                  <DatePicker
                    value={edit.subscription_expires_at}
                    onChange={(v) => setEdit((f) => ({ ...f, subscription_expires_at: v }))}
                    clearable
                    placeholder="Χωρίς λήξη"
                    testId="shop-sub-expires"
                    className="w-full h-10 px-3 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-semibold">Κατάσταση πληρωμής</label>
                  <select
                    value={edit.payment_status}
                    onChange={(e) => setEdit((f) => ({ ...f, payment_status: e.target.value }))}
                    data-testid="shop-payment-status"
                    className={`${inputCls} mt-1`}
                  >
                    {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-semibold">Σημειώσεις διαχειριστή</label>
                  <textarea
                    value={edit.admin_notes}
                    onChange={(e) => setEdit((f) => ({ ...f, admin_notes: e.target.value }))}
                    rows={4}
                    placeholder="Ελεύθερες σημειώσεις για τον πελάτη..."
                    data-testid="shop-notes"
                    className="w-full px-3 py-2 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
                  />
                </div>
                <Button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  data-testid="shop-save"
                  className="w-full h-10 bg-brand hover:bg-brand-hover text-white font-bold"
                >
                  <Save className="w-4 h-4 mr-1.5" /> Αποθήκευση
                </Button>
              </div>
            </div>

            {/* ΕΝΕΡΓΕΙΕΣ */}
            <div className="p-5 border-t border-[#723645] space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={toggleDisabled}
                  disabled={busy || shop.is_demo}
                  data-testid="shop-toggle-disabled"
                  className={`h-10 px-4 border text-sm font-bold ${
                    shop.disabled
                      ? "bg-brand border-brand hover:bg-brand-hover text-white"
                      : "bg-[#2A0E14] border-[#723645] hover:border-flame text-neutral-300"
                  }`}
                >
                  <Power className="w-4 h-4 mr-1.5" />
                  {shop.disabled ? "Ενεργοποίηση λογαριασμού" : "Απενεργοποίηση λογαριασμού"}
                </Button>
                <Button
                  type="button"
                  onClick={() => setDeleteConfirm("")}
                  disabled={busy}
                  data-testid="shop-delete"
                  className="h-10 px-4 bg-[#2A0E14] border border-[#723645] hover:border-[#FF3B30] text-[#FF6961] text-sm font-bold"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" /> Διαγραφή λογαριασμού
                </Button>
              </div>
              {shop.disabled && (
                <p className="text-xs text-neutral-500">
                  Ο λογαριασμός δεν μπορεί να συνδεθεί όσο είναι απενεργοποιημένος.
                </p>
              )}
              {deleteConfirm !== null && (
                <div className="bg-[#2A0E14] border border-[#FF3B30]/40 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-[#FF6961] font-semibold">
                    Οριστική διαγραφή του λογαριασμού και ΟΛΩΝ των δεδομένων του (μενού,
                    παραγγελίες, ιστορικό). Δεν αναιρείται.
                  </p>
                  <p className="text-xs text-neutral-400">
                    Πληκτρολογήστε το όνομα του μαγαζιού για επιβεβαίωση:{" "}
                    <span className="font-mono text-white">{shop.restaurant_name}</span>
                  </p>
                  <input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={shop.restaurant_name}
                    data-testid="shop-delete-confirm-input"
                    className={inputCls}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={doDelete}
                      disabled={busy || deleteConfirm.trim() !== shop.restaurant_name.trim()}
                      data-testid="shop-delete-confirm"
                      className="h-10 px-4 bg-[#FF3B30] hover:bg-[#d9291f] text-white font-bold disabled:opacity-40"
                    >
                      Οριστική διαγραφή
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="h-10 px-4 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
                    >
                      Άκυρο
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ShopModal;
