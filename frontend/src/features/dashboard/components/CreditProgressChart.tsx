type CreditProgressChartProps = {
  paidAmount: number;
  pendingAmount: number;
  paidInstallments: number;
  pendingInstallments: number;
  formatAmount: (value: number) => string;
};

export function CreditProgressChart({
  paidAmount,
  pendingAmount,
  paidInstallments,
  pendingInstallments,
  formatAmount,
}: CreditProgressChartProps) {
  const totalAmount = paidAmount + pendingAmount;
  const paidRatio = totalAmount > 0 ? paidAmount / totalAmount : 0;
  const percentPaid = Math.round(paidRatio * 100);

  const radius = 62;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const dashOffset = circumference * (1 - paidRatio);

  return (
    <div class="rounded-2xl border border-violet-300/25 bg-black/30 p-4">
      <header>
        <h3 class="text-base font-semibold text-violet-100">Progreso total</h3>
        <p class="text-xs text-violet-300/85">
          Avance acumulado de cuotas pagadas versus pendientes.
        </p>
      </header>

      <div class="mt-4 grid items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div class="mx-auto">
          <svg viewBox="0 0 140 140" class="h-40 w-40">
            <circle
              cx="70"
              cy="70"
              r={normalizedRadius}
              fill="none"
              stroke="rgba(109, 40, 217, 0.32)"
              stroke-width={strokeWidth}
            />
            <circle
              cx="70"
              cy="70"
              r={normalizedRadius}
              fill="none"
              stroke="url(#credit-progress-gradient)"
              stroke-width={strokeWidth}
              stroke-linecap="round"
              stroke-dasharray={circumference}
              stroke-dashoffset={dashOffset}
              transform="rotate(-90 70 70)"
            />
            <defs>
              <linearGradient id="credit-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#60a5fa" />
              </linearGradient>
            </defs>
            <text
              x="70"
              y="66"
              text-anchor="middle"
              class="fill-violet-100 text-3xl font-bold"
            >
              {percentPaid}%
            </text>
            <text
              x="70"
              y="84"
              text-anchor="middle"
              class="fill-violet-300 text-[10px] uppercase tracking-[0.08em]"
            >
              pagado
            </text>
          </svg>
        </div>

        <div class="grid gap-2">
          <article class="rounded-lg border border-teal-300/30 bg-teal-500/10 px-3 py-2">
            <p class="text-[11px] uppercase tracking-[0.08em] text-teal-200/90">
              Pagado
            </p>
            <p class="mt-1 text-sm font-semibold text-teal-200">
              {formatAmount(paidAmount)}
            </p>
            <p class="text-xs text-teal-100/90">{paidInstallments} cuotas</p>
          </article>

          <article class="rounded-lg border border-sky-300/30 bg-sky-500/10 px-3 py-2">
            <p class="text-[11px] uppercase tracking-[0.08em] text-sky-200/90">
              Pendiente
            </p>
            <p class="mt-1 text-sm font-semibold text-sky-200">
              {formatAmount(pendingAmount)}
            </p>
            <p class="text-xs text-sky-100/90">{pendingInstallments} cuotas</p>
          </article>

          <article class="rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
              Monto total
            </p>
            <p class="mt-1 text-sm font-semibold text-violet-100">
              {formatAmount(totalAmount)}
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}

