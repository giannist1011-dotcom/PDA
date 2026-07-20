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

export function DeleteItemDialog({ confirmItem, setConfirmItem, confirmDeleteItem }) {
  return (
    <AlertDialog open={!!confirmItem} onOpenChange={(v) => !v && setConfirmItem(null)}>
      <AlertDialogContent className="bg-[#2A0E14] border-[#723645] text-white" data-testid="delete-item-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl">Διαγραφή προϊόντος;</AlertDialogTitle>
          <AlertDialogDescription className="text-neutral-400">
            Θα διαγραφεί οριστικά το «{confirmItem?.name}».
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            data-testid="delete-item-cancel"
            className="bg-[#3D1620] border-[#723645] text-neutral-300 hover:bg-[#431A25] hover:text-white"
          >
            Άκυρο
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDeleteItem}
            data-testid="delete-item-confirm"
            className="bg-[#FF3B30] hover:bg-[#FF5A50] text-white"
          >
            Διαγραφή
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteCategoryDialog({ confirmCat, setConfirmCat, confirmDeleteCategory }) {
  return (
    <AlertDialog open={!!confirmCat} onOpenChange={(v) => !v && setConfirmCat(null)}>
      <AlertDialogContent className="bg-[#2A0E14] border-[#723645] text-white" data-testid="delete-cat-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl">Διαγραφή κατηγορίας;</AlertDialogTitle>
          <AlertDialogDescription className="text-neutral-400">
            Θα διαγραφεί η «{confirmCat?.name}» μαζί με όλα τα προϊόντα της.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            data-testid="delete-cat-cancel"
            className="bg-[#3D1620] border-[#723645] text-neutral-300 hover:bg-[#431A25] hover:text-white"
          >
            Άκυρο
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDeleteCategory}
            data-testid="delete-cat-confirm"
            className="bg-[#FF3B30] hover:bg-[#FF5A50] text-white"
          >
            Διαγραφή
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
