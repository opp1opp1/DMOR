/**
 * Exchange API Wrapper
 *
 * Provides a unified interface for interacting with Binance exchange
 * Supports:
 * - Testnet and Production environments
 * - Mock mode for development without API access
 * - Automatic retry with exponential backoff
 * - Rate limiting
 * - Comprehensive error handling
 */

import ccxt from 'ccxt';

export interface ExchangeConfig {
  apiKey: string;
  secret: string;
  testnet: boolean;
  mockMode?: boolean; // For development without network access
}

export interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
}

export interface Balance {
  currency: string;
  free: number;
  used: number;
  total: number;
}

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  contracts: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  liquidationPrice?: number;
}

export interface Order {
  id: string;
  symbol: string;
  type: string;
  side: string;
  price: number;
  amount: number;
  filled: number;
  remaining: number;
  status: string;
  timestamp: number;
}

export class ExchangeAPI {
  private exchange: ccxt.Exchange;
  private config: ExchangeConfig;
  private mockMode: boolean;

  constructor(config: ExchangeConfig) {
    this.config = config;
    this.mockMode = config.mockMode || false;

    if (!this.mockMode) {
      // Initialize real exchange
      this.exchange = new ccxt.binance({
        apiKey: config.apiKey,
        secret: config.secret,
        enableRateLimit: true,
        options: {
          defaultType: 'spot',
          recvWindow: 60000, // Increased timeout for API calls
        },
      });

      // Configure testnet if enabled
      if (config.testnet) {
        this.exchange.urls['api'] = {
          public: 'https://testnet.binance.vision/api',
          private: 'https://testnet.binance.vision/api',
        };
        console.log('🧪 Exchange: Testnet mode enabled');
      } else {
        console.log('💰 Exchange: Production mode enabled');
      }
    } else {
      console.log('🎭 Exchange: Mock mode enabled (no real trading)');
      // Initialize mock exchange (we'll create mock data)
      this.exchange = {} as ccxt.Exchange;
    }
  }

