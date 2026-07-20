const SummaryRow = ({ icon: Icon, label, value, valueClass = "text-white", testId }) => (
  <div
    className="flex items-center justify-between p-3 bg-[#2A0E14] border border-[#723645] rounded-md"
    data-testid={testId}
  >
    <span className="flex items-center gap-2 text-sm text-neutral-300">
      <Icon className="w-4 h-4 text-flame" />
      {label}
    </span>
    <span className={`font-mono font-bold ${valueClass}`}>{value}</span>
  </div>
);

export default SummaryRow;
