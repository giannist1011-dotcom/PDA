// Κεντρικός «κόμβος» παραγγελιών πλατφορμών: ΕΝΑ poll τροφοδοτεί ταυτόχρονα
// τις καρτέλες efood/Box/Wolt, τα badges, τον ήχο και το καθολικό popup.
// Ζει πάνω από τα routes ώστε η ειδοποίηση να φτάνει σε ΟΠΟΙΑΔΗΠΟΤΕ οθόνη.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/shared/AuthContext";
import { can } from "@/lib/perms";
import {
  apiPlatformSettings,
  apiPlatformOrders,
  apiAcceptPlatformOrder,
  apiRejectPlatformOrder,
  apiPlatformReadyTime,
  apiPlatformOutForDelivery,
  apiCompletePlatformOrder,
  formatApiError,
} from "@/lib/api";
import { createPlatformAlarm } from "@/lib/platformSound";
import { printReceiptJob } from "@/lib/print";
import { receiptStoreName } from "@/lib/receiptText";
import Receipt from "@/components/pos/Receipt";

const POLL_MS = 15000;

const Ctx = createContext(null);

export const usePlatformOrders = () => useContext(Ctx) || EMPTY;

// Ασφαλής τιμή για οθόνες εκτός provider (login, admin, fleet)
const EMPTY = {
  enabled: [],
  settings: [],
  orders: [],
  pending: [],
  active: [],
  pendingByPlatform: {},
  loading: false,
  refresh: () => {},
  accept: () => Promise.resolve(),
  reject: () => Promise.resolve(),
  setReadyTime: () => Promise.resolve(),
  outForDelivery: () => Promise.resolve(),
  complete: () => Promise.resolve(),
  setStoreOpenLocal: () => {},
  canTestOrders: false,
};

