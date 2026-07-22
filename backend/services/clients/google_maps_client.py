import httpx
import math
from datetime import datetime
from typing import Any
from backend.core.config import settings


RIDE_RATES = {
    "uber_go": {"base": 25, "per_km": 13, "per_min": 1.0, "min_fare": 85, "seats": 3, "name": "Uber Go"},
    "uber_xl": {"base": 35, "per_km": 20, "per_min": 1.5, "min_fare": 150, "seats": 6, "name": "Uber XL"},
    "ola_mini": {"base": 20, "per_km": 12, "per_min": 1.0, "min_fare": 80, "seats": 3, "name": "Ola Mini"},
    "ola_auto": {"base": 25, "per_km": 10, "per_min": 0.5, "min_fare": 30, "seats": 2, "name": "Ola Auto"},
    "rapido_bike": {"base": 10, "per_km": 8, "per_min": 0.5, "min_fare": 25, "seats": 1, "name": "Rapido Bike"},
    "olaxl": {"base": 35, "per_km": 22, "per_min": 1.5, "min_fare": 160, "seats": 6, "name": "Ola XL"},
}


def _get_surge_factor() -> float:
    """Estimate surge based on time of day and day of week."""
    now = datetime.now()
    hour = now.hour
    weekday = now.weekday()

    # Peak hours: 8-10am, 5-8pm weekdays
    is_weekday = weekday < 5
    is_morning_peak = 8 <= hour < 10
    is_evening_peak = 17 <= hour < 20
    is_night = 22 <= hour or hour < 5

    if is_night:
        return 0.0  # No surge
    if is_weekday and (is_morning_peak or is_evening_peak):
        return 0.3  # 1.3x peak pricing
    return 0.0  # Normal pricing (1.0x)


class GoogleMapsClient:
    """Google Maps API client for distance matrix and traffic data."""

    def __init__(self):
        self.api_key = settings.GOOGLE_MAPS_API_KEY

    async def get_distance_matrix(
        self, origin_lat: float, origin_lng: float,
        dest_lat: float, dest_lng: float,
    ) -> dict | None:
        """Get distance, duration, and traffic duration between two points."""
        if not self.api_key:
            return None

        params = {
            "origins": f"{origin_lat},{origin_lng}",
            "destinations": f"{dest_lat},{dest_lng}",
            "key": self.api_key,
            "mode": "driving",
            "departure_time": "now",
            "units": "metric",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/distancematrix/json",
                    params=params,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") == "OK" and data.get("rows"):
                        elements = data["rows"][0].get("elements", [])
                        if elements and elements[0].get("status") == "OK":
                            elem = elements[0]
                            return {
                                "distance_km": elem["distance"]["value"] / 1000,
                                "distance_text": elem["distance"]["text"],
                                "duration_min": elem["duration"]["value"] / 60,
                                "duration_text": elem["duration"]["text"],
                                "duration_in_traffic_min": elem.get("duration_in_traffic", {}).get("value", elem["duration"]["value"]) / 60,
                                "duration_in_traffic_text": elem.get("duration_in_traffic", {}).get("text", elem["duration"]["text"]),
                            }
        except Exception:
            return None
        return None

    async def estimate_ride_prices(
        self, origin_lat: float, origin_lng: float,
        dest_lat: float, dest_lng: float,
        group_size: int = 1, budget: float = 0,
    ) -> list[dict]:
        """Estimate ride prices (Uber, Ola, Rapido) with surge factors.

        Uses Google Maps Distance Matrix for real distance + traffic,
        then applies known Bengaluru fare rates.
        """
        matrix = await self.get_distance_matrix(origin_lat, origin_lng, dest_lat, dest_lng)
        if not matrix:
            return []

        dist_km = matrix["distance_km"]
        duration_min = matrix["duration_in_traffic_min"]
        surge = _get_surge_factor()

        estimates = []
        for key, rate in RIDE_RATES.items():
            if group_size > rate["seats"]:
                continue

            fare = rate["base"] + (dist_km * rate["per_km"]) + (duration_min * rate["per_min"])
            fare = fare * (1.0 + surge)
            fare = max(fare, rate["min_fare"])
            fare = round(fare)

            if budget > 0 and fare > budget:
                continue

            estimates.append({
                "service": rate["name"],
                "key": key,
                "fare": fare,
                "distance_km": round(dist_km, 1),
                "duration_min": round(duration_min),
                "surge": round(surge * 100),
                "seats": rate["seats"],
                "type": "ride",
                "currency": "INR",
            })

        estimates.sort(key=lambda x: x["fare"])
        return estimates

    async def geocode(self, query: str) -> dict | None:
        """Geocode an address or place name."""
        if not self.api_key:
            return None

        params = {
            "address": query,
            "key": self.api_key,
            "region": "in",
            "components": "administrative_area:Bangalore|country:IN",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/geocode/json",
                    params=params,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") == "OK" and data.get("results"):
                        result = data["results"][0]
                        location = result["geometry"]["location"]
                        return {
                            "lat": location["lat"],
                            "lng": location["lng"],
                            "formatted_address": result.get("formatted_address", query),
                            "place_id": result.get("place_id", ""),
                        }
        except Exception:
            return None
        return None


google_maps_client = GoogleMapsClient()
