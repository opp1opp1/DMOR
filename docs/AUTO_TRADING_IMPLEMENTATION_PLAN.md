# DMOR PRO 自動交易系統實施計畫

> 文件建立日期：2026-01-11
> 目標：將現有AI信號系統升級為全自動交易機器人

---

## 📊 現有系統分析

### ✅ 優點
- AI決策引擎已完善（3階段推理：技術分析 → 新聞情緒 → 綜合決策）
- 已有技術指標分析（RSI, SMA）
- 新聞情緒分析已整合
- 提供完整交易設置（entry, TP, SL, leverage）
- 使用CCXT庫（已支援多交易所）

### ❌ 限制
- 目前僅使用**公開API**（市場數據），無法下單
- 無資金管理系統
- 無持倉追蹤
- 無自動止盈止損執行
- 無交易記錄和歷史

---

## 🎯 需要新增/修改的核心功能

### 1. 交易所認證與私有API整合 ⚠️ [高優先級]

**現狀問題：**
```typescript
// src/lib/market.ts:7
const exchange = new ccxt.binance({
  enableRateLimit: true,
  // 缺少 apiKey, secret
});
```

**改進項目：**
- [ ] 新增 `.env` 環境變數：`BINANCE_API_KEY`, `BINANCE_API_SECRET`
- [ ] 實作安全的API金鑰管理（考慮加密存儲）
- [ ] 支援測試網（testnet）用於開發
- [ ] 實作以下私有API功能：
  - `createOrder()` - 下市價/限價單
  - `cancelOrder()` - 取消訂單
  - `fetchBalance()` - 查詢餘額
  - `fetchOpenOrders()` - 查詢掛單
  - `fetchMyTrades()` - 查詢成交記錄

**環境變數範例：**
```env
# .env.local
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
BINANCE_TESTNET=true  # 開發時使用測試網
```

---

### 2. 資金管理與風險控制系統 🛡️ [高優先級]

**新建檔案：** `src/lib/trading/risk-manager.ts`

**必須功能：**
```typescript
interface RiskConfig {
  maxPositionSizePercent: number;    // 單筆交易佔總資金比例（建議 2-5%）
  maxDailyLossPercent: number;       // 每日最大虧損（建議 5-10%）
  maxOpenPositions: number;          // 最大同時持倉數（建議 3-5）
  allowedLeverage: number[];         // 允許的槓桿倍數
  minAccountBalance: number;         // 最低帳戶餘額（低於此值停止交易）
}

/**
 * 交易前風險檢查
 */
async function checkRiskBeforeTrade(
  signal: MarketSignal,
  balance: number,
  openPositions: Position[]
): Promise<{
  allowed: boolean;
  reason?: string;
  adjustedSize?: number;
}>

/**
 * 計算安全的倉位大小
 */
function calculatePositionSize(
  signal: MarketSignal,
  accountBalance: number,
  riskPercent: number
): number

/**
 * 檢查每日虧損限制
 */
async function checkDailyLossLimit(): Promise<boolean>
```

**風險控制邏輯：**
```
1. 單筆風險 = (Entry - StopLoss) * PositionSize ≤ 總資金 * 2%
2. 每日累積虧損 < 總資金 * 5% → 停止當日交易
3. 同時持倉數 ≤ 3個
4. 槓桿使用：BTC/ETH允許5-10x，山寨幣限制3-5x
5. 保證金充足率 > 150%（防止強平）
```

---

### 3. 自動訂單執行引擎 🤖 [高優先級]

**新建檔案：** `src/lib/trading/executor.ts`

