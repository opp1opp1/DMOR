'use client';

import { useEffect, useState } from 'react';
import { 
  RefreshCcw, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Target, 
  ShieldAlert, 
  LogIn, 
  Zap,
  Newspaper
} from 'lucide-react';

import { CryptoChart } from '@/components/CryptoChart';

interface Signal {
  symbol: string;
  price: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  timestamp: string;
  appliedNews?: string[];
  setup?: {
    entry: string;
    tp: string[];
    sl: string;
    leverage: string;
  };
}

const ACTION_MAP = {
  BUY: '做多 (LONG)',
  SELL: '做空 (SHORT)',
  HOLD: '觀望 (WAIT)',
};

export default function Home() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/signals');
      const data = await res.json();
      setSignals(data);
      setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
    } catch (error) {
      console.error('無法獲取訊號數據', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  return (
    <main className="min-h-screen p-4 md:p-8 w-full mx-auto bg-[#0a0a0a]">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2 font-mono">
            DMOR <span className="text-blue-500">PRO</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base font-medium">
            AI 驅動的高級加密貨幣交易決策系統
          </p>
        </div>
        <button
          onClick={fetchSignals}
          disabled={loading}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 font-bold tracking-wide"
        >
          <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'AI 計算策略中...' : '重新掃描市場'}
        </button>
      </header>

      {lastUpdated && (
        <div className="mb-8 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-xs text-gray-500 font-mono">
            SYSTEM_SYNC: {lastUpdated}
          </span>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(880px,1fr))] gap-6">
        {signals.map((signal) => (
          <SignalCard key={signal.symbol} signal={signal} />
        ))}
      </div>

      {signals.length === 0 && !loading && (
        <div className="text-center text-gray-500 mt-20 p-12 border border-dashed border-slate-800 rounded-lg">
          [NO_DATA] 無法連接至分析核心，請檢查網路。
        </div>
      )}
    </main>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const isBuy = signal.action === 'BUY';
  const isSell = signal.action === 'SELL';
  const isHold = signal.action === 'HOLD';
  
  let borderColor = 'border-slate-800';
  let bgColor = 'bg-slate-900/30';
  let textColor = 'text-slate-400';
  let actionBg = 'bg-slate-800';
  let Icon = Minus;

  if (isBuy) {
    borderColor = 'border-green-500/30';
    bgColor = 'bg-green-950/10';
    textColor = 'text-green-400';
    actionBg = 'bg-green-600';
    Icon = TrendingUp;
  } else if (isSell) {
    borderColor = 'border-red-500/30';
    bgColor = 'bg-red-950/10';
    textColor = 'text-red-400';
    actionBg = 'bg-red-600';
    Icon = TrendingDown;
  }

  return (
    <div className={`relative overflow-hidden group rounded-xl border ${borderColor} ${bgColor} transition-all hover:border-opacity-50 hover:shadow-2xl flex flex-col h-full`}>
      {/* 頂部標頭 */}
      <div className="p-4 border-b border-white/5 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-black text-white tracking-tight">{signal.symbol.split('/')[0]}</h2>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-white/5">PERP</span>
          </div>
          <div className="text-2xl font-mono font-bold text-white tracking-tight">
            ${signal.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded text-xs font-black tracking-wider text-white ${actionBg} shadow-lg`}>
          {ACTION_MAP[signal.action]}
        </div>
      </div>

      {/* 核心內容區 */}
      <div className="p-4 space-y-5 flex-grow">
        
        {/* 1. 分析理由 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-4 h-4 ${textColor}`} />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI 策略觀點</span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed font-medium">
            {signal.reason}
          </p>
        </div>

        {/* 2. 信心度 */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-wider font-bold">
            <span>Signal Confidence</span>
            <span>{signal.confidence}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${isBuy ? 'bg-green-500' : isSell ? 'bg-red-500' : 'bg-slate-600'}`}
              style={{ width: `${signal.confidence}%` }}
            />
          </div>
        </div>

        {/* 3. 具體交易計畫 (Setup) */}
        {!isHold && signal.setup && (
          <div className="bg-black/40 rounded-lg p-4 border border-white/5 space-y-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
               <div className="flex items-center gap-1.5 text-slate-500">
                  <LogIn className="w-3 h-3" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">進場</span>
                </div>
                <div className="text-sm font-mono text-white font-bold">{signal.setup.entry}</div>
            </div>

             <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Target className="w-3 h-3 text-green-500" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">止盈</span>
                </div>
                <div className="flex gap-1">
                  {signal.setup.tp.map((target, idx) => (
                    <span key={idx} className="text-xs font-mono text-green-400 font-bold">
                      {target}{idx < signal.setup.tp.length - 1 ? ',' : ''}
                    </span>
                  ))}
                </div>
            </div>

             <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <ShieldAlert className="w-3 h-3 text-red-500" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">止損</span>
                </div>
                <div className="text-sm font-mono text-red-400 font-bold">{signal.setup.sl}</div>
            </div>

            <div className="flex justify-between items-center pt-1">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">槓桿</span>
                </div>
                <div className="text-sm font-mono text-yellow-400 font-bold">{signal.setup.leverage}</div>
            </div>
          </div>
        )}

        {/* 4. K線圖 */}
        <div className="h-[200px] w-full border border-white/5 rounded-lg overflow-hidden relative bg-black/50">
           <CryptoChart symbol={signal.symbol} />
        </div>
      </div>

       {/* 5. 底部新聞區塊 (Full Width) */}
      {signal.appliedNews && signal.appliedNews.length > 0 && (
        <div className="mt-auto border-t border-white/5 bg-black/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">參考市場消息</span>
          </div>
          <ul className="space-y-2">
            {signal.appliedNews.map((news, idx) => (
              <li key={idx} className="text-xs text-gray-400 leading-normal flex items-start gap-2">
                 <span className="block mt-1.5 w-1 h-1 rounded-full bg-blue-500/50 flex-shrink-0"></span>
                 <span>{news.startsWith('- ') ? news.substring(2) : news}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}