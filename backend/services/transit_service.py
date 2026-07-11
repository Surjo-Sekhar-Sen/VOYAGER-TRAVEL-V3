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

        for r in possible_routes:
            r["overall_score"] = self._topsis_score(r)

        possible_routes.sort(key=lambda x: (x["overall_score"], -x["total_fare"]), reverse=True)
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
        routes = []
        if not db.kia_routes:
            return routes
        nearby_src_stops = db.find_nearby_bus_stops(slat, slng, 2.0)
        nearby_dest_stops = db.find_nearby_bus_stops(dlat, dlng, 2.0)
        if not nearby_src_stops or not nearby_dest_stops:
            return routes
        src_stop = nearby_src_stops[0]
        dest_stop = nearby_dest_stops[0]
        src_stop_name = src_stop["name"].lower()
        dest_stop_name = dest_stop["name"].lower()
        for route_id, route_data in db.kia_routes.items():
            stops = route_data.get("stops", [])
            src_idx = None
            dest_idx = None
            for i, s in enumerate(stops):
                sn = s["stop_name"].lower()
                if src_stop_name in sn or sn in src_stop_name:
                    src_idx = i
                if dest_stop_name in sn or sn in dest_stop_name:
                    dest_idx = i
            if src_idx is not None and dest_idx is not None and src_idx < dest_idx:
                src_s = stops[src_idx]
                dest_s = stops[dest_idx]
                kia_fare = dest_s.get("fare", 0) - src_s.get("fare", 0)
                if kia_fare <= 0 and dest_s.get("fare", 0) > 0:
                    kia_fare = dest_s.get("fare", 210)
                walking_to = 0
                walking_from = 0
                kia_dist = dist * 0.8
                routes.append({
                    "type": "kia_bus",
                    "total_fare": max(kia_fare, 50) * group_size,
                    "total_duration_minutes": round((kia_dist / 40) * 60 + (walking_to + walking_from) * 12),
                    "total_distance_km": round(kia_dist + walking_to + walking_from, 2),
                    "total_walking_km": round(walking_to + walking_from, 2),
                    "overall_score": 82,
                    "route_id": route_id,
                    "route_info": route_data.get("route_info", ""),
                    "legs": [
                        {"from": "Your Location", "to": src_s["stop_name"], "mode": "walk",
                         "distance_km": round(walking_to, 2), "duration_minutes": round(walking_to * 12), "fare": 0},
                        {"from": src_s["stop_name"], "to": dest_s["stop_name"], "mode": "bus_ac_vajra",
                         "distance_km": round(kia_dist, 2), "duration_minutes": round((kia_dist / 40) * 60),
                         "fare": max(kia_fare, 50) * group_size, "line": route_id, "instructions": route_data.get("route_info", "")},
                        {"from": dest_s["stop_name"], "to": "Your Destination", "mode": "walk",
                         "distance_km": round(walking_from, 2), "duration_minutes": round(walking_from * 12), "fare": 0}
                    ]
                })
        return routes[:2]

    def _generate_multi_modal_routes(self, slat, slng, dlat, dlng, dist, group_size):
        routes = []
        bus_stops = db.find_nearby_bus_stops(slat, slng, 1.0)
        metro_stations = db.find_nearby_metro_stations(slat, slng, 2.0)
        dest_bus_stops = db.find_nearby_bus_stops(dlat, dlng, 1.0)
        dest_metro = db.find_nearby_metro_stations(dlat, dlng, 2.0)

        # Bus → Metro (source bus → interchange metro → dest metro)
        if bus_stops and dest_metro:
            for src_bus in bus_stops[:2]:
                for dst_m in dest_metro[:2]:
                    walking_to_bus = self.haversine_distance(slat, slng, src_bus["lat"], src_bus["lng"])
                    bus_dist = self.haversine_distance(src_bus["lat"], src_bus["lng"], dst_m["lat"], dst_m["lng"])
                    metro_dist = db.get_metro_distance_between(dst_m["name"], dst_m["name"]) or bus_dist * 0.7
                    walking_from_metro = self.haversine_distance(dlat, dlng, dst_m["lat"], dst_m["lng"])
                    bus_fare = db.get_bmtc_ordinary_fare(bus_dist)
                    metro_fare = db.get_metro_fare(metro_dist) * group_size
                    total_walk = walking_to_bus + walking_from_metro
                    total_dur = (bus_dist / 25) * 60 + (metro_dist / 35) * 60 + total_walk * 12 + 5
                    routes.append({
                        "type": "bus_to_metro",
                        "total_fare": (bus_fare + metro_fare),
                        "total_duration_minutes": round(total_dur),
                        "total_distance_km": round(bus_dist + metro_dist + total_walk, 2),
                        "total_walking_km": round(total_walk, 2),
                        "overall_score": 75,
                        "legs": [
                            {"from": "Your Location", "to": src_bus["name"], "mode": "walk",
                             "distance_km": round(walking_to_bus, 2), "duration_minutes": round(walking_to_bus * 12), "fare": 0},
                            {"from": src_bus["name"], "to": dst_m["name"], "mode": "bus_ordinary",
                             "distance_km": round(bus_dist, 2), "duration_minutes": round(bus_dist / 25 * 60), "fare": bus_fare * group_size},
                            {"from": dst_m["name"], "to": dst_m["name"], "mode": "metro", "line": dst_m.get("line"),
                             "distance_km": round(metro_dist, 2), "duration_minutes": round(metro_dist / 35 * 60), "fare": metro_fare},
                            {"from": dst_m["name"], "to": "Your Destination", "mode": "walk",
                             "distance_km": round(walking_from_metro, 2), "duration_minutes": round(walking_from_metro * 12), "fare": 0}
                        ]
                    })

        # Metro → Bus (source metro → bus near dest)
        if metro_stations and dest_bus_stops:
            for src_m in metro_stations[:2]:
                for dst_bus in dest_bus_stops[:2]:
                    walking_to_metro = self.haversine_distance(slat, slng, src_m["lat"], src_m["lng"])
                    metro_dist = db.get_metro_distance_between(src_m["name"], src_m["name"]) or dist * 0.5
                    bus_from_metro = self.haversine_distance(src_m["lat"], src_m["lng"], dst_bus["lat"], dst_bus["lng"])
                    walking_from_bus = self.haversine_distance(dlat, dlng, dst_bus["lat"], dst_bus["lng"])
                    metro_fare = db.get_metro_fare(abs(src_m.get("sequence", 0) - dst_bus.get("sequence", 0)) * 1.5) if metro_stations else db.get_metro_fare(dist)
                    if metro_fare < 11: metro_fare = db.get_metro_fare(dist * 0.6)
                    bus_fare = db.get_bmtc_ordinary_fare(bus_from_metro)
                    total_walk = walking_to_metro + walking_from_bus
                    total_dur = (metro_dist / 35) * 60 + (bus_from_metro / 25) * 60 + total_walk * 12 + 5
                    routes.append({
                        "type": "metro_to_bus",
                        "total_fare": round(metro_fare * group_size + bus_fare * group_size, 2),
                        "total_duration_minutes": round(total_dur),
                        "total_distance_km": round(metro_dist + bus_from_metro + total_walk, 2),
                        "total_walking_km": round(total_walk, 2),
                        "overall_score": 73,
                        "legs": [
                            {"from": "Your Location", "to": src_m["name"], "mode": "walk",
                             "distance_km": round(walking_to_metro, 2), "duration_minutes": round(walking_to_metro * 12), "fare": 0},
                            {"from": src_m["name"], "to": src_m["name"], "mode": "metro", "line": src_m.get("line"),
                             "distance_km": round(metro_dist, 2), "duration_minutes": round(metro_dist / 35 * 60), "fare": metro_fare * group_size},
                            {"from": src_m["name"], "to": dst_bus["name"], "mode": "bus_ordinary",
                             "distance_km": round(bus_from_metro, 2), "duration_minutes": round(bus_from_metro / 25 * 60), "fare": bus_fare * group_size},
                            {"from": dst_bus["name"], "to": "Your Destination", "mode": "walk",
                             "distance_km": round(walking_from_bus, 2), "duration_minutes": round(walking_from_bus * 12), "fare": 0}
                        ]
                    })
        return routes[:3]

    def _topsis_score(self, route: dict) -> int:
        fare = route.get("total_fare", 100)
        duration = route.get("total_duration_minutes", 60)
        walk = route.get("total_walking_km", 0)
        distance = route.get("total_distance_km", 10)

        fare_score = max(0, 100 - (fare / 10))
        time_score = max(0, 100 - (duration / 2))
        walk_score = max(0, 100 - (walk * 15))
        comfort = min(100, distance * 3 + (0 if walk < 0.5 else 20))

        final_score = int(fare_score * 0.3 + time_score * 0.35 + walk_score * 0.15 + comfort * 0.2)
        return max(10, min(99, final_score))

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
