import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, User } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { apiChangePin, formatApiError } from "@/lib/api";

function PinChanger({ target, label, subtitle, icon: Icon, color, onSaved }) {
  const [current, setCurrent] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(current)) {
      toast.error("Ο κωδικός πρέπει να είναι 4 ψηφία");
      return;
    }
    if (current !== confirm) {
      toast.error("Οι κωδικοί δεν ταιριάζουν");
      return;
    }
    setBusy(true);
    try {
      await apiChangePin(target, current);
      toast.success("Ο κωδικός αλλάχτηκε");
      setCurrent("");
      setConfirm("");
      onSaved?.();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="p-6 bg-[#1A1A1A] border border-[#333] rounded-lg"
      data-testid={`pin-change-form-${target}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center"
          style={{ background: color }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-heading text-lg font-bold">{label}</div>
          <div className="text-xs text-neutral-500">{subtitle}</div>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Νέος κωδικός (4 ψηφία)
          </label>
          <input
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={current}
            onChange={(e) => setCurrent(e.target.value.replace(/\D/g, "").slice(0, 4))}
            data-testid={`new-pin-${target}`}
            className="w-full h-12 mt-1 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white font-mono text-xl tracking-widest text-center focus:outline-none focus:border-[#FF6B00]"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Επιβεβαίωση
          </label>
          <input
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
            data-testid={`confirm-pin-${target}`}
            className="w-full h-12 mt-1 px-3 bg-[#0D0D0D] border border-[#333] rounded-md text-white font-mono text-xl tracking-widest text-center focus:outline-none focus:border-[#FF6B00]"
          />
        </div>
        <Button
          type="submit"
          disabled={busy || current.length !== 4 || confirm.length !== 4}
          data-testid={`save-pin-${target}`}
          className="w-full h-12 bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold"
        >
          Αποθήκευση κωδικού
        </Button>
      </div>
    </form>
  );
}

export default function Settings() {
  const { refreshMe } = useAuth();
  return (
    <AppShell title="Ρυθμίσεις">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[900px] mx-auto w-full">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-6 h-6 text-[#FF6B00]" />
            <h2 className="font-heading text-2xl font-bold">Κωδικοί προφίλ</h2>
          </div>
          <p className="text-sm text-neutral-400">
            Ορίστε 4-ψήφιους κωδικούς για τα δύο προφίλ του καταστήματος
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PinChanger
            target="owner"
            label="Κωδικός Ιδιοκτήτη"
            subtitle="Πλήρη πρόσβαση σε όλα"
            icon={ShieldCheck}
            color="#FF6B00"
            onSaved={refreshMe}
          />
          <PinChanger
            target="employee"
            label="Κωδικός Υπαλλήλου"
            subtitle="Παραγγελίες + προβολή προγράμματος"
            icon={User}
            color="#00B0FF"
            onSaved={refreshMe}
          />
        </div>
      </main>
    </AppShell>
  );
}
