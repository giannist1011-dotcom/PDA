import { useEffect, useState } from "react";
import { X, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiActiveAnnouncement } from "@/lib/api";

// Ποιες ανακοινώσεις έχει κλείσει ο χρήστης σε αυτή τη συσκευή (ανά announcement id)
const DISMISSED_KEY = "orderdeck_dismissed_announcements";

const readDismissed = () => {
  try {
    const v = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const STYLES = {
  info: {
    wrap: "bg-[#0A84FF]/10 border-[#0A84FF]/40 text-[#7CBEFF]",
    Icon: Info,
  },
  warning: {
    wrap: "bg-[#FFB340]/10 border-[#FFB340]/40 text-[#FFB340]",
    Icon: AlertTriangle,
  },
  success: {
    wrap: "bg-[#30D158]/10 border-[#30D158]/40 text-[#5CE585]",
    Icon: CheckCircle2,
  },
};

export default function AnnouncementBanner() {
  const [ann, setAnn] = useState(null);

  useEffect(() => {
    let alive = true;
    apiActiveAnnouncement()
      .then((data) => {
        if (!alive) return;
        const a = data?.announcement;
        if (a && !readDismissed().includes(a.id)) setAnn(a);
      })
      .catch(() => {
        // offline ή σφάλμα δικτύου — απλά δεν εμφανίζεται banner
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!ann) return null;

  const dismiss = () => {
    try {
      const ids = readDismissed();
      if (!ids.includes(ann.id)) ids.push(ann.id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-50)));
    } catch {
      // localStorage μη διαθέσιμο — κλείνει μόνο για τη συνεδρία
    }
    setAnn(null);
  };

  const { wrap, Icon } = STYLES[ann.type] || STYLES.info;

  return (
    <div
      className={`shrink-0 flex items-start sm:items-center gap-2.5 px-3 sm:px-4 py-2 border-b ${wrap}`}
      data-testid="announcement-banner"
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
      <div className="min-w-0 flex-1 text-xs sm:text-sm">
        <span className="font-bold">{ann.title}</span>
        {ann.body && <span className="text-white/80"> — {ann.body}</span>}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Κλείσιμο ανακοίνωσης"
        data-testid="announcement-dismiss"
        className="shrink-0 w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
