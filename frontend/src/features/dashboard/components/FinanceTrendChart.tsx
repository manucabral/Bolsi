import { useEffect, useMemo, useRef } from "preact/hooks";
import {
  LineSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";

export type FinanceTrendPoint = {
  time: string;
  income: number;
  expense: number;
  balance: number;
};

type FinanceTrendChartProps = {
  data: FinanceTrendPoint[];
  onCaptureReady?: (capture: (() => string | null) | null) => void;
};

function toLineData(
  data: FinanceTrendPoint[],
  key: "income" | "expense" | "balance",
): LineData<Time>[] {
  return data.map((point) => ({
    time: point.time as Time,
    value: Number(point[key].toFixed(2)),
  }));
}

export function FinanceTrendChart({
  data,
  onCaptureReady,
}: FinanceTrendChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const incomeSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const expenseSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const balanceSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const lineData = useMemo(
    () => ({
      income: toLineData(data, "income"),
      expense: toLineData(data, "expense"),
      balance: toLineData(data, "balance"),
    }),
    [data],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 280,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(216, 180, 254, 0.88)",
        fontFamily: "Manrope, Segoe UI, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(139, 92, 246, 0.18)" },
        horzLines: { color: "rgba(139, 92, 246, 0.18)" },
      },
      rightPriceScale: {
        borderColor: "rgba(167, 139, 250, 0.26)",
      },
      timeScale: {
        borderColor: "rgba(167, 139, 250, 0.26)",
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: "rgba(192, 132, 252, 0.6)",
          labelBackgroundColor: "rgba(76, 29, 149, 0.92)",
        },
        horzLine: {
          color: "rgba(192, 132, 252, 0.4)",
          labelBackgroundColor: "rgba(76, 29, 149, 0.92)",
        },
      },
    });

    const incomeSeries = chart.addSeries(LineSeries, {
      color: "#34d399",
      lineWidth: 2,
      title: "Ingresos",
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const expenseSeries = chart.addSeries(LineSeries, {
      color: "#fb7185",
      lineWidth: 2,
      title: "Gastos",
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const balanceSeries = chart.addSeries(LineSeries, {
      color: "#60a5fa",
      lineWidth: 2,
      lineStyle: 2,
      title: "Balance",
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    incomeSeriesRef.current = incomeSeries;
    expenseSeriesRef.current = expenseSeries;
    balanceSeriesRef.current = balanceSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !chartRef.current) return;
      chartRef.current.applyOptions({ width: Math.floor(entry.contentRect.width) });
      chartRef.current.timeScale().fitContent();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      incomeSeriesRef.current = null;
      expenseSeriesRef.current = null;
      balanceSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!incomeSeriesRef.current || !expenseSeriesRef.current || !balanceSeriesRef.current) {
      return;
    }

    incomeSeriesRef.current.setData(lineData.income);
    expenseSeriesRef.current.setData(lineData.expense);
    balanceSeriesRef.current.setData(lineData.balance);
    chartRef.current?.timeScale().fitContent();
  }, [lineData]);

  useEffect(() => {
    if (!onCaptureReady) return;

    onCaptureReady(() => {
      const chart = chartRef.current;
      if (!chart) return null;
      return chart.takeScreenshot().toDataURL("image/png");
    });

    return () => {
      onCaptureReady(null);
    };
  }, [onCaptureReady]);

  return (
    <div class="w-full overflow-hidden">
      <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-violet-200/90">
        <span class="inline-flex items-center gap-1 rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-0.5">
          <span class="size-1.5 rounded-full bg-emerald-300" /> Ingresos
        </span>
        <span class="inline-flex items-center gap-1 rounded-full border border-rose-300/35 bg-rose-500/15 px-2 py-0.5">
          <span class="size-1.5 rounded-full bg-rose-300" /> Gastos
        </span>
        <span class="inline-flex items-center gap-1 rounded-full border border-sky-300/35 bg-sky-500/15 px-2 py-0.5">
          <span class="size-1.5 rounded-full bg-sky-300" /> Balance
        </span>
      </div>
      <div ref={containerRef} class="h-[280px] w-full" />
    </div>
  );
}
