import httpx
import json
from backend.core.config import settings

N8N_BASE = settings.N8N_WEBHOOK_URL.rstrip("/")

class N8NService:

    def _extract_llm_content(self, data: dict) -> str | None:
        try:
            content = data["choices"][0]["message"]["content"]
            content = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return content
        except (KeyError, IndexError, TypeError, AttributeError):
            return None

    async def verify_place(self, name: str, address: str = None) -> dict | None:
        if not settings.N8N_WEBHOOK_URL:
            return None
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{N8N_BASE}/verify-place",
                    json={"name": name, "address": address or f"{name}, Bengaluru"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = self._extract_llm_content(data)
                    if content:
                        parsed = json.loads(content)
                        return {
                            "reliability_score": float(parsed.get("reliability_score", 0.7)),
                            "rating": float(parsed.get("rating", 4.0)),
                            "review_summary": parsed.get("review_summary", ""),
                            "is_recommended": bool(parsed.get("is_recommended", True)),
                            "concerns": str(parsed.get("concerns", "")),
                            "source": "n8n",
                        }
        except (httpx.ConnectError, httpx.TimeoutException):
            pass
        except Exception:
            pass
        return None

    async def get_weather_impact(self, location: str = "Bengaluru") -> dict | None:
        if not settings.N8N_WEBHOOK_URL:
            return None
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{N8N_BASE}/weather-traffic",
                    json={"location": location},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = self._extract_llm_content(data)
                    if content:
                        parsed = json.loads(content)
                        return {
                            "condition": parsed.get("condition", "clear"),
                            "temperature_celsius": parsed.get("temperature_celsius", "28"),
                            "impact": parsed.get("impact", "minor"),
                            "recommendation": parsed.get("recommendation", "Good for travel"),
                            "traffic_alert": parsed.get("traffic_alert", ""),
                            "source": "n8n",
                        }
        except (httpx.ConnectError, httpx.TimeoutException):
            pass
        except Exception:
            pass
        return None

    async def get_ride_prices(self, source: str, destination: str) -> list[dict] | None:
        if not settings.N8N_WEBHOOK_URL:
            return None
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{N8N_BASE}/ride-prices",
                    json={"source": source, "destination": destination},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = self._extract_llm_content(data)
                    if content:
                        parsed = json.loads(content)
                        prices = parsed if isinstance(parsed, list) else parsed.get("prices", [parsed])
                        for p in prices:
                            p["source"] = "n8n"
                        return prices
        except (httpx.ConnectError, httpx.TimeoutException):
            pass
        except Exception:
            pass
        return None

    async def get_hotel_prices(self, name: str, address: str = None) -> dict | None:
        if not settings.N8N_WEBHOOK_URL:
            return None
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{N8N_BASE}/hotel-prices",
                    json={"name": name, "address": address or f"{name}, Bengaluru"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = self._extract_llm_content(data)
                    if content:
                        parsed = json.loads(content)
                        parsed["source"] = "n8n"
                        return parsed
        except (httpx.ConnectError, httpx.TimeoutException):
            pass
        except Exception:
            pass
        return None

    async def get_place_reviews(self, name: str, address: str = None) -> dict | None:
        if not settings.N8N_WEBHOOK_URL:
            return None
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"{N8N_BASE}/place-reviews",
                    json={"name": name, "address": address or f"{name}, Bengaluru"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = self._extract_llm_content(data)
                    if content:
                        parsed = json.loads(content)
                        parsed["source"] = "n8n_web"
                        return parsed
        except (httpx.ConnectError, httpx.TimeoutException):
            pass
        except Exception:
            pass
        return None

    async def is_available(self) -> bool:
        if not settings.N8N_WEBHOOK_URL:
            return False
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{N8N_BASE.replace('/webhook', '')}/healthz")
                return resp.status_code == 200
        except Exception:
            return False

n8n_service = N8NService()
