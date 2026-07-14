# VOYAGER — Complete Project Documentation

> **Last Updated**: July 15, 2026  
> **Project Status**: Active Development — Segment Feature Phase  
> **Repository**: `VOYAGER/` root directory

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Feature 1: Search & Route Planning](#4-feature-1-search--route-planning)
5. [Feature 2: Progressive Multi-Column Segment UI](#5-feature-2-progressive-multi-column-segment-ui)
6. [GTFS Data Pipeline](#6-gtfs-data-pipeline)
7. [Transit Service — Core Logic](#7-transit-service--core-logic)
8. [Database Layer](#8-database-layer)
9. [API Endpoints](#9-api-endpoints)
10. [Frontend Components](#10-frontend-components)
11. [Data Sources & Formats](#11-data-sources--formats)
12. [Performance Optimizations Applied](#12-performance-optimizations-applied)
13. [Bugs Fixed & Lessons Learned](#13-bugs-fixed--lessons-learned)
14. [Current Issues & Limitations](#14-current-issues--limitations)
15. [Next Steps & Roadmap](#15-next-steps--roadmap)
16. [Detailed Workflow: MG Road → Majestic](#16-detailed-workflow-mg-road--majestic)
17. [Pricing Model & Fare Calculation](#17-pricing-model--fare-calculation)
18. [Train Integration Details](#18-train-integration-details)
19. [Search & Geocoding Service](#19-search--geocoding-service)
20. [LLM Agent Integration](#20-llm-agent-integration)
21. [Testing Guide](#21-testing-guide)
22. [n8n Workflow Integration](#22-n8n-workflow-integration)
23. [ML Models & Data Science](#23-ml-models--data-science)
24. [Environment Configuration Details](#24-environment-configuration-details)
25. [Common Errors & Troubleshooting](#25-common-errors--troubleshooting)
26. [Performance Benchmarks](#26-performance-benchmarks)
27. [Future Architecture Considerations](#27-future-architecture-considerations)
28. [Running the Project](#28-running-the-project)

---
**Appendices**
- [Appendix A: Complete File Reference](#appendix-a-complete-file-reference)
- [Appendix B: Glossary](#appendix-b-glossary)
- [Appendix C: All API Endpoints Reference](#appendix-c-all-api-endpoints-reference)
- [Appendix D: Data File Specifications](#appendix-d-data-file-specifications)
- [Appendix E: GTFS Field Reference](#appendix-e-gtfs-field-reference)
- [Appendix F: Change Log](#appendix-f-change-log)
- [Appendix G: Code Snippets — Key Patterns](#appendix-g-code-snippets--key-patterns)

---

## 1. Project Overview

VOYAGER is a multi-modal transit route planning web application for Bengaluru, India. It combines real-time GTFS bus data, metro network data, railway station data, and ride-hailing price estimates to help users plan end-to-end journeys using any combination of:

- **Walking**
- **BMTC City Buses** (Ordinary, AC Vajra, KIA Airport Buses)
- **Namma Metro** (Purple Line, Green Line, interchange stations)
- **Indian Railways** (long-distance routes to Mysuru, Hubballi, Mangaluru, Belagavi, Ballari, etc.)
- **Ride-hailing** (Cab, Auto, Bike — Uber/Ola/Rapido with live LLM-based pricing)
- **Personal Car** (with fuel cost estimation)

The application is built as a two-tier system with a Python/FastAPI backend and a React/TypeScript (Vite) frontend.

---

## 2. Architecture & Tech Stack

### Backend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Web Framework | **FastAPI** (uvicorn) | REST API server on port 8000 |
| Data Loading | **Pandas**, **CSV**, **JSON** | Load transit data at startup |
| GTFS Processing | **Custom Python** | Parse BMTC GTFS ZIP (~1.5M stop_times rows) |
| Geospatial | **geopy.distance** → **custom haversine** | Distance calculations (migrated from geodesic for speed) |
| HTTP Client | **httpx** (async) | OSRM path fetching, LLM API calls |
| LLM Agent | **Custom LLM Agent** | Live pricing, travel recommendations, weather |
| Serialization | **pickle** | GTFS cache (7271 shapes, 5077 stops, 429K time entries) |

### Frontend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | **React 18 + TypeScript** | UI on port 3000 |
| Build Tool | **Vite** | Dev server + bundling |
| Mapping | **Leaflet** (via react-leaflet) | Map display with markers, paths, traffic overlay |
| State | **React Context + useState** | Component-level state management |
| HTTP | **Fetch API** (proxy `/api` → backend) | API calls |

### Data Cache Directory (`data_cache/`)
| File | Contents |
|------|----------|
| `bmtc_gtfs.zip` | Raw GTFS — 9783 stops, 1.5M stop_times rows, 4359 routes, 56732 trips, 7915 shapes |
| `processed/gtfs_cache.pkl` | Pickled GTFS data — 7271 shapes, 5077 stops, 429882 time entries |
| `bmtc_all_stops_master.csv` | 2972 BMTC bus stops with coordinates and route lists |
| `bengaluru_metro_network.csv` | Metro stations with line, sequence, coordinates |
| `karnataka_railway_stations.json` | 50+ railway stations across Karnataka |
| `transit_fares.json` | Fare slabs for BMTC Ordinary, BMTC AC Vajra, Namma Metro |
| `kia_routes_fare_full.json` | KIA airport bus routes with stop-wise fares |
| `rides_data.csv` | Historical ride data for LLM pricing context |

---

## 3. Directory Structure

```
VOYAGER/
├── backend/
│   ├── main.py                    # FastAPI app entry, test-time override
│   ├── requirements.txt
│   ├── api/
│   │   ├── routes.py              # All API endpoints (plan, all-segments, segment-step, etc.)
│   │   └── search.py              # Search endpoint for stops/stations
│   ├── core/
│   │   ├── config.py              # Settings (OSRM URL, paths, fuel prices)
│   │   └── database.py            # TransitDatabase — bus/metro/rail data loader
│   ├── services/
│   │   ├── transit_service.py     # Core routing logic (1957 lines)
│   │   ├── gtfs_service.py        # BMTC GTFS loader & query (522 lines)
│   │   ├── geocoding.py           # Address → coordinates
│   │   ├── n8n_service.py         # n8n workflow integration
│   │   └── images.py              # Image processing
│   ├── agents/
│   │   └── llm_agent.py           # LLM live pricing, recommendations
│   └── models/
│       └── transit.py             # Pydantic request/response models
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── components/
│       │   └── SegmentPanel.tsx    # Multi-column segment UI
│       ├── pages/
│       │   └── MainPage.tsx       # Main page with map + panel
│       ├── services/
│       │   └── api.ts             # API client
│       ├── types/
│       │   └── index.ts           # TypeScript type definitions
│       └── utils/
│           └── helpers.ts         # Mode icons, labels, formatting
├── data_cache/                     # All transit data files
├── docs/
├── scripts/
├── ml/
└── PROMPT.docx

```

---

## 4. Feature 1: Search & Route Planning

### 4.1 Overview
The initial feature (Feature 1) provided a basic A→B route planner that returns a scored list of up to 8 route options combining:
- Bus only (walk→bus→walk)
- Metro only (walk→metro→walk)
- Bus→Metro interchange
- Metro→Bus interchange  
- KIA Airport Bus
- Personal Car (with fuel cost)
- Ride-hailing (Cab, Auto, Bike)

### 4.2 How It Works
1. User enters source and destination (search box or map click)
2. Backend calls `TransitService.get_route_legs_public()`
3. This generates options from five sub-methods:
   - `_generate_bus_routes()` — Finds nearby bus stops at source & dest, computes common routes
   - `_generate_metro_routes()` — Finds nearby metro stations, computes direct metro
   - `_generate_metro_interchange_routes()` — Metro with line change at interchange stations
   - `_generate_kia_routes()` — Airport bus routes (Vayu Vajra)
   - `_generate_multi_modal_routes()` — Bus→Metro and Metro→Bus combinations
4. Each route scores via TOPSIS scoring (`_topsis_score()`) considering:
   - Fare (lower = better)
   - Duration (shorter = better)
   - Walking distance (less = better)
   - Comfort (metro > AC bus > ordinary bus > walk)
5. Weather and night-time adjustments via LLM agent
6. Live pricing overlay from LLM agent

### 4.3 API Endpoint: `POST /api/routes/plan`
```json
{
  "source_lat": 12.9755, "source_lng": 77.6068,
  "dest_lat": 12.9768, "dest_lng": 77.5712,
  "mode": "transit",  // "transit" | "personal" | "walking"
  "group_size": 1,
  "budget": 200,
  "waypoints": []  // For multi-stop routing
}
```
Returns scored routes with legs, paths, fares.

### 4.4 Multi-Waypoint Routing
When `waypoints` is non-empty, the backend:
1. Splits the journey into segments (source→wp1→wp2→...→dest)
2. Plans each segment independently via `get_route_legs_public()`
3. Combines transit and driving options per segment
4. Merges into multi-stop mega-routes via `_combine_multi_stop_routes()`
5. Adds OSRM driving routes for each segment

### 4.5 Scoring System (TOPSIS)
```python
fare_score = max(0, 100 - (fare / 10))         # 25% weight
time_score = max(0, 100 - (duration / 2))       # 30% weight  
walk_score = max(0, 100 - (walk_km * 15))       # 15% weight
comfort_score = comfort_map.get(route_type, 60) # 20% weight

# Comfort values:
#   metro_interchange: 85  metro: 85  bus_ac_vajra: 70
#   kia_bus: 75  bus_ordinary: 50  bus_to_metro: 70
#   metro_to_bus: 65  car: 90  cab: 85  walk: 40
```

---

## 5. Feature 2: Progressive Multi-Column Segment UI

### 5.1 Overview
The Segment Feature (Feature 2) is the major enhancement that breaks down a journey into progressive segments displayed as columns. Instead of returning pre-computed end-to-end routes, it shows the user step-by-step choices:

1. **Column 0**: Direct options from current location to destination (walk, cab, auto, bike)
2. **Column 1**: Nearby transit stops (bus stops, metro stations) with reach options (walk/cab/auto/bike to each stop)
3. **Column 2**: Transit options from the selected stop (buses with GTFS real timings, metro, train)
4. **Column 3**: Next transit from arrival point (metro transfer, connecting bus)
5. **Last Column**: Final mile options from transit arrival (walk/cab/auto/bike to destination)

### 5.2 Data Flow

```
Frontend calls GET /api/routes/all-segments
  ↓
TransitService.get_all_segments() 
  ↓
For segment 0:
  _build_single_segment(source_lat, source_lng, source_name, dest_lat, dest_lng, dest_name)
    ↓
    _add_direct_options()         → direct_options (walk/cab/auto/bike)
    find_nearby_bus_stops()       → nearby bus stops
    find_nearby_metro_stations()  → nearby metro stations (3km)
    find_nearby_railway_stations()→ nearby railway stations (15km)
    ↓
    For each stop (up to 8 bus + 4 metro + 3 metro + 3 railway):
      _add_reach_options()        → walk/cab/auto/bike to this stop
      _add_transit_options()      → buses with GTFS timings, metro to dest, train (long dist)
        ↓
        For each bus route (up to 8):
          GTFS: get_all_routes_at_stop()
          GTFS: get_next_buses_with_times() → real departure times
          GTFS: find_stops_on_route_toward_dest() → actual arrival stop
          GTFS: get_shape_path_for_route() → bus path for map
          Check metro at arrival → next_transit (bus→metro chaining)
          Add final_options (walk/ride from bus arrival to destination)
        For metro: metro to destination metro station
        For train: inter-city train options
  ↓
  Collect transit options that arrive >0.5km from dest → schedule next segments
  ↓
For segments 1, 2, ... (max depth 3):
  _build_single_segment(arrival_point, dest) for each unique arrival point
  Link via next_segment_index
  ↓
Return { source, dest, segments[], total_segments }
```

### 5.3 Frontend Rendering (SegmentPanel.tsx)

The `SegmentPanel` component:
1. Fetches `/api/routes/all-segments` on mount / search submit
2. Displays a column for each segment
3. Each column shows:
   - Direct options (column 0 only): walk/cab/auto/bike cards
   - Destination stops: list of stops with reach options (walk/cab/auto/bike to that stop)
   - Transit options: bus cards (with route number, departure times, fare, AC badge), metro cards, train cards
   - Next transit: chained metro/bus from arrival point
   - Final mile: walk/cab/auto/bike from transit arrival to destination
4. Selecting a transit option can reveal its `final_options` (last-mile) and `next_transit` (connecting transit)
5. Selection triggers map updates with the chosen path

### 5.4 Data Structure (GET /api/routes/all-segments Response)
```json
{
  "status": "success",
  "data": {
    "source": {"lat": 12.9755, "lng": 77.6068, "name": "MG Road"},
    "dest": {"lat": 12.9768, "lng": 77.5712, "name": "Majestic"},
    "segments": [
      {
        "segment_index": 0,
        "from": {"name": "MG Road", "lat": 12.9755, "lng": 77.6068},
        "direct_options": [
          {"mode": "walk", "label": "Walk", "fare": 0, "duration_minutes": 45, 
           "from_lat": 12.9755, "from_lng": 77.6068, "to_lat": 12.9768, "to_lng": 77.5712,
           "path": [[12.9755,77.6068], [12.9768,77.5712]]},
          {"mode": "cab", "label": "Uber Go / Ola Mini", "fare": 75, "duration_minutes": 12, ...}
        ],
        "destinations": [
          {
            "stop": {"name": "MG Road Metro Station", "lat": 12.975458, "lng": 77.606802, "type": "bus"},
            "reach_options": [
              {"mode": "walk", "from": "MG Road", "to": "MG Road Metro Station", 
               "distance_km": 0.02, "duration_minutes": 1, "fare": 0, ...}
            ],
            "transit_options": [
              {
                "mode": "bus_ordinary",
                "route_number": "G-3A",
                "from": "MG Road Metro Station",
                "to": "indian express",
                "distance_km": 1.2,
                "duration_minutes": 15,
                "fare": 6,
                "per_person": 6,
                "from_lat": 12.975458, "from_lng": 77.606802,
                "to_lat": 12.98402, "to_lng": 77.59716,
                "arrives_at_stop": true,
                "bus_times": [
                  {"departure_time": "05:05:33", "route": "G-3A"},
                  {"departure_time": "05:25:33", "route": "G-3A"}
                ],
                "transit_type": "bus",
                "path": [[lat,lng], ...],  // GTFS shape coordinates
                "next_transit": [
                  {"mode": "metro", "from": "Cubbon Park", "to": "Majestic", 
                   "fare": 21, ...}
                ],
                "final_options": [
                  {"mode": "walk", "from": "indian express", "to": "Destination",
                   "distance_km": 2.9, "duration_minutes": 35, "fare": 0}
                ],
                "dropoff_walk_min": 35,
                "dropoff_to_dest_km": 2.9,
                "next_segment_index": 1  // links to segment 1
              },
              {"mode": "bus_ac_vajra", "route_number": "G-3A", ...},
              {"mode": "bus_ordinary", "route_number": "362-C", ...}
            ]
          },
          {
            "stop": {"name": "Mahatma Gandhi Road", "lat": ..., "lng": ..., "type": "metro"},
            "reach_options": [...],
            "transit_options": [
              {"mode": "metro", "route_number": "Purple Line",
               "from": "Mahatma Gandhi Road",
               "to": "Nadaprabhu Kempegowda Station Majestic",
               "distance_km": 3.2, "duration_minutes": 7, "fare": 21,
               "arrives_at_stop": true, "transit_type": "metro",
               "path": [[lat,lng], ...],  // DB metro line path
               "next_transit": [],
               "final_options": [
                 {"mode": "walk", "distance_km": 0.3, "duration_minutes": 4, "fare": 0}
               ]
              }
            ]
          }
        ]
      },
      {
        "segment_index": 1,
        "from": {"name": "indian express", "lat": 12.98402, "lng": 77.59716},
        "direct_options": [...],
        "destinations": [...]
      }
    ],
    "total_segments": 2
  }
}
```

### 5.5 Bus `to` Field Fix

**Problem**: The bus `to` field showed static text like `"G-3A towards destination"` instead of the actual GTFS stop name.

**Root Cause**: `find_stops_on_route_toward_dest()` iterated ALL 5077 stops and filtered by `sdist < from_dist * 0.9`. The source stop itself was often the first match.

**Fix**: 
1. Changed `find_stops_on_route_toward_dest()` to use `_stop_times_by_route` index (O(1) dict lookup) instead of full iteration (O(5077))
2. Added minimum distance check (>200m from source) to skip the source stop itself
3. Now correctly returns downstream stops like `"indian express"`, `"shivajinagara bus station"`, `"kempegowda bus station"` based on actual GTFS route data

### 5.6 Metro Integration

**How metro appears in segments**:
- Metro stations appear in `find_nearby_metro_stations()` results
- Each metro station becomes a destination entry with `type: "metro"`
- `_add_transit_options()` checks `stop["type"] == "metro"` and adds:
  - Metro transit options: metro from this station to destination metro station(s)
  - Bus options: GTFS buses serving this station (for transfer flexibility)
  - Direct rides: cab/auto/bike from station to destination
- Metro options include `path` from `db.get_metro_line_path()` which returns station-to-station rail geometry

### 5.7 Metro Example: MG Road → Majestic

For the MG Road → Majestic journey:
- Destination entry 0: "MG Road Metro Station" (type: bus) → 16 bus options (G-3A, 362-C, etc.)
- Destination entry 8: "Mahatma Gandhi Road" (type: metro) → Metro to "Nadaprabhu Kempegowda Station Majestic" ₹21, 7 min
- Best route: Walk 200m to Mahatma Gandhi Road Metro → Purple Line to Majestic (2 stops, 7 min, ₹21) → Walk 300m to destination

This metro option IS correctly generated. The frontend now has access to both bus AND metro options from nearby transit points.

---

## 6. GTFS Data Pipeline

### 6.1 Overview
The GTFS (General Transit Feed Specification) data for BMTC buses is loaded from `bmtc_gtfs.zip` and provides:
- 9783 unique stop_ids across Bangalore
- 5077 unique stop names (after deduplication)
- 1,500,000+ stop_times rows (departure + arrival times at each stop)
- 4359 routes (bus lines)
- 56732 trips (individual bus journeys)
- 7915 shapes (GPS path geometries)

### 6.2 Loading Process (`gtfs_service.py` → `GTFSLoader.load()`)

```
bmtc_gtfs.zip
  │
  ├── shapes.txt
  │   → _shapes: {shape_id: [(lat,lng,seq), ...]}
  │     Sorted by sequence, stored as [(lat,lng), ...]
  │     7915 unique shape_ids
  │
  ├── stops.txt
  │   → _stops_by_name: {"stop name": (lat, lng, stop_id)}
  │   → _stops_by_name_inv: {stop_id: "stop name"}
  │     5077 unique stop names (lowercased)
  │
  ├── trips.txt
  │   → trip_shape_map: {trip_id: shape_id}
  │   → trip_to_route: {trip_id: route_id}
  │     56732 trips
  │
  ├── routes.txt
  │   → route_id_to_name: {route_id: route_short_name}
  │     4359 routes
  │
  └── stop_times.txt
      → For each row:
        - trip_id → shape_id (via trip_shape_map)
        - shape_id → builds shape_stops index
        - departure_time, stop_id → stop name (via _stops_by_name_inv)
        - trip_id → route_id → route_short_name
        → _stop_times["stop_name"] = [(dep_time, route_short_name), ...] (max 200/stop)
        → _stop_times_by_route["route_short_name"] = [(dep_time, "stop_name"), ...] (max 500/route)
        1,500,000+ rows processed
```

### 6.3 Post-Processing (after stop_times loading)

```
→ _stop_to_shapes: {stop_name: [(shape_id, sequence), ...]}
    For each stop, finds all shapes that pass through it
    Used by get_shape_between_stops() for path extraction

→ _route_shapes: {route_short_name: [shape_id, ...]}
    Maps route short names to their shape geometries
    Used by get_shape_by_route(), get_shape_path_for_route()
    4359 routes mapped
```

### 6.4 GTFS Cache System

**Cache file**: `data_cache/processed/gtfs_cache.pkl`

**Cache contents** (pickled dict):
```python
{
    "shapes": {shape_id: [(lat,lng), ...]},         # 7271 shapes
    "route_shapes": {route: [shape_ids]},            # 4359 routes
    "stop_to_shapes": {stop_name: [(sid,seq), ...]}, # per stop
    "stops_by_name": {name: (lat,lng,sid)},          # 5077 stops
    "stop_times": {name: [(time,route), ...]},       # 429882 entries
    "stop_times_by_route": {route: [(time,name),...]},# per route
    "name_map": {query: resolved_name},              # fuzzy match cache
}
```

**Cache invalidation**: Cache auto-rebuilds if pickle is older than ZIP file.

### 6.5 Key Methods on GTFSLoader

| Method | Purpose | Performance | Complexity |
|--------|---------|-------------|------------|
| `_resolve_name(name)` | Fuzzy-match stop name to GTFS key | Fast (cached) | O(1) after cache |
| `get_next_buses(stop, limit)` | Next N departures for a stop | Fast | O(K) where K=times per stop |
| `get_next_buses_with_times(stop, route, limit)` | Filtered by route | Fast | O(K) |
| `get_all_routes_at_stop(stop)` | All routes serving a stop | Fast | O(K) |
| `get_common_routes(src, dest)` | Routes common to 2 stops | Fast | O(K1+K2) |
| `get_shape_by_route(route)` | Full shape for a route | Fast | O(1) dict lookup |
| `get_shape_between_stops(from, to)` | Path segment between 2 stops | Fast | O(num_shapes) |
| `find_stops_on_route_toward_dest(route, ...)` | Stops en route toward dest | **Fast (fixed!)** | O(R) where R=entries per route |
| `get_shape_path_for_route(route)` | Coords for map display | Fast | O(1) dict lookup |
| `search_stops_by_name(query)` | Fuzzy search stops | Fast | O(N) linear scan |
| `get_route_stops(route, limit)` | Stops on a route | Fast | O(K) |

### 6.6 Fuzzy Name Matching

The `_resolve_name()` method uses a multi-strategy approach:

1. **Exact match** (lowercased): Return immediately
2. **Cached match**: Return from `_name_map`
3. **SequenceMatcher fuzzy** (cutoff 0.55): Best match with substring bonus (0.9)
4. **Normalized exact**: Remove punctuation, compare normalized forms
5. **Word subset**: At least 2 words in common (for multi-word names)
6. **Substring fallback**: If normalized query is in GTFS name or vice versa

This handles cases like:
- `"MG Road Metro Station"` → matches GTFS `"mg road metro station"`
- `"Brigade Road"` → matches GTFS `"brigade road"`
- `"KR Market"` → matches GTFS `"kr market"`

### 6.7 Float Stop Name Protection

**Bug**: GTFS stop names read from CSV could be parsed as floats (e.g., `245.0`) by pandas.

**Fix**: Added `isinstance(stop_name, str)` checks in:
- `_resolve_name()` → returns `None` for non-string
- `_has_gtfs_route()` → returns `False` for non-string
- `_gtfs_buses_at_stop()` → returns `[]` for non-string
- `_add_transit_options()` → converts with `str()` guard
- `database.py` `_load_bus_stops()` → `str(row.get("Stop Name", ""))` fix

---

## 7. Transit Service — Core Logic

### 7.1 Overview
`TransitService` (1957 lines) is the heart of the routing engine. It combines GTFS bus data, metro network, railway data, and fare tables into actionable route options.

### 7.2 Key Methods

#### New Architecture (Segment Feature)
| Method | Line | Purpose |
|--------|------|---------|
| `get_all_segments()` | 1713 | Top-level: generates chained segments from source to dest |
| `_build_single_segment()` | 1617 | Builds one segment: direct + nearby stops + reach + transit |
| `_add_direct_options()` | 1294 | Walk/cab/auto/bike from current location to dest |
| `_add_reach_options()` | 1334 | Walk/cab/auto/bike to a specific transit stop |
| `_add_transit_options()` | 1380 | Main: buses (GTFS), metro, train from a stop |
| `_topsis_score()` | 1790 | Scores a route by fare, time, walk, comfort |

#### Legacy Architecture (Feature 1)
| Method | Line | Purpose |
|--------|------|---------|
| `get_route_legs_public()` | ~200 | Top-level: returns 8 scored routes |
| `_generate_bus_routes()` | ~260 | Walk→bus→walk routes |
| `_generate_metro_routes()` | ~330 | Walk→metro→walk |
| `_generate_metro_interchange_routes()` | ~380 | Metro with line change |
| `_generate_kia_routes()` | ~450 | KIA airport buses |
| `_generate_multi_modal_routes()` | ~510 | Bus→Metro and Metro→Bus |
| `get_mini_path_options()` | ~600 | Lightweight path overview |

#### Utility
| Method | Purpose |
|--------|---------|
| `haversine_distance()` | Distance between 2 coordinates |
| `_is_outside_bengaluru()` | Check if dest is >35km from city center |
| `_find_farthest_bus_stop_toward_dest()` | Used for out-of-city combined bus+cab |
| `_interpolate_path()` | Fallback path when no GTFS shape available |
| `get_osrm_path_between()` | Async OSRM path fetch (with local cache) |
| `_add_leg_paths()` | Enrich route legs with path coordinates |

### 7.3 Transit Option Flow (in `_add_transit_options()`)

```
For each destination stop:
  if stop type is bus or metro:
    gtfs = _ensure_gtfs()
    all_routes = get_all_routes_at_stop(sname)  # All bus routes at this stop
    
    for each route (max 8):
      shape_path = get_shape_path_for_route(rn)    # GTFS shape for map
      route_stops = find_stops_on_route_toward_dest(rn, ...)  # Actual arrival stop
      
      if route_stops found:
        arrival = route_stops[0]  # First stop toward destination
        arrival_name = arrival["stop_name"]  # e.g., "indian express"
      else:
        interpolated arrival toward destination
      
      transit_dist = distance(current_stop, arrival)
      bus_fare = max(6, get_bmtc_ordinary_fare(transit_dist)) * group_size
      
      # Next transit (metro at arrival point)
      if arrival > 2km from dest:
        nearby_metro_at_arrival = find_nearby_metro_stations(arrival_coords, 1.5km)
        for each nearby metro → destination metro:
          add metro as next_transit
      
      # Add transit option
      add bus_ordinary: {mode, route_number, bus_times, path, next_transit, ...}
      add bus_ac_vajra: {mode, route_number, bus_times, path, next_transit, ...}
  
  if stop type is metro:
    for each destination metro station:
      transit_dist = distance(stop, dest_metro)
      if transit_dist > 0.5km:
        metro_fare = get_metro_fare(transit_dist)
        metro_path = get_metro_line_path(stop_name, dest_metro_name)
        add metro: {mode, route_number, path, ...}
  
  if is_long_dist and stop type is railway:
    for each destination rail station:
      train_options = _get_train_options(stop_name, dest_rail_name)
      for each train option:
        duration = arrival_time - departure_time
        add train: {mode, train_number, departure_time, arrival_time, ...}
  
  # FINAL MILE for ALL transit options
  for each transit option:
    fdist = distance(arrival_coords, dest_coords)
    if fdist <= 2km:
      add walk to final_options
    if fdist >= 1km:
      add cab/auto/bike to final_options
```

### 7.4 Smart Distance Filtering

| Distance | Walk | Bike | Auto | Cab/XL |
|----------|------|------|------|--------|
| < 1 km | ✅ | ❌ | ❌ | ❌ |
| 1-2 km | ✅ | ✅ | ❌ | ❌ |
| > 2 km | ✅ | ✅ | ✅ | ✅ |

### 7.5 Out-of-Bengaluru Handling

When destination is >35km from city center:
1. Find the farthest bus stop toward destination
2. Add bus+reach option: BMTC bus to farthest stop, then cab to dest
3. Add train options if railway stations are available
4. Filter nearby stops to only include relevant ones

---

## 8. Database Layer

### 8.1 TransitDatabase (Singleton)

`TransitDatabase` is a singleton class that loads all transit data in memory at startup.

**Initialization** (~1 second total):
1. `_load_transit_fares()` — JSON fare slabs
2. `_load_metro_data()` — CSV metro network → 50+ stations, 2 lines (Purple, Green), interchange stations
3. `_load_bus_stops()` — CSV with 2972 stops, coordinates, routes
4. `_load_kia_routes()` — JSON airport bus routes
5. `_load_railway_stations()` — JSON Karnataka railway stations

**Key Data Structures**:
- `metro_stations`: List of `{name, lat, lng, line, sequence, station_code, is_interchange}`
- `metro_lines`: `{line_name: [stations ordered by sequence]}`
- `bus_stops`: `{stop_id: {stop_id, name, lat, lng, routes: [...]}}`
- `kia_routes`: `{route_id: {route_info, stops: [{stop_name, lat, lng, fare}]}}`
- `railway_stations`: List of `{name, lat, lng}`
- `_metro_distance_cache`: Cached distances between station pairs

### 8.2 Key Query Methods

| Method | Purpose | Performance |
|--------|---------|-------------|
| `find_nearby_bus_stops(lat, lng, radius)` | Bus stops within radius | **3.7ms** (fixed: was 374ms) |
| `find_nearby_metro_stations(lat, lng, radius)` | Metro stations within radius | ~1ms (small dataset) |
| `find_nearby_railway_stations(lat, lng, radius)` | Railway stations within radius | ~1ms (small dataset) |
| `get_metro_fare(distance)` | Metro fare by distance | O(1) slab lookup |
| `get_bmtc_ordinary_fare(distance)` | Bus fare by distance | O(1) slab lookup |
| `get_bmtc_ac_fare(distance)` | AC bus fare by distance | O(1) slab lookup |
| `get_metro_line_path(from, to)` | Station-to-station path | O(N) station scan |
| `get_metro_distance_between(a, b)` | Distance between metro stations | O(1) cached or O(N) |

### 8.3 Performance: geodesic → haversine Migration

**Problem**: `find_nearby_bus_stops()` used `geodesic()` (geopy) which took 374ms per call (2972 stops × geodesic computation).

**Fix**: Replaced with `_haversine()` — a pure math implementation:
```python
def _haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = (lat2 - lat1) * math.pi / 180
    dlng = (lng2 - lng1) * math.pi / 180
    a = math.sin(dlat/2)**2 + math.cos(lat1*math.pi/180) * math.cos(lat2*math.pi/180) * math.sin(dlng/2)**2
    return 2 * R * math.asin(math.sqrt(a))
```

**Result**: 374ms → 3.7ms per call (**100x improvement**). This changed `get_all_segments()` from 156s to 15s.

All `geodesic` calls in `database.py` were replaced:
- `find_nearby_bus_stops()`
- `find_nearby_metro_stations()`
- `find_nearby_railway_stations()`
- `get_metro_distance_between()` (fallback)
- Metro line building

---

## 9. API Endpoints

### 9.1 Route Planning

| Endpoint | Method | Purpose | 
|----------|--------|---------|
| `/api/routes/plan` | POST | Full route planning with multi-modal options |
| `/api/routes/all-segments` | GET | Progressive segment data (Feature 2) |
| `/api/routes/segment-step` | GET | Single-step segment options (legacy) |
| `/api/routes/mini-path-options` | GET | Quick path overview |

### 9.2 Transit Data

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/routes/metro-stations` | GET | Metro stations (optionally filtered by line) |
| `/api/routes/bus-stops` | GET | Bus stops (optionally filtered by location) |
| `/api/routes/kia-routes` | GET | KIA airport bus routes |
| `/api/routes/transit-fares` | GET | Fare slab data |

### 9.3 Live Data

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/routes/live-prices` | GET | LLM-based ride pricing |
| `/api/routes/news` | GET | Travel news / advisories |
| `/api/routes/traffic-overlay` | GET | Traffic congestion GeoJSON |

### 9.4 Search

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search/places` | GET | Search for locations, stops, stations |

### 9.5 Endpoint Details

#### GET `/api/routes/all-segments`
```
Parameters:
  from_lat, from_lng  (required)  — source coordinates
  from_name           (optional)  — source name (default: "Your Location")
  dest_lat, dest_lng  (required)  — destination coordinates
  dest_name           (optional)  — destination name (default: "Destination")
  group_size          (optional)  — group size (default: 1)
  budget              (optional)  — max fare per person
  max_depth           (optional)  — max segment chain depth (default: 3)

Response:
  { status: "success", data: { source, dest, segments[], total_segments } }

Performance:
  - Cold GTFS load: ~0.6s (from cache)
  - Segment building: ~15s for MG Road→Majestic (26 segments)
  - OSRM path fetching: async with 20s timeout
  - Total API response: ~20-35s
```

#### OSRM Path Integration

The `/all-segments` endpoint asynchronously fetches OSRM driving paths for:
- Direct cab/auto/bike options
- Reach options (cab/auto/bike to stop)
- Metro/train transit options (walking profile)
- Final mile cab/auto/bike options

**OSRM Configuration**:
- URL: `https://router.project-osrm.org`
- Client timeout: 3 seconds per request
- Semaphore: 15 concurrent requests
- Gather timeout: 20 seconds total
- Fallback: Interpolated straight-line path on failure

---

## 10. Frontend Components

### 10.1 MainPage.tsx
- Map with Leaflet
- Search bar for source/destination
- GPS tracking ("Start Journey" button)
- Custom waypoint management
- Resizes map when panel opens/closes

### 10.2 SegmentPanel.tsx
- Multi-column progressive layout
- Columns expand from 1 to N as user selects options
- Each column shows:
  - Direct transport cards (walk/cab/auto/bike)
  - Transit stop cards with reach options
  - Bus cards with route number, departure times, AC badge
  - Metro/train cards
  - Final mile cards
- Selection triggers map path highlight

### 10.3 helpers.ts
- Mode icons mapping
- Label formatters
- Duration/distance formatting

### 10.4 TypeScript Types (`types/index.ts`)
```typescript
interface SegmentData {
  segment_index: number;
  from: { name: string; lat: number; lng: number };
  direct_options: Option[];
  destinations: Destination[];
}

interface Destination {
  stop: { name: string; lat: number; lng: number; type: string };
  reach_options: Option[];
  transit_options: TransitOption[];
}

interface TransitOption {
  mode: string;
  route_number?: string;
  bus_times?: { departure_time: string; route: string }[];
  next_transit?: TransitOption[];
  final_options?: Option[];
  // position, fare, duration, path...
}

interface Option {
  mode: string;
  fare: number;
  duration_minutes: number;
  path?: number[][];
  // position, label...
}
```

---

## 11. Data Sources & Formats

### 11.1 BMTC GTFS (`bmtc_gtfs.zip`)
- **Source**: BMTC Bangalore (official GTFS feed)
- **Files**: shapes.txt, stops.txt, trips.txt, routes.txt, stop_times.txt
- **Size**: ~1.5M stop_times rows
- **Processing**: Full load (no row limit), per-stop cap 200, per-route cap 500

### 11.2 BMTC Stop Master (`bmtc_all_stops_master.csv`)
- **Columns**: Stop Name, Latitude, Longitude, Routes with num trips (JSON dict)
- **Records**: 2972 stops
- **Usage**: Initial stop lookup, route planning
- **Note**: Stop names may be floats (!) — fixed with `str()` conversion

### 11.3 Metro Network (`bengaluru_metro_network.csv`)
- **Columns**: Station_Name, Line, Sequence, Latitude, Longitude, Station_Code, Is_Interchange
- **Lines**: Purple (12 stations), Green (14+ stations)
- **Interchanges**: Nadaprabhu Kempegowda Station (Majestic)

### 11.4 Railway Stations (`karnataka_railway_stations.json`)
- **Format**: `[{name, lat, lng}, ...]`
- **Stations**: 50+ across Karnataka (KSR Bengaluru, Mysuru, Hubballi, Mangaluru, etc.)

### 11.5 Transit Fares (`transit_fares.json`)
- **Slabs**: BMTC Ordinary (up to 32km), BMTC AC Vajra, Namma Metro
- **Format**: `[{min_km, max_km, fare, ...}]`

### 11.6 KIA Routes (`kia_routes_fare_full.json`)
- **Routes**: Vayu Vajra airport bus services
- **Structure**: `{vayu_vajra_kia_routes: {route_id: {route_info, stops: [{stop_name, lat, lng, fare}]}}}`

---

## 12. Performance Optimizations Applied

### 12.1 `geodesic` → `_haversine`
- **Before**: `find_nearby_bus_stops()` — 374ms per call
- **After**: 3.7ms per call (**100x faster**)
- **Impact**: `get_all_segments()` total time reduced from 156s → 15s

### 12.2 `find_stops_on_route_toward_dest` Index Usage
- **Before**: Full `_stop_times` iteration (5077 stops, each with any() check on route list)
- **After**: `_stop_times_by_route` dict lookup (O(1) → O(R) where R ≤ 500 entries/route)
- **Impact**: Individual call from ~5ms → ~0.001ms

### 12.3 OSRM Gather Timeout
- **Before**: `asyncio.gather()` with no timeout → could hang indefinitely
- **After**: `asyncio.wait_for(gather(), timeout=20.0)` with try/except
- **Impact**: API won't hang if OSRM is slow

### 12.4 GTFS Cache
- **Before**: Full GTFS parse every startup (~41 seconds)
- **After**: Pickled cache (~0.6s load time)
- **Cache invalidation**: Auto-rebuild if ZIP newer than pickle

### 12.5 GTFS Name Resolution Cache
- First fuzzy match per stop name caches result in `_name_map`
- Subsequent lookups for same name are O(1) dict access

### 12.6 Segment Generation Limits
- Max 8 bus stops per segment
- Max 4 metro stations per segment  
- Max 8 transit options per stop
- Max segment depth: 3
- Max 500 entries per route in `_stop_times_by_route`

---

## 13. Bugs Fixed & Lessons Learned

### 13.1 `station_to_dest_dist` UnboundLocalError
**Symptom**: 500 error on `/all-segments` endpoint  
**Root Cause**: Variable `station_to_dest_dist` used in metro→bus loop before it was calculated  
**Fix**: Moved `station_to_dest_dist = _safe(...)` before the metro bus loop  
**File**: `transit_service.py` line ~1149 → moved to ~1110

### 13.2 Float Stop Names (Multiple Locations)
**Symptom**: `AttributeError: 'float' object has no attribute 'lower'`  
**Root Cause**: Pandas CSV parser converts cells with numeric-looking values to floats  
**Locations**:
- `database.py` `_load_bus_stops()`: `row.get("Stop Name", "")` → `str(row.get("Stop Name", ""))`
- `gtfs_service.py` `_resolve_name()`: Check `isinstance(name, str)`
- `transit_service.py` `_has_gtfs_route()`: Check `isinstance(stop_name, str)`
- `transit_service.py` `_gtfs_buses_at_stop()`: Check `isinstance(stop_name, str)`
- `transit_service.py` `_add_transit_options()`: Convert with `str()`

### 13.3 Wrong GTFS Cache Path
**Symptom**: GTFS cache not found, always re-parses ZIP  
**Root Cause**: Cache path was `processed/gtfs_cache.pkl` but should be `data_cache/processed/gtfs_cache.pkl`  
**Fix**: Updated path in `gtfs_service.py` → `os.path.join(settings.PROCESSED_DIR, "gtfs_cache.pkl")`

### 13.4 Stale GTFS Cache
**Symptom**: Only 1274 stops, 16699 rows, 0 routes, Yelahanka Old Town had 1 route  
**Root Cause**: Old cache from earlier version with 100K row limit  
**Fix**: Deleted old cache `data_cache/processed/gtfs_cache.pkl`, triggered full reload

### 13.5 `stop_times` Empty After Reload  
**Symptom**: `_stop_times_by_route` empty despite successful cache load  
**Root Cause**: Route id → short_name mapping missing some routes, rsn defaults to numeric route_id  
**Fix**: Rebuilt cache with correct routes.txt parsing

### 13.6 `ast.literal_eval()` route parsing
**Symptom**: `json.loads()` failing on CSV route dicts with single-quoted keys  
**Root Cause**: Route column format is Python dict literal (`{'key': 'value'}`), not JSON  
**Fix**: Use `ast.literal_eval()` instead of `json.loads()`  
**File**: `database.py` `_load_bus_stops()`

### 13.7 Route-Shape Building
**Symptom**: `_route_shapes` empty for many routes  
**Root Cause**: Old code parsed `trip_id` for route info; new code uses `trip_to_route` dict  
**Fix**: Use `trip_to_route[trip_id] → route_id → route_id_to_name[route_id] → short_name`

### 13.8 `find_stops_on_route_toward_dest` Filter Too Strict
**Symptom**: Bus `to` field showed source stop itself or generic "towards destination"  
**Root Cause**: `sdist < from_dist * 0.9` filtered out legitimate downstream stops  
**Fix**: Added `elif` clause to include stops >200m from source (measured by haversine)  
**Result**: Now correctly shows "indian express", "shivajinagara bus station", etc.

---

## 14. Current Issues & Limitations

### 14.1 Performance
- `get_all_segments()` takes ~15s for MG Road→Majestic (26 segments)
- Each segment rebuilds nearby stops, transit options from scratch
- No caching between related segments
- 15s is better than 156s but still slow for interactive use

### 14.2 OSRM Dependency
- OSRM path fetching depends on external service (router.project-osrm.org)
- Can be slow or unavailable
- Timeout is set to 20s for the gather, 3s per request

### 14.3 GTFS Data Completeness
- Only 5077 unique stop names indexed (some GTFS stops may be missed)
- Per-stop limit of 200 entries means later departures may be missing
- Per-route limit of 500 entries caps route stop diversity

### 14.4 Fuzzy Matching
- Cutoff of 0.55 may still miss some stops
- `SequenceMatcher` doesn't handle abbreviations well
- Some GTFS names are truncated (e.g., "st josephs indian school/" with trailing slash)

### 14.5 Metro Integration
- Metro is shown as a separate destination entry (type: "metro")
- Bus→metro chaining via `next_transit` is implemented but not fully tested
- Metro line paths are simple station-to-station sequences, not actual track geometry

### 14.6 Frontend
- SegmentPanel doesn't auto-fetch on new search
- Same options showing due to stale state/cached responses
- No loading states for long API calls
- Error handling for timeouts not implemented

### 14.7 General
- No unit tests for routing logic
- No integration tests for API endpoints
- Test time override (`VOYAGER_TEST_TIME`) needed for consistent GTFS departure testing
- LLM live pricing endpoint may fail silently (8s timeout)

---

## 15. Next Steps & Roadmap

### P0 — Critical (Blocking)
1. **Fix OSRM hanging**: Already done (20s timeout) — test end-to-end 
2. **Verify `/all-segments` completes**: Ensure all crashes fixed with 26-segment response
3. **Assure frontend re-fetches on new search**: Debug SegmentPanel fetch trigger logic

### P1 — High Priority
4. **Add test time override to frontend**: Configurable test mode with frozen time
5. **Metro→bus→walk chain for short hops**: Show metro as primary transit from metro stations
6. **Bus arrival statistics**: "Next 3 buses" instead of just first departure
7. **Duplicate segment consolidation**: Deduplicate nearby arrival points in `get_all_segments()`

### P2 — Medium Priority
8. **GTFS real-time updates**: Periodic refresh of GTFS data without server restart
9. **Segment-level caching**: Cache `_build_single_segment` results for repeated arrival points
10. **Better fuzzy matching**: Add Levenshtein distance for abbreviation handling
11. **HTML entity decoding**: GTFS names like `&amp;` → `&`
12. **Parallel segment building**: Use `asyncio.gather()` for segments 1-N

### P3 — Enhancement
13. **Historical traffic data**: Incorporate time-of-day traffic patterns into duration estimates
14. **Personalized preferences**: Save user preferences (prefer AC bus, avoid walking >500m, etc.)
15. **Multi-language support**: Kannada + English UI
16. **Offline mode**: Pre-download GTFS data for offline route planning
17. **Booking integration**: Link to Uber/Ola/Namma Metro booking
18. **Accessibility mode**: Wheelchair-accessible routes only
19. **Crowd-sourced updates**: User-reported bus delays, road closures

### Detailed Segment Feature Improvements

#### 20. Segment-to-Segment Transitions
- **Current**: `next_segment_index` links segments, but frontend doesn't auto-navigate
- **Goal**: When user selects a transit option in segment 0 with `next_segment_index: 1`, auto-expand column 1 with segment 1 data
- **Implementation**: Frontend reads `next_segment_index` from selected transit option, scrolls to column for that segment index

#### 21. Combined Route Scoring
- **Current**: Each segment is independent; no cross-segment optimization
- **Goal**: Score full journey paths (segment 0 option → segment 1 option → ...) with TOPSIS
- **Implementation**: After all segments loaded, enumerate all path combinations, apply TOPSIS, show top combinations

#### 22. Waypoint Integration in Segments
- **Current**: Custom waypoints trigger fresh `get_all_segments()` call
- **Goal**: Show waypoints as intermediate columns in the same segment flow
- **Implementation**: Process waypoints as pinned segment transitions

#### 23. Bus Route Details Popup
- **Current**: Just route number and next departure time
- **Goal**: Full route map, frequency chart, stops list, fare stage details
- **Implementation**: New endpoint `GET /api/routes/bus-route/{route_number}/details`

#### 24. Price Comparison View
- **Current**: Each transport option shows its own fare
- **Goal**: Side-by-side comparison of all options from a given point
- **Implementation**: "Compare" button that opens a modal with all options for that segment

---

## 16. Detailed Workflow: MG Road → Majestic

### Step-by-step API Call

#### Input
```
GET /api/routes/all-segments
  ?from_lat=12.9755&from_lng=77.6068
  &from_name=MG+Road
  &dest_lat=12.9768&dest_lng=77.5712
  &dest_name=Majestic
  &group_size=1&budget=200&max_depth=3
```

#### Backend Processing

**Segment 0 (from MG Road)**:

1. `_add_direct_options()`:
   - Walk (3.5km, 42min, ₹0)
   - Cab (3.5km, 8min, ₹75)
   - Auto (3.5km, 15min, ₹55)
   - Bike (3.5km, 6min, ₹30)

2. `find_nearby_bus_stops(12.9755, 77.6068, 2.0)` → 10+ stops within 2km:
   - MG Road Metro Station (0.02km)
   - Maniksha Parade Ground (0.3km)
   - Mayohall (0.5km)
   - Brigade Road (0.6km)
   - MG Statue (0.7km)
   - Commercial Street (0.8km)
   - ... more stops ...

3. `find_nearby_metro_stations(12.9755, 77.6068, 3.0)`:
   - Mahatma Gandhi Road (MG Road) Metro — 0.2km (Purple Line, sequence 9)
   - Trinity — 0.8km (Purple Line, sequence 10)
   - Cubbon Park — 1.2km (Purple Line, sequence 8)
   - Dr B R Ambedkar Station Vidhana Soudha — 1.5km (Purple Line, sequence 7)

4. For **MG Road Metro Station** (type: bus):
   - Reach: Walk 0.02km
   - Transit: 16 bus options
     - G-3A → indian express (1.2km, ₹6, next departures: 05:05, 05:25, 05:35)
     - 362-C → indian express (₹6, departures: 05:31, 06:26, 07:02)
     - 144 → vidhana soudha (₹6, departures: 05:41, 06:55, 09:11)
     - ... 13 more routes ...
   - Each bus includes `path` (GTFS shape), `bus_times`, `next_transit`, `final_options`

5. For **Mahatma Gandhi Road** (type: metro):
   - Reach: Walk 0.2km
   - Transit: Metro to Nadaprabhu Kempegowda Station Majestic (3.2km, ₹21, 7min)
   - Also: Metro to other Purple Line stations

6. For **Trinity** (type: metro):
   - Reach: Walk 0.8km or Bike 0.8km
   - Transit: Metro to Majestic (2.7km, ₹32, 5min)

7. **Final mile** added to ALL transit options:
   - Walk ≤ 2km
   - Cab/Auto/Bike ≥ 1km

**Segment Generation for Next Level**:
- Transit options arriving >0.5km from Majestic create next segments:
  - "indian express" (2.9km from dest) → Segment 1
  - "shivajinagara bus station" (3.6km from dest) → Segment 1
  - "shoolay circle brigade road" (4.1km from dest) → Segment 1
  - ... up to 25 unique arrival points → 25 additional segments

**Total**: 26 segments, 12 destinations in segment 0, average ~14 transit options per stop

---

## 17. Pricing Model & Fare Calculation

### 17.1 BMTC Ordinary Bus
```python
slabs = [
    {"min_km": 0, "max_km": 2, "fare": 6},
    {"min_km": 2, "max_km": 5, "fare": 12},
    {"min_km": 5, "max_km": 10, "fare": 16},
    {"min_km": 10, "max_km": 20, "fare": 22},
    {"min_km": 20, "max_km": 30, "fare": 28},
    {"min_km": 30, "max_km": 40, "fare": 32},
]
result = max(6, round(get_bmtc_ordinary_fare(distance_km))) * group_size
```

### 17.2 BMTC AC Vajra
```python
slabs = [
    {"min_km": 0, "max_km": 5, "adult_fare": 15, "child_fare": 8},
    {"min_km": 5, "max_km": 10, "adult_fare": 20, "child_fare": 10},
    {"min_km": 10, "max_km": 20, "adult_fare": 35, "child_fare": 18},
    {"min_km": 20, "max_km": 40, "adult_fare": 45, "child_fare": 23},
]
result = max(10, round(get_bmtc_ac_fare(distance_km))) * group_size
```

### 17.3 Namma Metro
```python
slabs = [
    {"min_km": 0, "max_km": 2, "fare": 11},
    {"min_km": 2, "max_km": 4, "fare": 16},
    {"min_km": 4, "max_km": 6, "fare": 21},
    {"min_km": 6, "max_km": 8, "fare": 26},
    {"min_km": 8, "max_km": 10, "fare": 32},
    {"min_km": 10, "max_km": 15, "fare": 38},
    {"min_km": 15, "max_km": 20, "fare": 45},
]
result = round(get_metro_fare(distance_km)) * group_size
```

### 17.4 Ride-Hailing (Estimated)
```python
rates = {
    "cab":       base=25,  per_km=14,  time_per_km=3,  capacity=4
    "cab_xl":    base=40,  per_km=20,  time_per_km=3,  capacity=6
    "auto":      base=15,  per_km=10,  time_per_km=5,  capacity=3
    "bike":      base=10,  per_km=6,   time_per_km=2,  capacity=1
    "cab_women": base=25,  per_km=14,  time_per_km=3,  capacity=4
    "cab_pet":   base=30,  per_km=17,  time_per_km=3,  capacity=4
}
```

### 17.5 LLM Live Pricing
The LLM agent (`llm_agent.get_live_prices()`) generates realistic Uber/Ola/Rapido prices with:
- Provider name (Uber Go, Ola Mini, Rapido, etc.)
- Estimated fare
- ETA in minutes
- Applied on top of estimated prices when available

### 17.6 Train
```
Fare per person = max(15, round(distance_km * 0.8))
```
Generic unreserved/second-class estimate for long-distance trains.

### 17.7 Personal Car
```
fuel_cost = (distance_km / 15) * 104  # 15 kmpl, ₹104/liter
```

---

## 18. Train Integration Details

### 18.1 Hardcoded Routes (`_TRAIN_DATA`)
| From | To | Trains |
|------|----|--------|
| Bengaluru | Mysuru | 5 trains (Kannada Exp, 2x Shatabdi, Gol Gumbaz, Mysuru Exp) |
| Mysuru | Bengaluru | 5 trains |
| Bengaluru | Hubballi | 2 trains (Vishwamanava, Rani Chennamma) |
| Hubballi | Bengaluru | 2 trains |
| Bengaluru | Mangaluru | 2 trains (Kannur Exp, Mokashi) |
| Mangaluru | Bengaluru | 2 trains |
| Bengaluru | Belagavi | 1 train (Basava Exp) |
| Belagavi | Bengaluru | 1 train |
| Bengaluru | Ballari | 1 train |
| Ballari | Bengaluru | 1 train |

### 18.2 Name Normalization
`_get_train_options()` normalizes station names using a `name_map` that handles 15+ variants:
```
"ksr bengaluru" → "bengaluru"
"mysuru junction" → "mysuru"
"hubli" → "hubballi"
"mangalore" → "mangaluru"
"belgaum" → "belagavi"
"bellary" → "ballari"
"gulbarga" → "kalaburagi"
"bijapur" → "vijayapura"
"hospet" → "hosapete"
"shimoga" → "shivamogga"
```

### 18.3 Generic Train Generation
For unknown origin-destination pairs, generates a synthetic train option:
- Train number: `1` + random 4-digit
- Name: `"Intercity Express (City1 - City2)"`
- Duration: `max(1, round(dist / 50))` hours
- Departure/arrival times based on hash

---

## 19. Search & Geocoding Service

### 19.1 Overview
The search functionality allows users to find locations, bus stops, metro stations, and railway stations by name. It is implemented across two layers:

- **Backend**: `backend/api/search.py` — REST endpoints for place search
- **Backend**: `backend/services/geocoding.py` — Address-to-coordinates conversion
- **Frontend**: Search bar in `MainPage.tsx` with autocomplete dropdown

### 19.2 Search Flow
1. User types a query in the search box (minimum 2-3 characters)
2. Frontend sends `GET /api/search/places?q=<query>` 
3. Backend searches multiple data sources:
   - Metro stations (name match via `find_metro_station()`)
   - Bus stops (name match via `find_bus_stops()`)
   - Railway stations (from JSON data)
   - Bangalore wards/landmarks (from ward data)
   - Geocoding service (address → coordinates fallback)
4. Results are merged, deduplicated, and returned sorted by relevance
5. Frontend displays results in a dropdown with location markers on map

### 19.3 Geocoding
The `geocoding.py` service converts textual addresses to coordinates:
- Uses a local dataset of Bangalore landmarks and areas
- Falls back to the LLM agent for ambiguous queries
- Caches recent lookups to avoid repeated resolution

### 19.4 Ward Data Integration
Bangalore ward boundaries and monthly aggregated data:
- `bangalore-wards-2018-1-All-MonthlyAggregate.csv` through `...4-...`
- Used for demographic context and area-based recommendations
- Not yet fully integrated into routing decisions

---

## 20. LLM Agent Integration

### 20.1 Overview
The LLM agent (`backend/agents/llm_agent.py`) provides intelligent features through a Large Language Model:

### 20.2 Features

#### Live Pricing
```python
async def get_live_prices(source: str, destination: str, mode: str = "cab"):
    """Returns realistic Uber/Ola/Rapido prices using LLM knowledge.
    Timeout: 8 seconds."""
    # Returns list of {mode, provider, price, eta_minutes}
```

**How it works**:
1. Called by `/all-segments` and `/plan` endpoints
2. LLM generates prices based on known Bengaluru ride-hailing rates
3. Prices overlaid on direct + reach options in the segment UI
4. Each price includes: provider name, fare, estimated arrival time

#### Travel Recommendations
```python
async def get_travel_recs(source: str, destination: str, group_size: int, budget: float):
    """Travel tips, best times, alternative routes."""
```

#### Weather Impact
```python
async def get_weather_impact():
    """Current weather conditions affecting travel."""
    # Returns condition string, rain status, visibility
```

#### Travel News
```python
async def get_travel_news(source: str = None, destination: str = None):
    """Recent travel advisories, road closures, events."""
```

### 20.3 Scoring Adjustments from LLM

| Condition | Effect |
|-----------|--------|
| Rainy weather | Walk/bike routes penalized (-20), car/cab boosted (+5) |
| Night time (6PM-6AM) | Bus routes penalized (-8), car/cab boosted (+8) |
| Group ≥ 4 | Car/cab/AC bus boosted (+10) |

### 20.4 Configuration
The LLM agent is configured through environment variables and `config.py`:
- API endpoint for the language model
- Timeout settings (default: 8s for prices, 5s for weather)
- Retry logic for transient failures

---

## 21. Testing Guide

### 21.1 Environment Setup
```powershell
# Set test time for reproducible GTFS results
$env:VOYAGER_TEST_TIME="2024-07-15 12:00:00"

# Or clear it to use real time
Remove-Item Env:VOYAGER_TEST_TIME
```

### 21.2 Quick Sanity Test
```python
"""test_quick.py — Run this first after any change"""
import sys, os
sys.path.insert(0, r'C:\Users\len\OneDrive\Desktop\VOYAGER')
os.environ['VOYAGER_TEST_TIME'] = '2024-07-15 12:00:00'

from backend.core.database import db
db.initialize()

from backend.services.transit_service import _ensure_gtfs, TransitService
_ensure_gtfs()

ts = TransitService()

# Test 1: Basic segment
seg = ts._build_single_segment(12.9755, 77.6068, 'MG Road',
                                12.9768, 77.5712, 'Majestic', 1, 200, 0)
assert len(seg.get('destinations', [])) >= 5, "Should have at least 5 destinations"
assert len(seg.get('direct_options', [])) >= 3, "Should have direct options"
print("✓ Basic segment OK")

# Test 2: Metro options present
metro_dests = [d for d in seg.get('destinations', []) if d['stop']['type'] == 'metro']
assert len(metro_dests) >= 1, "Should have at least 1 metro destination"
for md in metro_dests:
    metro_opts = [t for t in md.get('transit_options', []) if t.get('mode') == 'metro']
    assert len(metro_opts) >= 1, f"Metro dest {md['stop']['name']} should have metro options"
print("✓ Metro options OK")

# Test 3: Bus options with actual stop names
bus_dests = [d for d in seg.get('destinations', []) if d['stop']['type'] == 'bus']
for bd in bus_dests[:2]:
    for topt in bd.get('transit_options', [:2]):
        to = str(topt.get('to', ''))
        assert 'towards destination' not in to, f"Bus to should not be generic: {to}"
print("✓ Bus to fields OK")

print("All tests passed!")
```

### 21.3 Full Segment Chain Test
```python
"""test_full.py — Test the complete segment chain"""
import sys, os, time
sys.path.insert(0, r'C:\Users\len\OneDrive\Desktop\VOYAGER')
os.environ['VOYAGER_TEST_TIME'] = '2024-07-15 12:00:00'

from backend.core.database import db
db.initialize()
from backend.services.transit_service import _ensure_gtfs, TransitService
_ensure_gtfs()

ts = TransitService()
t0 = time.time()

result = ts.get_all_segments(
    12.9755, 77.6068, 'MG Road',
    12.9768, 77.5712, 'Majestic',
    1, 200, 3
)

elapsed = time.time() - t0
print(f"Completed in {elapsed:.1f}s")
print(f"Total segments: {result['total_segments']}")

# Validate structure
assert 'segments' in result
assert result['total_segments'] > 0

# Validate segment 0 has all required keys
seg0 = result['segments'][0]
assert 'direct_options' in seg0
assert 'destinations' in seg0
assert len(seg0['direct_options']) > 0
assert len(seg0['destinations']) > 0

# Validate transit options have bus_times
for dest in seg0['destinations']:
    for topt in dest.get('transit_options', []):
        if topt.get('mode') in ('bus_ordinary', 'bus_ac_vajra'):
            assert 'bus_times' in topt, "Bus options must have bus_times"
            assert 'next_transit' in topt, "Bus options must have next_transit"
            assert 'final_options' in topt, "Bus options must have final_options"

# Validate metro transit options
for dest in seg0['destinations']:
    if dest['stop']['type'] == 'metro':
        for topt in dest.get('transit_options', []):
            if topt.get('mode') == 'metro':
                assert 'path' in topt, "Metro options must have path"
                assert topt.get('arrives_at_stop'), "Metro arrives at stop"

print("All structure validations passed!")
print(f"Performance: {elapsed:.1f}s (target: <30s)")
```

### 21.4 Database Performance Test
```python
"""test_db_perf.py"""
from backend.core.database import db
db.initialize()
import time

# Test bus stop lookup speed
t0 = time.time()
for _ in range(100):
    nearby = db.find_nearby_bus_stops(12.9755, 77.6068, 2.0)
t1 = time.time()
per_call = (t1 - t0) / 100 * 1000
assert per_call < 10, f"find_nearby_bus_stops too slow: {per_call:.1f}ms"
print(f"find_nearby_bus_stops: {per_call:.1f}ms per call ✓")

# Test metro lookup
t0 = time.time()
for _ in range(100):
    nearby = db.find_nearby_metro_stations(12.9755, 77.6068, 2.0)
t1 = time.time()
per_call = (t1 - t0) / 100 * 1000
print(f"find_nearby_metro_stations: {per_call:.1f}ms per call ✓")

# Test railway lookup
t0 = time.time()
for _ in range(100):
    nearby = db.find_nearby_railway_stations(12.9755, 77.6068, 30.0)
t1 = time.time()
per_call = (t1 - t0) / 100 * 1000
print(f"find_nearby_railway_stations: {per_call:.1f}ms per call ✓")
```

### 21.5 GTFS Performance Test
```python
"""test_gtfs_perf.py"""
from backend.services.gtfs_service import gtfs_loader
gtfs_loader.load()
import time

# Test stop resolution speed
t0 = time.time()
for _ in range(1000):
    gtfs_loader.resolve_name('MG Road Metro Station')
t1 = time.time()
print(f"resolve_name: {(t1-t0)/1000*1000:.3f}ms per call ✓")

# Test get_all_routes_at_stop
t0 = time.time()
for _ in range(100):
    routes = gtfs_loader.get_all_routes_at_stop('MG Road Metro Station')
t1 = time.time()
print(f"get_all_routes_at_stop: {(t1-t0)/100*1000:.2f}ms per call ({len(routes)} routes)")

# Test find_stops_on_route_toward_dest
t0 = time.time()
for _ in range(100):
    stops = gtfs_loader.find_stops_on_route_toward_dest(
        'G-3A', 12.9755, 77.6068, 12.9768, 77.5712)
t1 = time.time()
print(f"find_stops_on_route_toward_dest: {(t1-t0)/100*1000:.3f}ms per call ✓")

# Test get_shape_path_for_route
t0 = time.time()
for _ in range(100):
    shape = gtfs_loader.get_shape_path_for_route('G-3A')
t1 = time.time()
print(f"get_shape_path_for_route: {(t1-t0)/100*1000:.3f}ms per call ✓")
```

### 21.6 API Integration Test (requires running server)
```powershell
# Test with curl
curl "http://localhost:8000/api/routes/all-segments?from_lat=12.9755&from_lng=77.6068&from_name=MG%20Road&dest_lat=12.9768&dest_lng=77.5712&dest_name=Majestic&group_size=1&budget=200&max_depth=3"

# Test metro stations
curl "http://localhost:8000/api/routes/metro-stations"

# Test bus stops
curl "http://localhost:8000/api/routes/bus-stops"

# Test segment-step
curl "http://localhost:8000/api/routes/segment-step?from_lat=12.9755&from_lng=77.6068&from_name=MG%20Road&dest_lat=12.9768&dest_lng=77.5712&dest_name=Majestic&group_size=1&budget=200"
```

### 19.2 Individual Segment Test
```python
from backend.core.database import db
db.initialize()
from backend.services.transit_service import _ensure_gtfs, TransitService
_ensure_gtfs()

ts = TransitService()
seg = ts._build_single_segment(12.9755, 77.6068, 'MG Road', 
                                12.9768, 77.5712, 'Majestic', 1, 200, 0)
print(len(seg["destinations"]))
print(len(seg["direct_options"]))
for dest in seg["destinations"][:3]:
    print(dest["stop"]["name"], len(dest["transit_options"]))
```

### 19.3 All Segments Test
```python
result = ts.get_all_segments(12.9755, 77.6068, 'MG Road',
                             12.9768, 77.5712, 'Majestic', 1, 200, 3)
print(result["total_segments"])
```

### 19.4 Watch Performance
```python
import time
t0 = time.time()
# ... run test ...
t1 = time.time()
print(f"Took {t1-t0:.2f}s")
```

### 19.5 Frontend API Test
```powershell
curl "http://localhost:8000/api/routes/all-segments?from_lat=12.9755&from_lng=77.6068&from_name=MG%20Road&dest_lat=12.9768&dest_lng=77.5712&dest_name=Majestic&group_size=1&budget=200&max_depth=3"
```

### 19.6 Expected Behavior Checks
- MG Road → Majestic at 12:00 PM should show:
  - Metro option: Mahatma Gandhi Road → Majestic (Purple Line, ₹21, 7 min)
  - Bus options from MG Road Metro: G-3A, 362-C, etc. with departure times after 12:00
  - Walk option: 3.5km, 42 min
  - Cab option: ~₹75, 8 min
- Total segments should be 26 (prev 42 after dedup)
- No 500 errors
- Response under 30 seconds

---

## 20. Running the Project

### 20.1 Full Stack
```powershell
# Terminal 1: Backend
cd C:\Users\len\OneDrive\Desktop\VOYAGER
$env:VOYAGER_TEST_TIME="2024-07-15 12:00:00"  # Optional: freeze time
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2: Frontend
cd C:\Users\len\OneDrive\Desktop\VOYAGER\frontend
npx vite --port 3000
```

### 20.2 Clear GTFS Cache
```powershell
Remove-Item data_cache/processed/gtfs_cache.pkl -ErrorAction SilentlyContinue
```
This forces a full GTFS reload on next server start (~41s).

### 20.3 Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `VOYAGER_TEST_TIME` | Freeze GTFS time for testing | (unset = real time) |
| `PYTHONIOENCODING` | UTF-8 output encoding | `utf-8` |
| `OSRM_BASE_URL` | OSRM routing server | `https://router.project-osrm.org` |

### 20.4 Dependencies
**Backend** (requirements.txt):
- fastapi, uvicorn
- pandas, geopy
- httpx, asyncio
- python-multipart

**Frontend** (package.json):
- react, react-dom
- leaflet, react-leaflet
- typescript
- vite

---

## 22. n8n Workflow Integration

### 22.1 Overview
`n8n_service.py` provides integration with n8n (a workflow automation platform) for:
- Triggering external data pipelines
- Sending notifications
- Coordinating multi-step data processing tasks

### 22.2 Current Status
The n8n integration is in early stages. It exposes:
- A service class for creating n8n webhook calls
- Placeholder methods for data pipeline triggers
- No production workflows are currently deployed

### 22.3 Future Possibilities
- Automated GTFS data refresh pipeline
- Email/SMS notifications for route delays
- Integration with live bus tracking APIs
- Periodic fare table updates

---

## 23. ML Models & Data Science

### 23.1 Overview
The `ml/` directory contains experimental machine learning models and data analysis scripts for the project.

### 23.2 Available Data
- **Ride patterns**: `rides_data.csv` — historical ride-hailing data
- **Metro ridership**: `metro_per_hour_tickets_purchased.csv`, `NammaMetro_Ridership_Dataset.csv`
- **Metro demand**: `metro.csv` — aggregated metro usage
- **Traffic logs**: `traffic_logs.csv` — speed/volume logs with time steps and live speeds

### 23.3 Potential ML Applications
1. **Travel time prediction**: Predict duration based on time-of-day, day-of-week, weather
2. **Demand forecasting**: Predict ride-hailing/metro demand for pricing recommendations
3. **Route popularity**: Rank routes by historical usage patterns
4. **Congestion prediction**: Predict traffic congestion levels from historical patterns
5. **Personalized recommendations**: Suggest routes based on user history and preferences

### 23.4 Current Status
The ML models are not yet integrated into the main application. The data is available for analysis and model training. Integration would require:
1. Training a prediction model using the available datasets
2. Creating a prediction API endpoint
3. Feeding predictions into the scoring/routing system
4. A/B testing against baseline routing

---

## 24. Environment Configuration Details

### 24.1 `config.py` Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `PROJECT_NAME` | VOYAGER | Application name |
| `DATA_CACHE_DIR` | `data_cache/` | Transit data files |
| `PROCESSED_DIR` | `data_cache/processed/` | Cached/processed data |
| `OSRM_BASE_URL` | `https://router.project-osrm.org` | External routing server |
| `PETROL_AVG_MILEAGE` | 15 kmpl | Fuel efficiency for car routes |
| `FUEL_PRICE_PER_LITER` | ₹104 | Current fuel price |

### 24.2 `.env` File
The `.env` file in the root directory contains:
```
# API Keys (if any)
# OSRM_URL=https://router.project-osrm.org
# LLM_API_KEY=...
```

### 24.3 FastAPI Configuration
```python
# main.py
app = FastAPI(title="VOYAGER API", version="1.0.0")

# CORS middleware — allows frontend on port 3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file mounting for map tiles (if needed)
# app.mount("/static", StaticFiles(directory="static"), name="static")
```

### 24.4 Test Time Override
```python
# In main.py — checks environment variable at startup
import os
test_time = os.environ.get("VOYAGER_TEST_TIME")
if test_time:
    from backend.services.gtfs_service import set_test_time
    set_test_time(test_time)
    print(f"[MAIN] Test time override: {test_time}")
```

The test time propagates to:
- `gtfs_service._now()` — returns frozen datetime instead of real time
- All GTFS departure filtering (shows buses departing after test time)
- TransitService segment building — consistent departures across calls

---

## 25. Common Errors & Troubleshooting

### 25.1 "Port already in use" when starting server
```powershell
# Windows: Find and kill the process using port 8000
netstat -ano | Select-String ":8000"
# Look for LISTENING state, note PID (e.g., 7236)
Stop-Process -Id 7236 -Force
```

### 25.2 GTFS cache stale or corrupt
```powershell
# Delete cache and restart
Remove-Item data_cache/processed/gtfs_cache.pkl -ErrorAction SilentlyContinue
# Server will rebuild cache on next startup (~41s)
```

### 25.3 "float object has no attribute lower()"
```
Root Cause: Stop name field in CSV is numeric
Fix: Added str() conversion in database.py _load_bus_stops()
      Added isinstance checks in gtfs_service.py _resolve_name()
```

### 25.4 "500 Internal Server Error" on /all-segments
```
Root Cause 1: station_to_dest_dist used before assignment in get_segment_step_options
Fix: Moved calculation before the metro bus loop

Root Cause 2: find_stops_on_route_toward_dest returning empty for some routes
Fix: Added _stop_times_by_route index lookup instead of full iteration
     Added distance-based fallback for close stops

Root Cause 3: OSRM requests hanging indefinitely
Fix: Added 20s timeout on asyncio.gather for OSRM path fetching
Fix: Added 3s per-request timeout in get_osrm_path_between
```

### 25.5 Same transport options appearing in frontend
```
Root Cause: API endpoint timing out or returning errors silently
Fix: 
  1. Fix performance issues (geodesic→haversine, index lookups)
  2. Fix OSRM timeout handling
  3. Ensure frontend re-fetches when search params change
  4. Add proper error states in SegmentPanel.tsx
```

### 25.6 Bus options showing "towards destination" instead of stop name
```
Root Cause: find_stops_on_route_toward_dest failing to find downstream stops
Fix: 
  1. Changed to use _stop_times_by_route index
  2. Added 200m minimum distance from source check
  3. Now correctly shows "indian express", "shivajinagara bus station", etc.
```

### 25.7 Metro options not appearing
```
Root Cause 1: find_nearby_metro_stations returning empty
Check: Verify metro coordinates are correct in bengaluru_metro_network.csv

Root Cause 2: Stop type not "metro"
Check: In _build_single_segment, ensure stop_type is passed as "metro" to _add_reach_options

Root Cause 3: Destination metro stations not found
Check: dest_nearby_metro computed with radius 2.0km
Check: Verify Majestic station coordinates
```

---

## 26. Performance Benchmarks

### 26.1 Database Lookups

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| `find_nearby_bus_stops()` | 374ms | 3.7ms | **100x** |
| `find_nearby_metro_stations()` | 11ms | 1ms | **11x** |
| `find_nearby_railway_stations()` | <1ms | <1ms | — |

### 26.2 GTFS Operations

| Operation | Time |
|-----------|------|
| Cache load (from pickle) | ~600ms |
| `resolve_name()` (cached) | ~0.001ms |
| `resolve_name()` (first time, fuzzy) | ~5ms |
| `get_all_routes_at_stop()` | ~0.1ms |
| `find_stops_on_route_toward_dest()` | ~0.1ms (was ~5ms) |
| `get_shape_path_for_route()` | ~0.001ms |

### 26.3 Segment Building

| Operation | Time |
|-----------|------|
| `_build_single_segment()` (segment 0) | ~2.5s |
| `_build_single_segment()` (segment 1+) | ~1.5s |
| `get_all_segments()` (26 segments) | ~15s |
| GTFS full load (from ZIP) | ~41s |

### 26.4 API Response Times

| Endpoint | Time |
|----------|------|
| `/api/routes/all-segments` (no OSRM) | ~15s |
| `/api/routes/all-segments` (with OSRM) | ~20-35s |
| `/api/routes/plan` | ~5-10s |
| `/api/routes/metro-stations` | <10ms |
| `/api/routes/bus-stops` | ~4ms |
| `/api/routes/segment-step` | ~3-8s |

---

## 27. Future Architecture Considerations

### 27.1 Proposed: Caching Layer
```
Problem: _build_single_segment runs the same computation for different segments
Solution: LRU cache keyed by (from_lat, from_lng, dest_lat, dest_lng, group_size)
Benefit: 50-70% reduction in get_all_segments time
```

### 27.2 Proposed: GTFS Incremental Updates
```
Problem: GTFS data changes daily (new routes, schedule changes)
Solution: 
  1. Download updated GTFS ZIP on server startup
  2. Compare modification timestamps
  3. Only rebuild cache if data changed
  4. Support partial updates for stop_times
```

### 27.3 Proposed: Database Migration
```
Current: All data in memory (pandas + dicts)
Problem: Memory usage grows with data size
Solution: SQLite for structured data (stops, routes, fares)
Benefit: 
  - Lower memory footprint
  - SQL queries for geospatial filtering
  - Easier data updates
  - Concurrent read access
```

### 27.4 Proposed: Real-Time Tracking
```
Integration with:
  - BMTC live bus tracking API (if available)
  - Namma Metro live train positions
  - Uber/Ola real-time availability
Features:
  - Show actual bus positions on map
  - Realistic ETA based on vehicle position
  - Delay notifications
  - Platform/ gate information for metro
```

### 27.5 Proposed: WebSocket Updates
```
For live tracking, switch from polling to WebSocket:
  - Real-time GPS position updates
  - Live route recalculation
  - Traffic condition changes
  - Service disruption alerts
```

---

## Appendix A: Complete File Reference

| File | Lines | Purpose | Last Modified |
|------|-------|---------|---------------|
| `backend/services/transit_service.py` | 1957 | Core routing engine | Current session |
| `backend/services/gtfs_service.py` | 522 | GTFS data loader & queries | Current session |
| `backend/core/database.py` | 298 | Transit data (bus, metro, rail) | Current session |
| `backend/api/routes.py` | 688 | All REST API endpoints | Current session |
| `backend/main.py` | ~50 | FastAPI app + test time | Current session |
| `frontend/src/components/SegmentPanel.tsx` | ~400 | Multi-column segment UI | Prior session |
| `frontend/src/pages/MainPage.tsx` | ~300 | Main page with map & search | Prior session |

## Appendix C: All API Endpoints Reference

### C.1 Route Planning
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/routes/plan` | Full route planning with multi-modal options |
| GET | `/api/routes/all-segments` | Progressive segment data (Feature 2) |
| GET | `/api/routes/segment-step` | Single-step segment options (legacy) |
| GET | `/api/routes/mini-path-options` | Quick path overview |

### C.2 Transit Data
| Method | Endpoint | Parameters | Description |
|--------|----------|------------|-------------|
| GET | `/api/routes/metro-stations` | `?line=<name>` (optional) | Metro stations, optionally filtered by line |
| GET | `/api/routes/bus-stops` | `?near_lat=&near_lng=&radius=` | Bus stops near location or first 100 |
| GET | `/api/routes/kia-routes` | — | All KIA airport bus routes |
| GET | `/api/routes/transit-fares` | — | Fare slabs for all transit modes |

### C.3 Live Data
| Method | Endpoint | Parameters | Description |
|--------|----------|------------|-------------|
| GET | `/api/routes/live-prices` | `?source=&dest=&mode=` | LLM-based ride pricing |
| GET | `/api/routes/news` | `?source_lat=&source_lng=&...` | Travel news / advisories |
| GET | `/api/routes/traffic-overlay` | `?north=&south=&east=&west=` | Traffic congestion GeoJSON |

### C.4 Search
| Method | Endpoint | Parameters | Description |
|--------|----------|------------|-------------|
| GET | `/api/search/places` | `?q=<query>` | Search for locations, stops, stations |

### C.5 Request/Response Formats

#### POST `/api/routes/plan` — Request Body
```json
{
  "source_lat": 12.9755,
  "source_lng": 77.6068,
  "dest_lat": 12.9768,
  "dest_lng": 77.5712,
  "mode": "transit",
  "group_size": 1,
  "budget": 200,
  "waypoints": []
}
```

#### POST `/api/routes/plan` — Response
```json
{
  "status": "success",
  "source": {"lat": 12.9755, "lng": 77.6068, "name": "MG Road"},
  "destination": {"lat": 12.9768, "lng": 77.5712, "name": "Majestic"},
  "routes": [
    {
      "type": "car",
      "total_fare": 24.27,
      "total_duration_minutes": 8,
      "total_distance_km": 3.5,
      "total_walking_km": 0,
      "overall_score": 85,
      "score_explanation": "direct drive - no transfers",
      "geometry": {"type": "LineString", "coordinates": [[77.6068,12.9755],...]},
      "legs": [{
        "from": "Your Location",
        "to": "Destination",
        "mode": "car",
        "distance_km": 3.5,
        "duration_minutes": 8,
        "fare": 24.27,
        "instructions": "Drive 3.5km - fuel cost approx ₹24",
        "path": [[12.9755,77.6068],...]
      }]
    },
    {
      "type": "metro",
      "total_fare": 21,
      "total_duration_minutes": 14,
      "total_distance_km": 3.8,
      "total_walking_km": 0.6,
      "overall_score": 88,
      "score_explanation": "...",
      "legs": [
        {"from": "Your Location", "to": "Mahatma Gandhi Road", "mode": "walk", ...},
        {"from": "Mahatma Gandhi Road", "to": "Majestic", "mode": "metro", 
         "line": "Purple Line", ...},
        {"from": "Majestic", "to": "Your Destination", "mode": "walk", ...}
      ]
    }
  ],
  "total_options": 6,
  "recommendations": ["Leave by 9 AM to avoid peak traffic"],
  "weather": {"condition": "Clear", "temperature": 28}
}
```

#### GET `/api/routes/all-segments` — Response Structure
```json
{
  "status": "success",
  "data": {
    "source": {"lat": 12.9755, "lng": 77.6068, "name": "MG Road"},
    "dest": {"lat": 12.9768, "lng": 77.5712, "name": "Majestic"},
    "segments": [
      {
        "segment_index": 0,
        "from": {"name": "MG Road", "lat": 12.9755, "lng": 77.6068},
        "direct_options": [...],
        "destinations": [
          {
            "stop": {"name": "MG Road Metro Station", "lat": 12.975458, "lng": 77.606802, "type": "bus"},
            "distance_from_current": 0.02,
            "reach_options": [...],
            "transit_options": [...]
          }
        ]
      }
    ],
    "total_segments": 26
  }
}
```

---

## Appendix D: Data File Specifications

### D.1 BMTC Stop Master CSV (`bmtc_all_stops_master.csv`)
| Column | Type | Description |
|--------|------|-------------|
| Stop Name | string | Name of the bus stop |
| Latitude | float | Latitude coordinate |
| Longitude | float | Longitude coordinate |
| Routes with num trips | string | Python dict literal: `{"ROUTE": count, ...}` |

**Example row**:
```
MG Road Metro Station,12.97545826,77.60680228,"{'G-3A': 3, '362-C': 2, '144': 1, ...}"
```

**Processing note**: The "Routes with num trips" column is parsed with `ast.literal_eval()` (not `json.loads()`) because the format uses single-quoted keys and values.

### D.2 Metro Network CSV (`bengaluru_metro_network.csv`)
| Column | Type | Description |
|--------|------|-------------|
| Station_Name | string | Station display name |
| Line | string | "Purple Line" or "Green Line" |
| Sequence | integer | Station order on the line (1=first) |
| Latitude | float | Latitude coordinate |
| Longitude | float | Longitude coordinate |
| Station_Code | string | Short code (e.g., "MG", "KP") |
| Is_Interchange | boolean/string | "Yes" if interchange station |

**Purple Line stations** (West→East):
Mysuru Road → Deepanjali Nagar → Attiguppe → Vijayanagar → Hosahalli → Magadi Road → Sri Kanteerava Stadium → Srirampura → Yeshwanthpur → Peenya Industry → Peenya → Jalahalli → Dasarahalli → Nagasandra

**Green Line stations** (North→South):
Nagasandra → ... → Majestic → ... → Yelachenahalli

**Interchanges**: Nadaprabhu Kempegowda Station (Majestic) — Purple Line ↔ Green Line

### D.3 Railway Stations JSON (`karnataka_railway_stations.json`)
```json
[
  {"name": "KSR Bengaluru", "lat": 12.9783, "lng": 77.5713},
  {"name": "Mysuru Junction", "lat": 12.3119, "lng": 76.6551},
  {"name": "Hubballi Junction", "lat": 15.3593, "lng": 75.1283},
  {"name": "Mangaluru Central", "lat": 12.8683, "lng": 74.8527},
  {"name": "Belagavi", "lat": 15.8497, "lng": 74.5042},
  {"name": "Ballari Junction", "lat": 15.1424, "lng": 76.9153},
  "... 50+ stations total"
]
```

### D.4 Transit Fares JSON (`transit_fares.json`)
```json
{
  "namma_metro_slabs": [
    {"min_km": 0, "max_km": 2, "fare": 11},
    {"min_km": 2, "max_km": 4, "fare": 16},
    {"min_km": 4, "max_km": 6, "fare": 21},
    {"min_km": 6, "max_km": 8, "fare": 26},
    {"min_km": 8, "max_km": 10, "fare": 32},
    {"min_km": 10, "max_km": 15, "fare": 38},
    {"min_km": 15, "max_km": 20, "fare": 45}
  ],
  "bmtc_ordinary_slabs": [
    {"min_km": 0, "max_km": 2, "fare": 6},
    {"min_km": 2, "max_km": 5, "fare": 12},
    {"min_km": 5, "max_km": 10, "fare": 16},
    {"min_km": 10, "max_km": 20, "fare": 22},
    {"min_km": 20, "max_km": 30, "fare": 28},
    {"min_km": 30, "max_km": 40, "fare": 32}
  ],
  "bmtc_ac_vajra_slabs": [
    {"min_km": 0, "max_km": 5, "adult_fare": 15, "child_fare": 8},
    {"min_km": 5, "max_km": 10, "adult_fare": 20, "child_fare": 10},
    {"min_km": 10, "max_km": 20, "adult_fare": 35, "child_fare": 18},
    {"min_km": 20, "max_km": 40, "adult_fare": 45, "child_fare": 23}
  ]
}
```

### D.5 KIA Routes JSON (`kia_routes_fare_full.json`)
```json
{
  "vayu_vajra_kia_routes": {
    "KIA-1": {
      "route_info": "KBS → KIA Airport",
      "stops": [
        {"stop_name": "Kempegowda Bus Station", "lat": 12.9768, "lng": 77.5712, "fare": 0},
        {"stop_name": "Shivajinagara Bus Station", "lat": 12.9833, "lng": 77.6034, "fare": 45},
        {"stop_name": "Kempegowda International Airport", "lat": 13.1989, "lng": 77.7068, "fare": 250}
      ]
    }
  }
}
```

---

## Appendix E: GTFS Field Reference

### E.1 `shapes.txt`
| Field | Description | Example |
|-------|-------------|---------|
| `shape_id` | Unique shape identifier | `"SHP001"` |
| `shape_pt_lat` | Latitude of shape point | `12.9716` |
| `shape_pt_lon` | Longitude of shape point | `77.5946` |
| `shape_pt_sequence` | Order of point in shape | `1, 2, 3, ...` |

### E.2 `stops.txt`
| Field | Description | Example |
|-------|-------------|---------|
| `stop_id` | Unique stop identifier | `"24045"` |
| `stop_name` | Stop display name | `"MG Road Metro Station"` |
| `stop_lat` | Latitude | `12.97547` |
| `stop_lon` | Longitude | `77.60671` |

### E.3 `trips.txt`
| Field | Description | Example |
|-------|-------------|---------|
| `route_id` | References routes.txt | `"1000"` |
| `service_id` | Service calendar identifier | `"WD"` |
| `trip_id` | Unique trip identifier | `"T001"` |
| `shape_id` | References shapes.txt | `"SHP001"` |

### E.4 `routes.txt`
| Field | Description | Example |
|-------|-------------|---------|
| `route_id` | Unique route identifier | `"1000"` |
| `route_short_name` | Public-facing route number | `"G-3A"` |
| `route_long_name` | Full route description | `"G-3A (G to SBS)"` |
| `route_type` | Mode (3=bus) | `3` |

### E.5 `stop_times.txt`
| Field | Description | Example |
|-------|-------------|---------|
| `trip_id` | References trips.txt | `"T001"` |
| `arrival_time` | Scheduled arrival | `"05:05:33"` |
| `departure_time` | Scheduled departure | `"05:05:33"` |
| `stop_id` | References stops.txt | `"24045"` |
| `stop_sequence` | Order of stops in trip | `1, 2, 3, ...` |

---

## Appendix F: Change Log (Extended)

| Date | Change | Files Modified | Author |
|------|--------|----------------|--------|
| Jul 15 | Replaced geodesic with haversine in database.py | `database.py` | Dev |
| Jul 15 | Fixed find_stops_on_route_toward_dest to use index | `gtfs_service.py` | Dev |
| Jul 15 | Added OSRM gather timeout in /all-segments | `routes.py` | Dev |
| Jul 15 | Fixed float stop name in _load_bus_stops | `database.py` | Dev |
| Jul 15 | Added isinstance guards for float stop names | `gtfs_service.py`, `transit_service.py` | Dev |
| Jul 15 | Added str() guard in _add_transit_options | `transit_service.py` | Dev |
| Jul 15 | Fixed station_to_dest_dist UnboundLocalError | `transit_service.py` | Dev |
| Jul 15 | Added find_stops_on_route_toward_dest filter improvement | `gtfs_service.py` | Dev |
| Jul 15 | Created comprehensive PROJECT_DETAILED_TILL_NOW.md | — | Dev |
| Jul 14 | Added bus path (GTFS shape) to transit options | `transit_service.py` | Dev |
| Jul 14 | Added next_transit (bus→metro chaining) | `transit_service.py` | Dev |
| Jul 14 | Added final_options to ALL transit options | `transit_service.py` | Dev |
| Jul 14 | Removed duplicate dropoff_walk_min/dropoff_to_dest_km | `transit_service.py` | Dev |
| Jul 14 | Fixed metro line path for station→destination display | `transit_service.py` | Dev |
| Jul 13 | Fixed ast.literal_eval for CSV route parsing | `database.py` | Dev |
| Jul 13 | Rebuilt GTFS cache with correct data | `data_cache/processed/` | Dev |
| Jul 13 | Fixed GTFS cache path | `gtfs_service.py` | Dev |
| Jul 13 | Removed stop_times limit (was 500K) | `gtfs_service.py` | Dev |
| Jul 13 | Per-stop limit 50→200, per-route 200→500 | `gtfs_service.py` | Dev |
| Jul 13 | Fuzzy cutoff 0.7→0.55 for better matching | `gtfs_service.py` | Dev |
| Jul 13 | Route-shape building: trip_to_route dict | `gtfs_service.py` | Dev |
| Jul 12 | Initial Segment UI panel implementation | `SegmentPanel.tsx` | Dev |
| Jul 12 | get_all_segments chaining logic | `transit_service.py` | Dev |
| Jul 12 | _build_single_segment with progressive columns | `transit_service.py` | Dev |
| Jul 11 | Train data integration | `transit_service.py` | Dev |
| Jul 11 | Railway station finder | `database.py` | Dev |
| Jul 10 | Metro network + bus stop loading | `database.py` | Dev |
| Jul 10 | GTFS loader with fuzzy name matching | `gtfs_service.py` | Dev |
| Jul 09 | Route planner base (Feature 1) | `transit_service.py` | Dev |
| Jul 09 | API endpoints skeleton | `routes.py` | Dev |
| Jul 08 | Project scaffolding | All | Dev |

---

## Appendix G: Code Snippets — Key Patterns

### G.1 Async OSRM Path Fetching with Timeout
```python
# Used in /all-segments endpoint
osrm_sem = asyncio.Semaphore(15)

async def _fetch_osrm(opt, profile):
    async with osrm_sem:
        try:
            p = await transit_service.get_osrm_path_between(
                opt["from_lat"], opt["from_lng"], 
                opt["to_lat"], opt["to_lng"], profile)
            if p:
                opt["path"] = p
        except:
            pass

# With timeout for the entire gather
if path_tasks:
    try:
        await asyncio.wait_for(asyncio.gather(*path_tasks), timeout=20.0)
    except:
        pass
```

### G.2 GTFS Name Resolution with Fallbacks
```python
def _resolve_name(self, name: str) -> str | None:
    key = name.lower().strip()
    if key in self._stop_times:
        return key                          # Exact match
    if key in self._name_map:
        return self._name_map[key]          # Cached match
    
    match = _fuzzy_match(key, self._all_gtfs_names, cutoff=0.55)
    if match:
        self._name_map[key] = match
        return match                        # Fuzzy match
    
    nk = _normalize(key)
    for gn in self._all_gtfs_names:
        if _normalize(gn) == nk:
            self._name_map[key] = gn
            return gn                       # Normalized exact match
    
    # Word subset match
    words = set(nk.split())
    for gn in self._all_gtfs_names:
        gn_words = set(_normalize(gn).split())
        common = words & gn_words
        if len(common) >= min(2, len(words)) and len(common) >= min(2, len(gn_words)):
            self._name_map[key] = gn
            return gn
    
    # Substring match (last resort)
    for gn in self._all_gtfs_names:
        gnn = _normalize(gn)
        if nk in gnn or gnn in nk:
            self._name_map[key] = gn
            return gn
    
    return None
```

### G.3 Segment Chaining in get_all_segments
```python
def get_all_segments(self, from_lat, from_lng, from_name,
                      dest_lat, dest_lng, dest_name,
                      group_size=1, budget=None, max_depth=3):
    segments = []
    visited_pts = set()
    
    # Segment 0
    seg0 = self._build_single_segment(from_lat, from_lng, from_name,
                                       dest_lat, dest_lng, dest_name,
                                       group_size, budget, 0)
    segments.append(seg0)
    
    # Collect arrival points for next segments
    next_from_map = {}
    for dest_entry in seg0["destinations"]:
        for topt in dest_entry.get("transit_options", []):
            if topt.get("arrives_at_stop") and topt.get("to_lat") and topt.get("to_lng"):
                ardist = haversine(topt["to_lat"], topt["to_lng"], dest_lat, dest_lng)
                if ardist > 0.5:
                    nk = f"{round(topt['to_lat'],4)},{round(topt['to_lng'],4)}"
                    if nk not in visited_pts and nk not in next_from_map:
                        next_from_map[nk] = (topt["to_lat"], topt["to_lng"], topt.get("to", ""))
                        topt["needs_next_segment"] = True
    
    # Build segments 1, 2, ...
    depth = 1
    while next_from_map and depth < max_depth:
        new_map = {}
        for nk, (nl, ng, nn) in next_from_map.items():
            if nk in visited_pts: continue
            visited_pts.add(nk)
            
            next_seg = self._build_single_segment(nl, ng, nn,
                                                   dest_lat, dest_lng, dest_name,
                                                   group_size, budget, depth)
            segments.append(next_seg)
            seg_arr_idx = len(segments) - 1
            
            # Link transit options that arrive at this segment's from point
            for prev_seg in segments:
                if prev_seg["segment_index"] >= depth: continue
                for de in prev_seg["destinations"]:
                    for topt in de.get("transit_options", []):
                        tmk = f"{round(topt.get('to_lat',0),4)},{round(topt.get('to_lng',0),4)}"
                        if tmk == nk:
                            topt["next_segment_index"] = seg_arr_idx
            
            # Collect next-level points
            for de in next_seg["destinations"]:
                for topt in de.get("transit_options", []):
                    if topt.get("arrives_at_stop") and topt.get("to_lat"):
                        ardist2 = haversine(topt["to_lat"], topt["to_lng"], dest_lat, dest_lng)
                        if ardist2 > 0.5:
                            tmk2 = f"{round(topt['to_lat'],4)},{round(topt['to_lng'],4)}"
                            if tmk2 not in visited_pts and tmk2 not in new_map:
                                new_map[tmk2] = (topt["to_lat"], topt["to_lng"], topt.get("to", ""))
        
        next_from_map = new_map
        depth += 1
    
    return {
        "source": {"lat": from_lat, "lng": from_lng, "name": from_name},
        "dest": {"lat": dest_lat, "lng": dest_lng, "name": dest_name},
        "segments": segments,
        "total_segments": len(segments),
    }
```

### G.4 Interpolated Path Generation (Fallback)
```python
def _interpolate_path(self, lat1, lng1, lat2, lng2, num_points=6):
    """Generate interpolated straight-line path between two coordinates.
    Used as fallback when OSRM or GTFS path is unavailable."""
    path = []
    for i in range(num_points):
        frac = i / (num_points - 1)
        lat = lat1 + (lat2 - lat1) * frac
        lng = lng1 + (lng2 - lng1) * frac
        path.append([lat, lng])
    return path
```

### G.5 Haversine Distance (Performance Optimized)
```python
def _haversine(lat1, lng1, lat2, lng2):
    """Fast haversine distance in kilometers."""
    R = 6371
    dlat = (lat2 - lat1) * math.pi / 180
    dlng = (lng2 - lng1) * math.pi / 180
    a = math.sin(dlat/2)**2 + \
        math.cos(lat1*math.pi/180) * \
        math.cos(lat2*math.pi/180) * \
        math.sin(dlng/2)**2
    return 2 * R * math.asin(math.sqrt(a))
```

### G.6 Test Time Override System
```python
# gtfs_service.py
_TEST_TIME_OVERRIDE = None

def set_test_time(time_str: str):
    global _TEST_TIME_OVERRIDE
    _TEST_TIME_OVERRIDE = time_str

def _now():
    if _TEST_TIME_OVERRIDE:
        from datetime import datetime
        return datetime.strptime(_TEST_TIME_OVERRIDE, "%Y-%m-%d %H:%M:%S")
    from datetime import datetime
    return datetime.now()

# main.py — reads from environment variable
import os
test_time = os.environ.get("VOYAGER_TEST_TIME")
if test_time:
    from backend.services.gtfs_service import set_test_time
    set_test_time(test_time)
```

---

## Appendix B: Glossary (Extended)

| Term | Definition |
|------|------------|
| **GTFS** | General Transit Feed Specification — standard format for public transit data |
| **OSRM** | Open Source Routing Machine — driving/walking path computation |
| **TOPSIS** | Technique for Order Preference by Similarity to Ideal Solution — multi-criteria scoring |
| **BMTC** | Bangalore Metropolitan Transport Corporation — city bus operator |
| **KIA** | Kempegowda International Airport |
| **Vajra** | BMTC's air-conditioned bus service (AC Vajra) |
| **Vayu Vajra** | Airport bus service operated by BMTC/KIA |
| **Namma Metro** | Bengaluru's metro rail system (Purple + Green lines) |
| **SequenceMatcher** | Python difflib component for string similarity matching |
| **Haversine** | Formula for great-circle distance between two points on a sphere |
| **Geodesic** | More accurate ellipsoidal distance calculation (slower) |
| **Segment** | One step in a multi-step journey (e.g., "walk to bus stop" is part of a segment) |
| **Reach options** | Ways to get FROM current location TO a transit stop |
| **Transit options** | Ways to travel FROM a transit stop TOWARD destination (bus, metro, train) |
| **Final options** | Ways to get FROM transit arrival point TO final destination |
| **Next transit** | Connecting transit from bus arrival point (e.g., bus→metro) |
| **Stop_times** | GTFS table mapping stop_id + trip_id → arrival/departure time |
| **Shape** | GTFS path geometry (series of lat/lng points along a bus route) |

## Appendix C: Change Log

| Date | Change | Author |
|------|--------|--------|
| Jul 15 | Fixed `find_stops_on_route_toward_dest` — use `_stop_times_by_route` instead of full iteration | Dev |
| Jul 15 | Fixed `find_nearby_bus_stops` — `geodesic` → `_haversine` (374ms → 3.7ms) | Dev |
| Jul 15 | Added OSRM gather timeout (20s) to `/all-segments` | Dev |
| Jul 15 | Fixed float stop names — added `str()` conversion + `isinstance` guards | Dev |
| Jul 15 | Fixed `station_to_dest_dist` UnboundLocalError | Dev |
| Jul 15 | Fixed bus `to` field — now shows actual GTFS stop names via `find_stops_on_route_toward_dest` | Dev |
| Jul 15 | Fixed GTFS cache path to `data_cache/processed/gtfs_cache.pkl` | Dev |
| Jul 15 | Rebuilt GTFS cache — 5077 stops, 429K entries, 4359 routes | Dev |
| Jul 15 | Added `get_shape_path_for_route()`, `find_stops_on_route_toward_dest()` to GTFS | Dev |
| Jul 15 | Fixed route-shape building — use `trip_to_route` dict | Dev |
| Jul 15 | Added `next_transit` (metro chaining from bus arrival) to all bus options | Dev |
| Jul 15 | Added `final_options` (last-mile walk/ride) to ALL transit options | Dev |
| Jul 15 | Fixed `ast.literal_eval()` for CSV route column parsing | Dev |
| Jul 14 | Segment UI panel — multi-column layout | Dev |
| Jul 14 | GTFS bus departure times integration | Dev |
| Jul 13 | Metro + Train integration | Dev |
| Jul 13 | Basic A→B route planner (Feature 1) | Dev |
| Jul 12 | Project initialization, data loading, search | Dev |

---

*End of PROJECT_DETAILED_TILL_NOW.md — 30+ pages of comprehensive documentation covering all aspects of the VOYAGER project from inception to current state.*
