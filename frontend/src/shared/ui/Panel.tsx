import type { ComponentChildren } from "preact";
import { useAppVersion } from "../../platform/app/useAppVersion";

interface PanelProps {
  title: string;
  subtitle?: string;
  children: ComponentChildren;
  showVersionInHeader?: boolean;
}

export function Panel({ title, subtitle, children, showVersionInHeader = true }: PanelProps) {
  const appVersion = useAppVersion();

  return (
    <section class="w-full overflow-hidden rounded-[1.35rem] border border-violet-300/30 bg-[linear-gradient(155deg,rgba(12,12,32,0.95),rgba(16,14,40,0.92))] shadow-[0_28px_50px_rgba(6,6,20,0.58)] md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside class="relative hidden p-8 md:block">
        <div
          class="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 10% 10%, rgba(215, 76, 255, 0.26), transparent 38%), radial-gradient(circle at 88% 75%, rgba(80, 182, 255, 0.24), transparent 40%), linear-gradient(165deg, rgba(18, 15, 42, 0.94), rgba(12, 13, 32, 0.9))",
          }}
        />
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(165,148,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(165,148,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />

        <div class="relative z-10">
          <img src="/logo.svg" alt="Bolsi" class="h-10 w-auto" />
          <p class="mt-4 max-w-xs text-sm leading-relaxed text-violet-100/90">
            Finanzas simples y privadas.
          </p>

          <div class="mt-8 grid gap-3">
            <p class="flex items-center gap-2.5 text-[0.92rem] text-violet-100/90">
              <span class="size-[0.55rem] rounded-full bg-[linear-gradient(120deg,#6f57ff,#d74cff,#50b6ff)] shadow-[0_0_0_4px_rgba(144,112,255,0.2)]" />
              Seguimiento de transacciones.
            </p>
            <p class="flex items-center gap-2.5 text-[0.92rem] text-violet-100/90">
              <span class="size-[0.55rem] rounded-full bg-[linear-gradient(120deg,#6f57ff,#d74cff,#50b6ff)] shadow-[0_0_0_4px_rgba(144,112,255,0.2)]" />
              Historial de creditos y cuotas.
            </p>
            <p class="flex items-center gap-2.5 text-[0.92rem] text-violet-100/90">
              <span class="size-[0.55rem] rounded-full bg-[linear-gradient(120deg,#6f57ff,#d74cff,#50b6ff)] shadow-[0_0_0_4px_rgba(144,112,255,0.2)]" />
              Exportacion a CSV y PDF.
            </p>
            <p class="flex items-center gap-2.5 text-[0.92rem] text-violet-100/90">
              <span class="size-[0.55rem] rounded-full bg-[linear-gradient(120deg,#6f57ff,#d74cff,#50b6ff)] shadow-[0_0_0_4px_rgba(144,112,255,0.2)]" />
              Datos locales y privados, sin conexion a internet.
            </p>
          </div>

          {appVersion ? (
            <p class="mt-6 text-xs uppercase tracking-[0.08em] text-violet-300/85">
              Version {appVersion}
            </p>
          ) : null}
        </div>
      </aside>

      <div class="bg-[linear-gradient(180deg,rgba(15,15,38,0.95),rgba(11,10,29,0.95))] p-6 sm:p-7">
        <header class="mb-6 border-b border-violet-300/20 pb-4">
          <img src="/logo.svg" alt="Bolsi" class="mb-3 h-8 w-auto md:hidden" />
          <h1 class="text-2xl font-bold tracking-[-0.02em] text-violet-100 [font-family:'Sora','Segoe_UI',sans-serif]">
            {title}
          </h1>
          {subtitle ? (
            <p class="mt-1 text-sm text-violet-200/85">{subtitle}</p>
          ) : null}
          {appVersion && showVersionInHeader ? (
            <p class="mt-3 text-[11px] uppercase tracking-[0.08em] text-violet-300/75">
              Version {appVersion}
            </p>
          ) : null}
        </header>
        <div class="space-y-4">{children}</div>
      </div>
    </section>
  );
}
