import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { COUNTDOWN_CLS, countdownTone, formatCountdown, secondsLeft } from "@/lib/platforms";

// Αντίστροφη μέτρηση μέχρι τη συμφωνημένη ώρα παράδοσης: πράσινο κανονικά,
// κίτρινο κάτω από 10΄, κόκκινο όταν έχει περάσει η ώρα. Τικάρει ανά δευτερόλεπτο.
export default function Countdown({ dueAt, size = "md", testId }) {
  const [secs, setSecs] = useState(() => secondsLeft(dueAt));

  useEffect(() => {
    setSecs(secondsLeft(dueAt));
    const t = setInterval(() => setSecs(secondsLeft(dueAt)), 1000);
    return () => clearInterval(t);
  }, [dueAt]);

  if (!dueAt) return null;
  const tone = countdownTone(secs);
  const box =
    size === "sm"
      ? "h-6 px-1.5 text-[11px] gap-1"
      : size === "lg"
        ? "h-10 px-3 text-xl gap-1.5"
        : "h-8 px-2.5 text-sm gap-1.5";

  return (
    <span
      data-testid={testId}
      data-tone={tone}
      title={tone === "late" ? "Έχει περάσει η ώρα παράδοσης" : "Απομένει έως την παράδοση"}
      className={`inline-flex items-center rounded-md border font-mono font-bold tabular-nums ${box} ${COUNTDOWN_CLS[tone]}`}
    >
      <Timer className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      {formatCountdown(secs)}
    </span>
  );
}
