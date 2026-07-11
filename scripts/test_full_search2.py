import asyncio, json, sys
sys.path.insert(0, ".")
from backend.core.database import db
db.initialize()
from backend.services.geocoding import geocoding_service

async def test():
    results = await geocoding_service.search_places("Bangalore Palace", 12.99, 77.59)
    for r in results[:3]:
        name = r.get("name", "?")
        reviews = r.get("reviews", [])
        img = r.get("image_url", "")
        print(f"Name: {name}")
        print(f"  Reviews: {len(reviews)}")
        print(f"  Image: {bool(img)}")
        if reviews:
            for rv in reviews[:2]:
                print(f'    {rv.get("user")}: {rv.get("text","")[:60]}')
asyncio.run(test())
