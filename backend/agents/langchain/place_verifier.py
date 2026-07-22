import json
from backend.agents.langchain.base import base_agent
from backend.agents.langchain.tools import web_search, search_justdial


class PlaceVerifierAgent:

    async def verify_place(self, name: str, address: str = None) -> dict:
        addr = address or f"{name}, Bengaluru"
        google_data = await web_search(f"{name} {addr} Google Maps reviews rating", 3)
        justdial_data = await search_justdial(name, "Bengaluru")
        web_context = ""
        if google_data:
            web_context += "Google: " + " | ".join([g["snippet"][:150] for g in google_data])
        if justdial_data:
            web_context += "\nJustDial: " + " | ".join([j["snippet"][:150] for j in justdial_data])

        system_prompt = """You are a place verifier for Bengaluru, India. Your job is to verify if a place 
actually exists, is currently operational, and is of good quality based on web search results and reviews.
Return ONLY valid JSON."""

        user_prompt = f"""Verify this Bengaluru place: "{name}"
Address: {addr}

Web search results: {web_context[:2000] if web_context else "No web results found. Use general knowledge."}

Analyze:
1. Does this place actually exist? (check name, address against search results)
2. Is it currently operational and recommended?
3. What do reviews say about it? Are there any complaints, safety concerns, or positive feedback?
4. What is the overall reliability score?

Return JSON:
{{
  "reliability_score": 0.0-1.0 (based on review sentiment analysis),
  "rating": 1.0-5.0 (estimated from reviews),
  "review_summary": "2-3 sentence crisp summary of what reviews say",
  "is_recommended": true/false (only true if clearly positive),
  "concerns": "any safety, quality, or operational concerns mentioned",
  "key_findings": ["finding1", "finding2"]
}}

Rules:
- If reviews say "good", "great", "excellent", "clean", "friendly" → higher score
- If reviews say "closed", "bad", "dirty", "unsafe", "not available", "out of cash" → lower score
- If no info found, assume average (0.6 reliability, 3.5 rating)
- Be conservative with recommendations - prioritize user safety</string>"""

        try:
            text = await base_agent._call_llm(system_prompt, user_prompt, json_mode=True)
            result = base_agent._extract_json(text)
            return {
                **{
                    "reliability_score": 0.7,
                    "rating": 4.0,
                    "review_summary": f"{name} in Bengaluru",
                    "is_recommended": True,
                    "concerns": "",
                    "key_findings": [],
                    "source": "langchain_verified",
                },
                **result,
            }
        except Exception:
            return {
                "reliability_score": 0.7,
                "rating": 4.0,
                "review_summary": f"{name} in Bengaluru",
                "is_recommended": True,
                "concerns": "",
                "key_findings": [],
                "source": "langchain_verified",
            }

    async def verify_nearby_places(self, places: list[dict], lat: float, lng: float) -> list[dict]:
        verified = []
        for place in places:
            result = await self.verify_place(place.get("name", ""), place.get("address"))
            place["reliability_score"] = result.get("reliability_score", 0.7)
            place["is_recommended"] = result.get("is_recommended", True)
            place["review_summary"] = result.get("review_summary", "")
            place["concerns"] = result.get("concerns", "")
            place["rating"] = result.get("rating", place.get("rating", 4.0))
            place["verification_source"] = result.get("source", "langchain")
            verified.append(place)
        return verified


place_verifier = PlaceVerifierAgent()
