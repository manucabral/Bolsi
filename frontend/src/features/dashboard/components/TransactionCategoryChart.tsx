import type { BackendTransactionType } from "../../../platform/pywebview/transactions.api.types";

export type TransactionCategoryPoint = {
  label: string;
  type: BackendTransactionType;
  amount: number;
  share: number;
};

type TransactionCategoryChartProps = {
  data: TransactionCategoryPoint[];
  formatAmount: (value: number) => string;
};

function categoryTypeLabel(type: BackendTransactionType) {
  return type === "income" ? "Ingreso" : "Gasto";
}

export function TransactionCategoryChart({
  data,
  formatAmount,
}: TransactionCategoryChartProps) {
  const useVerticalScroll = data.length > 4;

  return (
    <div
      class={[
        "space-y-2.5",
        useVerticalScroll ? "max-h-[22rem] overflow-y-auto pr-1" : "",
      ].join(" ")}
    >
      {data.map((item) => (
        <article
          key={`${item.type}-${item.label}`}
          class="rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2.5"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-semibold text-violet-100">{item.label}</p>
              <p
                class={[
                  "text-[11px] uppercase tracking-[0.08em]",
                  item.type === "income" ? "text-teal-200/95" : "text-red-200/95",
                ].join(" ")}
              >
                {categoryTypeLabel(item.type)}
              </p>
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold text-violet-100">
                {formatAmount(item.amount)}
              </p>
              <p class="text-[11px] text-violet-300/90">{item.share.toFixed(1)}%</p>
            </div>
          </div>

          <div class="mt-2 h-2 overflow-hidden rounded-full bg-violet-900/45">
            <div
              class={[
                "h-full rounded-full",
                item.type === "income"
                  ? "bg-linear-to-r from-teal-400 to-teal-300"
                  : "bg-linear-to-r from-red-400 to-red-300",
              ].join(" ")}
              style={{ width: `${Math.max(item.share, 3)}%` }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}


