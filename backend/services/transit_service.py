import httpx
import math
from geopy.distance import geodesic
from backend.core.config import settings
from backend.core.database import db

class TransitService:

    def haversine_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        return geodesic((lat1, lng1), (lat2, lng2)).km

    def get_route_legs_public(self, source_lat: float, source_lng: float,
                               dest_lat: float, dest_lng: float,
                               budget: float = None, group_size: int = 1) -> list:
        direct_dist = self.haversine_distance(source_lat, source_lng, dest_lat, dest_lng)

        possible_routes = []
        possible_routes.extend(self._generate_bus_routes(source_lat, source_lng, dest_lat, dest_lng, direct_dist, group_size))
        possible_routes.extend(self._generate_metro_routes(source_lat, source_lng, dest_lat, dest_lng, direct_dist, group_size))
        possible_routes.extend(self._generate_kia_routes(source_lat, source_lng, dest_lat, dest_lng, direct_dist, group_size))
        possible_routes.extend(self._generate_multi_modal_routes(source_lat, source_lng, dest_lat, dest_lng, direct_dist, group_size))

        if budget:
            possible_routes = [r for r in possible_routes if r["total_fare"] <= budget]

        possible_routes.sort(key=lambda x: x["overall_score"], reverse=True)
        return possible_routes[:5]

    def _generate_bus_routes(self, slat, slng, dlat, dlng, dist, group_size):
        routes = []
        nearby_src_stops = db.find_nearby_bus_stops(slat, slng, 1.0)
        nearby_dest_stops = db.find_nearby_bus_stops(dlat, dlng, 1.0)

        if nearby_src_stops and nearby_dest_stops:
            src_stop = nearby_src_stops[0]
            dest_stop = nearby_dest_stops[0]
            walking_to_stop = self.haversine_distance(slat, slng, src_stop["lat"], src_stop["lng"])
            walking_from_stop = self.haversine_distance(dlat, dlng, dest_stop["lat"], dest_stop["lng"])
            bus_dist = self.haversine_distance(src_stop["lat"], src_stop["lng"], dest_stop["lat"], dest_stop["lng"])
            bus_fare = db.get_bmtc_ordinary_fare(bus_dist) * group_size
            total_walk = walking_to_stop + walking_from_stop

            routes.append({
                "type": "bus_ordinary",
                "total_fare": bus_fare,
                "total_duration_minutes": (bus_dist / 25) * 60 + total_walk * 12,
                "total_distance_km": bus_dist + total_walk,
                "total_walking_km": total_walk,
                "overall_score": 80 - (bus_dist * 0.5) + (group_size == 1) * 10,
                "legs": [
                    {
                        "from": f"Your Location",
                        "to": src_stop["name"],
                        "mode": "walk",
                        "distance_km": round(walking_to_stop, 2),
                        "duration_minutes": round(walking_to_stop * 12),
                        "fare": 0
                    },
                    {
                        "from": src_stop["name"],
                        "to": dest_stop["name"],
                        "mode": "bus_ordinary",
                        "distance_km": round(bus_dist, 2),
                        "duration_minutes": round((bus_dist / 25) * 60),
                        "fare": bus_fare
                    },
                    {
                        "from": dest_stop["name"],
                        "to": "Your Destination",
                        "mode": "walk",
                        "distance_km": round(walking_from_stop, 2),
                        "duration_minutes": round(walking_from_stop * 12),
                        "fare": 0
                    }
                ]
            })

            ac_fare = db.get_bmtc_ac_fare(bus_dist) * group_size
            routes.append({
                "type": "bus_ac_vajra",
                "total_fare": ac_fare,
                "total_duration_minutes": (bus_dist / 30) * 60 + total_walk * 12,
                "total_distance_km": bus_dist + total_walk,
                "total_walking_km": total_walk,
                "overall_score": 75 - (bus_dist * 0.4) + (group_size == 1) * 10,
                "legs": [
                    {
                        "from": "Your Location",
                        "to": src_stop["name"],
                        "mode": "walk",
                        "distance_km": round(walking_to_stop, 2),
                        "duration_minutes": round(walking_to_stop * 12),
                        "fare": 0
                    },
                    {
                        "from": src_stop["name"],
                        "to": dest_stop["name"],
                        "mode": "bus_ac_vajra",
                        "distance_km": round(bus_dist, 2),
                        "duration_minutes": round((bus_dist / 30) * 60),
                        "fare": ac_fare
                    },
                    {
                        "from": dest_stop["name"],
                        "to": "Your Destination",
                        "mode": "walk",
                        "distance_km": round(walking_from_stop, 2),
                        "duration_minutes": round(walking_from_stop * 12),
                        "fare": 0
                    }
                ]
            })
        return routes

    def _generate_metro_routes(self, slat, slng, dlat, dlng, dist, group_size):
        routes = []
        nearby_src = db.find_nearby_metro_stations(slat, slng, 2.0)
        nearby_dest = db.find_nearby_metro_stations(dlat, dlng, 2.0)

        if nearby_src and nearby_dest:
            src_metro = nearby_src[0]
            dest_metro = nearby_dest[0]
            walking_to = self.haversine_distance(slat, slng, src_metro["lat"], src_metro["lng"])
            walking_from = self.haversine_distance(dlat, dlng, dest_metro["lat"], dest_metro["lng"])
            metro_dist = self.haversine_distance(src_metro["lat"], src_metro["lng"], dest_metro["lat"], dest_metro["lng"])
            metro_fare = db.get_metro_fare(metro_dist) * group_size
            total_walk = walking_to + walking_from
            same_line = "Yes" if src_metro.get("line") == dest_metro.get("line") else "No (may need interchange)"

            routes.append({
                "type": "metro",
                "total_fare": metro_fare,
                "total_duration_minutes": (metro_dist / 35) * 60 + total_walk * 12 + (5 if same_line != "Yes" else 0),
                "total_distance_km": metro_dist + total_walk,
                "total_walking_km": total_walk,
                "overall_score": 85 - (metro_dist * 0.3) + (same_line == "Yes") * 10,
                "legs": [
                    {
                        "from": "Your Location",
                        "to": src_metro["name"],
                        "mode": "walk",
                        "distance_km": round(walking_to, 2),
                        "duration_minutes": round(walking_to * 12),
                        "fare": 0
                    },
                    {
                        "from": src_metro["name"],
                        "to": dest_metro["name"],
                        "mode": "metro",
                        "line": src_metro.get("line"),
                        "distance_km": round(metro_dist, 2),
                        "duration_minutes": round((metro_dist / 35) * 60),
                        "fare": metro_fare
                    },
                    {
                        "from": dest_metro["name"],
                        "to": "Your Destination",
                        "mode": "walk",
                        "distance_km": round(walking_from, 2),
                        "duration_minutes": round(walking_from * 12),
                        "fare": 0
                    }
                ]
            })
        return routes

    def _generate_kia_routes(self, slat, slng, dlat, dlng, dist, group_size):
        return []

    def _generate_multi_modal_routes(self, slat, slng, dlat, dlng, dist, group_size):
        routes = []
        nearby_bus_stops = db.find_nearby_bus_stops(slat, slng, 1.0)
        nearby_metro = db.find_nearby_metro_stations(dlat, dlng, 2.0)

        if nearby_bus_stops and nearby_metro:
            bus_stop = nearby_bus_stops[0]
            metro_station = nearby_metro[0]
            walking_to_bus = self.haversine_distance(slat, slng, bus_stop["lat"], bus_stop["lng"])
            bus_to_metro = self.haversine_distance(bus_stop["lat"], bus_stop["lng"], metro_station["lat"], metro_station["lng"])
            walking_from_metro = self.haversine_distance(dlat, dlng, metro_station["lat"], metro_station["lng"])
            bus_fare = db.get_bmtc_ordinary_fare(bus_to_metro)
            metro_fare = db.get_metro_fare(bus_to_metro)
            total_fare = (bus_fare + metro_fare) * group_size

            routes.append({
                "type": "bus_to_metro",
                "total_fare": total_fare,
                "total_duration_minutes": (bus_to_metro / 25) * 60 + (bus_to_metro / 35) * 60 + (walking_to_bus + walking_from_metro) * 12 + 5,
                "total_distance_km": bus_to_metro * 2 + walking_to_bus + walking_from_metro,
                "total_walking_km": walking_to_bus + walking_from_metro,
                "overall_score": 70 - (bus_to_metro * 0.3) + 5,
                "legs": [
                    {
                        "from": "Your Location",
                        "to": bus_stop["name"],
                        "mode": "walk",
                        "distance_km": round(walking_to_bus, 2),
                        "duration_minutes": round(walking_to_bus * 12),
                        "fare": 0
                    },
                    {
                        "from": bus_stop["name"],
                        "to": metro_station["name"],
                        "mode": "bus_ordinary",
                        "distance_km": round(bus_to_metro, 2),
                        "duration_minutes": round(bus_to_metro / 25 * 60),
                        "fare": bus_fare * group_size
                    },
                    {
                        "from": metro_station["name"],
                        "to": metro_station["name"],
                        "mode": "metro",
                        "line": metro_station.get("line"),
                        "distance_km": round(bus_to_metro, 2),
                        "duration_minutes": round(bus_to_metro / 35 * 60),
                        "fare": metro_fare * group_size
                    },
                    {
                        "from": metro_station["name"],
                        "to": "Your Destination",
                        "mode": "walk",
                        "distance_km": round(walking_from_metro, 2),
                        "duration_minutes": round(walking_from_metro * 12),
                        "fare": 0
                    }
                ]
            })
        return routes

    async def get_osrm_route(self, slat, slng, dlat, dlng):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"{settings.OSRM_BASE_URL}/route/v1/driving/{slng},{slat};{dlng},{dlat}?overview=full&geometries=geojson&steps=true"
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("code") == "Ok" and data.get("routes"):
                        route = data["routes"][0]
                        return {
                            "distance_km": round(route["distance"] / 1000, 2),
                            "duration_minutes": round(route["duration"] / 60, 1),
                            "geometry": route["geometry"],
                            "steps": route.get("legs", [{}])[0].get("steps", [])
                        }
        except Exception:
            pass
        return None

    async def get_driving_route(self, slat, slng, dlat, dlng):
        return await self.get_osrm_route(slat, slng, dlat, dlng)

transit_service = TransitService()
