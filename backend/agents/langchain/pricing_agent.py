from backend.agents.langchain.base import base_agent
from backend.agents.langchain.tools import web_search


class PricingAgent:

    async def get_live_prices(
        self, source: str, dest: str, mode: str = "all"
    ) -> list[dict]:
        distance_km = await self._estimate_distance(source, dest)
        return self._compute_prices(distance_km, mode)

    async def _estimate_distance(self, source: str, dest: str) -> float:
        try:
            results = await web_search(f"distance between {source} and {dest} Bengaluru km", 2)
            for r in results:
                snippet = r.get("snippet", "")
                import re
                nums = re.findall(r'(\d+\.?\d*)\s*km', snippet)
                if nums:
                    return float(nums[0])
        except Exception:
            pass
        return 10.0

    def _compute_prices(self, distance_km: float, mode: str = "all") -> list[dict]:
        from datetime import datetime
        h = datetime.now().hour
        peak = (8 <= h <= 10) or (17 <= h <= 20)
        surge = 1.4 if peak else 1.0

        prices = []
        if mode in ("all", "cab"):
            base = round(25 + distance_km * 14 * surge)
            prices.append({"provider": "Uber", "mode": "cab", "price": base, "eta_minutes": 12, "note": "Uber Go estimate", "source": "distance_based"})
            prices.append({"provider": "Ola", "mode": "cab", "price": max(round(base * 0.95), 50), "eta_minutes": 10, "note": "Ola Mini estimate", "source": "distance_based"})
        if mode in ("all", "cab_xl"):
            base = round(35 + distance_km * 20 * surge)
            prices.append({"provider": "Uber", "mode": "cab_xl", "price": base, "eta_minutes": 15, "note": "Uber XL estimate", "source": "distance_based"})
        if mode in ("all", "auto"):
            base = round(15 + distance_km * 12 * surge)
            prices.append({"provider": "Rapido", "mode": "auto", "price": base, "eta_minutes": 10, "note": "Auto fare estimate", "source": "distance_based"})
        if mode in ("all", "bike"):
            base = round(10 + distance_km * 8 * surge)
            prices.append({"provider": "Rapido", "mode": "bike", "price": base, "eta_minutes": 15, "note": "Bike taxi estimate", "source": "distance_based"})
        return prices[:5]

    async def get_fuel_cost(self, distance_km: float, mileage_kmpl: float = 15.0) -> dict:
        """Estimate fuel cost for personal vehicle."""
        from backend.core.config import settings
        fuel_price = settings.FUEL_PRICE_PER_LITER
        liters = distance_km / mileage_kmpl
        cost = liters * fuel_price
        return {
            "distance_km": round(distance_km, 2),
            "mileage_kmpl": mileage_kmpl,
            "fuel_price_per_liter": fuel_price,
            "liters_required": round(liters, 2),
            "estimated_cost": round(cost, 2),
        }

    async def get_hotel_prices(self, name: str, city: str = "Bengaluru") -> dict:
        """Get hotel price estimates for a place."""
        search_results = await web_search(f"{name} {city} hotel room price per night booking", 3)
        web_context = " | ".join([r["snippet"][:150] for r in search_results]) if search_results else ""

        if not web_context:
            return {
                "name": name,
                "min_price": 0,
                "max_price": 0,
                "avg_price": 0,
                "currency": "INR",
                "source": "unavailable",
                "brief_summary": "",
            }

        system_prompt = """Extract hotel price information from web search results. Return JSON."""
        user_prompt = f"""Search results for {name} in {city}: {web_context[:1500]}

Extract hotel price info if available.
Return JSON: {{
  "min_price": int (lowest room price per night in INR),
  "max_price": int (highest room price per night),
  "avg_price": int (average price),
  "currency": "INR",
  "brief_summary": "1 sentence summary of options"
}}
If no prices found, set all to 0."""

        try:
            text = await base_agent._call_llm(system_prompt, user_prompt, json_mode=True)
            result = base_agent._extract_json(text)
            result["source"] = "langchain"
            result["name"] = name
            return result
        except Exception:
            return {"name": name, "min_price": 0, "max_price": 0, "avg_price": 0, "currency": "INR", "source": "unavailable"}


pricing_agent = PricingAgent()
