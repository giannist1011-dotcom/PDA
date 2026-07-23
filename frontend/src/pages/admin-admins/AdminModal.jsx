import { useState } from "react";
import { toast } from "sonner";
import { X, Save, KeyRound } from "lucide-react";
import { apiAdminCreateAdmin, apiAdminUpdateAdmin, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { inputCls } from "../admin-shops/utils";
import { PRODUCT_LABELS, RIGHTS_LABELS } from "./utils";

// ============ ΔΗΜΙΟΥΡΓΙΑ / ΕΠΕΞΕΡΓΑΣΙΑ SUB-ADMIN ============
// Στη δημιουργία ο server επιστρέφει προσωρινό κωδικό ΜΙΑ φορά (υποχρεωτική
// αλλαγή στην πρώτη είσοδο) — εμφανίζεται εδώ μέχρι το κλείσιμο του modal.
function AdminModal({ pw, admin, onClose }) {
  const isCreate = !admin;
  const [form, setForm] = useState({
    name: admin?.name || "",
    email: admin?.email || "",
    products: admin?.products || ["orderdeck"],
    cities: (admin?.cities || []).join(", "),
    rights: admin?.rights || "view",
  });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // {email, password} μετά τη δημιουργία

  const toggleProduct = (p) =>
    setForm((f) => ({
      ...f,
      products: f.products.includes(p)
        ? f.products.filter((x) => x !== p)
        : [...f.products, p],
    }));

  const save = async (e) => {
    e.preventDefault();
    const cities = form.cities.split(",").map((c) => c.trim()).filter(Boolean);
    if (!form.products.length) return toast.error("Επιλέξτε τουλάχιστον ένα προϊόν");
    if (!cities.length) return toast.error("Δώστε τουλάχιστον μία πόλη");
    setBusy(true);
    try {
      if (isCreate) {
        const res = await apiAdminCreateAdmin(pw, {
          name: form.name.trim(),
          email: form.email.trim(),
          products: form.products,
          cities,
          rights: form.rights,
        });
        setCreated({ email: res.email, password: res.password });
      } else {
        await apiAdminUpdateAdmin(pw, admin.id, {
          name: form.name.trim(),
          products: form.products,
          cities,
          rights: form.rights,
        });
        toast.success("Αποθηκεύτηκε");
        onClose(true);
      }
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4"
      onClick={() => onClose(!!created)}
    >
      <div
        className="w-full max-w-md bg-[#3D1620] border border-[#723645] rounded-lg my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#723645]">
          <div className="font-heading text-lg font-bold">
            {isCreate ? "Νέος διαχειριστής" : `Επεξεργασία: ${admin.name}`}
          </div>
          <button
            type="button"
            onClick={() => onClose(!!created)}
            className="w-9 h-9 rounded-md hover:bg-[#2A0E14] flex items-center justify-center"
            data-testid="admin-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {created ? (
          <div className="p-5 space-y-4">
            <div className="p-4 bg-gold/10 border border-gold/50 rounded-lg text-sm space-y-1">
              <div className="flex items-center gap-2 font-bold text-gold">
                <KeyRound className="w-4 h-4" /> Προσωρινά στοιχεία — εμφανίζονται μόνο τώρα
              </div>
              <div className="font-mono text-xs text-neutral-200">Email: {created.email}</div>
              <div className="font-mono text-xs text-neutral-200">Κωδικός: {created.password}</div>
              <p className="text-xs text-neutral-400 pt-1">
                Στην πρώτη είσοδο θα ζητηθεί υποχρεωτικά νέος κωδικός.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => onClose(true)}
              data-testid="admin-created-ok"
              className="w-full h-10 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              Εντάξει
            </Button>
          </div>
        ) : (
          <form onSubmit={save} className="p-5 space-y-4">
            <div>
              <label className="text-xs text-neutral-400 font-semibold">Όνομα</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                data-testid="admin-form-name"
                className={`${inputCls} mt-1`}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 font-semibold">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                disabled={!isCreate}
                data-testid="admin-form-email"
                className={`${inputCls} mt-1 disabled:opacity-50`}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 font-semibold">Προϊόντα</label>
              <div className="flex gap-2 mt-1">
                {Object.entries(PRODUCT_LABELS).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleProduct(k)}
                    data-testid={`admin-form-product-${k}`}
                    className={`h-10 px-4 rounded-md border text-sm font-bold transition-colors ${
                      form.products.includes(k)
                        ? "bg-flame/15 border-flame text-flame"
                        : "bg-[#2A0E14] border-[#723645] text-neutral-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-400 font-semibold">
                Πόλεις (χωρισμένες με κόμμα)
              </label>
              <input
                value={form.cities}
                onChange={(e) => setForm((f) => ({ ...f, cities: e.target.value }))}
                placeholder="π.χ. Θεσσαλονίκη, Καλαμαριά"
                required
                data-testid="admin-form-cities"
                className={`${inputCls} mt-1`}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 font-semibold">Δικαιώματα</label>
              <div className="flex gap-2 mt-1">
                {Object.entries(RIGHTS_LABELS).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, rights: k }))}
                    data-testid={`admin-form-rights-${k}`}
                    className={`h-10 px-4 rounded-md border text-sm font-bold transition-colors ${
                      form.rights === k
                        ? "bg-flame/15 border-flame text-flame"
                        : "bg-[#2A0E14] border-[#723645] text-neutral-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1.5">
                «Διαχείριση» = ενεργοποίηση/απενεργοποίηση, σημειώσεις, resets. Ποτέ
                διαγραφές, πλάνα/τιμές ή δημιουργία demo/διαχειριστών.
              </p>
            </div>
            <Button
              type="submit"
              disabled={busy}
              data-testid="admin-form-save"
              className="w-full h-10 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isCreate ? "Δημιουργία" : "Αποθήκευση"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AdminModal;
