import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Power, Pencil, RefreshCw, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  apiAdminListAnnouncements,
  apiAdminCreateAnnouncement,
  apiAdminUpdateAnnouncement,
  apiAdminDeleteAnnouncement,
  formatApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/DatePicker";
import { formatGRDate } from "@/lib/format";
import AdminShell, { useAdminPw } from "@/components/AdminShell";

const TYPE_LABELS = { info: "Ενημέρωση", warning: "Προειδοποίηση", success: "Καλά νέα" };
const TYPE_ICONS = { info: Info, warning: AlertTriangle, success: CheckCircle2 };
const TYPE_COLORS = {
  info: "bg-[#0A84FF]/15 text-[#7CBEFF]",
  warning: "bg-[#FFB340]/15 text-[#FFB340]",
  success: "bg-[#30D158]/15 text-[#5CE585]",
};

const BIZ_LABELS = {
  all: "Όλα τα μαγαζιά",
  souvlaki: "Σουβλατζίδικα",
  cafe: "Καφετέριες",
  pizzeria: "Πιτσαρίες",
  burger: "Burger",
};
const PLAN_LABELS = {
  all: "Όλα τα πλάνα",
  trial: "Trial",
  pro: "Pro",
  pro_deckpilot: "Pro + DeckPilot",
};

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame";

const EMPTY_FORM = {
  title: "",
  body: "",
  type: "info",
  expires_at: "",
  active: true,
  target_business_type: "all",
  target_plan: "all",
};

const Field = ({ label, optional, children }) => (
  <div>
    <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">
      {label}
      {optional && (
        <span className="text-neutral-600 normal-case tracking-normal font-normal"> (προαιρετικό)</span>
      )}
    </label>
    <div className="mt-1">{children}</div>
  </div>
);

