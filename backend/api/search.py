from fastapi import APIRouter, Query
from backend.services.geocoding import geocoding_service
from backend.agents.llm_agent import llm_agent


router = APIRouter(prefix="/api/search", tags=["Search"])

@router.get("/places")
async def search_places(
    q: str = Query(..., description="Search query"),
    lat: float = Query(None, description="User latitude"),
    lng: float = Query(None, description="User longitude")
):
    results = await geocoding_service.search_places(q, lat, lng)

    return {"status": "success", "results": results, "total": len(results)}

@router.get("/nearby")
async def search_nearby(
    lat: float = Query(..., description="Center latitude"),
    lng: float = Query(..., description="Center longitude"),
    radius_km: float = Query(2.0, description="Search radius in km"),
    place_type: str = Query(None, description="Type of place (mall, hospital, etc.)")
):
    results = await geocoding_service.get_nearby_places(lat, lng, radius_km, place_type)

    return {
        "status": "success",
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
        "results": results,
        "total": len(results)
    }

@router.get("/suggestions")
async def get_suggestions(q: str = Query("", description="Partial query")):
    if len(q) < 2:
        return {"status": "success", "suggestions": []}

    suggestions = await geocoding_service.get_suggestions(q)

    return {"status": "success", "suggestions": suggestions}

@router.get("/verify-place")
async def verify_place(
    name: str = Query(..., description="Place name"),
    address: str = Query(None, description="Place address")
):
    result = await geocoding_service.verify_place(name, address)
    return {"status": "success", "place": name, "verification": result}

@router.get("/ai-chat")
async def ai_chat(
    message: str = Query(..., description="User message"),
    lat: float = Query(None),
    lng: float = Query(None)
):
    context = {"lat": lat, "lng": lng} if lat and lng else None
    response = await llm_agent.chat_response(message, context)
    return {"status": "success", "response": response}

@router.post("/enrich-place")
async def enrich_place(body: dict):
    name = body.get("name", "")
    lat = body.get("lat")
    lng = body.get("lng")
    place_type = body.get("place_type", "place")
    address = body.get("address", "")
    enriched = await geocoding_service.enrich_single_place(name, lat, lng, place_type, address)
    return {"status": "success", "place": enriched}

@router.get("/ride-prices")
async def get_ride_prices(
    source: str = Query(..., description="Source location name"),
    destination: str = Query(..., description="Destination location name")
):
    prices = await llm_agent.get_live_prices(source, destination, mode="all")
    return {"status": "success", "source": source, "destination": destination, "prices": prices or []}

@router.get("/current-events")
async def current_events(location: str = Query("Bengaluru")):
    events = await llm_agent.get_current_events(location)
    return {"status": "success", "location": location, "events": events}
