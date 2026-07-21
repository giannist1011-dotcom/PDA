import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { UtensilsCrossed, Info } from "lucide-react";
import { apiGetPublicMenu, formatApiError } from "@/lib/api";
import { eur } from "@/lib/format";
import { setFavicon, resetFavicon } from "@/lib/favicon";
import LoadingScreen from "@/components/LoadingScreen";
import HoursBadge from "./public-menu/HoursBadge";
import HeaderContact from "./public-menu/HeaderContact";
import CategoryBar from "./public-menu/CategoryBar";
import StoreInfoSection from "./public-menu/StoreInfoSection";

export default function PublicMenu() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await apiGetPublicMenu(slug);
        if (!alive) return;
        setData(d);
        document.title = `${d.restaurant_name} — Κατάλογος`;
        if (d.logo) setFavicon(d.logo);
      } catch (e) {
        if (!alive) return;
        setError(formatApiError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      resetFavicon();
    };
  }, [slug]);

  if (loading) return <LoadingScreen />;

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#1A070C] text-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#3D1620] border border-[#723645] flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-7 h-7 text-neutral-500" />
          </div>
          <h1 className="font-heading text-xl font-bold mb-2">Ο κατάλογος δεν είναι διαθέσιμος</h1>
          <p className="text-sm text-neutral-400">
            {error || "Η σελίδα που ζητήσατε δεν βρέθηκε."}
          </p>
        </div>
      </div>
    );
  }

  const { restaurant_name, logo, categories } = data;

  return (
    // ΟΧΙ overflow-x-hidden στο root: overflow σε γονέα σπάει το position:sticky
    // της CategoryBar. Το οριζόντιο scroll ζει ΜΟΝΟ στο εσωτερικό div της μπάρας.
    <div className="min-h-screen bg-[#1A070C] text-white">
      {/* Header */}
      <header className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#4a1019] via-[#2a0a10] to-[#1A070C]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.12),transparent_60%)]" />
        <div className="relative max-w-2xl mx-auto px-5 pt-12 pb-8 text-center">
          {logo && (
            <img
              src={logo}
              alt={restaurant_name}
              className="w-24 h-24 md:w-28 md:h-28 mx-auto mb-4 rounded-2xl object-contain bg-white/5 border border-white/10 p-2"
              data-testid="public-logo"
            />
          )}
          <h1
            className="font-heading text-3xl md:text-4xl font-extrabold tracking-tight"
            data-testid="public-name"
          >
            {restaurant_name}
          </h1>
          <div className="mt-3 inline-block w-16 h-1 rounded-full bg-gradient-to-r from-flame to-gold" />
          <HoursBadge hours={data.store_hours} />
          <HeaderContact data={data} />
        </div>
      </header>

      {/* Sticky κατηγορίες με scroll spy */}
      <CategoryBar categories={categories} />

      {/* Menu */}
      <main className="max-w-2xl mx-auto px-5 py-8">
        {categories.length === 0 ? (
          <div className="text-center py-20 text-neutral-400">
            Ο κατάλογος ενημερώνεται — δεν υπάρχουν διαθέσιμα προϊόντα αυτή τη στιγμή.
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map((c) => (
              <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-16">
                <h2 className="font-heading text-xl font-bold text-flame mb-4 flex items-center gap-2">
                  {c.name}
                  <span className="flex-1 h-px bg-[#3D1620]" />
                </h2>
                <ul className="space-y-3">
                  {c.items.map((it) => (
                    <li
                      key={it.id}
                      data-testid={`public-item-${it.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#2A0E14] border border-[#3D1620]"
                    >
                      {it.photo_url && (
                        <img
                          src={it.photo_url}
                          alt={it.name}
                          loading="lazy"
                          className="w-16 h-16 rounded-lg object-cover shrink-0 border border-[#3D1620]"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-snug">{it.name}</div>
                        {it.description && (
                          <p className="text-xs text-neutral-400 mt-0.5 leading-snug line-clamp-2">
                            {it.description}
                          </p>
                        )}
                        {it.allergens && (
                          <p className="text-[11px] text-neutral-500 mt-1 leading-snug flex items-start gap-1">
                            <Info className="w-3 h-3 shrink-0 mt-[1px]" />
                            <span>{it.allergens}</span>
                          </p>
                        )}
                      </div>
                      <div className="font-heading font-bold text-gold whitespace-nowrap pl-1">
                        {eur(it.price)}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <StoreInfoSection data={data} />

      <footer className="max-w-2xl mx-auto px-5 pb-10 pt-2 text-center">
        <div className="text-xs text-neutral-600">Κατάλογος με OrderDeck</div>
      </footer>
    </div>
  );
}
