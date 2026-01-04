import { NextResponse } from 'next/server';
import { getMarketSignals } from '@/lib/market';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedSymbol = searchParams.get('symbol');

  if (requestedSymbol) {
    const signal = await getMarketSignals(requestedSymbol);
    return NextResponse.json([signal]);
  }

  // Default watchlist
  const watchlist = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
  
  const signals = await Promise.all(
    watchlist.map(symbol => getMarketSignals(symbol))
  );

  return NextResponse.json(signals);
}
