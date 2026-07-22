import json
from datetime import datetime
from backend.agents.langchain.base import base_agent
from backend.agents.langchain.tools import get_weather, get_traffic_updates, web_search


class RouteAdvisorAgent:

    async def get_weather_impact(self, location: str = "Bengaluru") -> dict:
        weather = await get_weather(location)
        condition = (weather.get("condition", "") or "").lower()
        is_rainy = any(w in condition for w in ["rain", "drizzle", "thunder", "shower"])
        is_hot = False
        try:
            temp = float(weather.get("temperature_celsius", 28))
            is_hot = temp > 35
        except (ValueError, TypeError):
            pass

        recommendation = "Good for travel"
        if is_rainy:
            recommendation = "Carry umbrella, expect wet roads. Cabs recommended over walking/bike."
        elif is_hot:
            recommendation = "Very hot. AC transport recommended. Carry water."
        elif "clear" in condition or "sunny" in condition:
            recommendation = "Pleasant weather for travel."

        return {
            "condition": weather.get("condition", "clear"),
            "temperature_celsius": weather.get("temperature_celsius", "28"),
            "impact": "high" if is_rainy else "moderate" if is_hot else "minor",
            "recommendation": recommendation,
            "is_rainy": is_rainy,
            "is_hot": is_hot,
        }

    async def get_traffic_conditions(self, route: str = None) -> dict:
        if route:
            traffic_info = await get_traffic_updates(route)
        else:
            traffic_info = await get_traffic_updates("Bengaluru")

        current_hour = datetime.now().hour
        is_peak = (8 <= current_hour <= 10) or (17 <= current_hour <= 20)
        is_night = current_hour < 6 or current_hour > 21

        items = []
        for t in traffic_info[:3]:
            items.append({
                "description": t.get("description", "")[:150],
                "source": t.get("source", "web"),
            })

        return {
            "time_of_day": "morning_peak" if 8 <= current_hour <= 10
                           else "evening_peak" if 17 <= current_hour <= 20
                           else "night" if current_hour < 6 or current_hour > 21
                           else "off_peak",
            "is_peak_hour": is_peak,
            "is_night": is_night,
            "alerts": items,
        }

    async def get_safety_rating(
        self, mode: str, distance_km: float, is_night: bool, is_rainy: bool, group_size: int
    ) -> dict:
        safety_score = 8
        concerns = []

        if is_night:
            if mode in ("walk", "bike"):
                safety_score -= 3
                concerns.append("Night travel: walk/bike not recommended")
            if mode == "bus_ordinary":
                safety_score -= 1
                concerns.append("Night: bus frequency reduced")
            if mode in ("cab", "car"):
                safety_score += 1
        if is_rainy:
            if mode in ("bike", "walk"):
                safety_score -= 2
                concerns.append("Rain: bike/walk slippery and uncomfortable")
        if distance_km > 15 and mode in ("bike", "walk"):
            safety_score -= 2
            concerns.append(f"Long distance ({distance_km:.0f}km) not suitable for {mode}")
        if group_size <= 2 and mode == "bus_ordinary" and is_night:
            safety_score -= 1
            concerns.append("Small group on bus at night - consider cab")

        safety_score = max(1, min(10, safety_score))
        return {
            "score": safety_score,
            "label": "Safe" if safety_score >= 7 else "Moderate" if safety_score >= 4 else "Avoid",
            "concerns": concerns[:3],
        }

    async def get_route_recommendation(
        self,
        source: str,
        dest: str,
        group_size: int,
        budget: float = None,
        distance_km: float = None,
    ) -> dict:
        budget_str = f"budget ₹{budget}" if budget else "no specific budget"
        weather = await self.get_weather_impact()
        traffic = await self.get_traffic_conditions(f"{source} to {dest}")
        is_rainy = weather.get("is_rainy", False)
        is_night = traffic.get("is_night", False)
        is_peak = traffic.get("is_peak_hour", False)

        context = f"""
Weather: {json.dumps(weather)}
Traffic: {json.dumps(traffic)}
Distance: {distance_km} km (if available)
Group: {group_size} people
Budget: {budget_str}
Time: {datetime.now().strftime('%H:%M')}
"""

        system_prompt = """You are a Bengaluru transit route advisor. Analyze the context and recommend the best route.
Consider: weather, traffic, time of day, group size, budget, safety, walking distance, comfort.
Return ONLY valid JSON."""

        user_prompt = f"""Given this context for travel from {source} to {dest}:

{context}

Recommend the top 3 route strategies. For each include:
1. recommended_mode (walk/bus_ordinary/bus_ac_vajra/metro/cab/auto/bike/combined)
2. estimated_cost (min and max in INR)
3. estimated_time_minutes
4. safety_rating (1-10)
5. pros (array of strings)
6. cons (array of strings)

Return JSON with:
{{
  "recommended_mode": "best single mode",
  "top_routes": [
    {{
      "mode": "mode_name",
      "label": "human readable label",
      "cost_min": int,
      "cost_max": int,
      "time_minutes": int,
      "safety": int,
      "pros": [...],
      "cons": [...]
    }}
  ],
  "tips": ["tip1", "tip2", "tip3"],
  "current_issues": ["issue1", "issue2"],
  "weather_recommendation": "brief weather note"
}}"""

        try:
            text = await base_agent._call_llm(system_prompt, user_prompt, json_mode=True)
            result = base_agent._extract_json(text)
            return {
                **{
                    "recommended_mode": "cab",
                    "top_routes": [],
                    "tips": [],
                    "current_issues": [],
                    "weather_recommendation": "",
                },
                **result,
            }
        except Exception:
            return {
                "recommended_mode": "cab",
                "top_routes": [],
                "tips": ["Consider traffic timing", "Check weather before leaving"],
                "current_issues": [],
                "weather_recommendation": "",
            }

    async def get_travel_news(self, source: str = None, dest: str = None) -> list[dict]:
        query_parts = []
        if source:
            query_parts.append(source)
        if dest:
            query_parts.append(dest)
        query_parts.append("Bengaluru travel traffic news today")
        query = " ".join(query_parts)

        news_results = await web_search(query, 5)
        if not news_results:
            return self._default_news(source, dest)

        web_snippets = "\n".join([f"- {r['snippet'][:200]}" for r in news_results])

        system_prompt = """Extract recent travel news relevant to this route. Return JSON array."""
        user_prompt = f"""Web search results for Bengaluru travel: {web_snippets[:3000]}

Extract 3-6 travel news items. Return JSON array with:
- title (short headline)
- description (1 sentence, mention specific road/area)
- impact ("positive"|"negative"|"info")
- source ("web"|"alert")
- timestamp ("Just now"|"Today"|"Yesterday")
- lat (12.8-13.2), lng (77.4-77.8)

Rules: Include traffic, metro, weather, events. Mix positive and negative."""

        try:
            text = await base_agent._call_llm(system_prompt, user_prompt, json_mode=True)
            result = json.loads(text) if isinstance(text, str) else text
            if isinstance(result, dict):
                for v in result.values():
                    if isinstance(v, list):
                        result = v
                        break
            if isinstance(result, list):
                for item in result:
                    item.setdefault("source", "web")
                    item.setdefault("impact", "info")
                    item.setdefault("lat", 12.9716)
                    item.setdefault("lng", 77.5946)
                return result[:6]
        except Exception:
            pass
        return self._default_news(source, dest)

    def _default_news(self, source=None, dest=None) -> list[dict]:
        return [
            {"title": "Bengaluru Traffic Advisory", "description": "Peak hour traffic on MG Road and Outer Ring Road. Plan extra 15-20 min.", "impact": "negative", "source": "alert", "timestamp": "Today", "lat": 12.9716, "lng": 77.5946},
            {"title": "Metro Running on Schedule", "description": "Namma Metro Purple & Green lines operating normally.", "impact": "positive", "source": "alert", "timestamp": "Just now", "lat": 12.9767, "lng": 77.5713},
            {"title": "Weather Update", "description": "Pleasant weather for travel today in Bengaluru.", "impact": "positive", "source": "web", "timestamp": "Today", "lat": 12.9716, "lng": 77.5946},
            {"title": "Road Work Alert", "description": "Namma Metro construction on Silk Board junction. Expect delays.", "impact": "negative", "source": "alert", "timestamp": "Today", "lat": 12.9150, "lng": 77.6220},
        ]


route_advisor = RouteAdvisorAgent()
