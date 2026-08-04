// Ρυθμίσεις → Πλατφόρμες: ενεργοποίηση καρτέλας ανά πλατφόρμα και ήχος
// ειδοποίησης (προεπιλεγμένος του OrderDeck ή δικό σας αρχείο).
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Play, RotateCcw, Upload, Volume2 } from "lucide-react";
import { useAuth } from "@/context/shared/AuthContext";
import {
  apiPlatformSettings,
  apiTogglePlatform,
  apiUploadPlatformSound,
  apiResetPlatformSound,
  formatApiError,
} from "@/lib/api";
import { usePlatformOrders } from "@/context/platforms/PlatformOrdersContext";
import { platformById } from "@/lib/platforms";
import { clearPlatformSound, playPlatformSound } from "@/lib/platformSound";

const MAX_BYTES = 500 * 1024;

export default function PlatformSettings() {
  const { refreshMe } = useAuth();
  const { reloadSettings } = usePlatformOrders();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const fileRefs = useRef({});

  const load = async () => {
    try {
      const res = await apiPlatformSettings();
      setRows(res.platforms || []);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (platform, enabled) => {
    setBusy(platform);
    try {
      await apiTogglePlatform(platform, enabled);
      setRows((p) => p.map((r) => (r.platform === platform ? { ...r, enabled } : r)));
      await refreshMe(); // το platforms_enabled του λογαριασμού δείχνει τις καρτέλες
      reloadSettings?.();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(null);
    }
  };

  const pickSound = (platform, file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Το αρχείο είναι πολύ μεγάλο (έως 500KB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(platform);
      try {
        await apiUploadPlatformSound(platform, String(reader.result), file.name);
        clearPlatformSound(platform);
        setRows((p) =>
          p.map((r) =>
            r.platform === platform
              ? { ...r, has_custom_sound: true, sound_name: file.name }
              : r
          )
        );
        toast.success("Ο ήχος αποθηκεύτηκε");
        reloadSettings?.();
      } catch (e) {
        toast.error(formatApiError(e));
      } finally {
        setBusy(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const resetSound = async (platform) => {
    setBusy(platform);
    try {
      await apiResetPlatformSound(platform);
      clearPlatformSound(platform);
      setRows((p) =>
        p.map((r) =>
          r.platform === platform ? { ...r, has_custom_sound: false, sound_name: "" } : r
        )
      );
      toast.success("Επαναφορά στον προεπιλεγμένο ήχο");
      reloadSettings?.();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="text-neutral-400">Φόρτωση...</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">
        Ενεργοποιήστε τις πλατφόρμες που δουλεύει το κατάστημα — για κάθε μία εμφανίζεται
        καρτέλα στις Παραγγελίες με τις εισερχόμενες, τον χρόνο παράδοσης και το «καθ' οδόν».
      </p>

      {rows.map((r) => {
        const meta = platformById(r.platform);
        const working = busy === r.platform;
        return (
          <div
            key={r.platform}
            className="p-4 rounded-lg border border-[#723645] bg-[#2A0E14]"
            data-testid={`platform-settings-${r.platform}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-heading font-bold text-lg" style={{ color: meta?.accent }}>
                {r.label}
              </span>
              <button
                onClick={() => toggle(r.platform, !r.enabled)}
                disabled={working}
                data-testid={`platform-toggle-${r.platform}`}
                data-state={r.enabled ? "on" : "off"}
                className={`h-10 px-4 rounded-md border text-sm font-bold transition-colors ${
                  r.enabled
                    ? "bg-flame text-white border-flame"
                    : "bg-[#3D1620] text-neutral-300 border-[#723645] hover:border-flame"
                }`}
              >
                {r.enabled ? "Ενεργή" : "Ανενεργή"}
              </button>
            </div>

            {r.enabled && (
              <>
                <div className="mt-3 pt-3 border-t border-[#431A25] flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-neutral-400 font-bold">
                    <Volume2 className="w-3.5 h-3.5" />
                    Ήχος
                  </span>
                  <span className="text-sm text-neutral-300">
                    {r.has_custom_sound ? r.sound_name || "Δικό σας αρχείο" : "Προεπιλογή OrderDeck"}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={() => playPlatformSound(r.platform)}
                    data-testid={`platform-sound-play-${r.platform}`}
                    className="h-9 px-3 rounded-md border border-[#723645] hover:border-flame text-neutral-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Δοκιμή
                  </button>
                  <button
                    onClick={() => fileRefs.current[r.platform]?.click()}
                    disabled={working}
                    data-testid={`platform-sound-upload-${r.platform}`}
                    className="h-9 px-3 rounded-md border border-[#723645] hover:border-flame text-neutral-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Ανέβασμα
                  </button>
                  {r.has_custom_sound && (
                    <button
                      onClick={() => resetSound(r.platform)}
                      disabled={working}
                      data-testid={`platform-sound-reset-${r.platform}`}
                      className="h-9 px-3 rounded-md border border-[#723645] hover:border-flame text-neutral-400 text-xs font-bold flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Επαναφορά
                    </button>
                  )}
                  <input
                    ref={(el) => {
                      fileRefs.current[r.platform] = el;
                    }}
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/ogg"
                    className="hidden"
                    onChange={(e) => {
                      pickSound(r.platform, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
                {!r.capabilities?.store_open && (
                  <div className="mt-2 text-xs text-neutral-500">
                    Άνοιγμα/κλείσιμο καταστήματος: μη διαθέσιμο από την πλατφόρμα (θα ενεργοποιηθεί
                    μόλις συνδεθεί το API της).
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
