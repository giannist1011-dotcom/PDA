import { Activity, Store, Truck, FlaskConical, Handshake, ShieldCheck } from "lucide-react";
import { timeAgo } from "./utils";

// Ετικέτα + εικονίδιο ανά τύπο γεγονότος πλατφόρμας
const TYPE_META = {
  signup: { label: "Νέο μαγαζί", icon: Store, cls: "text-flame" },
  fleet_signup: { label: "Νέα εταιρεία", icon: Truck, cls: "text-gold" },
  demo_created: { label: "Demo", icon: FlaskConical, cls: "text-neutral-400" },
  partnership: { label: "Συνεργασία", icon: Handshake, cls: "text-emerald-400" },
  admin_action: { label: "Ενέργεια admin", icon: ShieldCheck, cls: "text-sky-400" },
};

// Τα τελευταία 15 γεγονότα της πλατφόρμας (εγγραφές, συνεργασίες, demos, sub-admins)
export default function ActivityFeed({ activity }) {
  return (
    <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-4" data-testid="activity-feed">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-neutral-400 mb-3">
        <Activity className="w-4 h-4 text-flame" /> Πρόσφατη δραστηριότητα
      </div>
      {!activity?.length ? (
        <div className="text-sm text-neutral-500 py-6 text-center">Καμία δραστηριότητα ακόμα.</div>
      ) : (
        <div className="space-y-1">
          {activity.map((e, i) => {
            const meta = TYPE_META[e.type] || TYPE_META.signup;
            const Icon = meta.icon;
            return (
              <div
                key={`${e.at}-${i}`}
                className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#2A0E14] transition-colors"
              >
                <Icon className={`w-4 h-4 shrink-0 ${meta.cls}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate">{e.title}</div>
                  <div className="text-[11px] text-neutral-500">
                    {meta.label}
                    {e.city ? ` · ${e.city}` : ""}
                  </div>
                </div>
                <div className="text-[11px] text-neutral-500 shrink-0">{timeAgo(e.at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
