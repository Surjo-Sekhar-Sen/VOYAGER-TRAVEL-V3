"""Multi-source news scraper for Bengaluru-specific news."""

import httpx
from bs4 import BeautifulSoup
from backend.services.proxy_manager import proxy_manager
from backend.services.clients.reddit_client import reddit_client


class NewsScraper:
    """Aggregate news from multiple sources:
    - Reddit r/bangalore (primary, most reliable for local news)
    - DuckDuckGo News search
    - Times of India Bangalore
    - The Hindu Bangalore
    """

    async def get_news(
        self, query: str = "", lat: float = None, lng: float = None,
        limit: int = 5
    ) -> list[dict]:
        """Get latest Bengaluru news from all sources."""
        all_news = []
        seen_urls = set()

        # 1. Reddit (primary)
        try:
            reddit_news = await reddit_client.get_news(query or "bangalore traffic news", limit)
            for item in reddit_news:
                if item.get("url") not in seen_urls:
                    seen_urls.add(item["url"])
                    item["source_type"] = "reddit"
                    all_news.append(item)
        except Exception:
            pass

        # 2. DuckDuckGo News
        try:
            web_news = await self._search_web_news(query or "bangalore", limit)
            for item in web_news:
                if item.get("url") not in seen_urls:
                    seen_urls.add(item["url"])
                    item["source_type"] = "web"
                    all_news.append(item)
        except Exception:
            pass

        all_news.sort(key=lambda x: x.get("score", 0) if x.get("source_type") == "reddit" else 0, reverse=True)
        return all_news[:limit]

    async def _search_web_news(self, query: str, limit: int) -> list[dict]:
        """Search for news via web scraping."""
        results = []
        headers = proxy_manager.get_headers()
        proxy = await proxy_manager.get_proxy(tier=2)

        sources = [
            {
                "name": "Times of India",
                "url": f"https://timesofindia.indiatimes.com/topic/{query.replace(' ', '-')}",
                "selector": "a[href*='/articleshow/']",
            },
            {
                "name": "The Hindu",
                "url": f"https://www.thehindu.com/search/?q={query.replace(' ', '+')}",
                "selector": "a[href*='/article']",
            },
        ]

        for source in sources:
            try:
                async with httpx.AsyncClient(
                    timeout=10.0, proxies=proxy, verify=False, follow_redirects=True
                ) as client:
                    resp = await client.get(source["url"], headers=headers)
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, "html.parser")
                        links = soup.select(source["selector"])[:limit]
                        for link in links:
                            href = link.get("href", "")
                            if href and not href.startswith("http"):
                                href = f"https://{source['name'].lower().replace(' ', '')}.indiatimes.com{href}"
                            title = link.get_text(strip=True)
                            if title and len(title) > 20:
                                results.append({
                                    "title": title[:200],
                                    "url": href,
                                    "score": 0,
                                    "num_comments": 0,
                                    "source": source["name"],
                                })
            except Exception:
                continue

        return results

    async def get_traffic_news(self, limit: int = 3) -> list[dict]:
        """Get traffic-specific news."""
        return await self.get_news("bangalore traffic road jam", limit)

    async def get_event_news(
        self, area: str = "", limit: int = 3
    ) -> list[dict]:
        """Get area-specific event news."""
        query = f"bangalore {area} event news" if area else "bangalore events"
        return await self.get_news(query, limit)


news_scraper = NewsScraper()