**核心流程：**
```typescript
/**
 * 執行AI信號交易
 */
async function executeSignal(signal: MarketSignal): Promise<ExecutionResult> {
  // 1. 風險檢查
  const riskCheck = await riskManager.checkRiskBeforeTrade(signal);
  if (!riskCheck.allowed) {
    return { success: false, reason: riskCheck.reason };
  }

  // 2. 獲取當前餘額
  const balance = await exchange.fetchBalance();

  // 3. 計算倉位大小
  const positionSize = calculatePositionSize(
    signal,
    balance.total.USDT,
    RISK_CONFIG.maxPositionSizePercent
  );

  // 4. 下主訂單（市價單或限價單）
  const order = await exchange.createOrder(
    signal.symbol,
    'market',  // 或 'limit'
    signal.action.toLowerCase(),  // 'buy' or 'sell'
    positionSize,
    signal.setup.entry
  );

  // 5. 設置止盈止損（OCO訂單或條件單）
  await setStopLossAndTakeProfit(order, signal.setup);

  // 6. 記錄交易
  await database.savePosition({
    orderId: order.id,
    signal: signal,
    entryPrice: order.price,
    size: positionSize,
    status: 'OPEN'
  });

  // 7. 發送通知
  await notifications.sendTradeAlert('開倉成功', signal, order);

  return { success: true, order };
}

/**
 * 設置止盈止損
 */
async function setStopLossAndTakeProfit(
  order: Order,
  setup: TradingSetup
) {
  // Binance OCO訂單（同時設置TP和SL）
  await exchange.createOrder(
    order.symbol,
    'STOP_LOSS_LIMIT',
    order.side === 'buy' ? 'sell' : 'buy',
    order.amount,
    setup.stopLoss,
    {
      stopPrice: setup.stopLoss,
      stopLimitPrice: setup.stopLoss * 0.998  // 稍低於止損價
    }
  );

  // 多目標止盈（TP1, TP2, TP3）
  const tpTargets = setup.takeProfits || [setup.takeProfit];
  const sizePerTarget = order.amount / tpTargets.length;

  for (const tp of tpTargets) {
    await exchange.createOrder(
      order.symbol,
      'TAKE_PROFIT_LIMIT',
      order.side === 'buy' ? 'sell' : 'buy',
      sizePerTarget,
      tp,
      { stopPrice: tp }
    );
  }
}
```

---

### 4. 止盈止損自動監控 📈📉 [高優先級]

**新建檔案：** `src/lib/trading/position-monitor.ts`

**監控機制：**
```typescript
/**
 * 持倉監控服務（每5秒輪詢一次）
 */
class PositionMonitor {
  private interval: NodeJS.Timer;
  private isRunning: boolean = false;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.interval = setInterval(async () => {
      try {
        await this.checkAllPositions();
      } catch (error) {
        logger.error('Position monitor error:', error);
        await notifications.sendAlert('監控異常', error);
      }
    }, 5000);  // 每5秒檢查一次
  }

  async checkAllPositions() {
    const openPositions = await database.getOpenPositions();

    for (const position of openPositions) {
      // 獲取當前市價
      const ticker = await exchange.fetchTicker(position.symbol);
      const currentPrice = ticker.last;

      // 檢查止損
      if (this.shouldStopLoss(position, currentPrice)) {
        await this.closePosition(position, 'STOP_LOSS', currentPrice);
        continue;
      }

      // 檢查止盈
      if (this.shouldTakeProfit(position, currentPrice)) {
        await this.partialClose(position, 'TAKE_PROFIT', currentPrice);
      }

      // 移動止損（trailing stop）
      if (this.shouldUpdateTrailingStop(position, currentPrice)) {
        await this.updateStopLoss(position, this.calculateTrailingStop(position, currentPrice));
      }

      // 檢查信號反轉（AI給出相反信號時平倉）
      if (await this.hasReverseSignal(position)) {
        await this.closePosition(position, 'SIGNAL_REVERSE', currentPrice);
      }
    }
  }

  private shouldStopLoss(position: Position, currentPrice: number): boolean {
    if (position.side === 'LONG') {
      return currentPrice <= position.stopLoss;
    } else {
      return currentPrice >= position.stopLoss;
    }
  }

  private shouldTakeProfit(position: Position, currentPrice: number): boolean {
    // 檢查是否達到任一止盈目標
    for (const tp of position.takeProfits) {
      if (!tp.filled) {
        if (position.side === 'LONG' && currentPrice >= tp.price) return true;
        if (position.side === 'SHORT' && currentPrice <= tp.price) return true;
      }
    }
    return false;
  }

  private async closePosition(
    position: Position,
    reason: CloseReason,
    price: number
  ) {
    // 平倉
    const order = await exchange.createOrder(
      position.symbol,
      'market',
      position.side === 'LONG' ? 'sell' : 'buy',
      position.remainingSize,
      price
    );

    // 計算盈虧
    const pnl = this.calculatePnL(position, price);

    // 更新資料庫
    await database.closePosition(position.id, {
      closePrice: price,
      closeTime: new Date(),
      pnl: pnl,
      pnlPercent: (pnl / position.entryPrice) * 100,
      closeReason: reason
    });

    // 發送通知
    await notifications.sendTradeAlert('平倉通知', {
      symbol: position.symbol,
      reason: reason,
      pnl: pnl,
      pnlPercent: ((pnl / position.entryPrice) * 100).toFixed(2) + '%'
    });
  }
}

export const positionMonitor = new PositionMonitor();
```

