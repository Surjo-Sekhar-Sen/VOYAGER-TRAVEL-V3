import requests, uuid

KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMTdlNmEzZC00Mjc2LTRmNGQtYWJhZi05ZjkwOGJkNjk3MjYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMWQ3NmY0MTctNmY4OS00ODc4LTk5ZDctYzBiMTUwZGU1ODJlIiwiaWF0IjoxNzgzNzExNzgwfQ.kGU-2cwHhXRpqJEW42lQKBJOdNWuINqhSoFOSD0vz-o"
API = "http://localhost:5678/api/v1"
HEADERS = {"X-N8N-API-KEY": KEY, "Content-Type": "application/json"}

def make_wf(name, path, system, user):
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
                    "body": '{"model":"openai/gpt-4o-mini","messages":[{"role":"system","content":"' + system + '"},{"role":"user","content":"' + user + '"}],"max_tokens":512,"temperature":0.3}',
                    "sendHeaders": True,
                    "contentType": "raw",
                    "rawContentType": "application/json",
                    "headerParameters": {
                        "parameters": [
                            {"name": "Authorization", "value": "Bearer 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"},
                            {"name": "HTTP-Referer", "value": "http://localhost:8006"},
                            {"name": "X-Title", "value": "VOYAGER App"}
                        ]
                    },
                    "options": {}
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

# Create ride price workflow
wf = make_wf(
    "Ride Price Estimation Workflow",
    "ride-prices",
    "You are a Bengaluru ride price estimator. Return ONLY valid JSON.",
    "Estimate ride prices from {{$json.body.source}} to {{$json.body.destination}} in Bengaluru. Return a JSON array of objects with: provider (Uber/Ola/Rapido), mode (cab_economy/cab_premium/auto/bike), price (int INR), eta_minutes (int), note (string). 4-5 options."
)

r = requests.post(f"{API}/workflows", headers=HEADERS, json=wf)
print(f"Ride: {r.status_code}")
if r.status_code >= 400:
    print(r.text)
else:
    wid = r.json()["id"]
    requests.post(f"{API}/workflows/{wid}/activate", headers=HEADERS)
    print(f"  Activated: {wid}")

# Create hotel price workflow
wf2 = make_wf(
    "Hotel Price Check Workflow",
    "hotel-prices",
    "You are a Bengaluru hotel price analyst. Return ONLY valid JSON.",
    "Estimate price range for {{$json.body.name}} in Bengaluru. Address: {{$json.body.address}}. Return JSON with: min_price (int INR per night), max_price (int INR per night), avg_price (int INR per night), currency (INR), source (MakeMyTrip/Booking.com/Goibibo), review_score (1-5), brief_summary (string)."
)

r2 = requests.post(f"{API}/workflows", headers=HEADERS, json=wf2)
print(f"Hotel: {r2.status_code}")
if r2.status_code >= 400:
    print(r2.text)
else:
    wid2 = r2.json()["id"]
    requests.post(f"{API}/workflows/{wid2}/activate", headers=HEADERS)
    print(f"  Activated: {wid2}")
