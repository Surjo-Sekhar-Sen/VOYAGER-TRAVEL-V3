import asyncio
import httpx
import json
import math
import time
from geopy.distance import geodesic
from backend.core.database import db
from backend.agents.llm_agent import llm_agent
from backend.services.images import image_service
from backend.services.n8n_service import n8n_service

OSM_HEADERS = {"User-Agent": "VOYAGER-App/1.0 (India Transit Navigator)"}
INDIA_BBOX = "68.7,35.5,97.4,6.7"

class SearchCache:
    def __init__(self, ttl_seconds: int = 86400):
        self._cache: dict[str, tuple[float, list[dict]]] = {}
        self._ttl = ttl_seconds

    def _make_key(self, query: str, lat: float = None, lng: float = None) -> str:
        if lat and lng:
            return f"{query.strip().lower()}|{round(lat,2)}|{round(lng,2)}"
        return query.strip().lower()

    def get(self, query: str, lat: float = None, lng: float = None):
        key = self._make_key(query, lat, lng)
        entry = self._cache.get(key)
        if entry and (time.time() - entry[0]) < self._ttl:
            return entry[1]
        if entry:
            del self._cache[key]
        return None

    def set(self, query: str, results: list[dict], lat: float = None, lng: float = None):
        key = self._make_key(query, lat, lng)
        self._cache[key] = (time.time(), results)

    def clear(self):
        self._cache.clear()

search_cache = SearchCache()

def _sanitize(val, default=0.0):
    if val is None: return default
    try:
        v = float(val)
        if math.isnan(v) or math.isinf(v): return default
        return v
    except (ValueError, TypeError):
        return default