**使用交易所原生功能：**
```typescript
// Binance 原生止盈止損訂單（推薦）
await exchange.createOrder(symbol, 'market', 'buy', amount, null, {
  'stopLoss': {
    'triggerPrice': stopLossPrice,
    'price': stopLossPrice * 0.998  // 略低於觸發價
  },
  'takeProfit': {
    'triggerPrice': takeProfitPrice,
    'price': takeProfitPrice * 1.002  // 略高於觸發價
  }
});
```

---

### 5. 持倉與交易記錄系統 📝 [中優先級]

**新建檔案：** `src/lib/trading/database.ts`

**資料結構：**
```typescript
interface Position {
  id: string;
  symbol: string;              // 'BTC/USDT'
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  size: number;                // 持倉數量
  remainingSize: number;       // 剩餘數量（部分平倉後）
  leverage: number;
  stopLoss: number;
  takeProfits: TakeProfitTarget[];
  openTime: Date;
  signalId: string;            // 關聯的AI信號ID
  aiConfidence: number;        // AI信心分數
  status: 'OPEN' | 'CLOSED' | 'PARTIAL_CLOSED';

  // 額外資訊
  initialMargin: number;       // 初始保證金
  unrealizedPnl?: number;      // 未實現盈虧
}

interface TakeProfitTarget {
  level: number;               // TP1, TP2, TP3
  price: number;
  sizePercent: number;         // 平倉比例（如 50% 在 TP1）
  filled: boolean;
}

interface TradeHistory {
  id: string;
  positionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';

  // 進場資訊
  entryPrice: number;
  entryTime: Date;

  // 出場資訊
  closePrice: number;
  closeTime: Date;
  closeReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'SIGNAL_REVERSE' | 'RISK_LIMIT';

  // 盈虧
  size: number;
  leverage: number;
  pnl: number;                 // 絕對盈虧（USDT）
  pnlPercent: number;          // 百分比盈虧
  fees: number;                // 手續費

  // AI相關
  signalId: string;
  aiConfidence: number;

  // 績效分析
  holdingTime: number;         // 持倉時長（秒）
  maxDrawdown: number;         // 最大回撤
}

interface DailyStats {
  date: string;                // 'YYYY-MM-DD'
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;             // 勝率
  totalPnl: number;
  maxDrawdown: number;
  sharpeRatio?: number;
}
```

**實作方式：**
```typescript
// 方案1：使用 JSON 檔案（簡單，適合開發）
class JSONDatabase {
  private positions: Position[] = [];
  private history: TradeHistory[] = [];

  async savePosition(position: Position) {
    this.positions.push(position);
    await fs.writeFile('data/positions.json', JSON.stringify(this.positions));
  }

  async getOpenPositions(): Promise<Position[]> {
    return this.positions.filter(p => p.status === 'OPEN');
  }
}

// 方案2：使用 SQLite（推薦生產環境）
import Database from 'better-sqlite3';

class SQLiteDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database('trading.db');
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        entry_price REAL NOT NULL,
        size REAL NOT NULL,
        leverage INTEGER,
        stop_loss REAL,
        status TEXT,
        open_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        signal_data TEXT
      );

      CREATE TABLE IF NOT EXISTS trade_history (
        id TEXT PRIMARY KEY,
        position_id TEXT,
        close_price REAL,
        close_time DATETIME,
        pnl REAL,
        close_reason TEXT,
        FOREIGN KEY (position_id) REFERENCES positions(id)
      );
    `);
  }
}
```

---

### 6. 通知系統 🔔 [中優先級]

**新建檔案：** `src/lib/notifications.ts`

**Telegram Bot 實作（推薦）：**
```typescript
import axios from 'axios';

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

class NotificationService {
  private telegram: TelegramConfig;

  constructor() {
    this.telegram = {
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      chatId: process.env.TELEGRAM_CHAT_ID!
    };
  }

