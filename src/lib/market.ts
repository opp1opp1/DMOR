import ccxt from 'ccxt';
import { RSI, SMA } from 'technicalindicators';
import { getDecisionFromLLM } from './llm';
import { getNewsContext, formatNewsForDisplay, formatNewsForAI } from './news';

// Initialize exchange (using Binance public API for now, no keys needed for public data)
const exchange = new ccxt.binance({
  enableRateLimit: true,
});

export interface MarketSignal {
  symbol: string;
  price: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  reason: string;
  timestamp: string;
  appliedNews?: string[]; // The news headlines AI considered
  setup?: {
    entry: string;
    tp: string[];
    sl: string;
    leverage: string;
  };
}

export interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export async function getMarketHistory(symbol: string = 'BTC/USDT', timeframe: string = '4h', limit: number = 100): Promise<CandleData[]> {
  try {
    const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    
    return ohlcv.map(candle => ({
      time: Math.floor((candle[0] || 0) / 1000), // Convert ms to seconds for lightweight-charts
      open: (candle[1] || 0) as number,
      high: (candle[2] || 0) as number,
      low: (candle[3] || 0) as number,
      close: (candle[4] || 0) as number,
    })).filter(c => c.time > 0).sort((a, b) => a.time - b.time); // Ensure sorted by time
  } catch (error) {
    console.error(`Error fetching history for ${symbol}:`, error);
    return [];
  }
}

export async function getMarketSignals(symbol: string = 'BTC/USDT'): Promise<MarketSignal> {
  try {
    // Fetch OHLCV (Open, High, Low, Close, Volume) data
    // Timeframe: 4h for trend
    const ohlcv = await exchange.fetchOHLCV(symbol, '4h', undefined, 100);
    
    if (!ohlcv || ohlcv.length < 20) {
      throw new Error('Insufficient data');
    }

    // Extract closing prices and ensure they are numbers
    const closes: number[] = ohlcv
        .map(candle => candle[4])
        .filter((price): price is number => typeof price === 'number');

    if (closes.length < 20) {
      throw new Error('Insufficient clean data');
    }

    const currentPrice = closes[closes.length - 1];

    // Calculate Indicators
    const rsiInput = {
      values: closes,
      period: 14
    };
    const rsiValues = RSI.calculate(rsiInput);
    const currentRSI = rsiValues[rsiValues.length - 1];

    const sma20Input = {
      values: closes,
      period: 20
    };
    const sma20Values = SMA.calculate(sma20Input);
    const currentSMA = sma20Values[sma20Values.length - 1];

    // Fetch News (Contextual & General)
    const newsItems = await getNewsContext(symbol, 5);
    const formattedNewsForAI = formatNewsForAI(newsItems);
    
    // AI Decision Logic
    const technicalData = {
      rsi: currentRSI,
      sma: currentSMA,
      recentCloses: closes.slice(-5)
    };

    const aiDecision = await getDecisionFromLLM(symbol, currentPrice, technicalData, formattedNewsForAI);

    return {
      symbol,
      price: currentPrice,
      action: aiDecision?.action || 'HOLD',
      confidence: aiDecision?.confidence || 0,
      reason: aiDecision?.reason || 'AI Analysis Failed',
      timestamp: new Date().toISOString(),
      appliedNews: formatNewsForDisplay(newsItems),
      setup: aiDecision?.setup
    };

  } catch (error) {
    console.error(`Error fetching market data for ${symbol}:`, error);
    return {
      symbol,
      price: 0,
      action: 'HOLD',
      confidence: 0,
      reason: '數據獲取失敗',
      timestamp: new Date().toISOString(),
    };
  }
}
