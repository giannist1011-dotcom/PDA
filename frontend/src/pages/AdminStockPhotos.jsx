import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Images, Upload, Trash2, Lock, RefreshCw, Ticket, ImagePlus } from "lucide-react";
import {
  apiAdminListStockPhotos,
  apiAdminCreateStockPhoto,
  apiAdminDeleteStockPhoto,
  formatApiError,
} from "@/lib/api";
import { BUSINESS_TYPES } from "@/lib/business";
import { Button } from "@/components/ui/button";

// Ίδιο password gate με τους εκπτωτικούς κωδικούς — ένα admin login για όλη την περιοχή
const PW_KEY = "orderdeck_admin_pw";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB raw file
const MAX_DIMENSION = 1200; // px

const inputCls =
  "w-full h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white focus:outline-none focus:border-flame";

const btLabel = (key) => BUSINESS_TYPES.find((b) => b.key === key)?.label || key;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error("Read error"));
    fr.readAsDataURL(file);
  });
}

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

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

export default function AdminStockPhotos() {
  const [pw, setPw] = useState(() => sessionStorage.getItem(PW_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ business_type: "souvlaki", product_label: "" });
  const inputRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = async (password) => {
    const data = await apiAdminListStockPhotos(password);
    setPhotos(data);
  };

  // Αυτόματη σύνδεση αν υπάρχει ήδη password στο session (κοινό με τους κωδικούς)
  useEffect(() => {
    if (!pw) return;
    load(pw)
      .then(() => setAuthed(true))
      .catch(() => {
        sessionStorage.removeItem(PW_KEY);
        setPw("");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await load(pwInput);
      sessionStorage.setItem(PW_KEY, pwInput);
      setPw(pwInput);
      setAuthed(true);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    try {
      await load(pw);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    const label = form.product_label.trim();
    if (!label) {
      toast.error("Συμπληρώστε πρώτα το όνομα προϊόντος");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      let n = 0;
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
        const created = await apiAdminCreateStockPhoto(pw, {
          business_type: form.business_type,
          product_label: label,
          data_url: shrunk,
        });
        setPhotos((p) => [created, ...p]);
        n += 1;
      }
      if (n > 0) {
        toast.success(n === 1 ? "Ανέβηκε η φωτογραφία" : `Ανέβηκαν ${n} φωτογραφίες`);
        setForm((f) => ({ ...f, product_label: "" }));
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Διαγραφή της φωτογραφίας "${p.product_label}";`)) return;
    try {
      await apiAdminDeleteStockPhoto(pw, p.id);
      setPhotos((ps) => ps.filter((x) => x.id !== p.id));
      toast.success("Διαγράφηκε");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  // ============ PASSWORD GATE ============
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#2A0E14] text-white flex items-center justify-center px-4">
        <form onSubmit={login} className="w-full max-w-sm bg-[#3D1620] border border-[#723645] rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-flame" />
            <h1 className="font-heading text-xl font-bold">Βιβλιοθήκη φωτογραφιών</h1>
          </div>
          <p className="text-sm text-neutral-400">Πρόσβαση μόνο για τον διαχειριστή του OrderDeck.</p>
          <Field label="Κωδικός διαχειριστή">
            <input
              type="password"
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              autoFocus
              data-testid="admin-pw"
              className={inputCls}
            />
          </Field>
          <Button
            type="submit"
            disabled={busy || !pwInput}
            data-testid="admin-login"
            className="w-full h-11 bg-brand hover:bg-brand-hover text-white font-bold"
          >
            {busy ? "Έλεγχος..." : "Είσοδος"}
          </Button>
        </form>
      </div>
    );
  }

  const counts = photos.reduce((acc, p) => {
    acc[p.business_type] = (acc[p.business_type] || 0) + 1;
    return acc;
  }, {});
  const shown = filter === "all" ? photos : photos.filter((p) => p.business_type === filter);

  // ============ MAIN ============
  return (
    <div className="min-h-screen bg-[#2A0E14] text-white px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-brand flex items-center justify-center">
              <Images className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Βιβλιοθήκη φωτογραφιών</h1>
              <div className="text-xs text-neutral-500">Κοινές stock φωτογραφίες — Διαχείριση OrderDeck</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin/promo"
              className="h-10 px-3 rounded-md bg-[#3D1620] border border-[#723645] hover:border-flame text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              <Ticket className="w-4 h-4" /> Εκπτωτικοί κωδικοί
            </Link>
            <Button
              type="button"
              onClick={refresh}
              className="h-10 px-3 bg-[#3D1620] border border-[#723645] hover:border-flame text-white"
              data-testid="stock-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* UPLOAD */}
        <div className="bg-[#3D1620] border border-[#723645] rounded-lg p-5 mb-6">
          <h2 className="font-heading text-lg font-bold mb-4">Νέα stock φωτογραφία</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Τύπος επιχείρησης">
              <select
                value={form.business_type}
                onChange={(e) => set("business_type", e.target.value)}
                data-testid="stock-business-type"
                className={inputCls}
              >
                {BUSINESS_TYPES.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Όνομα προϊόντος">
              <input
                value={form.product_label}
                onChange={(e) => set("product_label", e.target.value)}
                placeholder="π.χ. Φραπέ, Σουβλάκι χοιρινό"
                data-testid="stock-product-label"
                className={inputCls}
              />
            </Field>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            data-testid="stock-upload-input"
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            data-testid="stock-upload-btn"
            className="mt-4 h-11 bg-brand hover:bg-brand-hover text-white font-bold"
          >
            <Upload className="w-4 h-4 mr-2" />
            {busy ? "Ανέβασμα..." : "Ανέβασμα φωτογραφίας"}
          </Button>
          <p className="text-xs text-neutral-500 mt-2">
            Οι φωτογραφίες ανεβαίνουν στον επιλεγμένο τύπο επιχείρησης με το ίδιο όνομα προϊόντος.
          </p>
        </div>

        {/* FILTER TABS */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            data-testid="stock-filter-all"
            className={`h-9 px-4 rounded-full text-sm font-bold border transition-colors ${
              filter === "all"
                ? "bg-brand border-brand text-white"
                : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
            }`}
          >
            Όλες ({photos.length})
          </button>
          {BUSINESS_TYPES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setFilter(b.key)}
              data-testid={`stock-filter-${b.key}`}
              className={`h-9 px-4 rounded-full text-sm font-bold border transition-colors ${
                filter === b.key
                  ? "bg-brand border-brand text-white"
                  : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
              }`}
            >
              {b.label} ({counts[b.key] || 0})
            </button>
          ))}
        </div>

        {/* GRID */}
        {shown.length === 0 ? (
          <div className="text-center text-neutral-500 py-16 border border-dashed border-[#723645] rounded-lg">
            <ImagePlus className="w-10 h-10 mx-auto mb-3 opacity-50" />
            Δεν υπάρχουν φωτογραφίες{filter !== "all" ? ` για «${btLabel(filter)}»` : ""}.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" data-testid="stock-grid">
            {shown.map((p) => (
              <div
                key={p.id}
                data-testid={`stock-card-${p.id}`}
                className="group relative rounded-lg overflow-hidden border border-[#723645] bg-[#3D1620] hover:border-flame transition-colors"
              >
                <img
                  src={p.data_url}
                  alt={p.product_label}
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <div className="p-2">
                  <div className="text-sm font-semibold truncate" title={p.product_label}>
                    {p.product_label}
                  </div>
                  <div className="text-[11px] text-neutral-500">{btLabel(p.business_type)}</div>
                </div>
                <button
                  onClick={() => remove(p)}
                  data-testid={`stock-delete-${p.id}`}
                  className="absolute top-2 right-2 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 w-9 h-9 rounded-md bg-black/70 border border-[#FF3B30]/40 text-[#FF6961] hover:bg-[#FF3B30]/20 flex items-center justify-center transition-opacity"
                  title="Διαγραφή"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
