import { useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, Star, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "@/context/shared/AuthContext";
import { apiUpdateStoreDetails } from "@/lib/api";
import BusinessDetailsForm from "@/components/pos/BusinessDetailsForm";
import StoreHoursEditor from "@/components/pos/StoreHoursEditor";

const inputCls =
  "w-full h-10 px-3 rounded-md bg-[#2A0E14] border border-[#723645] focus:border-flame outline-none text-sm";

// Στοιχεία καταστήματος: κοινός πυρήνας (BusinessDetailsForm — όνομα, τηλέφωνα,
// πόλη, διεύθυνση + pin) + πεδία μαγαζιού: ζώνη διανομής και, με catalogExtras,
// ωράριο & Google review (δημόσιος κατάλογος — κρύβονται στο πλάνο FleetDeck).
export default function StoreDetailsSettings({ catalogExtras = true }) {
  const { user, refreshMe } = useAuth();
  const [radiusKm, setRadiusKm] = useState(String(user?.delivery_radius_km ?? 6));
  const [receiptName, setReceiptName] = useState(user?.receipt_name || "");
  const [hours, setHours] = useState(user?.store_hours || {});
  const [reviewLink, setReviewLink] = useState(user?.google_review_link || "");
  const reviewQrRef = useRef(null);

  // Ίδια λογική με το QR του καταλόγου (PublicMenuSettings): λευκό περιθώριο + PNG download
  const downloadReviewQR = () => {
    const src = reviewQrRef.current?.querySelector("canvas");
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
    a.download = "google-review-qr.png";
    a.click();
  };

  const save = async (core) => {
    // Πέτα ημιτελείς γραμμές ωραρίου (κενό start/end) — το backend τις απορρίπτει με 422
    const cleanHours = {};
    for (const [k, d] of Object.entries(hours || {})) {
      cleanHours[k] = {
        closed: !!d.closed,
        ranges: (d.ranges || []).filter((r) => r.start && r.end),
      };
    }
    await apiUpdateStoreDetails({
      restaurant_name: core.name,
      receipt_name: receiptName.trim(),
      store_phone: core.phone,
      store_address: core.address,
      store_city: core.city,
      store_lat: core.lat,
      store_lng: core.lng,
      // 1–100 km, default 6 — κόβει τα αποτελέσματα του autocomplete διεύθυνσης
      delivery_radius_km: Math.min(100, Math.max(1, parseFloat(radiusKm) || 6)),
      store_hours: cleanHours,
      google_review_link: reviewLink.trim(),
    });
    await refreshMe();
    toast.success("Τα στοιχεία καταστήματος αποθηκεύτηκαν");
  };

  return (
    <BusinessDetailsForm
      initial={{
        name: user?.restaurant_name,
        phone: user?.store_phone,
        address: user?.store_address,
        city: user?.store_city,
        lat: user?.store_lat,
        lng: user?.store_lng,
      }}
      cityLabel="Πόλη / Περιοχή — προστίθεται αυτόματα στις διευθύνσεις παραγγελιών για τον live χάρτη"
      mapLabel="Τοποθεσία — πατήστε στον χάρτη για να βάλετε pin στο μαγαζί"
      onSave={save}
      besideCity={
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5">
            Ζώνη διανομής (km) — οι προτάσεις διεύθυνσης κόβονται έξω από αυτή την ακτίνα γύρω από το pin
          </label>
          <input
            type="number"
            min={1}
            max={100}
            step={0.5}
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            placeholder="6"
            data-testid="delivery-radius-input"
            className={inputCls}
          />
        </div>
      }
    >
      <div>
        <label className="block text-xs text-neutral-400 mb-1.5">
          Όνομα στην απόδειξη — προαιρετικό· αν οριστεί, η κεφαλίδα της απόδειξης δείχνει αυτό αντί για το πλήρες όνομα (ο κατάλογος και η εφαρμογή δεν αλλάζουν)
        </label>
        <input
          value={receiptName}
          onChange={(e) => setReceiptName(e.target.value)}
          maxLength={80}
          placeholder={user?.restaurant_name || "π.χ. Πεινώκιο"}
          data-testid="receipt-name-input"
          className={inputCls}
        />
      </div>

      {catalogExtras && (
        <>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock className="w-4 h-4 text-flame" />
              <label className="text-xs text-neutral-400">
                Ωράριο λειτουργίας — εμφανίζεται στον δημόσιο κατάλογο με ένδειξη «Ανοιχτά τώρα»
              </label>
            </div>
            <StoreHoursEditor value={hours} onChange={setHours} />
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Star className="w-4 h-4 text-gold" />
              <label className="text-xs text-neutral-400">
                Google review link — προαιρετικό· εμφανίζει κουμπί «Αξιολογήστε μας» στον δημόσιο κατάλογο
              </label>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input
                value={reviewLink}
                onChange={(e) => setReviewLink(e.target.value)}
                maxLength={300}
                placeholder="π.χ. https://g.page/r/XXXXXXXX/review"
                data-testid="review-link-input"
                className={`${inputCls} flex-1 min-w-[220px]`}
              />
              <button
                type="button"
                onClick={downloadReviewQR}
                disabled={!reviewLink.trim()}
                data-testid="review-qr-btn"
                className="h-10 px-4 shrink-0 rounded-md border border-[#723645] bg-[#2A0E14] text-sm font-bold text-neutral-300 hover:border-flame transition-colors flex items-center gap-2 disabled:opacity-40 disabled:hover:border-[#723645]"
              >
                <QrCode className="w-4 h-4" />
                Λήψη QR
              </button>
            </div>
            {/* Κρυφό canvas μόνο για την παραγωγή του PNG */}
            {reviewLink.trim() && (
              <div ref={reviewQrRef} className="hidden">
                <QRCodeCanvas value={reviewLink.trim()} size={296} level="M" />
              </div>
            )}
          </div>
        </>
      )}
    </BusinessDetailsForm>
  );
}
