import type { ComponentChildren } from "preact";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../../platform/auth/AuthProvider";
import { useAppVersion } from "../../../platform/app/useAppVersion";

type DashboardLayoutProps = {
  sectionTag: string;
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

export function DashboardLayout({
  sectionTag,
  title,
  subtitle,
  children,
}: DashboardLayoutProps) {
  const { logout } = useAuth();
  const appVersion = useAppVersion();

  return (
    <main class="mx-auto w-full max-w-[1200px] overflow-x-clip px-3 pb-6 pt-5 md:px-5 md:pb-8 lg:px-6">
      <section class="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside class="rounded-xl border border-violet-300/20 bg-[#16132b] p-3 lg:sticky lg:top-4 lg:flex lg:self-start lg:flex-col">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <img src="/logo.svg" alt="Bolsi" class="h-7 w-auto" />
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
            <span class="inline-flex items-center rounded-md border border-violet-300/25 bg-violet-900/25 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-violet-200">
              {sectionTag}
            </span>
            <h2 class="mt-2 text-2xl font-semibold text-violet-100 sm:text-3xl">
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
