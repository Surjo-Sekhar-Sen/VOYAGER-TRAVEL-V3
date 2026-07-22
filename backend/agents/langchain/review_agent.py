import json
from backend.agents.langchain.base import base_agent
from backend.agents.langchain.tools import get_reviews_from_web


class ReviewAgent:

    async def analyze_place(self, name: str, address: str = None) -> dict:
        addr = address or f"{name}, Bengaluru"
        web_reviews = await get_reviews_from_web(name, addr)
        review_context = ""
        if web_reviews:
            review_context = "\n".join([f"- {r['text'][:200]}" for r in web_reviews])

        system_prompt = """You are a review analyst for Bengaluru places. Analyze reviews and return a summary.
Return ONLY valid JSON."""

        user_prompt = f"""Analyze reviews for "{name}" ({addr}):

Web search review snippets:
{review_context[:2500] if review_context else "No reviews found. Use general knowledge of this place in Bengaluru."}

Return JSON:
{{
  "rating": 1.0-5.0 (estimated overall rating),
  "reliability_score": 0.0-1.0 (how reliable/trustworthy this place is),
  "review_summary": "2-3 sentence summary of what people say",
  "is_recommended": true/false,
  "price_info": "price range or note about pricing (if applicable)",
  "reviews": [
    {{
      "user": "Realistic Indian name",
      "rating": 1-5 (integer, varied across reviews),
      "text": "specific realistic review text",
      "date": "relative time like '2 weeks ago'"
    }}
  ],
  "key_themes": ["theme1", "theme2"],
  "source": "langchain_analysis"
}}

Rules:
- 3-5 reviews with varied ratings (2 to 5)
- At least 60% should reflect actual search results if available
- Reviews should sound like real user experiences from Bengaluru
- For hotels: mention room quality, service, location, food
- For ATMs: mention cash availability, working status
- For restaurants: mention food quality, hygiene, service
- For shops: mention product quality, pricing, behavior"""

        try:
            text = await base_agent._call_llm(system_prompt, user_prompt, json_mode=True)
            result = base_agent._extract_json(text)
            return {
                **{
                    "rating": 4.0,
                    "reliability_score": 0.75,
                    "review_summary": f"{name} in Bengaluru",
                    "is_recommended": True,
                    "reviews": [],
                    "key_themes": [],
                    "source": "langchain_analysis",
                },
                **result,
            }
        except Exception:
            return {
                "rating": 4.0,
                "reliability_score": 0.75,
                "review_summary": f"{name} in Bengaluru",
                "is_recommended": True,
                "reviews": [],
                "key_themes": [],
                "source": "langchain_analysis",
            }

    async def summarize_reviews(self, reviews: list[dict]) -> str:
        if not reviews:
            return "No reviews available."
        system_prompt = "Summarize these reviews concisely in 2-3 sentences."
        user_prompt = f"Reviews: {json.dumps(reviews[:5])}\n\nSummarize what customers say about this place:"
        try:
            text = await base_agent._call_llm(system_prompt, user_prompt)
            return text[:300]
        except Exception:
            return "Reviews summary unavailable."

    async def analyze_nearby_places(self, places: list[dict]) -> list[dict]:
        analyzed = []
        for place in places:
            name = place.get("name", "")
            addr = place.get("address")
            result = await self.analyze_place(name, addr)
            place["rating"] = result.get("rating", place.get("rating", 4.0))
            place["reliability_score"] = result.get("reliability_score", 0.75)
            place["review_summary"] = result.get("review_summary", "")
            place["is_recommended"] = result.get("is_recommended", True)
            place["reviews"] = result.get("reviews", [])
            place["key_themes"] = result.get("key_themes", [])
            place["review_source"] = result.get("source", "langchain_analysis")
            analyzed.append(place)
        return analyzed


review_agent = ReviewAgent()
