type MonthlyCompositionChartProps = {
  income: number;
  expense: number;
  formatAmount: (value: number) => string;
};

export function MonthlyCompositionChart({
  income,
  expense,
  formatAmount,
}: MonthlyCompositionChartProps) {
  const total = income + expense;
  const incomeShare = total > 0 ? income / total : 0;
  const expenseShare = total > 0 ? expense / total : 0;
  const incomePercent = Math.round(incomeShare * 100);
  const expensePercent = Math.round(expenseShare * 100);

  const ringStyle = {
    background:
      total > 0
        ? `conic-gradient(#34d399 0 ${incomeShare * 360}deg, #fb7185 ${incomeShare * 360}deg 360deg)`
        : "conic-gradient(rgba(109,40,217,0.35) 0 360deg)",
  };

  return (
    <div class="rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
      <header>
        <p class="text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">
          Composicion del mes
        </p>
        <p class="text-xs text-violet-300/80">
          Proporcion entre ingresos y gastos del mes actual.
        </p>
      </header>

      <div class="mt-4 grid items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div class="mx-auto grid place-items-center">
          <div
            class="relative h-40 w-40 rounded-full"
            style={ringStyle}
            aria-label="Grafico de composicion mensual"
          >
            <div class="absolute inset-[18%] grid place-items-center rounded-full bg-[#151428] text-center">
              <p class="text-[10px] uppercase tracking-[0.08em] text-violet-300/85">
                Total
              </p>
              <p class="mt-0.5 text-sm font-semibold text-violet-100">
                {formatAmount(total)}
              </p>
            </div>
          </div>
        </div>

        <div class="grid gap-2">
          <article class="rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-3 py-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-[11px] uppercase tracking-[0.08em] text-emerald-200/90">
                Ingresos
              </p>
              <p class="text-xs font-semibold text-emerald-100">{incomePercent}%</p>
            </div>
            <p class="mt-1 text-sm font-semibold text-emerald-200">
              {formatAmount(income)}
            </p>
          </article>

          <article class="rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 py-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-[11px] uppercase tracking-[0.08em] text-rose-200/90">
                Gastos
              </p>
              <p class="text-xs font-semibold text-rose-100">{expensePercent}%</p>
            </div>
            <p class="mt-1 text-sm font-semibold text-rose-200">
              {formatAmount(expense)}
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
