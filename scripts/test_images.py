import httpx, asyncio

async def test():
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        params = {
            "action": "query",
            "format": "json",
            "prop": "pageimages",
            "pithumbsize": 500,
            "titles": "Bangalore Palace",
            "redirects": 1,
        }
        resp = await client.get("https://en.wikipedia.org/w/api.php", params=params, headers={"User-Agent": "VOYAGER-App/1.0 (India Transit Navigator; +https://github.com/voyager)"})
        print("Status:", resp.status_code)
        data = resp.json()
        pages = data.get("query", {}).get("pages", {})
        for pid, page in pages.items():
            print(f"Page {pid}: title={page.get('title')}, keys={list(page.keys())}")
            if "thumbnail" in page:
                print(f"  Thumbnail: {page['thumbnail']['source']}")
            else:
                print("  No thumbnail")
        
        # Also test Unsplash
        params2 = {
            "query": "Bangalore Palace",
            "client_id": "DEMO_KEY",
            "per_page": 1,
        }
        resp2 = await client.get("https://api.unsplash.com/search/photos", params=params2)
        print(f"\nUnsplash status: {resp2.status_code}")
        if resp2.status_code == 200:
            data2 = resp2.json()
            if data2.get("results"):
                print(f"  Image: {data2['results'][0]['urls']['small']}")
            else:
                print("  No results")
        else:
            print(f"  Error: {resp2.text[:200]}")

asyncio.run(test())
