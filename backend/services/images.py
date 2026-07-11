import httpx

WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
UA = "VOYAGER-App/1.0 (India Transit Navigator)"

class ImageService:
    async def get_place_image(self, name: str, place_type: str = None) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
                headers = {"User-Agent": UA}
                search = f"{name} Bengaluru"

                params = {
                    "action": "query", "format": "json",
                    "generator": "search", "prop": "pageimages",
                    "pithumbsize": 400, "gsrsearch": search,
                    "gsrlimit": 3, "redirects": 1,
                }
                resp = await client.get(WIKIPEDIA_API, params=params, headers=headers)
                if resp.status_code == 200:
                    for pid, page in resp.json().get("query", {}).get("pages", {}).items():
                        if pid != "-1" and "thumbnail" in page:
                            return page["thumbnail"]["source"]

                for title in (f"{name}, Bengaluru", f"{name}, Bangalore", name):
                    params2 = {
                        "action": "query", "format": "json", "prop": "pageimages",
                        "pithumbsize": 400, "titles": title, "redirects": 1,
                    }
                    resp = await client.get(WIKIPEDIA_API, params=params2, headers=headers)
                    if resp.status_code == 200:
                        for pid, page in resp.json().get("query", {}).get("pages", {}).items():
                            if pid != "-1" and "thumbnail" in page:
                                return page["thumbnail"]["source"]
        except Exception:
            pass
        return None

image_service = ImageService()
