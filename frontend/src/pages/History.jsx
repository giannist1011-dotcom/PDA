import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  History as HistoryIcon,
  Users,
  Receipt as ReceiptIcon,
  Map as MapIcon,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import LiveOrdersMap from "@/components/LiveOrdersMap";
import Receipt from "@/components/Receipt";
import PinGateModal from "@/components/PinGateModal";
import { useAuth } from "@/context/AuthContext";
import { fetchOrders, fetchOrdersCount, apiGetOrder, apiCancelOrder, apiDeleteOrder, apiListCustomers, formatApiError } from "@/lib/api";
import { athensToday } from "@/lib/dates";
import { printReceiptJob } from "@/lib/print";
import OrderDetailModal from "./history/OrderDetailModal";
import CustomerDetailModal from "./history/CustomerDetailModal";
import OrdersTab from "./history/OrdersTab";
import CustomersTab from "./history/CustomersTab";

const PAGE_SIZE = 30;

// ---------- Main page ----------
export default function History() {
  const { user, isOwner, canManage } = useAuth();
  const [tab, setTab] = useState("map");

  // ---- Tab 1: orders ----
  // Φίλτρο περιόδου: preset ή custom εύρος ημερών (Ελλάδας) · "all" = χωρίς date filter
  const [period, setPeriod] = useState(() => {
    const t = athensToday();
    return { preset: "today", from: t, to: t };
  });
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);

  const buildParams = (skip = 0) => {
    const p = { skip, limit: PAGE_SIZE };
    if (period.from) p.date_from = period.from;
    if (period.to) p.date_to = period.to;
    if (source !== "all") p.source = source;
    if (search.trim()) p.q = search.trim();
    return p;
  };

  const loadOrders = async ({ append = false, skip = 0 } = {}) => {
    setLoading(true);
    try {
      if (append) {
        const docs = await fetchOrders(buildParams(skip));
        setOrders((prev) => [...prev, ...docs]);
        setHasMore(docs.length === PAGE_SIZE);
      } else {
        // Λίστα (σελιδοποιημένη) + συνολικό πλήθος για τα ίδια φίλτρα
        const [docs, cnt] = await Promise.all([
          fetchOrders(buildParams(0)),
          fetchOrdersCount(buildParams(0)),
        ]);
        setOrders(docs);
        setHasMore(docs.length === PAGE_SIZE);
        setTotalCount(cnt.count);
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, source]);

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
            onClick={() => setTab("map")}
            data-testid="history-tab-map"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === "map"
                ? "border-flame text-flame"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            <MapIcon className="w-4 h-4" /> Χάρτης
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#00E676]/15 text-[#00E676]">
              Live
            </span>
          </button>
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

        {tab === "map" ? (
          <LiveOrdersMap />
        ) : tab === "orders" ? (
          <OrdersTab
            period={period}
            setPeriod={setPeriod}
            submitSearch={submitSearch}
            source={source}
            setSource={setSource}
            search={search}
            setSearch={setSearch}
            totalCount={totalCount}
            loading={loading}
            orders={orders}
            setSelectedOrder={setSelectedOrder}
            hasMore={hasMore}
            loadOrders={loadOrders}
          />
        ) : (
          <CustomersTab
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            customersLoading={customersLoading}
            filteredCustomers={filteredCustomers}
            customers={customers}
            setSelectedCustomer={setSelectedCustomer}
          />
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
