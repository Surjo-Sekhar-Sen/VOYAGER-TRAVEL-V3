import math
from fastapi import APIRouter, Query
from backend.models.transit import ATobRequest
from backend.services.transit_service import transit_service
from backend.agents.llm_agent import llm_agent
from backend.core.database import db

router = APIRouter(prefix="/api/routes", tags=["Routes"])

def _clean(val, default=0.0):
    if val is None or (isinstance(val, float) and (math.isnan(val) or math.isinf(val))):
        return default
    return val

def _sanitize(obj):
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float):
        return _clean(obj)
    return obj

@router.post("/plan")
async def plan_route(request: ATobRequest):
    metro_station_near_source = db.find_nearby_metro_stations(request.source_lat, request.source_lng, 2.0)
    metro_station_near_dest = db.find_nearby_metro_stations(request.dest_lat, request.dest_lng, 2.0)
    bus_near_source = db.find_nearby_bus_stops(request.source_lat, request.source_lng, 1.0)
    bus_near_dest = db.find_nearby_bus_stops(request.dest_lat, request.dest_lng, 1.0)

    source_name = metro_station_near_source[0]["name"] if metro_station_near_source else f"{request.source_lat:.4f},{request.source_lng:.4f}"
    dest_name = metro_station_near_dest[0]["name"] if metro_station_near_dest else f"{request.dest_lat:.4f},{request.dest_lng:.4f}"

    if request.mode == "personal":
        driving = await transit_service.get_driving_route(
            request.source_lat, request.source_lng,
            request.dest_lat, request.dest_lng
        )
        if not driving:
            dist = transit_service.haversine_distance(
                request.source_lat, request.source_lng,
                request.dest_lat, request.dest_lng
            )
            driving = {"distance_km": round(dist, 2), "duration_minutes": round(dist * 30), "geometry": None}
        fuel_cost = _estimate_fuel_cost(driving["distance_km"])
        return {
            "status": "success",
            "mode": "personal",
            "routes": [{
                "type": "car",
                "total_fare": fuel_cost,
                "total_duration_minutes": driving["duration_minutes"],
                "total_distance_km": driving["distance_km"],
                "total_walking_km": 0,
                "overall_score": 85,
                "geometry": driving.get("geometry"),
                "legs": [{
                    "from": "Your Location",
                    "to": "Destination",
                    "mode": "car",
                    "distance_km": driving["distance_km"],
                    "duration_minutes": driving["duration_minutes"],
                    "fare": fuel_cost,
                    "instructions": f"Drive {driving['distance_km']:.1f}km - fuel cost approx ₹{fuel_cost}"
                }]
            }]
        }

    if request.mode == "walking":
        dist = transit_service.haversine_distance(
            request.source_lat, request.source_lng,
            request.dest_lat, request.dest_lng
        )
        walk_time = dist * 12
        return {
            "status": "success",
            "mode": "walking",
            "routes": [{
                "type": "walk",
                "total_distance_km": round(dist, 2),
                "total_duration_minutes": round(walk_time),
                "total_fare": 0,
                "total_walking_km": round(dist, 2),
                "overall_score": 60 if dist < 5 else 30,
                "legs": [{
                    "from": "Your Location",
                    "to": "Destination",
                    "mode": "walk",
                    "distance_km": round(dist, 2),
                    "duration_minutes": round(walk_time),
                    "fare": 0,
                    "instructions": f"Walk {dist:.1f}km - about {walk_time:.0f} minutes"
                }]
            }]
        }

    public_routes = transit_service.get_route_legs_public(
        request.source_lat, request.source_lng,
        request.dest_lat, request.dest_lng,
        request.budget, request.group_size
    )

    driving = await transit_service.get_driving_route(
        request.source_lat, request.source_lng,
        request.dest_lat, request.dest_lng
    )

    live_prices = await llm_agent.get_live_prices(source_name, dest_name)

    all_routes = list(public_routes)

    if driving:
        estimated_fuel_cost = _estimate_fuel_cost(driving["distance_km"])
        all_routes.insert(0, {
            "type": "car",
            "total_fare": estimated_fuel_cost,
            "total_duration_minutes": driving["duration_minutes"],
            "total_distance_km": driving["distance_km"],
            "total_walking_km": 0,
            "overall_score": 85,
            "geometry": driving["geometry"],
            "legs": [{
                "from": "Your Location",
                "to": "Destination",
                "mode": "car",
                "distance_km": driving["distance_km"],
                "duration_minutes": driving["duration_minutes"],
                "fare": estimated_fuel_cost,
                "instructions": f"Drive - fuel: ₹{estimated_fuel_cost}"
            }]
        })

    if live_prices:
        for price_option in live_prices:
            all_routes.append({
                "type": price_option.get("mode", "cab"),
                "provider": price_option.get("provider", "Ride"),
                "total_fare": price_option.get("price", 200),
                "total_duration_minutes": price_option.get("eta_minutes", 15) + 10,
                "total_distance_km": driving["distance_km"] if driving else 10,
                "total_walking_km": 0,
                "overall_score": 75,
                "legs": [{
                    "from": source_name,
                    "to": dest_name,
                    "mode": price_option.get("mode", "cab"),
                    "distance_km": driving["distance_km"] if driving else 10,
                    "duration_minutes": price_option.get("eta_minutes", 15) + 10,
                    "fare": price_option.get("price", 200),
                    "instructions": f"{price_option.get('provider', 'Ride')} - approx ₹{price_option.get('price', 200)}"
                }]
            })

    weather = await llm_agent.get_weather_impact()
    is_rainy = "rain" in (weather.get("condition", "") or "").lower()
    from datetime import datetime
    current_hour = datetime.now().hour
    is_night = current_hour < 6 or current_hour > 20

    for r in all_routes:
        base_score = r.get("overall_score", 75)
        fare = r.get("total_fare", 100)
        walk = r.get("total_walking_km", 0)
        mode_type = r.get("type", "")

        if is_rainy:
            if walk > 1: base_score -= 15
            if mode_type in ("walk", "bike"): base_score -= 20
            if mode_type in ("car", "cab"): base_score += 5
        if is_night:
            if walk > 1.5: base_score -= 10
            if mode_type in ("bus_ordinary",): base_score -= 8
            if mode_type in ("cab", "car"): base_score += 8
        if request.group_size >= 4 and mode_type in ("car", "cab", "bus_ac_vajra"):
            base_score += 10
        r["overall_score"] = max(10, min(99, base_score))

    all_routes.sort(key=lambda x: (x["overall_score"], -x.get("total_fare", 999)), reverse=True)

    travel_recs = await llm_agent.get_travel_recs(
        source_name, dest_name, request.group_size, request.budget
    )

    return _sanitize({
        "status": "success",
        "source": {"lat": request.source_lat, "lng": request.source_lng, "name": source_name},
        "destination": {"lat": request.dest_lat, "lng": request.dest_lng, "name": dest_name},
        "routes": all_routes[:6],
        "total_options": len(all_routes),
        "recommendations": travel_recs,
        "weather": weather
    })

