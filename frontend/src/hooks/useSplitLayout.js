import { useEffect, useState } from "react";

// ΤΟ ΟΡΙΟ ΤΟΥ SIDE-BY-SIDE (πλέγμα μενού + δελτίο δίπλα-δίπλα):
// ΜΟΝΟ σε μεγάλες οθόνες — laptop/desktop με πλάτος ≥1100px ΚΑΙ ύψος ≥600px.
// Σε ΟΛΑ τα υπόλοιπα (tablet κάθε προσανατολισμού, κινητό κάθετο ΚΑΙ οριζόντιο)
// η σελίδα δουλεύει με ΔΥΟ εναλλασσόμενες όψεις σε πλήρες πλάτος. Το ύψος
// μετράει όσο και το πλάτος: σε 1280x720 tablet landscape το δίστηλο χωράει,
// σε κινητό οριζόντιο (π.χ. 850x390) όχι.
export const SPLIT_QUERY = "(min-width: 1100px) and (min-height: 600px)";

const matchSplit = () => {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(SPLIT_QUERY).matches;
};

export default function useSplitLayout() {
  const [split, setSplit] = useState(matchSplit);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(SPLIT_QUERY);
    const onChange = (e) => setSplit(e.matches);
    setSplit(mq.matches); // περιστροφή συσκευής πριν προλάβει να δεθεί ο listener
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange); // Safari < 14
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return split;
}
