export default function Logo({ size = "md" }) {
  const h = size === "lg" ? "h-11" : "h-9";
  return <img src="/logo-dark.svg" alt="OrderDeck" className={h} />;
}
