"""Review analysis tools for LangGraph agents."""

from backend.services.clients.serpapi_client import serpapi_client
from backend.services.clients.reddit_client import reddit_client
from backend.services.scrapers.justdial_scraper import justdial_scraper
from backend.services.scrapers.ddg_scraper import ddg_scraper


async def get_place_reviews(name: str, address: str = None) -> dict | None:
    """Get real reviews for a place from multiple sources."""
    addr = address or f"{name}, Bengaluru"
    reviews_data = []

    # 1. SerpAPI (Google Reviews) — most reliable
    if serpapi_client.api_key:
        import urllib.parse
        params = {
            "engine": "google_maps",
            "q": f"{name} {addr}",
            "api_key": serpapi_client.api_key,
            "hl": "en",
            "gl": "in",
        }
        try:
            import httpx
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.get("https://serpapi.com/search", params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    place = serpapi_client._parse_place_detail(data)
                    if place and place.get("reviews"):
                        return {
                            "rating": place["rating"],
                            "reviews": place["reviews"],
                            "review_summary": _summarize_reviews(place["reviews"]),
                            "photos": place.get("photos", []),
                            "source": "google_maps",
                            "is_recommended": place.get("rating", 0) >= 3.5,
                            "reliability_score": min(1.0, place.get("review_count", 10) / 100) if place.get("review_count") else 0.5,
                        }
        except Exception:
            pass

    # 2. Reddit reviews
    try:
        reddit_results = await reddit_client.search_places(f"{name} review", limit=4)
        for r in reddit_results:
            title = r.get("title", "")
            selftext = r.get("selftext", "")
            top_comments = r.get("top_comments", [])
            for comment in top_comments:
                reviews_data.append({
                    "author": comment.get("author", "RedditUser"),
                    "rating": 0,
                    "text": comment.get("body", ""),
                    "date": "",
                    "source": "reddit",
                })
            if selftext and not reviews_data:
                reviews_data.append({
                    "author": r.get("author", "RedditUser"),
                    "rating": 0,
                    "text": selftext[:300],
                    "date": "",
                    "source": "reddit",
                })
    except Exception:
        pass

    # 3. JustDial reviews
    if not reviews_data:
        try:
            jd_results = await justdial_scraper.search(name)
            if jd_results:
                for jr in jd_results[:2]:
                    url = jr.get("url", "")
                    if url:
                        jd_reviews = await justdial_scraper.get_reviews(url, limit=3)
                        for r in jd_reviews:
                            r["source"] = "justdial"
                        reviews_data.extend(jd_reviews)
        except Exception:
            pass

    if reviews_data:
        avg_rating = sum(
            r.get("rating", 3) for r in reviews_data if r.get("rating", 0) > 0
        ) / max(len([r for r in reviews_data if r.get("rating", 0) > 0]), 1)

        return {
            "rating": avg_rating or 3.5,
            "reviews": reviews_data[:8],
            "review_summary": _summarize_reviews(reviews_data),
            "photos": [],
            "source": "mixed",
            "is_recommended": avg_rating >= 3.0,
            "reliability_score": min(0.7, len(reviews_data) / 10),
        }

    return None


async def get_place_photos(name: str) -> list[str]:
    """Get photos for a place."""
    if serpapi_client.api_key:
        detail = await serpapi_client.place_details(name)
        if detail and detail.get("photos"):
            return detail["photos"]
    return []


def _summarize_reviews(reviews: list[dict]) -> str:
    """Generate a concise summary from review texts."""
    if not reviews:
        return ""
    texts = [r.get("text", "") for r in reviews if r.get("text")]
    if not texts:
        return ""

    # Simple extractive summary
    positives = [t for t in texts if any(w in t.lower() for w in ["good", "great", "nice", "excellent", "clean", "friendly", "recommend", "best"])]
    negatives = [t for t in texts if any(w in t.lower() for w in ["bad", "poor", "dirty", "expensive", "rude", "worst", "avoid", "crowded"])]

    parts = []
    if positives:
        parts.append(f"Praised for: {positives[0][:120]}")
    if negatives:
        parts.append(f"Criticized for: {negatives[0][:120]}")

    return " | ".join(parts) if parts else (texts[0][:200] if texts else "")
