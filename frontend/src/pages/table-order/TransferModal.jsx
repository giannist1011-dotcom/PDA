import { X } from "lucide-react";

// Transfer modal
export default function TransferModal({ setTransferOpen, freeTables, handleTransfer }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="transfer-modal"
    >
      <div className="bg-[#3D1620] border border-[#723645] rounded-lg w-full max-w-sm max-h-[80vh] flex flex-col p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-bold">Μεταφορά καρτέλας</h3>
          <button
            onClick={() => setTransferOpen(false)}
            data-testid="transfer-close"
            className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {freeTables.length === 0 ? (
          <div className="text-neutral-500 text-sm py-8 text-center">
            Δεν υπάρχουν ελεύθερα τραπέζια
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 overflow-y-auto">
            {freeTables.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTransfer(t)}
                data-testid={`transfer-to-${t.id}`}
                className="h-16 rounded-lg border border-[#00E676]/50 bg-[#00E676]/10 text-white font-heading font-bold hover:bg-[#00E676]/20 active:scale-95 truncate px-2"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