function AnnouncementsContent() {
  const pw = useAdminPw();
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null); // null = δημιουργία
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = async () => {
    const data = await apiAdminListAnnouncements(pw);
    setItems(data);
  };

  useEffect(() => {
    load().catch((err) => toast.error(formatApiError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    try {
      await load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const startCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (a) => {
    setEditId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      type: a.type,
      expires_at: a.expires_at || "",
      active: a.active,
      target_business_type: a.target_business_type || "all",
      target_plan: a.target_plan || "all",
    });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Συμπληρώστε τίτλο και κείμενο");
      return;
    }
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      type: form.type,
      expires_at: form.expires_at || null,
      active: form.active,
      target_business_type: form.target_business_type,
      target_plan: form.target_plan,
    };
    setBusy(true);
    try {
      if (editId) {
        await apiAdminUpdateAnnouncement(pw, editId, payload);
        toast.success("Η ανακοίνωση ενημερώθηκε");
      } else {
        await apiAdminCreateAnnouncement(pw, payload);
        toast.success("Η ανακοίνωση δημιουργήθηκε");
      }
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a) => {
    try {
      await apiAdminUpdateAnnouncement(pw, a.id, { active: !a.active });
      setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)));
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Διαγραφή της ανακοίνωσης «${a.title}»;`)) return;
    try {
      await apiAdminDeleteAnnouncement(pw, a.id);
      setItems((xs) => xs.filter((x) => x.id !== a.id));
      toast.success("Η ανακοίνωση διαγράφηκε");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <>
      <div className="flex gap-2 mb-5">
        <Button
          type="button"
          onClick={refresh}
          className="h-10 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
          data-testid="ann-refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          onClick={startCreate}
          data-testid="ann-new"
          className="h-10 bg-brand hover:bg-brand-hover text-white font-bold"
        >
          <Plus className="w-4 h-4 mr-1" /> Νέα ανακοίνωση
        </Button>
      </div>

      {/* FORM */}
      {showForm && (
        <form onSubmit={submit} className="bg-[#3D1620] border border-[#723645] rounded-lg p-5 mb-6 space-y-4">
          <h2 className="font-heading text-lg font-bold">
            {editId ? "Επεξεργασία ανακοίνωσης" : "Νέα ανακοίνωση"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Τίτλος">
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="π.χ. Προγραμματισμένη συντήρηση"
                data-testid="ann-title"
                className={inputCls}
              />
            </Field>
            <Field label="Τύπος">
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
                data-testid="ann-type"
                className={inputCls}
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Κείμενο">
                <textarea
                  value={form.body}
                  onChange={(e) => set("body", e.target.value)}
                  rows={3}
                  placeholder="Το μήνυμα που θα δουν τα μαγαζιά..."
                  data-testid="ann-body"
                  className="w-full px-3 py-2 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame"
                />
              </Field>
            </div>
            <Field label="Ημερομηνία λήξης" optional>
              <DatePicker
                value={form.expires_at}
                onChange={(v) => set("expires_at", v)}
                clearable
                placeholder="Χωρίς λήξη"
                testId="ann-expires"
                className="w-full h-11 px-3"
              />
            </Field>
            <Field label="Κατάσταση">
              <select
                value={form.active ? "1" : "0"}
                onChange={(e) => set("active", e.target.value === "1")}
                data-testid="ann-active"
                className={inputCls}
              >
                <option value="1">Ενεργή</option>
                <option value="0">Ανενεργή</option>
              </select>
            </Field>
            <Field label="Τύπος επιχείρησης">
              <select
                value={form.target_business_type}
                onChange={(e) => set("target_business_type", e.target.value)}
                data-testid="ann-target-biz"
                className={inputCls}
              >
                {Object.entries(BIZ_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Πλάνο">
              <select
                value={form.target_plan}
                onChange={(e) => set("target_plan", e.target.value)}
                data-testid="ann-target-plan"
                className={inputCls}
              >
                {Object.entries(PLAN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={busy}
              data-testid="ann-submit"
              className="h-11 bg-brand hover:bg-brand-hover text-white font-bold"
            >
              {busy ? "Αποθήκευση..." : editId ? "Αποθήκευση" : "Δημιουργία"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="h-11 bg-[#2A0E14] border border-[#723645] hover:border-flame text-white"
            >
              Άκυρο
            </Button>
          </div>
        </form>
      )}

      {/* LIST */}
      {items.length === 0 ? (
        <div className="text-center text-neutral-500 py-16 border border-dashed border-[#723645] rounded-lg">
          Δεν υπάρχουν ανακοινώσεις ακόμα.
        </div>
      ) : (
        <div className="space-y-3" data-testid="ann-list">
          {items.map((a) => {
            const TypeIcon = TYPE_ICONS[a.type] || Info;
            return (
              <div
                key={a.id}
                className={`bg-[#3D1620] border border-[#723645] rounded-lg p-4 ${a.active ? "" : "opacity-60"}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${TYPE_COLORS[a.type] || TYPE_COLORS.info}`}>
                    <TypeIcon className="w-3.5 h-3.5" />
                    {TYPE_LABELS[a.type] || a.type}
                  </span>
                  <div className="font-bold text-white">{a.title}</div>
                  {!a.active && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FF3B30]/15 text-[#FF6961]">
                      Ανενεργή
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      type="button"
                      onClick={() => startEdit(a)}
                      title="Επεξεργασία"
                      data-testid={`ann-edit-${a.id}`}
                      className="h-9 px-3 bg-[#2A0E14] border border-[#723645] hover:border-flame text-neutral-300 text-xs font-bold"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => toggle(a)}
                      title={a.active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                      data-testid={`ann-toggle-${a.id}`}
                      className={`h-9 px-3 border text-xs font-bold ${
                        a.active
                          ? "bg-[#2A0E14] border-[#723645] hover:border-flame text-neutral-300"
                          : "bg-brand border-brand hover:bg-brand-hover text-white"
                      }`}
                    >
                      <Power className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => remove(a)}
                      title="Διαγραφή"
                      data-testid={`ann-delete-${a.id}`}
                      className="h-9 px-3 bg-[#2A0E14] border border-[#723645] hover:border-[#FF3B30] text-[#FF6961]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-neutral-300 whitespace-pre-wrap">{a.body}</div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-xs text-neutral-400">
                  <div>
                    Στόχευση:{" "}
                    <span className="text-white">
                      {BIZ_LABELS[a.target_business_type || "all"]} · {PLAN_LABELS[a.target_plan || "all"]}
                    </span>
                  </div>
                  <div>
                    Λήξη: <span className="text-white">{a.expires_at ? formatGRDate(a.expires_at) : "—"}</span>
                  </div>
                  <div>
                    Δημιουργήθηκε: <span className="text-white">{formatGRDate(a.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function AdminAnnouncements() {
  return (
    <AdminShell title="Ανακοινώσεις" subtitle="Μηνύματα προς όλα τα μαγαζιά (banner στην εφαρμογή)">
      <AnnouncementsContent />
    </AdminShell>
  );
}
