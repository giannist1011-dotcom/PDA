import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Power,
  Trash2,
  X,
  RefreshCw,
  Save,
} from "lucide-react";
import {
  apiAdminListShops,
  apiAdminShopDetail,
  apiAdminUpdateShop,
  apiAdminDeleteShop,
  formatApiError,
} from "@/lib/api";
import { businessLabel } from "@/lib/business";
import { formatGRDate, formatGRDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/DatePicker";
import AdminShell, { useAdminPw } from "@/components/AdminShell";

const PAGE_SIZE = 20;

const inputCls =
  "w-full h-10 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame";

const fmtEur = (v) =>
  `${Number(v || 0).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const PLAN_LABELS = {
  trial: "Δωρεάν δοκιμή",
  pro: "Pro",
  pro_deckpilot: "Pro + DeckPilot",
};

export const PAYMENT_LABELS = {
  paid: "Πληρωμένο",
  pending: "Εκκρεμεί",
  expired: "Ληγμένο",
};

const STATUS_BADGE = {
  active: ["Ενεργό", "bg-emerald-500/15 text-emerald-400"],
  disabled: ["Ανενεργό", "bg-[#FF3B30]/15 text-[#FF6961]"],
  demo: ["Demo", "bg-gold/15 text-gold"],
};

// Ποσοστό onboarding μαγαζιού — μίνι progress bar + %
const OnboardingCell = ({ onboarding }) => {
  if (!onboarding) return <span className="text-neutral-500">—</span>;
  const pct = onboarding.percent ?? 0;
  const color = pct >= 100 ? "bg-emerald-400" : pct >= 50 ? "bg-gold" : "bg-[#FF6961]";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 rounded-full bg-[#2A0E14] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-neutral-300">{pct}%</span>
    </div>
  );
};

export const StatusBadge = ({ status }) => {
  const [label, cls] = STATUS_BADGE[status] || [status, "bg-neutral-500/15 text-neutral-400"];
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

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

// ============ LIST PAGE ============
function ShopsContent() {
  const pw = useAdminPw();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [businessType, setBusinessType] = useState("all");
  const [regFrom, setRegFrom] = useState("");
  const [regTo, setRegTo] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    apiAdminListShops(pw, {
      search,
      status,
      business_type: businessType,
      reg_from: regFrom,
      reg_to: regTo,
      page,
      limit: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => toast.error(formatApiError(e)));
  }, [pw, search, status, businessType, regFrom, regTo, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      {/* FILTERS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Αναζήτηση ονόματος ή email..."
            data-testid="shops-search"
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          data-testid="shops-filter-status"
          className={inputCls}
        >
          <option value="all">Όλες οι καταστάσεις</option>
          <option value="active">Ενεργά</option>
          <option value="disabled">Ανενεργά</option>
          <option value="demo">Demo</option>
        </select>
        <select
          value={businessType}
          onChange={(e) => {
            setBusinessType(e.target.value);
            setPage(1);
          }}
          data-testid="shops-filter-type"
          className={inputCls}
        >
          <option value="all">Όλοι οι τύποι</option>
          <option value="souvlaki">Σουβλατζίδικο</option>
          <option value="cafe">Καφετέρια</option>
          <option value="pizzeria">Πιτσαρία</option>
          <option value="burger">Burger</option>
        </select>
        <div className="flex gap-2">
          <DatePicker
            value={regFrom}
            onChange={(v) => {
              setRegFrom(v);
              setPage(1);
            }}
            clearable
            placeholder="Εγγραφή από"
            testId="shops-reg-from"
            className="w-full h-10 px-2 text-sm"
          />
          <DatePicker
            value={regTo}
            onChange={(v) => {
              setRegTo(v);
              setPage(1);
            }}
            clearable
            placeholder="έως"
            testId="shops-reg-to"
            className="w-full h-10 px-2 text-sm"
          />
        </div>
      </div>

      {/* TABLE */}
      {!data ? (
        <div className="text-neutral-500 py-16 text-center">Φόρτωση...</div>
      ) : data.shops.length === 0 ? (
        <div className="text-center text-neutral-500 py-16 border border-dashed border-[#723645] rounded-lg">
          Δεν βρέθηκαν μαγαζιά με αυτά τα φίλτρα.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#723645] rounded-lg">
          <table className="w-full text-sm" data-testid="shops-table">
            <thead>
              <tr className="bg-[#3D1620] text-left text-xs uppercase tracking-wider text-neutral-400">
                <th className="px-3 py-2.5 font-bold">Μαγαζί</th>
                <th className="px-3 py-2.5 font-bold">Τύπος</th>
                <th className="px-3 py-2.5 font-bold">Εγγραφή</th>
                <th className="px-3 py-2.5 font-bold">Τελ. δραστ.</th>
                <th className="px-3 py-2.5 font-bold text-right">Παραγγελίες</th>
                <th className="px-3 py-2.5 font-bold">Κατάσταση</th>
                <th className="px-3 py-2.5 font-bold">Onboarding</th>
                <th className="px-3 py-2.5 font-bold">Promo</th>
                <th className="px-3 py-2.5 font-bold">Πλάνο</th>
              </tr>
            </thead>
            <tbody>
              {data.shops.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  data-testid={`shop-row-${s.id}`}
                  className="border-t border-[#723645]/50 hover:bg-[#3D1620]/60 cursor-pointer"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{s.restaurant_name}</div>
                    <div className="text-xs text-neutral-500">{s.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-300">{businessLabel(s.business_type)}</td>
                  <td className="px-3 py-2.5 text-neutral-300">{formatGRDate(s.created_at)}</td>
                  <td className="px-3 py-2.5 text-neutral-300">
                    {s.last_activity ? formatGRDate(s.last_activity) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">{s.orders_count}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="px-3 py-2.5" data-testid={`shop-onboarding-${s.id}`}>
                    <OnboardingCell onboarding={s.onboarding} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gold">{s.promo?.code || "—"}</td>
                  <td className="px-3 py-2.5 text-neutral-300">{PLAN_LABELS[s.plan] || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINATION */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-neutral-400">
          <span>
            Σύνολο: <span className="text-white font-semibold">{data.total}</span> μαγαζιά
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white disabled:opacity-40"
              data-testid="shops-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white disabled:opacity-40"
              data-testid="shops-next"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <ShopModal pw={pw} shopId={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </div>
  );
}

export default function AdminShops() {
  return (
    <AdminShell
      title="Μαγαζιά"
      subtitle="Όλοι οι λογαριασμοί της πλατφόρμας"
      actions={
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="h-9 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      }
    >
      <ShopsContent />
    </AdminShell>
  );
}
