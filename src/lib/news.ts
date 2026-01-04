import Parser from 'rss-parser';

const parser = new Parser();

const NEWS_FEEDS = [
  'https://cointelegraph.com/rss',
  'https://www.coindesk.com/arc/outboundfeeds/rss/'
];

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
}

export async function getLatestNews(limit: number = 5): Promise<string[]> {
  const allNews: NewsItem[] = [];

  for (const feedUrl of NEWS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      feed.items.forEach(item => {
        allNews.push({
          title: item.title || '',
          link: item.link || '',
          pubDate: item.pubDate || '',
          snippet: item.contentSnippet || item.content || ''
        });
      });
    } catch (error) {
      console.error(`Error fetching news from ${feedUrl}:`, error);
    }
  }

  // Sort by date (newest first)
  allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  // Return formatted strings
  return allNews.slice(0, limit).map(item => 
    `- ${item.title} (${new Date(item.pubDate).toLocaleDateString()})`
  );
}
