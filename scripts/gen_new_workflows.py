import json, uuid

def create_wf(name, path, system_prompt, user_prompt):
    return {
        "name": name,
        "nodes": [
            {
                "id": "wh",
                "name": "Webhook",
                "type": "n8n-nodes-base.webhook",
                "typeVersion": 1,
                "position": [250, 300],
                "parameters": {
                    "path": path,
                    "httpMethod": "POST",
                    "responseMode": "lastNode",
                    "options": {}
                },
                "webhookId": path
            },
            {
                "id": "or",
                "name": "OpenRouter",
                "type": "n8n-nodes-base.httpRequest",
                "typeVersion": 4.2,
                "position": [450, 300],
                "parameters": {
                    "url": "https://openrouter.ai/api/v1/chat/completions",
                    "method": "POST",
                    "sendBody": True,
                    "body": json.dumps({
                        "model": "openai/gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "max_tokens": 512,
                        "temperature": 0.3
                    }),
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
                "id": "resp",
                "name": "Response",
                "type": "n8n-nodes-base.respondToWebhook",
                "typeVersion": 1,
                "position": [650, 300],
                "parameters": {}
            }
        ],
        "connections": {
            "Webhook": {"main": [[{"node": "OpenRouter", "type": "main", "index": 0}]]},
            "OpenRouter": {"main": [[{"node": "Response", "type": "main", "index": 0}]]}
        },
        "settings": {},
        "pinData": {},
        "staticData": None
    }

# Ride Price
ride = create_wf(
    "Ride Price Estimation",
    "ride-prices",
    "You are a Bengaluru ride price estimator. Return ONLY valid JSON.",
    "Estimate ride prices from {{$json.body.source}} to {{$json.body.destination}} in Bengaluru. Return a JSON array of objects with: provider (Uber/Ola/Rapido), mode (cab_economy/cab_premium/auto/bike), price (int INR), eta_minutes (int), note (string). Include 4-5 realistic options."
)

with open("workflows/ride_price_estimation.json", "w") as f:
    json.dump(ride, f, indent=2, ensure_ascii=False)

# Hotel Price
hotel = create_wf(
    "Hotel Price Check",
    "hotel-prices",
    "You are a Bengaluru hotel price analyst. Return ONLY valid JSON.",
    "Estimate price range for {{$json.body.name}} in Bengaluru. Address: {{$json.body.address}}. Return JSON with: min_price (int INR per night), max_price (int INR per night), avg_price (int INR per night), currency (INR), source (MakeMyTrip/Booking.com/Goibibo), review_score (1-5), brief_summary (string)."
)

with open("workflows/hotel_price_check.json", "w") as f:
    json.dump(hotel, f, indent=2, ensure_ascii=False)

print("Generated both workflow JSONs (without IDs)")
