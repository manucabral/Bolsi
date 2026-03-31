import type { ComponentChildren } from "preact";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../../platform/auth/AuthProvider";
import { useAppVersion } from "../../../platform/app/useAppVersion";

type DashboardLayoutProps = {
  title: string;
  subtitle: string;
  children: ComponentChildren;
};

type SidebarNavLinkProps = {
  to: string;
  label: string;
  icon: ComponentChildren;
  end?: boolean;
};

const navLinkBaseClass =
  "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors";
const navLinkInactiveClass =
  "text-violet-200/85 hover:bg-violet-900/35 hover:text-violet-100";
const navLinkActiveClass =
  "bg-violet-700/35 text-violet-50";

function SidebarNavLink({ to, label, icon, end = false }: SidebarNavLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          navLinkBaseClass,
          isActive ? navLinkActiveClass : navLinkInactiveClass,
        ].join(" ")
      }
    >
      <span
        class="inline-flex size-[1.05rem] items-center justify-center text-violet-300"
        aria-hidden="true"
      >
        {icon}
      </span>
      {label}
    </NavLink>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5.5v-6h-5V21H4a1 1 0 0 1-1-1V9.5Z" />
    </svg>
  );
}

function TransactionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 7h13" />
      <path d="m14 4 3 3-3 3" />
      <path d="M20 17H7" />
      <path d="m10 14-3 3 3 3" />
    </svg>
  );
}

function CreditsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

function BillsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M7 4h10l3 3v13H7z" />
      <path d="M17 4v3h3" />
      <path d="M10 12h7" />
      <path d="M10 16h7" />
      <path d="M4 8v10a2 2 0 0 0 2 2h1" />
    </svg>
  );
}

function GoalsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 8v4l3 2" />
      <path d="M14.5 3.5h6v6" />
      <path d="m20.5 3.5-6.8 6.8" />
    </svg>
  );
}

function CategoriesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M6 3h9l5 5v13H6z" />
      <path d="M15 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 4v10" />
      <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function greetingByHour(username: string) {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return `Buenos dias, ${username}`;
  }

  if (hour >= 12 && hour < 19) {
    return `Buenas tardes, ${username}`;
  }

  return `Buenas noches, ${username}`;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardLayout({
  title,
  subtitle,
  children,
}: DashboardLayoutProps) {
  const {
    logout,
    session,
    startupSummary,
    isStartupSummaryVisible,
    dismissStartupSummary,
  } = useAuth();
  const navigate = useNavigate();
  const appVersion = useAppVersion();
  const username = session?.username ?? "Usuario";

  return (
    <main class="mx-auto w-full max-w-[1200px] overflow-x-clip px-3 pb-6 pt-5 md:px-5 md:pb-8 lg:px-6">
      {isStartupSummaryVisible && startupSummary ? (
        <div class="fixed inset-0 z-50 flex items-center justify-center px-3">
          <button
            type="button"
            onClick={dismissStartupSummary}
            class="absolute inset-0 bg-black/60"
            aria-label="Cerrar resumen"
          />

          <article class="relative z-10 w-full max-w-xl rounded-2xl border border-violet-300/35 bg-[#18152f] p-5 shadow-[0_24px_48px_rgba(5,4,18,0.55)]">
            <h3 class="text-xl font-semibold text-violet-100">
              {greetingByHour(username)}
            </h3>
            <p class="mt-1 text-sm text-violet-200/80">Este mes:</p>

            <div class="mt-3 space-y-1.5 text-sm text-violet-100">
              <p>
                - {startupSummary.pending_bills_count} facturas pendientes por{" "}
                {formatMoney(startupSummary.pending_bills_amount)}
              </p>
              <p>
                - {formatMoney(startupSummary.monthly_credit_due_amount)} en cuotas a pagar
              </p>
              <p>
                - Balance actual: {formatMoney(startupSummary.current_balance)}
              </p>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  dismissStartupSummary();
                  navigate("/dashboard");
                }}
                class="rounded-md border border-violet-300/35 bg-violet-800/45 px-3 py-2 text-sm font-medium text-violet-50 transition hover:bg-violet-700/60"
              >
                Ver detalle
              </button>
              <button
                type="button"
                onClick={dismissStartupSummary}
                class="rounded-md border border-violet-300/25 bg-black/25 px-3 py-2 text-sm font-medium text-violet-200 transition hover:bg-black/40"
              >
                Cerrar
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <section class="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside class="rounded-xl border border-violet-300/20 bg-[#16132b] p-3 lg:sticky lg:top-4 lg:flex lg:self-start lg:flex-col">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <img src="/logo.svg" alt="Bolsi" class="h-7 w-auto" />
              <span class="text-base font-semibold tracking-[0.03em] text-violet-100">
                Bolsi
              </span>
            </div>
          </div>

          <nav class="mt-4 grid gap-3 text-sm text-violet-200/85">
            <div class="grid gap-1">
              <SidebarNavLink
                to="/dashboard"
                label="Dashboard"
                icon={<DashboardIcon />}
                end
              />
            </div>

            <div class="grid gap-1.5 pt-1">
              <p class="px-1 text-[10px] uppercase tracking-[0.1em] text-violet-300/70">
                Finanzas
              </p>
              <div class="grid gap-1">
                <SidebarNavLink
                  to="/dashboard/transactions"
                  label="Transacciones"
                  icon={<TransactionsIcon />}
                />
                <SidebarNavLink
                  to="/dashboard/credits"
                  label="Creditos"
                  icon={<CreditsIcon />}
                />
                <SidebarNavLink
                  to="/dashboard/bills"
                  label="Facturas"
                  icon={<BillsIcon />}
                />
                <SidebarNavLink
                  to="/dashboard/goals"
                  label="Metas"
                  icon={<GoalsIcon />}
                />
                <SidebarNavLink
                  to="/dashboard/categories"
                  label="Categorias"
                  icon={<CategoriesIcon />}
                />
              </div>
            </div>

            <div class="grid gap-1.5 pt-1">
              <p class="px-1 text-[10px] uppercase tracking-[0.1em] text-violet-300/70">
                Organizacion
              </p>
              <div class="grid gap-1">
                <SidebarNavLink
                  to="/dashboard/notes"
                  label="Notas"
                  icon={<NotesIcon />}
                />
              </div>
            </div>

            <div class="grid gap-1.5 pt-1">
              <p class="px-1 text-[10px] uppercase tracking-[0.1em] text-violet-300/70">
                Sistema
              </p>
              <div class="grid gap-1">
                <SidebarNavLink
                  to="/dashboard/settings"
                  label="Configuracion"
                  icon={<SettingsIcon />}
                />
                <SidebarNavLink
                  to="/dashboard/exports"
                  label="Exportar"
                  icon={<ExportIcon />}
                />
              </div>
            </div>
          </nav>

          <div class="mt-6 border-t border-violet-300/15 pt-4 lg:mt-auto">
            <button
              type="button"
              onClick={() => void logout()}
              class="w-full rounded-md border border-violet-300/25 bg-violet-900/20 px-3 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-900/35"
            >
              Cerrar sesion
            </button>

            {appVersion ? (
              <p class="mt-2 text-center text-[10px] tracking-[0.08em] text-violet-300/70">
                Version {appVersion}
              </p>
            ) : null}
          </div>
        </aside>

        <section class="min-w-0 flex flex-col gap-3">
          <div class="min-w-0 overflow-hidden rounded-xl border border-violet-300/20 bg-[#151428] p-4 md:p-5 lg:p-6">
            <h2 class="text-2xl font-semibold text-violet-100 sm:text-3xl">
              {title}
            </h2>
            <p class="mt-1 max-w-2xl text-sm text-violet-200/85">{subtitle}</p>

            <div class="mt-4 min-w-0">{children}</div>
          </div>
        </section>
      </section>
    </main>
  );
}
