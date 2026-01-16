# Trading Module

自動交易系統的核心模組。

## 📁 模組結構

```
src/lib/trading/
├── exchange.ts          # 交易所 API 封裝
├── risk-manager.ts      # 風險管理（待實作）
├── executor.ts          # 訂單執行引擎（待實作）
├── position-monitor.ts  # 持倉監控服務（待實作）
└── database.ts          # 資料存取層（待實作）
```

---

## 🔧 Exchange API 模組

### 功能特性

- ✅ 統一的交易所 API 介面
- ✅ 支援測試網/正式網切換
- ✅ Mock 模式（離線開發）
- ✅ 自動重試機制（指數退避）
- ✅ API 限流處理
- ✅ 完整的錯誤處理

### 使用範例

```typescript
import { createExchangeFromEnv } from '@/lib/trading/exchange';

// 從環境變數創建實例
const exchange = createExchangeFromEnv();

// 測試連接
await exchange.testConnection();

// 查詢餘額
const balances = await exchange.fetchBalance();
console.log('USDT Balance:', balances.find(b => b.currency === 'USDT')?.total);

// 查詢價格
const btcPrice = await exchange.fetchPrice('BTC/USDT');
console.log('BTC Price:', btcPrice);

// 下市價單
const order = await exchange.createOrder({
  symbol: 'BTC/USDT',
  side: 'buy',
  type: 'market',
  amount: 0.001,
});

// 設置止損
await exchange.createStopLoss('BTC/USDT', 'sell', 0.001, 40000);

// 設置止盈
await exchange.createTakeProfit('BTC/USDT', 'sell', 0.001, 50000);

// 查詢掛單
const openOrders = await exchange.fetchOpenOrders('BTC/USDT');

// 取消訂單
await exchange.cancelOrder(order.id, 'BTC/USDT');
```

### 手動創建實例

```typescript
import { ExchangeAPI } from '@/lib/trading/exchange';

const exchange = new ExchangeAPI({
  apiKey: 'your_api_key',
  secret: 'your_secret',
  testnet: true,      // 使用測試網
  mockMode: false,    // 禁用 Mock 模式
});
```

### Mock 模式

當無法連接到交易所 API 時（網絡限制、離線開發），自動啟用 Mock 模式：

```typescript
// 在 .env.local 中設置
EXCHANGE_MOCK_MODE=true

// 或在代碼中啟用
const exchange = new ExchangeAPI({
  apiKey: '',
  secret: '',
  testnet: true,
  mockMode: true,  // 啟用 Mock 模式
});
```

Mock 模式提供：
- 模擬餘額（10,000 USDT, 0.5 BTC, 5 ETH）
- 模擬價格（BTC: 45,000, ETH: 2,500, etc.）
- 模擬訂單執行（立即成交）

### 環境變數

```env
# Binance API 設定
BINANCE_API_KEY=your_api_key_here
BINANCE_SECRET_KEY=your_secret_key_here
BINANCE_TESTNET=true

# Mock 模式（選配）
EXCHANGE_MOCK_MODE=false
```

---

## 🧪 測試

```bash
# 測試 API 連接（會嘗試真實連接，失敗後切換到 Mock）
npm run tsx scripts/test-exchange-api.ts

# 驗證 API Key 格式（本地驗證）
npm run tsx scripts/verify-api-key.ts

# 完整的 Binance API 測試（需要網絡訪問）
npm run tsx scripts/test-binance-api.ts
```

---

## 🔒 安全提示

1. **永遠不要提交 API Keys 到 Git**
   - `.env.local` 已在 `.gitignore` 中排除

2. **使用最小權限**
   - 只啟用「讀取」和「交易」權限
   - 禁用「提現」權限

3. **設定 IP 白名單**
   - 在 Binance 設定中限制 API 訪問 IP

4. **定期更換 API Key**
   - 建議每 3-6 個月更換一次

5. **先用測試網**
   - 開發和測試時使用 Binance Testnet
   - 確認穩定後再用真實資金

---

## 📚 API 參考

### ExchangeAPI 類

#### 方法

- `testConnection()`: 測試與交易所的連接
- `fetchBalance()`: 查詢帳戶餘額
- `fetchPrice(symbol)`: 查詢交易對價格
- `createOrder(params)`: 創建訂單
- `createStopLoss(symbol, side, amount, stopPrice)`: 創建止損訂單
- `createTakeProfit(symbol, side, amount, takeProfitPrice)`: 創建止盈訂單
- `cancelOrder(orderId, symbol)`: 取消訂單
- `fetchOpenOrders(symbol?)`: 查詢掛單
- `fetchOrder(orderId, symbol)`: 查詢訂單狀態
- `fetchPositions(symbol?)`: 查詢持倉（合約交易）

### 類型定義

```typescript
interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
}

interface Balance {
  currency: string;
  free: number;
  used: number;
  total: number;
}

interface Order {
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
```

---

## 🐛 錯誤處理

模組自動處理以下錯誤：

- **網絡錯誤**: 自動重試 3 次（指數退避）
- **API 限流**: 等待 60 秒後重試
- **認證錯誤**: 立即拋出錯誤（不重試）
- **餘額不足**: 立即拋出錯誤（不重試）

```typescript
try {
  const order = await exchange.createOrder({...});
} catch (error) {
  if (error.message.includes('insufficient balance')) {
    // 處理餘額不足
  } else if (error.message.includes('rate limit')) {
    // 處理限流
  }
}
```

---

## 📝 開發筆記

### 當前狀態
- ✅ 交易所 API 封裝完成
- ⏳ 風險管理系統（待實作）
- ⏳ 訂單執行引擎（待實作）
- ⏳ 持倉監控服務（待實作）

### 下一步
1. 實作風險管理系統 (`risk-manager.ts`)
2. 實作訂單執行引擎 (`executor.ts`)
3. 實作持倉監控服務 (`position-monitor.ts`)
4. 整合 AI 信號自動交易

---

## 🌐 部署

### 本地開發
```bash
# 使用 Mock 模式
EXCHANGE_MOCK_MODE=true npm run dev
```

### 測試網部署
```bash
# 使用 Binance Testnet
BINANCE_TESTNET=true npm run start
```

### 生產環境
```bash
# 使用真實 API
BINANCE_TESTNET=false npm run start
```

**⚠️ 警告**: 生產環境請務必小心，建議從小額資金開始測試。