def _estimate_fuel_cost(distance_km: float) -> float:
    from backend.core.config import settings
    liters_needed = distance_km / settings.PETROL_AVG_MILEAGE
    return round(liters_needed * settings.FUEL_PRICE_PER_LITER, 2)

@router.get("/metro-stations")
async def get_metro_stations(line: str = Query(None)):
    if line:
        stations = db.metro_lines.get(line, [])
    else:
        stations = db.metro_stations
    return {"status": "success", "stations": stations, "lines": list(db.metro_lines.keys())}

@router.get("/bus-stops")
async def get_bus_stops(near_lat: float = Query(None), near_lng: float = Query(None), radius: float = Query(1.0)):
    if near_lat and near_lng:
        stops = db.find_nearby_bus_stops(near_lat, near_lng, radius)
    else:
        stops = list(db.bus_stops.values())[:100]
    return {"status": "success", "stops": stops}

@router.get("/kia-routes")
async def get_kia_routes():
    return {"status": "success", "routes": db.kia_routes}

@router.get("/transit-fares")
async def get_transit_fares():
    return {"status": "success", "fares": db.transit_fares}

@router.get("/live-prices")
async def get_live_prices(source: str = Query(...), dest: str = Query(...), mode: str = "cab"):
    prices = await llm_agent.get_live_prices(source, dest, mode)
    return {"status": "success", "prices": prices}

@router.get("/mini-path-options")
async def get_mini_path_options(
    source_lat: float = Query(...),
    source_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
    group_size: int = Query(1)
):
    options = transit_service.get_mini_path_options(
        source_lat, source_lng, dest_lat, dest_lng, group_size
    )
    return _sanitize({"status": "success", "options": options})

@router.get("/news")
async def get_travel_news(
    source_lat: float = Query(None),
    source_lng: float = Query(None),
    dest_lat: float = Query(None),
    dest_lng: float = Query(None),
    source_name: str = Query(""),
    dest_name: str = Query(""),
):
    news = await llm_agent.get_travel_news(source_name or None, dest_name or None)
    return _sanitize({"status": "success", "news": news})
