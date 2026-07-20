import ChangeBadge from "./ChangeBadge";
import { pct } from "./utils";

const CompareCard = ({ label, valueA, valueB, format, testId }) => {
  const change = pct(valueB, valueA);
  return (
    <div
      className="p-4 md:p-5 bg-[#3D1620] border border-[#723645] rounded-lg"
      data-testid={testId}
    >
      <div className="text-xs uppercase tracking-widest text-neutral-400 font-bold mb-3">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Α</div>
          <div className="font-mono text-xl font-bold text-neutral-300 mt-0.5">
            {format(valueA)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-flame">Β</div>
          <div className="font-mono text-xl font-bold text-white mt-0.5">{format(valueB)}</div>
        </div>
      </div>
      <div className="mt-3">
        <ChangeBadge value={change} testId={`${testId}-change`} />
      </div>
    </div>
  );
};

export default CompareCard;
