import json, uuid

wf = {
    "id": str(uuid.uuid4()),
    "name": "Hotel Price Check Workflow",
    "active": False,
    "nodes": [
        {
            "id": "wh-hotel",
            "name": "Webhook",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 1,
            "position": [250, 300],
            "parameters": {
                "path": "hotel-prices",
                "httpMethod": "POST",
                "responseMode": "lastNode",
                "options": {}
            }
        },
        {
            "id": "or-hotel",
            "name": "OpenRouter Hotel Analyzer",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [450, 300],
            "parameters": {
                "url": "https://openrouter.ai/api/v1/chat/completions",
                "method": "POST",
                "sendBody": True,
                "body": '{"model":"openai/gpt-4o-mini","messages":[{"role":"system","content":"You are a Bengaluru hotel price analyst. Return ONLY valid JSON."},{"role":"user","content":"Estimate price range for {{$json.body.name}} in Bengaluru. Address: {{$json.body.address}}. Return JSON with: min_price (int INR per night), max_price (int INR per night), avg_price (int INR per night), currency (INR), source (MakeMyTrip/Booking.com/Goibibo), review_score (1-5), brief_summary (string). Base on realistic Bengaluru hotel prices."}],"max_tokens":512,"temperature":0.3}',
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {"name": "Authorization", "value": "Bearer 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"},
                        {"name": "HTTP-Referer", "value": "http://localhost:8006"},
                        {"name": "X-Title", "value": "VOYAGER App"}
                    ]
                },
                "options": {"bodyContentType": "json"}
            }
        },
        {
            "id": "resp-hotel",
            "name": "Response",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1,
            "position": [650, 300],
            "parameters": {}
        }
    ],
    "connections": {
        "Webhook": {
            "main": [[{"node": "OpenRouter Hotel Analyzer", "type": "main", "index": 0}]]
        },
        "OpenRouter Hotel Analyzer": {
            "main": [[{"node": "Response", "type": "main", "index": 0}]]
        }
    },
    "settings": {},
    "staticData": None,
    "pinData": {},
    "versionId": str(uuid.uuid4()),
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
}

output_path = "workflows/hotel_price_check.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print(f"Generated: {output_path}")
print(f"Workflow ID: {wf['id']}")
