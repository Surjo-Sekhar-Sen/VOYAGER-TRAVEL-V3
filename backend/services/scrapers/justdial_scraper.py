"""JustDial reviews scraper with proxy support."""

import httpx
import re
from bs4 import BeautifulSoup
from backend.services.proxy_manager import proxy_manager


class JustDialScraper:
    """Scrape JustDial for Indian business reviews, ratings, and contact info."""

    async def search(
        self, query: str, city: str = "Bangalore", limit: int = 5
    ) -> list[dict]:
        """Search JustDial for businesses matching query."""
        results = []
        proxy = await proxy_manager.get_proxy(tier=2)
        headers = proxy_manager.get_headers()
        headers["Referer"] = "https://www.justdial.com/"

        search_url = f"https://www.justdial.com/{city}/{query.replace(' ', '%20')}"

        try:
            async with httpx.AsyncClient(
                timeout=15.0, proxies=proxy, verify=False, follow_redirects=True
            ) as client:
                resp = await client.get(search_url, headers=headers)
                if resp.status_code != 200:
                    return results

                soup = BeautifulSoup(resp.text, "html.parser")

                # JustDial search results
                store_boxes = soup.select(".storebox, .cntanr, .jca")[:limit]
                for box in store_boxes:
                    item = self._parse_store(box)
                    if item and item.get("name"):
                        results.append(item)

                # Fallback: try to extract from scripts
                if not results:
                    results = await self._extract_from_scripts(soup, limit)

        except Exception:
            # No-op, return whatever we got
            pass

        return results

    async def get_reviews(self, store_url: str, limit: int = 5) -> list[dict]:
        """Fetch reviews for a specific JustDial listing."""
        reviews = []
        proxy = await proxy_manager.get_proxy(tier=2)
        headers = proxy_manager.get_headers()
        headers["Referer"] = "https://www.justdial.com/"

        try:
            async with httpx.AsyncClient(
                timeout=15.0, proxies=proxy, verify=False, follow_redirects=True
            ) as client:
                resp = await client.get(store_url, headers=headers)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    review_blocks = soup.select(".jrev, .review-box, .rvw-card")[:limit]
                    for block in review_blocks:
                        review = {
                            "author": (block.select_one(".jrev-user, .rvwusr-nme") or block.select_one('[class*="user"]')).get_text(strip=True) if block.select_one('[class*="user"]') else "Anonymous",
                            "rating": self._extract_rating(block),
                            "text": (block.select_one(".jrev-txt, .rvw-desc") or block.select_one('[class*="review-text"]')).get_text(strip=True) if block.select_one('[class*="review-text"]') else "",
                            "date": (block.select_one(".jrev-date, .rvw-dte") or block.select_one('[class*="date"]')).get_text(strip=True) if block.select_one('[class*="date"]') else "",
                        }
                        if review["text"]:
                            reviews.append(review)
        except Exception:
            pass

        return reviews

    def _parse_store(self, box) -> dict | None:
        """Extract store info from JustDial box element."""
        try:
            name_el = box.select_one(".jcn a, .store-name a, .lng_cont_name")
            if not name_el:
                return None

            rating_el = box.select_one(".jdrating, .rating, .star-rating")
            contact_el = box.select_one(".contact-info, .mobilesv, [class*='phone']")
            addr_el = box.select_one(".addrs, .address-info, .cont_sw_addr")

            return {
                "name": name_el.get_text(strip=True),
                "url": name_el.get("href", ""),
                "rating": self._extract_rating(rating_el) if rating_el else 0,
                "phone": contact_el.get_text(strip=True) if contact_el else "",
                "address": addr_el.get_text(strip=True)[:150] if addr_el else "",
                "source": "justdial",
            }
        except Exception:
            return None

    async def _extract_from_scripts(self, soup, limit: int) -> list[dict]:
        """Fallback: extract data from JSON-LD scripts."""
        results = []
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                import json
                data = json.loads(script.string)
                if isinstance(data, dict):
                    item = {
                        "name": data.get("name", ""),
                        "rating": data.get("aggregateRating", {}).get("ratingValue", 0),
                        "address": data.get("address", {}).get("streetAddress", ""),
                        "phone": data.get("telephone", ""),
                        "url": data.get("url", ""),
                        "source": "justdial_jsonld",
                    }
                    if item["name"]:
                        results.append(item)
            except Exception:
                continue
        return results[:limit]

    @staticmethod
    def _extract_rating(el) -> float:
        """Extract numeric rating from element."""
        if not el:
            return 0.0
        text = el.get_text(strip=True)
        match = re.search(r"(\d+\.?\d*)", text)
        return float(match.group(1)) if match else 0.0


justdial_scraper = JustDialScraper()
