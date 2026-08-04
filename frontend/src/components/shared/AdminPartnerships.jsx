import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Handshake, Link2, Unlink } from "lucide-react";
import {
  apiAdminShopPartnerships,
  apiAdminShopLinkPartner,
  apiAdminShopUnlinkPartner,
  apiAdminCompanyPartnerships,
  apiAdminCompanyLinkStore,
  apiAdminCompanyUnlinkStore,
  formatApiError,
} from "@/lib/api";

// Ενότητα «Συνεργασίες» στην καρτέλα μαγαζιού ΚΑΙ εταιρείας του admin panel.
// Ο master συνδέει/αποσυνδέει ΑΠΕΥΘΕΙΑΣ (χωρίς αίτημα/έγκριση) — η συνεργασία
// είναι η ίδια οντότητα με αυτές που φτιάχνουν μόνα τους τα καταστήματα.
// Τα sub-admins βλέπουν μόνο (canEdit=false).
//
// mode: "shop" → λίστα εταιρειών προς σύνδεση · "company" → λίστα μαγαζιών.
export default function AdminPartnerships({ pw, mode, accountId, canEdit }) {
  const isShop = mode === "shop";
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");

  const load = useCallback(() => {
    const fn = isShop ? apiAdminShopPartnerships : apiAdminCompanyPartnerships;
    fn(pw, accountId)
      .then((d) => {
        setData(d);
        setPick("");
      })
      .catch((e) => toast.error(formatApiError(e)));
  }, [isShop, pw, accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const link = () =>
    run(
      () =>
        isShop
          ? apiAdminShopLinkPartner(pw, accountId, pick)
          : apiAdminCompanyLinkStore(pw, accountId, pick),
      "Η συνεργασία δημιουργήθηκε"
    );

  const unlink = (pid, name) =>
    window.confirm(`Τερματισμός της συνεργασίας με «${name}»;`) &&
    run(
      () =>
        isShop
          ? apiAdminShopUnlinkPartner(pw, accountId, pid)
          : apiAdminCompanyUnlinkStore(pw, accountId, pid),
      "Η συνεργασία τερματίστηκε"
    );

  if (!data) return null;
  const partnerships = data.partnerships || [];
  const candidates = data.candidates || [];
  const nameOf = (p) => (isShop ? p.team_name : p.store_name);
  const cityOf = (p) => (isShop ? p.team_city : p.store_city);

  return (
    <div className="px-5 pb-5" data-testid="admin-partnerships">
      <h3 className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-2 flex items-center gap-1.5">
        <Handshake className="w-3.5 h-3.5" /> Συνεργασίες
        {isShop ? " με εταιρείες διανομής" : " με καταστήματα"}
      </h3>

      {partnerships.length === 0 ? (
        <div className="text-sm text-neutral-500 border border-dashed border-[#723645]/60 rounded-md p-3">
          Καμία συνεργασία.
        </div>
      ) : (
        <div className="space-y-1.5">
          {partnerships.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-3 py-2 bg-[#2A0E14] border border-[#723645] rounded-md text-sm"
              data-testid={`admin-partnership-${p.id}`}
            >
              <span className="font-semibold truncate">{nameOf(p) || "—"}</span>
              {cityOf(p) && <span className="text-xs text-neutral-500 shrink-0">{cityOf(p)}</span>}
              <span
                className={`ml-auto shrink-0 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                  p.status === "active"
                    ? "bg-[#34C759]/15 text-[#5BD778]"
                    : "bg-gold/15 text-gold"
                }`}
              >
                {p.status === "active" ? "Ενεργή" : "Εκκρεμεί"}
              </span>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => unlink(p.id, nameOf(p) || "")}
                  data-testid={`admin-partnership-end-${p.id}`}
                  className="shrink-0 p-1.5 rounded-md text-[#FF6961] hover:bg-white/5 disabled:opacity-50"
                  title="Τερματισμός συνεργασίας"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2 mt-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            data-testid="admin-partnership-pick"
            className="flex-1 h-10 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
          >
            <option value="">
              {isShop ? "Σύνδεση με εταιρεία διανομής..." : "Σύνδεση με κατάστημα..."}
            </option>
            {/* Προτεραιότητα: ίδια πόλη πρώτα (το backend τα στέλνει ταξινομημένα) */}
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {(isShop ? c.name : c.restaurant_name) || "—"}
                {c.city ? ` · ${c.city}` : ""}
                {c.same_city ? " ★" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !pick}
            onClick={link}
            data-testid="admin-partnership-link"
            className="h-10 px-4 rounded-md bg-brand hover:bg-brand-hover text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-40"
          >
            <Link2 className="w-4 h-4" /> Σύνδεση
          </button>
        </div>
      )}
      {canEdit && (
        <p className="text-[11px] text-neutral-500 mt-1.5">
          ★ = ίδια πόλη. Η σύνδεση ενεργοποιείται αμέσως και για τις δύο πλευρές — χωρίς
          αίτημα ή έγκριση.
        </p>
      )}
    </div>
  );
}
