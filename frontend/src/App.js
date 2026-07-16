import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import PDA from "@/pages/PDA";
import Analytics from "@/pages/Analytics";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import MenuManagement from "@/pages/MenuManagement";
import Stock from "@/pages/Stock";
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
import PublicMenu from "@/pages/PublicMenu";

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

function LegacyRedirect() {
  const location = useLocation();
  return <Navigate to={`/app${location.pathname}${location.search}`} replace />;
}

function App() {
  return (
    <div className="App dark">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<Landing />} />

            {/* Δημόσιος κατάλογος μενού ανά κατάστημα — χωρίς login */}
            <Route path="/menu/:slug" element={<PublicMenu />} />

            {/* OrderDeck admin — δικό του password gate, εκτός λογαριασμών μαγαζιών */}
            <Route path="/admin/promo" element={<AdminPromo />} />
            <Route path="/admin/stock-photos" element={<AdminStockPhotos />} />

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
                <ProtectedRoute roles={["owner", "manager"]}>
                  <MenuManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/photos"
              element={
                <ProtectedRoute roles={["owner", "manager"]}>
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
            {/* Owner + Υπεύθυνος + Υπάλληλος (όχι Σερβιτόρος) */}
            <Route
              path="/app/day-close"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]}>
                  <DayClose />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/history"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]}>
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
                <ProtectedRoute requireOwner>
                  <DeckPilot />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/brief"
              element={
                <ProtectedRoute requireOwner>
                  <DailyBrief />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analytics"
              element={
                <ProtectedRoute requireOwner>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/expenses"
              element={
                <ProtectedRoute requireOwner>
                  <Expenses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/settings"
              element={
                <ProtectedRoute requireOwner>
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
