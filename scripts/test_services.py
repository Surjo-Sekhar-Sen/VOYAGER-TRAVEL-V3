import asyncio
from backend.services.images import image_service
from backend.services.n8n_service import n8n_service

async def test():
    url = await image_service.get_place_image("Bangalore Palace", "attraction")
    print("Image URL:", url)
    
    hp = await n8n_service.get_hotel_prices("The Oberoi", "MG Road, Bengaluru")
    print("Hotel prices:", hp)
    
    rp = await n8n_service.get_ride_prices("Koramangala", "Whitefield")
    if rp:
        print("Ride prices count:", len(rp))
        for p in rp[:2]:
            print(f'  {p["provider"]} {p["mode"]}: {p["price"]}')

asyncio.run(test())
