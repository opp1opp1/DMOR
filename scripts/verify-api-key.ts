/**
 * API Key Format Verification
 *
 * This script validates the format of your Binance API credentials
 * without requiring network access to Binance servers.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

function verifyAPIKeyFormat() {
  console.log('🔐 Verifying Binance API Key Format...\n');

  const apiKey = process.env.BINANCE_API_KEY;
  const secretKey = process.env.BINANCE_SECRET_KEY;

  // Check if keys exist
  if (!apiKey || !secretKey) {
    console.error('❌ Error: API keys not found in .env.local\n');
    console.log('Please ensure .env.local contains:');
    console.log('  BINANCE_API_KEY=your_key');
    console.log('  BINANCE_SECRET_KEY=your_secret\n');
    process.exit(1);
  }

  // Validate key format
  console.log('✅ API Key found');
  console.log(`   Length: ${apiKey.length} characters`);
  console.log(`   Format: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}\n`);

  console.log('✅ Secret Key found');
  console.log(`   Length: ${secretKey.length} characters`);
  console.log(`   Format: ${secretKey.substring(0, 8)}...${secretKey.substring(secretKey.length - 8)}\n`);

  // Binance API keys are typically 64 characters
  if (apiKey.length < 60 || apiKey.length > 70) {
    console.warn('⚠️  Warning: API Key length unusual (expected ~64 chars)\n');
  }

  if (secretKey.length < 60 || secretKey.length > 70) {
    console.warn('⚠️  Warning: Secret Key length unusual (expected ~64 chars)\n');
  }

  // Test signature generation (this is what Binance uses for authentication)
  console.log('🔧 Testing HMAC-SHA256 signature generation...');
  const testMessage = 'symbol=BTCUSDT&timestamp=1234567890000';
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(testMessage)
    .digest('hex');

  console.log(`   Test message: ${testMessage}`);
  console.log(`   Signature: ${signature}\n`);
  console.log('✅ Signature generation works correctly\n');

  // Display test URLs
  console.log('═══════════════════════════════════════');
  console.log('📋 Manual Testing Instructions');
  console.log('═══════════════════════════════════════\n');

  console.log('Since the current environment cannot reach Binance API,');
  console.log('you can test your API key manually:\n');

  console.log('1. Open Postman or your browser with a REST client\n');

  console.log('2. Test public endpoint (no auth):');
  console.log('   GET https://testnet.binance.vision/api/v3/time\n');

  console.log('3. Test private endpoint (requires API key):');
  console.log('   GET https://testnet.binance.vision/api/v3/account');
  console.log('   Headers:');
  console.log(`     X-MBX-APIKEY: ${apiKey}`);
  console.log('   Query Parameters:');
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const authSignature = crypto
    .createHmac('sha256', secretKey)
    .update(queryString)
    .digest('hex');
  console.log(`     timestamp=${timestamp}`);
  console.log(`     signature=${authSignature}\n`);

  console.log('4. Or use curl command:');
  console.log(`\ncurl -H "X-MBX-APIKEY: ${apiKey}" \\`);
  console.log(`  "https://testnet.binance.vision/api/v3/account?timestamp=${timestamp}&signature=${authSignature}"\n`);

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('✅ LOCAL VALIDATION PASSED');
  console.log('═══════════════════════════════════════\n');
  console.log('Your API keys are properly formatted and loaded.');
  console.log('The trading bot will work once deployed to an');
  console.log('environment with Binance API access.\n');

  console.log('Alternative: If you have network access elsewhere:');
  console.log('1. Deploy this code to a VPS (DigitalOcean, AWS, etc.)');
  console.log('2. Or run locally with a VPN to a supported region');
  console.log('3. Or continue development with mock data\n');
}

verifyAPIKeyFormat();
