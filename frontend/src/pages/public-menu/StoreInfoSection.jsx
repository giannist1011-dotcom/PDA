import { MapPin, Phone, Navigation, Star } from "lucide-react";

// Στοιχεία επιχείρησης στο κάτω μέρος του δημόσιου καταλόγου:
// διεύθυνση, τηλέφωνα (tap-to-call), οδηγίες Google Maps, κουμπί αξιολόγησης
export default function StoreInfoSection({ data }) {
  const {
    store_phone,
    store_address,
    store_city,
    store_lat,
    store_lng,
    google_review_link,
  } = data;

  const phones = (store_phone || "")
    .split(/[,/]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const address = [store_address, store_city].filter(Boolean).join(", ");

  const hasCoords = store_lat != null && store_lng != null;
  const directionsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${store_lat},${store_lng}`
    : address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  if (!address && phones.length === 0 && !directionsUrl && !google_review_link) return null;

  return (
    <section
      className="max-w-2xl mx-auto px-5 pt-2 pb-4"
      data-testid="store-info-section"
    >
      <div className="bg-[#2A0E14] border border-[#3D1620] rounded-xl p-4 space-y-3">
        {address && (
          <div className="flex items-start gap-2.5 text-sm text-neutral-300">
            <MapPin className="w-4 h-4 text-flame shrink-0 mt-0.5" />
            <span>{address}</span>
          </div>
        )}

        {phones.length > 0 && (
          <div className="flex items-start gap-2.5 text-sm">
            <Phone className="w-4 h-4 text-flame shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {phones.map((p) => (
                <a
                  key={p}
                  href={`tel:${p.replace(/\s+/g, "")}`}
                  className="text-neutral-300 underline decoration-[#723645] underline-offset-4 hover:text-flame"
                  data-testid="store-phone-link"
                >
                  {p}
                </a>
              ))}
            </div>
          </div>
        )}

        {(directionsUrl || google_review_link) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="directions-link"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-[#3D1620] border border-[#723645] text-neutral-200 hover:border-flame hover:text-flame transition-colors"
              >
                <Navigation className="w-4 h-4" />
                Οδηγίες
              </a>
            )}
            {google_review_link && (
              <a
                href={google_review_link}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="review-link"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-[#3D1620] border border-[#723645] text-gold hover:border-gold transition-colors"
              >
                <Star className="w-4 h-4" />
                Αξιολογήστε μας
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
