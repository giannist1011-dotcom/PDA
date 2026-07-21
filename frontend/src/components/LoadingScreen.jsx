import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getToken } from "@/lib/api";

// Branded οθόνη φόρτωσης: full-screen μπορντό overlay με το "D" μονόγραμμα
// σε breathing animation (CSS μόνο). Μετά από 8" εμφανίζεται διακριτικό
// μήνυμα για το cold start του server (Render: 30-60"). Με show=false το
// overlay κάνει smooth fade-out και μετά unmount.
const FADE_MS = 500;
const SLOW_HINT_MS = 8000;

export default function LoadingScreen({ show = true }) {
  const [mounted, setMounted] = useState(show);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (show) {
      setMounted(true);
      return undefined;
    }
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(t);
  }, [show]);

  useEffect(() => {
    if (!show) return undefined;
    const t = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    return () => clearTimeout(t);
  }, [show]);

  if (!mounted) return null;
  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-[#2A0E14] transition-opacity duration-500 ${
        show ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      data-testid="loading-screen"
    >
      <svg viewBox="0 0 512 512" className="w-20 h-20 animate-od-breathe" aria-hidden="true">
        <g transform="skewX(-9)">
          <path
            d="M181 132 L181 380 L287 380 Q423 380 423 256 Q423 132 287 132 Z"
            fill="#F97316"
          />
        </g>
      </svg>
      <div
        className={`text-sm text-neutral-400 transition-opacity duration-700 ${
          slow ? "opacity-100" : "opacity-0"
        }`}
      >
        Σύνδεση με τον server...
      </div>
    </div>
  );
}

// Overlay εκκίνησης της εφαρμογής: ορατό όσο το /auth/me εκκρεμεί (user===null,
// περιλαμβάνει το cold start του backend). Αν η συσκευή δεν είχε token, ο
// έλεγχος τελειώνει ακαριαία — δεν δείχνουμε καθόλου overlay (όχι flash στο landing).
export function StartupOverlay() {
  const { user } = useAuth();
  const [hadToken] = useState(() => !!getToken());
  if (!hadToken) return null;
  return <LoadingScreen show={user === null} />;
}
