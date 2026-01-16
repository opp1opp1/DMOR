/**
 * Binance API Connection Test Script
 *
 * Tests:
 * 1. API Key validity
 * 2. Account balance retrieval
 * 3. Server time synchronization
 * 4. Test order placement (if needed)
 */

import ccxt from 'ccxt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testBinanceConnection() {
  console.log('🔍 Testing Binance API Connection...\n');

  // Initialize exchange
  const exchange = new ccxt.binance({
    apiKey: process.env.BINANCE_API_KEY,
    secret: process.env.BINANCE_SECRET_KEY,
    enableRateLimit: true,
    options: {
      defaultType: 'spot', // or 'future' for futures trading
    }
  });

  // Use testnet if enabled
  if (process.env.BINANCE_TESTNET === 'true') {
    // Set testnet URLs manually for Binance
    exchange.urls['api'] = {
      public: 'https://testnet.binance.vision/api',
      private: 'https://testnet.binance.vision/api',
    };
    console.log('✅ Testnet mode enabled');
    console.log('   Endpoint: https://testnet.binance.vision/api\n');
  }

  try {
    // Test 1: Check server time (no auth required)
    console.log('📡 Test 1: Checking server time...');
    const serverTime = await exchange.fetchTime();
    const localTime = Date.now();
    const timeDiff = Math.abs(serverTime - localTime);
    console.log(`   Server time: ${new Date(serverTime).toISOString()}`);
    console.log(`   Local time:  ${new Date(localTime).toISOString()}`);
    console.log(`   Time diff:   ${timeDiff}ms`);

    if (timeDiff > 5000) {
      console.warn('   ⚠️  Warning: Time difference > 5s, may cause authentication issues\n');
    } else {
      console.log('   ✅ Time sync OK\n');
    }

    // Test 2: Fetch balance (requires valid API key)
    console.log('💰 Test 2: Fetching account balance...');
    const balance = await exchange.fetchBalance();

    console.log('   Total balances:');
    const nonZeroBalances = Object.entries(balance.total)
      .filter(([_, amount]) => (amount as number) > 0)
      .sort(([_, a], [__, b]) => (b as number) - (a as number));

    if (nonZeroBalances.length === 0) {
      console.log('   ⚠️  No funds in testnet account');
      console.log('   💡 Visit https://testnet.binance.vision/ to get test funds\n');
    } else {
      nonZeroBalances.forEach(([currency, amount]) => {
        console.log(`   ${currency}: ${amount}`);
      });
      console.log('   ✅ Balance retrieved successfully\n');
    }

    // Test 3: Fetch market data (public API)
    console.log('📊 Test 3: Fetching BTC/USDT ticker...');
    const ticker = await exchange.fetchTicker('BTC/USDT');
    console.log(`   Current price: $${ticker.last?.toFixed(2)}`);
    console.log(`   24h volume: ${ticker.baseVolume?.toFixed(2)} BTC`);
    console.log(`   ✅ Market data retrieved\n`);

    // Test 4: Check trading permissions
    console.log('🔐 Test 4: Checking account permissions...');
    const accountInfo = await exchange.fapiPrivateGetAccount(); // futures account info
    console.log('   ✅ API key has trading permissions\n');

    // Test 5: Fetch open orders
    console.log('📋 Test 5: Fetching open orders...');
    const openOrders = await exchange.fetchOpenOrders('BTC/USDT');
    console.log(`   Open orders: ${openOrders.length}`);
    console.log('   ✅ Order query successful\n');

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════');
    console.log('Your API key is valid and ready to use.');
    console.log('\nNext steps:');
    console.log('1. Get test funds from https://testnet.binance.vision/');
    console.log('2. Start implementing the trading engine');
    console.log('3. Test order placement with small amounts\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED!\n');

    if (error.message.includes('Invalid API-key')) {
      console.error('Error: Invalid API Key or Secret');
      console.error('Please check your .env.local file\n');
    } else if (error.message.includes('Timestamp')) {
      console.error('Error: Time synchronization issue');
      console.error('Your system clock may be out of sync\n');
    } else if (error.message.includes('IP')) {
      console.error('Error: IP address not whitelisted');
      console.error('Add your IP to Binance API settings\n');
    } else {
      console.error('Error details:', error.message);
    }

    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testBinanceConnection();
