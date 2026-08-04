import { ChevronRight, ShoppingCart } from "lucide-react";
import { eur } from "@/lib/format";

// Λεπτή sticky μπάρα στη ΒΑΣΗ της όψης «Μενού» (tablet/κινητό — ποτέ σε
// side-by-side): πλήθος + σύνολο και μετάβαση στην όψη «Παραγγελία».
// Το badge αναπηδά (key={count} + pk-pop) σε ΚΑΘΕ προσθήκη προϊόντος —
// στιγμιαίο feedback χωρίς να αλλάξει η όψη.
export default function CartBar({ count, total, onOpen }) {
  const empty = count === 0;
  return (
    <div className="shrink-0 border-t border-[#723645] bg-[#2A0E14] p-2">
      <button
        onClick={onOpen}
        data-testid="pda-cart-bar"
        data-count={count}
        className="w-full h-12 px-3 rounded-md flex items-center gap-2 bg-brand text-white font-bold active:scale-[0.99] transition-transform no-select"
      >
        <ShoppingCart className="w-5 h-5 shrink-0" />
        {!empty && (
          <span
            key={count}
            className="pk-pop min-w-[22px] h-[22px] px-1.5 rounded-full bg-flame text-white text-xs font-bold flex items-center justify-center shrink-0"
            data-testid="pda-cart-bar-count"
          >
            {count}
          </span>
        )}
        <span className="text-sm truncate">
          {empty ? "Κενή παραγγελία" : `${count} ${count === 1 ? "προϊόν" : "προϊόντα"}`}
        </span>
        {!empty && (
          <span className="font-mono text-sm shrink-0" data-testid="pda-cart-bar-total">
            — {eur(total)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-sm shrink-0">
          Παραγγελία
          <ChevronRight className="w-4 h-4" />
        </span>
      </button>
    </div>
  );
}
