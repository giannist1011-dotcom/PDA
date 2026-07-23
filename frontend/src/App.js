import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { StartupOverlay } from "@/components/LoadingScreen";
import Landing from "@/pages/Landing";
import PDA from "@/pages/PDA";
import Analytics from "@/pages/Analytics";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import MenuManagement from "@/pages/MenuManagement";
import Stock from "@/pages/Stock";
import Checklist from "@/pages/Checklist";
import Schedule from "@/pages/Schedule";
import ProfileSelect from "@/pages/ProfileSelect";
import Settings from "@/pages/Settings";
import Photos from "@/pages/Photos";
import Expenses from "@/pages/Expenses";
import History from "@/pages/History";
import DayClose from "@/pages/DayClose";
import DeckView from "@/pages/DeckView";
import DeckPilot from "@/pages/DeckPilot";
import DailyBrief from "@/pages/DailyBrief";
import Waiters from "@/pages/Waiters";
import Tables from "@/pages/Tables";
import TableOrder from "@/pages/TableOrder";
import AdminPromo from "@/pages/AdminPromo";
import AdminStockPhotos from "@/pages/AdminStockPhotos";
import AdminOverview from "@/pages/AdminOverview";
import AdminShops from "@/pages/AdminShops";
import AdminFleet from "@/pages/AdminFleet";
import AdminSubscriptions from "@/pages/AdminSubscriptions";
import AdminLeads from "@/pages/AdminLeads";
import AdminAnnouncements from "@/pages/AdminAnnouncements";
import AdminAdmins from "@/pages/AdminAdmins";
import PublicMenu from "@/pages/PublicMenu";
import { FleetAuthProvider, FleetProtected } from "@/context/FleetAuthContext";
import FleetLogin from "@/pages/FleetLogin";
import FleetSignup from "@/pages/FleetSignup";
import FleetDriverLogin from "@/pages/FleetDriverLogin";
import FleetSelect from "@/pages/FleetSelect";
import FleetDispatch from "@/pages/FleetDispatch";
import FleetDriver from "@/pages/FleetDriver";
import FleetMembers from "@/pages/FleetMembers";

// Old top-level app paths now live under /app — keep old links/bookmarks working.
const LEGACY_PATHS = [
  "/login",
  "/register",
  "/select-profile",
  "/tables",
  "/menu",
  "/photos",
  "/waiters",
  "/day-close",
  "/history",
  "/stock",
  "/schedule",
  "/analytics",
  "/expenses",
  "/settings",
];

// OrderDeck Fleet — αυτόνομες εταιρείες διανομής: δικό τους auth context/token,
// εντελώς εκτός των sessions μαγαζιών. Branding πάντα OrderDeck Fleet.
function FleetRoutes() {
  return (
    <FleetAuthProvider>
      <Routes>
        <Route path="login" element={<FleetLogin />} />
        {/* Εγγραφή εταιρείας: unified λογαριασμός (account_type=fleet_company) */}
        <Route path="signup" element={<FleetSignup />} />
        {/* Παλιά standalone εγγραφή — τα bookmarks πάνε στη νέα unified */}
        <Route path="register" element={<Navigate to="/fleet/signup" replace />} />
        <Route path="driver-login" element={<FleetDriverLogin />} />
        {/* Παλιά ροή invite-code — τα bookmarks πάνε στη νέα είσοδο διανομέα */}
        <Route path="join" element={<Navigate to="/fleet/driver-login" replace />} />
        <Route path="select" element={<FleetSelect />} />
        <Route
          index
          element={
            <FleetProtected roles={["fleet_admin"]}>
              <FleetDispatch />
            </FleetProtected>
          }
        />
        <Route
          path="members"
          element={
            <FleetProtected roles={["fleet_admin"]}>
              <FleetMembers />
            </FleetProtected>
          }
        />
        <Route
          path="driver"
          element={
            <FleetProtected>
              <FleetDriver />
            </FleetProtected>
          }
        />
        <Route path="*" element={<Navigate to="/fleet" replace />} />
      </Routes>
    </FleetAuthProvider>
  );
}

