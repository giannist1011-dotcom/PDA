import PinGateModal from "@/components/PinGateModal";
import CustomizationModal from "@/components/CustomizationModal";
import Receipt from "@/components/Receipt";
import DiscountModal from "./DiscountModal";
import ScheduledOrdersModal from "./ScheduledOrdersModal";

// Όλα τα modals της σελίδας PDA + κρυφή περιοχή εκτύπωσης απόδειξης
export default function PDAModals({
  modalItem,
  config,
  modalOpen,
  modalMode,
  initialCustomization,
  setModalOpen,
  setModalItem,
  setModalMode,
  setEditingLineId,
  setInitialCustomization,
  handleConfirmCustomization,
  scheduledOpen,
  scheduledOrders,
  setScheduledOpen,
  handlePrintNow,
  handleCancelScheduled,
  discountOpen,
  subtotal,
  discount,
  setDiscount,
  setDiscountOpen,
  pinGateOpen,
  setPinGateOpen,
  printOrder,
}) {
  return (
    <>
      <CustomizationModal
        item={modalItem}
        config={config.customization}
        open={modalOpen}
        mode={modalMode}
        initialCustomization={initialCustomization}
        onClose={() => {
          setModalOpen(false);
          setModalItem(null);
          setModalMode("add");
          setEditingLineId(null);
          setInitialCustomization(null);
        }}
        onConfirm={handleConfirmCustomization}
      />
      <ScheduledOrdersModal
        open={scheduledOpen}
        orders={scheduledOrders}
        onClose={() => setScheduledOpen(false)}
        onPrintNow={handlePrintNow}
        onCancel={handleCancelScheduled}
      />
      <DiscountModal
        open={discountOpen}
        subtotal={subtotal}
        current={discount}
        onApply={(d) => {
          setDiscount(d);
          setDiscountOpen(false);
        }}
        onRemove={() => {
          setDiscount(null);
          setDiscountOpen(false);
        }}
        onClose={() => setDiscountOpen(false)}
      />
      <PinGateModal
        open={pinGateOpen}
        title="Απαιτείται PIN ιδιοκτήτη/υπευθύνου για έκπτωση"
        onClose={() => setPinGateOpen(false)}
        onSuccess={() => {
          setPinGateOpen(false);
          setDiscountOpen(true);
        }}
      />
      <Receipt order={printOrder} />
    </>
  );
}
