import React, { useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"
import { tokenStorage } from "./services/auth"
import { usePermissions } from "./hooks/usePermissions"

import Landing from "./components/Landing"
import Login from "./components/Login"
import Dashboard, { OverviewPanel } from "./components/Dashboard"
import { TendersPage } from "./components/tenders/TendersPage"
import { MasterSheetPage } from "./components/tenders/MasterSheetPage"
import { AddTenderPage } from "./components/tenders/AddTenderPage"
import { TenderDetailPage } from "./components/tenders/TenderDetailPage"
import { UserManagement } from "./components/admin/UserManagement"
import { BulkImportPage } from "./components/admin/BulkImportPage"
import { AlertsPage } from "./components/alerts/AlertsPage"
import { AnalyticsPage } from "./components/analytics/AnalyticsPage"

// Auth Guard to protect routes
function AuthGuard() {
  const hasToken = !!tokenStorage.getAccessToken()
  return hasToken ? <Outlet /> : <Navigate to="/login" replace />
}

// Guest Guard to redirect authenticated users away from Login/Landing
function GuestGuard() {
  const hasToken = !!tokenStorage.getAccessToken()
  return hasToken ? <Navigate to="/dashboard" replace /> : <Outlet />
}

// Permission Guard to enforce permissions on subroutes
function PermissionGuard({ permission, fallback = "/dashboard" }) {
  const { hasPermission } = usePermissions()
  return hasPermission(permission) ? <Outlet /> : <Navigate to={fallback} replace />
}

// Role Guard for routes gated on an exact role rather than a permission.
// Unlike hasPermission, this does not let ADMIN inherit SUPER_ADMIN routes.
function RoleGuard({ role, fallback = "/dashboard" }) {
  const { hasRole } = usePermissions()
  return hasRole(role) ? <Outlet /> : <Navigate to={fallback} replace />
}

export default function App() {
  // Sync token changes across tabs (e.g. logout)
  useEffect(() => {
    const handleStorageChange = () => {
      const hasToken = !!tokenStorage.getAccessToken()
      if (!hasToken && window.location.pathname.startsWith("/dashboard")) {
        window.location.href = "/login"
      }
    }
    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  return (
    <TooltipProvider>
      <Toaster richColors position="top-right" theme="dark" />
      <BrowserRouter>
        <Routes>
          {/* Guest only routes (Redirect to Dashboard if logged in) */}
          <Route element={<GuestGuard />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Landing is accessible to both guests and logged-in users */}
          <Route path="/" element={<Landing />} />

          {/* Authenticated routes */}
          <Route element={<AuthGuard />}>
            <Route path="/dashboard" element={<Dashboard />}>
              {/* Default sub-panel */}
              <Route index element={<OverviewPanel />} />

              {/* Tenders sub-routes */}
              <Route element={<PermissionGuard permission="bid.create" />}>
                <Route path="tenders/new" element={<AddTenderPage />} />
              </Route>

              <Route element={<PermissionGuard permission="bid.view" />}>
                <Route path="tenders" element={<TendersPage initialScope="all" />} />
                <Route path="tenders/owned" element={<TendersPage initialScope="owned" />} />
                <Route path="tenders/master" element={<MasterSheetPage />} />
                <Route path="tenders/:bidId" element={<TenderDetailPage />} />
                <Route path="alerts" element={<AlertsPage />} />
              </Route>

              {/* Analytics sub-routes */}
              <Route element={<PermissionGuard permission="bid.view" />}>
                <Route path="analytics" element={<Navigate to="/dashboard/analytics/tenders" replace />} />
                <Route path="analytics/tenders" element={<AnalyticsPage defaultTab="tender-analytics" />} />
                <Route path="analytics/performance-matrix" element={<AnalyticsPage defaultTab="owner-matrix" />} />
              </Route>

              {/* Admin sub-routes */}
              <Route element={<PermissionGuard permission="user.view" />}>
                <Route path="users" element={<UserManagement />} />
              </Route>

              <Route element={<RoleGuard role="SUPER_ADMIN" />}>
                <Route path="bulk-import" element={<BulkImportPage />} />
              </Route>

              {/* Redirect any other dashboard path to index */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>

          {/* Fallback for all other routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  )
}