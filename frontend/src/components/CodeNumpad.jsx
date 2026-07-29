import { useState } from "react";
import { toast } from "sonner";
import { Delete, Hash, X } from "lucide-react";
import { findExactCode } from "@/lib/menuSearch";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

// Πληκτρολόγιο κωδικών — μικρό κουμπί στη γωνία της οθόνης παραγγελίας (μόνο σε
// προβολή λίστας). Γράφεις τον κωδικό και «Enter»: το προϊόν μπαίνει αμέσως στην
// παραγγελία (ή ανοίγει η παραμετροποίησή του).
export default function CodeNumpad({ items, onItemClick }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  const press = (d) => setCode((c) => (c.length >= 20 ? c : c + d));

  const submit = () => {
    const v = code.trim();
    if (!v) return;
    const it = findExactCode(items, v);
    if (!it) {
      toast.warning(`Ο κωδικός ${v} δεν βρέθηκε`);
      setCode("");
      return;
    }
    if (it.available === false) {
      toast.warning(`${it.name} — έλλειψη`);
      setCode("");
      return;
    }
    onItemClick(it);
    setCode("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-testid="numpad-open"
        title="Πληκτρολόγιο κωδικών"
        className="absolute bottom-3 right-3 z-20 h-11 px-3 flex items-center gap-2 rounded-full bg-[#4A1B27] border border-[#723645] text-neutral-200 shadow-lg hover:border-flame hover:text-white no-select"
      >
        <Hash className="w-4 h-4" />
        <span className="text-sm font-bold">Κωδικός</span>
      </button>
    );
  }

  return (
    <div
      className="absolute bottom-3 right-3 z-20 w-[13.5rem] p-2.5 rounded-lg bg-[#3D1620] border border-[#723645] shadow-2xl"
      data-testid="numpad-panel"
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex-1 h-11 px-3 flex items-center rounded-md bg-[#2A0E14] border border-[#723645] font-mono text-xl font-bold text-gold tabular-nums"
          data-testid="numpad-display"
        >
          {code || <span className="text-neutral-600">κωδ.</span>}
        </div>
        <button
          onClick={() => {
            setOpen(false);
            setCode("");
          }}
          data-testid="numpad-close"
          title="Κλείσιμο"
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-neutral-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {KEYS.slice(0, 9).map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            data-testid={`numpad-key-${d}`}
            className="h-12 rounded-md bg-[#4A1B27] border border-[#723645] font-mono text-xl font-bold text-white hover:border-flame active:scale-[0.96] no-select"
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => setCode((c) => c.slice(0, -1))}
          data-testid="numpad-back"
          title="Διαγραφή"
          className="h-12 rounded-md bg-[#4A1B27] border border-[#723645] text-neutral-300 flex items-center justify-center hover:border-flame active:scale-[0.96] no-select"
        >
          <Delete className="w-5 h-5" />
        </button>
        <button
          onClick={() => press("0")}
          data-testid="numpad-key-0"
          className="h-12 rounded-md bg-[#4A1B27] border border-[#723645] font-mono text-xl font-bold text-white hover:border-flame active:scale-[0.96] no-select"
        >
          0
        </button>
        <button
          onClick={submit}
          data-testid="numpad-enter"
          className="h-12 rounded-md bg-brand hover:bg-brand-hover text-white text-sm font-bold active:scale-[0.96] no-select"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
