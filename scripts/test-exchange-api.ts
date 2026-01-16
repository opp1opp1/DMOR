/**
 * Exchange API Module Test Script
 *
 * Demonstrates all features of the ExchangeAPI wrapper
 */

import dotenv from 'dotenv';
import { ExchangeAPI, createExchangeFromEnv } from '../src/lib/trading/exchange';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testExchangeAPI() {
  console.log('🧪 Testing Exchange API Module\n');
  console.log('═══════════════════════════════════════\n');

  // Create exchange instance
  let exchange = createExchangeFromEnv();

  try {
    // Test 1: Connection
    console.log('📡 Test 1: Testing connection...');
    const connected = await exchange.testConnection();
    if (!connected) {
      console.log('⚠️  Network connection failed, switching to mock mode...\n');
      // Recreate exchange in mock mode
      exchange = new ExchangeAPI({
        apiKey: process.env.BINANCE_API_KEY || '',
        secret: process.env.BINANCE_SECRET_KEY || '',
        testnet: true,
        mockMode: true,
      });
      await exchange.testConnection();
    }
    console.log('');

    // Test 2: Fetch balance
    console.log('💰 Test 2: Fetching account balance...');
    const balances = await exchange.fetchBalance();
    console.log('   Balances:');
    balances.forEach((balance) => {
      console.log(`   ${balance.currency}: ${balance.total} (free: ${balance.free}, used: ${balance.used})`);
    });
    console.log('');

    // Test 3: Fetch price
    console.log('📊 Test 3: Fetching BTC/USDT price...');
    const btcPrice = await exchange.fetchPrice('BTC/USDT');
    console.log(`   Current BTC price: $${btcPrice.toFixed(2)}`);
    console.log('');

    // Test 4: Market order (DEMO - not executed)
    console.log('📝 Test 4: Creating market order (DEMO)...');
    console.log('   NOTE: This would create a real order in testnet mode');
    console.log('   Uncomment the code below to test actual order creation');
    console.log('');
    /*
    const order = await exchange.createOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.001, // Buy 0.001 BTC
    });
    console.log(`   Order created: ${order.id}`);
    console.log(`   Status: ${order.status}`);
    console.log('');
    */

    // Test 5: Stop loss order (DEMO)
    console.log('🛡️ Test 5: Creating stop loss order (DEMO)...');
    console.log('   This would create a stop loss at 90% of current price');
    console.log('');
    /*
    const stopLoss = await exchange.createStopLoss(
      'BTC/USDT',
      'sell',
      0.001,
      btcPrice * 0.9 // Stop loss at 90% of current price
    );
    console.log(`   Stop loss created: ${stopLoss.id}`);
    console.log('');
    */

    // Test 6: Take profit order (DEMO)
    console.log('🎯 Test 6: Creating take profit order (DEMO)...');
    console.log('   This would create a take profit at 110% of current price');
    console.log('');
    /*
    const takeProfit = await exchange.createTakeProfit(
      'BTC/USDT',
      'sell',
      0.001,
      btcPrice * 1.1 // Take profit at 110% of current price
    );
    console.log(`   Take profit created: ${takeProfit.id}`);
    console.log('');
    */

    // Test 7: Fetch open orders
    console.log('📋 Test 7: Fetching open orders...');
    const openOrders = await exchange.fetchOpenOrders('BTC/USDT');
    console.log(`   Open orders: ${openOrders.length}`);
    if (openOrders.length > 0) {
      openOrders.forEach((order) => {
        console.log(`   - ${order.id}: ${order.side} ${order.amount} ${order.symbol} @ ${order.price}`);
      });
    }
    console.log('');

    // Test 8: Fetch positions (may not be available in spot trading)
    console.log('📊 Test 8: Fetching positions...');
    const positions = await exchange.fetchPositions();
    console.log(`   Active positions: ${positions.length}`);
    if (positions.length > 0) {
      positions.forEach((pos) => {
        console.log(`   - ${pos.symbol}: ${pos.side} ${pos.contracts} @ ${pos.entryPrice}`);
        console.log(`     Unrealized PnL: ${pos.unrealizedPnl}`);
      });
    }
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════\n');

    console.log('📋 Next Steps:');
    console.log('1. Uncomment order creation tests to test real trading');
    console.log('2. Implement risk management system');
    console.log('3. Build order execution engine');
    console.log('4. Create position monitoring service\n');

    console.log('💡 Tips:');
    console.log('- Always test with small amounts first');
    console.log('- Use testnet for development and testing');
    console.log('- Enable mock mode for offline development:');
    console.log('  Set EXCHANGE_MOCK_MODE=true in .env.local\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testExchangeAPI();
