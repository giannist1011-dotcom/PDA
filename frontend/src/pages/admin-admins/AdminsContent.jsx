import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  apiAdminListAdmins,
  apiAdminUpdateAdmin,
  apiAdminResetAdminPassword,
  apiAdminDeleteAdmin,
  formatApiError,
} from "@/lib/api";
import { formatGRDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useAdminPw } from "@/components/AdminShell";
import AdminModal from "./AdminModal";
import AuditSection from "./AuditSection";
import { RIGHTS_LABELS, productsLabel } from "./utils";

// ============ ΛΙΣΤΑ SUB-ADMINS (μόνο master) ============
function AdminsContent() {
  const pw = useAdminPw();
  const [admins, setAdmins] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // "create" | admin doc
  const [resetPw, setResetPw] = useState(null); // {name, password} μετά από reset
  const [deleting, setDeleting] = useState(null); // admin doc προς διαγραφή

  const load = useCallback(() => {
    apiAdminListAdmins(pw)
      .then(setAdmins)
      .catch((e) => toast.error(formatApiError(e)));
  }, [pw]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (a, active) => {
    setBusy(true);
    try {
      await apiAdminUpdateAdmin(pw, a.id, { active });
      toast.success(active ? "Ο λογαριασμός ενεργοποιήθηκε" : "Ο λογαριασμός απενεργοποιήθηκε");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (a) => {
    setBusy(true);
    try {
      const res = await apiAdminResetAdminPassword(pw, a.id);
      setResetPw({ name: a.name, email: a.email, password: res.password });
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
      await apiAdminDeleteAdmin(pw, deleting.id);
      toast.success("Ο διαχειριστής διαγράφηκε");
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => setModal("create")}
            data-testid="admins-create"
            className="h-9 px-3 bg-brand hover:bg-brand-hover text-white text-xs font-bold"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Νέος διαχειριστής
          </Button>
        </div>

        {/* Νέος προσωρινός κωδικός μετά από reset — εμφανίζεται μόνο τώρα */}
        {resetPw && (
          <div className="p-4 bg-gold/10 border border-gold/50 rounded-lg text-sm space-y-1">
            <div className="font-bold text-gold">
              Νέος προσωρινός κωδικός για: {resetPw.name} — εμφανίζεται μόνο τώρα
            </div>
            <div className="font-mono text-xs text-neutral-200">
              {resetPw.email} · {resetPw.password}
            </div>
            <button
              type="button"
              onClick={() => setResetPw(null)}
              className="text-xs text-neutral-400 hover:text-white underline"
            >
              Το σημείωσα, κλείσιμο
            </button>
          </div>
        )}

        {!admins ? (
          <div className="text-neutral-500 py-10 text-center">Φόρτωση...</div>
        ) : admins.length === 0 ? (
          <div className="text-center text-neutral-500 py-10 border border-dashed border-[#723645] rounded-lg">
            Δεν υπάρχουν υπο-διαχειριστές ακόμη.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#723645] rounded-lg">
            <table className="w-full text-sm" data-testid="admins-table">
              <thead>
                <tr className="bg-[#3D1620] text-left text-xs uppercase tracking-wider text-neutral-400">
                  <th className="px-3 py-2.5 font-bold">Διαχειριστής</th>
                  <th className="px-3 py-2.5 font-bold">Scope</th>
                  <th className="px-3 py-2.5 font-bold">Δικαιώματα</th>
                  <th className="px-3 py-2.5 font-bold">Τελ. είσοδος</th>
                  <th className="px-3 py-2.5 font-bold">Ενεργός</th>
                  <th className="px-3 py-2.5 font-bold text-right">Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr
                    key={a.id}
                    data-testid={`admin-row-${a.id}`}
                    className="border-t border-[#723645]/50 hover:bg-[#3D1620]/60"
                  >
                    <td
                      className="px-3 py-2.5 cursor-pointer"
                      onClick={() => setModal(a)}
                    >
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-xs text-neutral-500">{a.email}</div>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-300 cursor-pointer" onClick={() => setModal(a)}>
                      <div>{productsLabel(a.products)}</div>
                      <div className="text-xs text-neutral-500">
                        {(a.cities || []).join(", ") || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-300">
                      {RIGHTS_LABELS[a.rights] || a.rights}
                      {a.must_change_password && (
                        <div className="text-[11px] text-gold">Εκκρεμεί αλλαγή κωδικού</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-neutral-300">
                      {a.last_login_at ? formatGRDateTime(a.last_login_at) : "Ποτέ"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Switch
                        checked={a.active !== false}
                        disabled={busy}
                        onCheckedChange={(v) => toggleActive(a, !!v)}
                        data-testid={`admin-active-${a.id}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          onClick={() => resetPassword(a)}
                          disabled={busy}
                          title="Νέος προσωρινός κωδικός"
                          data-testid={`admin-reset-${a.id}`}
                          className="h-8 px-2.5 bg-[#2A0E14] border border-[#723645] hover:border-gold text-gold text-xs font-bold"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setDeleting(a)}
                          disabled={busy}
                          title="Διαγραφή"
                          data-testid={`admin-delete-${a.id}`}
                          className="h-8 px-2.5 bg-[#2A0E14] border border-[#723645] hover:border-[#FF3B30] text-[#FF6961] text-xs font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {deleting && (
          <div className="bg-[#2A0E14] border border-[#FF3B30]/40 rounded-lg p-4 space-y-3">
            <p className="text-sm text-[#FF6961] font-semibold">
              Οριστική διαγραφή του διαχειριστή «{deleting.name}» ({deleting.email});
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={doDelete}
                disabled={busy}
                data-testid="admin-delete-confirm"
                className="h-9 px-4 bg-[#FF3B30] hover:bg-[#d9291f] text-white font-bold"
              >
                Διαγραφή
              </Button>
              <Button
                type="button"
                onClick={() => setDeleting(null)}
                className="h-9 px-4 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
              >
                Άκυρο
              </Button>
            </div>
          </div>
        )}
      </div>

      <AuditSection pw={pw} />

      {modal && (
        <AdminModal
          pw={pw}
          admin={modal === "create" ? null : modal}
          onClose={(changed) => {
            setModal(null);
            if (changed) load();
          }}
        />
      )}
    </div>
  );
}

export default AdminsContent;
