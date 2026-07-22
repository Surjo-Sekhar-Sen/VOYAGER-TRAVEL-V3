import json
from backend.agents.langchain.place_verifier import place_verifier
from backend.agents.langchain.route_advisor import route_advisor
from backend.agents.langchain.pricing_agent import pricing_agent
from backend.agents.langchain.review_agent import review_agent


class AgentOrchestrator:

    async def verify_place(self, name: str, address: str = None) -> dict:
        return await place_verifier.verify_place(name, address)

    async def search_and_verify_places(self, places: list[dict], lat: float = None, lng: float = None) -> list[dict]:
        return await place_verifier.verify_nearby_places(places, lat, lng)

    async def get_weather_impact(self, location: str = "Bengaluru") -> dict:
        return await route_advisor.get_weather_impact(location)

    async def get_traffic_conditions(self, route: str = None) -> dict:
        return await route_advisor.get_traffic_conditions(route)

    async def get_safety_rating(self, mode: str, distance_km: float, is_night: bool, is_rainy: bool, group_size: int) -> dict:
        return await route_advisor.get_safety_rating(mode, distance_km, is_night, is_rainy, group_size)

    async def get_route_recommendation(self, source: str, dest: str, group_size: int, budget: float = None, distance_km: float = None) -> dict:
        return await route_advisor.get_route_recommendation(source, dest, group_size, budget, distance_km)

    async def get_travel_news(self, source: str = None, dest: str = None) -> list[dict]:
        return await route_advisor.get_travel_news(source, dest)

    async def get_live_prices(self, source: str, dest: str, mode: str = "all") -> list[dict]:
        return await pricing_agent.get_live_prices(source, dest, mode)

    async def get_fuel_cost(self, distance_km: float) -> dict:
        return await pricing_agent.get_fuel_cost(distance_km)

    async def get_hotel_prices(self, name: str, city: str = "Bengaluru") -> dict:
        return await pricing_agent.get_hotel_prices(name, city)

    async def analyze_place_reviews(self, name: str, address: str = None) -> dict:
        return await review_agent.analyze_place(name, address)

    async def analyze_nearby_reviews(self, places: list[dict]) -> list[dict]:
        return await review_agent.analyze_nearby_places(places)

    async def get_comprehensive_travel_context(self, source: str, dest: str, group_size: int, budget: float = None, distance_km: float = None) -> dict:
        weather_task = self.get_weather_impact()
        traffic_task = self.get_traffic_conditions(f"{source} to {dest}")
        recs_task = self.get_route_recommendation(source, dest, group_size, budget, distance_km)
        prices_task = self.get_live_prices(source, dest)
        news_task = self.get_travel_news(source, dest)

        import asyncio
        weather, traffic, recs, prices, news = await asyncio.gather(
            weather_task, traffic_task, recs_task, prices_task, news_task,
            return_exceptions=True,
        )

        return {
            "weather": weather if not isinstance(weather, Exception) else {},
            "traffic": traffic if not isinstance(traffic, Exception) else {},
            "recommendations": recs if not isinstance(recs, Exception) else {},
            "live_prices": prices if not isinstance(prices, Exception) else [],
            "news": news if not isinstance(news, Exception) else [],
        }


agent_orchestrator = AgentOrchestrator()