  /**
   * 發送交易通知
   */
  async sendTradeAlert(type: string, data: any) {
    const message = this.formatTradeMessage(type, data);
    await this.sendTelegram(message);
  }

  /**
   * 發送風險警告
   */
  async sendRiskAlert(message: string) {
    await this.sendTelegram(`⚠️ 風險警告\n${message}`);
  }

  private formatTradeMessage(type: string, data: any): string {
    switch (type) {
      case '開倉成功':
        return `
🟢 開倉成功

交易對：${data.symbol}
方向：${data.side}
進場價：${data.entryPrice}
倉位：${data.size}
槓桿：${data.leverage}x

止損：${data.stopLoss}
止盈：${data.takeProfits.join(', ')}

AI信心：${data.confidence}%
        `.trim();

      case '平倉通知':
        const emoji = data.pnl > 0 ? '✅' : '❌';
        return `
${emoji} 平倉通知

交易對：${data.symbol}
平倉原因：${data.reason}
盈虧：${data.pnl > 0 ? '+' : ''}${data.pnl} USDT (${data.pnlPercent})
        `.trim();

      default:
        return JSON.stringify(data);
    }
  }

  private async sendTelegram(message: string) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${this.telegram.botToken}/sendMessage`,
        {
          chat_id: this.telegram.chatId,
          text: message,
          parse_mode: 'HTML'
        }
      );
    } catch (error) {
      console.error('Telegram notification failed:', error);
    }
  }
}

export const notifications = new NotificationService();
```

**環境變數：**
```env
# Telegram Bot 設定
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

**設定步驟：**
1. 與 @BotFather 對話建立 Bot，取得 token
2. 與你的 Bot 對話，發送 `/start`
3. 訪問 `https://api.telegram.org/bot<TOKEN>/getUpdates` 取得 chat_id

---

### 7. 管理後台UI 🖥️ [中優先級]

**新建頁面：** `src/app/trading/page.tsx`

**功能需求：**
```typescript
// 介面組件
- 🔴/🟢 自動交易主開關（Master Switch）
- 📊 即時持倉列表
  - 交易對、方向、進場價、當前價、未實現盈虧
  - 止盈止損價格顯示
  - 手動平倉按鈕
- 📈 交易歷史表格
  - 過濾器：日期、交易對、盈虧狀態
  - 匯出 CSV 功能
- 💰 帳戶概覽
  - 總資金、可用餘額、佔用保證金
  - 今日/本週/本月盈虧
  - 勝率、總交易次數
- ⚙️ 風險參數調整
  - 單筆風險比例滑桿
  - 每日虧損限制
  - 最大持倉數
- 📉 績效圖表
  - 權益曲線
  - 每日盈虧柱狀圖
  - 勝率趨勢
```

**API Routes：**
```typescript
// src/app/api/trading/control/route.ts
export async function POST(req: Request) {
  const { action } = await req.json();

  if (action === 'start') {
    await tradingEngine.start();
    return Response.json({ success: true, status: 'running' });
  } else if (action === 'stop') {
    await tradingEngine.stop();
    return Response.json({ success: true, status: 'stopped' });
  }
}

// src/app/api/trading/positions/route.ts
export async function GET() {
  const positions = await database.getOpenPositions();
  return Response.json(positions);
}

// src/app/api/trading/history/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  const history = await database.getTradeHistory(startDate, endDate);
  return Response.json(history);
}
```

---

### 8. 錯誤處理與容災 🚨 [高優先級]

**實作重點：**
```typescript
/**
 * 重試機制（網路問題）
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000;  // 1s, 2s, 4s
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * API 限流處理
 */
class RateLimiter {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          if (error.message.includes('rate limit')) {
            console.log('Rate limit hit, waiting 60s...');
            await sleep(60000);
            return this.execute(fn);  // 重試
          }
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();
      await sleep(200);  // 每個請求間隔 200ms
    }

    this.processing = false;
  }
}

/**
 * 餘額不足處理
 */
async function handleInsufficientBalance(error: Error) {
  await notifications.sendAlert('餘額不足，已停止交易');
  await tradingEngine.stop();

  // 記錄到日誌
  logger.error('Insufficient balance', {
    timestamp: new Date(),
    balance: await exchange.fetchBalance()
  });
}

/**
 * WebSocket 斷線重連
 */
class PriceStreamMonitor {
  private ws: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    this.ws = new WebSocket('wss://stream.binance.com:9443/ws');

    this.ws.onclose = () => {
      console.log('WebSocket closed, reconnecting...');

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, 5000);
      } else {
        notifications.sendAlert('WebSocket 連線失敗，切換為輪詢模式');
      }
    };
  }
}
```

**異常情況處理清單：**
```
✅ 網路斷線 → 重試機制（最多3次，指數退避）
✅ API限流 → 自動等待60秒後重試
✅ 餘額不足 → 停止交易 + 發送警報
✅ 訂單被拒絕 → 記錄原因，跳過該信號
✅ WebSocket斷線 → 自動重連，失敗後降級為輪詢
✅ 交易所維護 → 檢測並暫停交易，維護結束後恢復
✅ 滑點過大 → 限價單保護，超過閾值取消訂單
✅ 強平風險 → 提前平倉部分倉位，降低槓桿
```

---

### 9. 回測系統（選配）📊 [低優先級]

**新建檔案：** `src/lib/backtest.ts`

```typescript
/**
 * 歷史數據回測
 */
async function runBacktest(config: BacktestConfig) {
  const historicalData = await fetchHistoricalData(
    config.symbol,
    config.startDate,
    config.endDate,
    config.timeframe
  );

  let balance = config.initialBalance;
  const trades: TradeHistory[] = [];

  for (const candle of historicalData) {
    // 生成信號（使用歷史數據）
    const signal = await generateSignalFromHistory(candle);

    if (signal.action !== 'HOLD') {
      // 模擬交易執行
      const trade = simulateTrade(signal, balance, config.riskConfig);
      trades.push(trade);
      balance += trade.pnl;
    }
  }

  // 計算績效指標
  return calculatePerformanceMetrics(trades, config.initialBalance);
}

/**
 * 績效指標計算
 */
function calculatePerformanceMetrics(trades: TradeHistory[], initialBalance: number) {
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winTrades = trades.filter(t => t.pnl > 0);
  const lossTrades = trades.filter(t => t.pnl < 0);

  const winRate = (winTrades.length / trades.length) * 100;
  const avgWin = winTrades.reduce((sum, t) => sum + t.pnl, 0) / winTrades.length;
  const avgLoss = Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0) / lossTrades.length);
  const profitFactor = avgWin / avgLoss;

  // Sharpe Ratio
  const returns = trades.map(t => t.pnlPercent);
  const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  const sharpeRatio = (avgReturn / stdDev) * Math.sqrt(252);  // 年化

  // 最大回撤
  let peak = initialBalance;
  let maxDrawdown = 0;
  let currentBalance = initialBalance;

  for (const trade of trades) {
    currentBalance += trade.pnl;
    if (currentBalance > peak) peak = currentBalance;
    const drawdown = ((peak - currentBalance) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return {
    totalTrades: trades.length,
    winRate: winRate.toFixed(2) + '%',
    profitFactor: profitFactor.toFixed(2),
    totalPnl,
    totalReturn: ((totalPnl / initialBalance) * 100).toFixed(2) + '%',
    sharpeRatio: sharpeRatio.toFixed(2),
    maxDrawdown: maxDrawdown.toFixed(2) + '%',
    avgWin: avgWin.toFixed(2),
    avgLoss: avgLoss.toFixed(2)
  };
}
```

---

## 🏗️ 建議的檔案結構

```
DMOR/
├── src/
│   ├── lib/
│   │   ├── market.ts                 ✅ [已存在] 市場數據
│   │   ├── llm.ts                    ✅ [已存在] AI決策
│   │   ├── news.ts                   ✅ [已存在] 新聞聚合
│   │   ├── trading/                  🆕 [新增目錄]
│   │   │   ├── exchange.ts           🆕 交易所API封裝
│   │   │   ├── executor.ts           🆕 訂單執行引擎
│   │   │   ├── position-monitor.ts   🆕 持倉監控服務
│   │   │   ├── risk-manager.ts       🆕 風險管理系統
│   │   │   └── database.ts           🆕 資料存取層
│   │   ├── notifications.ts          🆕 通知服務
│   │   └── backtest.ts               🆕 回測系統（選配）
│   │
│   ├── app/
│   │   ├── page.tsx                  ✅ [已存在] 主頁
│   │   ├── api/
│   │   │   ├── signals/              ✅ [已存在] AI信號
│   │   │   ├── history/              ✅ [已存在] K線數據
│   │   │   └── trading/              🆕 [新增]
│   │   │       ├── control/route.ts  🆕 交易控制（啟動/停止）
│   │   │       ├── positions/route.ts 🆕 持倉查詢
│   │   │       ├── history/route.ts  🆕 交易歷史
│   │   │       └── stats/route.ts    🆕 績效統計
│   │   │
│   │   └── trading/                  🆕 [新增]
│   │       ├── page.tsx              🆕 交易管理頁面
│   │       └── components/           🆕 交易相關組件
│   │           ├── PositionCard.tsx
│   │           ├── TradeHistory.tsx
│   │           └── RiskSettings.tsx
│   │
│   └── types/                        🆕 [新增]
│       └── trading.ts                🆕 交易相關型別定義
│
├── data/                             🆕 [新增]
│   ├── positions.json                🆕 持倉數據（或使用 SQLite）
│   ├── history.json                  🆕 交易歷史
│   └── trading.db                    🆕 SQLite 資料庫（選配）
│
├── logs/                             🆕 [新增]
│   ├── trading.log                   🆕 交易日誌
│   └── errors.log                    🆕 錯誤日誌
│
├── .env.local                        🆕 環境變數（API金鑰等）
└── docs/
    └── AUTO_TRADING_IMPLEMENTATION_PLAN.md  📄 本文件
```

---

## ⚠️ 重要風險提醒

### 資金安全
1. **先用模擬交易測試**：Binance Testnet 至少運行 2-4 週
2. **小額起步**：建議初始資金 $100-$500 測試
3. **API權限限制**：
   - ✅ 允許：現貨/合約交易
   - ❌ 禁止：提現、轉帳、子帳戶管理
4. **IP白名單**：在交易所設定只允許你的伺服器IP訪問API

### 技術風險
1. **系統穩定性**：確保伺服器 24/7 運行（建議使用VPS）
2. **網路延遲**：高頻交易需低延遲環境（建議AWS東京/新加坡機房）
3. **備援機制**：設定雙重通知管道（Telegram + Email）

### 市場風險
1. **加密貨幣高波動**：可能數分鐘內虧損 10-30%
2. **黑天鵝事件**：交易所宕機、監管政策、駭客攻擊
3. **滑點問題**：大單或低流動性幣種可能成交價格偏離
4. **槓桿風險**：高槓桿可能快速爆倉

### 法規遵循
1. 確認所在地區是否允許加密貨幣交易
2. 注意稅務申報義務
3. 自動交易機器人可能受金融監管

---

## 🚀 實施階段規劃

### 第一階段：核心基礎設施（預估 1-2 週）
```
✅ 任務清單：
├─ 設定開發環境（Binance Testnet）
├─ 實作交易所API整合（私有API）
├─ 建立風險管理系統
├─ 實作基本訂單執行
└─ 測試網下單驗證
```

**交付成果：**
- 能在測試網成功下單
- 風險檢查機制正常運作
- API錯誤處理完善

---

### 第二階段：自動化與監控（預估 1-2 週）
```
✅ 任務清單：
├─ 實作止盈止損監控服務
├─ 建立持倉記錄系統（JSON 或 SQLite）
├─ 實作通知系統（Telegram）
├─ 錯誤處理與重試機制
└─ 整合AI信號自動執行
```

**交付成果：**
- 持倉自動監控並執行止盈止損
- 收到 Telegram 即時通知
- 完整的交易記錄

---

### 第三階段：管理介面與優化（預估 1 週）
```
✅ 任務清單：
├─ 建立交易管理後台UI
├─ 實作績效統計圖表
├─ 手動控制功能（啟動/停止/手動平倉）
├─ 風險參數調整介面
└─ 真實環境小額測試
```

**交付成果：**
- 完整的 Web 管理介面
- 可視化績效分析
- 真實資金小額驗證

---

### 第四階段：持續優化（持續進行）
```
✅ 任務清單：
├─ 回測系統開發
├─ 策略參數優化
├─ AI模型調校（提高信心分數門檻）
├─ 新交易對支援
└─ 績效分析與改進
```

**評估指標：**
- 月化報酬率 > 5%
- 勝率 > 55%
- Sharpe Ratio > 1.5
- 最大回撤 < 15%

---

## 📋 檢查清單

### 開發前準備
- [ ] Binance 帳戶註冊
- [ ] 完成身份驗證（KYC）
- [ ] 建立 API Key（測試網 + 正式網）
- [ ] 設定 IP 白名單
- [ ] 建立 Telegram Bot
- [ ] 準備開發環境（Node.js 20+）

### 測試網驗證
- [ ] 成功連接測試網 API
- [ ] 查詢測試網餘額
- [ ] 下市價單測試
- [ ] 下限價單測試
- [ ] 設定止盈止損訂單
- [ ] 取消訂單測試
- [ ] 模擬完整交易流程（開倉→監控→平倉）

### 正式上線前
- [ ] 測試網運行至少 2 週無異常
- [ ] 模擬交易勝率 > 50%
- [ ] 所有異常情況都有處理機制
- [ ] 通知系統運作正常
- [ ] 日誌記錄完整
- [ ] 建立緊急停止機制

### 上線後監控
- [ ] 每日檢查交易記錄
- [ ] 監控績效指標
- [ ] 檢查異常日誌
- [ ] 定期備份資料
- [ ] 評估風險參數是否需調整

---

## 🔧 關鍵技術決策

### 1. 訂單類型選擇
```
✅ 推薦：市價單（Market Order）
  - 優點：立即成交，確保執行
  - 缺點：可能有滑點
  - 適用：流動性高的幣種（BTC, ETH）

⚠️ 謹慎使用：限價單（Limit Order）
  - 優點：價格可控，無滑點
  - 缺點：可能不成交
  - 適用：非緊急開倉
```

### 2. 止盈止損實作方式
```
方案A：交易所原生訂單（推薦）
✅ Binance OCO 訂單（One-Cancels-the-Other）
✅ 止損市價單（Stop Loss Market）
✅ 止盈限價單（Take Profit Limit）

方案B：程式監控執行
✅ 彈性高，可實現複雜邏輯（如移動止損）
❌ 需持續運行，有系統風險
```

### 3. 資料儲存方案
```
小規模（< 1000 筆交易/月）：
  → JSON 檔案（簡單快速）

中規模（< 10000 筆）：
  → SQLite（無需額外伺服器）

大規模（> 10000 筆）：
  → PostgreSQL / MongoDB
```

### 4. 部署方案
```
開發階段：
  → 本地電腦（npm run dev）

測試階段：
  → VPS（如 DigitalOcean $6/月方案）
  → PM2 守護進程

生產階段：
  → AWS / Google Cloud（高可用性）
  → Docker 容器化部署
  → 設定自動重啟與日誌監控
```

---

## 📚 參考資源

### API 文件
- [CCXT 官方文件](https://docs.ccxt.com/)
- [Binance API 文件](https://binance-docs.github.io/apidocs/spot/en/)
- [Binance Testnet](https://testnet.binance.vision/)

### 風險管理
- 《交易心理分析》（Mark Douglas）
- 2% 風險規則：單筆交易風險不超過總資金 2%
- Kelly Criterion 公式：最佳倉位 = (勝率 × 平均盈利 - 敗率 × 平均虧損) / 平均盈利

### 技術社群
- CCXT GitHub Issues
- Binance API Telegram 群組
- QuantConnect 論壇

---

## 📝 版本歷史

- **v1.0** (2026-01-11)：初版規劃文件
  - 完成現狀分析
  - 定義核心功能需求
  - 制定實施路線圖

---

## 🎯 下一步行動

**推薦優先實作順序：**

1️⃣ **交易所API整合** → 測試私有API功能
2️⃣ **風險管理系統** → 建立安全機制
3️⃣ **訂單執行引擎** → 實現自動下單
4️⃣ **持倉監控** → 自動止盈止損
5️⃣ **通知系統** → 即時掌握交易狀態

**立即可執行：**
```bash
# 1. 註冊 Binance Testnet
# 訪問：https://testnet.binance.vision/

# 2. 建立環境變數檔案
cp .env.example .env.local

# 3. 安裝新依賴（如需要）
npm install better-sqlite3 node-telegram-bot-api

# 4. 開始實作第一個模組
# 建議從 src/lib/trading/exchange.ts 開始
```

---

**準備好了嗎？告訴我你想先從哪個部分開始！** 🚀
