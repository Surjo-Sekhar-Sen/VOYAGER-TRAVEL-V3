# VOYAGER - Project Summary (Updated)

## Architecture
- **Backend**: FastAPI (uvicorn) on port 8000
  - `backend/services/transit_service.py` — routing logic (TOPSIS, OSRM, segment builder)
  - `backend/services/gtfs_service.py` — BMTC GTFS data loader
  - `backend/core/database.py` — bus/metro/railway station data
  - `backend/agents/langchain/` — LangChain agent wrappers (weather, pricing, reviews, place verification)
  - `backend/agents/llm_agent.py` — OpenRouter/Gemini LLM calls for pricing, search, reviews
  - Local OSRM on port 5000 (car) and 5001 (foot) for real road-following paths

- **Frontend**: Vite + React/TS on port 3000 (proxies `/api` to backend)
  - `src/context/AppContext.tsx` — Shared state via React Context (replaces prop drilling)
  - `src/pages/MainPage.tsx` — Orchestrator with sidebar + map layout, 3-tab navigation
  - `src/components/SearchPanel.tsx` — Search specific / Search nearby with category chips, radius slider
  - `src/components/AToBPanel.tsx` — Unified A→B planner (Public/Transport → Direct Ride or Multi-Hop, Drive, Walk)
  - `src/components/DiscoveryPanel.tsx` — Right-side glass panel with reliability scores, reviews, images
  - `src/components/MapView.tsx` — Leaflet map with colored markers, hover effects, dynamic geometry
  - `src/components/TripPanel.tsx` — Trip planner with AI insights, upcoming trips
  - `src/index.css` — Full design system (glassmorphism, colors, typography, animations)

## Three-Tab Navigation
1. **Search** — Search any place OR Search nearby with category chips (ATMs, Malls, Hospitals, etc.)
   - Results show reliability scores (green/red), AI review summaries, images
   - "Navigate" button activates A-to-B mode with source as user's location
   - Nearby mode supports radius slider (0.5-10km)
   
2. **A to B** — Three modes:
   - **Public/Online**: Source→Dest inputs, group size, budget → sub-modes:
     - *Multi-Hop Transit*: Bus + Metro + Train routes with transfers
     - *Direct Ride*: Uber/Ola/Rapido prices comparison
   - **Drive**: Personal vehicle → fuel cost estimation
   - **Walk**: Walking route with duration/distance
   - Results: Score-ranked routes with leg details, route numbers, reliability badges
   - "Start Journey" activates GPS tracking

3. **Trip** — Trip planner:
   - AI travel insight box
   - "Create New Trip" CTA
   - Active journey tracking display

## Key Features
- **Glassmorphism design**: backdrop-filter blur, ambient shadows, consistent color palette
- **Reliability scoring**: Every place/route shows green/yellow/red badge (0-100%)
- **AI review summaries**: Auto-generated from Google + JustDial data
- **Real paths**: Local OSRM (Docker) for actual road-following paths
- **GPS live tracking**: "Start Journey" button triggers watchPosition

## Data Sources
- BMTC GTFS (stop_times, shapes, routes)
- Namma Metro network CSV
- Karnataka railway stations JSON
- KIA bus routes with fare data
- Transit fare slabs (ordinary, AC, metro)
- Traffic logs (historical speed data)
- Weather (wttr.in / Open-Meteo)
- Live pricing (SerpAPI + proxy scraping)
- Google Reviews (via SerpAPI/Google Maps API)

## Docker Setup
```yaml
services:
  backend (port 8000)
  frontend (port 3000)
  osrm-car (port 5000) — driving routes
  osrm-foot (port 5001) — walking routes
```

## Running
```powershell
# Backend
cd VOYAGER
python -m uvicorn backend.main:app --reload --port 8000

# Frontend
cd frontend; npx vite --port 3000

# OSRM (after initial setup)
docker compose up -d osrm-car osrm-foot
```
