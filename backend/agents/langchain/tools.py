import json
import httpx
from bs4 import BeautifulSoup
from backend.core.config import settings


async def web_search(query: str, max_results: int = 5) -> list[dict]:
    snippets = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://html.duckduckgo.com/html/?q={query}",
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            )
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                for r in soup.select(".result__body")[:max_results]:
                    snippet = r.get_text(strip=True)[:300]
                    if snippet:
                        link_tag = r.select_one("a")
                        url = link_tag.get("href", "") if link_tag else ""
                        snippets.append({"snippet": snippet, "url": url})
    except Exception:
        pass
    return snippets


async def search_google_places(query: str, lat: float = None, lng: float = None) -> list[dict]:
    location = f"near {lat},{lng}" if lat and lng else "in Bengaluru"
    search_results = await web_search(f"{query} {location} Google Maps", 3)
    if not search_results:
        return []
    results = []
    for r in search_results:
        results.append({
            "name": query,
            "snippet": r["snippet"][:200],
            "url": r["url"],
            "source": "google_maps",
        })
    return results


async def search_justdial(query: str, city: str = "Bengaluru") -> list[dict]:
    search_results = await web_search(f"{query} {city} JustDial reviews", 3)
    if not search_results:
        return []
    results = []
    for r in search_results:
        results.append({
            "name": query,
            "snippet": r["snippet"][:200],
            "url": r["url"],
            "source": "justdial",
        })
    return results


async def get_weather(location: str = "Bengaluru") -> dict:
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"https://wttr.in/{location}?format=j1",
                headers={"User-Agent": "curl/8.0"},
            )
            if resp.status_code == 200:
                d = resp.json()
                c = d.get("current_condition", [{}])[0]
                return {
                    "condition": c.get("weatherDesc", [{}])[0].get("value", "clear"),
                    "temperature_celsius": c.get("temp_C", "28"),
                    "humidity": c.get("humidity", "50"),
                    "wind_speed_kmh": c.get("windspeedKmph", "10"),
                    "feels_like": c.get("FeelsLikeC", "28"),
                }
    except Exception:
        pass
    return {"condition": "clear", "temperature_celsius": "28"}


async def get_traffic_updates(location: str = "Bengaluru") -> list[dict]:
    search_results = await web_search(f"{location} traffic jam road block today", 3)
    if not search_results:
        return []
    items = []
    for r in search_results:
        items.append({
            "title": "Traffic Update",
            "description": r["snippet"][:200],
            "source": "web",
        })
    return items


async def fetch_hotel_prices(name: str, city: str = "Bengaluru") -> dict:
    search_results = await web_search(f"{name} {city} hotel room price per night", 3)
    snippet_text = " | ".join([r["snippet"][:100] for r in search_results])
    return {
        "name": name,
        "city": city,
        "web_snippets": snippet_text[:500],
        "source": "web_search",
    }


async def get_reviews_from_web(name: str, address: str = None) -> list[dict]:
    addr = address or f"{name}, Bengaluru"
    search_results = await web_search(f"{name} {addr} reviews rating google justdial", 5)
    if not search_results:
        return []
    reviews = []
    for r in search_results:
        reviews.append({
            "text": r["snippet"][:250],
            "url": r["url"],
            "source": "web",
        })
    return reviews
