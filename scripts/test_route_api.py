import httpx, asyncio, json

async def test():
    async with httpx.AsyncClient(timeout=30.0) as c:
        # Test route planning
        payload = {
            "source_lat": 12.9716,
            "source_lng": 77.5946,
            "dest_lat": 12.9344,
            "dest_lng": 77.6101,
            "mode": "default",
            "group_size": 1
        }
        try:
            r = await c.post("http://localhost:8014/api/routes/plan", json=payload)
            print(f"Route Plan Status: {r.status_code}")
            if r.status_code == 200:
                d = r.json()
                print(f"Routes found: {d['total_options']}")
                for i, route in enumerate(d['routes'][:3]):
                    print(f"\nRoute {i+1}: {route['type']}")
                    print(f"  Fare: Rs{route['total_fare']}")
                    print(f"  Duration: {route['total_duration_minutes']}min")
                    print(f"  Score: {route['overall_score']}")
                    print(f"  Route numbers: {route.get('route_numbers', [])}")
                    print(f"  Legs: {len(route['legs'])}")
                    for leg in route['legs']:
                        print(f"    {leg['mode']}: {leg['from'][:20]} -> {leg['to'][:20]}")
            else:
                print(f"Error: {r.text[:200]}")
        except Exception as e:
            print(f"Route plan error (expected if no LLM): {str(e)[:100]}")

        # Test mini-path options (uses local data only, fast)
        r2 = await c.get("http://localhost:8014/api/routes/mini-path-options", params={
            "source_lat": 12.9716,
            "source_lng": 77.5946,
            "dest_lat": 12.9344,
            "dest_lng": 77.6101,
            "group_size": 1
        })
        print(f"\nMini-path Status: {r2.status_code}")
        if r2.status_code == 200:
            d2 = r2.json()
            opts = d2.get('options', {})
            print(f"Direct distance: {opts.get('direct_distance_km')}km")
            print(f"Source walk options: {len(opts.get('source_walk_options', []))}")
            src_transit = opts.get('source_to_transit', {})
            print(f"Source bus options: {len(src_transit.get('bus', []))}")
            print(f"Source metro options: {len(src_transit.get('metro', []))}")
            dest_transit = opts.get('transit_to_dest', {})
            print(f"Dest bus options: {len(dest_transit.get('bus', []))}")
            print(f"Dest metro options: {len(dest_transit.get('metro', []))}")


if __name__ == "__main__":
    asyncio.run(test())
