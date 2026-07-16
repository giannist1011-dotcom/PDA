import { useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiGetBrief, apiCreateBrief, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const formatGRDate = (iso) => {
  const [y, m, d] = (iso || "").split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

// Απλό markdown-lite rendering (bold + λίστες) χωρίς dependency
function renderBrief(text) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g).map((p, j) =>
      j % 2 === 1 ? (
        <strong key={j} className="font-bold text-white">
          {p}
        </strong>
      ) : (
        p
      )
    );
    const t = line.trim();
    if (t.startsWith("#")) {
      return (
        <div key={i} className="font-heading font-bold text-white mt-3">
          {t.replace(/^#+\s*/, "")}
        </div>
      );
    }
    return (
      <div key={i} className={t.startsWith("-") || /^\d+\./.test(t) ? "pl-3" : ""}>
        {parts.length ? parts : " "}
      </div>
    );
  });
}

export default function DailyBrief() {
  const [mode, setMode] = useState("yesterday");
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async (m) => {
    setLoading(true);
    try {
      const d = await apiGetBrief(m);
      setBrief(d.exists === false ? null : d);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(mode);
  }, [mode]);

  const generate = async (force = false) => {
    setGenerating(true);
    try {
      const d = await apiCreateBrief(mode, force);
      setBrief(d);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell title="Ημερήσιο Brief">
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-flame" />
            <h1 className="font-heading font-bold text-xl">Ημερήσιο Brief</h1>
          </div>
          <div className="flex rounded-md border border-[#723645] overflow-hidden">
            {[
              ["yesterday", "Χθες"],
              ["today", "Σήμερα μέχρι τώρα"],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                data-testid={`brief-mode-${k}`}
                className={`px-3 h-10 text-sm font-semibold transition-colors ${
                  mode === k ? "bg-flame/20 text-flame" : "text-neutral-300 hover:bg-[#3D1620]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : brief ? (
          <div
            className="p-5 md:p-6 bg-[#3D1620] border border-[#723645] rounded-lg"
            data-testid="brief-content"
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                {formatGRDate(brief.date)}
              </span>
              <button
                onClick={() => generate(true)}
                disabled={generating}
                data-testid="brief-regenerate"
                className="h-9 px-3 rounded-md border border-[#723645] hover:border-flame text-xs font-semibold text-neutral-200 flex items-center gap-1.5 disabled:opacity-40 transition-colors"
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Ανανέωση
              </button>
            </div>
            <div className="text-sm leading-relaxed text-neutral-200 space-y-0.5">
              {renderBrief(brief.content || "")}
            </div>
          </div>
        ) : (
          <div className="p-8 bg-[#3D1620] border border-[#723645] rounded-lg text-center">
            <Sparkles className="w-8 h-8 text-gold mx-auto mb-3" />
            <div className="text-neutral-300 text-sm mb-5">
              Δεν έχει δημιουργηθεί brief για{" "}
              {mode === "today" ? "σήμερα" : "χθες"}. Ο DeckPilot θα συνοψίσει τζίρο,
              πωλήσεις και σύγκριση με την προηγούμενη εβδομάδα.
            </div>
            <button
              onClick={() => generate(false)}
              disabled={generating}
              data-testid="brief-generate"
              className="h-11 px-5 rounded-md bg-flame text-white font-bold flex items-center gap-2 mx-auto disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Δημιουργία brief
            </button>
          </div>
        )}
      </main>
    </AppShell>
  );
}
