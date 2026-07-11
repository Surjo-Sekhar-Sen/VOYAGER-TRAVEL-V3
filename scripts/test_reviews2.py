import asyncio, json
from backend.agents.llm_agent import llm_agent
from backend.services.geocoding import geocoding_service

async def test():
    # Simulate what enrichment does
    names = ["Bangalore Palace", "MG Road"]
    prompt = f"""For each Bengaluru place below, provide realistic data.
Return a JSON array. Each object: name, rating (1.0-5.0), reliability_score (0.0-1.0),
review_summary (brief 10-20 word summary), is_recommended (bool), price_info (string if hotel/lodge, else null),
reviews (array of 2-4 objects with: user (Indian name string), rating (1-5 int), text (one-line real-sounding review), date (relative like "2 weeks ago" or "last month")).

Places: {json.dumps(names)}"""

    try:
        text = await llm_agent._call_llm(
            "You are a review analyst for Bengaluru places. Return ONLY valid JSON array.",
            prompt, json_mode=True
        )
        enrichments = json.loads(text) if isinstance(text, str) else text
        if isinstance(enrichments, dict):
            for v in enrichments.values():
                if isinstance(v, list):
                    enrichments = v
                    break
        
        if isinstance(enrichments, list):
            for e in enrichments:
                if isinstance(e, dict) and "name" in e:
                    print(f"Place: {e['name']}")
                    print(f"  has reviews: {'reviews' in e}")
                    if "reviews" in e:
                        print(f"  reviews count: {len(e['reviews'])}")
                        for r in e["reviews"][:2]:
                            print(f"    {r.get('user')}: {r.get('text', '')[:60]}")
    except Exception as ex:
        print(f"Error: {ex}")

asyncio.run(test())
