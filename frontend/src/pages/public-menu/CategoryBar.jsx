import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Sticky μπάρα κατηγοριών με scroll spy: highlight της κατηγορίας που βλέπει ο
// χρήστης, αυτόματο κεντράρισμα του ενεργού chip, βελάκια + gradient fades όταν
// υπάρχει κρυμμένο περιεχόμενο. ΠΡΟΣΟΧΗ: το sticky προϋποθέτει ότι ΚΑΝΕΝΑΣ
// γονέας της σελίδας δεν έχει overflow (hidden/auto) — το οριζόντιο scroll
// ζει μόνο στο εσωτερικό div (barRef).
export default function CategoryBar({ categories }) {
  const [active, setActive] = useState(categories[0]?.id || null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const barRef = useRef(null);

  // Ενημέρωση ορατότητας βελών/fades ανάλογα με τη θέση του οριζόντιου scroll
  const updateArrows = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    setCanLeft(bar.scrollLeft > 4);
    setCanRight(bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    updateArrows();
    bar.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      bar.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, categories]);

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

  // Κράτα το ενεργό chip ορατό/κεντραρισμένο στην μπάρα (κινητό).
  // ΜΟΝΟ οριζόντιο scrollLeft του container — ποτέ scrollIntoView, γιατί
  // σκρολάρει και κάθετα τη σελίδα και "κλωτσάει" το scroll του χρήστη.
  useEffect(() => {
    if (!active) return;
    const bar = barRef.current;
    const btn = bar?.querySelector(`[data-cat="${active}"]`);
    if (!bar || !btn) return;
    const target = btn.offsetLeft - (bar.clientWidth - btn.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);

  const scrollBar = (dir) => {
    const bar = barRef.current;
    if (!bar) return;
    bar.scrollTo({
      left: bar.scrollLeft + dir * Math.round(bar.clientWidth * 0.7),
      behavior: "smooth",
    });
  };

  const scrollToCat = (id) => {
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (categories.length < 2) return null;

  return (
    <nav className="sticky top-0 z-20 bg-[#1A070C]/90 backdrop-blur-md border-b border-[#3D1620]">
      <div className="relative max-w-2xl mx-auto">
        <div
          ref={barRef}
          className="px-3 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar"
        >
          {categories.map((c) => (
            <button
              key={c.id}
              data-cat={c.id}
              onClick={() => scrollToCat(c.id)}
              data-testid={`catbar-${c.id}`}
              className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold leading-none border transition-colors ${
                active === c.id
                  ? "bg-flame/15 border-flame text-flame"
                  : "bg-[#3D1620] border-[#723645] text-neutral-200 hover:border-flame hover:text-flame"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Gradient fades — οπτική ένδειξη ότι υπάρχει κι άλλο περιεχόμενο */}
        {canLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#1A070C] to-transparent" />
        )}
        {canRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#1A070C] to-transparent" />
        )}

        {/* Βελάκια — μόνο όταν υπάρχει κρυμμένο περιεχόμενο προς τη μεριά τους */}
        {canLeft && (
          <button
            onClick={() => scrollBar(-1)}
            aria-label="Κύλιση κατηγοριών αριστερά"
            data-testid="catbar-arrow-left"
            className="absolute left-0.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#2A0E14]/95 border border-[#723645] flex items-center justify-center text-neutral-300 hover:text-flame hover:border-flame transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {canRight && (
          <button
            onClick={() => scrollBar(1)}
            aria-label="Κύλιση κατηγοριών δεξιά"
            data-testid="catbar-arrow-right"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#2A0E14]/95 border border-[#723645] flex items-center justify-center text-neutral-300 hover:text-flame hover:border-flame transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </nav>
  );
}
