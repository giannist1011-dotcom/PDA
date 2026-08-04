import { Send } from "lucide-react";

// Καρτέλα «Αποστολή παραγγελίας» — placeholder της μελλοντικής προβολής
// ανεβάσματος παραγγελίας στο OrderDeck Fleet (θα κλειδώσει ανά πλάνο).
export default function DispatchTab() {
  return (
    <main
      className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6"
      data-testid="dispatch-tab"
    >
      <div className="w-16 h-16 rounded-full bg-[#4A1B27] border border-[#723645] flex items-center justify-center">
        <Send className="w-7 h-7 text-flame" />
      </div>
      <div className="font-heading text-xl text-white mt-4">Σύντομα διαθέσιμο</div>
      <div className="text-sm text-neutral-400 mt-2 max-w-sm">
        Από εδώ θα στέλνετε παραγγελίες στην εταιρεία διανομής σας μέσω του
        OrderDeck Fleet.
      </div>
    </main>
  );
}
