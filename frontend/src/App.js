import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import Waiters from "@/pages/Waiters";

function App() {
  return (
    <div className="App dark">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/select-profile" element={<ProfileSelect />} />
            {/* All selected profiles (incl. Σερβιτόρος) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <PDA />
                </ProtectedRoute>
              }
            />
            {/* Owner + Υπεύθυνος */}
            <Route
              path="/menu"
              element={
                <ProtectedRoute roles={["owner", "manager"]}>
                  <MenuManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/photos"
              element={
                <ProtectedRoute roles={["owner", "manager"]}>
                  <Photos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/waiters"
              element={
                <ProtectedRoute roles={["owner", "manager"]}>
                  <Waiters />
                </ProtectedRoute>
              }
            />
            {/* Owner + Υπεύθυνος + Υπάλληλος (όχι Σερβιτόρος) */}
            <Route
              path="/day-close"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]}>
                  <DayClose />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]}>
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]}>
                  <Stock />
                </ProtectedRoute>
              }
            />
            <Route
              path="/schedule"
              element={
                <ProtectedRoute roles={["owner", "manager", "employee"]}>
                  <Schedule />
                </ProtectedRoute>
              }
            />
            {/* Owner only */}
            <Route
              path="/analytics"
              element={
                <ProtectedRoute requireOwner>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute requireOwner>
                  <Expenses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requireOwner>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster theme="dark" position="top-center" richColors />
    </div>
  );
}

export default App;
