import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/components/AppShell";
import MenuGrid from "@/components/MenuGrid";
import CustomizationModal from "@/components/CustomizationModal";
import Receipt from "@/components/Receipt";
import { useAuth } from "@/context/AuthContext";
import {
  apiGetMenuConfig,
  apiGetTableTab,
  apiSendRound,
  apiCloseTab,
  apiTransferTab,
  apiTablesState,
  formatApiError,
} from "@/lib/api";
import { eur } from "@/lib/format";
import { printReceiptJob } from "@/lib/print";
import KitchenSlip from "./table-order/KitchenSlip";
import TabPanel from "./table-order/TabPanel";
import TransferModal from "./table-order/TransferModal";

let LINE_SEQ = 1;
const newLineId = () => `TL${Date.now()}-${LINE_SEQ++}`;

export default function TableOrder() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { user, profileName } = useAuth();

  const [config, setConfig] = useState({ categories: [], items: [], customization: null });
  const [activeCategory, setActiveCategory] = useState(null);
  const [table, setTable] = useState(null);
  const [tab, setTab] = useState(null);
  const [newItems, setNewItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [printSlip, setPrintSlip] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [freeTables, setFreeTables] = useState([]);
  // Mobile (<sm): switch between menu and the tab (order) view
  const [mobileTab, setMobileTab] = useState("menu");

  const load = async () => {
    try {
      const [cfg, tt] = await Promise.all([apiGetMenuConfig(), apiGetTableTab(tableId)]);
      setConfig(cfg);
      if (cfg.categories?.length) setActiveCategory((c) => c || cfg.categories[0].id);
      setTable(tt.table);
      setTab(tt.tab);
    } catch (e) {
      toast.error(formatApiError(e));
      navigate("/app/tables");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  // ---- current round lines ----
  const addLine = (item, customization = null, unitPriceOverride = null) => {
    const unit_price = unitPriceOverride ?? item.price;
    setNewItems((prev) => [
      ...prev,
      {
        line_id: newLineId(),
        item_id: item.id,
        name: item.name,
        category: item.category,
        unit_price,
        quantity: 1,
        line_total: unit_price,
        customization,
      },
    ]);
  };

  const handleItemClick = (item) => {
    if (item.available === false) return;
    const hasGroups = Array.isArray(item.option_groups) && item.option_groups.length > 0;
    if (hasGroups || item.customizable) {
      setModalItem(item);
      setModalOpen(true);
    } else {
      addLine(item);
    }
  };

  const updateQty = (lineId, delta) =>
    setNewItems((prev) =>
      prev.map((it) => {
        if (it.line_id !== lineId) return it;
        const nq = Math.max(1, it.quantity + delta);
        return { ...it, quantity: nq, line_total: it.unit_price * nq };
      })
    );

  const removeLine = (lineId) =>
    setNewItems((prev) => prev.filter((it) => it.line_id !== lineId));

  const roundsTotal = (tab?.rounds || []).reduce(
    (s, r) => s + r.items.reduce((a, it) => a + (it.line_total || 0), 0),
    0
  );
  const newTotal = newItems.reduce((s, it) => s + it.line_total, 0);
  const grandTotal = roundsTotal + newTotal;
  // Πλήθος ειδών στην καρτέλα (σταλμένοι γύροι + νέος γύρος) — δείκτης στο tab «Παραγγελία»
  const roundsQty = (tab?.rounds || []).reduce(
    (s, r) => s + r.items.reduce((a, it) => a + (it.quantity || 0), 0),
    0
  );
  const newQty = newItems.reduce((s, it) => s + it.quantity, 0);
  const orderCount = roundsQty + newQty;

  // ---- actions ----
  const handleSend = async () => {
    if (newItems.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await apiSendRound(
        tableId,
        newItems.map((it) => ({
          item_id: it.item_id,
          name: it.name,
          category: it.category,
          unit_price: it.unit_price,
          quantity: it.quantity,
          line_total: it.line_total,
          customization: it.customization,
        }))
      );
      setTab(res.tab);
      setNewItems([]);
      setPrintSlip({ tableName: res.table.name, round: res.round, sentBy: profileName });
      setTimeout(() => window.print(), 150);
      toast.success(`Ο γύρος ${res.round.round_no} στάλθηκε`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!tab || busy) return;
    if (newItems.length > 0) {
      toast.error("Στείλτε ή αφαιρέστε τα νέα προϊόντα πριν το κλείσιμο");
      return;
    }
    if (!window.confirm(`Κλείσιμο τραπεζιού ${table?.name}; Σύνολο: ${eur(roundsTotal)}`)) return;
    setBusy(true);
    try {
      const order = await apiCloseTab(tab.id);
      setPrintSlip(null);
      setPrintOrder({ ...order, restaurant_name: user?.restaurant_name });
      setTimeout(() => {
        printReceiptJob(user);
        navigate("/app/tables");
      }, 200);
      toast.success(`Το τραπέζι έκλεισε — παραγγελία #${String(order.order_number).padStart(3, "0")}`);
    } catch (e) {
      toast.error(formatApiError(e));
      setBusy(false);
    }
  };

  const openTransfer = async () => {
    try {
      const st = await apiTablesState();
      setFreeTables((st.tables || []).filter((t) => !t.tab && t.id !== tableId));
      setTransferOpen(true);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleTransfer = async (target) => {
    try {
      const res = await apiTransferTab(tab.id, target.id);
      toast.success(`Η καρτέλα μεταφέρθηκε στο ${res.table_name}`);
      setTransferOpen(false);
      navigate(`/app/tables/${target.id}`, { replace: true });
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  if (loading) {
    return (
      <AppShell title="Τραπέζι">
        <div className="flex-1 flex items-center justify-center text-neutral-400">Φόρτωση...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Τραπέζι ${table?.name || ""}`}>
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] overflow-hidden sm:overflow-y-auto lg:overflow-hidden">
        {/* Κινητό (<sm): τίτλος τραπεζιού + tabs Μενού / Παραγγελία */}
        <div className="sm:hidden shrink-0 border-b border-[#723645] bg-[#2A0E14]">
          <div className="flex items-center gap-3 px-4 pt-3 pb-2">
            <button
              onClick={() => navigate("/app/tables")}
              data-testid="table-back-btn-mobile"
              className="w-10 h-10 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="font-heading text-lg font-bold truncate">Τραπέζι {table?.name}</div>
              <div className="text-xs text-neutral-500">
                {tab ? `Ανοιχτή καρτέλα · ${tab.rounds?.length || 0} γύροι` : "Ελεύθερο"}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 px-2 pb-2">
            <button
              onClick={() => setMobileTab("menu")}
              data-testid="table-tab-menu"
              data-state={mobileTab === "menu" ? "on" : "off"}
              className={`flex-1 h-11 rounded-md text-sm font-bold transition-colors ${
                mobileTab === "menu"
                  ? "bg-brand text-white"
                  : "bg-[#3D1620] border border-[#723645] text-neutral-300"
              }`}
            >
              Μενού
            </button>
            <button
              onClick={() => setMobileTab("order")}
              data-testid="table-tab-order"
              data-state={mobileTab === "order" ? "on" : "off"}
              className={`flex-1 h-11 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                mobileTab === "order"
                  ? "bg-brand text-white"
                  : "bg-[#3D1620] border border-[#723645] text-neutral-300"
              }`}
            >
              Παραγγελία
              {orderCount > 0 && (
                <span
                  key={orderCount}
                  className="pk-pop min-w-[22px] h-[22px] px-1.5 rounded-full bg-flame text-white text-xs font-bold flex items-center justify-center"
                >
                  {orderCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Menu */}
        <section
          className={`p-4 md:p-6 flex-col min-h-0 sm:min-h-[45vh] lg:min-h-0 flex-1 sm:flex-none overflow-hidden sm:overflow-visible lg:overflow-hidden ${
            mobileTab === "menu" ? "flex" : "hidden"
          } sm:flex`}
        >
          <div className="hidden sm:flex items-center gap-3 mb-4 shrink-0">
            <button
              onClick={() => navigate("/app/tables")}
              data-testid="table-back-btn"
              className="w-10 h-10 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="font-heading text-xl font-bold truncate">
                Τραπέζι {table?.name}
              </div>
              <div className="text-xs text-neutral-500">
                {tab ? `Ανοιχτή καρτέλα · ${tab.rounds?.length || 0} γύροι` : "Ελεύθερο"}
              </div>
            </div>
          </div>
          <MenuGrid
            categories={config.categories}
            items={config.items}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onItemClick={handleItemClick}
          />
        </section>

        {/* Tab panel */}
        <TabPanel
          mobileTab={mobileTab}
          tab={tab}
          newItems={newItems}
          updateQty={updateQty}
          removeLine={removeLine}
          grandTotal={grandTotal}
          newTotal={newTotal}
          busy={busy}
          handleSend={handleSend}
          handleClose={handleClose}
          openTransfer={openTransfer}
        />
      </main>

      <CustomizationModal
        item={modalItem}
        config={config.customization}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalItem(null);
        }}
        onConfirm={({ customization, unit_price }) => {
          addLine(modalItem, customization, unit_price);
          setModalOpen(false);
          setModalItem(null);
        }}
      />

      {/* Transfer modal */}
      {transferOpen && (
        <TransferModal
          setTransferOpen={setTransferOpen}
          freeTables={freeTables}
          handleTransfer={handleTransfer}
        />
      )}

      {printOrder ? <Receipt order={printOrder} /> : <KitchenSlip slip={printSlip} />}
    </AppShell>
  );
}