function LegacyRedirect() {
  const location = useLocation();
  return <Navigate to={`/app${location.pathname}${location.search}`} replace />;
}

function App() {
  return (
    <div className="App dark">
      <BrowserRouter>
        <AuthProvider>
          {/* Branded οθόνη εκκίνησης όσο εκκρεμεί το /auth/me (και το cold start) */}
          <StartupOverlay />
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<Landing />} />

            {/* Δημόσιος κατάλογος μενού ανά κατάστημα — χωρίς login */}
            <Route path="/menu/:slug" element={<PublicMenu />} />

            {/* OrderDeck admin — δικό του password gate, εκτός λογαριασμών μαγαζιών */}
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/shops" element={<AdminShops />} />
            <Route path="/admin/fleet" element={<AdminFleet />} />
            <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/promo" element={<AdminPromo />} />
            <Route path="/admin/announcements" element={<AdminAnnouncements />} />
            <Route path="/admin/stock-photos" element={<AdminStockPhotos />} />
            <Route path="/admin/admins" element={<AdminAdmins />} />

            {/* OrderDeck Fleet — εταιρείες διανομής (standalone) */}
            <Route path="/fleet/*" element={<FleetRoutes />} />

            {/* Auth */}
            <Route path="/app/login" element={<Login />} />
            <Route path="/app/register" element={<Register />} />
            <Route path="/app/select-profile" element={<ProfileSelect />} />

            {/* Cash PDA — not for waiters */}
            <Route
              path="/app"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]}>
                  <PDA />
                </ProtectedRoute>
              }
            />
            {/* Tables — all roles incl. Σερβιτόρος */}
            <Route
              path="/app/tables"
              element={
                <ProtectedRoute>
                  <Tables />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/tables/:tableId"
              element={
                <ProtectedRoute>
                  <TableOrder />
                </ProtectedRoute>
              }
            />
            {/* Owner + Υπεύθυνος */}
            <Route
              path="/app/menu"
              element={
                <ProtectedRoute roles={["owner", "manager"]} perm="menu">
                  <MenuManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/photos"
              element={
                <ProtectedRoute roles={["owner", "manager"]} perm="menu">
                  <Photos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/waiters"
              element={
                <ProtectedRoute roles={["owner", "manager"]}>
                  <Waiters />
                </ProtectedRoute>
              }
            />
            {/* Μόνο Ιδιοκτήτης */}
            <Route
              path="/app/day-close"
              element={
                <ProtectedRoute roles={["owner"]} perm="day_close">
                  <DayClose />
                </ProtectedRoute>
              }
            />
            {/* Owner + Υπεύθυνος + Υπάλληλος (όχι Σερβιτόρος) */}
            <Route
              path="/app/history"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]} perm="history">
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/stock"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]}>
                  <Stock />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/checklist"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]}>
                  <Checklist />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/schedule"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]}>
                  <Schedule />
                </ProtectedRoute>
              }
            />
            {/* Owner only */}
            <Route
              path="/app/deck"
              element={
                <ProtectedRoute requireOwner>
                  <DeckView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/deckpilot"
              element={
                <ProtectedRoute requireOwner requiresAI>
                  <DeckPilot />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/brief"
              element={
                <ProtectedRoute requireOwner requiresAI>
                  <DailyBrief />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analytics"
              element={
                <ProtectedRoute requireOwner perm="analytics">
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/expenses"
              element={
                <ProtectedRoute requireOwner perm="expenses">
                  <Expenses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/settings"
              element={
                <ProtectedRoute requireOwner perm="settings">
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Legacy top-level paths → /app/... */}
            {LEGACY_PATHS.map((p) => (
              <Route key={p} path={p} element={<LegacyRedirect />} />
            ))}
            <Route path="/tables/:tableId" element={<LegacyRedirect />} />

            <Route path="/app/*" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster theme="dark" position="top-center" richColors />
    </div>
  );
}

export default App;