class GeocodingService:

    async def search_places(self, query: str, lat: float = None, lng: float = None) -> list[dict]:
        # Check cache first
        cached = search_cache.get(query, lat, lng)
        if cached is not None:
            return cached

        results = []
        seen_coords = set()

        # Always run both OSM and AI in parallel for maximum coverage
        osm_task = self._osm_search(query, lat, lng)
        ai_task = self._ai_search(query, lat, lng)
        osm_results, ai_results = await asyncio.gather(osm_task, ai_task, return_exceptions=True)
        if isinstance(osm_results, Exception): osm_results = []
        if isinstance(ai_results, Exception): ai_results = []

        for r in osm_results:
            key = (round(r["lat"], 4), round(r["lng"], 4))
            if key not in seen_coords:
                seen_coords.add(key)
                results.append(r)

        query_lower = query.lower().strip()
        for stop_id, stop in db.bus_stops.items():
            if not isinstance(stop, dict): continue
            name = stop.get("name", "")
            if isinstance(name, str) and query_lower in name.lower():
                key = (round(stop["lat"], 4), round(stop["lng"], 4))
                if key not in seen_coords:
                    seen_coords.add(key)
                    results.append(self._make_result(name, stop["lat"], stop["lng"], "bus_stop",
                        f"BMTC bus stop", 0.9, 4.0))

        for station in db.metro_stations:
            if not isinstance(station, dict): continue
            name = station.get("name", "")
            if isinstance(name, str) and query_lower in name.lower():
                key = (round(station["lat"], 4), round(station["lng"], 4))
                if key not in seen_coords:
                    seen_coords.add(key)
                    results.append(self._make_result(name, station["lat"], station["lng"], "metro_station",
                        f"Namma Metro {station.get('line','')}", 0.95, 4.3))

        # Merge AI results (these fill gaps for places not in OSM/database)
        for r in ai_results:
            key = (round(r["lat"], 4), round(r["lng"], 4))
            if key not in seen_coords:
                seen_coords.add(key)
                r["review_source"] = "llm"
                results.append(r)

        for r in results:
            r["lat"] = _sanitize(r.get("lat"))
            r["lng"] = _sanitize(r.get("lng"))
            r["rating"] = _sanitize(r.get("rating", 4.0), 4.0)
            r["reliability_score"] = _sanitize(r.get("reliability_score", 0.8), 0.8)

        # Return raw results immediately — enrichment happens on-demand via enrich_single_place
        out = results[:15]
        search_cache.set(query, out, lat, lng)
        return out

    async def _ai_search(self, query: str, lat: float = None, lng: float = None) -> list[dict]:
        try:
            loc = f"near ({lat},{lng}) in India" if lat and lng else "in India (prefer Bengaluru if relevant)"
            is_blr = lat and lng and self._in_bangalore(lat, lng)
            region = "in Bengaluru, India" if is_blr else "in India (any major city)"
            result_text = await asyncio.wait_for(llm_agent._call_llm(
                "You are a location database for India. Return ONLY valid JSON array.",
                f"""Find up to 5 REAL places matching "{query}" {region}.
Return a JSON array of objects with EXACT keys: name, place_type (one of: mall/hospital/clinic/restaurant/hotel/lodge/temple/mosque/church/school/college/university/institute/park/atm/bank/petrol_pump/charging_station/metro_station/bus_stop/airport/railway_station/police_station/it_hub/cafe/pharmacy/supermarket/gym/library/cinema/post_office), lat (float - precise), lng (float - precise), rating (1.0-5.0 float), review_summary (string, 5-10 words), address (string), is_recommended (boolean). Only real coordinates in India.""",
                json_mode=True
            ), timeout=6.0)
            results = json.loads(result_text) if isinstance(result_text, str) else result_text
            if isinstance(results, dict):
                for v in results.values():
                    if isinstance(v, list): results = v; break
            if isinstance(results, dict): results = [results]

            for r in (results or []):
                if not isinstance(r, dict): continue
                r["reliability_score"] = r.get("reliability_score", round(min(r.get("rating", 4.0) / 5, 0.95), 2))
                r["is_recommended"] = r.get("is_recommended", r.get("reliability_score", 0.5) > 0.6)
                r["review_summary"] = r.get("review_summary", f"{r.get('name', query)} in Bengaluru")
                r["address"] = r.get("address", f"{r.get('name', query)}, Bengaluru")

            return [r for r in (results or []) if isinstance(r, dict) and "lat" in r and "lng" in r]
        except Exception:
            return []

    async def _osm_search(self, query: str, lat: float = None, lng: float = None) -> list[dict]:
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=8&addressdetails=1"
            if lat and lng:
                url += f"&lat={lat}&lon={lng}&bounded=1&viewbox={INDIA_BBOX}"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=OSM_HEADERS)
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    for item in data:
                        lat_f, lng_f = float(item["lat"]), float(item["lon"])
                        name = item.get("display_name", "").split(",")[0]
                        if not name: continue
                        ptype = self._osm_class_to_type(item.get("type", ""), item.get("category", ""))
                        city = self._extract_city(item.get("address", {}), item.get("display_name", ""))
                        results.append(self._make_result(name, lat_f, lng_f, ptype,
                            f"{ptype.replace('_',' ').title()} in {city}", 0.8, 4.0,
                            item.get("display_name", "")))
                    return results
        except Exception:
            pass
        return []

    def _extract_city(self, address: dict, display_name: str) -> str:
        for key in ["city", "town", "village", "county", "state"]:
            if address.get(key):
                return address[key]
        parts = display_name.split(",") if display_name else []
        return parts[-3].strip() if len(parts) >= 3 else "India"

    async def get_nearby_places(self, lat: float, lng: float, radius_km: float = 2.0,
                                 place_type: str = None) -> list[dict]:
        results = []
        seen_coords = set()

        in_blr = self._in_bangalore(lat, lng)

        # In Bangalore: bus_stop and metro_station come from dataset only
        if in_blr and place_type in ("bus_stop", "metro_station"):
            osm_results = []
        elif in_blr and place_type is None:
            # "All" in BLR: run OSM for all types, dataset handles bus/metro separately
            osm_results = await self._osm_nearby(lat, lng, radius_km, None)
        else:
            osm_results = await self._osm_nearby(lat, lng, radius_km, place_type)

        for r in osm_results:
            key = (round(r["lat"], 4), round(r["lng"], 4))
            if key not in seen_coords:
                seen_coords.add(key)
                r["distance_km"] = round(geodesic((lat, lng), (r["lat"], r["lng"])).km, 2)
                results.append(r)

        if in_blr:
            if not place_type or place_type == "bus_stop":
                for stop in db.find_nearby_bus_stops(lat, lng, radius_km):
                    key = (round(stop["lat"], 4), round(stop["lng"], 4))
                    if key not in seen_coords:
                        seen_coords.add(key)
                        results.append(self._make_result(stop["name"], stop["lat"], stop["lng"], "bus_stop",
                            f"BMTC bus stop", 0.9, 4.0, distance_km=stop["distance_km"]))

            if not place_type or place_type == "metro_station":
                for station in db.find_nearby_metro_stations(lat, lng, radius_km):
                    key = (round(station["lat"], 4), round(station["lng"], 4))
                    if key not in seen_coords:
                        seen_coords.add(key)
                        results.append(self._make_result(station["name"], station["lat"], station["lng"], "metro_station",
                            f"Namma Metro {station.get('line','')}", 0.95, 4.3, distance_km=station["distance_km"]))

        if not results:
            try:
                ai_results = await self._ai_search(f"{place_type or 'places'} near me", lat, lng)
                for r in ai_results:
                    key = (round(r["lat"], 4), round(r["lng"], 4))
                    if key not in seen_coords:
                        seen_coords.add(key)
                        r["distance_km"] = round(geodesic((lat, lng), (r["lat"], r["lng"])).km, 2)
                        results.append(r)
            except Exception:
                pass

        # Sanitize all float values before returning
        for r in results:
            r["lat"] = _sanitize(r.get("lat"))
            r["lng"] = _sanitize(r.get("lng"))
            r["rating"] = _sanitize(r.get("rating", 4.0), 4.0)
            r["reliability_score"] = _sanitize(r.get("reliability_score", 0.8), 0.8)
            if "distance_km" in r:
                r["distance_km"] = _sanitize(r["distance_km"])

        enriched = await self._enrich_results(results[:12], light=True)
        enriched.sort(key=lambda x: x.get("distance_km", 999))
        return enriched[:20]

    async def _osm_nearby(self, lat: float, lng: float, radius_km: float, place_type: str = None) -> list[dict]:
        try:
            radius_m = int(radius_km * 1000)
            tag_map = {
                "mall": '["shop"="mall"]',
                "hospital": '["amenity"="hospital"]',
                "clinic": '["amenity"="clinic"]',
                "atm": '["amenity"="atm"]',
                "bank": '["amenity"="bank"]',
                "restaurant": '["amenity"="restaurant"]',
                "cafe": '["amenity"="cafe"]',
                "hotel": '["tourism"="hotel"]',
                "lodge": '["tourism"="guest_house"]',
                "temple": '["amenity"="place_of_worship"]["religion"="hindu"]',
                "mosque": '["amenity"="place_of_worship"]["religion"="muslim"]',
                "church": '["amenity"="place_of_worship"]["religion"="christian"]',
                "school": '["amenity"="school"]',
                "park": '["leisure"="park"]',
                "petrol_pump": '["amenity"="fuel"]',
                "charging_station": '["amenity"="charging_station"]',
                "police": '["amenity"="police"]',
                "bus_stop": '["highway"="bus_stop"]',
                "metro_station": '["station"="subway"]',
                "airport": '["aeroway"="aerodrome"]',
                "railway_station": '["railway"="station"]',
                "pharmacy": '["amenity"="pharmacy"]',
                "supermarket": '["shop"="supermarket"]',
                "gym": '["leisure"="fitness_centre"]',
                "library": '["amenity"="library"]',
                "cinema": '["amenity"="cinema"]',
                "post_office": '["amenity"="post_office"]',
                "it_hub": '["office"="it"]',
            }

            seen_names = set()
            results = []

            async with httpx.AsyncClient(timeout=10.0) as client:
                if place_type and place_type in tag_map:
                    query = f"""
                        [out:json][timeout:8];
                        nwr{tag_map[place_type]}(around:{radius_m},{lat},{lng});
                        out 12 center;
                    """
                    try:
                        resp = await client.post("https://overpass-api.de/api/interpreter",
                            data={"data": query}, headers=OSM_HEADERS)
                        if resp.status_code == 200:
                            data = resp.json()
                            for el in data.get("elements", []):
                                name = self._extract_osm_name(el.get("tags", {}))
                                if not name or name.lower() in seen_names: continue
                                seen_names.add(name.lower())
                                el_lat = el.get("lat") or (el.get("center", {}) or {}).get("lat", lat)
                                el_lng = el.get("lon") or (el.get("center", {}) or {}).get("lon", lng)
                                ptype = self._osm_tag_to_type(el.get("tags", {}))
                                review = f"{ptype.replace('_',' ').title()} near your location"
                                results.append(self._make_result(name, float(el_lat), float(el_lng), ptype, review, 0.75, 4.0))
                    except:
                        pass
                else:
                    all_tags = list(tag_map.values())
                    for i in range(0, len(all_tags), 5):
                        batch = all_tags[i:i+5]
                        union_parts = "\n            ".join(f"nwr{t}(around:{radius_m},{lat},{lng});" for t in batch)
                        query = f"""
                            [out:json][timeout:10];
                            (
                                {union_parts}
                            );
                            out 6 center;
                        """
                        try:
                            resp = await client.post("https://overpass-api.de/api/interpreter",
                                data={"data": query}, headers=OSM_HEADERS)
                            if resp.status_code == 200:
                                data = resp.json()
                                for el in data.get("elements", []):
                                    name = self._extract_osm_name(el.get("tags", {}))
                                    if not name or name.lower() in seen_names: continue
                                    seen_names.add(name.lower())
                                    el_lat = el.get("lat") or (el.get("center", {}) or {}).get("lat", lat)
                                    el_lng = el.get("lon") or (el.get("center", {}) or {}).get("lon", lng)
                                    ptype = self._osm_tag_to_type(el.get("tags", {}))
                                    review = f"{ptype.replace('_',' ').title()} near your location"
                                    results.append(self._make_result(name, float(el_lat), float(el_lng), ptype, review, 0.75, 4.0))
                        except:
                            continue

            return results
        except Exception:
            pass
        return []

    def _extract_osm_name(self, tags: dict) -> str:
        name = tags.get("name", "") or tags.get("official_name", "")
        if not name:
            name = tags.get("brand", "") or tags.get("operator", "") or tags.get("short_name", "")
        return name.strip()[:100] if name else ""

    async def _enrich_results(self, results: list[dict], light: bool = False) -> list[dict]:
        if not results:
            return results

        if not light:
            try:
                import asyncio
                sem = asyncio.Semaphore(3)

                async def enrich_place(r: dict):
                    async with sem:
                        try:
                            if r.get("place_type") not in ("bus_stop", "metro_station"):
                                r["image_url"] = await image_service.get_place_image(r["name"], r.get("place_type"))
                            if r.get("place_type") in ("hotel", "lodge") and not r.get("price_info"):
                                hp = await n8n_service.get_hotel_prices(r["name"], r.get("address"))
                                if hp:
                                    r["price_info"] = f"₹{hp.get('avg_price', 0)}/night (₹{hp.get('min_price',0)}-₹{hp.get('max_price',0)})"
                                    r["hotel_prices"] = hp
                        except Exception:
                            pass

                    # Try n8n web search for real reviews first
                    try:
                        real_reviews = await n8n_service.get_place_reviews(r["name"], r.get("address"))
                        if real_reviews:
                            if real_reviews.get("rating"): r["rating"] = float(real_reviews["rating"])
                            if real_reviews.get("reliability_score"): r["reliability_score"] = float(real_reviews["reliability_score"])
                            if real_reviews.get("review_summary"): r["review_summary"] = real_reviews["review_summary"]
                            if real_reviews.get("is_recommended") is not None: r["is_recommended"] = bool(real_reviews["is_recommended"])
                            if real_reviews.get("reviews"): r["reviews"] = real_reviews.get("reviews", [])[:4]
                            r["review_source"] = "web"
                            return
                    except Exception:
                        pass

                    # Fallback: LLM web search for real reviews directly
                    try:
                        web_reviews = await llm_agent.get_real_reviews(r["name"], r.get("address"))
                        if web_reviews:
                            if web_reviews.get("rating"): r["rating"] = float(web_reviews["rating"])
                            if web_reviews.get("reliability_score"): r["reliability_score"] = float(web_reviews["reliability_score"])
                            if web_reviews.get("review_summary"): r["review_summary"] = web_reviews["review_summary"]
                            if web_reviews.get("is_recommended") is not None: r["is_recommended"] = bool(web_reviews["is_recommended"])
                            if web_reviews.get("reviews"): r["reviews"] = web_reviews.get("reviews", [])[:4]
                            r["review_source"] = "web"
                            return
                    except Exception:
                        pass

                    # Final fallback: LLM generated (keeps rating/reliability consistent with initial)
                    try:
                        prompt = f"""For {r['name']} in Bengaluru, provide realistic data.
Return a JSON object with: rating (1.0-5.0), reliability_score (0.0-1.0),
review_summary (brief 10-20 word summary), is_recommended (bool),
reviews (array of 2-4 objects with: user (DIFFERENT names from: Priya Sharma, Arun Kumar, Sneha Patel, Ravi Desai, Lakshmi Nair, Vikram Singh, Anjali Gupta, Rajesh Iyer, Deepa Menon, Suresh Reddy, Meera Joshi), rating (1-5 int, vary them), text (unique specific detailed review about experience), date ("2 weeks ago", "last month", "3 days ago", "yesterday", "a month ago")).
CRITICAL: Each review must have a DIFFERENT name, rating, and text."""
                        text = await llm_agent._call_llm(
                            "You are a review analyst for Bengaluru places. Return ONLY valid JSON.",
                            prompt, json_mode=True
                        )
                        content = text.strip() if isinstance(text, str) else str(text) if text else "{}"
                        if content.startswith("```"): content = content.strip("`").strip()
                        if content.startswith("json"): content = content[4:].strip()
                        data = json.loads(content) if isinstance(content, str) else content
                        if isinstance(data, dict):
                            if data.get("rating"): r["rating"] = float(data["rating"])
                            if data.get("reliability_score"): r["reliability_score"] = float(data["reliability_score"])
                            if data.get("review_summary"): r["review_summary"] = data["review_summary"]
                            if data.get("is_recommended") is not None: r["is_recommended"] = bool(data["is_recommended"])
                            if data.get("reviews"): r["reviews"] = data.get("reviews", [])[:4]
                            r["review_source"] = "llm"
                    except Exception:
                        pass

                tasks = [enrich_place(r) for r in results[:8]]
                await asyncio.gather(*tasks)
            except Exception:
                pass

        for r in results:
            r.setdefault("rating", 4.0)
            r.setdefault("reliability_score", 0.75)
            r.setdefault("review_summary", f"{r['name']} in Bengaluru")
            r.setdefault("is_recommended", r.get("reliability_score", 0.75) > 0.6)
            r.setdefault("address", f"{r['name']}, Bengaluru")

        return results

    async def enrich_single_place(self, name: str, lat: float, lng: float, place_type: str, address: str) -> dict:
        result = self._make_result(name, lat, lng, place_type, address, 0.8, 4.0)
        result["address"] = address or f"{name}, Bengaluru"

        # Try real reviews from n8n web search first
        try:
            real_reviews = await n8n_service.get_place_reviews(name, address)
            if real_reviews:
                if real_reviews.get("rating"): result["rating"] = float(real_reviews["rating"])
                if real_reviews.get("reliability_score"): result["reliability_score"] = float(real_reviews["reliability_score"])
                if real_reviews.get("review_summary"): result["review_summary"] = real_reviews["review_summary"]
                if real_reviews.get("is_recommended") is not None: result["is_recommended"] = bool(real_reviews["is_recommended"])
                if real_reviews.get("reviews"): result["reviews"] = real_reviews.get("reviews", [])[:4]
                result["review_source"] = "web"
        except Exception:
            pass

        # Fallback to LLM if no real reviews
        if not result.get("reviews"):
            try:
                prompt = f"""For {name} in Bengaluru, provide realistic data.
Return a JSON object with: rating (1.0-5.0), reliability_score (0.0-1.0),
review_summary (brief 10-20 word summary), is_recommended (bool),
price_info (string if hotel/lodge else null, e.g. "₹2500/night"),
reviews (array of 3-4 objects with: user (pick DIFFERENT names from: Priya Sharma, Arun Kumar, Sneha Patel, Ravi Desai, Lakshmi Nair, Vikram Singh, Anjali Gupta, Rajesh Iyer, Deepa Menon, Suresh Reddy, Meera Joshi, Sanjay Pillai, Kavita Rao, Manoj Verma, Pooja Malhotra), rating (1-5 int, vary them), text (unique specific detailed review about experience), date ("2 weeks ago", "last month", "3 days ago", "yesterday", "a month ago")).
CRITICAL: Each review must have a DIFFERENT name, rating, and text."""
                text = await llm_agent._call_llm(
                    "You are a review analyst for Bengaluru places. Return ONLY valid JSON.",
                    prompt, json_mode=True
                )
                content = text.strip() if isinstance(text, str) else str(text) if text else "{}"
                if content.startswith("```"): content = content.strip("`").strip()
                if content.startswith("json"): content = content[4:].strip()
                data = json.loads(content) if isinstance(content, str) else content
                if isinstance(data, dict):
                    if data.get("rating"): result["rating"] = float(data["rating"])
                    if data.get("reliability_score"): result["reliability_score"] = float(data["reliability_score"])
                    if data.get("review_summary"): result["review_summary"] = data["review_summary"]
                    if data.get("is_recommended") is not None: result["is_recommended"] = bool(data["is_recommended"])
                    if data.get("price_info"): result["price_info"] = data["price_info"]
                    if data.get("reviews"): result["reviews"] = data.get("reviews", [])[:4]
                    result["review_source"] = "llm"
            except Exception:
                pass

        try:
            if place_type not in ("bus_stop", "metro_station"):
                result["image_url"] = await image_service.get_place_image(name, place_type)
            if place_type in ("hotel", "lodge") and not result.get("price_info"):
                hp = await n8n_service.get_hotel_prices(name, address)
                if hp:
                    result["price_info"] = f"₹{hp.get('avg_price', 0)}/night (₹{hp.get('min_price',0)}-₹{hp.get('max_price',0)})"
                    result["hotel_prices"] = hp
        except Exception:
            pass
        return result

    async def get_suggestions(self, partial: str) -> list[str]:
        if len(partial) < 1: return []
        suggestions = set()

        try:
            text = await llm_agent._call_llm(
                "You are a suggestion engine. Return ONLY a JSON array of strings.",
                f"Given '{partial}' in Bengaluru, list 5 real place names. Return [\"Place1\",\"Place2\",...]",
                json_mode=True
            )
            arr = json.loads(text) if isinstance(text, str) else text
            if isinstance(arr, dict):
                for v in arr.values():
                    if isinstance(v, list): arr = v; break
            for s in (arr or []):
                if isinstance(s, str):
                    suggestions.add(s)
        except: pass

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"https://nominatim.openstreetmap.org/search?q={partial}&format=json&limit=4&bounded=1&viewbox={INDIA_BBOX}",
                    headers=OSM_HEADERS
                )
                if resp.status_code == 200:
                    for item in resp.json()[:4]:
                        name = item.get("display_name", "").split(",")[0]
                        if name: suggestions.add(name)
        except: pass

        q = partial.lower()
        for stop in db.bus_stops.values():
            n = stop.get("name", "")
            if isinstance(n, str) and q in n.lower():
                suggestions.add(n)
                if len(suggestions) >= 8: break

        return list(suggestions)[:10]

    async def verify_place(self, name: str, address: str = None) -> dict:
        return await llm_agent.verify_place(name, address)

    def _make_result(self, name: str, lat: float, lng: float, place_type: str,
                      review: str, reliability: float, rating: float,
                      address: str = None, distance_km: float = None) -> dict:
        r = {
            "name": name, "lat": _sanitize(lat), "lng": _sanitize(lng),
            "place_type": place_type,
            "rating": _sanitize(rating, 4.0), "review_summary": review,
            "address": address or f"{name}, Bengaluru",
            "reliability_score": _sanitize(reliability, 0.8),
            "is_recommended": _sanitize(reliability, 0.8) > 0.6,
        }
        if distance_km is not None:
            r["distance_km"] = round(_sanitize(distance_km), 2)
        return r

    def _osm_class_to_type(self, osm_type: str, category: str) -> str:
        m = {"mall":"mall","shopping_centre":"mall","hospital":"hospital","clinic":"clinic",
             "airport":"airport","railway":"railway_station","station":"railway_station",
             "bus_stop":"bus_stop","subway":"metro_station","park":"park","garden":"park",
             "restaurant":"restaurant","fast_food":"restaurant","cafe":"cafe",
             "hotel":"hotel","hostel":"hotel","guest_house":"lodge",
             "place_of_worship":"temple","mosque":"mosque","church":"church",
             "school":"school","university":"school",
             "atm":"atm","bank":"bank","fuel":"petrol_pump","police":"police_station",
             "it":"it_hub","office":"it_hub", "lodge":"hotel",
             "pharmacy":"pharmacy","supermarket":"supermarket","fitness_centre":"gym",
             "gym":"gym","library":"library","cinema":"cinema","post_office":"post_office",
             "charging_station":"charging_station"}
        return m.get(osm_type, m.get(category, osm_type))

    def _osm_tag_to_type(self, tags: dict) -> str:
        m = [
            ("shop","mall","mall"), ("amenity","hospital","hospital"),
            ("amenity","clinic","clinic"), ("amenity","atm","atm"),
            ("amenity","bank","bank"), ("amenity","restaurant","restaurant"),
            ("amenity","cafe","cafe"), ("tourism","hotel","hotel"),
            ("tourism","hostel","hotel"), ("tourism","guest_house","lodge"),
            ("amenity","school","school"), ("leisure","park","park"),
            ("amenity","fuel","petrol_pump"), ("amenity","charging_station","charging_station"),
            ("highway","bus_stop","bus_stop"), ("station","subway","metro_station"),
            ("amenity","police","police_station"), ("office","it","it_hub"),
            ("aeroway","aerodrome","airport"), ("railway","station","railway_station"),
            ("amenity","pharmacy","pharmacy"), ("shop","supermarket","supermarket"),
            ("leisure","fitness_centre","gym"), ("amenity","library","library"),
            ("amenity","cinema","cinema"), ("amenity","post_office","post_office"),
            ("amenity","place_of_worship","temple"),
        ]
        for k, v, r in m:
            if tags.get(k) == v:
                if k == "amenity" and v == "place_of_worship":
                    rel = tags.get("religion", "")
                    if rel == "muslim": return "mosque"
                    if rel == "christian": return "church"
                    if rel == "hindu": return "temple"
                return r
        if tags.get("amenity") == "place_of_worship":
            return "temple"
        return list(tags.values())[0] if tags else "place"

    def _in_bangalore(self, lat: float, lng: float) -> bool:
        return 12.8 <= lat <= 13.2 and 77.4 <= lng <= 77.8

geocoding_service = GeocodingService()
