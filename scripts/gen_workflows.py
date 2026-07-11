import json, uuid, os

def make_place_workflow():
    return {
        "id": str(uuid.uuid4()),
        "name": "Place Verification Workflow",
        "active": True,
        "nodes": [
            {
                "id": "webhook-1",
                "name": "Webhook",
                "type": "n8n-nodes-base.webhook",
                "typeVersion": 1,
                "position": [250, 300],
                "parameters": {"path": "verify-place", "options": {}}
            },
            {
                "id": "openrouter-1",
                "name": "OpenRouter Analysis",
                "type": "n8n-nodes-base.httpRequest",
                "typeVersion": 4.2,
                "position": [450, 300],
                "parameters": {
                    "url": "https://openrouter.ai/api/v1/chat/completions",
                    "sendBody": True,
                    "bodyParameters": {
                        "parameters": [
                            {"name": "model", "value": "openai/gpt-4o-mini"},
                            {"name": "messages", "value": '[{"role":"system","content":"You are a place verifier for Bengaluru. Return ONLY valid JSON."},{"role":"user","content":"Verify this Bengaluru place: {{$json.body.name}}. Address: {{$json.body.address}}. Return JSON with: reliability_score (0-1), rating (1-5), review_summary (string), is_recommended (bool), concerns (string or null)."}]'},
                            {"name": "max_tokens", "value": 512},
                            {"name": "temperature", "value": 0.3},
                            {"name": "response_format", "value": {"type": "json_object"}}
                        ]
                    },
                    "options": {
                        "headers": {
                            "Authorization": "Bearer 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",
                            "HTTP-Referer": "http://localhost:8006",
                            "X-Title": "VOYAGER App"
                        }
                    }
                }
            },
            {
                "id": "response-1",
                "name": "Response",
                "type": "n8n-nodes-base.respondToWebhook",
                "typeVersion": 1,
                "position": [650, 300],
                "parameters": {}
            }
        ],
        "connections": {
            "Webhook": {
                "main": [[{"node": "OpenRouter Analysis", "type": "main", "index": 0}]]
            },
            "OpenRouter Analysis": {
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


def make_weather_workflow():
    return {
        "id": str(uuid.uuid4()),
        "name": "Weather & Traffic Check Workflow",
        "active": True,
        "nodes": [
            {
                "id": "webhook-2",
                "name": "Webhook",
                "type": "n8n-nodes-base.webhook",
                "typeVersion": 1,
                "position": [250, 300],
                "parameters": {"path": "weather-traffic", "options": {}}
            },
            {
                "id": "weather-1",
                "name": "Open-Meteo API",
                "type": "n8n-nodes-base.httpRequest",
                "typeVersion": 4.2,
                "position": [450, 300],
                "parameters": {
                    "url": "https://api.open-meteo.com/v1/forecast?latitude=12.97&longitude=77.59&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Kolkata",
                    "options": {}
                }
            },
            {
                "id": "openrouter-2",
                "name": "OpenRouter Impact Analysis",
                "type": "n8n-nodes-base.httpRequest",
                "typeVersion": 4.2,
                "position": [650, 300],
                "parameters": {
                    "url": "https://openrouter.ai/api/v1/chat/completions",
                    "sendBody": True,
                    "bodyParameters": {
                        "parameters": [
                            {"name": "model", "value": "openai/gpt-4o-mini"},
                            {"name": "messages", "value": '[{"role":"system","content":"You are a travel weather analyst for Bengaluru. Return ONLY valid JSON."},{"role":"user","content":"Current weather data: {{$node[\'Open-Meteo API\'].json}}. Location: {{$json.body.location or \'Bengaluru\'}}. Return JSON with: condition (string), temperature_celsius (string), impact (\'minor\'/\'moderate\'/\'severe\'), recommendation (string), traffic_alert (string or null)."}]'},
                            {"name": "max_tokens", "value": 512},
                            {"name": "temperature", "value": 0.3},
                            {"name": "response_format", "value": {"type": "json_object"}}
                        ]
                    },
                    "options": {
                        "headers": {
                            "Authorization": "Bearer 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",
                            "HTTP-Referer": "http://localhost:8006",
                            "X-Title": "VOYAGER App"
                        }
                    }
                }
            },
            {
                "id": "response-2",
                "name": "Response",
                "type": "n8n-nodes-base.respondToWebhook",
                "typeVersion": 1,
                "position": [850, 300],
                "parameters": {}
            }
        ],
        "connections": {
            "Webhook": {
                "main": [[{"node": "Open-Meteo API", "type": "main", "index": 0}]]
            },
            "Open-Meteo API": {
                "main": [[{"node": "OpenRouter Impact Analysis", "type": "main", "index": 0}]]
            },
            "OpenRouter Impact Analysis": {
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


output_dir = os.path.join(os.path.dirname(__file__), "..", "workflows")

with open(os.path.join(output_dir, "place_verification.json"), "w", encoding="utf-8") as f:
    json.dump(make_place_workflow(), f, indent=2, ensure_ascii=False)

with open(os.path.join(output_dir, "weather_traffic_check.json"), "w", encoding="utf-8") as f:
    json.dump(make_weather_workflow(), f, indent=2, ensure_ascii=False)

print("Generated workflow JSON files with correct n8n format")
