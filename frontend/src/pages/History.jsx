import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  History as HistoryIcon,
  Search,
  Printer,
  Ban,
  Trash2,
  X,
  Users,
  Receipt as ReceiptIcon,
  Phone,
  MapPin,
  ChevronDown,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Receipt from "@/components/Receipt";
import PinGateModal from "@/components/PinGateModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ORDER_SOURCES } from "@/data/menu";
import { fetchOrders, apiGetOrder, apiCancelOrder, apiDeleteOrder, apiListCustomers, formatApiError } from "@/lib/api";
import { eur, todayISO, formatGRDateTime, formatGRDayMonthTime } from "@/lib/format";
import DatePicker from "@/components/DatePicker";
import { actorLabel } from "@/lib/roles";
import { printReceiptJob } from "@/lib/print";

const PAGE_SIZE = 30;

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

const schedLabel = (iso) => formatGRDayMonthTime(iso);

const ScheduledBadge = ({ order }) => {
  if (!order.scheduled_at) return null;
  const pending = order.status === "scheduled";
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
        pending ? "bg-[#00B0FF]/20 text-[#00B0FF]" : "bg-[#00B0FF]/10 text-[#00B0FF]/70"
      }`}
      title={pending ? "Δεν έχει τυπωθεί ακόμα" : "Είχε προγραμματιστεί"}
    >
      Προγρ. {schedLabel(order.scheduled_at)}
    </span>
  );
};

const typeLabel = (order) => {
  const t = order.delivery?.delivery_type;
  if (t === "delivery") return "Παράδοση";
  if (t === "takeaway") return "Takeaway";
  if (order.source === "Τραπέζι") return order.table_name || "Τραπέζι";
  return "—";
};

const sourceBadgeCls = {
  "Ταμείο": "bg-flame/15 text-flame",
  "Τηλέφωνο": "bg-[#00B0FF]/15 text-[#00B0FF]",
  efood: "bg-[#00E676]/15 text-[#00E676]",
  Box: "bg-gold/15 text-gold",
  "Τραπέζι": "bg-[#B388FF]/15 text-[#B388FF]",
};

const HISTORY_SOURCES = [...ORDER_SOURCES, "Τραπέζι"];

// ---------- Order detail modal ----------
function OrderDetailModal({ order, canManage, onClose, onReprint, onCancel, onDelete }) {
  if (!order) return null;
  const d = order.delivery;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="order-detail-modal"
    >
      <div className="bg-[#3D1620] border border-[#723645] rounded-lg w-full max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-[#431A25]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading text-xl font-bold">
                Παραγγελία #{String(order.order_number).padStart(3, "0")}
              </h3>
              <span
                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                  sourceBadgeCls[order.source] || "bg-[#723645] text-neutral-300"
                }`}
              >
                {order.source}
              </span>
              {order.cancelled && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#FF3B30]/20 text-[#FF6961]">
                  Ακυρωμένη
                </span>
              )}
              <ScheduledBadge order={order} />
            </div>
            <div className="text-sm text-neutral-400 mt-1">
              {formatGRDateTime(order.created_at)} · {typeLabel(order)}
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="order-detail-close"
            className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {d && (d.name || d.phone || d.address) && (
            <div className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md space-y-1 text-sm">
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">
                Στοιχεία πελάτη
              </div>
              {d.name && <div className="text-white font-semibold">{d.name}</div>}
              {d.phone && (
                <div className="flex items-center gap-2 text-neutral-300">
                  <Phone className="w-3.5 h-3.5 text-flame" /> {d.phone}
                </div>
              )}
              {d.address && (
                <div className="flex items-center gap-2 text-neutral-300">
                  <MapPin className="w-3.5 h-3.5 text-flame" />
                  {d.address}
                  {d.floor ? ` · Όροφος: ${d.floor}` : ""}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
              Προϊόντα
            </div>
            <ul className="space-y-2">
              {order.items.map((it, idx) => (
                <li
                  key={idx}
                  className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md"
                  data-testid={`order-detail-item-${idx}`}
                >
                  <div className="flex justify-between gap-3">
                    <span className="text-white font-semibold">
                      {it.quantity}x {it.name}
                    </span>
                    <span className="font-mono font-bold text-white shrink-0">
                      {eur(it.line_total)}
                    </span>
                  </div>
                  {it.customization && summarize(it.customization) && (
                    <div className="text-xs text-neutral-400 mt-1">
                      {summarize(it.customization)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 bg-[#2A0E14] border border-flame/40 rounded-md space-y-1">
            {order.discount?.amount > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase tracking-widest text-neutral-500">
                    Υποσύνολο
                  </span>
                  <span className="font-mono text-sm text-neutral-400">{eur(order.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center" data-testid="order-detail-discount">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#00E676]">
                    Έκπτωση{order.discount.type === "percent" ? ` ${order.discount.value}%` : ""}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#00E676]">
                    -{eur(order.discount.amount)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Σύνολο
              </span>
              <span className="font-mono text-xl font-bold text-gold">
                {eur(order.total)}
              </span>
            </div>
          </div>

          {(order.taken_by?.name || order.discount?.applied_by || order.cancelled_by) && (
            <div className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md space-y-1 text-xs text-neutral-400" data-testid="order-audit">
              <div className="font-bold uppercase tracking-widest text-neutral-500 mb-1">
                Καταγραφή ενεργειών
              </div>
              {order.taken_by?.name && (
                <div>
                  Παραγγελία από:{" "}
                  <span className="text-white">
                    {actorLabel(order.taken_by.name, order.taken_by.role)}
                  </span>
                </div>
              )}
              {order.discount?.applied_by && (
                <div>
                  Έκπτωση από:{" "}
                  <span className="text-white">
                    {actorLabel(order.discount.applied_by, order.discount.applied_by_role)}
                  </span>
                  {order.discount.applied_at ? ` · ${formatGRDateTime(order.discount.applied_at)}` : ""}
                </div>
              )}
              {order.cancelled_by && (
                <div>
                  Ακύρωση από:{" "}
                  <span className="text-[#FF6961]">
                    {actorLabel(order.cancelled_by, order.cancelled_by_role)}
                  </span>
                  {order.cancelled_at ? ` · ${formatGRDateTime(order.cancelled_at)}` : ""}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[#431A25] flex flex-wrap gap-2 justify-end">
          <Button
            onClick={() => onDelete(order)}
            data-testid="order-delete-btn"
            title={canManage ? "" : "Απαιτείται PIN ιδιοκτήτη/υπευθύνου"}
            className="h-11 bg-[#FF3B30] hover:bg-[#FF5A50] text-white font-bold mr-auto"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Διαγραφή
          </Button>
          {!order.cancelled && (
            <Button
              onClick={() => onCancel(order)}
              data-testid="order-cancel-btn"
              title={canManage ? "" : "Απαιτείται PIN ιδιοκτήτη/υπευθύνου"}
              className="h-11 bg-transparent border border-[#FF3B30]/50 text-[#FF6961] hover:bg-[#FF3B30]/10 hover:border-[#FF3B30]"
            >
              <Ban className="w-4 h-4 mr-2" /> Ακύρωση
            </Button>
          )}
          <Button
            onClick={() => onReprint(order)}
            data-testid="order-reprint-btn"
            className="h-11 bg-brand hover:bg-brand-hover font-bold"
          >
            <Printer className="w-4 h-4 mr-2" /> Επανεκτύπωση
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Customer detail modal ----------
function CustomerDetailModal({ customer, onClose, onOpenOrder }) {
  if (!customer) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="customer-detail-modal"
    >
      <div className="bg-[#3D1620] border border-[#723645] rounded-lg w-full max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-[#431A25]">
          <div>
            <h3 className="font-heading text-xl font-bold">
              {customer.name || "Χωρίς όνομα"}
            </h3>
            <div className="text-sm text-neutral-400 mt-1 space-y-0.5">
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-flame" /> {customer.phone}
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-flame" />
                  {customer.address}
                  {customer.floor ? ` · Όροφος: ${customer.floor}` : ""}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="customer-detail-close"
            className="w-9 h-9 rounded-md border border-[#723645] hover:border-flame flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                Παραγγελίες
              </div>
              <div className="font-mono text-xl font-bold text-white mt-0.5">
                {customer.orders_count}
              </div>
            </div>
            <div className="p-3 bg-[#2A0E14] border border-[#723645] rounded-md">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                Συνολικά έσοδα
              </div>
              <div className="font-mono text-xl font-bold text-gold mt-0.5">
                {eur(customer.total_spent)}
              </div>
            </div>
          </div>

          {customer.top_items?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
                Τα συνηθισμένα του
              </div>
              <div className="flex flex-wrap gap-2">
                {customer.top_items.map((it) => (
                  <span
                    key={it.name}
                    className="px-3 py-1.5 bg-[#2A0E14] border border-[#723645] rounded-md text-sm"
                  >
                    <span className="text-white">{it.name}</span>
                    <span className="font-mono text-gold font-bold ml-2">
                      ×{it.quantity}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
              Ιστορικό παραγγελιών
            </div>
            <ul className="space-y-2">
              {customer.orders.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => onOpenOrder(o.id)}
                    data-testid={`customer-order-${o.id}`}
                    className="w-full flex items-center justify-between gap-3 p-3 bg-[#2A0E14] border border-[#723645] rounded-md hover:border-flame text-left transition-colors"
                  >
                    <div>
                      <div className="text-white font-semibold text-sm">
                        #{String(o.order_number).padStart(3, "0")}
                        <span className="text-neutral-500 font-normal ml-2">
                          {o.delivery_type === "delivery" ? "Παράδοση" : "Takeaway"}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {formatGRDateTime(o.created_at)}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-white shrink-0">
                      {eur(o.total)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main page ----------
export default function History() {
  const { user, isOwner, canManage } = useAuth();
  const [tab, setTab] = useState("orders");

  // ---- Tab 1: orders ----
  const [date, setDate] = useState(todayISO());
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);

  const buildParams = (skip = 0) => {
    const p = { date_from: date, date_to: date, skip, limit: PAGE_SIZE };
    if (source !== "all") p.source = source;
    if (search.trim()) p.q = search.trim();
    return p;
  };

  const loadOrders = async ({ append = false, skip = 0 } = {}) => {
    setLoading(true);
    try {
      const docs = await fetchOrders(buildParams(skip));
      setOrders((prev) => (append ? [...prev, ...docs] : docs));
      setHasMore(docs.length === PAGE_SIZE);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, source]);

  const submitSearch = (e) => {
    e?.preventDefault();
    loadOrders();
  };

  const handleReprint = (order) => {
    setPrintOrder({ ...order, restaurant_name: user?.restaurant_name });
    setTimeout(() => printReceiptJob(user), 100);
  };

  // PIN gate state for employee-initiated cancel/delete
  const [pinGate, setPinGate] = useState(null); // {action: "cancel"|"delete", order}

  const doCancelOrder = async (order, pin = null) => {
    try {
      await apiCancelOrder(order.id, pin);
      setOrders((p) => p.map((o) => (o.id === order.id ? { ...o, cancelled: true } : o)));
      setSelectedOrder((s) => (s && s.id === order.id ? { ...s, cancelled: true } : s));
      toast.success("Η παραγγελία ακυρώθηκε");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const doDeleteOrder = async (order, pin = null) => {
    try {
      await apiDeleteOrder(order.id, pin);
      setOrders((p) => p.filter((o) => o.id !== order.id));
      setSelectedOrder(null);
      setCustomersLoaded(false); // customer stats must be recomputed
      toast.success("Η παραγγελία διαγράφηκε οριστικά");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleCancelOrder = (order) => {
    if (!window.confirm(`Ακύρωση παραγγελίας #${String(order.order_number).padStart(3, "0")}; Θα εξαιρεθεί από τα στατιστικά.`)) {
      return;
    }
    if (canManage) doCancelOrder(order);
    else setPinGate({ action: "cancel", order });
  };

  const handleDeleteOrder = (order) => {
    if (!window.confirm(`Οριστική διαγραφή παραγγελίας #${String(order.order_number).padStart(3, "0")}; Δεν μπορεί να αναιρεθεί.`)) {
      return;
    }
    if (canManage) doDeleteOrder(order);
    else setPinGate({ action: "delete", order });
  };

  const handlePinVerified = (pin) => {
    const gate = pinGate;
    setPinGate(null);
    if (!gate) return;
    if (gate.action === "cancel") doCancelOrder(gate.order, pin);
    else doDeleteOrder(gate.order, pin);
  };

  // ---- Tab 2: customers ----
  const [customers, setCustomers] = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const loadCustomers = async () => {
    setCustomersLoading(true);
    try {
      setCustomers(await apiListCustomers());
      setCustomersLoaded(true);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setCustomersLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "customers" && isOwner && !customersLoaded) loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filteredCustomers = useMemo(() => {
    const t = customerSearch.trim().toLowerCase();
    if (!t) return customers;
    return customers.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(t) ||
        (c.phone || "").includes(t) ||
        (c.address || "").toLowerCase().includes(t)
    );
  }, [customers, customerSearch]);

  // Open a specific order (from the customer card) in the order detail modal
  const openOrderById = async (orderId) => {
    try {
      const order = await apiGetOrder(orderId);
      setSelectedCustomer(null);
      setSelectedOrder(order);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <AppShell title="Ιστορικό">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-[1400px] mx-auto w-full">
        {/* Header + tabs */}
        <div className="flex items-center gap-2 mb-2">
          <HistoryIcon className="w-6 h-6 text-flame" />
          <h2 className="font-heading text-2xl font-bold">Ιστορικό παραγγελιών</h2>
        </div>
        <div className="flex gap-2 mt-4 mb-6 border-b border-[#431A25]">
          <button
            onClick={() => setTab("orders")}
            data-testid="history-tab-orders"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === "orders"
                ? "border-flame text-flame"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            <ReceiptIcon className="w-4 h-4" /> Παραγγελίες
          </button>
          {isOwner && (
            <button
              onClick={() => setTab("customers")}
              data-testid="history-tab-customers"
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
                tab === "customers"
                  ? "border-flame text-flame"
                  : "border-transparent text-neutral-400 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" /> Στατιστικά πελατών
            </button>
          )}
        </div>

        {tab === "orders" ? (
          <>
            {/* Filters */}
            <div className="p-4 bg-[#3D1620] border border-[#723645] rounded-lg mb-5">
              <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                    Ημερομηνία
                  </label>
                  <DatePicker
                    value={date}
                    onChange={setDate}
                    testId="history-date-input"
                    className="h-11 px-3"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                    Πηγή
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    data-testid="history-source-select"
                    className="h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
                  >
                    <option value="all">Όλες</option>
                    {HISTORY_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
                    Αναζήτηση
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Αρ. παραγγελίας, τηλέφωνο ή όνομα..."
                      data-testid="history-search-input"
                      className="flex-1 h-11 px-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
                    />
                    <Button
                      type="submit"
                      data-testid="history-search-btn"
                      className="h-11 bg-brand hover:bg-brand-hover px-4"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            {/* Orders list */}
            {loading && orders.length === 0 ? (
              <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
            ) : orders.length === 0 ? (
              <div className="text-neutral-500 py-16 text-center bg-[#3D1620] border border-[#723645] rounded-lg">
                Δεν βρέθηκαν παραγγελίες
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {orders.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setSelectedOrder(o)}
                      data-testid={`history-order-${o.id}`}
                      className={`w-full flex items-center gap-4 p-4 bg-[#3D1620] border rounded-lg text-left transition-colors hover:border-flame ${
                        o.cancelled ? "border-[#FF3B30]/40 opacity-70" : "border-[#723645]"
                      }`}
                    >
                      <div className="font-mono font-bold text-lg text-white w-16 shrink-0">
                        #{String(o.order_number).padStart(3, "0")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                              sourceBadgeCls[o.source] || "bg-[#723645] text-neutral-300"
                            }`}
                          >
                            {o.source}
                          </span>
                          <span className="text-xs text-neutral-400">{typeLabel(o)}</span>
                          {o.cancelled && (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#FF3B30]/20 text-[#FF6961]">
                              Ακυρωμένη
                            </span>
                          )}
                          <ScheduledBadge order={o} />
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {formatGRDateTime(o.created_at)}
                          {o.delivery?.name ? ` · ${o.delivery.name}` : ""}
                          {o.delivery?.phone ? ` · ${o.delivery.phone}` : ""}
                        </div>
                      </div>
                      <div
                        className={`font-mono font-bold text-lg shrink-0 ${
                          o.cancelled ? "text-neutral-500 line-through" : "text-white"
                        }`}
                      >
                        {eur(o.total)}
                      </div>
                    </button>
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-4 text-center">
                    <Button
                      onClick={() => loadOrders({ append: true, skip: orders.length })}
                      disabled={loading}
                      data-testid="history-load-more"
                      className="h-11 px-6 bg-[#3D1620] border border-[#723645] hover:border-flame text-white font-bold"
                    >
                      <ChevronDown className="w-4 h-4 mr-2" />
                      {loading ? "Φόρτωση..." : "Περισσότερες"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Customers tab */}
            <div className="p-4 bg-[#3D1620] border border-[#723645] rounded-lg mb-5">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Αναζήτηση με όνομα, τηλέφωνο ή διεύθυνση..."
                  data-testid="customer-search-input"
                  className="w-full h-11 pl-10 pr-3 bg-[#2A0E14] border border-[#723645] rounded-md text-white text-sm focus:outline-none focus:border-flame"
                />
              </div>
            </div>

            {customersLoading ? (
              <div className="text-neutral-500 py-12 text-center">Φόρτωση...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-neutral-500 py-16 text-center bg-[#3D1620] border border-[#723645] rounded-lg">
                {customers.length === 0
                  ? "Δεν υπάρχουν πελάτες ακόμα — καταγράφονται αυτόματα από τις τηλεφωνικές παραγγελίες"
                  : "Δεν βρέθηκαν πελάτες"}
              </div>
            ) : (
              <div className="overflow-x-auto bg-[#3D1620] border border-[#723645] rounded-lg">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-widest text-neutral-400 border-b border-[#723645]">
                      <th className="py-3 px-4">Πελάτης</th>
                      <th className="py-3 px-4">Τηλέφωνο</th>
                      <th className="py-3 px-4">Διεύθυνση</th>
                      <th className="py-3 px-4 text-right">Παραγγελίες</th>
                      <th className="py-3 px-4 text-right">Έσοδα</th>
                      <th className="py-3 px-4 text-right">Τελευταία</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => (
                      <tr
                        key={c.key}
                        onClick={() => setSelectedCustomer(c)}
                        data-testid={`customer-row-${c.key}`}
                        className="border-b border-[#431A25] last:border-0 cursor-pointer hover:bg-[#2A0E14] transition-colors"
                      >
                        <td className="py-3 px-4 text-white font-semibold">
                          {c.name || <span className="text-neutral-500">Χωρίς όνομα</span>}
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-300">
                          {c.phone || "—"}
                        </td>
                        <td className="py-3 px-4 text-neutral-300 max-w-[240px] truncate">
                          {c.address ? `${c.address}${c.floor ? ` · ${c.floor}` : ""}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-gold">
                          {c.orders_count}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white">
                          {eur(c.total_spent)}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-neutral-500 whitespace-nowrap">
                          {formatGRDateTime(c.last_order_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      <OrderDetailModal
        order={selectedOrder}
        canManage={canManage}
        onClose={() => setSelectedOrder(null)}
        onReprint={handleReprint}
        onCancel={handleCancelOrder}
        onDelete={handleDeleteOrder}
      />
      <CustomerDetailModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onOpenOrder={openOrderById}
      />
      <PinGateModal
        open={!!pinGate}
        title={
          pinGate?.action === "delete"
            ? "Απαιτείται PIN ιδιοκτήτη/υπευθύνου για οριστική διαγραφή"
            : "Απαιτείται PIN ιδιοκτήτη/υπευθύνου για ακύρωση παραγγελίας"
        }
        onClose={() => setPinGate(null)}
        onSuccess={handlePinVerified}
      />
      <Receipt order={printOrder} />
    </AppShell>
  );
}
