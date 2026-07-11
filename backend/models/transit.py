from pydantic import BaseModel
from typing import Optional

class MetroStation(BaseModel):
    name: str
    line: str
    lat: float
    lng: float
    distance_from_prev_km: Optional[float] = None

class MetroLine(BaseModel):
    name: str
    color: str
    stations: list[MetroStation]

class BusStop(BaseModel):
    stop_id: str
    name: str
    lat: float
    lng: float
    routes: list[str] = []

class TransitFare(BaseModel):
    mode: str
    max_km: float
    fare: float
    child_fare: Optional[float] = None
    senior_fare: Optional[float] = None

class KiaRoute(BaseModel):
    route_id: str
    route_info: str
    stops: list[dict]

class RideHailingOption(BaseModel):
    mode: str
    provider: str
    price: float
    eta_minutes: int
    distance_km: float

class TransportOption(BaseModel):
    mode: str
    provider: str
    fare: float
    duration_minutes: float
    distance_km: float
    waiting_time_minutes: float = 0
    walking_distance_km: float = 0
    reliability_score: float = 1.0
    route_details: Optional[str] = None

class RouteLeg(BaseModel):
    from_stop: str
    to_stop: str
    transport: TransportOption
    fare: float
    duration_minutes: float
    distance_km: float
    instructions: str

class TripRoute(BaseModel):
    legs: list[RouteLeg]
    total_fare: float
    total_duration_minutes: float
    total_distance_km: float
    total_walking_km: float
    overall_score: float

class PlaceResult(BaseModel):
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
    place_type: str
    reliability_score: Optional[float] = None
    rating: Optional[float] = None
    review_summary: Optional[str] = None
    price_info: Optional[str] = None
    is_recommended: bool = True

class SearchRequest(BaseModel):
    query: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: float = 2.0

class Waypoint(BaseModel):
    lat: float
    lng: float
    name: str = ""

class ATobRequest(BaseModel):
    source_lat: float
    source_lng: float
    dest_lat: float
    dest_lng: float
    mode: str = "default"
    budget: Optional[float] = None
    group_size: int = 1
    preferences: Optional[dict] = None
    waypoints: Optional[list[Waypoint]] = None
