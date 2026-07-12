import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Crown, User as UserIcon, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  apiListProfiles,
  apiCreateProfile,
  apiUpdateProfile,
  apiDeleteProfile,
  formatApiError,
} from "@/lib/api";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/roles";

// waiterOnly: manager view — only Σερβιτόρος profiles, role locked.
function ProfileModal({ open, initial, waiterOnly, onClose, onSave }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(waiterOnly ? "waiter" : "employee");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setRole(waiterOnly ? "waiter" : initial?.role || "employee");
      setPin("");
    }
  }, [open, initial, waiterOnly]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!initial && !/^\d{4}$/.test(pin)) {
      toast.error("Απαιτείται 4-ψήφιο PIN");
      return;
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      toast.error("Ο κωδικός πρέπει να είναι 4 ψηφία");
      return;
    }
    setBusy(true);
    try {
      await onSave({ name: name.trim(), role, pin: pin || null });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="profile-modal"
    >
      <form
        onSubmit={submit}
        className="bg-[#1A1A1A] border border-[#333] rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="font-heading text-xl font-bold mb-4">
          {initial ? "Επεξεργασία προφίλ" : "Νέο προφίλ"}
        </h3>

        <label className="text-xs uppercase tracking-wider text-neutral-400">Όνομα</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="π.χ. Μαρία"
          data-testid="profile-name-input"
          className="w-full h-11 mt-1 mb-4 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#FF6B00]"
        />

        <label className="text-xs uppercase tracking-wider text-neutral-400">Ρόλος</label>
        {waiterOnly ? (
          <div className="w-full h-11 mt-1 mb-4 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-sm flex items-center text-[#00E676] font-bold">
            Σερβιτόρος
          </div>
        ) : (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            data-testid="profile-role-select"
            className="w-full h-11 mt-1 mb-4 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white text-sm focus:outline-none focus:border-[#FF6B00]"
          >
            {Object.entries(ROLE_LABELS).map(([r, label]) => (
              <option key={r} value={r}>
                {label}
              </option>
            ))}
          </select>
        )}

        <label className="text-xs uppercase tracking-wider text-neutral-400">
          {initial ? "Νέο PIN (κενό = χωρίς αλλαγή)" : "PIN (4 ψηφία)"}
        </label>
        <input
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••"
          data-testid="profile-pin-input"
          className="w-full h-11 mt-1 mb-6 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white font-mono text-lg tracking-widest text-center focus:outline-none focus:border-[#FF6B00]"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="profile-cancel-btn"
            className="h-10 px-4 rounded-md bg-[#2A2A2A] text-neutral-300 text-sm font-bold hover:bg-[#333]"
          >
            Άκυρο
          </button>
          <Button
            type="submit"
            disabled={busy}
            data-testid="profile-save-btn"
            className="h-10 bg-[#FF6B00] hover:bg-[#FF8533] px-4"
          >
            Αποθήκευση
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ProfilesManager({ waiterOnly = false }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, editing: null });

  const load = async () => {
    try {
      const all = await apiListProfiles();
      setProfiles(waiterOnly ? all.filter((p) => p.role === "waiter") : all);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (payload) => {
    try {
      if (modal.editing) {
        await apiUpdateProfile(modal.editing.id, payload);
        toast.success("Το προφίλ ενημερώθηκε");
      } else {
        await apiCreateProfile(payload);
        toast.success("Το προφίλ δημιουργήθηκε");
      }
      await load();
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Διαγραφή προφίλ "${p.name}";`)) return;
    try {
      await apiDeleteProfile(p.id);
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const activeProfileId = user && user !== false ? user.profile_id : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-neutral-400">
          {waiterOnly
            ? "Διαχειριστείτε τα προφίλ σερβιτόρων του καταστήματος"
            : "Κάθε μέλος του προσωπικού έχει δικό του προφίλ και 4-ψήφιο PIN"}
        </div>
        <Button
          onClick={() => setModal({ open: true, editing: null })}
          data-testid="profiles-add-btn"
          className="h-10 bg-[#FF6B00] hover:bg-[#FF8533] font-bold"
        >
          <Plus className="w-4 h-4 mr-2" /> Νέο προφίλ
        </Button>
      </div>

      {loading ? (
        <div className="text-neutral-500 py-8 text-center">Φόρτωση...</div>
      ) : profiles.length === 0 ? (
        <div className="text-neutral-500 py-10 text-center border border-dashed border-[#333] rounded-lg">
          Δεν υπάρχουν προφίλ{waiterOnly ? " σερβιτόρων" : ""} ακόμα
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => {
            const color = ROLE_COLORS[p.role] || "#888";
            const Icon = p.role === "owner" ? Crown : UserIcon;
            const isActive = p.id === activeProfileId;
            return (
              <div
                key={p.id}
                data-testid={`profile-row-${p.id}`}
                className="flex items-center gap-3 p-3 bg-[#0D0D0D] border border-[#333] rounded-lg"
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-white truncate">{p.name}</span>
                    {isActive && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#00E676]/15 text-[#00E676]">
                        Ενεργό
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color }}
                  >
                    {ROLE_LABELS[p.role] || p.role}
                  </span>
                </div>
                <span className="hidden sm:flex items-center gap-1 text-[10px] text-neutral-600 uppercase tracking-widest">
                  <KeyRound className="w-3 h-3" /> PIN
                </span>
                <button
                  onClick={() => setModal({ open: true, editing: p })}
                  data-testid={`profile-edit-${p.id}`}
                  className="p-2 text-neutral-400 hover:text-white"
                  title="Επεξεργασία / αλλαγή PIN"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  data-testid={`profile-delete-${p.id}`}
                  className="p-2 text-neutral-400 hover:text-[#FF3B30]"
                  title="Διαγραφή"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ProfileModal
        open={modal.open}
        initial={modal.editing}
        waiterOnly={waiterOnly}
        onClose={() => setModal({ open: false, editing: null })}
        onSave={handleSave}
      />
    </div>
  );
}
