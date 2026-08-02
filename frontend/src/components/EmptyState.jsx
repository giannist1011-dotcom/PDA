// Κοινό «άδειο» πλαίσιο του OrderDeck: διακεκομμένο περίγραμμα, κεντραρισμένο
// διακριτικό κείμενο. Ίδιο σε POS, FleetDeck εταιρείας και FleetDeck καταστήματος.
export default function EmptyState({ text, icon: Icon = null, testId }) {
  return (
    <div
      className="border border-dashed border-[#723645]/60 rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-center text-sm text-neutral-500"
      data-testid={testId}
    >
      {Icon && <Icon className="w-6 h-6 text-neutral-600" />}
      {text}
    </div>
  );
}
