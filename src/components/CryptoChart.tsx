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

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d5db', // tailwind gray-300
      },
      grid: {
        vertLines: { color: '#374151' }, // tailwind gray-700
        horzLines: { color: '#374151' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
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

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

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
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol]);

  return (
    <div className="w-full p-4 bg-gray-900 rounded-xl border border-gray-800 shadow-xl">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">{symbol} Chart</h3>
        <span className="text-xs text-gray-500">4H Timeframe</span>
      </div>
      <div 
        ref={chartContainerRef} 
        className="w-full h-[400px]"
      />
    </div>
  );
};
