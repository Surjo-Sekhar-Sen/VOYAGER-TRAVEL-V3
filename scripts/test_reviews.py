import asyncio, json
from backend.agents.llm_agent import llm_agent

async def test():
    names = ["Bangalore Palace", "MG Road"]
    prompt = f"""For each Bengaluru place below, provide realistic data.
Return a JSON array. Each object: name, rating (1.0-5.0), reliability_score (0.0-1.0),
review_summary (brief 10-20 word summary), is_recommended (bool), price_info (string if hotel/lodge, else null),
reviews (array of 2-4 objects with: user (Indian name string), rating (1-5 int), text (one-line real-sounding review), date (relative like "2 weeks ago" or "last month")).

Places: {json.dumps(names)}"""
    print("Prompt sent...")
    text = await llm_agent._call_llm(
        "You are a review analyst for Bengaluru places. Return ONLY valid JSON array.",
        prompt, json_mode=True
    )
    print(f"Type: {type(text)}")
    print(f"Text: {str(text)[:300]}")

    data = json.loads(text) if isinstance(text, str) else text
    print(f"Data type: {type(data)}")
    
    if isinstance(data, dict):
        for k, v in data.items():
            print(f"  key: {k} -> type={type(v).__name__}")
            if isinstance(v, list):
                data = v
                break
    if isinstance(data, list):
        for item in data[:2]:
            print(f"Name: {item.get('name')}")
            reviews = item.get("reviews", [])
            print(f"  reviews count: {len(reviews)}")
            for r in reviews[:2]:
                print(f"    {r.get('user')}: {r.get('text', '')[:60]}")
    else:
        print(f"Cannot process: {str(data)[:200]}")

asyncio.run(test())
