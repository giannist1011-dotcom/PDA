import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Pencil, Trash2, ShieldCheck, UserRound } from "lucide-react";
import {
  apiFleetMembers,
  apiFleetCreateMember,
  apiFleetUpdateMember,
  apiFleetDeleteMember,
  apiFleetResetMemberPassword,
} from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import FleetShell from "@/pages/fleet/FleetShell";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame";

// Διαχείριση μελών (συντονιστής). Διανομείς: η εταιρεία δημιουργεί τον προσωπικό
// λογαριασμό (τηλέφωνο/email) — ο προσωρινός κωδικός εμφανίζεται ΜΙΑ φορά εδώ.
export default function FleetMembers() {
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(null); // null | {} (νέο) | member
  const [form, setForm] = useState({ name: "", role: "driver", pin: "", identifier: "" });
  const [busy, setBusy] = useState(false);
  // Προσωρινός κωδικός που μόλις εκδόθηκε: {name, identifier, password}
  const [issued, setIssued] = useState(null);

  const load = () => apiFleetMembers().then(setMembers).catch(() => {});
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (m) => {
    setEditing(m || {});
    setForm(
      m
        ? { name: m.name, role: m.role, pin: "", identifier: m.identifier || "" }
        : { name: "", role: "driver", pin: "", identifier: "" }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    const isNew = !editing.id;
    if (isNew && form.role === "fleet_admin" && !/^\d{4}$/.test(form.pin)) {
      toast.error("Απαιτείται 4-ψήφιο PIN");
      return;
    }
    if (isNew && form.role === "driver" && !form.identifier.trim()) {
      toast.error("Απαιτείται τηλέφωνο ή email διανομέα");
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        const res = await apiFleetCreateMember({
          name: form.name.trim(),
          role: form.role,
          pin: form.pin || null,
          phone_or_email: form.role === "driver" ? form.identifier.trim() : null,
        });
        if (res.temp_password) {
          setIssued({ name: res.name, identifier: res.identifier, password: res.temp_password });
        } else if (res.existing_account) {
          toast.success("Ο διανομέας υπάρχει ήδη — συνδέθηκε με την εταιρία σας");
        }
      } else {
        await apiFleetUpdateMember(editing.id, {
          name: form.name.trim(),
          role: form.role,
          pin: form.pin || null,
        });
      }
      setEditing(null);
      load();
      if (!isNew) toast.success("Αποθηκεύτηκε");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (m) => {
    if (!window.confirm(`Νέος προσωρινός κωδικός για τον/την «${m.name}»; Ο παλιός παύει να ισχύει.`))
      return;
    try {
      const res = await apiFleetResetMemberPassword(m.id);
      setIssued({ name: m.name, identifier: res.identifier, password: res.temp_password });
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Διαγραφή του μέλους «${m.name}»;`)) return;
    try {
      await apiFleetDeleteMember(m.id);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const copyIssued = () => {
    navigator.clipboard?.writeText(`${issued.identifier} / ${issued.password}`);
    toast.success("Αντιγράφηκε");
  };

  return (
    <FleetShell title="Μέλη ομάδας">
      <div className="max-w-2xl space-y-4">
        {issued && (
          <div
            className="bg-[#3D1620] border border-gold rounded-lg p-4"
            data-testid="fleet-temp-password"
          >
            <div className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-1">
              Προσωρινός κωδικός — εμφανίζεται μόνο τώρα
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-neutral-300">Δώσε στον διανομέα:</span>
              <span className="font-mono text-lg font-bold text-gold">
                {issued.identifier} / {issued.password}
              </span>
              <button
                onClick={copyIssued}
                className="p-2 rounded-md hover:bg-white/5 text-neutral-300"
                title="Αντιγραφή"
                data-testid="fleet-temp-password-copy"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              Ο/Η {issued.name} συνδέεται στο <span className="text-white">/fleet/driver-login</span> και
              ορίζει δικό του κωδικό στην πρώτη είσοδο.
            </p>
            <button
              onClick={() => setIssued(null)}
              className="mt-2 text-xs text-neutral-400 hover:text-white underline"
            >
              Το έδωσα — απόκρυψη
            </button>
          </div>
        )}

        <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
          <div className="flex items-center mb-3">
            <h2 className="font-heading font-bold text-sm">Μέλη ({members.length})</h2>
            <Button
              onClick={() => openEdit(null)}
              data-testid="fleet-member-add"
              className="ml-auto h-9 bg-brand hover:bg-brand-hover text-white text-xs font-bold px-3"
            >
              + Νέο μέλος
            </Button>
          </div>
          <ul className="divide-y divide-[#723645]/40">
            {members.map((m) => (
              <li key={m.id} className="py-2.5 flex items-center gap-2">
                {m.role === "fleet_admin" ? (
                  <ShieldCheck className="w-4 h-4 text-gold shrink-0" />
                ) : (
                  <UserRound className="w-4 h-4 text-flame shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="font-semibold truncate block leading-tight">{m.name}</span>
                  <span className="text-xs text-neutral-500 leading-tight">
                    {m.role === "fleet_admin" ? "Συντονιστής" : "Οδηγός"}
                    {m.identifier ? ` · ${m.identifier}` : ""}
                  </span>
                </div>
                <div className="ml-auto flex gap-1">
                  {m.account_id && (
                    <button
                      onClick={() => resetPassword(m)}
                      className="p-1.5 rounded-md hover:bg-white/5 text-gold"
                      title="Νέος προσωρινός κωδικός"
                      data-testid={`fleet-member-resetpw-${m.id}`}
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(m)}
                    className="p-1.5 rounded-md hover:bg-white/5 text-neutral-400"
                    data-testid={`fleet-member-edit-${m.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(m)}
                    className="p-1.5 rounded-md hover:bg-white/5 text-[#FF6961]"
                    data-testid={`fleet-member-delete-${m.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {editing !== null && (
          <form
            onSubmit={submit}
            className="bg-[#3D1620] border border-flame/60 rounded-lg p-4 space-y-3"
            data-testid="fleet-member-form"
          >
            <h3 className="font-heading font-bold text-sm">
              {editing.id ? `Επεξεργασία: ${editing.name}` : "Νέο μέλος"}
            </h3>
            <input
              required
              maxLength={40}
              placeholder="Όνομα"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
              data-testid="fleet-member-name"
            />
            {!editing.id && (
              <div className="flex gap-2">
                {[
                  ["driver", "Οδηγός"],
                  ["fleet_admin", "Συντονιστής"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, role: k }))}
                    className={`flex-1 h-11 rounded-md border text-sm font-semibold ${
                      form.role === k
                        ? "border-flame bg-[#4A1B27] text-white"
                        : "border-[#723645] bg-[#2A0E14] text-neutral-400"
                    }`}
                    data-testid={`fleet-member-role-${k}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {!editing.id && form.role === "driver" ? (
              <>
                <input
                  required
                  maxLength={80}
                  placeholder="Τηλέφωνο ή email διανομέα"
                  value={form.identifier}
                  onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
                  className={inputCls}
                  data-testid="fleet-member-identifier"
                />
                <p className="text-xs text-neutral-400">
                  Θα δημιουργηθεί λογαριασμός με προσωρινό κωδικό — αν ο διανομέας έχει ήδη
                  λογαριασμό (π.χ. από άλλη εταιρεία), απλώς θα συνδεθεί με την εταιρία σας.
                </p>
              </>
            ) : (
              <input
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder={editing.id ? "Νέο PIN (κενό = χωρίς αλλαγή)" : "PIN (4 ψηφία)"}
                value={form.pin}
                onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
                className={`${inputCls} text-center tracking-[0.4em]`}
                data-testid="fleet-member-pin"
              />
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={busy}
                className="h-11 flex-1 bg-brand hover:bg-brand-hover text-white font-bold"
                data-testid="fleet-member-save"
              >
                Αποθήκευση
              </Button>
              <Button
                type="button"
                onClick={() => setEditing(null)}
                className="h-11 px-4 bg-transparent border border-[#723645] text-neutral-300 hover:bg-white/5"
              >
                Άκυρο
              </Button>
            </div>
          </form>
        )}
      </div>
    </FleetShell>
  );
}
