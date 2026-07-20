import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#333] rounded-xl bg-[#141414] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-semibold text-white text-sm md:text-base">{q}</span>
        <ChevronDown className={`w-5 h-5 text-flame shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 text-sm md:text-base text-neutral-400 leading-relaxed">{a}</div>}
    </div>
  );
}
