const StatCard = ({ icon: Icon, label, value, testId, sub, valueClass = "text-white", iconClass = "text-flame" }) => (
  <div
    className="p-6 bg-[#3D1620] border border-[#723645] rounded-lg"
    data-testid={testId}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
        {label}
      </span>
      <Icon className={`w-5 h-5 ${iconClass}`} />
    </div>
    <div className={`font-mono text-3xl font-bold mt-3 ${valueClass}`}>{value}</div>
    {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
  </div>
);

export default StatCard;
