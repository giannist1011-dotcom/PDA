import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, ImagePlus, Image as ImageIcon } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { apiListPhotos, apiCreatePhoto, apiDeletePhoto, formatApiError } from "@/lib/api";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB raw file
const MAX_DIMENSION = 1200; // px

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error("Read error"));
    fr.readAsDataURL(file);
  });
}

// Downscale in browser to keep DB entries small
async function shrinkDataUrl(dataUrl, maxDim = MAX_DIMENSION, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Δεν φορτώθηκε η εικόνα"));
    img.src = dataUrl;
  });
}

export default function Photos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const load = async () => {
    try {
      const p = await apiListPhotos();
      setPhotos(p);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) {
          toast.error(`Παραλείπεται (όχι εικόνα): ${f.name}`);
          continue;
        }
        if (f.size > MAX_BYTES) {
          toast.error(`Παραλείπεται (>4MB): ${f.name}`);
          continue;
        }
        const raw = await readFileAsDataUrl(f);
        const shrunk = await shrinkDataUrl(raw);
        const created = await apiCreatePhoto({ filename: f.name, data_url: shrunk });
        setPhotos((p) => [created, ...p]);
      }
      toast.success("Ανέβηκαν οι φωτογραφίες");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (photo) => {
    if (!window.confirm(`Διαγραφή "${photo.filename}";`)) return;
    try {
      await apiDeletePhoto(photo.id);
      setPhotos((p) => p.filter((x) => x.id !== photo.id));
      toast.success("Διαγράφηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <AppShell title="Βιβλιοθήκη φωτογραφιών">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1500px] mx-auto w-full">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#FF6B00]" />
              <h2 className="font-heading text-2xl font-bold">Φωτογραφίες προϊόντων</h2>
            </div>
            <p className="text-sm text-neutral-400 mt-1">
              Ανεβάστε φωτογραφίες που μπορείτε να αντιστοιχίσετε σε προϊόντα του μενού
            </p>
          </div>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              data-testid="photo-upload-input"
            />
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              data-testid="photo-upload-btn"
              className="h-11 bg-[#FF6B00] hover:bg-[#FF8533] font-bold"
            >
              <Upload className="w-4 h-4 mr-2" />
              {busy ? "Ανέβασμα..." : "Ανέβασμα φωτογραφιών"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
        ) : photos.length === 0 ? (
          <div className="text-neutral-500 py-16 text-center border border-dashed border-[#333] rounded-lg">
            <ImagePlus className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <div className="mb-2">Δεν υπάρχουν φωτογραφίες</div>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-[#FF6B00] font-bold hover:underline"
              data-testid="photo-empty-upload"
            >
              Ανεβάστε την πρώτη φωτογραφία
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {photos.map((p) => (
              <div
                key={p.id}
                data-testid={`photo-card-${p.id}`}
                className="group relative rounded-lg overflow-hidden border border-[#333] bg-[#1A1A1A] hover:border-[#FF6B00] transition-colors"
              >
                <img
                  src={p.data_url}
                  alt={p.filename}
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <div className="p-2 text-xs text-neutral-400 truncate" title={p.filename}>
                  {p.filename}
                </div>
                <button
                  onClick={() => handleDelete(p)}
                  data-testid={`photo-delete-${p.id}`}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-9 h-9 rounded-md bg-black/70 border border-[#FF3B30]/40 text-[#FF6961] hover:bg-[#FF3B30]/20 flex items-center justify-center transition-opacity"
                  title="Διαγραφή"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
