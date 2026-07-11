# VOYAGER — Bengaluru Route Planner: Complete Documentation

> **Version:** 1.0.0  
> **Last Updated:** July 2026  
> **Location:** `C:\Users\len\OneDrive\Desktop\VOYAGER`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Data Sources & Transit Database](#3-data-sources--transit-database)
4. [Backend Components](#4-backend-components)
5. [Frontend Components](#5-frontend-components)
6. [API Reference](#6-api-reference)
7. [Route Planning Engine](#7-route-planning-engine)
8. [Segment Builder (Mini-Path / Step-by-Step)](#8-segment-builder)
9. [Scoring & Recommendations](#9-scoring--recommendations)
10. [GTFS Bus Route Geometry](#10-gtfs-bus-route-geometry)
11. [Traffic Overlay System](#11-traffic-overlay-system)
12. [ML & Optimization](#12-ml--optimization)
13. [Current State & Known Issues](#13-current-state--known-issues)
14. [Roadmap & Future Work](#14-roadmap--future-work)
15. [Appendix: File Reference](#15-appendix-file-reference)

---

## 1. Project Overview

### 1.1 What is VOYAGER?

VOYAGER is a **multi-modal route planning application** for Bengaluru, India. It helps users plan journeys from point A to point B using any combination of:

- **BMTC city buses** (ordinary, AC Vajra)
- **Namma Metro** (Green Line, Purple Line, interchanges)
- **KIA Vayu Vajra airport buses**
- **Personal car** (with fuel cost estimation)
- **Walking** (for short distances and last-mile connectivity)
- **Ride-hailing** (Uber, Ola, Rapido — price estimates via LLM)
- **Custom multi-stop journeys** via the segment builder

### 1.2 Core Features

| Feature | Status | Description |
|---------|--------|-------------|
| A→B route planning | ✅ Complete | Full multi-modal routes with turn-by-turn legs |
| Direct routes view | ✅ Complete | Scrollable route cards sorted by TOPSIS score |
| Segment builder | ✅ Complete | Step-by-step interactive route construction |
| Bus route geometry | ✅ Complete | Real road paths from GTFS shapes |
| Metro rail paths | ✅ Complete | Station-to-station line paths |
| Walking paths | ✅ Complete | OSRM walking profile with dashed polylines |
| Traffic overlay | ✅ Complete | GeoJSON roads with congestion heatmap |
| Ride price estimates | ✅ Partial | LLM-generated estimates (closed APIs) |
| AI recommendations | ✅ Complete | Route suggestions with weather/traffic context |
| Travel news | ✅ Complete | LLM-generated travel alerts & tips |
| Place search | ✅ Complete | OSM Nominatim + LLM fallback |
| Place enrichment | ✅ Complete | Reviews, images, hotel prices |

### 1.3 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript | UI components |
| Map | Leaflet + react-leaflet | Map rendering |
| HTTP | Axios | API client |
| Build | Vite 5 | Dev server & bundling |
| Backend | Python 3.12 + FastAPI | API server |
| Routing | OSRM (router.project-osrm.org) | Road path geometry |
| Geocoding | OSM Nominatim + LLM | Place search |
| LLM | OpenRouter (GPT-4o-mini) + Gemini | AI features |
| Transit data | GTFS (BMTC), CSV/JSON | Local transit database |
| ML | Custom TOPSIS, A* | Route scoring & optimization |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (http://localhost:3000)               │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  React App (App.tsx)                                            │ │
│  │  ├── MainPage.tsx (orchestrator)                                │ │
│  │  ├── SearchPanel.tsx (place search)                             │ │
│  │  ├── AToBPanel.tsx (route planner)                             │ │
│  │  ├── MapView.tsx (Leaflet map)                                 │ │
│  │  ├── DiscoveryPanel.tsx (place details)                        │ │
│  │  ├── TripPanel.tsx (multi-destination stub)                    │ │
│  │  └── NewsOverlay.tsx (travel news)                             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Axios /api/* (port 3000 → proxy port 8000)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VITE PROXY (vite.config.ts)                       │
│                    http://localhost:3000/api/* → :8000               │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│                   FASTAPI BACKEND (port 8000)                        │
│                                                                      │
│  main.py ─── router: search.py (/api/search/*)                      │
│          └── router: routes.py (/api/routes/*)                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ Services Layer                                                   ││
│  │  ├── transit_service.py   → Route generation, OSRM, GTFS         ││
│  │  ├── gtfs_service.py      → BMTC GTFS loader                     ││
│  │  ├── geocoding.py         → Place search + enrichment            ││
│  │  ├── llm_agent.py         → AI chat, recs, prices                ││
│  │  ├── n8n_service.py       → n8n webhook proxy                    ││
│  │  └── images.py            → Wikipedia image fetching             ││
│  ├──────────────────────────────────────────────────────────────────┤│
│  │ Core Layer                                                       ││
│  │  ├── database.py          → In-memory transit DB                 ││
│  │  └── config.py            → Settings (.env)                      ││
│  ├──────────────────────────────────────────────────────────────────┤│
│  │ ML Layer                                                         ││
│  │  ├── topsis.py            → Multi-criteria scoring               ││
│  │  ├── astar.py             → A* shortest path on transit graph    ││
│  │  └── data_preprocessor.py → CSV cleaning utilities               ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  Data Files (DATA_CACHE_DIR = ./data_cache/)                         │
│  ├── bengaluru_metro_network.csv   → 52 stations, 2 lines            │
│  ├── bmtc_all_stops_master.csv     → ~9,783 bus stops                │
│  ├── bmtc_gtfs.zip                → GTFS feed (47MB)                 │
│  ├── transit_fares.json           → Fare slabs                       │
│  ├── kia_routes_fare_full.json    → Airport bus routes               │
│  ├── bangalore_roads.geojson      → 18 major roads for traffic       │
│  └── traffic_logs.csv             → Speed data for traffic           │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         ▼ External Services
  ┌──────────┬──────────┬───────────┬──────────────┬──────────────┐
  │ OSRM     │ OSM      │ OpenRouter│ n8n (optional)│ Gemini (fall│
  │ route    │ Nominatim│ GPT-4o    │ (weather,    │ back LLM)   │
  │ profiles │ geocode  │ mini      │ reviews, etc)│             │
  └──────────┴──────────┴───────────┴──────────────┴──────────────┘
```

### 2.2 Directory Structure (Simplified)

```
VOYAGER/
├── backend/                     # FastAPI Python backend
│   ├── main.py                  # App entry point
│   ├── agents/
│   │   └── llm_agent.py        # LLM orchestration
│   ├── api/
│   │   ├── routes.py           # Route planning APIs (570 lines)
│   │   └── search.py           # Search & discovery APIs
│   ├── core/
│   │   ├── config.py           # Settings from .env
│   │   └── database.py         # In-memory transit DB
│   ├── models/
│   │   └── transit.py          # Pydantic models
│   └── services/
│       ├── transit_service.py  # Route engine (1027 lines)
│       ├── gtfs_service.py     # GTFS loader
│       ├── geocoding.py        # Place search
│       ├── n8n_service.py      # n8n proxy
│       └── images.py           # Image fetching
├── frontend/                    # React TypeScript frontend
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── components/
│       │   ├── AToBPanel.tsx   # Main route panel (886 lines)
│       │   ├── MapView.tsx     # Leaflet map (362 lines)
│       │   ├── SearchPanel.tsx # Search UI
│       │   ├── DiscoveryPanel.tsx
│       │   ├── TripPanel.tsx
│       │   └── NewsOverlay.tsx
│       ├── pages/
│       │   └── MainPage.tsx    # App orchestrator
│       ├── services/
│       │   └── api.ts          # Axios API client
│       ├── types/
│       │   └── index.ts        # TypeScript interfaces
│       └── utils/
│           └── helpers.ts      # UI formatting utilities
├── ml/
│   ├── topsis.py               # Multi-criteria decision making
│   ├── astar.py                # A* pathfinding
│   └── data_preprocessor.py    # CSV preprocessing
├── data_cache/                  # Transit data files
├── workflows/                   # n8n workflow JSONs
└── scripts/                     # Test & utility scripts
```

---

## 3. Data Sources & Transit Database

### 3.1 Overview

All transit data is loaded **in-memory** at startup from local files in `DATA_CACHE_DIR` (default: `./data_cache/`). There is no external database (no PostgreSQL, no MongoDB). This makes the app fast to start but means all data must be updated by replacing the source files.

### 3.2 Database Singleton (`backend/core/database.py`)

```python
class TransitDatabase:
    # Singleton pattern via class variable
    _instance = None
    _initialized = False

    # Data structures (all loaded in initialize())
    metro_stations: list[dict]      # 52 stations
    metro_lines: dict[str, list]    # "Purple Line", "Green Line"
    bus_stops: dict[str, dict]      # ~9,783 stops keyed by name
    kia_routes: dict[str, dict]     # Airport bus routes
    transit_fares: dict             # Fare slabs
```

**Key methods:**

| Method | Purpose |
|--------|---------|
| `initialize()` | Loads all data from files |
| `find_nearby_bus_stops(lat, lng, radius_km)` | Returns bus stops within radius |
| `find_nearby_metro_stations(lat, lng, radius_km)` | Returns metro stations within radius |
| `find_stop_by_name(name)` | Fuzzy-match bus stop name |
| `get_metro_line_path(from_name, to_name)` | Returns station-to-station coordinates on same metro line |
| `get_bmtc_ordinary_fare(dist_km)` | Returns fare based on distance slab |
| `get_bmtc_ac_fare(dist_km)` | Returns AC bus fare |
| `get_metro_fare(dist_km)` | Returns metro fare |

### 3.3 Data Files

| File | Source | Size | Contents |
|------|--------|------|----------|
| `bengaluru_metro_network.csv` | Manual/curated | ~5KB | 52 stations with lat/lng, line, station_code |
| `bmtc_all_stops_master.csv` | BMTC GTFS extract | ~1.5MB | 9,783 bus stops with lat/lng |
| `bmtc_gtfs.zip` | Vonter/bmtc-gtfs (GitHub) | 47MB | Full GTFS: shapes, trips, stop_times, routes |
| `transit_fares.json` | Manual/curated | ~2KB | Fare slabs for bus, metro, KIA |
| `kia_routes_fare_full.json` | KIA website | ~20KB | Airport bus routes with stops & fares |
| `bangalore_roads.geojson` | Curated | ~10KB | 18 major roads as LineStrings |
| `traffic_logs.csv` | Simulated | ~50KB | Speed data for traffic overlay |

### 3.4 Metro Network

**56 stations** across 2 lines (with interchange at Majestic):

| Line | Stations | Color | Length |
|------|----------|-------|--------|
| Purple Line | 37 stations | Purple | ~43km (Baiyappanahalli → Kengeri) |
| Green Line | 29 stations | Green | ~30km (Nagasandra → Yelachenahalli) |

Metro rail path data is stored as coordinate sequences per station pair within each line. The `get_metro_line_path(from, to)` method interpolates between consecutive stations on the same line.

### 3.5 BMTC Bus Network

- **9,783 bus stops** across Bengaluru
- **4,359 routes** (from GTFS)
- **~2.4M shape points** (from GTFS)
- Fare slabs: Ordinary (₹5-25 based on distance slab), AC Vajra (₹7-40)

### 3.6 GTFS Feed (`backend/services/gtfs_service.py`)

The GTFS loader reads from `data_cache/bmtc_gtfs.zip` (47MB ZIP containing:

| File | Records | Purpose |
|------|---------|---------|
| `shapes.txt` | ~2.4M points | Bus route road geometry |
| `trips.txt` | ~190K trips | Trip-to-route mapping |
| `stop_times.txt` | ~5M entries | Stop sequences per trip |
| `stops.txt` | ~9,783 stops | Stop metadata |
| `routes.txt` | ~4,359 routes | Route metadata |

**Key methods in GTFSLoader:**

```python
gtfs_loader.load()  # Load all GTFS data (takes ~2-3 seconds on first call)
gtfs_loader.get_shape_between_stops(from_name, to_name)
    # Returns real bus road path between any two stop names
    # Uses stop-to-shape index for O(1) lookups
gtfs_loader.get_shape_by_route(route_short_name)
    # Returns full shape for a given route number
```

**Loading strategy:** Lazy-loaded on first use (called by `_add_leg_paths`). Cached in memory for subsequent calls.

---

## 4. Backend Components

### 4.1 Configuration (`backend/core/config.py`)

**File:** `backend/core/config.py` (49 lines)

Reads settings from `.env` file using `pydantic-settings.BaseSettings`:

```python
class Settings(BaseSettings):
    APP_NAME: str = "Voyager"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    DATA_CACHE_DIR: str = "data_cache"
    LLM_PROVIDER: str = "openrouter"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    GEMINI_API_KEY: str = ""
    N8N_WEBHOOK_URL: str = ""
    BANGALORE_CENTER_LAT: float = 12.9716
    BANGALORE_CENTER_LNG: float = 77.5946
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    FUEL_PRICE_PER_LITER: float = 102.0
    PETROL_AVG_MILEAGE: float = 15.0
```

### 4.2 LLM Agent (`backend/agents/llm_agent.py`)

**File:** `backend/agents/llm_agent.py` (~300 lines)

Orchestrates all AI-powered features:

| Feature | Method | Provider | Purpose |
|---------|--------|----------|---------|
| AI Place Search | `search_places_llm()` | OpenRouter | Semantic place search as Nominatim fallback |
| Place Verification | `verify_place()` | n8n → OpenRouter | Verify place exists and get details |
| Travel Recommendations | `get_travel_recommendations()` | OpenRouter | Suggest transport modes and tips |
| Live Prices | `get_live_prices()` | OpenRouter | Estimate Uber/Ola/Rapido fares |
| Weather Impact | `get_weather_traffic_impact()` | n8n → OpenRouter | Weather + traffic conditions |
| Travel News | `get_travel_news()` | OpenRouter | Generate travel alerts |
| Place Enrichment | `enrich_place_info()` | OpenRouter | Generate review summary |
| Current Events | `get_current_events()` | Web Search + LLM | Current events near a place |

**LLM calling strategy:**
1. Try OpenRouter (GPT-4o-mini) → 10s timeout
2. Fall back to Google Gemini → 10s timeout
3. Return cached or None on all failures

**Caching:** 24-hour TTL cache for all LLM responses stored in a module-level dict.

### 4.3 Geocoding Service (`backend/services/geocoding.py`)

**File:** `backend/services/geocoding.py` (~450 lines)

Combines multiple search strategies:

```
search_places(query, lat, lng)
  ├── 1. Check local transit DB (bus stops, metro stations, KIA routes)
  ├── 2. OSM Nominatim API call (with India bounding box filter)
  ├── 3. LLM AI fallback (semantic search)
  └── 4. Merge & deduplicate results
```

**Caching:** `SearchCache` class with 24-hour TTL, keyed by normalized query + location hash.

### 4.4 N8N Service (`backend/services/n8n_service.py`)

**File:** `backend/services/n8n_service.py` (~150 lines)

Proxies requests to optional n8n workflows for:

- **Place verification** → verifies place name/address via web search
- **Hotel price checking** → scrapes hotel prices
- **Weather/traffic check** → current weather + traffic conditions
- **Ride price estimation** → Uber/Ola price scraping (DEPRECATED — now uses LLM)
- **Place reviews** → scrapes review data

**Important:** n8n is **optional** and often unreachable. All n8n calls are wrapped in `asyncio.wait_for(timeout=5.0)` + try/except to prevent 500 errors.

---

## 5. Frontend Components

### 5.1 Component Hierarchy

```
App.tsx
└── MainPage.tsx
    ├── MapView.tsx (always visible)
    ├── SearchPanel.tsx (toggle by mode)
    ├── AToBPanel.tsx (A→B mode)
    │   └── RouteCard.tsx (inline sub-component)
    ├── TripPanel.tsx (Trip mode - stub)
    ├── DiscoveryPanel.tsx (overlay on place select)
    └── NewsOverlay.tsx (overlay)
```

### 5.2 AToBPanel (`frontend/src/components/AToBPanel.tsx`)

**Lines:** 886 — the most complex component.

**State management:**

| State | Type | Purpose |
|-------|------|---------|
| `sourceQuery`, `destQuery` | string | Input field values |
| `sourceSuggestions`, `destSuggestions` | PlaceResult[] | Autocomplete dropdown |
| `sourceLocation`, `destLocation` | [number, number] | Selected lat/lng (via props) |
| `waypoints` | {lat,lng,query}[] | Intermediate stops |
| `routes` | RouteOption[] | Planned routes from API |
| `selectedRoute` | number \| null | Which route is selected |
| `travelMode` | 'public' \| 'personal' \| 'walking' | Transport mode filter |
| `routerView` | 'direct' \| 'segment' | Direct routes vs segment builder |
| `prefs` | {budget?, groupSize} | User preferences |
| `segmentStep` | SegmentStepData \| null | Current segment step data |
| `segmentPath` | SegmentStepOption[] | Built segment path |
| `hoveredSegmentOption` | SegmentStepOption \| null | For map hover |

**Key flows:**

1. **Direct route planning:** User sets source + dest → clicks "Find Routes" → `handlePlanRoute()` → `POST /api/routes/plan` → renders RouteCards sorted by score

2. **Segment building:** User clicks "Segment Builder" → `handleStartSegmentBuilding()` → fetches `GET /api/routes/segment-step` from source → shows all options (direct + transit stops with reach/from-stop options) → user picks → adds to `segmentPath` → if arrives at stop, fetches next step from that stop → repeats until destination reached

3. **News fetching:** After routes loaded, starts polling `GET /api/routes/news` every 30s → renders NewsOverlay

4. **Route geometry:** `useEffect` emits `MapRouteGeometry[]` to parent whenever routes/segment/hover state changes → MapView renders polylines

**RouteCard sub-component:**
- Shows route type icon + label
- Score badge with color (Excellent/Good/Fair/Poor/Avoid)
- Stats: fare, duration, distance, walking distance
- Expandable leg details with per-leg colors
- Score bar visualization
- Recommended ("Best") badge for top route

### 5.3 MapView (`frontend/src/components/MapView.tsx`)

**Lines:** 362

**Rendering layers (bottom to top):**

1. **TileLayer** (OSM standard tiles)
2. **TrafficLayer** (toggleable overlay)
3. **Route outline polylines** (white, thick — for visibility)
4. **Route fill polylines** (colored — solid for transit, dashed for walking)
5. **Transit stop markers** (CircleMarker — green for metro, blue for buses)
6. **News markers** (colored circles with emoji popups)
7. **User location marker** (custom divIcon)
8. **Source/Destination markers** (custom divIcon with glow)
9. **Place markers** (colored pins with popups)
10. **Waypoint markers** (intermediate stop pins)

**Polyline colors:**
- Walk: `#94a3b8` (dashed `8, 6`)
- Walk to bus/metro: `#94a3b8` (dashed)
- Bus: `#3b82f6`
- Metro: `#22c55e`
- Cab/Car: `#f59e0b` / `#f97316`
- Auto: `#ef4444`

### 5.4 API Client (`frontend/src/services/api.ts`)

**Lines:** 122

Axios instance with:
- `baseURL: '/api'` → proxied by Vite to backend
- `timeout: 60000` (60 seconds — increased from 30s for route planning)

### 5.5 TypeScript Types (`frontend/src/types/index.ts`)

**Lines:** 244

Key interfaces:

```typescript
interface RouteOption {
  type: string                    // "bus_ordinary" | "metro" | "cab" | etc.
  total_fare: number
  total_duration_minutes: number
  total_distance_km: number
  total_walking_km: number
  overall_score: number           // 10-99
  legs: RouteLeg[]                // Individual segments
}

interface RouteLeg {
  from: string
  to: string
  mode: string                    // "walk" | "bus_ordinary" | "metro" | etc.
  distance_km: number
  duration_minutes: number
  fare: number
  route_numbers?: string[]
  from_lat/lng?: number
  to_lat/lng?: number
}

interface SegmentStepData {
  from: { lat, lng, name }
  dest: { lat, lng, name }
  direct_options: SegmentStepOption[]    // Walk + all rides
  via_stops: {
    stop: { name, lat, lng, type }       // 'bus' | 'metro'
    reach_options: SegmentStepOption[]   // How to get TO this stop
    from_stop_options: SegmentStepOption[] // What to do FROM this stop
  }[]
}
```

---

## 6. API Reference

### 6.1 Route Planning

#### `POST /api/routes/plan`

Plan a route from source to destination with optional waypoints.

**Request body:**
```json
{
  "source_lat": 12.9716,
  "source_lng": 77.5946,
  "dest_lat": 12.9344,
  "dest_lng": 77.6101,
  "mode": "default",          // "default" | "walking" | "personal"
  "budget": 200,
  "group_size": 2,
  "waypoints": []
}
```

**Response:**
```json
{
  "status": "success",
  "source": { "lat": 12.9716, "lng": 77.5946, "name": "..." },
  "destination": { "lat": 12.9344, "lng": 77.6101, "name": "..." },
  "routes": [ ... ],          // Up to 8 RouteOption objects
  "total_options": 8,
  "travel_insights": "...",
  "recommendations": {
    "recommended_mode": "metro",
    "estimated_cost_min": 30,
    "estimated_cost_max": 50,
    "estimated_time_minutes": 25,
    "safety_rating": 8,
    "tips": [...]
  },
  "weather": { ... }
}
```

**Processing pipeline (inside `handlePlanRoute`):**

```
1. Parse request body (simple or multi-stop with waypoints)
2. Get personal car route (OSRM driving) → estimate fuel cost
3. Get walking route (OSRM walking)
4. Get public transit routes (bus/metro/multi-modal → up to 8)
5. Add OSRM path geometry to all route legs (parallel with 30s timeout)
6. Get live ride prices (LLM)
7. Get weather/traffic info (n8n with 5s timeout, or LLM fallback)
8. Get travel recommendations (LLM)
9. Apply scoring adjustments:
   - Weather impact (rain → prefer metro, add +5 score)
   - Night-time safety (22:00-05:00 → cab scored +10)
   - Group size (larger groups → cheaper per-person routes boosted)
10. Return sorted routes + insights
```

**Timeout configuration:**
- Path enrichment: 30s total (`asyncio.wait_for(gather, 30.0)`)
- n8n weather: 5s per call
- OSRM single call: 5s per call
- Frontend overall: 60s

#### `GET /api/routes/segment-step`

Get available options for the next step in segment building.

**Parameters:**
```
from_lat, from_lng, from_name
dest_lat, dest_lng, dest_name
group_size (default: 1)
budget (optional)
```

**Returns:**
```json
{
  "from": { "lat": 12.9716, "lng": 77.5946, "name": "Your Location" },
  "dest": { "lat": 12.9344, "lng": 77.6101, "name": "Destination" },
  "direct_options": [
    {
      "mode": "walk", "label": "Walk", "icon": "🚶",
      "distance_km": 2.5, "duration_minutes": 30, "fare": 0,
      "from_lat": 12.9716, "from_lng": 77.5946,
      "to_lat": 12.9344, "to_lng": 77.6101
    },
    {
      "mode": "cab", "label": "Uber Go / Ola Mini", "icon": "🚕",
      "distance_km": 2.5, "duration_minutes": 8, "fare": 85,
      "per_person": 85, "group_capacity": 4
    }
  ],
  "via_stops": [
    {
      "stop": { "name": "Majestic", "lat": 12.9763, "lng": 77.5712, "type": "metro" },
      "reach_options": [
        { "mode": "walk", "distance_km": 0.8, "duration_minutes": 10, "fare": 0, ... },
        { "mode": "cab", "distance_km": 0.8, "duration_minutes": 3, "fare": 42, ... }
      ],
      "from_stop_options": [
        { "mode": "metro", "label": "Metro to MG Road", "fare": 30, "per_person": 15, "arrives_at_stop": true, ... },
        { "mode": "cab", "label": "Cab to Destination", "fare": 65, "arrives_at_stop": false, ... }
      ]
    }
  ]
}
```

### 6.2 Complete Endpoint List

| Method | Path | Description | Parameters |
|--------|------|-------------|------------|
| POST | `/api/routes/plan` | Plan route | JSON body |
| GET | `/api/routes/metro-stations` | List metro stations | `line` (optional) |
| GET | `/api/routes/bus-stops` | List bus stops | `near_lat`, `near_lng`, `radius` |
| GET | `/api/routes/kia-routes` | List KIA routes | — |
| GET | `/api/routes/transit-fares` | Get fare slabs | — |
| GET | `/api/routes/live-prices` | Ride price estimates | `source`, `dest`, `mode` |
| GET | `/api/routes/mini-path-options` | Legacy mini-path | `source_lat/lng`, `dest_lat/lng`, `group_size` |
| GET | `/api/routes/segment-step` | Segment builder step | `from_lat/lng/name`, `dest_lat/lng/name`, `group_size`, `budget` |
| GET | `/api/routes/news` | Travel news | `source_name`, `dest_name` |
| GET | `/api/routes/traffic-overlay` | Traffic GeoJSON | — |
| GET | `/api/search/places` | Search places | `q`, `lat`, `lng` |
| GET | `/api/search/nearby` | Nearby places | `lat`, `lng`, `radius_km`, `place_type` |
| GET | `/api/search/suggestions` | Autocomplete | `q` |
| GET | `/api/search/verify-place` | Verify place | `name`, `address` |
| GET | `/api/search/ai-chat` | AI chat | `q`, `lat`, `lng` |
| POST | `/api/search/enrich-place` | Enrich place | JSON body |
| GET | `/api/search/ride-prices` | Ride prices | `source`, `destination` |
| GET | `/api/search/current-events` | Current events | `lat`, `lng` |
| GET | `/` | App info | — |
| GET | `/health` | Health check | — |
| GET | `/api/n8n-status` | n8n status | — |

---

## 7. Route Planning Engine

### 7.1 Route Generation (`backend/services/transit_service.py`)

The `TransitService` class generates all possible route combinations between two points.

#### 7.1.1 Public Transit Routes

**Entry point:** `get_route_legs_public(source_lat, source_lng, dest_lat, dest_lng, budget, group_size)`

**Pipeline:**

```
1. Calculate direct distance (haversine)
2. Generate candidate routes:
   ├── _generate_bus_routes()        → up to 2 bus routes (ordinary + AC)
   ├── _generate_metro_routes()       → up to 1 metro route per line
   ├── _generate_metro_interchange()  → up to 2 interchange routes
   ├── _generate_kia_routes()        → up to 1 KIA bus route
   └── _generate_multi_modal()       → up to 3 bus↔metro combos
3. Filter by budget (if set)
4. Score each route via TOPSIS
5. Add leg coordinates from database
6. Sort by score (descending)
7. Return top 8 routes
```

#### 7.1.2 Bus Route Generation

```
_nearby_src_stops = find_nearby_bus_stops(source, 1.0km)
_nearby_dest_stops = find_nearby_bus_stops(dest, 1.0km)

For each source_stop × dest_stop pair:
  1. Walking to source stop (dist × 12 min/km)
  2. Bus from source to dest stop (dist / 25 km/h × 60)
  3. Walking from dest stop to destination
  4. Fare = BMTC slab fare × group_size
  5. Route numbers = _find_common_routes(src_stop, dest_stop)
```

**Two variants per stop pair:**
- **Bus Ordinary:** `bus_ordinary` — cheaper, slower
- **Bus AC Vajra:** `bus_ac_vajra` — premium, slightly faster

#### 7.1.3 Metro Route Generation

```
_nearby_src_stations = find_nearby_metro_stations(source, 2.0km)
_nearby_dest_stations = find_nearby_metro_stations(dest, 2.0km)

For same-line station pairs:
  1. Walking to source station (dist × 12 min/km)
  2. Metro ride (station_count × 2 min + dist / 30 km/h)
  3. Walking from dest station to destination
  4. Fare = metro slab fare × group_size
```

**Interchange routes:** If source and dest are on different lines, creates routes that interchange at Majestic (the only interchange station).

#### 7.1.4 Multi-Modal Routes

```
_bus_to_metro: Walk → Bus → Walk → Metro → Walk
_metro_to_bus: Walk → Metro → Walk → Bus → Walk
```

These combine a bus leg to a metro station (or vice versa) for coverage where no single mode reaches both ends.

#### 7.1.5 Personal Car Route

```
_get_driving_route(source, dest):
  1. OSRM driving profile → duration + distance
  2. Fuel cost = (distance / mileage) × fuel_price
  3. No walking legs
  4. Type: "car"
```

#### 7.1.6 Walking Route

```
_get_walking_route(source, dest):
  1. Only if distance ≤ 10km
  2. OSRM walking profile → duration + path
  3. Type: "walk"
  4. Fare: 0
```

### 7.2 Route Path Enrichment

After routes are generated, each leg gets path geometry for map rendering.

**Method:** `_add_leg_paths(route)` (called from `routes.py` line 86 & 208)

**Processing** (parallelized with `asyncio.gather`):

```
For each leg in route:
  ├── Metro leg → get_metro_line_path(from, to) [DB, instant]
  ├── Bus leg → gtfs_loader.get_shape_between_stops(from, to) [GTFS, instant]
  ├── Walk leg → get_osrm_path_between(...) [OSRM walking, 5s timeout]
  └── Other (driving) → get_osrm_path_between(...) [OSRM driving, 5s timeout]
```

**Parallel execution:** All paths for all routes are fetched simultaneously with a 30-second total timeout.

**OSRM fallback:** If OSRM fails (network error, timeout, rate limit), the system generates an interpolated path with 12 intermediate points along the great-circle route. This ensures paths never appear as straight-line displacements.

### 7.3 Scoring System (TOPSIS)

Each route is scored on multiple criteria:

| Criterion | Weight | Scoring |
|-----------|--------|---------|
| Fare | 25% | `max(0, 100 - fare/10)` — cheaper = higher score |
| Duration | 30% | `max(0, 100 - duration/2)` — faster = higher score |
| Walking | 15% | `max(0, 100 - walk_km×15)` — less walking = higher score |
| Comfort | 20% | Mode-based: car=90, cab=85, metro=85, KIA=75, bus AC=70, bus ordinary=50, walk=40 |
| **Budget bonus** | extra | ≤40% of budget → +10; ≤70% → +5; >90% → -5; over budget → -15 |
| **Group bonus** | extra | Per-person cost ≤₹30 → +5 (for group > 1) |
| **Metro bonus** | extra | +5 for metro routes |
| **Known routes** | extra | +3 if route numbers available |

**Final score:** Range 10-99, clamped.

**Weighting rationale:**
- Time matters most (30%) — users want fast journeys
- Fare is second (25%) — cost matters
- Comfort reflects mode quality (20%)
- Walking is penalized (15%) — less walking preferred

---

## 8. Segment Builder

### 8.1 Overview

The segment builder lets users construct a custom multi-stop journey step by step, choosing between all available transport options at each stage.

### 8.2 Architecture

**Backend:** `get_segment_step_options(from_lat, from_lng, from_name, dest_lat, dest_lng, dest_name, group_size, budget)` in `transit_service.py`

**Endpoint:** `GET /api/routes/segment-step` in `routes.py` (lines 384-449)

**Frontend:** Segment building state in `AToBPanel.tsx`:
- `segmentStep: SegmentStepData` — current step options
- `segmentPath: SegmentStepOption[]` — chosen segments

### 8.3 Step Data Structure

Each step returns:

```json
{
  "from": { "lat": 12.97, "lng": 77.59, "name": "Your Location" },
  "dest": { "lat": 12.93, "lng": 77.61, "name": "Destination" },
  "direct_options": [ ... ],        // Walk + all ride types to destination
  "via_stops": [
    {
      "stop": { "name": "Majestic", "lat": 12.97, "lng": 77.57, "type": "metro" },
      "reach_options": [ ... ],      // How to get TO this stop
      "from_stop_options": [ ... ]   // What to do FROM this stop
    }
  ]
}
```

### 8.4 Ride Types Available

All with per-person pricing × group_size, filtered by capacity:

| Mode | Label | Base Fare | Per KM | Capacity | Icon |
|------|-------|-----------|--------|----------|------|
| `cab` | Uber Go / Ola Mini | ₹25 | ₹14/km | 4 | 🚕 |
| `cab_xl` | Uber XL / Ola XL | ₹40 | ₹20/km | 6 | 🚐 |
| `auto` | Auto Rickshaw | ₹15 | ₹10/km | 3 | 🛺 |
| `bike` | Uber Moto / Rapido | ₹10 | ₹6/km | 1 | 🏍️ |
| `cab_women` | Uber for Women | ₹25 | ₹14/km | 4 | 👩 |
| `cab_pet` | Uber Pet | ₹30 | ₹17/km | 4 | 🐾 |

**Capacity filtering:** If `group_size > capacity`, the option is hidden. E.g., a group of 5 won't see Auto (capacity 3) or Bike (capacity 1).

### 8.5 Transit Stop Types

| Type | Source | Search Radius | Max Shown |
|------|--------|---------------|-----------|
| `bus` | `db.find_nearby_bus_stops()` | 1.0 km | 4 |
| `metro` | `db.find_nearby_metro_stations()` | 2.0 km | 4 |

Each stop provides:
- `reach_options`: Walk (≤2km) + all ride types to reach that stop
- `from_stop_options`: Transit rides (Bus/Metro) to destination area + all ride types direct to destination

### 8.6 Transit Ride Options

**Bus rides:** Between nearby source stop and destination-area stops, using BMTC fare calculation:
- `per_person = max(10, get_bmtc_ordinary_fare(distance))`

**Metro rides:** Between nearby source station and destination-area stations:
- `per_person = max(15, distance × 3)`

### 8.7 Frontend Flow

```
User clicks "Segment Builder" button
  → handleStartSegmentBuilding()
    → fetchStepFrom(source_lat, source_lng, source_name)
      → GET /api/routes/segment-step?from=source&...
      → setSegmentStep(response.step)
    
User sees:
  [Direct Options] [Transit Stop 1] [Transit Stop 2] ...

User clicks "Walk to Majestic" (reach_option)
  → handlePickSegmentOption(option)
    → setSegmentPath([...prev, option])  // adds to path
    → If option.arrives_at_stop == true:
        fetchStepFrom(option.to_lat, option.to_lng, option.to)
        // Loads next step from Majestic station
    → Else (direct to destination):
        setSegmentStep(null)  // route complete

At next step from Majestic:
  User sees options from Majestic to destination
  → Repeat until destination reached
```

### 8.8 Map Integration

- Each chosen segment renders as a colored polyline (cycling through SEGMENT_COLORS)
- Transit stops are shown as CircleMarkers on the map:
  - Green circles for metro stations
  - Blue circles for bus stops
  - Popup shows stop name
- Hovering over an option highlights its path in yellow

### 8.9 State Reset

- User can reset and start over at any time
- Each step's options are independently fetched and cached
- Double-call prevention via `segmentBuildingRef` ref

### 8.10 What's Missing / Improvements Needed

1. **Editable segments**: User cannot go back and change a previous segment's choice
2. **More transit stop info**: Show bus route numbers and metro lines at each stop
3. **Compare vs direct routes**: Show how the custom-built route compares to the automatically planned ones
4. **Intermediate stops**: Allow adding intermediate destinations (not just transit stops)
5. **Timeline view**: Show the route as a timeline with departure/arrival times
6. **GTFS schedule-based transit**: Currently bus/metro times are estimated (distance/speed), not based on actual GTFS schedules
7. **Real-time arrival data**: No GTFS-RT integration yet
8. **Path builder improvement**: After building segments, automatically find the best combined transit route suggestion

---

## 9. Scoring & Recommendations

### 9.1 TOPSIS Multi-Criteria Scoring

Located in `transit_service.py:_topsis_score()` and `ml/topsis.py`.

The backend `_topsis_score()` computes a composite score (10-99) for each route:

```
score = fareScore × 0.25 + durationScore × 0.30 + walkScore × 0.15 + comfort × 0.20
      + budgetBonus + groupBonus + metroBonus + knownRoutesBonus
```

**Scoring details:**

| Metric | Formula | Max Raw |
|--------|---------|---------|
| Fare | 100 - (fare ÷ 10) | 100 |
| Duration | 100 - (minutes ÷ 2) | 100 |
| Walking | 100 - (walk_km × 15) | 100 |
| Comfort | Mode-based lookup (40-90) | 90 |

**Comfort map:**
```
car=90, cab=85, metro_interchange=85, metro=85,
kia_bus=75, bus_ac_vajra=70, bus_to_metro=70, metro_to_bus=65,
bus_ordinary=50, walk=40
```

**Bonuses:**
- Budget: ≤40% → +10, ≤70% → +5, >90% → -5, >100% → -15
- Group: per-person ≤₹30 and group > 1 → +5
- Metro line route → +5
- Has route_numbers → +3

### 9.2 AI Recommendations

**Method:** `llm_agent.get_travel_recommendations(source_name, dest_name, routes_json)`

The LLM receives:
- Source and destination names
- Top 3 route options with their details
- Current weather conditions (from n8n or LLM fallback)

**Returns:**
```json
{
  "recommended_mode": "metro",
  "estimated_cost_min": 30,
  "estimated_cost_max": 50,
  "estimated_time_minutes": 25,
  "safety_rating": 8,
  "comfort_rating": 7,
  "tips": ["Avoid 9-11 AM peak", "Metro is 15 min faster than bus"]
}
```

### 9.3 Weather Impact Scoring

Applied in `routes.py` `handlePlanRoute`:

- **Bad weather** (rain, storm): Metro routes get +5 score bonus, walking routes penalized
- **Good weather**: Walking routes get +3 bonus
- **Traffic alerts**: Car/cab routes penalized -5

### 9.4 Night Safety Scoring

Between 22:00 and 05:00:
- Cab routes get +10 score bonus
- Walking routes get -15 penalty

### 9.5 Group Scoring

For groups > 1:
- Routes with lower per-person cost are preferred
- "Cheap per person" bonus (+5) for ≤₹30/person

---

## 10. GTFS Bus Route Geometry

### 10.1 File Size & Structure

**File:** `data_cache/bmtc_gtfs.zip` (47 MB)

Contains 5 standard GTFS tables:

| Table | Rows | Columns | Purpose |
|-------|------|---------|---------|
| `shapes.txt` | ~2.4M | `shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence` | Road geometry |
| `trips.txt` | ~190K | `route_id, service_id, trip_id, shape_id` | Trip-to-shape mapping |
| `stop_times.txt` | ~5M | `trip_id, stop_id, stop_sequence` | Stop order per trip |
| `stops.txt` | ~9,783 | `stop_id, stop_name, stop_lat, stop_lon` | Stop locations |
| `routes.txt` | ~4,359 | `route_id, route_short_name, route_long_name` | Route metadata |

### 10.2 GTFSLoader (`backend/services/gtfs_service.py`)

**Loading strategy:**

1. On first `load()` call, opens the ZIP and reads all CSVs
2. Builds indexes:
   - `_shapes`: `{shape_id: [(lat, lng, seq), ...]}` — full shapes
   - `_route_shapes`: `{route_short_name: [shape_id, ...]}` — shapes per route
   - `_stops_by_name`: `{stop_name: stop_info}` — normalize + lowercase
   - `_stop_to_shapes`: `{stop_name: [(shape_id, seq), ...]}` — which shapes pass through which stops

3. `get_shape_between_stops(from_name, to_name)`:
   - Looks up both stop names in index
   - Finds shapes that pass through both stops
   - Clips the shape between the two stop sequences
   - Returns the real bus road path

4. `get_shape_by_route(route_short_name)`:
   - Returns full shape path for a given route number

**Important:** BMTC GTFS route IDs (e.g., `D35G-BVRH`) don't always match user-visible route numbers (e.g., `244-C VSD`). Stop-name-based matching is more reliable.

### 10.3 Integration with Route Planning

```
_add_leg_paths(route):
  For each bus leg (mode in ["bus_ordinary", "bus_ac_vajra", "kia_bus"]):
    shape = gtfs_loader.get_shape_between_stops(leg.from, leg.to)
    if shape:
      leg.path = shape  // Real GTFS road geometry
    else:
      leg.path = get_osrm_path_between(...)  // OSRM fallback
```

**Performance:** GTFS lookups are O(1) after warmup and return instantly (no HTTP call). The initial load takes ~2-3 seconds.

---

## 11. Traffic Overlay System

### 11.1 Overview

Since Overpass API is unreachable from the deployment network, the traffic overlay uses:
1. **Static road GeoJSON** (`bangalore_roads.geojson`) — 18 major Bengaluru roads
2. **Traffic speed logs** (`traffic_logs.csv`) — simulated speed data

### 11.2 Endpoint

**`GET /api/routes/traffic-overlay`**

Returns GeoJSON FeatureCollection with congestion-colored roads:

```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": { "type": "LineString", "coordinates": [[77.5, 12.9], ...] },
    "properties": {
      "name": "MG Road",
      "speed_kmh": 25,
      "congestion": "moderate",
      "color": "#fbbf24"
    }
  }]
}
```

**Congestion levels:**
| Speed | Level | Color |
|-------|-------|-------|
| > 40 km/h | Clear | Green `#22c55e` |
| 25-40 km/h | Moderate | Yellow `#fbbf24` |
| 15-25 km/h | Heavy | Orange `#f97316` |
| < 15 km/h | Jammed | Red `#ef4444` |

Roads are rendered in order of importance (NH → SH → major arterial → other), with 3px colored polylines on the map.

---

## 12. ML & Optimization

### 12.1 TOPSIS Class (`ml/topsis.py`)

An independent implementation of the TOPSIS multi-criteria decision-making algorithm:

```python
class Topsis:
    def __init__(self, weights: dict = None):
        # Default weights: cost=0.3, time=0.25, comfort=0.15,
        # safety=0.1, walking_distance=0.1, availability=0.05,
        # weather_impact=0.05
    def score(self, alternatives: list[dict]) -> list[float]:
        # Normalize → Weight → Ideal best/worst → Distance → Score
```

The backend's `_topsis_score()` is a simpler implementation tuned specifically for Bengaluru transit routes.

### 12.2 A* Pathfinder (`ml/astar.py`)

Builds a transit graph from metro + bus stop data and finds shortest paths:

```python
class AStarPathfinder:
    def build_graph(self, metro_stations, bus_stops):
        # Nodes: all stations and stops
        # Edges: walking between nearby nodes + transit connections
    
    def find_path(self, source_lat, source_lng, dest_lat, dest_lng):
        # A* shortest path with haversine heuristic
        # Returns list of (node, mode, cost) tuples
```

Currently this is a standalone module not yet integrated into the main route planner.

### 12.3 Data Preprocessor (`ml/data_preprocessor.py`)

Cleans raw CSV files and outputs processed versions:

```python
class DataPreprocessor:
    def clean_metro_csv(input_path, output_path)
    def clean_bus_stops_csv(input_path, output_path)
```

Used during initial data setup, not in the live application.

---

## 13. Current State & Known Issues

### 13.1 What Works

- ✅ Full A→B route planning with all transport modes
- ✅ Real road geometry for car routes (OSRM, 575+ coords)
- ✅ Real GTFS bus route geometry (instant, no HTTP)
- ✅ Real metro rail paths (station-to-station line data)
- ✅ Walking paths with OSRM (dashed polylines)
- ✅ Segment-by-segment custom route builder
- ✅ Traffic overlay with congestion colors
- ✅ Ride price estimates (LLM-generated)
- ✅ AI travel recommendations with weather context
- ✅ Place search (OSM + LLM fallback)
- ✅ Place enrichment (reviews, images, hotels)
- ✅ Travel news & alerts
- ✅ Budget filtering (total budget for group)
- ✅ Group size ride capacity filtering

### 13.2 Performance Profile

| Operation | Typical Time | Bottleneck |
|-----------|-------------|------------|
| Route planning | ~22-27s | OSRM calls + GTFS loading + LLM calls |
| Segment step fetch | ~5-10s | OSRM path enrichment for all options |
| Place search | ~2-3s | OSM Nominatim API |
| LLM call | ~3-8s | OpenRouter API rate |
| GTFS load | ~2-3s | ZIP parsing + indexing (once) |

### 13.3 Known Issues

| Issue | Severity | Cause | Status |
|-------|----------|-------|--------|
| Route plan slow (22-27s) | Medium | OSRM rate limits + serialized LLM calls | Mitigated with parallel gather + 30s timeout |
| OSRM rate limits | Medium | Free OSRM public API | Partially mitigated with interpolated fallback paths |
| n8n unreachable | Low | Network block | Wrapped in try/except, harmless |
| GTFS route number mismatch | Low | BMTC internal IDs ≠ user route numbers | Stop-name matching used instead |
| No real-time pricing | Medium | Uber/Ola/Rapido closed APIs | LLM estimation with ~20% accuracy |
| No real-time bus arrival | Medium | No GTFS-RT setup | All bus times are estimated |
| Search returns non-Bengaluru results | Low | OSM searches worldwide | India bbox filter partially helps |
| Segment builder double-call | Fixed | useEffect + onClick collision | Fixed with buildingRef |

### 13.4 Data Gaps

- **Metro fares:** Estimated at ₹15 + ₹3/km, may not match actual Namma Metro pricing
- **BMTC fares:** Uses slab-based fare table, may not reflect current pricing
- **Ride prices:** LLM-generated estimates, not real Uber/Ola API prices
- **Traffic data:** Static GeoJSON + simulated speeds, not real-time
- **GTFS schedule:** Only shapes used (geometry), not stop times (timetables)

---

## 14. Roadmap & Future Work

### 14.1 Short Term (Next Sprints)

#### P0 — Critical

1. **Route planning speed optimization**
   - Preload GTFS data at startup (not lazy)
   - Add connection pooling to OSRM client
   - Reduce OSRM timeout from 5s to 3s
   - Cache common OSRM routes locally
   - Target: <15s for typical route plan

2. **Segment builder enhancements**
   - Allow editing/removing previous segment choices
   - Show intermediate costs at each step
   - Add "Auto-complete" to find best transit from current path
   - Show bus route numbers and metro lines in stop details
   - Display segment timelines

3. **GTFS schedule integration**
   - Load GTFS stop_times.txt for actual bus timings
   - Show departure/arrival times for bus legs
   - Filter routes by time of day

#### P1 — High

4. **Search quality improvements**
   - Restrict OSM Nominatim to Bengaluru region (current India bbox too broad)
   - Add Bangalore-specific place synonyms database
   - Prioritize transit stops in search results

5. **Path enrichment reliability**
   - Add OSRM request queuing with 200ms delay between calls
   - Cache more aggressively (persistent disk cache)
   - Add more interpolated path points (12 → 24 for smoother curves)

6. **Ride price estimates**
   - Integrate with Ola/Uber affiliate APIs if available
   - Add Rapido bike taxi pricing
   - Show price ranges instead of single estimates
   - Add women-only ride options

#### P2 — Medium

7. **UI/UX polish**
   - Mobile-responsive layout
   - Dark mode consistency
   - Loading skeletons instead of spinners
   - Route comparison table view
   - Share route link functionality

8. **Multi-stop trip planning**
   - Complete the TripPanel component
   - Support 3+ destination trips
   - Optimize visit order for multi-stop routes

9. **Offline mode**
   - Cache transit data in IndexedDB
   - Basic route planning without backend
   - PWA support

### 14.2 Long Term (Future Versions)

#### P3 — Nice to Have

10. **Real-time features**
    - GTFS-RT for live bus positions
    - Live metro train tracking
    - Real-time traffic from Google Maps API
    - Live ride availability (not just prices)

11. **Advanced routing**
    - Isochrone maps (show reachable areas within N minutes)
    - Environmentally-friendly routing (carbon emissions)
    - Accessibility routing (wheelchair-friendly)
    - Scheduled departure optimization

12. **User features**
    - User accounts with saved routes
    - Route history and favorites
    - Recurring commute planning
    - Crowd-sourced route feedback

13. **Data expansion**
    - Add local train (Bengaluru suburban)
    - Add auto-rickshaw stand locations
    - Add cycle sharing stations
    - Expand to other Indian cities (Chennai, Hyderabad, Mumbai)

14. **ML & AI improvements**
    - Train TOPSIS weights from user feedback
    - Predictive traffic modeling
    - Personalized route recommendations
    - Anomaly detection (unusual delays, route disruptions)

### 14.3 Infrastructure Improvements

| Area | Current | Target |
|------|---------|--------|
| Hosting | Local dev only | Docker + cloud deployment |
| Database | In-memory files | SQLite or PostgreSQL |
| Caching | In-memory dicts | Redis |
| Monitoring | None | Structured logging + metrics |
| Testing | Manual | Automated tests (pytest + vitest) |
| CI/CD | None | GitHub Actions |
| Documentation | This file | API docs + component storybook |

### 14.4 Segment Builder — Detailed Roadmap

**Current state:** ✅ Working — user can build multi-stop routes step-by-step with all transport options, filtered by group size and budget

**Next improvements in order:**

1. **Edit mode** — Allow clicking a previous segment to change its option, then recalculate downstream
2. **Route comparison** — After building a custom route, compare its score against the auto-generated direct routes
3. **Intermediate destination support** — Allow adding actual places (not just transit stops) as waypoints
4. **Schedule integration** — Show departure/arrival times if GTFS stop_times are loaded
5. **Multiple route suggestions** — After each step, suggest 2-3 best continuations based on TOPSIS
6. **Price breakdown** — Show running total + per-person with a progress bar against budget
7. **Time constraint** — Allow setting "arrive by" or "depart at" time
8. **Saved segments** — Allow saving a built route as a template for future use
9. **Visual timeline** — Gantt-chart style view of the entire journey timeline
10. **Map integration** — Show only the relevant segment path on hover, highlight stops more prominently

---

## 15. Appendix: File Reference

### 15.1 Key Backend Files

| File | Lines | Purpose |
|------|-------|---------|
| `backend/main.py` | 54 | App entry point, CORS, routers |
| `backend/api/routes.py` | 570 | Route planning endpoints |
| `backend/api/search.py` | ~200 | Search & discovery endpoints |
| `backend/services/transit_service.py` | 1027 | Core route engine, OSRM, segment builder |
| `backend/services/gtfs_service.py` | 141 | BMTC GTFS loader |
| `backend/services/geocoding.py` | ~450 | Place search + enrichment |
| `backend/services/llm_agent.py` | ~300 | LLM orchestration |
| `backend/services/n8n_service.py` | ~150 | n8n webhook proxy |
| `backend/services/images.py` | ~50 | Wikipedia image fetcher |
| `backend/core/database.py` | ~300 | In-memory transit DB |
| `backend/core/config.py` | 49 | Settings from .env |
| `backend/models/transit.py` | ~100 | Pydantic models |

### 15.2 Key Frontend Files

| File | Lines | Purpose |
|------|-------|---------|
| `frontend/src/App.tsx` | ~50 | Root component |
| `frontend/src/pages/MainPage.tsx` | ~200 | App orchestrator |
| `frontend/src/components/AToBPanel.tsx` | 886 | Main route panel |
| `frontend/src/components/MapView.tsx` | 362 | Leaflet map |
| `frontend/src/components/SearchPanel.tsx` | ~250 | Search UI |
| `frontend/src/components/DiscoveryPanel.tsx` | ~150 | Place details |
| `frontend/src/components/NewsOverlay.tsx` | ~100 | News display |
| `frontend/src/components/TripPanel.tsx` | ~30 | Trip stub |
| `frontend/src/services/api.ts` | 122 | API client |
| `frontend/src/types/index.ts` | 244 | TypeScript types |
| `frontend/src/utils/helpers.ts` | 119 | UI formatters |

### 15.3 ML & Utility Files

| File | Lines | Purpose |
|------|-------|---------|
| `ml/topsis.py` | 62 | Multi-criteria scoring |
| `ml/astar.py` | 122 | A* pathfinding |
| `ml/data_preprocessor.py` | 64 | CSV cleaning |
| `scripts/test_route_api.py` | ~100 | Route API testing |
| `scripts/test_services.py` | ~100 | Service testing |
| `scripts/test_n8n.py` | ~50 | n8n connectivity test |
| `scripts/create_wf_api.py` | ~50 | n8n workflow creation |

### 15.4 Data Files

| File | Approx Size | Records |
|------|-------------|---------|
| `data_cache/bmtc_gtfs.zip` | 47 MB | GTFS feed |
| `data_cache/bmtc_all_stops_master.csv` | 1.5 MB | 9,783 stops |
| `data_cache/bengaluru_metro_network.csv` | 5 KB | 56 stations |
| `data_cache/kia_routes_fare_full.json` | 20 KB | ~15 routes |
| `data_cache/transit_fares.json` | 2 KB | ~20 fare slabs |
| `data_cache/bangalore_roads.geojson` | 10 KB | 18 roads |
| `data_cache/traffic_logs.csv` | 50 KB | ~500 speed records |

---

## End of Document

*This document covers the complete VOYAGER Bengaluru Route Planner as of July 2026. For questions or contributions, refer to the code files listed above — each file has detailed implementation comments for further exploration.*

*Next major iteration: GTFS schedule integration + segment builder editing mode + route planning speed optimization.*
