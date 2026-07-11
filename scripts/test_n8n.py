import httpx, json, asyncio

async def test():
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            'http://localhost:5678/webhook-test/verify-place',
            json={'name': 'Commercial Street, Bengaluru', 'address': 'Commercial Street, Bengaluru, India'}
        )
        print('Status:', resp.status_code)
        data = resp.json()
        print('Full response keys:', list(data.keys()))

        content = data["choices"][0]["message"]["content"]
        content = content.strip()
        for prefix in ["```json", "```"]:
            if content.startswith(prefix):
                content = content[len(prefix):]
        for suffix in ["```"]:
            if content.endswith(suffix):
                content = content[:-len(suffix)]
        content = content.strip()

        print("\nExtracted JSON:", content)
        parsed = json.loads(content)
        print("\nParsed result:")
        print(json.dumps(parsed, indent=2))

asyncio.run(test())
