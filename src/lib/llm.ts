import { GoogleGenerativeAI } from '@google/generative-ai';

// Models to try in order of preference/cost
const MODELS = ['gemini-2.0-flash-exp', 'gemini-1.5-flash'];

export interface LLMDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  reason: string;
  setup?: {
    entry: string;      // Recommended entry price range
    tp: string[];       // Take Profit targets
    sl: string;         // Stop Loss target
    leverage: string;   // Recommended leverage (e.g., "5x", "10x")
  }
}

function getGenAI() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function getDecisionFromLLM(
  symbol: string,
  price: number,
  technicalData: any,
  news: string[] = []
): Promise<LLMDecision | null> {
  const genAI = getGenAI();
  const prompt = `
    You are an expert crypto derivatives trader.
    Analyze the following market data for ${symbol} and provide a COMPLETE TRADING SETUP.
    
    Current Market Context:
    - Symbol: ${symbol}
    - Current Price: ${price}
    - Technical Indicators (4H):
      - RSI (14): ${technicalData.rsi.toFixed(2)}
      - SMA (20): ${technicalData.sma.toFixed(2)}
      - Price vs SMA: ${price > technicalData.sma ? 'Above (Bullish)' : 'Below (Bearish)'}
    - Recent Price Action (Last 5 closes): ${technicalData.recentCloses.join(', ')}

    Recent Market News & Sentiment:
    ${news.length > 0 ? news.join('\n') : 'No recent news available.'}

    Your Task:
    1. Determine action: BUY (Long), SELL (Short), or HOLD.
    2. If BUY or SELL, provide a specific setup based on support/resistance logic.
    3. If HOLD, leave the setup fields empty or null.
    4. Consider the news impact on the specific token if relevant (e.g. macro events, regulatory news).

    Output strictly valid JSON:
    {
      "action": "BUY" | "SELL" | "HOLD",
      "confidence": number, // 0-100
      "reason": "Concise strategy logic in Traditional Chinese (Taiwan). Max 20 words.",
      "setup": {
        "entry": "Specific price or range (e.g. '87500 - 87800')",
        "tp": ["Target 1", "Target 2"], 
        "sl": "Stop Loss price",
        "leverage": "Recommended leverage (e.g. '5x-10x' based on volatility)"
      }
    }
  `;

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return JSON.parse(text) as LLMDecision;
    } catch (error) {
      console.warn(`Model ${modelName} failed:`, error);
      continue;
    }
  }

  return null;
}
