export const pct = (a, b) => {
  if (!b || b === 0) return a > 0 ? 100 : 0;
  return ((a - b) / b) * 100;
};
