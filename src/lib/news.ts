import Parser from 'rss-parser';

const parser = new Parser();

const GENERAL_FEEDS = [
  'https://cointelegraph.com/rss',
  'https://www.coindesk.com/arc/outboundfeeds/rss/'
];

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
  source: string;
}

async function fetchFeed(url: string, sourceName: string): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.map(item => ({
      title: item.title || '',
      link: item.link || '',
      pubDate: item.pubDate || new Date().toISOString(),
      snippet: item.contentSnippet || item.content || '',
      source: sourceName
    }));
  } catch (error) {
    console.warn(`Failed to fetch RSS from ${sourceName}:`, error);
    return [];
  }
}

export async function getNewsContext(symbol: string, limit: number = 5): Promise<NewsItem[]> {
  const baseSymbol = symbol.split('/')[0].toUpperCase();
  const coinNameMap: Record<string, string> = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'SOL': 'Solana',
    'BNB': 'Binance Coin',
    'XRP': 'Ripple',
    'DOGE': 'Dogecoin',
    'ADA': 'Cardano',
    'AVAX': 'Avalanche'
  };
  
  const query = coinNameMap[baseSymbol] || baseSymbol;
  // Use Google News RSS for specific token search (Free & Reliable)
  const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' crypto')}&hl=en-US&gl=US&ceid=US:en`;
  
  const promises = [
    fetchFeed(googleNewsUrl, 'Google News'),
    ...GENERAL_FEEDS.map(url => fetchFeed(url, 'General Media'))
  ];

  const results = await Promise.all(promises);
  const allNews = results.flat();

  // Deduplication based on similar titles (simple check)
  const uniqueNews: NewsItem[] = [];
  const seenTitles = new Set();

  for (const item of allNews) {
    const normalizedTitle = item.title.toLowerCase().slice(0, 20); // Check first 20 chars
    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      uniqueNews.push(item);
    }
  }

  // Scoring/Sorting:
  // 1. Prioritize news containing the symbol/name in title
  // 2. Sort by date
  uniqueNews.sort((a, b) => {
    const aRel = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
    const bRel = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
    
    if (aRel !== bRel) return bRel - aRel; // Priority to relevant news
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(); // Then newness
  });

  return uniqueNews.slice(0, limit);
}

// Helper to format for AI Prompt
export function formatNewsForAI(news: NewsItem[]): string {
  return news.map(n => 
    `[${n.source}] ${n.title} (${new Date(n.pubDate).toLocaleDateString()})\n   Summary: ${n.snippet.slice(0, 150)}...`
  ).join('\n\n');
}

// Helper for UI display (simplified)
export function formatNewsForDisplay(news: NewsItem[]): string[] {
  return news.map(n => `[${n.source}] ${n.title}`);
}
