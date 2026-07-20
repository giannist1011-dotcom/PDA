import { MapPin, Phone } from "lucide-react";
import { buildDirectionsUrl } from "./utils";

// Διεύθυνση + τηλέφωνο ψηλά στον δημόσιο κατάλογο, κοντά στο badge ωραρίου —
// η διεύθυνση ανοίγει Google Maps, το τηλέφωνο κάνει tap-to-call.
// Σε κινητό στοιβάζονται κάθετα κάτω από το όνομα, σε μεγαλύτερες οθόνες σε σειρά.
export default function HeaderContact({ data }) {
  const { store_phone, store_address, store_city } = data;
  const address = [store_address, store_city].filter(Boolean).join(", ");
  const phone = (store_phone || "")
    .split(/[,/]/)
    .map((p) => p.trim())
    .filter(Boolean)[0];
  const mapsUrl = buildDirectionsUrl(data);

  if (!address && !phone) return null;

  return (
    <div
      className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-5 text-sm"
      data-testid="header-contact"
    >
      {address &&
        (mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="header-address-link"
            className="inline-flex items-center gap-1.5 text-neutral-300 hover:text-flame transition-colors"
          >
            <MapPin className="w-4 h-4 text-flame shrink-0" />
            <span className="underline decoration-[#723645] underline-offset-4">{address}</span>
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-neutral-300">
            <MapPin className="w-4 h-4 text-flame shrink-0" />
            {address}
          </span>
        ))}
      {phone && (
        <a
          href={`tel:${phone.replace(/\s+/g, "")}`}
          data-testid="header-phone-link"
          className="inline-flex items-center gap-1.5 text-neutral-300 hover:text-flame transition-colors"
        >
          <Phone className="w-4 h-4 text-flame shrink-0" />
          <span className="underline decoration-[#723645] underline-offset-4">{phone}</span>
        </a>
      )}
    </div>
  );
}
