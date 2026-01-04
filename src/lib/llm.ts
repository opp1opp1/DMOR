import { GoogleGenerativeAI } from '@google/generative-ai';

// Models to try in order of preference/cost
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(model: any, prompt: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error: any) {
      if (error?.message?.includes('429') || error?.status === 429) {
        if (i === retries - 1) throw error;
        const waitTime = 2000 * Math.pow(2, i); // 2s, 4s, 8s
        console.warn(`Rate limit hit. Retrying in ${waitTime}ms...`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
}

export async function getDecisionFromLLM(
  symbol: string,
  price: number,
  technicalData: any,
  news: string[] = []
): Promise<LLMDecision | null> {
  const genAI = getGenAI();
  // Use gemini-1.5-flash for potentially better stability/limits, or stick to 2.0-flash-exp if preferred.
  // Using 2.0-flash-exp as primary for now.
  const model = genAI.getGenerativeModel({ 
    model: MODELS[0], 
    generationConfig: { responseMimeType: "application/json" }
  });

  // Step 1: Technical Analysis
  const technicalPrompt = `
    You are a Technical Analysis Expert. Analyze ${symbol}.
    
    Data:
    - Price: ${price}
    - RSI(14): ${technicalData.rsi.toFixed(2)}
    - SMA(20): ${technicalData.sma.toFixed(2)}
    - Price vs SMA: ${price > technicalData.sma ? 'Above' : 'Below'}
    - Recent Closes: ${technicalData.recentCloses.join(', ')}

    Output JSON:
    {
      "signal": "BUY" | "SELL" | "HOLD",
      "strength": number, // 0-100
      "key_levels": "Support/Resistance levels identified",
      "analysis": "Brief technical analysis"
    }
  `;

  // Step 2: News/Sentiment Analysis
  const newsPrompt = `
    You are a Crypto Market Sentiment Analyst. Analyze news for ${symbol}.
    
    News Headlines:
    ${news.length > 0 ? news.join('\n') : 'No specific news.'}

    Output JSON:
    {
      "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
      "impact_score": number, // 0-100 (How much should this impact trade decision)
      "key_events": "Summary of critical events",
      "analysis": "Brief sentiment analysis"
    }
  `;

  try {
    // Run Technical and News analysis in parallel with retry logic
    const [techResult, newsResult] = await Promise.all([
      generateWithRetry(model, technicalPrompt),
      generateWithRetry(model, newsPrompt)
    ]);

    // Small delay to be gentle
    await delay(1000);

    // Step 3: Synthesis & Final Decision
    const finalPrompt = `
      You are a Lead Portfolio Manager. Synthesize the following reports to create a trading setup for ${symbol}.

      1. Technical Analysis Report:
      ${JSON.stringify(techResult, null, 2)}

      2. Sentiment/News Report:
      ${JSON.stringify(newsResult, null, 2)}

      Context: Current Price is ${price}.

      Task:
      - Weigh technicals vs sentiment.
      - If technicals and news conflict, prioritize risk management (HOLD or tight stops).
      - If aligned, propose a strong setup.
      
      Output strictly valid JSON:
      {
        "action": "BUY" | "SELL" | "HOLD",
        "confidence": number, // 0-100
        "reason": "Synthesized strategy in Traditional Chinese (Taiwan). Max 30 words.",
        "setup": {
          "entry": "Specific price or range",
          "tp": ["Target 1", "Target 2"], 
          "sl": "Stop Loss price",
          "leverage": "Recommended leverage (e.g. '5x' or 'spot')"
        }
      }
    `;

    const finalResult = await generateWithRetry(model, finalPrompt);
    return finalResult as LLMDecision;

  } catch (error) {
    console.error(`Error in 3-step AI analysis for ${symbol}:`, error);
    return null;
  }
}
