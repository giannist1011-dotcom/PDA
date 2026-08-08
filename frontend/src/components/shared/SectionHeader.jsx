// Η ΜΙΑ επικεφαλίδα ενότητας (OrderDeck & FleetDeck): εικονίδιο flame +
// τίτλος + προαιρετικός υπότιτλος. `size="lg"` για ενότητες ρυθμίσεων,
// `size="sm"` για ενότητες μέσα σε σελίδα (στατιστικά, λίστες).
export default function SectionHeader({
  icon: Icon,
  title,
  subtitle = null,
  size = "lg",
  right = null,
}) {
  const lg = size === "lg";
  return (
    <div className={`${subtitle ? "mb-4" : "mb-3"} ${lg ? "md:mb-6" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className={`${lg ? "w-6 h-6" : "w-4 h-4"} text-flame shrink-0`} />}
        <h2 className={`font-heading font-bold ${lg ? "text-xl md:text-2xl" : "text-lg"} flex-1`}>
          {title}
        </h2>
        {right}
      </div>
      {subtitle && <p className="text-sm text-neutral-400">{subtitle}</p>}
    </div>
  );
}
