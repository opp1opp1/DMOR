'use client';

import { createChart, ColorType, IChartApi, CandlestickSeries } from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';

interface ChartProps {
  symbol: string;
}

export const CryptoChart: React.FC<ChartProps> = ({ symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initial setup with container dimensions
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b', // slate-500
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', // tailwind green-500
      downColor: '#ef4444', // tailwind red-500
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Resize Observer to handle flexible parent containers
    const resizeObserver = new ResizeObserver((entries) => {
      if (!chartRef.current || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
      chartRef.current.timeScale().fitContent();
    });

    resizeObserver.observe(chartContainerRef.current);

    // Fetch data
    fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          candlestickSeries.setData(data);
          chart.timeScale().fitContent();
        }
      })
      .catch(err => console.error('Failed to load chart data', err));

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [symbol]);

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full h-full"
    />
  );
};
