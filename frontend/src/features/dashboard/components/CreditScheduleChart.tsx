import { useEffect, useMemo, useRef } from "preact/hooks";
import {
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";

export type CreditSchedulePoint = {
  time: string;
  amount: number;
  installments: number;
};

type CreditScheduleChartProps = {
  data: CreditSchedulePoint[];
};

function toAmountData(data: CreditSchedulePoint[]): HistogramData<Time>[] {
  return data.map((point) => ({
    time: point.time as Time,
    value: Number(point.amount.toFixed(2)),
    color:
      point.amount > 0
        ? "rgba(129, 140, 248, 0.65)"
        : "rgba(139, 92, 246, 0.22)",
  }));
}

function toInstallmentsData(data: CreditSchedulePoint[]): LineData<Time>[] {
  return data.map((point) => ({
    time: point.time as Time,
    value: Number(point.installments.toFixed(0)),
  }));
}

export function CreditScheduleChart({ data }: CreditScheduleChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const amountSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const installmentsSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const chartData = useMemo(
    () => ({
      amount: toAmountData(data),
      installments: toInstallmentsData(data),
    }),
    [data],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 260,
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
      leftPriceScale: {
        visible: true,
        borderColor: "rgba(167, 139, 250, 0.2)",
      },
      timeScale: {
        borderColor: "rgba(167, 139, 250, 0.26)",
        timeVisible: false,
        secondsVisible: false,
      },
      localization: {
        locale: "es-AR",
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

    const amountSeries = chart.addSeries(HistogramSeries, {
      title: "Monto estimado",
      priceLineVisible: false,
      lastValueVisible: true,
      priceScaleId: "right",
    });

    const installmentsSeries = chart.addSeries(LineSeries, {
      title: "Cuotas",
      color: "#f0abfc",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceScaleId: "left",
    });

    chartRef.current = chart;
    amountSeriesRef.current = amountSeries;
    installmentsSeriesRef.current = installmentsSeries;

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
      amountSeriesRef.current = null;
      installmentsSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!amountSeriesRef.current || !installmentsSeriesRef.current) return;

    amountSeriesRef.current.setData(chartData.amount);
    installmentsSeriesRef.current.setData(chartData.installments);
    chartRef.current?.timeScale().fitContent();
  }, [chartData]);

  return (
    <div class="w-full overflow-hidden">
      <div class="mb-1 flex items-center justify-between text-[11px] font-medium text-violet-300/90">
        <span>Izq: Cantidad</span>
        <span>Der: Monto $</span>
      </div>
      <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-violet-200/90">
        <span class="inline-flex items-center gap-1 rounded-full border border-indigo-300/35 bg-indigo-500/15 px-2 py-0.5">
          <span class="size-1.5 rounded-full bg-indigo-300" /> Monto mensual
        </span>
        <span class="inline-flex items-center gap-1 rounded-full border border-red-300/35 bg-red-500/15 px-2 py-0.5">
          <span class="size-1.5 rounded-full bg-red-300" /> Cantidad de cuotas
        </span>
      </div>
      <div ref={containerRef} class="h-[260px] w-full" />
    </div>
  );
}

