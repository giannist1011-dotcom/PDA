import { X } from "lucide-react";

// Photo picker overlay (inline modal on top)
export default function ItemPhotoPicker({
  setPhotoPickerOpen,
  pickerTab,
  setPickerTab,
  photos,
  stockPhotos,
  form,
  setForm,
  pickStock,
  importingId,
}) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
      data-testid="item-photo-picker"
    >
      <div className="bg-[#2A0E14] border border-[#723645] rounded-lg p-5 w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-xl font-bold">Επιλογή φωτογραφίας</h3>
          <button
            onClick={() => setPhotoPickerOpen(false)}
            data-testid="item-photo-picker-close"
            className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs: προσωπικές vs κοινή βιβλιοθήκη OrderDeck */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setPickerTab("mine")}
            data-testid="item-photo-tab-mine"
            className={`h-9 px-4 rounded-full text-sm font-bold border transition-colors ${
              pickerTab === "mine"
                ? "bg-brand border-brand text-white"
                : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
            }`}
          >
            Οι φωτογραφίες μου ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setPickerTab("stock")}
            data-testid="item-photo-tab-stock"
            className={`h-9 px-4 rounded-full text-sm font-bold border transition-colors ${
              pickerTab === "stock"
                ? "bg-brand border-brand text-white"
                : "bg-[#3D1620] border-[#723645] text-neutral-300 hover:border-flame"
            }`}
          >
            Βιβλιοθήκη OrderDeck ({stockPhotos.length})
          </button>
        </div>

        {pickerTab === "mine" ? (
          photos.length === 0 ? (
            <div className="text-neutral-500 py-12 text-center">
              Δεν υπάρχουν προσωπικές φωτογραφίες. Ανεβάστε από «Βιβλιοθήκη φωτογραφιών» ή
              διαλέξτε από τη Βιβλιοθήκη OrderDeck.
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((p) => {
                const active = p.id === form.photo_id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, photo_id: p.id });
                      setPhotoPickerOpen(false);
                    }}
                    data-testid={`item-photo-option-${p.id}`}
                    className={`rounded-lg overflow-hidden border-2 transition-colors ${
                      active
                        ? "border-flame ring-2 ring-flame/40"
                        : "border-[#723645] hover:border-flame"
                    }`}
                  >
                    <img
                      src={p.data_url}
                      alt={p.filename}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </div>
          )
        ) : stockPhotos.length === 0 ? (
          <div className="text-neutral-500 py-12 text-center">
            Δεν υπάρχουν ακόμα φωτογραφίες OrderDeck για τον τύπο του καταστήματός σας.
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {stockPhotos.map((sp) => (
              <button
                key={sp.id}
                type="button"
                onClick={() => pickStock(sp)}
                disabled={!!importingId}
                data-testid={`item-photo-stock-${sp.id}`}
                className="rounded-lg overflow-hidden border-2 border-[#723645] hover:border-flame transition-colors disabled:opacity-50 text-left"
              >
                <div className="relative">
                  <img
                    src={sp.data_url}
                    alt={sp.product_label}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                  />
                  {importingId === sp.id && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-bold">
                      Προσθήκη...
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5 text-xs text-neutral-300 truncate" title={sp.product_label}>
                  {sp.product_label}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
