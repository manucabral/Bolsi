import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ComponentChildren } from "preact";
import { Layout } from "../../layout.tsx";
import { LoginPage } from "../../features/auth/pages/LoginPage.tsx";
import { RegisterPage } from "../../features/auth/pages/RegisterPage.tsx";
import { DashboardPage } from "../../features/dashboard/pages/DashboardPage.tsx";
import { TransactionsPage } from "../../features/dashboard/pages/TransactionsPage.tsx";
import { CreditsPage } from "../../features/dashboard/pages/CreditsPage.tsx";
import { BillsPage } from "../../features/dashboard/pages/BillsPage.tsx";
import { GoalsPage } from "../../features/dashboard/pages/GoalsPage.tsx";
import { CategoriesPage } from "../../features/dashboard/pages/CategoriesPage.tsx";
import { NotesPage } from "../../features/dashboard/pages/NotesPage.tsx";
import { SettingsPage } from "../../features/dashboard/pages/SettingsPage.tsx";
import { ExportsPage } from "../../features/dashboard/pages/ExportsPage.tsx";
import { AuthProvider, useAuth } from "../auth/AuthProvider.tsx";
import { Toaster } from "sonner";

function AuthLoading() {
  return (
    <main class="mx-auto flex min-h-screen w-full max-w-[1060px] items-center justify-center px-4 py-6">
      <p class="rounded-xl border border-violet-300/35 bg-black/45 px-5 py-3 text-sm text-violet-100 shadow-[0_12px_30px_rgba(10,8,24,0.45)]">
        Cargando...
      </p>
    </main>
  );
}

function GuestOnly({ children }: { children: ComponentChildren }) {
  const { status } = useAuth();

  if (status === "loading") return <AuthLoading />;
  if (status === "authenticated") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function ProtectedOnly({ children }: { children: ComponentChildren }) {
  const { status } = useAuth();

  if (status === "loading") return <AuthLoading />;
  if (status === "anonymous") return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export function AppRouter() {
  return (
    <HashRouter>
      <AuthProvider>
        <Toaster
          richColors
          position="top-center"
          closeButton
          expand
          visibleToasts={4}
          offset={18}
          toastOptions={{
            duration: 3600,
            classNames: {
              toast: "bolsi-toast",
              title: "bolsi-toast-title",
              description: "bolsi-toast-description",
              success: "bolsi-toast-success",
              error: "bolsi-toast-error",
              actionButton: "bolsi-toast-action-button",
              cancelButton: "bolsi-toast-cancel-button",
              closeButton: "bolsi-toast-close-button",
            },
          }}
        />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/login" replace />} />
            <Route
              path="login"
              element={
                <GuestOnly>
                  <LoginPage />
                </GuestOnly>
              }
            />
            <Route
              path="register"
              element={
                <GuestOnly>
                  <RegisterPage />
                </GuestOnly>
              }
            />
            <Route
              path="dashboard"
              element={
                <ProtectedOnly>
                  <DashboardPage />
                </ProtectedOnly>
              }
            />
            <Route
              path="dashboard/transactions"
              element={
                <ProtectedOnly>
                  <TransactionsPage />
                </ProtectedOnly>
              }
            />
            <Route
              path="dashboard/credits"
              element={
                <ProtectedOnly>
                  <CreditsPage />
                </ProtectedOnly>
              }
            />
            <Route
              path="dashboard/bills"
              element={
                <ProtectedOnly>
                  <BillsPage />
                </ProtectedOnly>
              }
            />
            <Route
              path="dashboard/goals"
              element={
                <ProtectedOnly>
                  <GoalsPage />
                </ProtectedOnly>
              }
            />
            <Route
              path="dashboard/categories"
              element={
                <ProtectedOnly>
                  <CategoriesPage />
                </ProtectedOnly>
              }
            />
            <Route
              path="dashboard/notes"
              element={
                <ProtectedOnly>
                  <NotesPage />
                </ProtectedOnly>
              }
            />
            <Route
              path="dashboard/settings"
              element={
                <ProtectedOnly>
                  <SettingsPage />
                </ProtectedOnly>
              }
            />
            <Route
              path="dashboard/exports"
              element={
                <ProtectedOnly>
                  <ExportsPage />
                </ProtectedOnly>
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
