import json
import re
import httpx
from typing import Optional
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from backend.core.config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_HEADERS = {
    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:8006",
    "X-Title": "VOYAGER App",
}


class LangChainBaseAgent:
    _working_model: Optional[str] = None

    async def _call_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        json_mode: bool = False,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str:
        if settings.OPENROUTER_API_KEY:
            return await self._call_openrouter(
                system_prompt, user_prompt, json_mode, temperature, max_tokens
            )
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here":
            return await self._call_gemini(system_prompt, user_prompt)
        raise Exception("No LLM configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY in .env")

    async def _call_openrouter(
        self,
        system_prompt: str,
        user_prompt: str,
        json_mode: bool = False,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str:
        models = [settings.OPENROUTER_MODEL] + settings.OPENROUTER_FALLBACK_MODELS
        if self._working_model and self._working_model in models:
            models.insert(0, models.pop(models.index(self._working_model)))

        for model in models:
            try:
                body = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                }
                if json_mode:
                    body["response_format"] = {"type": "json_object"}

                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.post(
                        OPENROUTER_URL, json=body, headers=OPENROUTER_HEADERS
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"]
                        self._working_model = model
                        return content
                    elif resp.status_code == 401:
                        raise Exception("Invalid OpenRouter API key")
                    else:
                        continue
            except Exception as e:
                print(f"[LangChain] Model {model} failed: {str(e)[:80]}")
                continue
        raise Exception("All OpenRouter models failed")

    async def _call_gemini(self, system_prompt: str, user_prompt: str) -> str:
        try:
            import google.generativeai as genai
            import asyncio

            genai.configure(api_key=settings.GEMINI_API_KEY)
            gemini_models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"]
            for model_name in gemini_models:
                try:
                    model = genai.GenerativeModel(model_name)
                    response = await asyncio.to_thread(
                        model.generate_content, f"{system_prompt}\n\n{user_prompt}"
                    )
                    return response.text
                except Exception:
                    continue
        except Exception:
            pass
        raise Exception("All Gemini models failed")

    def _extract_json(self, text: str) -> dict:
        json_match = re.search(r"\{.*\}", text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except Exception:
                pass
        try:
            return json.loads(text)
        except Exception:
            return {"error": "parse_failed", "raw": text[:200]}

    def _extract_json_array(self, text: str) -> list:
        json_match = re.search(r"\[.*\]", text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except Exception:
                pass
        try:
            return json.loads(text)
        except Exception:
            return []


base_agent = LangChainBaseAgent()
