import { NextResponse } from 'next/server';
import { getMarketHistory } from '@/lib/market';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTC/USDT';
  const timeframe = searchParams.get('timeframe') || '4h';

  try {
    const data = await getMarketHistory(symbol, timeframe);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
