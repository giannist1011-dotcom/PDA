import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AutoNumberDialog({ open, setOpen, uncodedCount, onConfirm }) {
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="bg-[#2A0E14] border-[#723645] text-white" data-testid="auto-number-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl">Αυτόματη αρίθμηση;</AlertDialogTitle>
          <AlertDialogDescription className="text-neutral-400">
            {uncodedCount > 0
              ? `Θα δοθούν διαδοχικοί κωδικοί σε ${uncodedCount} προϊόντα που δεν έχουν κωδικό, με τη σειρά του μενού. Οι υπάρχοντες κωδικοί δεν αλλάζουν.`
              : "Όλα τα προϊόντα έχουν ήδη κωδικό — δεν θα αλλάξει κάτι."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            data-testid="auto-number-cancel"
            className="bg-[#3D1620] border-[#723645] text-neutral-300 hover:bg-[#431A25] hover:text-white"
          >
            Άκυρο
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={uncodedCount === 0}
            data-testid="auto-number-confirm"
            className="bg-brand hover:bg-brand-hover text-white font-bold disabled:opacity-50"
          >
            Αρίθμηση
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
