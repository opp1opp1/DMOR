import 'dotenv/config'; // Load env vars first
import { getMarketSignals } from '../src/lib/market';

async function main() {
  // Ensure we are loading from .env.local specifically if not picked up by default
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });

  console.log('Testing Market Signals...');
  console.log('API Key available:', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);

  try {
    const result = await getMarketSignals('BTC/USDT');
    console.log('Success:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Failed:', error);
  }
}

main();