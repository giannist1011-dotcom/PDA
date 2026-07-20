export function MockupFrame({ label, children }) {
  return (
    <div className="rounded-2xl border border-[#3a3a3a] bg-[#161616] shadow-2xl shadow-black/50 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 h-9 bg-[#1f1f1f] border-b border-[#333]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-gold" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-[11px] text-neutral-500 font-mono truncate">orderdeck · {label}</span>
      </div>
      <div className="aspect-[4/3] p-4">{children}</div>
    </div>
  );
}

/* Placeholder screenshot content — swapped for real screenshots later */
export function PlaceholderPDA() {
  return (
    <div className="h-full flex gap-2">
      <div className="flex-1 grid grid-cols-3 gap-1.5 content-start">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={`h-10 rounded-md ${i === 1 ? "bg-flame/30" : "bg-[#262626]"}`} />
        ))}
      </div>
      <div className="w-1/3 flex flex-col gap-1.5">
        <div className="flex-1 rounded-md bg-[#262626]" />
        <div className="h-8 rounded-md bg-brand" />
      </div>
    </div>
  );
}

export function PlaceholderTables() {
  return (
    <div className="h-full grid grid-cols-4 gap-2 content-start">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`aspect-square rounded-lg border-2 ${
            i % 3 === 0 ? "bg-flame/15 border-flame/50" : "bg-[#00E676]/10 border-[#00E676]/30"
          }`}
        />
      ))}
    </div>
  );
}

export function PlaceholderStats() {
  const bars = [35, 60, 45, 80, 55, 95, 70];
  return (
    <div className="h-full flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-md bg-[#262626] p-2">
            <div className={`h-2 w-8 rounded-sm ${i === 0 ? "bg-gold/60" : "bg-[#3a3a3a]"}`} />
            <div className="h-3 w-12 rounded-sm bg-[#3a3a3a] mt-1.5" />
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-end gap-2 px-2">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-brand to-flame/80" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