export function PlatformOrdersProvider({ children }) {
  const { user } = useAuth();
  const authed = !!user && user !== false;
  // Ρόλος/δικαίωμα: ο σερβιτόρος και τα προφίλ χωρίς «platforms» δεν βλέπουν τίποτα
  const allowed =
    authed &&
    ["owner", "manager", "employee"].includes(user.role || user.profile) &&
    can(user, "platforms");
  const hasPlatforms = allowed && (user.platforms_enabled || []).length > 0;

  const [settings, setSettings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [canTestOrders, setCanTestOrders] = useState(false);
  // Παραγγελία που δείχνει αυτή τη στιγμή το popup (μένει μέχρι να απαντηθεί)
  const [popupId, setPopupId] = useState(null);

  const alarm = useRef(null);
  const seenPending = useRef(new Set());
  // Η αποδοχή μπορεί να γίνει από ΟΠΟΙΑΔΗΠΟΤΕ οθόνη (popup) — άρα η απόδειξη
  // για το browser/kiosk mode πρέπει να υπάρχει κι εδώ, όχι μόνο στη σελίδα
  const [printed, setPrinted] = useState(null);

  // ---- Φόρτωση ρυθμίσεων (ενεργές πλατφόρμες, capabilities, ήχοι) ----
  const loadSettings = useCallback(async () => {
    if (!allowed) return;
    try {
      const s = await apiPlatformSettings();
      setSettings(s.platforms || []);
      setCanTestOrders(!!s.can_test_orders);
    } catch {
      // δεν μπλοκάρει το POS — θα ξαναδοκιμάσει στο επόμενο mount
    }
  }, [allowed]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ---- Poll ενεργών παραγγελιών ----
  const refresh = useCallback(async () => {
    if (!hasPlatforms) return;
    try {
      const res = await apiPlatformOrders();
      setOrders(res.orders || []);
    } catch {
      // σφάλμα δικτύου — ξαναδοκιμάζει στο επόμενο poll
    }
  }, [hasPlatforms]);

  useEffect(() => {
    if (!hasPlatforms) {
      setOrders([]);
      return undefined;
    }
    setLoading(true);
    refresh().finally(() => setLoading(false));
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [hasPlatforms, refresh]);

  const pending = useMemo(() => orders.filter((o) => o.status === "pending"), [orders]);
  const active = useMemo(
    () => orders.filter((o) => o.status === "accepted" || o.status === "out_for_delivery"),
    [orders]
  );

  const pendingByPlatform = useMemo(() => {
    const m = {};
    pending.forEach((o) => {
      m[o.platform] = (m[o.platform] || 0) + 1;
    });
    return m;
  }, [pending]);

  // ---- Ήχος + popup σε κάθε νέα εισερχόμενη ----
  useEffect(() => {
    if (!alarm.current) alarm.current = createPlatformAlarm();
    const ids = pending.map((o) => o.id);
    const fresh = ids.filter((id) => !seenPending.current.has(id));
    seenPending.current = new Set(ids);
    alarm.current.update([...new Set(pending.map((o) => o.platform))], {
      ringNow: fresh.length > 0,
    });
    // Το popup δείχνει πάντα την παλαιότερη αναπάντητη — παραμένει μέχρι να απαντηθεί
    setPopupId((cur) => (cur && ids.includes(cur) ? cur : ids[0] || null));
  }, [pending]);

  useEffect(() => () => alarm.current?.stop(), []);

  const popupOrder = useMemo(
    () => pending.find((o) => o.id === popupId) || null,
    [pending, popupId]
  );

  // ---- Ενέργειες ----
  const drop = (id) => setOrders((p) => p.filter((o) => o.id !== id));
  const patch = (po) => setOrders((p) => p.map((o) => (o.id === po.id ? po : o)));

  const accept = useCallback(
    async (id, readyMinutes) => {
      const res = await apiAcceptPlatformOrder(id, readyMinutes);
      patch(res.platform_order);
      // Εκτύπωση με τον κανονικό τρόπο του μαγαζιού (kiosk / Bridge / Relay),
      // με τη γραμμή-banner της πλατφόρμας στην κορυφή
      const merged = { ...res.order, restaurant_name: receiptStoreName(user) };
      setPrinted(merged);
      setTimeout(() => printReceiptJob(user, merged), 150);
      toast.success(
        `Αποδοχή #${String(res.order.order_number).padStart(3, "0")} · ${readyMinutes}′`
      );
      return res;
    },
    [user]
  );

  const reject = useCallback(async (id, reason = null) => {
    const po = await apiRejectPlatformOrder(id, reason);
    drop(id);
    toast.warning("Η παραγγελία απορρίφθηκε");
    return po;
  }, []);

  const setReadyTime = useCallback(async (id, readyMinutes) => {
    const po = await apiPlatformReadyTime(id, readyMinutes);
    patch(po);
    return po;
  }, []);

  const outForDelivery = useCallback(async (id) => {
    const po = await apiPlatformOutForDelivery(id);
    patch(po);
    toast.success("Καθ' οδόν");
    return po;
  }, []);

  const complete = useCallback(async (id) => {
    const po = await apiCompletePlatformOrder(id);
    drop(id);
    return po;
  }, []);

  // Το toggle «Ανοιχτό στο …» αλλάζει τοπικά μετά από επιτυχή κλήση
  const setStoreOpenLocal = useCallback((platform, isOpen) => {
    setSettings((p) =>
      p.map((s) => (s.platform === platform ? { ...s, store_open: isOpen } : s))
    );
  }, []);

  const enabled = useMemo(
    () => settings.filter((s) => s.enabled).map((s) => s.platform),
    [settings]
  );

  const value = useMemo(
    () => ({
      enabled,
      settings,
      orders,
      pending,
      active,
      pendingByPlatform,
      loading,
      refresh,
      reloadSettings: loadSettings,
      accept,
      reject,
      setReadyTime,
      outForDelivery,
      complete,
      setStoreOpenLocal,
      canTestOrders,
      popupOrder,
      dismissPopup: () => setPopupId(null),
      formatError: formatApiError,
    }),
    [
      enabled, settings, orders, pending, active, pendingByPlatform, loading,
      refresh, loadSettings, accept, reject, setReadyTime, outForDelivery,
      complete, setStoreOpenLocal, canTestOrders, popupOrder,
    ]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Receipt order={printed} />
    </Ctx.Provider>
  );
}
