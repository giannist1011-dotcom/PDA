import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  ReceiptText,
  ArrowLeftRight,
  Minus,
  Plus,
  Trash2,
  X,
  Clock,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import MenuGrid from "@/components/MenuGrid";
import CustomizationModal from "@/components/CustomizationModal";
import Receipt from "@/components/Receipt";
import { Button } from "@/components/ui/button";
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
import { eur, formatGRTime } from "@/lib/format";

let LINE_SEQ = 1;
const newLineId = () => `TL${Date.now()}-${LINE_SEQ++}`;

const summarize = (c) => {
  if (!c) return null;
  const parts = [];
  if (c.bread) parts.push(c.bread);
  if (c.double_meat) parts.push("Διπλό κρέας");
  if (c.extras?.length) parts.push(`Υλικά: ${c.extras.join(", ")}`);
  if (c.sauces?.length) parts.push(`Αλοιφές: ${c.sauces.join(", ")}`);
  if (c.selections?.length) {
    c.selections.forEach((sel) => {
      const names = sel.choices.map((ch) => ch.name).join(", ");
      if (names) parts.push(`${sel.group_name}: ${names}`);
    });
  }
  return parts.join(" · ");
};

const roundTime = (iso) => formatGRTime(iso);

// Kitchen slip: prints ONLY the just-sent round (80mm print CSS)
function KitchenSlip({ slip }) {
  if (!slip) return null;
  return (
    <div id="print-area" className="hidden print:block">
      <div className="receipt-title text-center">ΚΟΥΖΙΝΑ</div>
      <div style={{ textAlign: "center", fontSize: 14, fontWeight: 800 }}>
        ΤΡΑΠΕΖΙ {slip.tableName}
      </div>
      <div style={{ textAlign: "center", fontSize: 11 }}>
        Γύρος {slip.round.round_no} · {roundTime(slip.round.sent_at)}
      </div>
      <hr />
      {slip.round.items.map((it, idx) => (
        <div key={idx} style={{ marginBottom: 5 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {it.quantity}x {it.name}
          </div>
          {it.customization && summarize(it.customization) && (
            <div style={{ fontSize: 11, paddingLeft: 8 }}>{summarize(it.customization)}</div>
          )}
        </div>
      ))}
      <hr />
      <div style={{ textAlign: "center", fontSize: 10 }}>
        {slip.sentBy ? `Σερβίρει: ${slip.sentBy}` : ""}
      </div>
    </div>
  );
}

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
        window.print();
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
        <aside
          className={`flex-col bg-[#3D1620] border-t lg:border-t-0 lg:border-l border-[#723645] flex-1 sm:flex-none min-h-0 overflow-hidden sm:overflow-visible lg:overflow-hidden lg:h-full ${
            mobileTab === "order" ? "flex" : "hidden"
          } sm:flex`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Existing rounds */}
            {(tab?.rounds || []).map((r) => (
              <div
                key={r.round_no}
                data-testid={`tab-round-${r.round_no}`}
                className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md"
              >
                <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                  <span className="flex items-center gap-1.5 font-bold uppercase tracking-widest">
                    <Clock className="w-3.5 h-3.5 text-flame" />
                    Γύρος {r.round_no} · {roundTime(r.sent_at)}
                  </span>
                  <span className="font-mono font-bold text-neutral-300">
                    {eur(r.items.reduce((s, it) => s + (it.line_total || 0), 0))}
                  </span>
                </div>
                <ul className="space-y-1">
                  {r.items.map((it, idx) => (
                    <li key={idx} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-white">
                          {it.quantity}x {it.name}
                        </span>
                        <span className="font-mono text-neutral-400 shrink-0">
                          {eur(it.line_total)}
                        </span>
                      </div>
                      {it.customization && summarize(it.customization) && (
                        <div className="text-[11px] text-neutral-500 leading-snug">
                          {summarize(it.customization)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* New (unsent) round */}
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#00E676] mb-2">
                Νέος γύρος
              </div>
              {newItems.length === 0 ? (
                <div className="text-neutral-500 text-sm py-6 text-center border border-dashed border-[#723645] rounded-md">
                  Επιλέξτε προϊόντα από το μενού
                </div>
              ) : (
                <div className="space-y-2">
                  {newItems.map((it) => (
                    <div
                      key={it.line_id}
                      data-testid={`new-line-${it.line_id}`}
                      className="p-2.5 bg-[#2A0E14] border border-[#00E676]/40 rounded-md"
                    >
                      <div className="flex justify-between gap-2 items-start">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white leading-tight">
                            {it.name}
                          </div>
                          {it.customization && summarize(it.customization) && (
                            <div className="text-[11px] text-neutral-500 leading-snug mt-0.5">
                              {summarize(it.customization)}
                            </div>
                          )}
                        </div>
                        <span className="font-mono font-bold text-white shrink-0">
                          {eur(it.line_total)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 bg-[#3D1620] rounded-md p-0.5">
                          <button
                            onClick={() => updateQty(it.line_id, -1)}
                            data-testid={`new-dec-${it.line_id}`}
                            className="w-9 h-9 rounded flex items-center justify-center text-white hover:bg-[#4A1B27] active:scale-95"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-7 text-center font-mono font-bold">
                            {it.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(it.line_id, 1)}
                            data-testid={`new-inc-${it.line_id}`}
                            className="w-9 h-9 rounded flex items-center justify-center text-white hover:bg-[#4A1B27] active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeLine(it.line_id)}
                          data-testid={`new-remove-${it.line_id}`}
                          className="p-2 text-neutral-400 hover:text-[#FF3B30]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fixed action footer */}
          <div className="px-4 py-3 border-t border-[#723645] bg-[#33111A] shrink-0 sticky bottom-0">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[11px] text-neutral-400 uppercase tracking-widest font-bold">
                Σύνολο καρτέλας
              </span>
              <span className="font-mono text-2xl font-bold text-white" data-testid="tab-total">
                {eur(grandTotal)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                onClick={handleSend}
                disabled={newItems.length === 0 || busy}
                data-testid="round-send-btn"
                className="h-12 text-sm font-bold bg-[#00E676] hover:bg-[#33EB91] text-black disabled:opacity-40"
              >
                <Send className="w-4 h-4 mr-1.5" />
                Αποστολή {newItems.length > 0 ? `(${eur(newTotal)})` : ""}
              </Button>
              <Button
                onClick={handleClose}
                disabled={!tab || busy}
                data-testid="tab-close-btn"
                className="h-12 text-sm font-bold bg-brand hover:bg-brand-hover text-white disabled:opacity-40"
              >
                <ReceiptText className="w-4 h-4 mr-1.5" />
                Κλείσιμο
              </Button>
            </div>
            {tab && (
              <button
                onClick={openTransfer}
                data-testid="tab-transfer-btn"
                className="w-full h-9 mt-1.5 rounded-md bg-[#4A1B27] border border-[#723645] text-neutral-200 hover:border-[#00B0FF] hover:text-[#00B0FF] text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Μεταφορά σε άλλο τραπέζι
              </button>
            )}
          </div>
        </aside>
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
      )}

      {printOrder ? <Receipt order={printOrder} /> : <KitchenSlip slip={printSlip} />}
    </AppShell>
  );
}
