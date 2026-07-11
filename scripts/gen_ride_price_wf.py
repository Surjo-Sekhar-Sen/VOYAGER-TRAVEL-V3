import json, uuid

wf = {
    "id": str(uuid.uuid4()),
    "name": "Ride Price Estimation Workflow",
    "active": False,
    "nodes": [
        {
            "id": "wh-ride",
            "name": "Webhook",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 1,
            "position": [250, 300],
            "parameters": {
                "path": "ride-prices",
                "httpMethod": "POST",
                "responseMode": "lastNode",
                "options": {}
            }
        },
        {
            "id": "or-ride",
            "name": "OpenRouter Price Estimator",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [450, 300],
            "parameters": {
                "url": "https://openrouter.ai/api/v1/chat/completions",
                "method": "POST",
                "sendBody": True,
                "body": '{"model":"openai/gpt-4o-mini","messages":[{"role":"system","content":"You are a Bengaluru ride price estimator. Return ONLY valid JSON array."},{"role":"user","content":"Estimate ride prices from {{$json.body.source}} to {{$json.body.destination}} in Bengaluru. Return a JSON array of objects with: provider (Uber/Ola/Rapido), mode (cab_economy/cab_premium/auto/bike), price (int INR), eta_minutes (int), note (string). Include 4-5 options covering different providers and modes."}],"max_tokens":512,"temperature":0.3}',
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
            "id": "resp-ride",
            "name": "Response",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1,
            "position": [650, 300],
            "parameters": {}
        }
    ],
    "connections": {
        "Webhook": {
            "main": [[{"node": "OpenRouter Price Estimator", "type": "main", "index": 0}]]
        },
        "OpenRouter Price Estimator": {
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

output_path = "workflows/ride_price_estimation.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print(f"Generated: {output_path}")
print(f"Workflow ID: {wf['id']}")
