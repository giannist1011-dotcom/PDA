import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import {
  Upload,
  Trash2,
  Copy,
  ExternalLink,
  QrCode,
  Link as LinkIcon,
  ImageOff,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  apiGetPublicMenuSettings,
  apiTogglePublicMenu,
  apiUpdatePublicSlug,
  apiSetStoreLogo,
  apiRemoveStoreLogo,
  formatApiError,
} from "@/lib/api";
import { readFileAsDataUrl, shrinkDataUrl } from "@/lib/image";

const MAX_BYTES = 2 * 1024 * 1024; // ~2MB raw αρχείο

export default function PublicMenuSettings() {
  const [state, setState] = useState(null); // { enabled, slug, logo, path }
  const [slugInput, setSlugInput] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await apiGetPublicMenuSettings();
        setState(s);
        setSlugInput(s.slug);
      } catch (e) {
        toast.error(formatApiError(e));
      }
    })();
  }, []);

  const publicUrl =
    state && state.slug ? `${window.location.origin}/menu/${state.slug}` : "";

  const toggle = async (enabled) => {
    setSavingToggle(true);
    try {
      await apiTogglePublicMenu(enabled);
      setState((s) => ({ ...s, enabled }));
      toast.success(
        enabled ? "Ο δημόσιος κατάλογος ενεργοποιήθηκε" : "Ο δημόσιος κατάλογος απενεργοποιήθηκε"
      );
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSavingToggle(false);
    }
  };

  const saveSlug = async () => {
    const next = slugInput.trim();
    if (!next || next === state.slug) return;
    setSavingSlug(true);
    try {
      const r = await apiUpdatePublicSlug(next);
      setState((s) => ({ ...s, slug: r.slug, path: r.path }));
      setSlugInput(r.slug);
      toast.success("Ο σύνδεσμος ενημερώθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSavingSlug(false);
    }
  };

  const handleFile = async (files) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Επιλέξτε αρχείο εικόνας");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Η εικόνα ξεπερνά τα 2MB");
      return;
    }
    setUploading(true);
    try {
      const raw = await readFileAsDataUrl(f);
      const shrunk = await shrinkDataUrl(raw);
      const r = await apiSetStoreLogo(shrunk);
      setState((s) => ({ ...s, logo: r.logo }));
      toast.success("Το λογότυπο ανέβηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeLogo = async () => {
    if (!window.confirm("Αφαίρεση λογότυπου;")) return;
    try {
      await apiRemoveStoreLogo();
      setState((s) => ({ ...s, logo: null }));
      toast.success("Το λογότυπο αφαιρέθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Ο σύνδεσμος αντιγράφηκε");
    } catch {
      toast.error("Δεν ήταν δυνατή η αντιγραφή");
    }
  };

  const downloadQR = () => {
    const src = qrRef.current?.querySelector("canvas");
    if (!src) return;
    const pad = 24;
    const out = document.createElement("canvas");
    out.width = src.width + pad * 2;
    out.height = src.height + pad * 2;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, pad, pad);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `${state.slug || "menu"}-qr.png`;
    a.click();
  };

  if (!state) return <div className="text-neutral-500 py-6 text-center">Φόρτωση...</div>;

  return (
    <div className="space-y-6">
      {/* Toggle on/off */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#2A0E14] border border-[#723645] rounded-md">
        <div>
          <div className="font-semibold text-sm">Δημόσιος κατάλογος</div>
          <div className="text-xs text-neutral-500">
            Δημόσια σελίδα με το μενού σας, χωρίς σύνδεση — μόνο προβολή
          </div>
        </div>
        <Switch
          checked={state.enabled}
          disabled={savingToggle}
          onCheckedChange={(v) => toggle(!!v)}
          data-testid="public-menu-toggle"
        />
      </div>

      {/* Logo */}
      <div className="px-4 py-4 bg-[#2A0E14] border border-[#723645] rounded-md">
        <div className="font-semibold text-sm mb-1">Λογότυπο καταστήματος</div>
        <div className="text-xs text-neutral-500 mb-3">
          Εμφανίζεται στη δημόσια σελίδα. Αν δεν ανεβάσετε λογότυπο, φαίνεται μόνο το όνομα.
        </div>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg border border-[#723645] bg-[#3D1620] flex items-center justify-center overflow-hidden shrink-0">
            {state.logo ? (
              <img src={state.logo} alt="Λογότυπο" className="w-full h-full object-contain" />
            ) : (
              <ImageOff className="w-7 h-7 text-neutral-600" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files)}
              className="hidden"
              data-testid="logo-upload-input"
            />
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              data-testid="logo-upload-btn"
              className="h-10 bg-brand hover:bg-brand-hover font-bold"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Ανέβασμα..." : state.logo ? "Αλλαγή λογότυπου" : "Ανέβασμα λογότυπου"}
            </Button>
            {state.logo && (
              <button
                onClick={removeLogo}
                data-testid="logo-remove-btn"
                className="inline-flex items-center gap-1.5 text-xs text-[#FF6961] hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Αφαίρεση λογότυπου
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slug */}
      <div className="px-4 py-4 bg-[#2A0E14] border border-[#723645] rounded-md">
        <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <LinkIcon className="w-4 h-4 text-flame" />
          Σύνδεσμος καταλόγου
        </div>
        <div className="text-xs text-neutral-500 mb-3">
          Μόνο λατινικά, αριθμοί και παύλες (π.χ. <span className="text-neutral-400">peinokio</span>)
        </div>
        <div className="flex items-stretch gap-2 flex-wrap">
          <div className="flex items-center rounded-md border border-[#723645] bg-[#3D1620] overflow-hidden flex-1 min-w-[220px]">
            <span className="px-3 text-xs text-neutral-500 select-none border-r border-[#723645] whitespace-nowrap">
              /menu/
            </span>
            <input
              type="text"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              data-testid="slug-input"
              className="flex-1 min-w-0 h-10 px-3 bg-transparent text-white text-sm focus:outline-none"
              placeholder="to-magazi-mou"
            />
          </div>
          <Button
            onClick={saveSlug}
            disabled={savingSlug || !slugInput.trim() || slugInput.trim() === state.slug}
            data-testid="slug-save-btn"
            className="h-10 bg-brand hover:bg-brand-hover font-bold"
          >
            {savingSlug ? "Αποθήκευση..." : "Αποθήκευση"}
          </Button>
        </div>

        {/* Full public URL + copy + open */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <code
            className="flex-1 min-w-[220px] px-3 h-10 flex items-center rounded-md bg-black/30 border border-[#723645] text-xs text-neutral-300 truncate"
            title={publicUrl}
            data-testid="public-url"
          >
            {publicUrl}
          </code>
          <button
            onClick={copyUrl}
            data-testid="copy-url-btn"
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-md border border-[#723645] hover:border-flame text-sm text-neutral-200 transition-colors"
            title="Αντιγραφή"
          >
            <Copy className="w-4 h-4" />
            Αντιγραφή
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="open-url-link"
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-md border border-[#723645] hover:border-flame text-sm text-neutral-200 transition-colors"
            title="Άνοιγμα"
          >
            <ExternalLink className="w-4 h-4" />
            Άνοιγμα
          </a>
        </div>
      </div>

      {/* QR code */}
      <div className="px-4 py-4 bg-[#2A0E14] border border-[#723645] rounded-md">
        <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-flame" />
          QR κώδικας
        </div>
        <div className="text-xs text-neutral-500 mb-3">
          Εκτυπώστε τον και τοποθετήστε τον στο κατάστημα — οι πελάτες σκανάρουν και βλέπουν το μενού.
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div ref={qrRef} className="p-3 bg-white rounded-lg shrink-0">
            <QRCodeCanvas value={publicUrl} size={148} level="M" />
          </div>
          <Button
            onClick={downloadQR}
            data-testid="qr-download-btn"
            className="h-10 bg-brand hover:bg-brand-hover font-bold"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Λήψη QR
          </Button>
        </div>
      </div>
    </div>
  );
}
