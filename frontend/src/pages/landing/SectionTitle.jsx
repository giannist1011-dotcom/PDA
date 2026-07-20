import { Sparkles } from "lucide-react";

export default function SectionTitle({ eyebrow, title, sub }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
      {eyebrow && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-bold uppercase tracking-widest mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          {eyebrow}
        </div>
      )}
      <h2 className="font-heading text-3xl md:text-4xl font-extrabold text-white leading-tight">{title}</h2>
      {sub && <p className="mt-3 text-neutral-400 text-base md:text-lg">{sub}</p>}
    </div>
  );
}
