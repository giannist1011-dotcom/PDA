import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Trash2, ShieldCheck, UserRound } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";
import {
  apiFleetMembers,
  apiFleetCreateMember,
  apiFleetUpdateMember,
  apiFleetDeleteMember,
} from "@/lib/fleetApi";
import { formatApiError } from "@/lib/api";
import FleetShell from "@/pages/fleet/FleetShell";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-sm text-white focus:outline-none focus:border-flame";

// Διαχείριση μελών ομάδας (συντονιστής): κωδικός πρόσκλησης οδηγών +
// δημιουργία/επεξεργασία/διαγραφή προφίλ συντονιστών & οδηγών.
export default function FleetMembers() {
  const { team } = useFleet();
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(null); // null | {} (νέο) | member
  const [form, setForm] = useState({ name: "", role: "driver", pin: "" });
  const [busy, setBusy] = useState(false);

  const load = () => apiFleetMembers().then(setMembers).catch(() => {});
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (m) => {
    setEditing(m || {});
    setForm(m ? { name: m.name, role: m.role, pin: "" } : { name: "", role: "driver", pin: "" });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!editing.id && !/^\d{4}$/.test(form.pin)) {
      toast.error("Απαιτείται 4-ψήφιο PIN");
      return;
    }
    setBusy(true);
    try {
      const payload = { name: form.name.trim(), role: form.role, pin: form.pin || null };
      if (editing.id) await apiFleetUpdateMember(editing.id, payload);
      else await apiFleetCreateMember(payload);
      setEditing(null);
      load();
      toast.success("Αποθηκεύτηκε");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
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

  const copyInvite = () => {
    navigator.clipboard?.writeText(team?.invite_code || "");
    toast.success("Ο κωδικός αντιγράφηκε");
  };

  return (
    <FleetShell title="Μέλη ομάδας">
      <div className="max-w-2xl space-y-4">
        <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4">
          <div className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-1">
            Κωδικός πρόσκλησης οδηγών
          </div>
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-2xl font-bold tracking-[0.3em] text-gold"
              data-testid="fleet-invite-code"
            >
              {team?.invite_code || "—"}
            </span>
            <button
              onClick={copyInvite}
              className="p-2 rounded-md hover:bg-white/5 text-neutral-300"
              title="Αντιγραφή"
              data-testid="fleet-invite-copy"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Οι οδηγοί μπαίνουν από το κινητό τους στο <span className="text-white">/fleet/join</span> με
            αυτόν τον κωδικό — δημιουργούν όνομα και PIN μόνοι τους.
          </p>
        </div>

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
                <span className="font-semibold truncate">{m.name}</span>
                <span className="text-xs text-neutral-500">
                  {m.role === "fleet_admin" ? "Συντονιστής" : "Οδηγός"}
                </span>
                <div className="ml-auto flex gap-1">
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
