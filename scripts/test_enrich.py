import asyncio, json
from backend.services.geocoding import geocoding_service

async def test():
    # Simulate a search result exactly as it comes from OSM
    results = [
        {
            "name": "Bangalore Palace",
            "address": "Bangalore Palace, Vasanth Nagar, Bengaluru, Karnataka, India",
            "lat": 12.998, "lng": 77.592,
            "place_type": "attraction",
            "rating": 4.0, "reliability_score": 0.8,
            "is_recommended": True,
        }
    ]
    
    try:
        enriched = await geocoding_service._enrich_results(results)
        for r in enriched:
            print(f"Name: {r['name']}")
            print(f"  summary: {r.get('review_summary', 'N/A')[:60]}")
            print(f"  reviews count: {len(r.get('reviews', []))}")
            if r.get("reviews"):
                for v in r["reviews"]:
                    print(f"    {v.get('user')}: {v.get('text', '')[:60]}")
    except Exception as ex:
        print(f"Error: {ex}")
        import traceback
        traceback.print_exc()

asyncio.run(test())
