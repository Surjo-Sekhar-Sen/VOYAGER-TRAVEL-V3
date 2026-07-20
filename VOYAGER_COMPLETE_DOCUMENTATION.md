# VOYAGER — Complete Project Documentation

> **Bengaluru Multi-Modal Transit Navigator**
> A comprehensive journey planner covering buses (BMTC), metro (Namma Metro), trains (Indian Railways), cabs, auto-rickshaws, bikes, and walking — with live GPS tracking, LLM-powered pricing, and progressive multi-column segment UI.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Data Sources & Coverage](#4-data-sources--coverage)
5. [Directory Structure](#5-directory-structure)
6. [Backend in Detail](#6-backend-in-detail)
   - 6.1 FastAPI Application (main.py)
   - 6.2 API Routes (routes.py)
   - 6.3 Transit Service (transit_service.py)
   - 6.4 GTFS Service (gtfs_service.py)
   - 6.5 Database Layer (database.py)
   - 6.6 LLM Agent (llm_agent.py)
   - 6.7 Configuration (config.py)
7. [Frontend in Detail](#7-frontend-in-detail)
   - 7.1 Main Page (MainPage.tsx)
   - 7.2 Segment Panel (SegmentPanel.tsx)
   - 7.3 Map View (MapView.tsx)
   - 7.4 API Service (api.ts)
   - 7.5 Types (types/index.ts)
   - 7.6 Helpers (helpers.ts)
8. [The Segment System](#8-the-segment-system)
   - 8.1 What Is a Segment?
   - 8.2 Segment Structure
   - 8.3 Progressive Multi-Column UI Flow
   - 8.4 The `_build_single_segment` Function
   - 8.5 The `_add_transit_options` Function
   - 8.6 The `_build_next_transit` Function
   - 8.7 The `get_all_segments` Orchestrator
   - 8.8 Chaining Algorithm (Hop Mechanism)
   - 8.9 Segment-to-Segment Linking
9. [Transport Modes](#9-transport-modes)
   - 9.1 Walking
   - 9.2 BMTC Buses (Ordinary & AC Vajra)
   - 9.3 Namma Metro
   - 9.4 KIA Airport Buses
   - 9.5 Indian Railways (Long Distance)
   - 9.6 Cabs / Auto / Bike (Ride-Hailing)
10. [Pricing System](#10-pricing-system)
    - 10.1 Bus Fares
    - 10.2 Metro Fares
    - 10.3 Ride-Hailing Fares (LLM Live Pricing)
    - 10.4 Train Fares
    - 10.5 Budget & Group Size Filtering
11. [Direction Filtering & Route Quality](#11-direction-filtering--route-quality)
    - 11.1 The `_route_goes_toward_dest` Function
    - 11.2 Angle Check (Bearing)
    - 11.3 Distance Progress Check
    - 11.4 Hub Detection
    - 11.5 Minimum Progress Per Hop
12. [Path Generation & Map Display](#12-path-generation--map-display)
    - 12.1 GTFS Shape Paths
    - 12.2 Metro Line Paths
    - 12.3 OSRM Paths
    - 12.4 Interpolated Fallback Paths
    - 12.5 Path Priority Hierarchy
13. [Performance & Optimization](#13-performance--optimization)
    - 13.1 GTFS Caching
    - 13.2 Request-Level Caching
    - 13.3 Adaptive Limits
    - 13.4 Circular Routing Prevention
    - 13.5 Relevance Scoring
14. [API Endpoints Reference](#14-api-endpoints-reference)
15. [Data Flow Diagrams](#15-data-flow-diagrams)
16. [Known Issues & Bugs](#16-known-issues--bugs)
17. [Future Improvements Roadmap](#17-future-improvements-roadmap)
18. [Development Setup](#18-development-setup)
19. [Deployment Notes](#19-deployment-notes)

---

## 1. Project Overview

VOYAGER is a **multi-modal transit navigation** web application built specifically for **Bengaluru, India**. It helps users plan journeys using any combination of:

- **BMTC Buses** — Ordinary and AC Vajra (with GTFS real-time schedules)
- **Namma Metro** — Green and Purple lines with station-to-station paths
- **KIA Airport Buses** — Vayu Vajra services to/from Kempegowda International Airport
- **Indian Railways** — Long-distance trains between Bengaluru and major Karnataka cities
- **Ride-Hailing** — Cab/Ola/Uber, Auto, Bike/Moto/Rapido
- **Walking** — For short distances (last-mile, interchanges)

The key innovation is the **progressive multi-column segment UI** — instead of showing one route at a time, it shows ALL possible routes as an interactive decision tree where the user progressively clicks through options.

### Core Goals
- Show every viable transit option between source and destination
- Enable multi-hop journeys (walk→bus→metro→walk, bus→bus→cab, etc.)
- Display correct map paths for every leg
- Filter by budget and group size
- Show live bus departure times from GTFS data
- Provide LLM-powered live ride pricing
- GPS live tracking during the journey

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                       │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐              │
│  │ MainPage  │  │ SegmentPanel │  │ MapView  │              │
│  │ (ORCH)    │  │ (COLUMNS)    │  │ (LEAFLET)│              │
│  └─────┬─────┘  └──────┬───────┘  └────┬─────┘              │
│        │               │               │                    │
│        └───────────────┼───────────────┘                    │
│                        │                                     │
│                  ┌─────▼──────┐                              │
│                  │  api.ts    │  (Axios HTTP Client)         │
│                  └─────┬──────┘                              │
└────────────────────────┼────────────────────────────────────┘
                         │  HTTP (proxy /api → :8000)
┌────────────────────────▼────────────────────────────────────┐
│                FastAPI Backend (uvicorn)                     │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────┐   │
│  │   routes.py  │  │ transit_service│  │  gtfs_service │   │
│  │   (API)      │◄─┤   .py          │◄─┤  .py          │   │
│  └──────────────┘  │   (ROUTING)    │  │  (GTFS DATA)  │   │
│                    └───────┬────────┘  └───────┬───────┘   │
│                    ┌───────▼────────┐  ┌───────▼───────┐   │
│                    │  database.py   │  │  llm_agent.py │   │
│                    │  (STOPS/METRO) │  │  (LIVE PRICES)│   │
│                    └───────┬────────┘  └───────────────┘   │
│                            │                                 │
│                    ┌───────▼────────┐                       │
│                    │  Data Files    │                       │
│                    │  (CSV, JSON,   │                       │
│                    │   GTFS cache)  │                       │
│                    └────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Monolithic Python backend, not microservices** — Single FastAPI process handles everything. GTFS loaded synchronously at first request (not at startup) to avoid 41s cold start.

2. **Frontend does NOT transform data** — Backend returns fully-formed, ready-to-render JSON. The React frontend is a "thin client" that just displays what the API sends.

3. **Progressive disclosure, not search** — Instead of typing source/dest and getting ONE route plan, the user clicks through an interactive decision tree: Direct options → Nearby stops → Transit options → Transfers → Final mile.

4. **No OSRM dependency at runtime** — OSRM is unreachable, so all driving paths fall back to interpolated paths. Path generation is entirely server-side with no external routing dependency.

5. **GTFS data is the source of truth for buses** — All bus routes, stop names, timings, and shapes come from BMTC GTFS data. No hardcoded bus routes.

---

## 3. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.4 | Build tool & dev server |
| Leaflet | 1.9 | Map rendering |
| react-leaflet | 4.x | React bindings for Leaflet |
| Axios | 1.x | HTTP client |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.12 | Runtime |
| FastAPI | 0.115 | Web framework |
| uvicorn | 0.32 | ASGI server |
| httpx | 0.27 | Async HTTP client (OSRM, LLM) |
| pydantic | 2.x | Data validation |
| pydantic_settings | 2.x | Configuration management |
| geopy | 2.x | Geodesic distance calculations |

### Data & Storage
| Component | Format | Description |
|---|---|---|
| BMTC GTFS | ZIP → Pickle cache | Bus routes, stops, timings, shapes |
| Bengaluru Metro Network | CSV | Station names, lines, coordinates, adjacency |
| BMTC Stop Master | CSV | 5000+ stop names, lat, lng, routes |
| Railway Stations | Hardcoded dict | Station names, coordinates |
| Train Data | Hardcoded dict | 8 route pairs with real train numbers |
| Transit Fares | JSON | Fare slabs for ordinary & AC buses |

### External Services
| Service | Endpoint | Purpose |
|---|---|---|
| OpenStreetMap Tiles | `{s}.tile.openstreetmap.org` | Map tile layer |
| OSRM (public) | `router.project-osrm.org` | Driving/walking path routing (currently unreachable) |
| OpenRouter API | `openrouter.ai/api` | LLM-powered ride price estimation |

---

## 4. Data Sources & Coverage

### 4.1 BMTC GTFS (General Transit Feed Specification)
- **Source**: BMTC (Bangalore Metropolitan Transport Corporation)
- **File**: `data/bmtc_gtfs.zip` → cached to `data_cache/gtfs_cache.pkl`
- **Size**: ~7271 shapes, ~5077 stops, ~429882 stop times
- **Load time**: ~0.8s from cache, ~41s from ZIP
- **Coverage**: All BMTC bus routes within Bengaluru city and suburbs
- **Limitations**:
  - 100K stop times limit during processing (may miss some late-night/early-morning services)
  - Electronic City and some outer industrial areas have limited coverage
  - Some GTFS route numbers are internal codes (e.g., "MF-28 JKLO-ISROQ-LGRNB") not human-readable

### 4.2 Namma Metro
- **File**: `data_cache/bengaluru_metro_network.csv`
- **Lines**: Green Line (Nagasandra→Silk Institute), Purple Line (Whitefield→Kengeri)
- **Stations**: ~51 stations with line, coordinates, and adjacency
- **Fares**: Calculated by distance using `db.get_metro_fare(distance_km)`

### 4.3 Railway Stations
- **Coverage**: ~20 major Karnataka railway stations
- **Trains**: Hardcoded pairs for Bengaluru ↔ Mysuru/Hubballi/Mangaluru/Belagavi/Ballari
- **Unknown pairs**: Generic synthetic options generated

### 4.4 KIA Airport Buses
- **File**: `data_cache/bmtc_all_stops_master.csv` (includes KIA route data)
- **Routes**: KIA-4, KIA-4A, KIA-5, KIA-5D, KIA-6, KIA-7, KIA-8, KIA-8E, KIA-9, etc.
- **Fares**: Calculated by fare difference between stops along the route

---

## 5. Directory Structure

```
VOYAGER/
├── backend/
│   ├── api/
│   │   └── routes.py              # All API endpoints
│   ├── core/
│   │   ├── config.py              # Settings (OSRM URL, API keys)
│   │   └── database.py            # TransitDatabase class (stops, metro, spatial)
│   ├── services/
│   │   ├── transit_service.py     # MAIN ROUTING ENGINE (2350+ lines)
│   │   ├── gtfs_service.py        # GTFS loader & query (591 lines)
│   │   └── llm_agent.py           # LLM live pricing agent
│   └── main.py                    # FastAPI app entry point
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SegmentPanel.tsx   # Multi-column segment UI (737 lines)
│   │   │   ├── MapView.tsx        # Leaflet map (379 lines)
│   │   │   └── AToBPanel.tsx      # Legacy A→B route planner
│   │   ├── pages/
│   │   │   └── MainPage.tsx       # App orchestrator (313 lines)
│   │   ├── services/
│   │   │   └── api.ts             # Axios HTTP client
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript interfaces (286 lines)
│   │   └── utils/
│   │       └── helpers.ts         # Mode icons, labels, formatters
│   └── vite.config.ts             # Vite config (proxy /api → :8000)
├── data_cache/
│   ├── bmtc_all_stops_master.csv     # 5000+ BMTC stops
│   ├── bengaluru_metro_network.csv   # Metro stations
│   └── transit_fares.json            # Bus fare slabs
├── data/
│   └── bmtc_gtfs.zip                 # Raw GTFS (ZIP)
├── docs/
│   └── VOYAGER_COMPLETE_DOCUMENTATION.md   # ← THIS FILE
├── AGENTS.md                         # Project summary for AI agents
└── README.md                         # Basic setup instructions
```

---

## 6. Backend in Detail

### 6.1 FastAPI Application (backend/main.py)

The entry point that configures and starts the uvicorn server.

```python
app = FastAPI(title="VOYAGER")
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
app.include_router(router)

@app.on_event("startup")
async def startup():
    db.initialize()  # Loads bus stops, metro, spatial index (~1s)
    # GTFS is NOT loaded here — loaded lazily on first request
```

Key behaviors:
- CORS enabled for all origins (development mode)
- GTFS loads **lazily** on first `_ensure_gtfs()` call
- Database `db` is a global singleton (`backend.core.database`)

### 6.2 API Routes (backend/api/routes.py)

All API endpoints are defined here. Key endpoints:

#### GET /api/routes/all-segments
The MAIN endpoint. Returns the complete multi-segment response.

**Parameters:**
- `from_lat`, `from_lng`, `from_name` — Source location
- `dest_lat`, `dest_lng`, `dest_name` — Destination
- `group_size` (default: 1) — Number of passengers
- `budget` (optional) — Maximum total fare in ₹
- `max_depth` (default: 3) — Maximum segment chain depth

**Response structure:**
```json
{
  "status": "success",
  "data": {
    "source": {"lat": ..., "lng": ..., "name": ...},
    "dest": {"lat": ..., "lng": ..., "name": ...},
    "segments": [
      {
        "segment_index": 0,
        "from": {"name": "HSR Layout", "lat": 12.9344, "lng": 77.6105},
        "direct_options": [...],
        "destinations": [...]
      },
      ...
    ],
    "total_segments": 3
  }
}
```

**Backend sanitization** (in routes.py `_sanitize_for_json`):
- Converts numpy types to native Python
- Removes NaN/inf values
- Ensures all coordinate pairs are valid

#### GET /api/routes/segment-step (LEGACY)
Returns a SINGLE segment step. Uses `get_segment_step_options` method (deprecated, kept for backward compatibility).

#### GET /api/search/places
Place search with fuzzy matching. Sources: OpenStreetMap Nominatim + local stop database.

#### GET /api/search/nearby
Returns nearby places of interest.

#### GET /api/routes/plan (LEGACY)
Returns route plans (source→destination). Uses `_plan_route` method with TOPSIS scoring.

### 6.3 Transit Service (backend/services/transit_service.py)

**This is the core of the application (~2359 lines).** It contains the complete routing engine.

#### Class: `TransitService`

**Key Methods:**

| Method | Lines | Purpose |
|---|---|---|
| `get_all_segments` | 2093-2145 | Orchestrator — builds chained segments |
| `_build_single_segment` | 1976-2089 | Builds one segment (from→direct→stops→transit) |
| `_add_transit_options` | 1400-1660 | Adds bus/metro/KIA transit to a destination entry |
| `_build_next_transit` | 1714-1962 | Recursively builds transfers from an arrival point |
| `_add_direct_options` | ~80 | Adds walk/cab/auto/bike direct options |
| `_add_reach_options` | ~40 | Adds walk/cab/auto/bike to a nearby stop |
| `haversine_distance` | 179-185 | Calculates geodesic distance |
| `_interpolate_path` | 2210-2229 | Generates interpolated path with slight bulge |
| `get_osrm_path_between` | 2231-2251 | Fetches OSRM path (falls back to interpolated) |
| `_topsis_score` | 2144-2205 | TOPSIS scoring for route ranking (legacy) |
| `_route_goes_toward_dest` | 125-160 | Direction filter for bus routes |
| `_is_outside_bengaluru` | ~15 | Checks if destination is inter-city |

**Caching Methods (Added in performance fixes):**
| Method | Purpose |
|---|---|
| `_cached_gtfs_routes` | Caches `get_all_routes_at_stop` per stop name |
| `_cached_shape_path` | Caches `get_shape_path_for_route` per route number |
| `_cached_stops_toward` | Caches `find_stops_on_route_toward_dest` per route+coords |
| `_cached_shape_between` | Caches `get_shape_between_stops` per stop pair |
| `_clear_caches` | Clears all caches at start of each `get_all_segments` |

**Standalone Functions (Outside Class):**

| Function | Purpose |
|---|---|
| `_ensure_gtfs()` | Lazily loads GTFS on first call |
| `_get_train_options(src, dst)` | Returns train options between two cities |
| `_route_goes_toward_dest(shape, ...)` | Checks if bus route direction goes toward destination |
| `_haversine_dist(lat1, lng1, lat2, lng2)` | Pure function for distance |
| `_safe(val, default)` | NaN/None safe wrapper |
| `_is_metro_operating()` | Checks if metro is running (5 AM - 11 PM) |
| `_gtfs_buses_at_stop(name)` | Helper to get GTFS routes at stop |
| `_has_gtfs_route(name)` | Checks if stop has GTFS data |

#### Global Variables
- `_gtfs` — GTFS loader singleton (set by `_ensure_gtfs()`)
- `_TRAIN_DATA` — Hardcoded train routes dictionary
- `db` — TransitDatabase singleton (imported from `backend.core.database`)

### 6.4 GTFS Service (backend/services/gtfs_service.py)

**Class: `GTFSLoader`** (591 lines)

**Data Structures (built from GTFS ZIP):**
- `_stop_times`: `Dict[stop_name → List[(departure_time, route_number)]]` — All departure times at each stop
- `_stop_times_by_route`: `Dict[route_number → List[(departure_time, stop_name)]]` — All stops for each route
- `_shapes`: `Dict[shape_id → List[(lat, lng)]]` — Shape geometry points
- `_route_shapes`: `Dict[route_number → List[shape_id]]` — Shape IDs for each route
- `_stop_to_shapes`: `Dict[stop_name → List[(shape_id, sequence)]]` — Stop positions on shapes
- `_stops_by_name`: `Dict[stop_name → (lat, lng)]` — Stop coordinates
- `_name_map`: `Dict[lowercase_normalized → original_name]` — Fuzzy name resolution
- `_all_gtfs_names`: `List[str]` — All stop names for search

**Key Methods:**

| Method | Purpose |
|---|---|
| `load()` | Loads GTFS from ZIP or pickle cache |
| `resolve_name(name)` | Fuzzy-matches a stop name to GTFS data |
| `get_all_routes_at_stop(stop_name)` | Returns routes with upcoming departure times |
| `get_shape_path_for_route(route_number)` | Returns full shape geometry for a route |
| `get_shape_between_stops(from_name, to_name)` | Returns shape segment between two stops |
| `find_stops_on_route_toward_dest(route, ...)` | Finds stops along route toward destination |
| `get_next_buses(stop_name)` | Returns upcoming bus departure times |
| `search_stops_by_name(query)` | Fuzzy search across GTFS stop names |

### 6.5 Database Layer (backend/core/database.py)

**Class: `TransitDatabase`** — Central data store for non-GTFS data.

**Data:**
- `_bus_stops`: Dict of bus stop name → {lat, lng, routes}
- `_bus_spatial`: Spatial index for nearest-stop queries
- `_metro_stations`: List of metro stations with line, lat, lng
- `_metro_adjacency`: Metro edge list for path finding
- `_metro_fare_cache`: Fare by distance
- `_railway_stations`: Hardcoded railway station coordinates
- `_kia_routes`: KIA bus route definitions
- `_city_bounds`: Bengaluru bounding box for `is_outside_bengaluru()`

**Key Methods:**
- `initialize()` — Loads all data files
- `find_nearby_bus_stops(lat, lng, radius_km)` — Spatial query
- `find_nearby_metro_stations(lat, lng, radius_km)` — Nearest metro
- `get_metro_line_path(station_a, station_b)` — Station-to-station metro geometry
- `get_metro_fare(distance_km)` — Returns metro fare
- `get_bmtc_ordinary_fare(distance_km)` — Returns ordinary bus fare
- `get_bmtc_ac_fare(distance_km)` — Returns AC Vajra fare

### 6.6 LLM Agent (backend/services/llm_agent.py)

Uses OpenRouter API (Meta Llama 3.1 8B) to estimate live ride-hailing prices.

**How it works:**
1. Takes source name, destination name, list of ride types
2. Calls OpenRouter with a prompt asking for price estimates
3. Parses the LLM response for per-km rates, base fares
4. Falls back to hardcoded defaults if LLM fails or times out (8s timeout)

**Ride Types (in order of preference):**
- Cab / Ola / Uber: ₹15/km + ₹25 base, capacity 4
- Auto: ₹10/km + ₹15 base, capacity 3
- Bike / Moto / Rapido: ₹6/km + ₹10 base, capacity 1

### 6.7 Configuration (backend/core/config.py)

```python
class Settings(BaseSettings):
    PROJECT_NAME: str = "VOYAGER"
    DEBUG: bool = True
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-8b-instruct"
    PROCESSED_DIR: str = "data_cache"
    GTFS_ZIP_PATH: str = "data/bmtc_gtfs.zip"

settings = Settings()
```

---

## 7. Frontend in Detail

### 7.1 Main Page (MainPage.tsx)

The app's main orchestrator component (313 lines).

**State manages:**
- `appMode`: 'search' | 'atob' | 'trip' — Current UI mode
- `sourceLocation`, `destLocation`: Selected points
- `routeGeometry`, `segmentGeometry`: Map overlays
- `trackingActive`: GPS live tracking state

**Key behaviors:**
- When user selects source+dest, shows SegmentPanel
- Handles map resize when panel opens/closes (via `onSizeChange`)
- GPS watchPosition for "Start Journey" button
- Combines routeGeometry + segmentGeometry for map display

### 7.2 Segment Panel (SegmentPanel.tsx)

The progressive multi-column UI (737 lines). This is where the user interacts with the routing data.

**State:**
- `data`: The full API response (`AllSegmentsResponse['data']`)
- `chainState`: Tracks current position in the decision tree
  - `activeSegIdx` — Current segment index
  - `selectedDest` — Currently selected nearby stop
  - `selectedTransit` — Currently selected transit option
  - `transferChain` — Selected transfer options in chain
  - `selectedFinal` — Selected final mile option
- `builtPath`: Array of selected options for path display and totals
- `hoveredOption`: Currently hovered option (for map highlight)

**Column rendering (progressive disclosure):**

1. **Column 0** — Direct options (walk/cab/auto/bike straight to destination)
2. **Column 1** — Nearby stops with reach options (click a stop)
3. **Column 2** — Transit options from selected stop (click a transit)
4. **Column 3+** — Transfer options (next_transit chain, recursive)
5. **Last Column** — Final mile options (walk/cab/auto/bike to destination)

**Key UI functions:**
- `handlePickDirect(opt)` — Selects a direct option, shows path on map
- `handlePickReach(dest, opt)` — Clicks a reach option to a stop, shows transit options
- `handlePickTransit(opt)` — Clicks transit → shows transfers or next segment
- `handlePickTransfer(opt)` — Adds transfer to chain, shows next level
- `handlePickFinal(opt)` — Selects final mile, completes the route
- `handleGoBack()` — Navigates back in the decision tree

**Map geometry generation (useEffect):**
Combines `builtPath` (selected options) + `hoveredOption` (hover highlight) + stop markers into `MapRouteGeometry[]` and sends to parent via `onGeometryChange`.

### 7.3 Map View (MapView.tsx)

Leaflet map component (379 lines).

**Renders:**
- TileLayer (OpenStreetMap)
- Route polylines with outline (white background + colored fill)
- Walking routes as dashed lines
- Transit stop markers (CircleMarker)
- Source/Destination markers
- User location marker
- Live GPS tracking marker
- News/event markers
- Waypoint markers
- Traffic overlay (optional)

**Coordinate format:** All coordinates are `[lat, lng]` (Leaflet standard).

### 7.4 API Service (api.ts)

Axios-based HTTP client (137 lines).

Key functions:
- `getAllSegments(...)` — Main segment API call
- `getSegmentStep(...)` — Legacy step API call
- `searchPlaces(...)` — Place search
- `planRoute(...)` — Legacy route planning
- `getRidePrices(...)` — Ride price estimation

Default timeout: 120000ms (2 minutes).

### 7.5 Types (types/index.ts)

TypeScript interfaces (286 lines).

**Critical interfaces:**
```typescript
AllSegmentsResponse {
  status: string
  data: {
    source: { lat, lng, name }
    dest: { lat, lng, name }
    segments: AllSegment[]
    total_segments: number
  }
}

AllSegment {
  segment_index: number
  from: { name, lat, lng }
  direct_options: SegmentStepOption[]
  destinations: SegmentDestination[]
}

SegmentDestination {
  stop: SegmentStopInfo
  distance_from_current: number
  reach_options: SegmentStepOption[]
  transit_options: TransitOption[]
}

TransitOption extends SegmentStepOption {
  route_number?: string
  bus_times?: { departure_time, route }[]
  transit_type?: string
  departure_time?: string
  arrival_time?: string
  final_options: SegmentStepOption[]
  next_transit?: TransitOption[]
  next_segment_index?: number
  dropoff_walk_min?: number
  dropoff_to_dest_km?: number
}

MapRouteGeometry {
  type: 'route' | 'segment' | 'hover' | 'stop'
  coordinates: [number, number][]  // [lat, lng] pairs
  color: string
  weight?: number
  dashArray?: string
  label?: string
}
```

### 7.6 Helpers (helpers.ts)

Utility functions for mode display:
- `getModeIcon(mode)` — Returns emoji for each mode
- `getModeLabel(mode)` — Returns display label
- `formatDuration(minutes)` — "2h 30m" format
- `formatRupees(paise)` — "₹150" format

---

## 8. The Segment System

### 8.1 What Is a Segment?

A **segment** represents a decision point in the journey. Each segment starts from a location and shows:
1. **Direct options** — Go straight to destination from here
2. **Nearby stops** — Walk/ride to a bus stop, metro station, or railway station
3. **Transit options from each stop** — Buses, metro, trains available at that stop

Segments are **chained together**: the arrival point of one segment becomes the "from" point of the next. This creates a progressive multi-hop journey planner.

### 8.2 Segment Structure

```json
{
  "segment_index": 0,
  "from": {"name": "HSR Layout", "lat": 12.9344, "lng": 77.6105},
  "direct_options": [
    {"mode": "walk", "from": "HSR Layout", "to": "Silk Board", ...},
    {"mode": "cab", "from": "HSR Layout", "to": "Silk Board", ...}
  ],
  "destinations": [
    {
      "stop": {"name": "Central Silk Board", "lat": ..., "lng": ..., "type": "metro"},
      "distance_from_current": 1.2,
      "reach_options": [
        {"mode": "walk", ...},
        {"mode": "bike", ...}
      ],
      "transit_options": [
        {
          "mode": "bus_ordinary",
          "route_number": "600-F",
          "from": "Central Silk Board",
          "to": "Madiwala",
          "distance_km": 3.5,
          "duration_minutes": 15,
          "fare": 30,
          "per_person": 6,
          "from_lat": 12.91,
          "from_lng": 77.61,
          "to_lat": 12.92,
          "to_lng": 77.62,
          "arrives_at_stop": true,
          "transit_type": "bus",
          "path": [[12.91, 77.61], [12.92, 77.62], ...],
          "bus_times": [{"departure_time": "14:30:00", "route": "600-F"}, ...],
          "final_options": [
            {"mode": "walk", "from": "Madiwala", "to": "Silk Board", ...},
            {"mode": "cab", ...}
          ],
          "next_transit": [
            {
              "mode": "bus_ordinary",
              "route_number": "201",
              "from": "Madiwala",
              "to": "BTM Layout",
              ...
              "next_transit": [],
              "final_options": [...]
            }
          ]
        }
      ]
    }
  ]
}
```

### 8.3 Progressive Multi-Column UI Flow

The frontend renders segments as a series of columns. The user progressively clicks through:

```
Column 0                    Column 1                    Column 2                    Column 3                    Column 4
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  DIRECT OPTIONS  │       │  NEARBY STOPS    │       │  TRANSIT OPTIONS │       │  TRANSFERS       │       │  FINAL MILE      │
│                  │       │                  │       │                  │       │                  │       │                  │
│  🚶 Walk 15min   │       │  🚏 Central SB   │       │  🚌 600-F        │       │  🚌 201          │       │  🚶 Walk 5min    │
│  🚕 Cab ₹80      │       │    🚶 Walk 5min ◄─┼───────│    → Madiwala    ├───────│    → BTM Layout  ├───────│    → Dest        │
│  🛵 Bike ₹30     │       │    🛵 Bike ₹18   │       │  🚇 Metro        │       │  🚇 Metro        │       │  🚕 Cab ₹40     │
│                  │       │                  │       │    → MG Road     │       │    → Majestic    │       │                  │
└──────────────────┘       └──────────────────┘       └──────────────────┘       └──────────────────┘       └──────────────────┘
     Always shown              Always shown              Shown after               Shown after               Shown after
                                                      clicking a stop            clicking transit          clicking transfer
                                                                                                             or transit with
                                                                                                             final_options
```

**Selection state machine:**
```
IDLE → click direct → SHOW PATH (complete route)
     → click reach → SHOW COLUMN 2 (transit options)
     → click transit with next_segment_index → JUMP TO NEW SEGMENT (start over from that arrival point)
     → click transit with next_transit → SHOW COLUMN 3 (transfers)
     → click transit with final_options → SHOW FINAL MILE COLUMN
     → click transfer → ADD TO CHAIN, show next level or final
     → click final → COMPLETE ROUTE, show totals
```

### 8.4 The `_build_single_segment` Function

**Purpose:** Build one complete segment from a given "from" location.

**Flow:**
```
1. Calculate direct_dist = haversine(from, dest)
2. Add direct options (walk/cab/auto/bike) via _add_direct_options()
3. Find nearby bus stops (2km radius) → up to 15
4. Find nearby metro stations (3km radius) → up to 6
5. Find nearby railway stations (15km radius) → up to 3 (long distance only)
6. For each nearby stop:
   a. Skip if too far from destination (>1.5x current distance)
   b. Add reach options (walk/cab/auto/bike to stop) via _add_reach_options()
   c. Add transit options from that stop via _add_transit_options()
7. Filter out destinations with no reach AND no transit options
8. Sort by relevance score (closest, most transit options, metro preferred)
9. Limit to max_dest (6 for seg 0, 4 for deeper segments)
```

### 8.5 The `_add_transit_options` Function

**Purpose:** Add all transit options from a given stop toward the destination.

**Flow:**
```
1. Set up ride types array (cab, auto, bike with per-km rates)
2. BUS TRANSIT (if stop is bus or metro type):
   a. Get all GTFS routes at this stop (cached)
   b. For each route (up to 6):
      - Get shape path for route (cached)
      - Check direction: _route_goes_toward_dest()
      - Find stops on route toward destination (cached, max 3)
      - Get shape between source stop and arrival stop
      - Calculate distance, fare
      - Check budget
      - Build next_transit (recursive, depth=2)
      - Add ordinary bus option
      - Add AC Vajra option (higher fare)
3. KIA BUS (airport buses):
   - Find matching KIA route at this stop
   - Calculate fare from fare difference
   - Add KIA option
4. METRO TRANSIT (if stop is metro type):
   - Find destination metro stations on same line closest to dest
   - Get metro line path between stations
   - Add metro option with next_transit chaining
5. FINAL MILE for ALL transit options:
   - Walk if within 2km of destination
   - Bus final mile: find buses from drop-off toward dest
   - Ride options (cab/auto/bike) if distance >= 1km
6. Sort transit options by relevance score
```

### 8.6 The `_build_next_transit` Function

**Purpose:** Recursively build transfer options from an arrival point.

**Parameters:** `t_lat, t_lng, exclude_name, dest_lat, dest_lng, dest_name, group_size, budget, dest_nearby_metro, ride_types, depth=2, visited_stops=None`

**Flow:**
```
1. Check dropoff_dist <= 1.5km → return [] (close enough, no transfer needed)
2. Initialize visited_stops set (coordinate-based, 300m radius)
3. Define MAJOR_HUBS list (Majestic, KR Market, Shivajinagar, etc.)
4. Define _is_hub_or_toward_dest helper
5. BUS TRANSFERS:
   a. Find nearby bus stops (0.5km radius) → up to 4
   b. For each stop:
      - Skip if visited (coordinate proximity check)
      - Get GTFS routes at this stop (cached) → up to 3
      - For each route:
        * Check direction (hub or toward dest)
        * Find stops on route toward dest (cached, max 2)
        * Check minimum progress (>=1km closer to dest)
        * Build path
        * Build final_options (walk/ride/bus)
        * Recursively call _build_next_transit (depth-1)
        * Add to next_transit list
6. METRO TRANSFERS:
   a. Find nearby metro stations (1.5km radius) → up to 2
   b. For each station:
      - Find station on same line closest to destination
      - Check direction: must be closer to dest than current station
      - Calculate fare
      - Build final_options (walk/ride/bus)
      - Recursively call _build_next_transit (depth-1)
      - Add to next_transit list
7. Return next_transit list
```

### 8.7 The `get_all_segments` Orchestrator

**Purpose:** Build the complete chain of segments from source to destination.

**Flow:**
```
1. Clear per-request caches
2. Build segment 0 (from source)
3. Collect all unique arrival points from segment 0's transit options
4. For each level (up to max_depth=3, max 5 total segments):
   a. For each unique arrival point (up to 2 per level):
      - Build a new segment from that arrival point
      - Link transit options to this segment via next_segment_index
      - Collect new arrival points for next level
5. Return all segments
```

### 8.8 Chaining Algorithm (Hop Mechanism)

The hop mechanism works at TWO levels:

**Level 1: Inner-chain (within a single segment)**
- `_add_transit_options` calls `_build_next_transit(t_lat, t_lng, ...)`
- `_build_next_transit` finds buses/metro from the ARRIVAL POINT going toward destination
- These are stored in `transit_option.next_transit[]`
- Depth parameter controls recursion: depth=2 means max 2 hops within the chain

**Level 2: Outer-chain (across segments)**
- `get_all_segments` collects all arrival points from segment 0
- For each unique arrival point, builds a NEW segment (segment 1, 2, ...)
- Transit options that lead to these new segments get `next_segment_index`
- Frontend jumps to the new segment when user clicks such an option

**Chaining constraints:**
- Inner-chain: Max 2 hops (depth=2), limited by dropoff_dist > 1.5km
- Outer-chain: Max 5 total segments, max 2 segments per level
- Circular routing: Prevented by coordinate-based visited_stops (300m radius)
- Direction: Each hop must make at least 1km progress toward destination

### 8.9 Segment-to-Segment Linking

When the outer-chain creates a new segment, transit options from the parent segment are linked to it:

```python
# In get_all_segments:
# For each unique arrival point (nl, ng, nn), build next_seg
next_seg = self._build_single_segment(nl, ng, nn, ...)

# Link transit options that arrive at (nl, ng) to this segment
for prev_seg in segments:
    for de in prev_seg["destinations"]:
        for topt in de.get("transit_options", []):
            tmk = f"{round(topt['to_lat'],4)},{round(topt['to_lng'],4)}"
            if tmk == nk:
                topt["next_segment_index"] = seg_arr_idx
```

The frontend uses `next_segment_index` to jump to the next segment when clicked.

---

## 9. Transport Modes

### 9.1 Walking

- **Speed**: 5 km/h (12 min/km)
- **Max distance**: No hard limit, but only suggested within 2km of destination
- **Fare**: ₹0
- **Path**: Interpolated with slight mid-route bulge (not actual footpath)
- **Display**: Dashed line on map (dashArray: "10, 6")

### 9.2 BMTC Buses (Ordinary & AC Vajra)

**Ordinary Bus (bus_ordinary):**
- **Fare**: `max(6, round(db.get_bmtc_ordinary_fare(dist)))` — slab-based
- **Speed**: 15 km/h (4 min/km)
- **Data source**: GTFS stop times

**AC Vajra (bus_ac_vajra):**
- **Fare**: `max(10, round(db.get_bmtc_ac_fare(dist)))` — higher slab
- **Speed**: ~17 km/h (3.5 min/km)
- **Label**: "❄️ AC Vajra" in frontend
- **Path**: Same as ordinary bus (reuses GTFS shape)

**Bus times (departures):**
- Filtered to show only future departures (after current time)
- Up to 5 departure times shown per route
- Sorted by departure time

**Route direction filtering:**
- Uses `_route_goes_toward_dest()` to check if bus goes toward destination
- Both angle check (bearing) and distance progress check
- Routes toward major hubs (Majestic, KR Market, etc.) are accepted even if not directly toward dest

### 9.3 Namma Metro

- **Operating hours**: 5:00 AM to 11:00 PM (checked by `_is_metro_operating()`)
- **Lines**: Green (Nagasandra↔Silk Institute), Purple (Whitefield↔Kengeri)
- **Fare**: `round(db.get_metro_fare(distance_km))` — distance-based
- **Speed**: 30 km/h (2 min/km)
- **Path**: Station-to-station geometry from metro network CSV
- **Direction**: Finds station on same line closest to destination
- **Chaining**: Metro→bus transfers at exit station

### 9.4 KIA Airport Buses

- **Routes**: KIA-4, KIA-4A, KIA-5, KIA-5D, KIA-6, KIA-7, KIA-8, KIA-8E, KIA-9, etc.
- **Fare**: Calculated from fare difference between stops on the route
- **Speed**: 20 km/h (3 min/km)
- **Data**: From `db.kia_routes` (parsed from stop master CSV)
- **Display**: Same icon as AC Vajra

### 9.5 Indian Railways (Long Distance)

- **Only shown** when `is_long_dist = True` (distance > 40km OR outside Bengaluru)
- **Data**: Hardcoded `_TRAIN_DATA` dictionary with 8 city pairs
- **Name normalization**: Handles 15+ station name variants
- **Unknown pairs**: Generic options generated with 3h travel time
- **Transfer**: After train arrival, shows bus/metro transfers at the destination station

### 9.6 Cabs / Auto / Bike (Ride-Hailing)

**Pricing models:**
- Cab: ₹15/km + ₹25 base, capacity 4
- Auto: ₹10/km + ₹15 base, capacity 3
- Bike: ₹6/km + ₹10 base, capacity 1

**Price source:** LLM live pricing (OpenRouter) with hardcoded fallback

**Filters:**
- Group size must not exceed capacity
- Budget filter: total fare ≤ budget
- AC Vajra preferred over cab when budget is tight
- Walk preferred over ride when distance < 0.5km

---

## 10. Pricing System

### 10.1 Bus Fares

**Ordinary:** `max(6, round(db.get_bmtc_ordinary_fare(dist)))`
- Minimum: ₹6
- Slab-based from `transit_fares.json`

**AC Vajra:** `max(10, round(db.get_bmtc_ac_fare(dist)))`
- Minimum: ₹10
- Higher slab rates

**Total per ride:** `fare_per_person × group_size`

### 10.2 Metro Fares

**Calculation:** `round(db.get_metro_fare(distance_km))`
- Distance-based fare table
- Minimum: ~₹10
- Maximum: ~₹60 (full line)

### 10.3 Ride-Hailing Fares (LLM Live Pricing)

Two sources:
1. **LLM** (OpenRouter): Prompt-based price estimation with 8s timeout
2. **Hardcoded fallback**: Per-km rates + base fare

**LLM prompt** asks for:
- Base fare and per-km rate for each mode
- Company-specific multipliers (Ola vs Uber vs Rapido)

**Output format** (parsed from LLM response):
```json
{
  "cab": {"base_fare": 25, "per_km": 15},
  "auto": {"base_fare": 15, "per_km": 10},
  "bike": {"base_fare": 10, "per_km": 6}
}
```

### 10.4 Train Fares

- **Sleeper**: ₹0.75/km (for generic options)
- **Known routes**: Hardcoded in `_TRAIN_DATA`
- **Total**: `fare_per_person × group_size × 2` (round trip for generic)

### 10.5 Budget & Group Size Filtering

Applied at every hop level:
- Individual fares calculated per person
- Total = per_person × group_size
- If total > budget AND budget is set → option is hidden
- Budget check applies to direct options, reach options, transit options, and final options
- No budget = show all options regardless of cost

---

## 11. Direction Filtering & Route Quality

### 11.1 The `_route_goes_toward_dest` Function

**Purpose:** Determine if a bus route's shape path goes toward the destination from a given stop.

**Location:** `backend/services/transit_service.py:125-160`

**Logic:**
1. Find the shape point closest to the stop
2. If the closest point is near the end of the shape (last 2 points), the route ENDS here → return False
3. Get the direction vector from the current shape point to a point 3 steps ahead
4. Get the direction vector from the stop to the destination
5. Calculate the cosine of the angle between these two vectors
6. If cosine < 0.26 (angle > 75°), route goes away → return False
7. **Distance progress check**: Verify shape end is not >30% farther from dest than shape start
8. Return True if all checks pass

### 11.2 Angle Check (Bearing)

- Compares the bus route's direction at the nearest shape point to the direction toward destination
- Threshold: cos(angle) >= 0.26 → angle <= ~75°
- Uses both lat/lng deltas normalized as unit vectors
- Dot product gives cosine of angle between the two directions

### 11.3 Distance Progress Check

- Added as a fix for routes that start going toward dest but then loop away
- Calculates: `haversine(stop, dest)` vs `haversine(shape_end, dest)`
- If shape_end is >30% farther from dest than the stop itself → route goes overall away
- Threshold: `end_dist <= start_dist × 1.3`

### 11.4 Hub Detection

Major transit hubs are defined in `_build_next_transit`:
```python
MAJOR_HUBS = ["majestic", "kempegowda bus station", "kr market", "kbs",
              "shivajinagara", "shivajinagar", "banashankari", "jayanagara",
              "k.r. market", "city market", "platform 10", "platform 11",
              "platform 12", "platform 13", "platform 14"]
```

Routes going toward a major hub are accepted even if they don't directly go toward the destination (because from the hub, there are more transit options).

### 11.5 Minimum Progress Per Hop

Each transit hop must make at least **1km of progress** toward the destination:
```python
current_to_dest = haversine(current_stop, destination)
arrival_to_dest = haversine(arrival_stop, destination)
if arrival_to_dest > current_to_dest - 1.0:
    continue  # Skip — not enough progress
```

This prevents short, pointless hops between nearby stops on the same route.

---

## 12. Path Generation & Map Display

### 12.1 GTFS Shape Paths

**Source:** `gtfs_service.get_shape_between_stops(from_name, to_name)`

**How it works:**
1. Resolves both stop names to GTFS keys
2. Finds common shape IDs that contain both stops
3. Extracts the shape segment between the two stop sequences
4. Returns `[[lat, lng], ...]` array
5. Falls back to full route shape if stop-to-stop segment not found

### 12.2 Metro Line Paths

**Source:** `db.get_metro_line_path(station_a, station_b)`

**How it works:**
1. Looks up adjacency data from metro network CSV
2. Finds the path along the line between two stations
3. Returns `[[lat, lng], ...]` array of station coordinates along the line

### 12.3 OSRM Paths

**Source:** `TransitService.get_osrm_path_between(slat, slng, dlat, dlng, profile)`

**How it works:**
1. Calls OSRM API: `{base_url}/route/v1/{profile}/{slng},{slat};{dlng},{dlat}?overview=full`
2. Parses GeoJSON response coordinates
3. Reverses from `[lng, lat]` to `[lat, lng]`
4. Caches result in `_path_cache`
5. Falls back to interpolated path on failure

**Current status:** OSRM at `https://router.project-osrm.org` is unreachable. All OSRM calls fall back to interpolated paths.

### 12.4 Interpolated Fallback Paths

**Source:** `TransitService._interpolate_path(slat, slng, dlat, dlng, num_points=12)`

**Algorithm:**
1. Generate `num_points + 1` evenly spaced points between source and destination
2. If distance > 1km: Add slight mid-route bulge (60° angle offset) to look less like a straight line
3. Returns `[[lat, lng], ...]`

**Quality:** These are approximate paths, not actual road routes. They serve as placeholders when GTFS/OSRM paths are unavailable.

### 12.5 Path Priority Hierarchy

For each option, the path is chosen in this order:

```
1. GTFS shape between specific stops (most accurate)
2. Full GTFS route shape (if stop-to-stop unavailable)
3. Metro line station-to-station path (for metro)
4. OSRM driving/walking path (currently always fails)
5. Interpolated path with bulge (fallback)
```

**For AC Vajra:** Same as ordinary bus (shares the same GTFS shape).

**For next_transit/final_options:** Same hierarchy, rebuilt for each leg.

---

## 13. Performance & Optimization

### 13.1 GTFS Caching

- GTFS data is loaded from ZIP and cached to pickle (`gtfs_cache.pkl`)
- Cache load: ~0.8s
- Fresh load from ZIP: ~41s
- Cache is read once at startup and kept in memory

### 13.2 Request-Level Caching

Four cache functions in `TransitService`:

| Cache | Key | Value | Hit Rate |
|---|---|---|---|
| `_gtfs_route_cache` | Stop name | List of routes | High (same stop queried multiple times) |
| `_shape_cache` | Route number | Shape path | Very high (same route at different stops) |
| `_stops_toward_cache` | Route+coords hash | Stop list | Medium (same route from nearby stops) |
| `_shape_between_cache` | From→To names | Shape segment | High (same stop pair across options) |

Caches are cleared at the start of each `get_all_segments` call via `_clear_caches()`.

### 13.3 Adaptive Limits

Limits are applied at multiple levels to keep response time reasonable:

| Limit | Segment 0 | Deeper Segments |
|---|---|---|
| Max destinations | 6 | 4 |
| Bus stops searched | 15 (reduced from unlimited) | Same |
| Routes per stop | 6 | Same |
| Segments per level | 2 | 2 |
| Max total segments | 5 | 5 |
| Nearby bus for transfers | 4 | 4 |
| Routes per transfer | 3 | 3 |
| Nearby metro for transfers | 2 | 2 |
| Final mile bus options | 2 | 2 |

### 13.4 Circular Routing Prevention

- **Coordinate-based visited set**: Uses `_coord_key(lat, lng)` → `"12.934,77.611"`
- **Distance check**: `_is_visited(lat, lng, visited_set)` checks if within 300m of any visited point
- **Why 300m?**: Slightly larger than bus stop spacing (typically 200-500m) to prevent re-visiting the same area
- Applied in `_build_next_transit` for both bus stops and metro stations

### 13.5 Relevance Scoring

**Transit options** are sorted by relevance:
```python
score = 0
score -= distance_to_destination * 10    # Closer is better
score -= duration_minutes * 0.5          # Faster is better
score -= fare * 0.1                      # Cheaper is better
if metro: score += 15                    # Prefer metro
if has_walk_final: score += 10            # Walking final mile is ideal
if has_next_transit: score -= 5           # Fewer transfers preferred
```

**Destinations** are sorted by:
```python
score = 0
score -= distance_from_source * 2         # Closer stops first
score -= distance_from_stop_to_dest * 0.5  # Stop closer to dest preferred
score += len(transit_options) * 3          # More transit options = better
if metro: score += 5                       # Metro stations preferred
```

---

## 14. API Endpoints Reference

| Method | Endpoint | Purpose | Parameters |
|---|---|---|---|
| GET | `/` | Health check | — |
| GET | `/api/routes/all-segments` | Full segment chain | from_lat, from_lng, from_name, dest_lat, dest_lng, dest_name, group_size, budget, max_depth |
| GET | `/api/routes/segment-step` | Single segment (legacy) | from_lat, from_lng, from_name, dest_lat, dest_lng, dest_name, group_size, budget |
| GET | `/api/routes/plan` | Route plan (legacy) | source_lat, source_lng, dest_lat, dest_lng, mode, budget, group_size, waypoints |
| POST | `/api/routes/plan` | Route plan (post) | JSON body |
| GET | `/api/routes/mini-path-options` | Simple path options | source_lat, source_lng, dest_lat, dest_lng, group_size |
| GET | `/api/routes/metro-stations` | Metro station list | line (optional) |
| GET | `/api/routes/bus-stops` | Bus stop list | near_lat, near_lng, radius |
| GET | `/api/routes/traffic-overlay` | Traffic data | north, south, east, west |
| GET | `/api/search/places` | Place search | q, lat, lng |
| GET | `/api/search/nearby` | Nearby places | lat, lng, radius_km, place_type |
| GET | `/api/search/suggestions` | Search suggestions | q |
| GET | `/api/search/verify-place` | Verify place name | name, address |
| GET | `/api/search/ride-prices` | Ride prices | source, destination |
| POST | `/api/search/enrich-place` | Enrich place data | name, lat, lng, place_type, address |

---

## 15. Data Flow Diagrams

### 15.1 Full Request Flow (Yelahanka → MG Road)

```
User types "Yelahanka Old Town"
  → Frontend calls searchPlaces("Yelahanka Old Town")
    → Backend searches OSM Nominatim + local database
    → Returns coordinates (13.1005, 77.5565)
  
User types "Mahatma Gandhi Road"
  → Frontend calls searchPlaces("Mahatma Gandhi Road")
    → Returns coordinates (12.9716, 77.5946)

User clicks "Find Routes"
  → Frontend calls getAllSegments(13.1005, 77.5565, ..., 12.9716, 77.5946, ...)
    → Backend:
      1. Clear caches
      2. _build_single_segment(13.1005, 77.5565, ...):
         a. _add_direct_options:
            - Walk not shown (>5km?)
            - Auto: ₹163, 74min
            - Bike: ₹99, 30min
         b. Find nearby_bus (2km): 15 stops found, 8 processed
            - For each stop:
              → _add_reach_options (walk/bike/auto to stop)
              → _add_transit_options:
                - GTFS: get_all_routes_at_stop → up to 6 routes
                - For each route:
                  → get_shape_path_for_route (cached)
                  → _route_goes_toward_dest check
                  → find_stops_on_route_toward_dest (cached, 3 stops)
                  → get_shape_between_stops (cached)
                  → Calculate fare, budget check
                  → _build_next_transit(depth=2):
                    - Find nearby_bus (0.5km)
                    - Find nearby_metro (1.5km)
                    - Build bus/metro transfers
                    - Each transfer: final_options (walk/ride/bus)
                  → Add ordinary + AC Vajra options
         c. _add_transit_options for metro stops (if any)
         d. KIA buses from metro stops
         e. Sort destinations + transit options by relevance
         f. Limit to 6 destinations
      
      3. get_all_segments outer chain:
         - Collect arrival points from seg 0
         - Build seg 1 for each unique arrival (max 2)
         - Build seg 2 from seg 1 arrivals (max 2)
         - Link via next_segment_index
      
      4. Return all segments
    
  → Frontend receives response (~7MB, ~30s)
  → Renders columns progressively
```

### 15.2 Single Transit Option Build

```
Stop: "Bettahalli Layout Yelahanka" (13.0925, 77.5595)
Destination: "MG Road" (12.9716, 77.5946)

1. get_all_routes_at_stop("Bettahalli Layout Yelahanka")
   → Returns [{route_number: "MF-28", next_departures: ["14:30", "15:00"]}, ...]

2. For route "MF-28":
   a. get_shape_path_for_route("MF-28")
      → [[13.09, 77.56], [13.08, 77.57], ..., [12.97, 77.59]]
   b. _route_goes_toward_dest(shape, 13.0925, 77.5595, 12.9716, 77.5946)
      → True (shape goes south toward MG Road)
   c. find_stops_on_route_toward_dest("MF-28", 13.0925, 77.5595, 12.9716, 77.5946)
      → [{stop_name: "maruthinagara", lat: 13.0589, lng: 77.5811, distance_to_dest: 9.77}]
   d. Check: haversine(13.0925,77.5595,12.9716,77.5946) = ~14km
      haversine(13.0589,77.5811,12.9716,77.5946) = ~9.8km
      Progress: 14 - 9.8 = 4.2km > 1km → PASS
   e. get_shape_between_stops("Bettahalli Layout Yelahanka", "maruthinagara")
      → 7 coordinate pairs
   f. Fare: max(6, round(db.get_bmtc_ordinary_fare(4.2))) = ₹12
   g. _build_next_transit(13.0589, 77.5811, ...):
      - dropoff_dist = 9.77km > 1.5km
      - Find nearby_bus(13.0589, 77.5811, 0.5):
        → "Maruthinagara Sahakaranagara", "CQAL Layout Shankaranagara", ...
      - For each, find routes going toward MG Road
      - Build next_transit options (bus 229-D → rayan circle, etc.)
   h. Build option:
      {
        mode: "bus_ac_vajra",
        route_number: "MF-28",
        from: "Bettahalli Layout Yelahanka",
        to: "maruthinagara",
        distance_km: 4.2,
        duration_minutes: 17,
        fare: 12,
        path: [[13.09, 77.56], ..., [13.06, 77.58]],
        final_options: [{walk: "Walk 10min to MG Road"}, ...],
        next_transit: [{bus 229-D → rayan circle}, ...]
      }
```

---

## 16. Known Issues & Bugs

### Critical

1. **OSRM unreachable** — All driving/walking paths use interpolated fallback (straight lines with bulge). No actual road-following paths. Fix: Set up local OSRM instance or use alternative routing service.

2. **GTFS route numbers are cryptic** — Many routes show internal codes like "MF-28 JKLO-ISROQ-LGRNB" instead of human-readable numbers like "MF-28". Fix: Map GTFS `route_short_name` to clean display names.

3. **Long response time for distant routes** — Yelahanka→MG Road takes ~28s. For routes 20-30km, can exceed 60s. Fix: More aggressive caching, parallel processing, or route-specific optimization.

4. **AC Vajra "to" field matches ordinary bus** — AC Vajra option uses same arrival stop as ordinary bus. Sometimes the stop name is correct, sometimes it shows the same for both variants.

### Medium

5. **Railway stations not shown for medium distances** — `is_long_dist` requires distance >40km. Yelahanka has a railway station but it's only 15km from MG Road, so railway is skipped. Fix: Lower threshold or add railway as option for all distances.

6. **Metro→Metro transfers not supported** — Can't chain Purple→Green line at Majestic. The system only finds stations on the SAME line closest to destination. Fix: Add cross-line transfer at interchange stations.

7. **Some final options show wrong "from" location** — Final mile options sometimes show the bus stop name instead of the metro station name when transitioning from metro→bus→walk.

8. **Budget filtering too aggressive** — When budget is set, ride options are completely hidden even if the user might want to see them. Fix: Show ride options with a "budget exceeded" label instead of hiding.

### Minor

9. **Bike reach option doesn't show in all cases** — `_add_reach_options` only shows bike when distance is between 0.5-3km. Auto shown between 0.5-5km. Cab shown only >2km. These thresholds might be too restrictive.

10. **Path bulge is random** — The interpolated path bulge direction is semi-random. This means the same route can show different paths on different requests.

11. **LLM pricing timeout too short** — 8s timeout for Live pricing. If LLM is slow, falls back to hardcoded values which may be inaccurate.

12. **Frontend loading state gets stuck** — If API takes >2 minutes, axios times out. The error catch in SegmentPanel doesn't show a retry button.

### Fixed in Latest Updates

13. ~~Transfer chaining metro→bus broken~~ — Fixed: `_build_next_transit` now chains buses from metro exit station.
14. ~~Circular routing~~ — Fixed: Coordinate-based visited stop check (300m radius).
15. ~~Direction filtering too weak~~ — Fixed: Added distance progress check + 1km minimum progress per hop.
16. ~~Paths missing for final options~~ — Fixed: Added interpolated path fallback to all final options.
17. ~~Frontend maxDepth=1~~ — Fixed: Changed from 1 to 3 in SegmentPanel.tsx.

---

## 17. Future Improvements Roadmap

### Phase 1 (Immediate — 1-2 weeks)

1. **OSRM local instance** — Set up Docker-based OSRM for Bengaluru to get real road paths. This is the #1 quality improvement.

2. **GTFS route name cleaning** — Map cryptic GTFS codes to clean display names using `routes.txt` from GTFS.

3. **Response time optimization**:
   - Pre-compute common stop pair lookups
   - Use SQLite for GTFS queries instead of Python dicts
   - Parallel async processing for GTFS lookups

4. **Railway for all distances** — Show railway stations regardless of distance. Lower threshold or remove entirely.

### Phase 2 (Short-term — 2-4 weeks)

5. **Metro→Metro transfers** — Add interchange at Majestic (Green↔Purple). Also add future lines (Blue, Yellow, Pink).

6. **Better interpolated paths** — Use OSRM demo API or GraphHopper as alternative. Or implement a road-aware interpolation using OSM road data.

7. **Multi-waypoint support** — Let users add intermediate stops. Already partially built in frontend (custom waypoints) but not integrated with segment system.

8. **Route comparison view** — Side-by-side comparison of top 3-5 complete routes with score, fare, duration.

### Phase 3 (Medium-term — 1-2 months)

9. **Real-time bus tracking** — Integrate BMTC live tracking API (if available) or use GTFS-RT for live positions.

10. **User accounts & history** — Save favorite routes, commute patterns.

11. **Offline mode** — Cache GTFS data and metro network for offline use.

12. **Multi-language support** — Kannada, Hindi, English UI.

### Phase 4 (Long-term — 3+ months)

13. **Other cities** — Extend to other Indian cities with GTFS data (Delhi, Mumbai, Chennai, Hyderabad, Kolkata, Pune, Ahmedabad).

14. **Auto-rickshaw fare estimation** — Real BMTC auto fare calculation with meter rates.

15. **Crowdsourced data** — Allow users to report route issues, bus stop corrections.

16. **Integration with ride-hailing APIs** — Real Ola/Uber/Rapido pricing via their APIs (not LLM estimation).

17. **Carbon footprint estimation** — Show CO2 savings for transit vs driving.

### What's Needed for Production

- **Error handling**: Better error boundaries, retry logic, graceful degradation
- **Monitoring**: Request logging, performance tracking, error alerts
- **Testing**: Unit tests (none currently), integration tests, E2E tests
- **Security**: API rate limiting, input validation hardening, CORS lockdown
- **Deployment**: Docker setup, CI/CD pipeline, environment configs
- **Documentation**: API docs (Swagger already available at /docs), user guide

---

## 18. Development Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- npm or yarn

### Backend Setup
```powershell
cd VOYAGER
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

### Frontend Setup
```powershell
cd VOYAGER\frontend
npm install
npx vite --port 3000
```

### Access
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

### Configuration
Create `.env` in project root:
```
OPENROUTER_API_KEY=your_key_here
OSRM_BASE_URL=https://router.project-osrm.org
```

---

## 19. Deployment Notes

### Required Environment Variables
- `OPENROUTER_API_KEY` — Required for LLM live pricing
- `OSRM_BASE_URL` — Optional, default: `https://router.project-osrm.org`
- `DEBUG` — Set to `false` in production

### Production Considerations
1. **CORS**: Restrict to specific origins, not `*`
2. **Timeout**: Frontend axios timeout = 120s. Consider increasing for complex routes.
3. **GTFS cache**: Ensure `data_cache/` is writable. Pre-warm cache in Docker build.
4. **Static files**: Serve frontend build from FastAPI in production (not separate Vite server).
5. **Process manager**: Use `gunicorn` with `uvicorn workers` or `supervisor` for production.
6. **Memory**: GTFS cache uses ~200-400MB RAM. Ensure adequate memory.

### Docker Build (Suggested)
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Pre-build frontend
WORKDIR /app/frontend
RUN npm ci && npm run build
WORKDIR /app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Appendix A: Ride Types Configuration

```python
ride_types = [
    ("cab", "Cab / Ola / Uber", 15, 0.6, 25, "🚕", 4),
    #    mode    label              ₹/km min/km base icon capacity
    ("auto", "Auto", 10, 1.0, 15, "🛺", 3),
    ("bike", "Uber Moto / Rapido", 6, 2.0, 10, "🏍️", 1),
]
```

**Fields:**
1. `mode` — Mode identifier (used in `mode` field)
2. `label` — Display label
3. `per_km` — Cost per kilometer (₹)
4. `tpk` — Time per kilometer (minutes)
5. `base` — Base fare (₹)
6. `icon` — Display emoji
7. `cap` — Maximum passenger capacity

## Appendix B: Major Transit Hubs

```python
MAJOR_HUBS = [
    "majestic",              # Kempegowda Bus Station / Majestic
    "kempegowda bus station", # KBS / Majestic
    "kr market",             # KR Market / City Market
    "kbs",                   # Kempegowda Bus Station
    "shivajinagara",         # Shivajinagar Bus Station
    "shivajinagar",          # Alternative spelling
    "banashankari",          # Banashankari Bus Station
    "jayanagara",            # Jayanagar Bus Station
    "k.r. market",           # KR Market (alternative)
    "city market",           # City Market
    "platform 10",           # BMTC Platform 10 (KBS)
    "platform 11",           # BMTC Platform 11 (KBS)
    "platform 12",           # BMTC Platform 12 (KBS)
    "platform 13",           # BMTC Platform 13 (KBS)
    "platform 14",           # BMTC Platform 14 (KBS)
]
```

## Appendix C: GTFS Name Resolution

The GTFS loader uses fuzzy matching for stop names:

```python
def _fuzzy_match(query, candidates, cutoff=0.55):
    q = _normalize(query)
    for c in candidates:
        score = SequenceMatcher(None, q, _normalize(c)).ratio()
        if q in _normalize(c) or _normalize(c) in q:
            score = max(score, 0.9)
        if score > best_score:
            best = c
    if best_score >= cutoff:
        return best
    return None
```

This allows "Central Silk Board" to match "Central Silk Board (CSB)" or "Central Silk Board Metro Station" in GTFS data.

## Appendix D: TOPSIS Scoring (Legacy)

Used in the old `_plan_route` method for ranking complete routes:

- Fare score (25%): Lower fare = higher score
- Time score (30%): Shorter duration = higher score
- Walk score (15%): Less walking = higher score
- Comfort score (20%): Metro > AC Bus > Ordinary Bus > Auto > Walk
- Budget bonus: Under budget = +5 to +10
- Group size bonus: Cheap per-person = +5

---

*Document generated: July 2026*
*Last updated: After segment system rebuild, transfer chaining fix, direction filtering improvement, path correctness fixes*
