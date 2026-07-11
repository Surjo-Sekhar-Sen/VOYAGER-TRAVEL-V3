import asyncio, json
from backend.services.geocoding import geocoding_service

async def test():
    results = await geocoding_service.search_places("Bangalore Palace", 12.99, 77.59)
    for r in results[:3]:
        name = r.get("name", "?")
        addr = r.get("address", "")[:60]
        nreviews = len(r.get("reviews", []))
        img = r.get("image_url", "")[:60] if r.get("image_url") else "None"
        rtg = r.get("rating")
        print(f"Name: '{name}'")
        print(f"  address: '{addr}'")
        print(f"  reviews: {nreviews}")
        print(f"  image: {img}")
        print(f"  rating: {rtg}")
        print()

asyncio.run(test())
