# VOYAGER — Bengaluru Transit Navigator

## Complete Project Documentation

---

# Table of Contents

1. [Project Vision & Overview](#1-project-vision--overview)
2. [Product Requirements Specification](#2-product-requirements-specification)
3. [Technology Stack](#3-technology-stack)
4. [Project Architecture](#4-project-architecture)
5. [Directory Structure & File Reference](#5-directory-structure--file-reference)
6. [Backend Deep Dive](#6-backend-deep-dive)
7. [Frontend Deep Dive](#7-frontend-deep-dive)
8. [Datasets & Data Layer](#8-datasets--data-layer)
9. [n8n Workflow Integration](#9-n8n-workflow-integration)
10. [LLM & AI Agent Architecture](#10-llm--ai-agent-architecture)
11. [ML Modules (TOPSIS, A*)](#11-ml-modules-topsis-a)
12. [What Has Been Built (Completed Features)](#12-what-has-been-built-completed-features)
13. [What Remains To Be Built](#13-what-remains-to-be-built)
14. [Known Issues & Limitations](#14-known-issues--limitations)
15. [Future Roadmap](#15-future-roadmap)
16. [Setup & Deployment Guide](#16-setup--deployment-guide)
17. [API Reference](#17-api-reference)
18. [Appendix: Data Preprocessing](#18-appendix-data-preprocessing)
19. [Appendix: Troubleshooting Guide](#19-appendix-troubleshooting-guide)

---

# 1. Project Vision & Overview

## 1.1 The Problem

Bengaluru (Bangalore), India's Silicon Valley, is one of the most traffic-congested cities in the world. Commuters face daily challenges:

- **Fragmented transit information**: BMTC buses, Namma Metro, KIA airport buses, Uber/Ola/Rapido — each has its own app/source. No single platform unifies them.
- **Unreliable place data**: Google Maps shows many places that are closed, non-existent, or mislabeled. A "restaurant" might be a residential building; an "ATM" might have been removed years ago.
- **No intelligent route recommendation**: Existing apps show routes but don't weigh real-time factors like weather, safety at night, group size, or budget holistically.
- **No multi-modal mini-path selection**: Users can't choose different transport per segment (e.g., bus to Majestic then metro to destination).
- **No AI-driven verification**: Fake or outdated listings go unchecked.

## 1.2 The Solution: VOYAGER

VOYAGER is a **unified Bengaluru transit navigation platform** that combines:

- **Agentic AI** (OpenRouter GPT-4o-mini via LLM agents + n8n workflows) for place verification, review generation, price estimation, and route recommendation
- **Multi-source data** (OpenStreetMap, government transit datasets, web search) for comprehensive coverage
- **TOPSIS multi-criteria decision analysis** for intelligent route ranking based on cost, time, comfort, safety, weather, group size, and walking distance
- **Multi-modal mini-path routing** allowing users to pick different transport per journey segment
- **Real-time awareness** of weather, time-of-day, traffic conditions, and safety considerations

## 1.3 Target Users

- Daily Bengaluru commuters (bus/metro/cab users)
- Tourists visiting Bengaluru needing transit guidance
- Residents exploring nearby places (restaurants, ATMs, hospitals, temples, etc.)
- Groups traveling together requiring coordinated transport
- Late-night travelers needing safe route recommendations

## 1.4 Core Philosophies

1. **AI-first, fallback-graceful**: All intelligence comes from AI/LLM agents, but every component has a sensible fallback if the LLM or API is unavailable.
2. **Multi-source truth**: No single source is trusted blindly — OSM, local datasets, LLM analysis, and web search all cross-validate each other.
3. **Don't hardcode, let AI decide**: Route scoring, place verification, price estimation — all are dynamically computed, not hardcoded.
4. **Progressive enhancement**: Start with what works (search + nearby + A-to-B), then add sophisticated features (mini-paths, ML models, real-time tracking).

---

# 2. Product Requirements Specification

## 2.1 Feature 1: SEARCH

### 2.1.1 Search Specific

- User types a place name in the search bar
- Autocomplete suggestions appear as user types (from AI + OSM Nominatim + local dataset)
- On search, the backend queries:
  1. OSM Nominatim (geocoding API) for real places
  2. Local database (BMTC bus stops, Namma Metro stations)
  3. AI fallback (LLM generates plausible results with coordinates)
- Results are enriched with:
  - **Rating** (1.0-5.0 from LLM analysis)
  - **Reliability score** (0.0-1.0 indicating how trustworthy the place is)
  - **Review summary** (LLM-generated 10-20 word summary)
  - **Individual reviews** (2-4 detailed reviews with Indian user names, ratings, dates)
  - **Image** (fetched from Wikipedia API where available)
  - **Hotel price info** (if the place is a hotel/lodge, fetched via n8n/LLM)
  - **Distance** from user's location
- Results shown as cards in the sidebar with green (recommended) / red (not recommended) indicators
- Clicking a card centers the map on that location with an elevated pin
- "View Details" button fetches full enrichment on-demand (reviews + images) — especially important for nearby results which start as light-weight
- "Navigate" button activates A-to-B mode with this place as destination
- "Nearby here" button switches to Nearby mode centered on this place

### 2.1.2 Search Nearby

- 25 place-type tags available: All, Mall, Hospital, Restaurant, Hotel, Lodge, Temple, Mosque, Church, School, Park, ATM, Bank, Petrol Pump, Charging Station, Bus Stop, Metro Station, Airport, Railway Station, Police, Cafe, Pharmacy, Supermarket, Gym, Cinema, Clinic
- User clicks a tag → queries Overpass API (OpenStreetMap) for POIs within a radius
- Radius adjustable via slider (0.5 km to 10 km)
- Results use `light=True` enrichment (skip LLM reviews/images for speed)
- "View Details" on any nearby result triggers on-demand enrichment (fetches reviews, image)
- Map pins: green (reliable/recommended) with place emoji, red (not recommended) with place emoji
- Results sorted by distance

### 2.1.3 Map Behavior

- Dark theme map with OpenStreetMap tiles
- User's current location: glowing blue 📍 pin (uses browser geolocation API)
- Place markers: colored emoji based on place type (🛕 temple, 🕌 mosque, ⛪ church, 🏥 hospital, etc.)
- Green circle = recommended, Red circle = not recommended
- Selected place: larger pin with glow effect
- Marker popups: place name, address, rating, reliability, review summary, "View Details" button
- Map auto-pans/zooms when user selects a place
- Current-location button in sidebar header (circular 📍 icon) flies map to user's location

## 2.2 Feature 2: A-TO-B (Route Planning)

### 2.2.1 Core Flow

1. User enters source and destination (with search suggestions from live API)
2. User optionally sets: group size, budget, priority (via preferences panel)
3. User picks travel mode:
   - **🚌 Public Transit** (bus, metro, KIA bus, multi-modal combinations)
   - **🚗 Drive** (personal car with fuel cost estimate)
   - **🚶 Walk** (for short distances)
4. Backend generates all possible route combinations
5. Routes are scored via TOPSIS (cost 30%, time 35%, walking 15%, comfort 20%)
6. Weather, time-of-day, and group-size adjustments:
   - Rainy weather → walking/bike penalized, cab boosted
   - Night hours → walking >1.5km penalized, ordinary bus penalized, cab boosted
   - Groups of 4+ → car/cab/AC bus boosted
7. Top 6 routes returned, sorted by score
8. Each route card shows: timeline bar (visual leg breakdown), fare, duration, walking distance
9. Ride-hailing prices (Uber/Ola/Rapido) shown separately via n8n workflow or LLM
10. Route legs show mode icons, metro line names, distances, durations, fares

### 2.2.2 Route Types Generated

| Type | Description | Fare Basis | Source |
|------|-------------|-----------|--------|
| `car` | Personal vehicle via OSRM | Fuel cost (₹110/L, 15 km/L) | OSRM + config |
| `walk` | Walking only | Free | Haversine |
| `bus_ordinary` | BMTC Ordinary Bus | ₹6-32 slab system | Local JSON fare table |
| `bus_ac_vajra` | BMTC AC Vajra Bus | ₹15-65 slab system | Local JSON fare table |
| `metro` | Namma Metro | ₹11-95 slab system | Local JSON fare table |
| `kia_bus` | KIA Vayu Vajra Airport Bus | Stop-wise fares | KIA JSON dataset |
| `bus_to_metro` | Bus → Metro combination | Bus + Metro fares | Multi-modal gen |
| `metro_to_bus` | Metro → Bus combination | Metro + Bus fares | Multi-modal gen |

### 2.2.3 Multi-Modal Mini-Paths

The system can break a journey into segments (mini-paths):
- **Example**: Rajanukunte → Majestic (by bus) → Gokarna (by metro)
- Each segment independently selectable by user
- Each segment shows all available transport options with current prices
- User can choose different transport per segment based on recommendations

### 2.2.4 Decision Factors (TOPSIS + Agentic AI)

1. **Time of day** (day/night) — affects safety scoring
2. **Cost/budget** — filters out unaffordable options
3. **Weather** — rain affects walking/bike viability
4. **Traffic/crowd** — planned via historical data
5. **Transport availability** — bus/metro/KIA/cab options near source/dest
6. **Walking distance** — penalizes excessive walking
7. **Group size** — larger groups benefit from car/cab
8. **Safety** — night + isolated routes = lower score

## 2.3 Feature 3: TRIP (Planned)

- Multi-stop itinerary planning
- Day trips with multiple destinations
- Saved/bookmarked routes and places
- Trip history and favorites
- Public transport pass recommendations

---

# 3. Technology Stack

## 3.1 Backend (Python 3.12.6)

| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | 0.104.1 | Web framework (async REST API) |
| Uvicorn | 0.24.0 | ASGI server |
| Pydantic | 2.5.2 | Request/response validation |
| Pydantic-Settings | 2.1.0 | Environment config management |
| httpx | 0.25.2 | Async HTTP client (OSRM, n8n, OpenRouter, APIs) |
| Pandas | 2.1.4 | CSV/JSON data processing |
| NumPy | 1.26.2 | Numerical operations |
| scikit-learn | 1.3.2 | ML utilities |
| NetworkX | 3.2.1 | Graph theory (transit graph) |
| GeoPy | 2.4.1 | Geodesic distance (Haversine) |
| Shapely | 2.0.2 | Geometric operations |
| google-generativeai | 0.3.2 | Gemini AI fallback |
| BeautifulSoup4 | 4.12.2 | Web scraping (DuckDuckGo) |
| lxml | 4.9.4 | XML parser |
| python-dotenv | 1.0.0 | .env file loading |

## 3.2 Frontend (React 18 + TypeScript + Vite)

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.2.0 | UI framework |
| React DOM | 18.2.0 | DOM rendering |
| Leaflet | 1.9.4 | Map library |
| React-Leaflet | 4.2.1 | React bindings for Leaflet |
| Axios | 1.6.2 | HTTP client for backend API |
| TypeScript | 5.3.3 | Type safety |
| Vite | 5.0.8 | Build tool & dev server |

## 3.3 External Services

| Service | API Type | Cost | Usage |
|---------|----------|------|-------|
| OpenRouter (GPT-4o-mini) | REST | Paid ($0.15/M tokens) | Primary LLM — place data, reviews, prices, analysis |
| Open-Meteo | REST | Free | Weather data for route recommendations |
| OpenStreetMap Nominatim | REST | Free (rate-limited) | Geocoding/search for places |
| Overpass API | REST | Free (rate-limited) | Nearby POI search (OSM data) |
| OSRM | REST | Free | Driving route calculation |
| Wikipedia API | REST | Free | Place images |
| DuckDuckGo HTML | Scraped | Free | Web search fallback |
| n8n | REST (self-hosted) | Free | Workflow automation (LLM pipelines) |
| Google Gemini | gRPC/REST | Free tier | LLM fallback |

## 3.4 Infrastructure

| Component | Location | Port |
|-----------|----------|------|
| Vite Frontend (dev) | localhost | 3000 |
| FastAPI Backend | localhost | 8014 |
| n8n Workflow Engine | localhost | 5678 |

---

# 4. Project Architecture

## 4.1 High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                   USER BROWSER                           │
│  React SPA (localhost:3000)                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  MainPage                                        │   │
│  │  ┌──────────┐ ┌────────┐ ┌─────────┐ ┌───────┐ │   │
│  │  │ Search   │ │ AToB   │ │ Trip    │ │ Map   │ │   │
│  │  │ Panel    │ │ Panel  │ │ Panel   │ │ (Lf)  │ │   │
│  │  └────┬─────┘ └───┬────┘ └─────────┘ └───┬───┘ │   │
│  │       │           │                      │      │   │
│  │  ┌────▼───────────▼──────────────────────▼───┐  │   │
│  │  │         API Service (Axios)              │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP /api/*
                       ▼
┌──────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (localhost:8014)             │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  search.py   │  │  routes.py   │  │  main.py       │ │
│  │  /api/search │  │  /api/routes │  │  /health, etc  │ │
│  └───────┬──────┘  └──────┬───────┘  └────────────────┘ │
│          │                │                               │
│  ┌───────▼────────────────▼───────┐                      │
│  │         Services Layer         │                      │
│  │  ┌──────────┐ ┌──────────────┐│                      │
│  │  │geocoding │ │transit_svc   ││                      │
│  │  │  .py     │ │  .py         ││                      │
│  │  │  (OSM,   │ │  (routes,    ││                      │
│  │  │  OV, AI) │ │  TOPSIS,     ││                      │
│  │  │          │ │  OSRM)      ││                      │
│  │  │ images   │ │              ││                      │
│  │  │  .py     │ │              ││                      │
│  │  │  (Wiki)  │ │              ││                      │
│  │  │          │ │              ││                      │
│  │  │ n8n_svc  │ │              ││                      │
│  │  │  .py     │ │              ││                      │
│  │  └────┬─────┘ └──────────────┘│                      │
│  └───────┴────────────────────────┘                      │
│          │                                                │
│  ┌───────▼────────────────────────┐                      │
│  │         Agent Layer            │                      │
│  │  ┌──────────────┐              │                      │
│  │  │  llm_agent   │───OpenRouter │                      │
│  │  │    .py       │───Gemini     │                      │
│  │  │              │───WebSearch  │                      │
│  │  └──────────────┘              │                      │
│  └───────────────────────────────┘                      │
│          │                                                │
│  ┌───────▼────────────────────────┐                      │
│  │         Core Layer             │                      │
│  │  ┌──────────┐ ┌──────────────┐│                      │
│  │  │database  │ │config.py     ││                      │
│  │  │  .py     │ │(settings,    ││                      │
│  │  │(loads    │ │ env vars)    ││                      │
│  │  │ datasets)│ │              ││                      │
│  │  └──────────┘ └──────────────┘│                      │
│  └───────────────────────────────┘                      │
└──────────────────────────────────────────────────────────┘
         │                      │
         ▼                      ▼
┌──────────────┐   ┌──────────────────────┐
│   OSRM       │   │  OpenStreetMap/Nomin │
│  (Driving)   │   │  atin + Overpass API │
└──────────────┘   └──────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│              n8n WORKFLOW ENGINE (5678)                   │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌────────────┐ │
│  │ verify-  │ │ weather-  │ │ ride-    │ │ hotel-     │ │
│  │ place    │ │ traffic   │ │ prices   │ │ prices     │ │
│  └────┬─────┘ └─────┬─────┘ └────┬─────┘ └──────┬─────┘ │
│       │             │            │               │        │
│       └──────┬──────┴──────┬────┴───────┬────────┘        │
│              ▼             ▼            ▼                  │
│         OpenRouter    Open-Meteo    OpenRouter             │
│         (LLM)         (Weather)     (LLM)                  │
└──────────────────────────────────────────────────────────┘
```

## 4.2 Data Flow

### 4.2.1 Place Search Flow
```
User Input → SearchPanel → API (searchPlaces) → Backend /api/search/places
  → geocoding_service.search_places()
    → _osm_search() [Nominatim API]
    → Local DB (bus_stops + metro_stations)
    → _ai_search() [LLM fallback if nothing found]
  → Sanitize coordinates
  → IF from OSM/local DB: _enrich_results()
    → LLM call for reviews/ratings (if light=False)
    → Image fetch from Wikipedia (parallel with Semaphore(3))
    → Hotel price fetch from n8n (parallel with Semaphore(3))
  → IF from AI: skip enrichment (AI already generated data)
  → Return enriched results to frontend
```

### 4.2.2 Route Planning Flow
```
User Input (source, dest, prefs) → AToBPanel → API (planRoute) → Backend /api/routes/plan
  → transit_service.get_route_legs_public()
    → _generate_bus_routes() [find nearby stops, compute fares]
    → _generate_metro_routes() [find nearby stations, compute fares]
    → _generate_kia_routes() [match stops to KIA routes]
    → _generate_multi_modal_routes() [bus→metro, metro→bus combos]
  → transit_service.get_driving_route() [OSRM API]
  → llm_agent.get_live_prices() [LLM for Uber/Ola/Rapido]
  → llm_agent.get_weather_impact() [wttr.in or LLM]
  → weather + time + group_size adjustments applied
  → TOPSIS sorting (fare 30%, time 35%, walk 15%, comfort 20%)
  → Return top 6 routes to frontend
```

### 4.2.3 Place Enrichment Flow (on-demand)
```
User clicks "View Details" → MainPage.handleViewDetails()
  → enrichPlace(place) API → Backend POST /api/search/enrich-place
  → geocoding_service.enrich_single_place(name, lat, lng, type, address)
    → LLM call for reviews/ratings/summary (diverse Indian names, varied text)
    → Wikipedia image fetch
    → Hotel price check via n8n (if hotel/lodge type)
  → Return enriched place → DiscoveryPanel opens with full details
```

## 4.3 Component Dependency Graph

```
App.tsx
├── MainPage.tsx
│   ├── MapView.tsx (Leaflet)
│   │   ├── TileLayer (OpenStreetMap)
│   │   ├── Marker (user location)
│   │   ├── Marker (source/destination)
│   │   └── Marker[] (all place pins)
│   ├── SearchPanel.tsx
│   │   ├── PlaceCard (reusable card component)
│   │   └── Mode Toggle (Search/Nearby)
│   ├── AToBPanel.tsx
│   │   ├── RouteCard (reusable card with timeline bar)
│   │   └── Preferences Panel
│   ├── TripPanel.tsx (placeholder)
│   └── DiscoveryPanel.tsx (floating overlay)
└── Types Module (index.ts)
    └── API Service Module (api.ts)
        └── Axios HTTP client
```

## 4.4 State Management

- **No Redux/Context** — state is managed via React `useState` and `useCallback` in App.tsx (root component)
- Props flow down from App → MainPage → individual panels
- Callbacks flow up from panels → MainPage → App for state mutations
- Key state variables:
  - `mode`: 'search' | 'atob' | 'trip'
  - `selectedPlace`: PlaceResult | null
  - `mapCenter`: [number, number]
  - `userLocation`: [number, number] | null
  - `sourceLocation`, `destLocation`: [number, number] | null
  - `allMarkers`: PlaceResult[]

---

# 5. Directory Structure & File Reference

## 5.1 Complete File Tree

```
VOYAGER/
├── .env                          # Environment variables (API keys)
├── .gitignore
├── PROMPT.docx                   # Original specification document
├── requirements.txt              # Python dependencies (root level)
├── VOYAGER_COMPLETE_DOCUMENTATION.md  # This file
├── stderr.log                    # Uvicorn server startup log
├── stdout.log                    # API request logs
├── images/                       # App screenshots
│   ├── Screenshot 2026-07-11 055001.png
│   ├── Screenshot 2026-07-11 055146.png
│   └── Screenshot 2026-07-11 055409.png
│
├── venv/                         # Python virtual environment (3.12.6)
│   └── Scripts/
│       ├── python.exe
│       ├── pip.exe
│       ├── uvicorn.exe
│       └── ...
│
├── backend/                      # FastAPI backend (port 8014)
│   ├── __init__.py
│   ├── main.py                   # App entry: CORS, routers, startup
│   ├── requirements.txt          # Python deps
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py             # Settings class (env vars, defaults)
│   │   └── database.py           # TransitDatabase singleton
│   ├── api/
│   │   ├── __init__.py
│   │   ├── search.py             # /api/search/* endpoints
│   │   └── routes.py             # /api/routes/* endpoints
│   ├── services/
│   │   ├── __init__.py
│   │   ├── geocoding.py          # OSM search, Overpass nearby, AI fallback, enrichment
│   │   ├── transit_service.py    # Route generation, TOPSIS scoring, OSRM
│   │   ├── n8n_service.py        # n8n webhook client
│   │   └── images.py             # Wikipedia image fetcher
│   ├── agents/
│   │   ├── __init__.py
│   │   └── llm_agent.py          # LLM orchestration + WebSearchAgent
│   └── models/
│       ├── __init__.py
│       └── transit.py            # Pydantic models
│
├── frontend/                     # React + Vite (port 3000)
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts            # Vite config with API proxy
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── src/
│       ├── main.tsx              # React entry
│       ├── index.css              # Global dark theme CSS
│       ├── App.tsx                # Root component
│       ├── types/
│       │   └── index.ts          # TypeScript interfaces
│       ├── utils/
│       │   └── helpers.ts        # Utility functions
│       ├── services/
│       │   └── api.ts            # Axios API client
│       ├── pages/
│       │   └── MainPage.tsx      # Main layout
│       └── components/
│           ├── SearchPanel.tsx    # Search mode panel
│           ├── AToBPanel.tsx      # A-to-B mode panel
│           ├── TripPanel.tsx      # Trip mode placeholder
│           ├── MapView.tsx        # Leaflet map
│           └── DiscoveryPanel.tsx  # Floating detail panel
│
├── ml/                           # Machine learning modules
│   ├── __init__.py
│   ├── topsis.py                 # TOPSIS multi-criteria analysis
│   ├── data_preprocessor.py      # CSV/data cleaning
│   └── astar.py                  # A* pathfinding on transit graph
│
├── scripts/                      # Utility and test scripts
│   ├── test_services.py
│   ├── test_reviews.py
│   ├── test_reviews2.py
│   ├── test_n8n.py
│   ├── test_images.py
│   ├── test_enrich.py
│   ├── test_full_search.py
│   ├── test_full_search2.py
│   ├── gen_workflows.py
│   ├── gen_ride_price_wf.py
│   ├── gen_hotel_price_wf.py
│   ├── gen_new_workflows.py
│   ├── create_wf_api.py
│   └── import_n8n_workflows.py
│
├── workflows/                    # n8n workflow JSON definitions
│   ├── place_verification.json
│   ├── weather_traffic_check.json
│   ├── ride_price_estimation.json
│   ├── hotel_price_check.json
│   ├── test_wf.json
│   └── test_format.json
│
└── data_cache/                   # Transit datasets
    ├── transit_fares.json
    ├── bengaluru_metro_network.csv
    ├── bmtc_all_stops_master.csv
    ├── kia_routes_fare_full.json
    ├── KIA_stops_fare_incomplete.json
    ├── bangalore_ride_data.csv
    ├── rides_data.csv
    ├── traffic_logs.csv
    ├── metro.csv
    ├── NammaMetro_Ridership_Dataset.csv
    ├── metro_per_hour_tickets_purchased.csv
    ├── bangalore-wards-2018-1-All-MonthlyAggregate.csv
    ├── bangalore-wards-2018-2-All-MonthlyAggregate.csv
    ├── bangalore-wards-2018-3-All-MonthlyAggregate.csv
    └── bangalore-wards-2018-4-All-MonthlyAggregate.csv
```

## 5.2 Backend API Endpoints Complete Reference

| Method | Endpoint | Description | Source File |
|--------|----------|-------------|-------------|
| GET | `/` | Root redirect to /docs | main.py |
| GET | `/health` | Health check + DB stats | main.py |
| GET | `/api/n8n-status` | n8n workflow status | main.py |
| GET | `/api/search/places` | Search places by query | search.py |
| GET | `/api/search/nearby` | Search nearby by type + radius | search.py |
| GET | `/api/search/suggestions` | Autocomplete suggestions | search.py |
| GET | `/api/search/verify-place` | Verify a place's reliability | search.py |
| GET | `/api/search/ai-chat` | AI chat response | search.py |
| POST | `/api/search/enrich-place` | Enrich a single place on-demand | search.py |
| GET | `/api/search/ride-prices` | Get Uber/Ola/Rapido prices | search.py |
| GET | `/api/search/current-events` | Get current travel events | search.py |
| POST | `/api/routes/plan` | Plan route (all modes) | routes.py |
| GET | `/api/routes/metro-stations` | Get metro stations by line | routes.py |
| GET | `/api/routes/bus-stops` | Get bus stops | routes.py |
| GET | `/api/routes/kia-routes` | Get KIA bus routes | routes.py |
| GET | `/api/routes/transit-fares` | Get transit fare tables | routes.py |
| GET | `/api/routes/live-prices` | Get live ride prices | routes.py |

## 5.3 Frontend Component Props Interface

### SearchPanel Props
```typescript
interface SearchPanelProps {
  onSelectPlace: (place: PlaceResult) => void
  onNavigateToPlace: (place: PlaceResult) => void
  mapCenter: [number, number]
  userLocation: [number, number] | null
  onSearchResults: (results: PlaceResult[], center?: [number, number]) => void
  onNearbyResults: (results: PlaceResult[]) => void
  onViewOnMap: (place: PlaceResult) => void
  onNearbyAroundPlace: (place: PlaceResult) => void
  onMapCenterChange?: (center: [number, number]) => void
  onViewDetails?: (place: PlaceResult) => void
  enrichingName?: string | null
}
```

### AToBPanel Props
```typescript
interface AToBPanelProps {
  sourceLocation: [number, number] | null
  destLocation: [number, number] | null
  onSourceLocationChange: (loc: [number, number] | null) => void
  onDestLocationChange: (loc: [number, number] | null) => void
  onMapCenterChange: (center: [number, number]) => void
  mapRef: React.MutableRefObject<any>
}
```

### DiscoveryPanel Props
```typescript
interface DiscoveryPanelProps {
  place: PlaceResult
  onClose: () => void
}
```

---

# 6. Backend Deep Dive

## 6.1 `main.py` — Application Entry Point

**Purpose**: Initializes and runs the FastAPI application.

Key behaviors:
- CORS middleware allows all origins (for development)
- On startup: initializes `TransitDatabase` singleton (loads all datasets)
- Includes routers: `search.router` and `routes.router`
- Health endpoint returns status + DB stats (metro stations, bus stops, KIA routes)
- n8n-status endpoint pings all 4 workflow webhooks

## 6.2 `core/config.py` — Configuration

**Purpose**: Single source of truth for all configuration values.

```python
class Settings(BaseSettings):
    APP_NAME: str = "VOYAGER - Bengaluru Transit Navigator"
    APP_VERSION: str = "1.0.0"
    DATA_CACHE_DIR: str = "../data_cache"
    BANGALORE_CENTER_LAT: float = 12.9716
    BANGALORE_CENTER_LNG: float = 77.5946
    BANGALORE_DEFAULT_ZOOM: int = 12
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    FUEL_PRICE_PER_LITER: float = 110.0  # Petrol price INR
    PETROL_AVG_MILEAGE: float = 15.0    # km per liter
    LLM_PROVIDER: str = "openrouter"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    OPENROUTER_FALLBACK_MODELS: list = []
    GEMINI_API_KEY: str = ""
    N8N_WEBHOOK_URL: str = "http://localhost:5678/webhook"
    DEBUG: bool = True
```

## 6.3 `core/database.py` — Transit Data Layer

**Purpose**: Singleton that loads and provides access to all transit datasets.

### Loaded Datasets:
1. **Metro Stations** (86 stations) from `bengaluru_metro_network.csv`
   - Fields: name, line, lat, lng, station_code, next_station_code, distance_to_next_km, is_interchange, sequence
   - Organized by line (Purple Line, Green Line)
   - Distance cache: pre-computed distances between any two stations on the same line

2. **Bus Stops** (2,973 stops) from `bmtc_all_stops_master.csv`
   - Fields: name, lat, lng, routes (parsed from JSON string)
   - Indexed by stop_id

3. **KIA Routes** (14 routes) from `kia_routes_fare_full.json`
   - Each route has route_info + stops array with stop names and fares

4. **Transit Fares** from `transit_fares.json`
   - Namma Metro: 9 slabs (₹11-95)
   - BMTC Ordinary: 26 slabs (₹6-32)
   - BMTC AC Vajra: 24 slabs (₹15-65)

### Key Methods:
- `get_metro_fare(distance_km)` — Returns metro fare based on distance slabs
- `get_bmtc_ordinary_fare(distance_km, passenger_type)` — Returns BMTC ordinary fare (adult/child/senior)
- `get_bmtc_ac_fare(distance_km, passenger_type)` — Returns BMTC AC Vajra fare
- `get_metro_distance_between(stn_a, stn_b)` — Returns rail distance between metro stations using cached distances
- `find_nearby_bus_stops(lat, lng, radius_km)` — Returns bus stops within radius, sorted by distance
- `find_nearby_metro_stations(lat, lng, radius_km)` — Returns metro stations within radius
- `get_kia_route_for_stop(stop_name)` — Returns KIA routes serving a given stop

## 6.4 `services/geocoding.py` — Place Search Engine

**Purpose**: Multi-source place search with progressive fallback and enrichment.

### Search Strategy (search_places method):
1. **OSM Nominatim** (`_osm_search`): Direct geocoding API query with bounding box restricted to Bengaluru (12.8-13.2 lat, 77.4-77.8 lng). Returns real places with OSM tags mapped to 25 internal types.
2. **Local Database**: Searches BMTC bus stops and Namma Metro stations by name match.
3. **AI Fallback** (`_ai_search`): If nothing found, calls LLM to generate plausible places with coordinates. Returns 10 results with basic data.
4. **Enrichment** (`_enrich_results`): For OSM/local results:
   - If `light=True` (nearby mode): Skip LLM reviews, skip images, skip hotel prices
   - If `light=False` (full search): Call LLM for ratings, reviews (2-4 per place with diverse Indian names), review summaries, reliability scores
   - Images fetched from Wikipedia in parallel (Semaphore(3))
   - Hotel prices fetched via n8n (Semaphore(3))
5. **Dedup**: Results deduplicated by rounded coordinates

### Nearby Search (get_nearby_places method):
- Queries Overpass API with type-specific OSM tag
- "All" mode uses batched union queries (5 tags per request) for speed
- Returns results sorted by distance
- Uses `light=True` enrichment

### Place Type Mapping:
25 place types mapped from OSM tags:
- Mall, Hospital, Clinic, ATM, Bank, Restaurant, Cafe, Hotel, Lodge, Temple, Mosque, Church, School, Park, Petrol Pump, Charging Station, Police, Bus Stop, Metro Station, Airport, Railway Station, Pharmacy, Supermarket, Gym, Library, Cinema, Post Office, IT Hub

### Enrichment Details:
The enrichment LLM prompt demands:
- Diverse Indian reviewer names (pool of 20 unique names)
- Varied ratings (1-5, not all 4-5)
- Specific detailed review text (mentions food/ambience/service/cleanliness)
- No duplicate reviewers

## 6.5 `services/transit_service.py` — Route Generator

**Purpose**: Generates all possible transit routes between two points.

### Route Generation:
1. **Bus Routes** (`_generate_bus_routes`):
   - Finds nearest bus stop to source (1km radius)
   - Finds nearest bus stop to destination (1km radius)
   - Computes walking distance to/from stops
   - Computes bus travel distance, duration, fare
   - Generates both Ordinary (₹6-32) and AC Vajra (₹15-65) options

2. **Metro Routes** (`_generate_metro_routes`):
   - Finds nearest metro station to source (2km radius)
   - Finds nearest metro station to destination (2km radius)
   - Uses `get_metro_distance_between` for accurate rail distance
   - Computes metro fare from slab system
   - Shows metro line name in route leg

3. **KIA Routes** (`_generate_kia_routes`):
   - Matches source/destination stops to KIA route stops
   - Computes fare difference between matching stops
   - Returns KIA Vayu Vajra airport bus options

4. **Multi-Modal Routes** (`_generate_multi_modal_routes`):
   - Bus → Metro: Walk to bus stop → bus to metro station → metro to destination area → walk
   - Metro → Bus: Walk to metro → metro to interchange → bus to destination area → walk
   - Each combination tested with top 2 stops/stations

5. **TOPSIS Scoring** (`_topsis_score`):
   - Fare score (30%): max(0, 100 - fare/10)
   - Time score (35%): max(0, 100 - duration/2)
   - Walking score (15%): max(0, 100 - walk_km * 15)
   - Comfort score (20%): min(100, distance * 3 + walk_penalty)

### Driving Route:
- Calls OSRM (Open Source Routing Machine) API for car route
- Computes fuel cost: `distance / mileage * fuel_price_per_liter`
- Returns distance, duration, geometry (GeoJSON), and turn-by-turn steps

## 6.6 `services/n8n_service.py` — n8n Webhook Client

**Purpose**: HTTP client to n8n workflow webhooks with graceful fallback.

### Workflows Called:
1. `verify_place(name, address)` → POST `/webhook/verify-place`
2. `weather_impact(location)` → POST `/webhook/weather-traffic`
3. `get_ride_prices(source, dest)` → POST `/webhook/ride-prices`
4. `get_hotel_prices(name, address)` → POST `/webhook/hotel-prices`

### Behavior:
- Returns `None` if n8n is unavailable (calling code falls back to LLM)
- Extracts JSON from LLM text responses (handles markdown code blocks)
- Timeout set to 10 seconds per call

## 6.7 `services/images.py` — Image Service

**Purpose**: Fetches place images from Wikipedia API (free, no API key required).

### Strategy:
1. Search Wikipedia for the place name
2. If search finds pages, try the first page's thumbnail
3. If no thumbnail, try direct page fetch with the place name
4. On failure, try "Bangalore" + place_name
5. Returns Wikimedia URL or None

### Implementation Detail:
```python
async def get_place_image(self, name: str, place_type: str = None) -> str:
    # Step 1: Search Wikipedia
    search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={name}&format=json&srlimit=3"
    # Step 2: Get page thumbnail
    page_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={page_title}&prop=pageimages&pithumbsize=400&format=json"
    # Step 3: Return thumbnail URL or None
```

## 6.8 `agents/llm_agent.py` — LLM Orchestrator

**Purpose**: Central LLM calling interface with multiple model/providers.

### Model Chain:
1. Primary: `settings.OPENROUTER_MODEL` (default: `openai/gpt-4o-mini`)
2. Fallbacks: `settings.OPENROUTER_FALLBACK_MODELS` (5 models)
3. Gemini fallback: If all OpenRouter models fail and Gemini key is configured
4. Working model cached for subsequent calls

### Methods:
- `_call_llm(system_prompt, user_prompt, json_mode)` — Core LLM call with JSON mode support
- `search_places_ai(query, lat, lng)` — AI-based place search fallback
- `verify_place(name, address)` — Place verification (tries n8n first, falls back to LLM)
- `get_smart_suggestions(partial)` — AI-based suggestions
- `get_nearby_ai(lat, lng, place_type, radius)` — AI-based nearby search
- `get_travel_recs(source, dest, group_size, budget)` — Travel recommendations
- `get_live_prices(source, dest, mode)` — Ride price estimation
- `get_weather_impact(location)` — Weather + traffic analysis
- `get_current_events(location)` — Current travel alerts
- `chat_response(user_message, context)` — General chat

### Web Search Agent:
- `WebSearchAgent.search_web(query)` — Scrapes DuckDuckGo HTML results
- Used as fallback for current events and traffic news

---

# 7. Frontend Deep Dive

## 7.1 `App.tsx` — Root Component

**State Management**: All application state lives here and flows down via props.

```typescript
// Key State
const [mode, setMode] = useState<AppMode>('search')
const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
const [mapCenter, setMapCenter] = useState<[number, number]>([12.9716, 77.5946])
const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
const [sourceLocation, setSourceLocation] = useState<[number, number] | null>(null)
const [destLocation, setDestLocation] = useState<[number, number] | null>(null)
const [allMarkers, setAllMarkers] = useState<PlaceResult[]>([])
const mapRef = useRef<any>(null)
```

**Geolocation**: On mount, requests browser location. On success: sets userLocation + flies map to user.

**Key Handlers**:
- `handleSelectPlace`: Sets selected place, flies map, centers on place
- `handleMapCenterChange`: Updates map center AND flies map (fixed from just updating state)
- `handleNavigateToPlace`: Switches to A-to-B mode with current dest = place

## 7.2 `SearchPanel.tsx` — Search Mode

**Internal State**:
```typescript
const [query, setQuery] = useState('')
const [results, setResults] = useState<PlaceResult[]>([])
const [suggestions, setSuggestions] = useState<string[]>([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')
const [radius, setRadius] = useState(2)
const [activeTag, setActiveTag] = useState('all')
const [nearbyResults, setNearbyResults] = useState<PlaceResult[]>([])
const [mode, setMode] = useState<'search' | 'nearby'>('search')
const [searchedPlace, setSearchedPlace] = useState<PlaceResult | null>(null)
```

**Key Features**:
- Debounced suggestions (300ms delay via `useEffect` + `setTimeout`)
- PlaceCard sub-component renders each result with:
  - Green/red border + background based on reliability score
  - Image (collapsible on error)
  - Place name with type badge
  - Address, distance, rating, reliability score
  - Review summary
  - Individual reviews toggle (2-4 reviews with user, rating, date, text)
  - Price info for hotels
  - Action buttons: View Details, Navigate, Nearby here
- Enrichment tracking per-place via `enrichingName` string (only shows loading on the specific card being enriched)

## 7.3 `AToBPanel.tsx` — A-to-B Mode

**Internal State**:
```typescript
const [sourceQuery, setSourceQuery] = useState('')
const [destQuery, setDestQuery] = useState('')
const [sourceSuggestions, setSourceSuggestions] = useState<PlaceResult[]>([])
const [destSuggestions, setDestSuggestions] = useState<PlaceResult[]>([])
const [routes, setRoutes] = useState<RouteOption[]>([])
const [loading, setLoading] = useState(false)
const [selectedRoute, setSelectedRoute] = useState<number | null>(null)
const [travelMode, setTravelMode] = useState<'public' | 'personal' | 'walking'>('public')
const [prefs, setPrefs] = useState<UserPreferences>({
  budget: undefined, groupSize: 1, priority: 'balanced'
})
const [insights, setInsights] = useState('')
const [ridePrices, setRidePrices] = useState<RidePrice[]>([])
const [ridePricesLoading, setRidePricesLoading] = useState(false)
```

**Key Features**:
- Search-based suggestions (calls `searchPlaces` API with 300ms debounce)
- Current location button for source
- Preferences panel: group size, budget, priority selector
- Travel mode selector: Public Transit 🚌, Drive 🚗, Walk 🚶
- RouteCard sub-component:
  - Route header with type + fare
  - Stats: time, distance, walking, score
  - Visual timeline bar showing leg proportions (walk=gray, bus=blue, AC bus=purple, metro=green, car=orange, cab=yellow)
  - Route legs with mode icons, metro line names, distances, durations, fares, instructions
- Ride prices (Uber/Ola/Rapido) shown in separate section

## 7.4 `MapView.tsx` — Leaflet Map

**Key Features**:
- OpenStreetMap tiles with attribution
- Custom markers using `L.divIcon` with emoji HTML
- User location: glowing blue 📍 pin
- Source/destination: green 🟢 / red 🔴 pins
- Place markers: green 🟢 or red 🔴 indicator + type-specific emoji
- Selected place: larger pin (34px vs 24px)
- Marker popups: name, address, rating, reliability, review summary, price info
- 25+ place type emoji mappings

## 7.5 `DiscoveryPanel.tsx` — Place Detail Overlay

**Key Features**:
- Floating panel positioned at top-right of map
- Shows: image, rating, reliability score, address, place type
- Review summary section
- Individual reviews (up to 4) with toggle show/hide
- Price info for hotels/lodges
- Hotel price breakdown (n8n-fetched): avg price, range, review score, brief summary
- Distance from user
- Reliability score bar (green/red gradient)
- Close button (✕)

## 7.6 CSS Design System (`index.css`)

**Dark Theme**:
- Background: `#0b1120` (deep navy)
- Card background: `#1e293b` (slate)
- Text: `#f1f5f9` (light gray)
- Accent: `#3b82f6` (blue), `#22c55e` (green), `#ef4444` (red)
- Scrollbar: custom dark styling
- Transitions: smooth on hover/selection

**Sidebar**:
- Fixed width: 420px
- Header with app logo and location button
- Mode tabs (Search, A-to-B, Trip)
- Scrollable content area with custom scrollbar

**Components**:
- Inputs: dark background, white text, rounded
- Buttons: pill-shaped, active state highlighting
- Cards: rounded with colored borders (green/red)
- Dropdown suggestions: absolute positioning with dark background

---

# 8. Datasets & Data Layer

## 8.1 Dataset Inventory

| # | File | Type | Records | Size | Description |
|---|------|------|---------|------|-------------|
| 1 | `transit_fares.json` | JSON | 3 tables | 4 KB | Metro + BMTC fare slabs |
| 2 | `bengaluru_metro_network.csv` | CSV | 86 rows | 7 KB | Metro stations + lines |
| 3 | `bmtc_all_stops_master.csv` | CSV | 2,973 rows | 448 KB | BMTC bus stops |
| 4 | `kia_routes_fare_full.json` | JSON | 14 routes | 13 KB | KIA airport bus routes |
| 5 | `KIA_stops_fare_incomplete.json` | JSON | (corrupt) | 7 KB | Old KIA data |
| 6 | `bangalore_ride_data.csv` | CSV | 200,001 rows | 22 MB | Ride-hailing historical data |
| 7 | `rides_data.csv` | CSV | 50,001 rows | 4 MB | Synthetic ride records |
| 8 | `traffic_logs.csv` | CSV | 445,843 rows | 9 MB | Traffic simulation |
| 9 | `metro.csv` | CSV | 1,356 rows | 246 KB | Hourly ticket purchases |
| 10 | `NammaMetro_Ridership_Dataset.csv` | CSV | 433 rows | 185 KB | Daily ridership |
| 11 | `metro_per_hour_tickets_purchased.csv` | CSV | 27,517 rows | 3 MB | Granular hourly data |
| 12 | `bangalore-wards-2018-Q1.csv` | CSV | 113,141 rows | 4 MB | Ward travel times Q1 |
| 13 | `bangalore-wards-2018-Q2.csv` | CSV | 114,430 rows | 4 MB | Ward travel times Q2 |
| 14 | `bangalore-wards-2018-Q3.csv` | CSV | 113,767 rows | 4 MB | Ward travel times Q3 |
| 15 | `bangalore-wards-2018-Q4.csv` | CSV | 112,987 rows | 4 MB | Ward travel times Q4 |

## 8.2 Fare Structure Details

### Namma Metro (Distance-based slabs)
| Max Distance (km) | Fare (₹) |
|:---:|:---:|
| 2 | 11 |
| 4 | 21 |
| 6 | 32 |
| 8 | 42 |
| 10 | 53 |
| 15 | 63 |
| 20 | 74 |
| 25 | 84 |
| >25 | 95 |

### BMTC Ordinary (Distance-based slabs)
| Max Distance (km) | Adult Fare (₹) | Child (50%) | Senior (75%) |
|:---:|:---:|:---:|:---:|
| 2 | 6 | 3 | 4.50 |
| 4 | 12 | 6 | 9 |
| 6 | 18 | 9 | 13.50 |
| 8 | 23 | 11.50 | 17.25 |
| 10-20 | 23-28 | 11.50-14 | 17.25-21 |
| 20-40 | 28-30 | 14-15 | 21-22.50 |
| >40 | 32 | 16 | 24 |

### BMTC AC Vajra (Distance-based slabs)
| Max Distance (km) | Adult Fare (₹) | Child Fare (₹) | Senior Fare (₹) |
|:---:|:---:|:---:|:---:|
| 2 | 15 | 10 | 15 |
| 4 | 19 | 12 | 19 |
| 6 | 24 | 15 | 24 |
| 8 | 28 | 17 | 28 |
| 10 | 33 | 20 | 33 |
| 12 | 37 | 22 | 37 |
| ... | | | |
| >40 | 65 | 40 | 65 |

## 8.3 Metro Network Structure

### Purple Line (Whitefield ↔ Challaghatta)
- 37 stations
- Color: `#7E22CE`
- Key stations: Whitefield, Baiyappanahalli, MG Road, Majestic, Mysore Road, Kengeri, Challaghatta

### Green Line (Nagasandra ↔ Silk Institute)
- 30 stations  
- Color: `#15803D`
- Key stations: Nagasandra, Yeshwanthpur, Majestic, Chickpet, KR Market, Banashankari, Yelachenahalli, Silk Institute

### Interchange Stations
- **Majestic (Nadaprabhu Kempegowda Station)**: Purple ↔ Green line interchange
- 14 other interchange stations

## 8.4 Bus Stop Data Detail

Each of the 2,973 BMTC bus stops has:
- Stop name
- Latitude/Longitude
- Number of trips serving the stop
- Booth code
- Routes serving the stop (as JSON string of route_id → trip_count mappings)

Example route codes: `D35G-BVRH`, `242-LA`, `374-MA`, `221-L`, `242-T`, etc.

## 8.5 KIA Airport Bus Routes

14 routes serving Kempegowda International Airport:
- KIA-4: HAL Main Gate → KIA (via Hebbala, Mekhri Circle, etc.)
- KIA-4A, KIA-5, KIA-5D, KIA-6, KIA-6A, KIA-7, KIA-7A, KIA-8, KIA-8A, KIA-8C, KIA-8D, KIA-8E, KIA-9, KIA-10, KIA-14, KIA-15, KIA-15A, KIA-17
- Fares range from ₹0 (KIA itself) to ₹310 (end stops)

---

# 9. n8n Workflow Integration

## 9.1 Overview

n8n (localhost:5678) runs 4 workflows that serve as LLM-powered microservices. Each exposes a webhook endpoint that the backend calls via HTTP POST.

## 9.2 Workflow 1: Place Verification

**Endpoint**: `POST /webhook/verify-place`
**Input**: `{ "name": "Place Name", "address": "Address" }`
**Output**: 
```json
{
  "reliability_score": 0.85,
  "rating": 4.2,
  "review_summary": "A well-maintained mall with good parking and diverse stores",
  "is_recommended": true,
  "concerns": null
}
```
**Nodes**: Webhook → OpenRouter (GPT-4o-mini) → Respond
**Prompt**: "Verify this Bengaluru place: {name}. Address: {address}. Return JSON..."

## 9.3 Workflow 2: Weather & Traffic Check

**Endpoint**: `POST /webhook/weather-traffic`
**Input**: `{ "location": "Bengaluru" }`
**Output**:
```json
{
  "condition": "Partly Cloudy",
  "temperature_celsius": "28",
  "impact": "minor",
  "recommendation": "Good for travel",
  "traffic_alert": null
}
```
**Nodes**: Webhook → Open-Meteo API → OpenRouter → Respond
**Open-Meteo URL**: Free weather API with current conditions + daily forecast

## 9.4 Workflow 3: Ride Price Estimation

**Endpoint**: `POST /webhook/ride-prices`
**Input**: `{ "source": "Koramangala", "destination": "Whitefield" }`
**Output**:
```json
[
  { "provider": "Uber", "mode": "cab_economy", "price": 350, "eta_minutes": 12, "note": "Standard pricing" },
  { "provider": "Ola", "mode": "cab_economy", "price": 380, "eta_minutes": 15, "note": "Peak hour" },
  { "provider": "Rapido", "mode": "bike", "price": 120, "eta_minutes": 18, "note": "Fastest option" }
]
```

## 9.5 Workflow 4: Hotel Price Check

**Endpoint**: `POST /webhook/hotel-prices`
**Input**: `{ "name": "Hotel Name", "address": "Address" }`
**Output**:
```json
{
  "min_price": 2500,
  "max_price": 5500,
  "avg_price": 3500,
  "currency": "INR",
  "source": "MakeMyTrip",
  "review_score": 4.1,
  "brief_summary": "Mid-range business hotel with good reviews"
}
```

## 9.6 Graceful Degradation

If n8n is down or returns an error:
1. Backend catches the exception in `n8n_service.py`
2. Returns `None` to the calling code
3. Calling code (`geocoding.py`, `routes.py`) falls back to:
   - Direct OpenRouter LLM call via `llm_agent.py`
   - Or wttr.in for weather
   - Or sensible defaults

---

# 10. LLM & AI Agent Architecture

## 10.1 Primary LLM: OpenRouter (GPT-4o-mini)

- **Model**: `openai/gpt-4o-mini` (fast, cheap, capable)
- **Cost**: ~$0.15 per million input tokens, ~$0.60 per million output tokens
- **Fallback models**: 5 additional OpenAI/OpenRouter models in priority order
- **Configuration**: `OPENROUTER_API_KEY` in `.env`
- **API**: `https://openrouter.ai/api/v1/chat/completions`

### Call Characteristics:
- **Temperature**: 0.3 (consistent, reproducible outputs)
- **Max tokens**: 1024 per call
- **JSON mode**: Used for structured data extraction (places, reviews, prices)
- **Timeout**: 15 seconds per model attempt
- **Retry**: 5 fallback models before giving up

### Usage Distribution:
| Use Case | Approx Calls per Search | Tokens per Call |
|----------|------------------------|-----------------|
| AI place search (fallback) | 1 | ~300 |
| Enrichment (reviews + ratings) | 1 per 8 places | ~500 |
| Single place enrichment | 1 per "View Details" click | ~400 |
| Ride price estimation | 1 per A-to-B plan | ~200 |
| Travel recommendations | 1 per route plan | ~300 |
| Smart suggestions | 1 per keystroke (debounced) | ~100 |

## 10.2 Fallback: Google Gemini

- **Model**: `gemini-1.5-flash` → `gemini-1.5-pro` → `gemini-pro`
- **Configuration**: `GEMINI_API_KEY` in `.env`
- **Activation**: Only when all OpenRouter models fail
- **Library**: `google-generativeai` Python package

## 10.3 Agentic AI Workflow

### Place Verification Agent:
```
User searches "Yelahanka"
  → OSM returns nothing (no geocoding match)
  → AI Agent searches (generates 10 realistic places)
    → "Yelahanka Satellite Town" (lat: 13.1, lng: 77.58)
    → "Yelahanka New Town" (lat: 13.12, lng: 77.56)
    → ... (8 more)
  → If from OSM: Enrichment Agent activates
    → Reviews Agent: "For each place, provide realistic data..."
    → Image Agent: Fetch Wikipedia images in parallel
    → Hotel Price Agent: Check if hotel/lodge via n8n
  → If from AI: Skip enrichment (data already embedded)
```

### Route Recommendation Agent:
```
User plans route Koramangala → Whitefield
  → Transit Engine generates 8 possible routes
  → Weather Agent checks current conditions (Open-Meteo + LLM)
  → Time Agent checks current hour (is it night?)
  → Safety Agent adjusts scores for time/weather
  → TOPSIS Engine ranks:
    1. Car (₹50 fuel, 25min) — Score: 88
    2. Metro → Bus (₹70, 45min) — Score: 82
    3. Bus Direct (₹25, 60min) — Score: 78
    4. Cab via n8n (₹350, 20min) — Score: 72
    5. Walk (₹0, 5hrs) — Score: 10
  → LLM summarizes recommendations in plain language
```

## 10.4 Prompt Engineering

### Enrichment Prompt (diverse reviews):
```
For each Bengaluru place below, provide realistic data.
Return a JSON array. Each object: name, rating (1.0-5.0), reliability_score (0.0-1.0),
review_summary (brief 10-20 word summary), is_recommended (bool), price_info (string if hotel/lodge, else null),
reviews (array of 2-4 objects with: user (DIFFERENT Indian names from this list each time:
  Priya Sharma, Arun Kumar, Sneha Patel, Ravi Desai, Lakshmi Nair, Vikram Singh,
  Anjali Gupta, Rajesh Iyer, Deepa Menon, Suresh Reddy, Meera Joshi, Sanjay Pillai,
  Kavita Rao, Manoj Verma, Pooja Malhotra, Siddharth Bose, Nandini Rajan,
  Karthik Subramanian, Aisha Sheikh, Prakash Rao),
  rating (1-5 int, vary them), text (specific detailed review), date ("2 weeks ago", etc.)).
CRITICAL: Each review must have a DIFFERENT name, DIFFERENT rating, and DIFFERENT text.
No two reviews should repeat the same person.
Places: ["Mantri Square Mall", "Forum Mall", "Orion Mall"]
```

### AI Place Search Prompt:
```
Find 10 REAL places matching "{query}" near ({lat},{lng}) in Bengaluru.
Return JSON array. Each: name, place_type, lat, lng, rating, review_summary, address, is_recommended.
CRITICAL: Mix of ratings. Some places should be 2.5-3.5 with is_recommended=false.
Only return places that exist in Bengaluru with real coordinates.
```

---

# 11. ML Modules (TOPSIS, A*)

## 11.1 TOPSIS (`ml/topsis.py`)

**Technique for Order of Preference by Similarity to Ideal Solution (TOPSIS)**

A multi-criteria decision analysis method that:
1. Normalizes the decision matrix
2. Determines ideal best and ideal worst for each criterion
3. Calculates Euclidean distance from each alternative to ideal best/worst
4. Computes relative closeness (score)

### Criteria Weights:
| Criterion | Weight | Direction |
|-----------|--------|-----------|
| Cost (fare) | 0.25 | Lower is better |
| Time (duration) | 0.30 | Lower is better |
| Comfort (mode quality) | 0.15 | Higher is better |
| Safety (at given time) | 0.15 | Higher is better |
| Walking distance | 0.10 | Lower is better |
| Weather suitability | 0.05 | Higher is better |

### Implementation:
- Input: Array of route alternatives with criterion values
- Output: Ranked alternatives with scores 0-100
- Currently the inline version in `transit_service.py` is used in production
- The `ml/topsis.py` module is available for future expansion

## 11.2 A* Pathfinding (`ml/astar.py`)

**A* search algorithm on a transit graph** built from:
- Nodes: Metro stations + Bus stops (connected by walking edges)
- Edges: Transit connections (metro lines, bus routes) with weights = time * cost_factor

### Graph Construction:
- Metro stations connected along line sequences
- Bus stops connected by walking (if within 500m)
- Interchange stations connect different lines
- Edge weights: `duration_minutes * (1 + congestion_factor)`

### Usage:
- Currently not directly called from the API
- Available as an alternative to the inline route generation in `transit_service.py`
- Would be used for: finding shortest path through complex multi-modal networks

## 11.3 Data Preprocessor (`ml/data_preprocessor.py`)

**Purpose**: Clean and validate raw CSV files before use.

Operations:
- Removes rows with missing lat/lng
- Validates coordinate ranges (Bengaluru bounding box)
- Normalizes column names to snake_case
- Converts data types
- Handles encoding issues
- Outputs cleaned files to `data_cache/processed/`

---

# 12. What Has Been Built (Completed Features)

## 12.1 Backend (100% Operational)

### Search Engine (`geocoding.py`)
- [x] OSM Nominatim geocoding with Bengaluru bounding box
- [x] Overpass API nearby POI search (25 place types)
- [x] AI fallback place search via OpenRouter LLM
- [x] Local database search (bus stops, metro stations)
- [x] Place enrichment pipeline (LLM reviews + Wikipedia images + n8n hotel prices)
- [x] Light-weight nearby mode (skips LLM for speed)
- [x] On-demand single-place enrichment
- [x] Deduplication by coordinate rounding
- [x] Proper OSM tag → place type mapping (25 types)
- [x] Temple/Mosque/Church differentiation by religion tag
- [x] Brand/operator name fallback for unnamed OSM places

### Route Engine (`transit_service.py`)
- [x] Bus route generation (ordinary + AC Vajra) with real fare slabs
- [x] Metro route generation with line names
- [x] KIA airport bus route generation (from dataset)
- [x] Multi-modal routes (bus→metro, metro→bus)
- [x] Driving route via OSRM with fuel cost calculation
- [x] Walking route for short distances
- [x] TOPSIS scoring with 4 weighted criteria
- [x] Weather-aware score adjustment
- [x] Time-of-day-aware score adjustment (night safety)
- [x] Group-size-aware score adjustment

### Data Layer (`database.py`)
- [x] Transit singleton with lazy initialization
- [x] Metro network loading (86 stations, 2 lines, distance cache)
- [x] BMTC stops loading (2,973 stops with routes)
- [x] KIA routes loading (14 routes)
- [x] Fare slab loading (3 tables)
- [x] Nearest stop/station finder
- [x] Metro distance between stations (cached)
- [x] Passenger-type-aware fare calculation (adult/child/senior)

### AI Agent (`llm_agent.py`)
- [x] OpenRouter integration with fallback models
- [x] Gemini fallback integration
- [x] JSON mode for structured data extraction
- [x] Place search AI fallback
- [x] Place verification via LLM
- [x] Smart suggestions via LLM
- [x] Travel recommendations
- [x] Live ride price estimation
- [x] Weather impact analysis
- [x] Current events / travel alerts
- [x] Web search agent (DuckDuckGo)
- [x] General chat mode

### n8n Integration (`n8n_service.py`)
- [x] 4 workflow webhook callers with timeout
- [x] JSON extraction from LLM responses
- [x] Graceful fallback when n8n is down

### Image Service (`images.py`)
- [x] Wikipedia API search → thumbnail
- [x] Fallback to direct page title
- [x] Fallback to "Bangalore + name" search
- [x] User-Agent header for Wikipedia compliance

### API Layer
- [x] 17 RESTful endpoints with proper parameter validation
- [x] CORS configuration
- [x] Health check + n8n status endpoints
- [x] Startup DB initialization

## 12.2 Frontend (100% Operational)

### Core
- [x] React + TypeScript + Vite setup
- [x] Dark theme CSS design system
- [x] Sidebar + map layout
- [x] Mode tabs (Search / A-to-B / Trip)
- [x] Browser geolocation integration
- [x] MapRef for programmatic map control
- [x] Current-location button in sidebar header (circular, flies map)

### Search Mode
- [x] Text input with autocomplete suggestions (debounced 300ms)
- [x] Search results list with PlaceCard component
- [x] Nearby mode with 25 place-type tag buttons
- [x] Radius slider (0.5-10 km)
- [x] PlaceCard: image, rating, reviews, type badge, actions
- [x] "View Details" with on-demand enrichment (per-card loading)
- [x] Green/red reliability indicators
- [x] Navigate → A-to-B integration
- [x] Nearby around place → re-centers nearby search
- [x] Suggestions dropdown with keyboard navigation

### A-to-B Mode
- [x] Source/destination inputs with live search suggestions
- [x] Current location button for source
- [x] Travel preferences panel (group size, budget, priority)
- [x] Mode selector (Public Transit / Drive / Walk)
- [x] Route card with visual timeline bar
- [x] Metro line names in route legs
- [x] Ride price estimates (Uber/Ola/Rapido)
- [x] Route planning with loading state
- [x] Map auto-bounds to source→dest

### Map
- [x] OpenStreetMap tiles
- [x] User location pin (glowing blue 📍)
- [x] Source/destination pins (green/red)
- [x] Place markers with type emojis + reliability colors
- [x] Selected place larger pin
- [x] Marker popups with details
- [x] FlyTo on place selection

### Discovery Panel
- [x] Floating overlay at top-right
- [x] Place image display
- [x] Rating + reliability score display
- [x] Review summary + individual reviews toggle
- [x] Hotel price breakdown (n8n-fetched)
- [x] Distance from user
- [x] Reliability score bar

## 12.3 Workflow Engine (n8n)

- [x] 4 production workflows created and deployed
- [x] Place verification workflow (active)
- [x] Weather + traffic check workflow (active)
- [x] Ride price estimation workflow (active)
- [x] Hotel price check workflow (active)
- [x] OpenRouter integration in all workflows
- [x] Open-Meteo integration for weather

## 12.4 ML Modules

- [x] TOPSIS implementation (standalone, plus inline version in service)
- [x] A* pathfinding on transit graph
- [x] Data preprocessor for CSV cleaning

## 12.5 Utilities & Testing

- [x] 12 test scripts for individual components
- [x] Workflow generation scripts (6 scripts)
- [x] n8n API-based workflow deployment script

---

# 13. What Remains To Be Built

## 13.1 Critical (High Priority)

### Mini-Path Interactive Selection (A-to-B Enhancement)
- **What**: User picks transport per journey segment (e.g., choose bus for leg 1, metro for leg 2)
- **Why**: Core requirement from spec — user must be able to customize each leg
- **How**: 
  - Add "Select Transport" buttons per leg in RouteCard
  - Backend returns all available options per leg (not just the top choice)
  - Frontend shows alternatives when user clicks a leg
  - Selected options stored in state, combined into final route
- **Files**: `AToBPanel.tsx`, `transit_service.py`

### Personal Vehicle Mode with Live Directions
- **What**: Show turn-by-turn directions for car/walk mode, like Google Maps
- **Why**: Spec requires dynamic directions with nearby suggestions
- **How**:
  - OSRM already returns `steps` array with turn instructions
  - Parse and display in frontend as step-by-step list
  - Show nearby petrol pumps/shops along the route (using OSM query)
- **Files**: `AToBPanel.tsx`, `transit_service.py`

### Real Reviews from Web
- **What**: Replace LLM-generated reviews with real Google Maps / Justdial reviews
- **Why**: User reported reviews are "fake" with same names repeating
- **How**:
  - Build n8n workflow that scrapes Google Maps reviews (via Google Places API or web scraping)
  - Alternative: Use SerpAPI / Google Custom Search for review snippets
  - Fallback: Improve LLM prompt with 30+ diverse names and contextual review text
- **Files**: `n8n_service.py`, `geocoding.py` (enrichment prompts)

### BMTC Bus Number Display
- **What**: Show actual bus route numbers (e.g., "500C", "G-6") in route legs instead of just "BMTC Ordinary Bus"
- **Why**: Users need to know which bus to board
- **How**:
  - Dataset already has routes per stop (`Routes with num trips` field)
  - Find common routes between source and destination stops
  - Display route IDs in leg instructions
- **Files**: `transit_service.py`, `database.py`

## 13.2 Medium Priority

### Metro → Metro Interchange Routing
- **What**: Routes that use both Purple and Green lines via interchange stations
- **Why**: Currently only same-line metro routes generated
- **How**: Add interchange station (Majestic) as mid-point, combine Purple + Green segments
- **Files**: `transit_service.py`

### Traffic-Aware Route Timing
- **What**: Use historical traffic data to adjust route durations
- **Why**: Current timing uses fixed speeds (25 km/h bus, 35 km/h metro)
- **How**: 
  - Load ward-to-ward travel time datasets (Q1-Q4 2018)
  - Map source/dest to wards, look up historical travel times
  - ML model predicts current travel time based on time-of-day + historical data
- **Files**: `ml/data_preprocessor.py`, `transit_service.py`, `database.py`

### Ride Price Integration with Real Data
- **What**: Replace LLM-estimated ride prices with real-time Uber/Ola API data
- **Why**: LLM estimates are approximate at best
- **How**:
  - Apply for Uber API access token
  - Or use n8n to scrape ride prices from provider websites
  - Or use historical ride data to train a price prediction model
- **Files**: `n8n_service.py`, `routes.py`

### TOPSIS Full Integration
- **What**: Use dedicated `ml/topsis.py` module instead of inline scoring
- **Why**: Separate concerns, easier to maintain, more sophisticated
- **How**:
  - Refactor `transit_service.py` to call `topsis.TOPSIS.rank()` 
  - Add all 7 criteria (cost, time, comfort, safety, walking, availability, weather)
- **Files**: `transit_service.py`, `ml/topsis.py`

## 13.3 Lower Priority

### Trip Mode (Feature 3)
- **What**: Multi-stop itinerary planner with saved trips
- **Why**: Third core feature of the app
- **How**: 
  - Multi-stop input UI (add intermediate destinations)
  - Day trip template (e.g., "Palace → Market → Park → Dinner")
  - Trip persistence in localStorage
  - Export trip as text/email
- **Files**: `TripPanel.tsx`, new API endpoints

### User Accounts & Favorites
- **What**: Save favorite places and routes
- **Files**: New `auth.py`, `User` model, database

### PWA / Mobile Support
- **What**: Progressive Web App for mobile installation
- **Files**: `manifest.json`, service worker

### Dark/Light Theme Toggle
- **Files**: `index.css` theme variables

### Multi-Language Support
- **Files**: i18n configuration

### Advanced Map Features
- What: 3D buildings, traffic overlay, satellite view
- Files: `MapView.tsx`

---

# 14. Known Issues & Limitations

## 14.1 Technical Limitations

### LLM-Generated Reviews Are Not Real
- **Issue**: All reviews are synthetically generated by GPT-4o-mini
- **Impact**: Same patterns repeat, names repeat across different places
- **Status**: Mitigated with 20-name pool + strict uniqueness prompt, but still not real
- **Fix**: Real review integration (see Section 13.1)

### OSM Geocoding Incomplete for Some Areas
- **Issue**: Nominatim doesn't always find less-known areas (e.g., "Yelahanka" found nothing)
- **Impact**: Falls to AI-generated places which may have inaccurate coordinates
- **Status**: Acceptable for now — AI fallback provides reasonable results

### No Real-Time Bus Tracking
- **Issue**: BMTC doesn't provide real-time GPS API publicly
- **Impact**: Bus arrival times are estimated (speed = 25 km/h)
- **Status**: Can be improved with historical data + prediction

### Weather Data Limited
- **Issue**: Uses Open-Meteo (free) vs paid weather APIs
- **Impact**: Only basic current conditions, no detailed forecast
- **Status**: Sufficient for route recommendation logic

### n8n Workflow Reliability
- **Issue**: n8n can crash/restart, workflows may deactivate
- **Impact**: Hotel/ride prices fall back to LLM estimation
- **Status**: Graceful degradation in place

## 14.2 UX Issues

### Mobile Responsiveness
- **Issue**: Sidebar is 420px fixed — doesn't work on mobile
- **Status**: Not yet addressed (desktop-first)

### Review Quality
- **Issue**: Reviews sometimes feel generic despite improved prompts
- **Impact**: Users notice same patterns across different places
- **Status**: Ongoing improvement

### Map Performance with Many Markers
- **Issue**: 50+ markers on map can slow down Leaflet
- **Status**: Not yet addressed (clustering needed)

### Search Timeout for Complex Queries
- **Issue**: AI-based search can take 15-20 seconds
- **Impact**: Users see "Search failed" if impatient
- **Status**: Mitigated with increased timeout (30s) and light nearby mode

---

# 15. Future Roadmap

## Phase 1 (Current) — Core Transit Navigation
✅ Place search & nearby discovery
✅ Multi-modal route planning
✅ AI-powered place verification
✅ Weather & time-aware recommendations
✅ Basic n8n workflows

## Phase 2 (Next) — Real-Time & Personalization
🔲 Real review integration (Google Places API)
🔲 Live ride price APIs (Uber/Ola)
🔲 BMTC bus number display
🔲 Mini-path interactive selection
🔲 Turn-by-turn directions for car/walk

## Phase 3 — Advanced Intelligence
🔲 Traffic-aware route timing (ML from ward datasets)
🔲 Full TOPSIS with 7 criteria (ml/topsis.py integration)
🔲 A* pathfinding on transit graph (ml/astar.py integration)
🔲 Congestion prediction from traffic_logs.csv
🔲 Metro crowd prediction from hourly ticket data

## Phase 4 — Trip Planning & Social
🔲 Multi-stop trip planner (Feature 3)
🔲 Saved routes & favorites
🔲 Trip sharing
🔲 Public transport pass recommendations
🔲 Group trip coordination

## Phase 5 — Scale & Polish
🔲 PWA / Mobile responsive
🔲 Multi-language (Kannada, Hindi, English)
🔲 Dark/light theme toggle
🔲 Map clustering for 100+ markers
🔲 Performance optimization

---

# 16. Setup & Deployment Guide

## 16.1 Prerequisites

- Python 3.12+
- Node.js 18+
- n8n (self-hosted, optional for fallback)
- OpenRouter API key (required)
- Google Gemini API key (optional, for fallback)

## 16.2 Environment Setup

```bash
# 1. Clone the repository
cd C:\Users\len\OneDrive\Desktop\VOYAGER

# 2. Python virtual environment
python -m venv venv
venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Install frontend dependencies
cd frontend
npm install
cd ..

# 5. Configure .env file
# Edit .env with your API keys:
#   OPENROUTER_API_KEY=sk-or-v1-...
#   GEMINI_API_KEY=your_key_here (optional)
```

## 16.3 Running the Application

```bash
# Terminal 1: Backend (port 8014)
cd C:\Users\len\OneDrive\Desktop\VOYAGER
venv\Scripts\activate
uvicorn backend.main:app --port 8014 --host 0.0.0.0

# Terminal 2: Frontend (port 3000)
cd C:\Users\len\OneDrive\Desktop\VOYAGER\frontend
npm run dev

# Terminal 3: n8n (port 5678) — optional
n8n start
```

## 16.4 Verifying Setup

```bash
# Check backend
curl http://localhost:8014/health
# Expected: {"status": "healthy", "app": "VOYAGER..."}

# Check frontend
curl http://localhost:3000
# Expected: HTML page

# Check n8n
curl http://localhost:5678/healthz
# Expected: {"status": "ok"}
```

## 16.5 n8n Workflow Setup

```bash
# Option 1: Import via API
cd C:\Users\len\OneDrive\Desktop\VOYAGER
venv\Scripts\activate
python scripts/import_n8n_workflows.py

# Option 2: Import manually via n8n UI
# Open http://localhost:5678 → Workflows → Import from File
# Select files from workflows/ directory
```

## 16.6 Troubleshooting

### Backend won't start
- Check port 8014 is free: `netstat -ano | findstr :8014`
- Kill process: `Stop-Process -Id <PID> -Force`
- Check .env has valid API keys

### Frontend won't load
- Check port 3000 is free
- Run `npm install` again
- Check Vite proxy in `vite.config.ts`

### n8n workflows not responding
- Check n8n is running: `http://localhost:5678`
- Check workflows are active (green toggle in UI)
- Check webhook URLs match in `n8n_service.py`

---

# 17. API Reference

## 17.1 Search Endpoints

### `GET /api/search/places`
Search for places by name.
- **Params**: `q` (string, required), `lat` (float, optional), `lng` (float, optional)
- **Response**: `{ status, results: PlaceResult[], total }`

### `GET /api/search/nearby`
Search for nearby places by type.
- **Params**: `lat`, `lng`, `radius_km` (default 2), `place_type` (optional)
- **Response**: `{ status, center, radius_km, results: PlaceResult[], total }`

### `GET /api/search/suggestions`
Autocomplete suggestions.
- **Params**: `q` (string, min 2 chars)
- **Response**: `{ status, suggestions: string[] }`

### `POST /api/search/enrich-place`
Enrich a single place with reviews, image, hotel prices.
- **Body**: `{ name, lat, lng, place_type, address }`
- **Response**: `{ status, place: PlaceResult }`

### `GET /api/search/ride-prices`
Get ride-hailing price estimates.
- **Params**: `source`, `destination`
- **Response**: `{ status, source, destination, prices: RidePrice[] }`

## 17.2 Route Endpoints

### `POST /api/routes/plan`
Plan a route between two points.
- **Body**: `{ source_lat, source_lng, dest_lat, dest_lng, mode, budget?, group_size?, preferences? }`
- **Response**: `{ status, source, destination, routes: RouteOption[], recommendations, weather }`

### `GET /api/routes/metro-stations`
Get metro stations by line.
- **Params**: `line` (optional)
- **Response**: `{ status, stations, lines }`

### `GET /api/routes/bus-stops`
Get bus stops (optionally near a location).
- **Params**: `near_lat`, `near_lng`, `radius`
- **Response**: `{ status, stops }`

## 17.3 TypeScript Interfaces

```typescript
interface PlaceResult {
  name: string
  address?: string
  lat: number
  lng: number
  place_type: string
  reliability_score?: number
  rating?: number
  review_summary?: string
  price_info?: string
  is_recommended: boolean
  distance_km?: number
  image_url?: string
  hotel_prices?: HotelPriceInfo
  reviews?: PlaceReview[]
}

interface RouteOption {
  type: string
  total_fare: number
  total_duration_minutes: number
  total_distance_km: number
  total_walking_km: number
  overall_score: number
  legs: RouteLeg[]
  geometry?: any
  route_id?: string
  route_info?: string
}

interface RouteLeg {
  from: string
  to: string
  mode: string
  distance_km: number
  duration_minutes: number
  fare: number
  line?: string
  instructions?: string
}

interface PlaceReview {
  user: string
  rating: number
  text: string
  date: string
}

interface RidePrice {
  provider: string
  mode: string
  price: number
  eta_minutes: number
  note?: string
}
```

---

# 18. Appendix: Data Preprocessing

## 18.1 Metro Network Preprocessing

The raw `bengaluru_metro_network.csv` contains:
- `station_code`: Unique code (e.g., WHTM for Whitefield)
- `station_name`: Full name
- `line`: Purple Line or Green Line
- `sequence`: Order on the line
- `is_interchange`: 0 or 1
- `next_station_code`: Code of next station
- `latitude`, `longitude`: Coordinates
- `distance_to_next_km`: Distance to next station
- `line_color`: Hex color code

The `TransitDatabase` preprocesses this into:
- `metro_stations[]`: Array of station objects
- `metro_lines{}`: Dict of line_name → stations[]
- `_metro_by_code{}`: Dict of station_code → station
- `_metro_distance_cache{}`: Dict of (code_a, code_b) → distance_km

## 18.2 BMTC Stops Preprocessing

The raw `bmtc_all_stops_master.csv` has `Routes with num trips` as a JSON string:
```
{'D35G-BVRH': 1, '242-LA': 8}
```

The `TransitDatabase` parses this into a list of route IDs:
```python
routes_list = list(json.loads(routes_raw.replace("'", "\"").replace("None", "null")).keys())
```

## 18.3 ML Data Preprocessing

The `ml/data_preprocessor.py` module provides:
- `clean_metro_data()`: Validates coordinates, fills missing fields
- `clean_bus_stops()`: Removes stops with zero lat/lng, normalizes names
- `clean_ride_data()`: Filters invalid records, normalizes vehicle types
- `clean_traffic_logs()`: Aggregates per time step, computes congestion metrics
- Outputs cleaned files to `data_cache/processed/`

---

# 19. Appendix: Troubleshooting Guide

## 19.1 Common Issues

### "Search failed" on Frontend
```
Cause: Backend timeout (>30s for complex searches)
Fix: Increase timeout in api.ts (already 30s)
Check: backend is running on port 8014
```

### n8n Workflows Not Responding
```
Cause: n8n service stopped or workflows deactivated
Fix: npm start n8n, activate workflows in UI
Check: http://localhost:5678
```

### Missing Metro/Bus Data
```
Cause: Dataset not loaded correctly
Fix: Check database.py loading logic
Check: /health endpoint shows DB stats
```

### LLM Returns Invalid JSON
```
Cause: OpenRouter model failed or returned markdown-wrapped JSON
Fix: n8n_service.py extracts JSON from code blocks (```json ... ```)
Check: API key validity in .env
```

### Map Not Loading
```
Cause: Leaflet CSS not loaded or tile server blocked
Fix: Check index.html has Leaflet CSS CDN link
Check: Browser console for errors
```

## 19.2 Debug Mode

Set `DEBUG=true` in `.env` for:
- Detailed LLM call logging
- Request/response logging
- Error tracebacks

## 19.3 Testing Scripts

```bash
# Test image fetching
python scripts/test_images.py

# Test n8n integration
python scripts/test_n8n.py

# Test full search pipeline
python scripts/test_full_search2.py

# Test review enrichment
python scripts/test_reviews2.py

# Test services
python scripts/test_services.py
```

---

# Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-11 | VOYAGER Dev | Initial comprehensive documentation |

---

*This document is a living reference. As the VOYAGER project evolves, keep this document updated with new features, architectural changes, and lessons learned.*
