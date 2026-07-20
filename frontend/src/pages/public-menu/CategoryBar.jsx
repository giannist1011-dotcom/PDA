import { useEffect, useRef, useState } from "react";

// Sticky μπάρα κατηγοριών με scroll spy: highlight της κατηγορίας που βλέπει ο
// χρήστης και αυτόματο κεντράρισμα του ενεργού chip στην οριζόντια μπάρα.
export default function CategoryBar({ categories }) {
  const [active, setActive] = useState(categories[0]?.id || null);
  const barRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // Ενεργή = η τελευταία κατηγορία που το section της έχει περάσει το όριο κάτω από την μπάρα
        let current = categories[0]?.id || null;
        for (const c of categories) {
          const el = document.getElementById(`cat-${c.id}`);
          if (el && el.getBoundingClientRect().top <= 130) current = c.id;
        }
        setActive(current);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [categories]);

  // Κράτα το ενεργό chip ορατό/κεντραρισμένο στην μπάρα (κινητό)
  useEffect(() => {
    if (!active) return;
    const btn = barRef.current?.querySelector(`[data-cat="${active}"]`);
    btn?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  const scrollToCat = (id) => {
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (categories.length < 2) return null;

  return (
    <nav className="sticky top-0 z-20 bg-[#1A070C]/90 backdrop-blur-md border-b border-[#3D1620]">
      <div
        ref={barRef}
        className="max-w-2xl mx-auto px-3 py-2.5 flex gap-2 overflow-x-auto no-scrollbar"
      >
        {categories.map((c) => (
          <button
            key={c.id}
            data-cat={c.id}
            onClick={() => scrollToCat(c.id)}
            data-testid={`catbar-${c.id}`}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              active === c.id
                ? "bg-flame/15 border-flame text-flame"
                : "bg-[#3D1620] border-[#723645] text-neutral-200 hover:border-flame hover:text-flame"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
    </nav>
  );
}
