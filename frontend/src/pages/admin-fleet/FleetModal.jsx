import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Power, Trash2, X, Save, Clock, RotateCcw } from "lucide-react";
import {
  apiAdminFleetDetail,
  apiAdminUpdateFleet,
  apiAdminDeleteFleet,
  apiAdminResetDemo,
  apiAdminDeleteDemo,
  formatApiError,
} from "@/lib/api";
import { formatGRDate, formatGRDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/DatePicker";
import { useAdminInfo } from "@/components/AdminShell";
import { StatusBadge } from "../admin-shops/Badges";
import DemoCredentials from "../admin-shops/DemoCredentials";
import { inputCls, PAYMENT_LABELS } from "../admin-shops/utils";
import { FLEET_PLAN_LABELS } from "./utils";

const ROLE_LABELS = { fleet_admin: "Συντονιστής", driver: "Οδηγός" };

// ============ DETAIL / EDIT MODAL ΕΤΑΙΡΙΑΣ DELIVERY ============
function FleetModal({ pw, companyId, onClose, onChanged }) {
  // Sub-admin scope: view = μόνο ανάγνωση, manage = disable/notes.
  // Πλάνα/συνδρομές/διαγραφή/demo — πάντα μόνο master (και στο backend).
  const info = useAdminInfo();
  const isMaster = !!info?.is_master;
  const canManage = isMaster || info?.rights === "manage";
  const [company, setCompany] = useState(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null); // null | "" | typed text

  const load = useCallback(() => {
    apiAdminFleetDetail(pw, companyId)
      .then((c) => {
        setCompany(c);
        setEdit({
          admin_notes: c.admin_notes || "",
          plan: c.plan || "fleet15",
          subscription_expires_at: c.subscription_expires_at || "",
          payment_status: c.payment_status || "pending",
        });
      })
      .catch((e) => toast.error(formatApiError(e)));
  }, [pw, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (payload, msg) => {
    setBusy(true);
    try {
      await apiAdminUpdateFleet(pw, companyId, payload);
      if (msg) toast.success(msg);
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
      if (company.is_demo) {
        await apiAdminDeleteDemo(pw, companyId);
      } else {
        await apiAdminDeleteFleet(pw, companyId, deleteConfirm);
      }
      toast.success("Η εταιρεία και όλα τα δεδομένα της διαγράφηκαν");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const resetDemo = async () => {
    setBusy(true);
    try {
      // Τα νέα credentials οδηγών αποθηκεύονται στο demo_credentials — τα φέρνει το load()
      await apiAdminResetDemo(pw, companyId);
      toast.success("Το demo επαναφέρθηκε στην αρχική κατάσταση");
      onChanged();
      load();
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
        {!company ? (
          <div className="p-8 text-center text-neutral-500">Φόρτωση...</div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b border-[#723645]">
              <div>
                <div className="font-heading text-xl font-bold flex items-center gap-2">
                  {company.restaurant_name} <StatusBadge status={company.status} />
                </div>
                <div className="text-xs text-neutral-500">{company.email}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-md hover:bg-[#2A0E14] flex items-center justify-center"
                data-testid="fleet-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ΕΚΚΡΕΜΕΣ ΑΙΤΗΜΑ ΣΥΝΔΡΟΜΗΣ — μόνο master */}
            {isMaster && company.billing_request && (
              <div
                className="mx-5 mt-5 p-4 bg-gold/10 border border-gold/50 rounded-lg"
                data-testid="fleet-billing-request"
              >
                <div className="flex items-center gap-2 text-gold font-bold text-sm mb-1">
                  <Clock className="w-4 h-4" /> Εκκρεμές αίτημα συνδρομής
                </div>
                <p className="text-sm text-neutral-200 mb-3">
                  {company.billing_request.action === "add" ? "Ενεργοποίηση" : "Απενεργοποίηση"}{" "}
                  <span className="font-bold">{company.billing_request.addon_label}</span>
                  {company.billing_request.requested_at
                    ? ` · ${formatGRDateTime(company.billing_request.requested_at)}`
                    : ""}
                </p>
                <Button
                  type="button"
                  disabled={busy}
                  data-testid="fleet-billing-clear"
                  onClick={() => patch({ clear_billing_request: true }, "Το αίτημα καθαρίστηκε")}
                  className="h-9 px-4 bg-[#2A0E14] border border-[#723645] hover:border-flame text-neutral-300 text-xs font-bold"
                >
                  Καθαρισμός αιτήματος
                </Button>
              </div>
            )}

            {/* ΣΤΟΙΧΕΙΑ ΣΥΝΔΕΣΗΣ DEMO — το backend τα στέλνει μόνο για demo + master/manage */}
            {company.demo_credentials !== undefined && (
              <DemoCredentials
                pw={pw}
                accountId={companyId}
                email={company.email}
                credentials={company.demo_credentials}
                onChanged={load}
              />
            )}

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ΣΤΟΙΧΕΙΑ & ΧΡΗΣΗ */}
              <div>
                <h3 className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-2">
                  Στοιχεία & χρήση
                </h3>
                <Row label="Υπεύθυνος">{company.full_name || "—"}</Row>
                <Row label="Τηλέφωνο">{company.phone || "—"}</Row>
                <Row label="Πόλη">{company.city || "—"}</Row>
                <Row label="Εγγραφή">{formatGRDate(company.created_at)}</Row>
                <Row label="Τελ. δραστηριότητα">
                  {company.last_activity ? formatGRDateTime(company.last_activity) : "—"}
                </Row>
                <Row label="Διανομείς">{company.drivers_count}</Row>
                <Row label="Παραγγελίες (30ημ)">{company.orders_30d}</Row>
                <Row label="Παραγγελίες (σύνολο)">{company.orders_total}</Row>
                <Row label="Invite code">
                  {company.team?.invite_code ? (
                    <span className="font-mono text-gold">{company.team.invite_code}</span>
                  ) : (
                    "—"
                  )}
                </Row>
              </div>

              {/* ΣΥΝΔΡΟΜΗ & ΣΗΜΕΙΩΣΕΙΣ — πλάνο/λήξη/πληρωμή μόνο master */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-widest font-bold text-neutral-400">
                  {isMaster ? "Συνδρομή (χειροκίνητα)" : "Σημειώσεις"}
                </h3>
                {isMaster && (
                  <>
                    <div>
                      <label className="text-xs text-neutral-400 font-semibold">Πλάνο</label>
                      <select
                        value={edit.plan}
                        onChange={(e) => setEdit((f) => ({ ...f, plan: e.target.value }))}
                        data-testid="fleet-plan"
                        className={`${inputCls} mt-1`}
                      >
                        {Object.entries(FLEET_PLAN_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400 font-semibold">Λήξη συνδρομής</label>
                      <DatePicker
                        value={edit.subscription_expires_at}
                        onChange={(v) => setEdit((f) => ({ ...f, subscription_expires_at: v }))}
                        clearable
                        placeholder="Χωρίς λήξη"
                        testId="fleet-sub-expires"
                        className="w-full h-10 px-3 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-400 font-semibold">Κατάσταση πληρωμής</label>
                      <select
                        value={edit.payment_status}
                        onChange={(e) => setEdit((f) => ({ ...f, payment_status: e.target.value }))}
                        data-testid="fleet-payment-status"
                        className={`${inputCls} mt-1`}
                      >
                        {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="text-xs text-neutral-400 font-semibold">Σημειώσεις διαχειριστή</label>
                  <textarea
                    value={edit.admin_notes}
                    onChange={(e) => setEdit((f) => ({ ...f, admin_notes: e.target.value }))}
                    rows={4}
                    disabled={!canManage}
                    placeholder="Ελεύθερες σημειώσεις για τον πελάτη..."
                    data-testid="fleet-notes"
                    className="w-full px-3 py-2 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame disabled:opacity-50"
                  />
                </div>
                {canManage && (
                  <Button
                    type="button"
                    onClick={() =>
                      // Sub-admin: το backend δέχεται μόνο disabled/admin_notes
                      patch(isMaster ? edit : { admin_notes: edit.admin_notes }, "Αποθηκεύτηκε")
                    }
                    disabled={busy}
                    data-testid="fleet-save"
                    className="w-full h-10 bg-brand hover:bg-brand-hover text-white font-bold"
                  >
                    <Save className="w-4 h-4 mr-1.5" /> Αποθήκευση
                  </Button>
                )}
              </div>
            </div>

            {/* ΜΕΛΗ (ΣΥΝΤΟΝΙΣΤΕΣ & ΟΔΗΓΟΙ) */}
            <div className="px-5 pb-5">
              <h3 className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-2">
                Μέλη ομάδας ({company.members.length})
              </h3>
              {company.members.length === 0 ? (
                <p className="text-sm text-neutral-500">Δεν υπάρχουν μέλη.</p>
              ) : (
                <div className="border border-[#723645] rounded-lg divide-y divide-[#723645]/50">
                  {company.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div>
                        <span className="font-semibold">{m.name}</span>
                        {m.identifier && (
                          <span className="ml-2 font-mono text-xs text-neutral-500">{m.identifier}</span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          m.role === "fleet_admin"
                            ? "bg-flame/15 text-flame"
                            : "bg-neutral-500/15 text-neutral-300"
                        }`}
                      >
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ΕΝΕΡΓΕΙΕΣ */}
            <div className="p-5 border-t border-[#723645] space-y-3">
              <div className="flex flex-wrap gap-2">
                {company.is_demo ? (
                  isMaster && (
                  <Button
                    type="button"
                    onClick={resetDemo}
                    disabled={busy}
                    data-testid="fleet-demo-reset"
                    className="h-10 px-4 bg-[#2A0E14] border border-[#723645] hover:border-gold text-gold text-sm font-bold"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" /> Επαναφορά demo
                  </Button>
                  )
                ) : (
                  canManage && (
                  <Button
                    type="button"
                    onClick={() =>
                      patch(
                        { disabled: !company.disabled },
                        company.disabled
                          ? "Ο λογαριασμός ενεργοποιήθηκε"
                          : "Ο λογαριασμός απενεργοποιήθηκε"
                      )
                    }
                    disabled={busy}
                    data-testid="fleet-toggle-disabled"
                    className={`h-10 px-4 border text-sm font-bold ${
                      company.disabled
                        ? "bg-brand border-brand hover:bg-brand-hover text-white"
                        : "bg-[#2A0E14] border-[#723645] hover:border-flame text-neutral-300"
                    }`}
                  >
                    <Power className="w-4 h-4 mr-1.5" />
                    {company.disabled ? "Ενεργοποίηση λογαριασμού" : "Απενεργοποίηση λογαριασμού"}
                  </Button>
                  )
                )}
                {/* Διαγραφή: πάντα μόνο master */}
                {isMaster && (
                <Button
                  type="button"
                  onClick={() => setDeleteConfirm("")}
                  disabled={busy}
                  data-testid="fleet-delete"
                  className="h-10 px-4 bg-[#2A0E14] border border-[#723645] hover:border-[#FF3B30] text-[#FF6961] text-sm font-bold"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  {company.is_demo ? "Διαγραφή demo" : "Διαγραφή λογαριασμού"}
                </Button>
                )}
              </div>
              {company.disabled && (
                <p className="text-xs text-neutral-500">
                  Ο λογαριασμός δεν μπορεί να συνδεθεί όσο είναι απενεργοποιημένος.
                </p>
              )}
              {deleteConfirm !== null && (
                <div className="bg-[#2A0E14] border border-[#FF3B30]/40 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-[#FF6961] font-semibold">
                    Οριστική διαγραφή της εταιρείας και ΟΛΩΝ των δεδομένων της (μέλη,
                    παραγγελίες, ιστορικό). Δεν αναιρείται.
                  </p>
                  {!company.is_demo && (
                    <>
                      <p className="text-xs text-neutral-400">
                        Πληκτρολογήστε το όνομα της εταιρείας για επιβεβαίωση:{" "}
                        <span className="font-mono text-white">{company.restaurant_name}</span>
                      </p>
                      <input
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder={company.restaurant_name}
                        data-testid="fleet-delete-confirm-input"
                        className={inputCls}
                      />
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={doDelete}
                      disabled={
                        busy ||
                        (!company.is_demo &&
                          deleteConfirm.trim() !== company.restaurant_name.trim())
                      }
                      data-testid="fleet-delete-confirm"
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

export default FleetModal;
