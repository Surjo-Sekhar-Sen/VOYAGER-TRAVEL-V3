"""
Import n8n workflow JSON files into the local n8n instance.

Usage:
    python scripts/import_n8n_workflows.py

Requires n8n to be running with its API enabled.
Set N8N_API_KEY in .env if n8n requires authentication.
"""

import json
import os
import httpx
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

N8N_API_URL = "http://localhost:5678/api/v1"
WORKFLOWS_DIR = os.path.join(os.path.dirname(__file__), "..", "workflows")

WORKFLOW_NAMES = {
    "weather_traffic_check.json": "weather-traffic",
    "place_verification.json": "verify-place",
    "ride_price_estimation.json": "ride-prices",
    "hotel_price_check.json": "hotel-prices",
    "place_reviews.json": "place-reviews",
}


async def get_existing_workflows(client: httpx.AsyncClient) -> dict:
    try:
        resp = await client.get(f"{N8N_API_URL}/workflows")
        if resp.status_code == 200:
            return {w["name"]: w for w in resp.json().get("data", [])}
    except Exception:
        pass
    return {}


async def import_workflow(client: httpx.AsyncClient, filepath: str, webhook_suffix: str) -> bool:
    with open(filepath, "r") as f:
        workflow = json.load(f)

    workflow_name = workflow.get("name", os.path.splitext(os.path.basename(filepath))[0])

    existing = await get_existing_workflows(client)
    if workflow_name in existing:
        print(f"  Workflow '{workflow_name}' already exists (ID: {existing[workflow_name]['id']}), updating...")
        wid = existing[workflow_name]["id"]
        resp = await client.put(f"{N8N_API_URL}/workflows/{wid}", json=workflow)
    else:
        print(f"  Creating workflow '{workflow_name}'...")
        resp = await client.post(f"{N8N_API_URL}/workflows", json=workflow)

    if resp.status_code in (200, 201):
        print(f"  [OK] Webhook: http://localhost:5678/webhook/{webhook_suffix}")
        return True
    else:
        print(f"  [FAIL] ({resp.status_code}): {resp.text[:200]}")
        return False


async def main():
    n8n_running = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{N8N_API_URL.replace('/api/v1', '')}/healthz")
            n8n_running = resp.status_code == 200
    except Exception:
        pass

    if not n8n_running:
        print("[ERROR] n8n is not running. Start it with: n8n start")
        print("   Then run this script again.")
        return

    if not os.path.isdir(WORKFLOWS_DIR):
        print(f"[ERROR] Workflows directory not found: {WORKFLOWS_DIR}")
        return

    headers = {"Content-Type": "application/json"}
    n8n_api_key = os.getenv("N8N_API_KEY")
    if n8n_api_key:
        headers["X-N8N-API-KEY"] = n8n_api_key

    async with httpx.AsyncClient(base_url=N8N_API_URL, headers=headers, timeout=15.0) as client:
        workflow_files = [f for f in os.listdir(WORKFLOWS_DIR) if f.endswith(".json")]
        if not workflow_files:
            print("No workflow JSON files found.")
            return

        print(f"Found {len(workflow_files)} workflow(s) to import:\n")

        for filename in workflow_files:
            filepath = os.path.join(WORKFLOWS_DIR, filename)
            webhook_suffix = WORKFLOW_NAMES.get(filename, filename.replace(".json", ""))
            print(f"[{filename}] -> /webhook/{webhook_suffix}")
            await import_workflow(client, filepath, webhook_suffix)

    print("\n[Done] Activate the workflows in the n8n UI (http://localhost:5678)")
    print("   or set them to active via API.")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
