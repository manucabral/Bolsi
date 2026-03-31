import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  LineSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type MouseEventParams,
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

type HoverValues = {
  income: number;
  expense: number;
  balance: number;
};

function toSeriesNumber(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  if (!("value" in value)) return null;

  const numeric = Number((value as { value: unknown }).value);
  return Number.isFinite(numeric) ? numeric : null;
}

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
  const [hoverValues, setHoverValues] = useState<HoverValues | null>(null);

  const money = useMemo(
    () =>
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }),
    [],
  );

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
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const expenseSeries = chart.addSeries(LineSeries, {
      color: "#fb7185",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const balanceSeries = chart.addSeries(LineSeries, {
      color: "#60a5fa",
      lineWidth: 2,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      if (!param.time || !param.point) {
        setHoverValues(null);
        return;
      }

      const income =
        toSeriesNumber(param.seriesData.get(incomeSeries)) ?? 0;
      const expense =
        toSeriesNumber(param.seriesData.get(expenseSeries)) ?? 0;
      const balance =
        toSeriesNumber(param.seriesData.get(balanceSeries)) ?? 0;

      setHoverValues({ income, expense, balance });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

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
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      incomeSeriesRef.current = null;
      expenseSeriesRef.current = null;
      balanceSeriesRef.current = null;
      setHoverValues(null);
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
      {hoverValues ? (
        <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-violet-200/90">
          <span class="inline-flex items-center gap-1 rounded-full border border-teal-300/35 bg-teal-500/15 px-2 py-0.5">
            <span class="size-1.5 rounded-full bg-teal-300" /> Ingresos {money.format(hoverValues.income)}
          </span>
          <span class="inline-flex items-center gap-1 rounded-full border border-red-300/35 bg-red-500/15 px-2 py-0.5">
            <span class="size-1.5 rounded-full bg-red-300" /> Gastos {money.format(hoverValues.expense)}
          </span>
          <span class="inline-flex items-center gap-1 rounded-full border border-sky-300/35 bg-sky-500/15 px-2 py-0.5">
            <span class="size-1.5 rounded-full bg-sky-300" /> Balance {money.format(hoverValues.balance)}
          </span>
        </div>
      ) : null}
      <div ref={containerRef} class="h-[280px] w-full" />
    </div>
  );
}


