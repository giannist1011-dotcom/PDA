import AdminShell from "@/components/AdminShell";
import AdminsContent from "./admin-admins/AdminsContent";

// Master-only σελίδα: sub-admin λογαριασμοί + audit log ενεργειών τους
// (το AdminShell δεν εμφανίζει καν το tab σε sub-admins και τους κάνει redirect)
export default function AdminAdmins() {
  return (
    <AdminShell
      title="Διαχειριστές"
      subtitle="Υπο-διαχειριστές με scope ανά προϊόν/πόλη + ιστορικό ενεργειών τους"
    >
      <AdminsContent />
    </AdminShell>
  );
}