  /**
   * Test connection to exchange
   */
  async testConnection(): Promise<boolean> {
    if (this.mockMode) {
      console.log('✅ Mock connection successful');
      return true;
    }

    try {
      const time = await this.retryWithBackoff(() => this.exchange.fetchTime());
      console.log(`✅ Connected to exchange (server time: ${new Date(time).toISOString()})`);
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error);
      return false;
    }
  }

  /**
   * Fetch account balance
   */
  async fetchBalance(): Promise<Balance[]> {
    if (this.mockMode) {
      return this.getMockBalance();
    }

    try {
      const balance = await this.retryWithBackoff(() => this.exchange.fetchBalance());

      return Object.entries(balance.total)
        .filter(([_, amount]) => (amount as number) > 0)
        .map(([currency, total]) => ({
          currency,
          free: balance.free[currency] || 0,
          used: balance.used[currency] || 0,
          total: total as number,
        }));
    } catch (error) {
      throw this.handleError('fetchBalance', error);
    }
  }

  /**
   * Fetch current price for a symbol
   */
  async fetchPrice(symbol: string): Promise<number> {
    if (this.mockMode) {
      return this.getMockPrice(symbol);
    }

    try {
      const ticker = await this.retryWithBackoff(() => this.exchange.fetchTicker(symbol));
      return ticker.last || 0;
    } catch (error) {
      throw this.handleError('fetchPrice', error);
    }
  }

  /**
   * Create a new order
   */
  async createOrder(params: OrderParams): Promise<Order> {
    if (this.mockMode) {
      return this.getMockOrder(params);
    }

    try {
      console.log(`📤 Creating ${params.side} order for ${params.amount} ${params.symbol} @ ${params.type}`);

      const order = await this.retryWithBackoff(() =>
        this.exchange.createOrder(
          params.symbol,
          params.type,
          params.side,
          params.amount,
          params.price
        )
      );

      console.log(`✅ Order created: ${order.id}`);

      return {
        id: order.id,
        symbol: order.symbol,
        type: order.type,
        side: order.side,
        price: order.price || 0,
        amount: order.amount,
        filled: order.filled || 0,
        remaining: order.remaining || 0,
        status: order.status,
        timestamp: order.timestamp || Date.now(),
      };
    } catch (error) {
      throw this.handleError('createOrder', error);
    }
  }

  /**
   * Create stop loss order
   */
  async createStopLoss(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    stopPrice: number
  ): Promise<Order> {
    if (this.mockMode) {
      return this.getMockOrder({ symbol, side, type: 'market', amount });
    }

    try {
      console.log(`🛡️ Creating stop loss at ${stopPrice} for ${symbol}`);

      const order = await this.retryWithBackoff(() =>
        this.exchange.createOrder(symbol, 'STOP_LOSS_LIMIT', side, amount, stopPrice, {
          stopPrice: stopPrice,
          stopLimitPrice: stopPrice * (side === 'sell' ? 0.998 : 1.002),
        })
      );

      console.log(`✅ Stop loss created: ${order.id}`);

      return {
        id: order.id,
        symbol: order.symbol,
        type: order.type,
        side: order.side,
        price: order.price || 0,
        amount: order.amount,
        filled: order.filled || 0,
        remaining: order.remaining || 0,
        status: order.status,
        timestamp: order.timestamp || Date.now(),
      };
    } catch (error) {
      throw this.handleError('createStopLoss', error);
    }
  }

  /**
   * Create take profit order
   */
  async createTakeProfit(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    takeProfitPrice: number
  ): Promise<Order> {
    if (this.mockMode) {
      return this.getMockOrder({ symbol, side, type: 'limit', amount, price: takeProfitPrice });
    }

    try {
      console.log(`🎯 Creating take profit at ${takeProfitPrice} for ${symbol}`);

      const order = await this.retryWithBackoff(() =>
        this.exchange.createOrder(symbol, 'TAKE_PROFIT_LIMIT', side, amount, takeProfitPrice, {
          stopPrice: takeProfitPrice,
        })
      );

      console.log(`✅ Take profit created: ${order.id}`);

      return {
        id: order.id,
        symbol: order.symbol,
        type: order.type,
        side: order.side,
        price: order.price || 0,
        amount: order.amount,
        filled: order.filled || 0,
        remaining: order.remaining || 0,
        status: order.status,
        timestamp: order.timestamp || Date.now(),
      };
    } catch (error) {
      throw this.handleError('createTakeProfit', error);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    if (this.mockMode) {
      console.log(`🎭 Mock: Cancelled order ${orderId}`);
      return;
    }

    try {
      await this.retryWithBackoff(() => this.exchange.cancelOrder(orderId, symbol));
      console.log(`✅ Order cancelled: ${orderId}`);
    } catch (error) {
      throw this.handleError('cancelOrder', error);
    }
  }

  /**
   * Fetch open orders
   */
  async fetchOpenOrders(symbol?: string): Promise<Order[]> {
    if (this.mockMode) {
      return [];
    }

    try {
      const orders = await this.retryWithBackoff(() => this.exchange.fetchOpenOrders(symbol));

      return orders.map((order) => ({
        id: order.id,
        symbol: order.symbol,
        type: order.type,
        side: order.side,
        price: order.price || 0,
        amount: order.amount,
        filled: order.filled || 0,
        remaining: order.remaining || 0,
        status: order.status,
        timestamp: order.timestamp || Date.now(),
      }));
    } catch (error) {
      throw this.handleError('fetchOpenOrders', error);
    }
  }

  /**
   * Fetch order status
   */
  async fetchOrder(orderId: string, symbol: string): Promise<Order> {
    if (this.mockMode) {
      return this.getMockOrder({ symbol, side: 'buy', type: 'market', amount: 0.001 });
    }

    try {
      const order = await this.retryWithBackoff(() => this.exchange.fetchOrder(orderId, symbol));

      return {
        id: order.id,
        symbol: order.symbol,
        type: order.type,
        side: order.side,
        price: order.price || 0,
        amount: order.amount,
        filled: order.filled || 0,
        remaining: order.remaining || 0,
        status: order.status,
        timestamp: order.timestamp || Date.now(),
      };
    } catch (error) {
      throw this.handleError('fetchOrder', error);
    }
  }

  /**
   * Fetch trading positions (for futures/margin)
   */
  async fetchPositions(symbol?: string): Promise<Position[]> {
    if (this.mockMode) {
      return [];
    }

    try {
      // Note: This requires futures API access
      const positions = await this.retryWithBackoff(() => this.exchange.fetchPositions([symbol]));

      return positions
        .filter((pos: any) => pos.contracts > 0)
        .map((pos: any) => ({
          symbol: pos.symbol,
          side: pos.side,
          contracts: pos.contracts,
          entryPrice: pos.entryPrice,
          markPrice: pos.markPrice,
          unrealizedPnl: pos.unrealizedPnl,
          leverage: pos.leverage,
          liquidationPrice: pos.liquidationPrice,
        }));
    } catch (error) {
      // Positions may not be available in spot trading
      console.warn('⚠️  Positions not available (spot trading mode)');
      return [];
    }
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        // Don't retry on authentication errors
        if (error.message?.includes('Invalid API-key') || error.message?.includes('Signature')) {
          throw error;
        }

        // Don't retry on insufficient balance
        if (error.message?.includes('insufficient balance')) {
          throw error;
        }

        // Last attempt, throw error
        if (i === maxRetries - 1) {
          throw error;
        }

        // Rate limit hit, wait longer
        if (error.message?.includes('rate limit')) {
          const delay = 60000; // 60 seconds
          console.warn(`⏳ Rate limit hit, waiting ${delay / 1000}s...`);
          await this.sleep(delay);
          continue;
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`⚠️  Request failed, retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
        await this.sleep(delay);
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Handle and format errors
   */
  private handleError(operation: string, error: any): Error {
    const message = error.message || error.toString();

    if (message.includes('Invalid API-key')) {
      return new Error(`[${operation}] Invalid API key or secret`);
    }

    if (message.includes('Timestamp')) {
      return new Error(`[${operation}] Time synchronization issue - check system clock`);
    }

    if (message.includes('IP')) {
      return new Error(`[${operation}] IP not whitelisted on exchange`);
    }

    if (message.includes('insufficient balance')) {
      return new Error(`[${operation}] Insufficient balance`);
    }

    if (message.includes('rate limit')) {
      return new Error(`[${operation}] Rate limit exceeded`);
    }

    return new Error(`[${operation}] ${message}`);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Mock data generators (for development without API access)
  // ============================================================================

  private getMockBalance(): Balance[] {
    return [
      { currency: 'USDT', free: 10000, used: 0, total: 10000 },
      { currency: 'BTC', free: 0.5, used: 0, total: 0.5 },
      { currency: 'ETH', free: 5, used: 0, total: 5 },
    ];
  }

  private getMockPrice(symbol: string): number {
    const prices: Record<string, number> = {
      'BTC/USDT': 45000,
      'ETH/USDT': 2500,
      'SOL/USDT': 100,
      'BNB/USDT': 300,
    };
    return prices[symbol] || 100;
  }

  private getMockOrder(params: OrderParams): Order {
    return {
      id: `MOCK_${Date.now()}`,
      symbol: params.symbol,
      type: params.type,
      side: params.side,
      price: params.price || this.getMockPrice(params.symbol),
      amount: params.amount,
      filled: params.amount,
      remaining: 0,
      status: 'closed',
      timestamp: Date.now(),
    };
  }
}

/**
 * Create exchange instance from environment variables
 */
export function createExchangeFromEnv(): ExchangeAPI {
  const config: ExchangeConfig = {
    apiKey: process.env.BINANCE_API_KEY || '',
    secret: process.env.BINANCE_SECRET_KEY || '',
    testnet: process.env.BINANCE_TESTNET === 'true',
    mockMode: process.env.EXCHANGE_MOCK_MODE === 'true',
  };

  if (!config.apiKey || !config.secret) {
    console.warn('⚠️  API credentials not found, using mock mode');
    config.mockMode = true;
  }

  return new ExchangeAPI(config);
}
