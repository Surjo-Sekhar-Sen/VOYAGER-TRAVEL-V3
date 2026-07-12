# VOYAGER — Bengaluru Transit Navigator
## Complete Project Documentation

---

# Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Backend Services](#3-backend-services)
   - 3.1 [Transit Service (`transit_service.py`)](#31-transit-service-transit_servicepy)
   - 3.2 [GTFS Service (`gtfs_service.py`)](#32-gtfs-service-gtfs_servicepy)
   - 3.3 [Database (`database.py`)](#33-database-databasepy)
   - 3.4 [API Routes (`routes.py`)](#34-api-routes-routespy)
4. [Frontend Components](#4-frontend-components)
   - 4.1 [SegmentPanel](#41-segmentpanel)
   - 4.2 [Helpers](#42-helpers)
   - 4.3 [Map Integration](#43-map-integration)
5. [Routing Engine — Deep Dive](#5-routing-engine--deep-dive)
   - 5.1 [Two-Phase Segment Builder](#51-two-phase-segment-builder)
   - 5.2 [Direct Options](#52-direct-options)
   - 5.3 [Via Stops / Reach Options](#53-via-stops--reach-options)
   - 5.4 [From-Stop Options](#54-from-stop-options)
   - 5.5 [Smart Filtering Logic](#55-smart-filtering-logic)
6. [Transport Modes](#6-transport-modes)
   - 6.1 [Cab / Auto / Bike (Ride-Hailing)](#61-cab--auto--bike-ride-hailing)
   - 6.2 [BMTC Bus (Ordinary & AC Vajra)](#62-bmtc-bus-ordinary--ac-vajra)
   - 6.3 [Namma Metro](#63-namma-metro)
   - 6.4 [Indian Railways (Karnataka Stations)](#64-indian-railways-karnataka-stations)
   - 6.5 [Walk](#65-walk)
   - 6.6 [Bus-then-Cab Combo](#66-bus-then-cab-combo)
7. [Pricing & Fares](#7-pricing--fares)
   - 7.1 [BMTC Ordinary Bus Slabs](#71-bmtc-ordinary-bus-slabs)
   - 7.2 [BMTC AC Vajra Slabs](#72-bmtc-ac-vajra-slabs)
   - 7.3 [Namma Metro Slabs](#73-namma-metro-slabs)
   - 7.4 [Ride-Hailing Pricing](#74-ride-hailing-pricing)
   - 7.5 [Train Fares](#75-train-fares)
8. [Train Data — Karnataka Railways](#8-train-data--karnataka-railways)
   - 8.1 [Hardcoded Routes](#81-hardcoded-routes)
   - 8.2 [Generic Fallback Generator](#82-generic-fallback-generator)
   - 8.3 [All 48 Karnataka Stations](#83-all-48-karnataka-stations)
9. [GTFS Integration](#9-gtfs-integration)
   - 9.1 [Data Loading](#91-data-loading)
   - 9.2 [Real-Time Bus Departures](#92-real-time-bus-departures)
10. [Frontend Segment Panel — Full Spec](#10-frontend-segment-panel--full-spec)
    - 10.1 [Layout](#101-layout)
    - 10.2 [Phases](#102-phases)
    - 10.3 [Column System](#103-column-system)
    - 10.4 [Timeline](#104-timeline)
    - 10.5 [Map Geometry](#105-map-geometry)
    - 10.6 [Custom Stops](#106-custom-stops)
    - 10.7 [Bus Route Cards](#107-bus-route-cards)
11. [API Endpoints](#11-api-endpoints)
    - 11.1 [GET /api/routes/segment-step](#111-get-apiroutessegment-step)
    - 11.2 [GET /api/search/places](#112-get-apisearchplaces)
12. [Data Files](#12-data-files)
    - 12.1 [transit_fares.json](#121-transit_faresjson)
    - 12.2 [karnataka_railway_stations.json](#122-karnataka_railway_stationsjson)
    - 12.3 [GTFS Files](#123-gtfs-files)
13. [Configuration & Running](#13-configuration--running)
14. [Performance Notes](#14-performance-notes)
15. [Known Issues & Limitations](#15-known-issues--limitations)
16. [Future Roadmap](#16-future-roadmap)
    - 16.1 [Immediate Next Steps](#161-immediate-next-steps)
    - 16.2 [Short-Term Improvements](#162-short-term-improvements)
    - 16.3 [Long-Term Vision](#163-long-term-vision)
17. [Complete File Reference](#17-complete-file-reference)

---

# 1. Project Overview

VOYAGER is a **Bengaluru Transit Navigator** — a web application that provides multi-modal route planning across Bengaluru and Karnataka. Users can plan journeys combining:

- **Ride-hailing** (Uber / Ola: cab, auto, bike)
- **BMTC buses** (ordinary, AC Vajra)
- **Namma Metro**
- **Indian Railways** (48 Karnataka stations)
- **Walking** (last-mile connections)
- **Bus-then-Cab combo** (for out-of-Bengaluru destinations)

The core innovation is a **two-phase segment builder** that breaks a journey into sequential segments. Users build their route step-by-step: first reaching a transit stop, then choosing onward transport from that stop to the next location, repeating until destination.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, Uvicorn |
| Frontend | React 18, TypeScript, Vite |
| Map | Leaflet (react-leaflet) |
| Geocoding | OpenStreetMap Nominatim |
| GTFS Data | BMTC Bangalore (static files) |
| Transit Fares | JSON slab data (BMTC, Metro) |
| Railway Data | 48 Karnataka stations (JSON) |

## Project Structure

```
VOYAGER/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── core/
│   │   ├── config.py            # Settings & paths
│   │   └── database.py          # TransitDatabase (all data)
│   ├── services/
│   │   ├── transit_service.py   # MAIN: routing logic
│   │   └── gtfs_service.py      # GTFS loader & bus times
│   └── api/
│       └── routes.py            # FastAPI endpoints
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── SegmentPanel.tsx # Segment builder UI
│   │   ├── services/
│   │   │   └── api.ts           # API client
│   │   ├── utils/
│   │   │   └── helpers.ts       # Icons, labels, formatters
│   │   └── types.ts             # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
├── data_cache/
│   ├── transit_fares.json       # Fare slabs
│   ├── karnataka_railway_stations.json  # 48 stations
│   ├── bmtc_stops.txt           # GTFS data
│   ├── stop_times.txt           # GTFS data
│   └── shapes.txt               # GTFS data
├── AGENTS.md                    # Quick reference
├── PROJECT_DOCUMENTATION.md     # THIS FILE
└── README.md
```

---

# 2. Architecture

## Data Flow

```
User Input (source, dest, group size, budget)
        │
        ▼
  Frontend SegmentPanel
        │
        ▼  GET /api/routes/segment-step
  Backend API (routes.py)
        │
        ▼
  TransitService.get_segment_step_options()
        │
        ├──► Database (db) ──► bus stops, metro, railway, fares
        │
        ├──► GTFS Service ──► real-time bus departure times
        │
        └──► Returns:
             ├── direct_options (cab/auto/bike/walk — doorstep services)
             └── via_stops[ ]
                  ├── stop info (name, coords, type)
                  ├── reach_options (ways to get TO this stop)
                  └── from_stop_options (ways to go FROM this stop)
```

## Two-Phase Flow

```
PHASE: "init"                     PHASE: "from"                     PHASE: "direct"
───────                          ──────                            ──────
Show:                            Show:                             Show:
  • Direct options (cab/auto/      • from_stop_options for a         • Complete path summary
    bike/walk to dest)               specific stop the user           • Timeline
  • Via stops with reach_options     arrived at                       • Map highlighting
    (walk/ride to each stop)       • Bus times, train numbers,
                                     metro connections,
User picks a reach_option ───────►  cab/auto from this stop
                                     to next stop or dest
                                  User picks a from_option ───────►
                                  (if arrives_at_stop → fetch more
                                   from new location; else done)
```

---

# 3. Backend Services

## 3.1 Transit Service (`transit_service.py`)

**Location**: `backend/services/transit_service.py`
**Size**: ~1370 lines
**Class**: `TransitService`

This is the **core of the application**. It contains all routing logic, fare calculations, mode selection, filtering, and data orchestration.

### Key Methods

#### `get_segment_step_options(from_lat, from_lng, from_name, dest_lat, dest_lng, dest_name, group_size, budget)`
- **Input**: Origin & destination coords/names, group size, optional max budget
- **Returns**: `{ direct_options: [...], via_stops: [...] }`
- This is the **main entry point** called by the API

**Internal workflow**:

```
1. Calculate direct distance (haversine)
2. If ≤ 5 km → add Walk to direct_options
3. Add ride-hailing options (cab/auto/bike) to direct_options
   • Filtered by group_size vs capacity
   • Checked against budget
4. Load nearby bus stops (1 km radius)
5. Load nearby metro stations (2 km radius)
6. If out-of-Bengaluru destination → bus_then_cab as via_stop
7. For each nearby bus stop (max 4):
   a. Check if walking distance ≤ 2 km → add walk reach_option
   b. Check if common bus routes to dest area exist → add bus reach_option
   c. Add cab/auto reach_options to reach stop
   d. For from_stop_options:
      • Bus transit to dest bus stops (if common routes exist)
      • Metro to dest metro stations
      • Walk if ≤ 2 km from dest
      • Cab/auto directly to destination
8. For each nearby metro station:
   a. Walk/ride reach_options
   b. Bus from_stop_options to dest bus stops
   c. Metro from_stop_options (with line path)
   d. Walk if ≤ 2 km from dest
   e. Cab/auto directly to destination
9. Load nearby & destination railway stations
10. For each nearby railway station:
    a. Walk/ride reach_options
    b. Train from_stop_options (using _get_train_options)
    c. Last-mile cab/auto/walk from destination station
11. Add interpolated paths to all options
```

#### `_get_train_options(src_name, dst_name)`
- Matches station names to known routes, or generates generic option
- **Known routes**: Bengaluru↔Mysuru/Hubballi/Mangaluru/Belagavi/Ballari
- **Generic fallback**: Uses distance-based calculation for any station pair among 48 stations

#### `_find_farthest_bus_stop_toward_dest(lat, lng, dest_lat, dest_lng)`
- Finds BMTC bus stop closest to the destination direction
- Used for out-of-Bengaluru bus_then_cab combo

#### `_get_bus_route_nums(stop_a, stop_b)`
- Finds common BMTC bus routes between two stops
- Returns route numbers like ["500C", "500D", "500Q"]

#### `haversine_distance(lat1, lng1, lat2, lng2)`
- Calculates geodesic distance using `geopy.distance.geodesic`

#### `_interpolate_path(lat1, lng1, lat2, lng2, num_points)`
- Generates interpolated coordinates for map path display
- Adds slight curve for visual appeal

#### `_is_outside_bengaluru(lat, lng)`
- Boundary check: roughly (12.8-13.2°N, 77.4-77.8°E)

### Configuration Constants

```python
_TRAIN_DATA = {
    ("bengaluru", "mysuru"): [...],
    ("mysuru", "bengaluru"): [...],
    ("bengaluru", "hubballi"): [...],
    ("hubballi", "bengaluru"): [...],
    ("bengaluru", "mangaluru"): [...],
    ("mangaluru", "bengaluru"): [...],
    ("bengaluru", "belagavi"): [...],
    ("belagavi", "bengaluru"): [...],
    ("bengaluru", "ballari"): [...],
    ("ballari", "bengaluru"): [...],
}
```

### Smart Filtering Rules

| Condition | Behavior |
|-----------|----------|
| Distance < 0.5 km | Only show walk option (no rides) |
| No common bus routes | Skip bus from_stop_options |
| Budget exceeded | Skip that option entirely |
| Group size > capacity | Skip ride-hailing mode |
| Destination > 50 km away | Enable railway/train options |
| Stop-to-dest ≤ 2 km | Add walk option to from_stop_options |
| Stop has no reach options | Don't show stop |

---

## 3.2 GTFS Service (`gtfs_service.py`)

**Location**: `backend/services/gtfs_service.py`
**Class**: `GTFSLoader`

### Data Loading
- Loads synchronously at server startup (~41 seconds)
- Files used:
  - `bmtc_stops.txt` (~3000 stops)
  - `stop_times.txt` (50k row limit for performance)
  - `shapes.txt` (~7300 shapes)
- Builds:
  - `stop_times` dict: `stop_name → [{trip_id, departure_time, route_id}]`
  - `shape_routes` dict: `route_id → shape coordinates`
  - `stop_shape_map`: `stop_name → shape_id`

### `get_next_buses(stop_name, max_results=5)`
- Returns upcoming bus departure times for a given stop
- Filters by current system time
- Returns: `[{trip_id, route_id, departure_time, shape}]`
- Shape coordinates are included for map display

### Performance
- First call to this service triggers the 41-second load
- Subsequent calls are fast (data cached in memory)
- To reduce load time, decrease `stop_times_count` limit in `gtfs_service.py:97`

---

## 3.3 Database (`database.py`)

**Location**: `backend/core/database.py`
**Class**: `TransitDatabase`
**Singleton**: `db = TransitDatabase()` at module bottom

### Data Loaded

| Data | Source | Size |
|------|--------|------|
| Transit fares | `transit_fares.json` | 3 slab sets |
| Metro stations | `bengaluru_metro_network.csv` | 85 stations |
| Metro lines | Parsed from CSV | ~10 lines (Purple, Green, etc.) |
| Bus stops | `bmtc_stops.txt` | ~2972 stops |
| KIA routes | `kia_routes.json` | 20 routes |
| Railway stations | `karnataka_railway_stations.json` | 48 stations |

### Key Methods

#### Fare Lookups:
- `get_metro_fare(distance_km)` → uses namma_metro_slabs
- `get_bmtc_ordinary_fare(distance_km, passenger_type)` → uses bmtc_ordinary_slabs
- `get_bmtc_ac_fare(distance_km, passenger_type)` → uses bmtc_ac_vajra_slabs

#### Proximity Searches:
- `find_nearby_bus_stops(lat, lng, radius_km)` → bus stops within radius
- `find_nearby_metro_stations(lat, lng, radius_km)` → metro stations within radius
- `find_nearby_railway_stations(lat, lng, radius_km)` → railway stations within radius

#### Other:
- `find_metro_station(name_query)` → fuzzy name search
- `get_metro_line_path(station_a, station_b)` → line coordinates for metro routes
- `find_bus_stops(name_query)` → fuzzy name search for bus stops
- `get_bus_stop_by_id(stop_id)` → single stop lookup

---

## 3.4 API Routes (`routes.py`)

**Location**: `backend/api/routes.py`

### Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Health check + stats |
| `/api/routes/segment-step` | GET | Main routing endpoint |
| `/api/search/places` | GET | Place search (Nominatim) |
| `/api/search/bus-stops` | GET | Bus stop search |
| `/api/search/metro-stations` | GET | Metro station search |
| `/api/bus-times/{stop_name}` | GET | GTFS bus times for stop |

---

# 4. Frontend Components

## 4.1 SegmentPanel

**Location**: `frontend/src/components/SegmentPanel.tsx`
**Type**: React Functional Component
**Lines**: ~550

### State Management

```typescript
// Core state
segmentStep: SegmentStepData | null    // Current API response
segmentLoading: boolean                // Loading indicator
hoveredOption: SegmentStepOption | null // Map hover highlight
builtPath: SegmentStepOption[]         // User's selected path
currentFromName: string                // Current location label
phase: 'init' | 'from' | 'direct'     // Current UI phase

// Columns system
columns: ColumnCard[]                  // Array of rendered columns
selectedColIndex: number | null        // Which column is active

// Custom stop search
customInput: string
customSuggestions: PlaceResult[]
customLoading: boolean
showCustomInput: boolean
```

### ColumnCard Interface

```typescript
interface ColumnCard {
  stageIdx: number              // Index in the journey
  fromName: string              // Starting location
  fromLat?: number              // Starting lat
  fromLng?: number              // Starting lng
  options: SegmentStepOption[]  // Available options
  label: string                 // Column header
  type: 'reach' | 'from' | 'direct'  // Column type
  selectedOption?: SegmentStepOption  // User's choice (if made)
}
```

### Key Callbacks

| Callback | Trigger | Action |
|----------|---------|--------|
| `handlePickReach(vi, opt, fromStep)` | User clicks reach option | Adds option to builtPath, creates new column for from_stop_options |
| `handlePickFrom(opt, colIdx)` | User clicks from option | Adds to builtPath, either fetches next segment or marks complete |
| `handlePickDirect(opt)` | User clicks direct option | Marks journey complete, adds to builtPath |
| `handleAddCustomWaypoint(place)` | User selects custom stop | Inserts waypoint, fetches segments from new location |

## 4.2 Helpers

**Location**: `frontend/src/utils/helpers.ts`

```typescript
getModeIcon(mode: string): string   // Returns emoji icon
getModeLabel(mode: string): string   // Returns human-readable label
formatDuration(minutes: number): string  // "2h 30m" or "45m"
formatRupees(paise: number): string  // "₹1,234"
```

Mode mappings:

| mode | icon | label |
|------|------|-------|
| walk | 🚶 | Walk |
| cab | 🚕 | Uber Go / Ola Mini |
| cab_xl | 🚐 | Uber XL / Ola XL |
| auto | 🛺 | Auto |
| bike | 🏍️ | Uber Moto / Rapido |
| cab_women | 👩 | Uber for Women / Ola for Women |
| cab_pet | 🐾 | Uber Pet |
| bus_ordinary | 🚌 | BMTC Ordinary Bus |
| bus_ac_vajra | 🚌 | BMTC AC Vajra Bus |
| metro | 🚇 | Namma Metro |
| train | 🚆 | Train |
| bus_then_cab | 🚌➡️🚕 | Bus then Cab |
| custom | 📍 | Custom Stop |

## 4.3 Map Integration

**Geometry types** (defined in `types.ts`):

```typescript
interface MapRouteGeometry {
  type: 'segment' | 'stop' | 'hover' | 'route'
  coordinates: [number, number][]
  color: string
  weight?: number
  label?: string
  opacity?: number
  dashArray?: string
}
```

**Colors by usage**:
- Segments: Indexed from `SEGMENT_COLORS` array
- Stops: Bus = #3b82f6, Metro = #22c55e, Railway = #a855f7
- Hover: #fbbf24 (yellow highlight)
- Direct path: interpolated curve

The `onGeometryChange` callback sends geometry to the parent Map component for rendering.

---

# 5. Routing Engine — Deep Dive

## 5.1 Two-Phase Segment Builder

The segment builder is the heart of VOYAGER. It works in two phases:

### Phase "init" (Initial Options)
When the user starts or reaches a new location, the API returns:
1. **Direct options**: Ways to go straight to destination (cab/auto/bike/walk)
2. **Via stops**: Transit stops near current location, each with:
   - **reach_options**: How to get TO that stop (walk, cab, auto, bus)
   - **from_stop_options**: How to go FROM that stop (bus, metro, train, cab, walk)

### Phase "from" (From a Specific Stop)
When user selects which stop to go to:
1. The chosen reach_option is added to builtPath
2. A new column appears showing only from_stop_options for that stop
3. User picks one → if it arrives_at_stop, fetch next segment from new location

### Flow Diagram

```
START (source location)
  │
  ├── PICK DIRECT (cab/auto/bike/walk)
  │     └── ✅ Journey Complete
  │
  └── PICK REACH OPTION (go to transit stop)
        │
        ├── Stop is bus stop
        │     ├── Pick bus to another area
        │     │     └── arrives_at_stop → fetch more
        │     ├── Pick metro from here
        │     │     └── arrives_at_stop → fetch more
        │     ├── Pick train from railway nearby
        │     │     └── arrives_at_stop → fetch more
        │     ├── Pick walk (if ≤ 2 km to dest)
        │     │     └── ✅ Journey Complete
        │     └── Pick cab/auto directly to dest
        │           └── ✅ Journey Complete
        │
        ├── Stop is metro station
        │     ├── Pick metro to another station
        │     │     └── arrives_at_stop → fetch more
        │     ├── Pick bus from here
        │     │     └── arrives_at_stop → fetch more
        │     ├── Pick walk (if ≤ 2 km to dest)
        │     │     └── ✅ Journey Complete
        │     └── Pick cab/auto directly to dest
        │           └── ✅ Journey Complete
        │
        └── Stop is railway station
              ├── Pick train to destination city
              │     └── arrives_at_stop (destination station)
              │           └── Pick last-mile cab/auto/walk
              │                 └── ✅ Journey Complete
              ├── Pick walk (if ≤ 2 km to dest)
              │     └── ✅ Journey Complete
              └── Pick cab/auto directly to dest
                    └── ✅ Journey Complete
```

## 5.2 Direct Options

Direct options are **doorstep-to-doorstep services only**:
- 🚕 **Cab** (Uber Go / Ola Mini)
- 🚐 **Cab XL** (Uber XL / Ola XL)
- 🛺 **Auto** (Auto rickshaw)
- 🏍️ **Bike** (Uber Moto / Rapido)
- 👩 **Cab Women** (Uber for Women / Ola for Women)
- 🐾 **Cab Pet** (Uber Pet)
- 🚶 **Walk** (only if ≤ 5 km)

**NOT in direct options** (they belong in segments):
- Bus (ordinary, AC Vajra)
- Metro
- Train
- Bus-then-Cab combo

### Filtering Rules for Direct Options:
1. Group size > vehicle capacity → skip
2. Total fare > budget → skip
3. Distance > 5 km → no walk option
4. Budget check: `total_fare = (base_fare + distance * per_km_rate) * group_size`

### Pricing Model:
```python
ride_types = [
    ("cab",       "Uber Go / Ola Mini",              14, 3, 25, "🚕", 4),
    ("cab_xl",    "Uber XL / Ola XL",                20, 3, 40, "🚐", 6),
    ("auto",      "Auto",                            10, 5, 15, "🛺", 3),
    ("bike",      "Uber Moto / Rapido",               6, 2, 10, "🏍️", 1),
    ("cab_women", "Uber for Women / Ola for Women",  14, 3, 25, "👩", 4),
    ("cab_pet",   "Uber Pet",                        17, 3, 30, "🐾", 4),
]
# Fields: (mode, label, per_km_rate, time_per_km, base_fare, icon, capacity)
```

## 5.3 Via Stops / Reach Options

Via stops are transit stations near the user's current location. Each has reach_options showing how to get to that stop.

### Stop Types:
| Type | Color | Icon |
|------|-------|------|
| `bus` | #3b82f6 (blue) | 🚌 |
| `metro` | #22c55e (green) | 🚇 |
| `railway` | #a855f7 (purple) | 🚆 |

### Reach Options Generated Per Stop:

**For Bus Stops** (max 4 nearby):
1. 🚶 **Walk** (if distance ≤ 2 km)
2. 🚕 **Cab/Auto/Bike** (all ride types, filtered by capacity/budget)

**For Metro Stations** (max 3 nearby):
1. 🚶 **Walk** (if distance ≤ 2 km)
2. 🚕 **Cab/Auto/Bike** (all ride types)

**For Railway Stations** (max 3 nearby, only if out-of-Bengaluru or any):
1. 🚶 **Walk** (if distance ≤ 2 km)
2. 🚕 **Cab/Auto/Bike** (all ride types)

### Filtering:
- Reach options for a stop are skipped if the stop would have no useful from_stop_options (smart filtering)
- Stop is skipped entirely if: `distance > 2 && !has_common_routes && stop_to_dest_distance > 50`

## 5.4 From-Stop Options

These are the transport options available FROM a specific transit stop.

### Available From-Stop Options By Stop Type:

#### From a Bus Stop:
| Mode | Condition | Details |
|------|-----------|---------|
| 🚌 **Bus to dest** | Common routes exist | Shows route numbers, fare, bus timings |
| 🚇 **Metro to dest** | Metro station near dest | Metro fare, path, line info |
| 🚶 **Walk to dest** | ≤ 2 km from dest | Free, slow |
| 🚕 **Cab/Auto/Bike to dest** | Always available | Full ride-hailing selection |

#### From a Metro Station:
| Mode | Condition | Details |
|------|-----------|---------|
| 🚌 **Bus to dest** | Common routes from this metro | Shows route numbers, bus timings |
| 🚇 **Metro to dest** | Metro line connects | Line path, metro fare |
| 🚶 **Walk to dest** | ≤ 2 km from dest | Free |
| 🚕 **Cab/Auto/Bike to dest** | Always available | Full ride-hailing selection |

#### From a Railway Station:
| Mode | Condition | Details |
|------|-----------|---------|
| 🚆 **Train to dest city** | Distance ≥ 10 km | Shows train number, name, departure/arrival |
| 🚶 **Walk to dest** | ≤ 2 km from dest station | Free |
| 🚕 **Cab/Auto from dest station** | Always available | From destination station to final dest |

## 5.5 Smart Filtering Logic

The system applies multiple layers of filtering:

### Layer 1: Stop Visibility
```
IF distance_to_stop > 2km
   AND no common bus routes to dest area
   AND stop_to_dest_distance > 50km
THEN → SKIP this stop entirely
```

### Layer 2: Reach Option Filtering
```
IF distance_to_stop < 0.5km
   → Show ONLY walk (no cab/auto options)
IF distance_to_stop == 0
   → This stop IS the current location (skip reach options)
IF budget exceeded
   → Skip expensive ride options
```

### Layer 3: From-Stop Option Filtering
```
IF no common bus routes between this stop and dest
   → Skip bus from_stop_options
IF budget exceeded
   → Skip that option
IF train distance < 10km
   → Skip train option (too short for train)
IF ride capacity < group_size
   → Skip that ride type
```

### Layer 4: Railway-Specific
```
IF destination is within Bengaluru
   → Railway options may still show if stations are nearby
IF destination is outside Bengaluru
   → Railway options are strongly preferred (train + last-mile cab)
```

---

# 6. Transport Modes

## 6.1 Cab / Auto / Bike (Ride-Hailing)

### Modes:
| Mode | Capacity | Base Fare | Per KM | Icon |
|------|----------|-----------|--------|------|
| Uber Go / Ola Mini | 4 | ₹25 | ₹14/km | 🚕 |
| Uber XL / Ola XL | 6 | ₹40 | ₹20/km | 🚐 |
| Auto | 3 | ₹15 | ₹10/km | 🛺 |
| Uber Moto / Rapido | 1 | ₹10 | ₹6/km | 🏍️ |
| Uber for Women | 4 | ₹25 | ₹14/km | 👩 |
| Uber Pet | 4 | ₹30 | ₹17/km | 🐾 |

### Pricing Formula:
```
per_person = base_fare + distance_km * per_km_rate
total = per_person * group_size
```

### Usage in App:
- **Direct to destination**: All modes shown (filtered by capacity/budget)
- **Reach a stop**: All modes shown as reach options
- **From a stop**: All modes shown as from_stop_options
- **Walking distance**: Only shown for distances ≤ 5 km in direct, ≤ 2 km for reach/from

## 6.2 BMTC Bus (Ordinary & AC Vajra)

### Ordinary Bus:
- Fare: uses `bmtc_ordinary_slabs` from `transit_fares.json`
- Range: ₹6 (≤2 km) to ₹32 (≥42 km)
- Route numbers: shown as comma-separated list
- Bus timings: from GTFS data (real-time departure times)

### AC Vajra Bus:
- Fare: uses `bmtc_ac_vajra_slabs` from `transit_fares.json`
- Adult fare: ₹15 (≤2 km) to ₹65 (≥46 km)
- Child/Senior fares available
- Route numbers shown

### Bus in Segments:
- Bus is **never** a direct option
- Bus appears in:
  - reach_options (board a bus to reach a stop)
  - from_stop_options (take a bus FROM this stop toward dest)
- Bus_then_cab combo for out-of-Bengaluru: bus to farthest BMTC stop, then cab

## 6.3 Namma Metro

### Fare Slabs:
| Distance | Fare |
|----------|------|
| ≤ 2 km | ₹11 |
| ≤ 4 km | ₹21 |
| ≤ 6 km | ₹32 |
| ≤ 8 km | ₹42 |
| ≤ 10 km | ₹53 |
| ≤ 15 km | ₹63 |
| ≤ 20 km | ₹74 |
| ≤ 25 km | ₹84 |
| > 25 km | ₹95 |

### Metro Line Paths:
- When both origin and destination metro stations are on the same line, the path is generated using `get_metro_line_path()`
- This provides proper track geometry (not straight-line interpolation)

## 6.4 Indian Railways (Karnataka Stations)

### 48 Stations Available:
1. KSR Bengaluru City Junction
2. Yesvantpur Junction
3. Bengaluru Cantonment
4. Krishnarajapuram
5. Yelahanka Junction
6. Whitefield
7. Kengeri
8. Mysuru City Junction
9. Hubballi Junction
10. Mangaluru Junction
11. Mangaluru Central
12. Belagavi
13. Ballari Junction
14. Davangere
15. Dharwad
16. Kalaburagi Junction
17. Raichur Junction
18. Vijayapura
19. Bangarapet Junction
20. Tumakuru
21. Arsikere Junction
22. Hassan Junction
23. Mandya
24. Hosapete Junction
25. Gadag Junction
26. Shivamogga Town
27. Harihar
28. Wadi Junction
29. Birur Junction
30. Londa Junction
31. Yadgir
32. Bidar
33. Udupi
34. Karwar
35. Haveri
36. Ranibennur
37. Tiptur
38. Kadur Junction
39. Kundapura
40. Koppal
41. Bagalkot
42. Shrirangapattana
43. Ramanagaram
44. Channapatna
45. Nanjangud Town
46. Chamarajanagar
47. Bhadravati
48. Bhatkal

### Train Data Sources:
1. **Hardcoded routes**: 10 known pairs (Bengaluru↔Mysuru/Hubballi/Mangaluru/Belagavi/Ballari)
2. **Generic generator**: For any unknown pair, generates reasonable train number/name/times based on distance

### Train in Segments:
- Train is **never** a direct option
- Appears as from_stop_options from railway stations
- Requires reaching the railway station first (via walk/cab/auto)
- Train option includes: train_number, train_name, departure_time, arrival_time, fare, duration
- After train arrives at destination station, last-mile options are provided (cab/auto/walk)

## 6.5 Walk

- Speed: 12 min/km (5 km/h)
- Fare: Free (₹0)
- Maximum distances:
  - Direct to destination: ≤ 5 km
  - Reach a stop: ≤ 2 km
  - From a stop: ≤ 2 km
- Icon: 🚶
- Walking does not count toward group capacity

### Walk in Segments:
- Primary use: last-mile connection from transit stop to destination
- Secondary use: short hop from current location to a nearby transit stop

## 6.6 Bus-then-Cab Combo

### Purpose:
Provide affordable inter-city travel by combining BMTC bus (cheap, long-distance) with cab (last-mile).

### How it works:
1. Find the farthest BMTC bus stop in the direction of the destination
2. Take a BMTC bus there (using common routes if available)
3. Take a cab from that stop to the final destination

### Where it appears:
- As a **via_stop** entry (not a direct option)
- Only for out-of-Bengaluru destinations
- Has one reach_option (bus) and one from_stop_option (cab)

### Pricing:
```
bus_fare = bmtc_ordinary_fare(bus_distance) * group_size
cab_fare = (25 + remaining_distance * 14) * group_size
total = bus_fare + cab_fare
```

---

# 7. Pricing & Fares

## 7.1 BMTC Ordinary Bus Slabs

**File**: `data_cache/transit_fares.json` → `bmtc_ordinary_slabs`

| Distance (km) | Fare (₹) |
|---------------|----------|
| ≤ 2 | 6 |
| ≤ 4 | 12 |
| ≤ 6 | 18 |
| ≤ 8 | 23 |
| ≤ 10 | 23 |
| ≤ 12 | 24 |
| ≤ 14 | 24 |
| ≤ 16 | 28 |
| ≤ 18 | 28 |
| ≤ 20 | 28 |
| ≤ 22 | 30 |
| ≤ 24 | 30 |
| ≤ 26 | 30 |
| ≤ 28 | 30 |
| ≤ 30 | 30 |
| ≤ 32 | 30 |
| ≤ 34 | 30 |
| ≤ 36 | 30 |
| ≤ 38 | 30 |
| ≤ 40 | 30 |
| ≤ 42 | 32 |
| ≤ 44 | 32 |
| ≤ 46 | 32 |
| ≤ 48 | 32 |
| ≤ 50 | 32 |
| > 50 | 32 |

**Lookup function**: `db.get_bmtc_ordinary_fare(distance_km, passenger_type="adult")`
- Child: 50% of fare
- Senior: 75% of fare

## 7.2 BMTC AC Vajra Slabs

**File**: `data_cache/transit_fares.json` → `bmtc_ac_vajra_slabs`

| Distance (km) | Adult (₹) | Child (₹) | Senior (₹) |
|---------------|-----------|-----------|------------|
| ≤ 2 | 15 | 10 | 15 |
| ≤ 4 | 20 | 10 | 15 |
| ≤ 6 | 25 | 15 | 20 |
| ≤ 8 | 30 | 15 | 25 |
| ≤ 10 | 30 | 15 | 25 |
| ≤ 12 | 35 | 20 | 30 |
| ≤ 14 | 35 | 20 | 30 |
| ≤ 16 | 40 | 20 | 30 |
| ≤ 18 | 40 | 20 | 30 |
| ≤ 20 | 40 | 20 | 30 |
| ≤ 22 | 45 | 25 | 35 |
| ≤ 24 | 45 | 25 | 35 |
| ≤ 26 | 45 | 25 | 35 |
| ≤ 28 | 50 | 25 | 40 |
| ≤ 30 | 50 | 25 | 40 |
| ≤ 32 | 50 | 25 | 40 |
| ≤ 34 | 55 | 30 | 45 |
| ≤ 36 | 55 | 30 | 45 |
| ≤ 38 | 55 | 30 | 45 |
| ≤ 40 | 60 | 30 | 45 |
| ≤ 42 | 60 | 30 | 45 |
| ≤ 44 | 60 | 30 | 45 |
| ≤ 46 | 65 | 35 | 50 |
| ≤ 48 | 65 | 35 | 50 |
| ≤ 50 | 65 | 35 | 50 |
| > 50 | 65 | 35 | 50 |

**Lookup function**: `db.get_bmtc_ac_fare(distance_km, passenger_type="adult")`

## 7.3 Namma Metro Slabs

**File**: `data_cache/transit_fares.json` → `namma_metro_slabs`

| Distance (km) | Fare (₹) |
|---------------|----------|
| ≤ 2 | 11 |
| ≤ 4 | 21 |
| ≤ 6 | 32 |
| ≤ 8 | 42 |
| ≤ 10 | 53 |
| ≤ 15 | 63 |
| ≤ 20 | 74 |
| ≤ 25 | 84 |
| > 25 | 95 |

**Lookup function**: `db.get_metro_fare(distance_km)`

## 7.4 Ride-Hailing Pricing

See [Section 6.1](#61-cab--auto--bike-ride-hailing) for per-mode fares.

**Formula**: `per_person = base_fare + distance_km * per_km_rate`

Notes:
- Prices are approximate estimates (not real Uber/Ola surge pricing)
- No per-minute waiting charges
- No peak/non-peak differentiation

## 7.5 Train Fares

### Known Route Fares:
```
train_fare_pp = max(15, round(haversine_distance * 0.8))
```

### Generic Route Fares:
```
train_fare_pp = max(15, round(haversine_distance * 0.8))
```

### Train Fare Rationale:
- Approximates sleeper class fare at ~₹0.80/km
- Minimum ₹15 (short distances)
- Per-person, then multiplied by group_size

---

# 8. Train Data — Karnataka Railways

## 8.1 Hardcoded Routes

### Bengaluru ↔ Mysuru (5 trains each way)
```
Bengaluru → Mysuru:
  16517 KSR Bengaluru-Mysuru Kannada Express   06:45-09:25 (2h40m)
  12613 Shatabdi Express                       11:00-13:00 (2h00m)
  12007 Shatabdi Express                       14:00-16:00 (2h00m)
  16535 Gol Gumbaz Express                     07:45-10:25 (2h40m)
  16232 Mysuru Express                          12:30-15:10 (2h40m)

Mysuru → Bengaluru:
  16518 Mysuru-KSR Bengaluru Kannada Express   06:00-08:40 (2h40m)
  12614 Shatabdi Express                       14:30-16:30 (2h00m)
  12008 Shatabdi Express                       06:30-08:30 (2h00m)
  16536 Gol Gumbaz Express                     16:00-18:40 (2h40m)
  16231 Mysuru Express                          05:30-08:10 (2h40m)
```

### Bengaluru ↔ Hubballi (2 trains each way)
```
Bengaluru → Hubballi:
  17325 Vishwamanava Express   15:00-22:30 (7h30m)
  16589 Rani Chennamma Express 22:00-06:30 (8h30m, overnight)

Hubballi → Bengaluru:
  17326 Vishwamanava Express   06:00-13:30 (7h30m)
  16590 Rani Chennamma Express 20:00-04:30 (8h30m, overnight)
```

### Bengaluru ↔ Mangaluru (2 trains each way)
```
Bengaluru → Mangaluru:
  16511 KSR Bengaluru-Kannur Express   23:30-09:45 (10h15m, overnight)
  16585 Mokashi Express                 22:15-08:30 (10h15m, overnight)

Mangaluru → Bengaluru:
  16512 Kannur-KSR Bengaluru Express   17:00-03:15 (10h15m, overnight)
  16586 Mokashi Express                 19:00-05:15 (10h15m, overnight)
```

### Bengaluru ↔ Belagavi (1 train each way)
```
Bengaluru → Belagavi:
  17309 Basava Express   22:00-08:30 (10h30m, overnight)

Belagavi → Bengaluru:
  17310 Basava Express   19:00-05:30 (10h30m, overnight)
```

### Bengaluru ↔ Ballari (1 train each way)
```
Bengaluru → Ballari:
  16545 KSR Bengaluru-Ballari Express   22:30-06:30 (8h00m, overnight)

Ballari → Bengaluru:
  16546 Ballari-KSR Bengaluru Express   23:00-07:00 (8h00m, overnight)
```

## 8.2 Generic Fallback Generator

For any railway station pair not in the hardcoded list, the system generates a generic option:

```python
dist = geodesic(station_a, station_b).km
if dist > 20:
    duration_hours = max(1, round(dist / 50))
    departure_hour = (6 + hash(src + dst) % 10) % 24
    arrival_hour = (departure_hour + duration_hours) % 24
    train_number = f"1{1000 + hash(src + dst) % 9000:04d}"
    train_name = f"Intercity Express ({station_a_city} - {station_b_city})"
```

### Limitations of Generic Generator:
- Train numbers are deterministic but fake (based on string hash)
- Departure/arrival times are rough estimates
- No guarantee of actual train existence
- Speed assumed at 50 km/h average

## 8.3 Station Name Normalization

The `_get_train_options` function normalizes station names:

```python
name_map = {
    "ksr bengaluru": "bengaluru", "bengaluru": "bengaluru",
    "bengaluru city": "bengaluru", "ksr bangalore": "bengaluru",
    "bengaluru cantonment": "bengaluru", "bengaluru cant": "bengaluru",
    "yasvantpur": "bengaluru", "yesvantpur": "bengaluru",
    "krishnarajapuram": "bengaluru", "whitefield": "bengaluru",
    "mysuru": "mysuru", "mysore": "mysuru",
    "hubballi": "hubballi", "hubli": "hubballi",
    "mangaluru": "mangaluru", "mangalore": "mangaluru",
    "belagavi": "belagavi", "belgaum": "belagavi",
    "ballari": "ballari", "bellary": "ballari",
    "kalaburagi": "kalaburagi", "gulbarga": "kalaburagi",
    "vijayapura": "vijayapura", "bijapur": "vijayapura",
    "hosapete": "hosapete", "hospet": "hosapete",
    "shivamogga": "shivamogga", "shimoga": "shivamogga",
}
```

---

# 9. GTFS Integration

## 9.1 Data Loading

### Source Files (in `data_cache/`):
| File | Description | Rows |
|------|-------------|------|
| `bmtc_stops.txt` | BMTC bus stops | ~3000 stops |
| `stop_times.txt` | Trip departure times | 50,000 (limited) |
| `shapes.txt` | Route shape geometry | ~7271 shapes |
| `trips.txt` | Trip definitions | (used for route mapping) |

### Loading Process (synchronous, at startup):
1. Parse `bmtc_stops.txt` → dict of stop → {stop_id, stop_name, lat, lng}
2. Parse `stop_times.txt` → dict of stop_name → [{trip_id, departure_time, route_id}]
   - Limited to first 50,000 rows for performance
3. Parse `trips.txt` → mapping of trip_id → route_id
4. Parse `shapes.txt` → dict of shape_id → [{lat, lng, seq}]
5. Build `stop_shape_map`: stop_name → nearest shape_id

**Duration**: ~41 seconds on startup

## 9.2 Real-Time Bus Departures

### `get_next_buses(stop_name, max_results=5)`
1. Look up stop_name in `_stop_times` dict
2. Filter departure times ≥ current system time
3. Sort by departure time
4. Return top N results
5. Each result includes shape coordinates for map display

### Example Output:
```json
[
  {"trip_id": "T12345", "route_id": "500C",
   "departure_time": "14:35:00",
   "shape": [[12.9716, 77.5946], [12.9720, 77.5950], ...]},
  {"trip_id": "T12346", "route_id": "500D",
   "departure_time": "14:50:00",
   "shape": [...]}
]
```

### Limitations:
- Only 50,000 stop_times loaded (may miss some late-day trips)
- Departure times are static schedule (not real-time GPS)
- No delay/cancellation information
- Shape data is approximate (nearest shape matched)

---

# 10. Frontend Segment Panel — Full Spec

## 10.1 Layout

The SegmentPanel is an overlay at the bottom of the map:

```
┌──────────────────────────────────────────────────────────────┐
│ 🔧 Segment Builder  📍 MG Road → 🏁 Kempegowda Bus Station   │ ✕ │
├──────────────────────────────────────────────────────────────┤
│ 📍 → 🚕 → 🚶 → ⏳ → 🏁                                     │
├──────────────────────────────────────────────────────────────┤
│ 💰 ₹245  ⏱️ 45m  📏 12.3km  3 steps                        │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                      │
│ │ Direct   │ │ Reach    │ │ From     │                      │
│ │ to Dest  │ │ Stop     │ │ Stop     │                      │
│ │          │ │          │ │          │                      │
│ │ 🚕 Cab   │ │ 🚶 Walk  │ │ 🚌 Bus   │                      │
│ │   ₹245   │ │  10min   │ │  500C    │                      │
│ │          │ │          │ │  ₹12     │                      │
│ │ 🛺 Auto  │ │ 🚕 Cab   │ │ 🚇 Metro │                      │
│ │   ₹180   │ │   ₹45    │ │   ₹32    │                      │
│ │          │ │          │ │          │                      │
│ │ 🏍️ Bike │ │ 🚆 Train │ │ 🚕 Cab   │                      │
│ │   ₹90    │ │   ₹120   │ │   ₹150   │                      │
│ └──────────┘ └──────────┘ └──────────┘                      │
│                                                              │
│ ➕ Add Custom Stop                                           │
└──────────────────────────────────────────────────────────────┘
```

## 10.2 Phases

### Phase "init" (Initial Screen)
- Shows all columns with options
- First column: Direct options (if available)
- Following columns: Each via_stop with reach_options
- User can click any option in any column

### Phase "from" (At a Stop)
- Previous columns show selected option (locked)
- New column appears with from_stop_options
- User picks onward transport

### Phase "direct" (Journey Complete)
- Summary bar shows "✅ Journey Complete!"
- Full path summary displayed with all segments
- Timeline shows complete journey

## 10.3 Column System

### Column Structure:
```typescript
interface ColumnCard {
  stageIdx: number
  fromName: string
  options: SegmentStepOption[]
  label: string
  type: 'reach' | 'from' | 'direct'
  selectedOption?: SegmentStepOption
}
```

### Column Progression:
```
Column 0: Direct options (initially)
Column 1: Reach options for via_stop[0]
Column 2: From options for via_stop[0] (appears when user clicks a reach option)
Column 3: Reach options for next location (appears when user picks from option)
...continues until destination reached
```

### Column Properties:
- Min width: 260px
- Max width: 320px
- Horizontally scrollable container
- Each has a header with stop name
- Selected options highlighted in green border

## 10.4 Timeline

Shown as a horizontal bar below the header. Each step is a node:

```
 📍 —— 🚕 —— 🚶 —— ⏳ —— 🏁
```
- Origin: 📍 (blue circle)
- Each step: mode icon in colored circle
- Pending: ⏳ (dashed border, yellow)
- Destination: 🏁 (green when complete, dashed when not)
- Colors: Indexed from `SEGMENT_COLORS` array

## 10.5 Map Geometry

Built path options render as colored segments on the map:

### Geometry Types:
| Type | Description | Rendering |
|------|-------------|-----------|
| `segment` | Path between two points | Colored line |
| `stop` | Waypoint location | Circle marker |
| `hover` | Preview on hover | Yellow highlight |
| `route` | Full route overlay | Dashed line |

### Color Scheme:
```typescript
const SEGMENT_COLORS = [
  '#3b82f6',  // Segment 1 - Blue
  '#22c55e',  // Segment 2 - Green
  '#f97316',  // Segment 3 - Orange
  '#8b5cf6',  // Segment 4 - Purple
  '#f59e0b',  // Segment 5 - Amber
  '#ef4444',  // Segment 6 - Red
  '#06b6d4',  // Segment 7 - Cyan
  '#ec4898',  // Segment 8 - Pink
]
```

### Mode Colors on Cards:
```typescript
const MODE_COLORS = {
  walk: '#22c55e',        // Green
  cab: '#f97316',         // Orange
  auto: '#eab308',        // Yellow
  bike: '#8b5cf6',        // Purple
  bus_ordinary: '#3b82f6', // Blue
  bus_ac_vajra: '#60a5fa', // Light Blue
  metro: '#22c55e',       // Green
  train: '#a855f7',       // Purple
  custom: '#f59e0b',      // Amber
}
```

## 10.6 Custom Stops

Users can insert custom waypoints:
1. Click "➕ Add Custom Stop" button
2. Type place name (autocomplete searches OpenStreetMap)
3. Select from suggestions
4. System inserts waypoint and fetches new segments

### Custom Stop Option Fields:
```typescript
{
  mode: 'custom',
  label: 'Place Name',
  icon: '📍',
  arrives_at_stop: true,   // Always considered a stop
  to_lat: place.lat,
  to_lng: place.lng,
}
```

## 10.7 Bus Route Cards

Each bus route is shown as an **individual card** with:
- Route number badge (e.g., `[500C]`)
- Fare per person
- Duration
- Next bus departure times (from GTFS)
- Color-coded left border

### Bus Times Display:
```
⏰ 14:35, 14:50, 15:05
```
Shows next 4 departure times from GTFS data.

---

# 11. API Endpoints

## 11.1 GET /api/routes/segment-step

### Request:
```
GET /api/routes/segment-step
  ?from_lat=12.9716
  &from_lng=77.5946
  &from_name=MG+Road
  &dest_lat=12.2958
  &dest_lng=76.6394
  &dest_name=Mysuru
  &group_size=2
  &budget=5000
```

### Response Structure:
```json
{
  "status": "success",
  "step": {
    "from": {"lat": 12.9716, "lng": 77.5946, "name": "MG Road"},
    "dest": {"lat": 12.2958, "lng": 76.6394, "name": "Mysuru"},
    "direct_options": [
      {
        "mode": "cab",
        "label": "Uber Go / Ola Mini",
        "icon": "🚕",
        "from": "MG Road",
        "to": "Mysuru",
        "distance_km": 145.2,
        "duration_minutes": 180,
        "fare": 2036,
        "per_person": 1018,
        "from_lat": 12.9716,
        "from_lng": 77.5946,
        "to_lat": 12.2958,
        "to_lng": 76.6394,
        "path": [[12.9716, 77.5946], ..., [12.2958, 76.6394]]
      }
    ],
    "via_stops": [
      {
        "stop": {
          "name": "KSR Bengaluru City Junction",
          "lat": 12.9778,
          "lng": 77.5713,
          "type": "railway"
        },
        "reach_options": [
          {
            "mode": "walk",
            "label": "Walk",
            "icon": "🚶",
            "from": "MG Road",
            "to": "KSR Bengaluru City Junction",
            "distance_km": 1.2,
            "duration_minutes": 14,
            "fare": 0,
            "per_person": 0,
            "from_lat": 12.9716,
            "from_lng": 77.5946,
            "to_lat": 12.9778,
            "to_lng": 77.5713,
            "path": [...]
          }
        ],
        "from_stop_options": [
          {
            "mode": "train",
            "label": "Train 16517 KSR Bengaluru-Mysuru Kannada Express",
            "icon": "🚆",
            "from": "KSR Bengaluru City Junction",
            "to": "Mysuru City Junction",
            "distance_km": 138.5,
            "duration_minutes": 160,
            "fare": 200,
            "per_person": 100,
            "from_lat": 12.9778,
            "from_lng": 77.5713,
            "to_lat": 12.3184,
            "to_lng": 76.6410,
            "arrives_at_stop": true,
            "train_number": "16517",
            "departure_time": "06:45",
            "arrival_time": "09:25",
            "path": [...]
          },
          {
            "mode": "cab",
            "label": "Uber Go / Ola Mini from Mysuru City Junction",
            "icon": "🚕",
            "from": "Mysuru City Junction",
            "to": "Mysuru",
            "distance_km": 2.5,
            "duration_minutes": 8,
            "fare": 120,
            "per_person": 60,
            "from_lat": 12.3184,
            "from_lng": 76.6410,
            "to_lat": 12.2958,
            "to_lng": 76.6394,
            "arrives_at_stop": false,
            "path": [...]
          }
        ]
      }
    ]
  }
}
```

## 11.2 GET /api/search/places

### Request:
```
GET /api/search/places?q=majestic+bangalore&lat=12.97&lng=77.59
```

### Response:
```json
{
  "results": [
    {
      "name": "Kempegowda Bus Station (Majestic)",
      "lat": 12.9779,
      "lng": 77.5724,
      "address": "Gubbi Thotadappa Road, ...",
      "place_type": "bus_station"
    }
  ]
}
```

### Implementation:
- Uses OpenStreetMap Nominatim API
- Filtered by Bengaluru/Karnataka region
- Returns top 5 matches
- Caches frequent searches

---

# 12. Data Files

## 12.1 transit_fares.json

**Location**: `data_cache/transit_fares.json`

Contains three fare slab structures for BMTC Ordinary, BMTC AC Vajra, and Namma Metro.

### Structure:
```json
{
  "namma_metro_slabs": [
    {"max_km": 2.0, "fare": 11.0},
    ...
  ],
  "bmtc_ordinary_slabs": [
    {"max_km": 2.0, "fare": 6.0},
    ...
  ],
  "bmtc_ac_vajra_slabs": [
    {"max_km": 2.0, "adult_fare": 15.0, "child_fare": 10.0, "senior_fare": 15.0},
    ...
  ]
}
```

## 12.2 karnataka_railway_stations.json

**Location**: `data_cache/karnataka_railway_stations.json`

Array of 48 stations with name, lat, lng.

```json
[
  {"name": "KSR Bengaluru City Junction", "lat": 12.9778, "lng": 77.5713},
  {"name": "Yesvantpur Junction", "lat": 13.0208, "lng": 77.5456},
  ...
]
```

**Source**: Manually curated from Indian Railways station list.

## 12.3 GTFS Files

BMTC Bangalore GTFS static data. Files are loaded at startup.

**Important**: The GTFS files must be present in `data_cache/` directory. They are:
- `bmtc_stops.txt`
- `stop_times.txt`
- `trips.txt`
- `shapes.txt`

These are standard GTFS format files from BMTC (Bangalore Metropolitan Transport Corporation).

---

# 13. Configuration & Running

## Prerequisites
- Python 3.12+
- Node.js 18+
- npm 9+

## Backend Setup

```powershell
cd VOYAGER

# Create virtual environment (first time)
python -m venv venv
.\venv\Scripts\Activate

# Install dependencies
pip install -r requirements.txt

# Start server
python -m uvicorn backend.main:app --reload --port 8000
```

## Frontend Setup

```powershell
cd VOYAGER/frontend
npm install

# Start dev server
npx vite --port 5173
```

## Access
- Backend: http://localhost:8000
- Frontend: http://localhost:5173

## Configuration File

**Location**: `backend/core/config.py`

```python
DATA_CACHE_DIR = os.path.join(BASE_DIR, "data_cache")
GTFS_STOP_TIMES_LIMIT = 50000  # Number of stop_times rows to load
```

---

# 14. Performance Notes

## Startup Times
| Operation | Time |
|-----------|------|
| Database initialization | ~1 second |
| GTFS data loading | ~41 seconds |
| First API call | ~42 seconds (includes GTFS load if not loaded) |
| Subsequent API calls | ~2-5 seconds |

## Optimizations
- Reduce `stop_times_count` limit in `gtfs_service.py:97` to make GTFS loading faster (e.g., 10000)
- GTFS loads synchronously — consider moving to background thread
- Railway station data is small (48 stations) — negligible load time
- Bus stops (~3000) — fast hash-based lookup

## Bottlenecks
1. **GTFS stop_times parsing** — 50,000 row limit, takes ~40 seconds
2. **Haversine calculations** — each API call does 50+ distance calculations
3. **Route number matching** — O(n²) comparison between nearby stops

---

# 15. Known Issues & Limitations

## Critical Issues

### 1. Train Paths are Straight Lines
Train paths between railway stations use straight-line interpolation (same as road paths). Proper railway track geometry is needed for realistic map display.

**Impact**: Map shows trains traveling in straight lines, which is unrealistic for winding railway tracks.
**Fix needed**: Replace with actual railway track coordinates.

### 2. Generic Train Numbers are Fake
For unknown station pairs, the system generates synthetic train numbers and times based on string hashes. These don't correspond to real trains.

**Impact**: Users might try to book non-existent trains.
**Fix needed**: Integrate with IRCTC API or maintain comprehensive train schedule database.

### 3. GTFS Loading Time
41 seconds at startup is unacceptable for production use.

**Impact**: First API call is very slow; poor user experience.
**Fixes possible**:
- Move to background thread
- Pre-load on server start instead of lazy-load
- Reduce stop_times limit
- Use database (SQLite) instead of in-memory parsing

### 4. No Real-Time Traffic
Ride-hailing prices assume constant per-km rates. Real Uber/Ola use surge pricing.

**Impact**: Price estimates may be inaccurate during peak hours.

### 5. Limited Out-of-State Reach
Only Karnataka railway stations are included. Journeys to/from other states not supported.

## Moderate Issues

### 6. Metro Line Path Coverage
Not all metro station pairs return proper line paths. Some routes use straight-line interpolation.

### 7. Bus Route Number Matching
`_get_bus_route_nums` uses string matching on route names which may miss some connections.

### 8. Budget Check is Optional
Budget filtering is applied inconsistently — some options are checked, others bypass.

### 9. No Multi-Destination Support
Only point-to-point routes. No support for multi-stop tour planning.

### 10. Group Size Handling
Group size affects pricing but not vehicle availability. A group of 5 would be shown XL options but not standard cab.

## Minor Issues

### 11. Walking Speed Assumption
Walking speed fixed at 12 min/km (5 km/h). No adjustment for terrain, traffic, or user preference.

### 12. Metro/Metro Interchange Not Modeled
Switching between metro lines is not handled. Each metro trip is treated as single-line.

### 13. AC Bus Always Adult Fare
AC bus pricing always uses adult fare. No way for user to specify passenger type.

### 14. Custom Stop Coordinates
Custom stops use the coordinates from Nominatim but the "from" coordinates reference the segmentStep origin (not the current location).

---

# 16. Future Roadmap

## 16.1 Immediate Next Steps

### Priority 1: Real Railway Track Paths
Replace straight-line train paths with actual railway track geometry.
- Collect track coordinates for major Karnataka routes
- Store as GeoJSON or JSON array per route pair
- Use in `_interpolate_path` or as direct path data

### Priority 2: Expand Train Database
Replace generic train generator with real train data.
- Add all Karnataka express/passenger trains
- Include train numbers, names, schedules
- Use IRCTC API or maintain comprehensive JSON

### Priority 3: GTFS Loading Optimization
- Move GTFS loading to background thread
- Add loading progress indicator in API
- Implement caching layer (Redis or SQLite)

### Priority 4: Fix From-Stop Walk Option
Verify walk appears in from_stop_options for all stop types when ≤ 2 km from destination.

### Priority 5: Enhance Segment Panel
- Improve column rendering performance
- Add drag-to-reorder segments
- Smooth column transitions
- Save/load routes

## 16.2 Short-Term Improvements

### UI/UX
- [ ] Dark/light theme toggle
- [ ] Mobile-responsive layout
- [ ] Segment card animations
- [ ] Touch-friendly option buttons
- [ ] Route comparison view (side-by-side)

### Data
- [ ] KSRTC (Karnataka State Road Transport) bus integration
- [ ] Auto-rickshaw fare estimation (current meter rates)
- [ ] Real-time traffic data integration
- [ ] More accurate Uber/Ola fare API

### Features
- [ ] Multi-stop journey planning (add multiple waypoints)
- [ ] Recurring journey scheduling
- [ ] Offline mode (cached data)
- [ ] Journey history
- [ ] Favorite routes
- [ ] Share journey link

### Backend
- [ ] Add proper logging
- [ ] Unit tests for routing logic
- [ ] API rate limiting
- [ ] Response caching (Redis)
- [ ] Docker containerization

## 16.3 Long-Term Vision

### Phase 1: Karnataka-Wide Coverage
- All Karnataka railway stations with real schedules
- KSRTC bus integration
- Inter-city cab/auto estimates
- Airport transfers (Kempegowda International Airport)

### Phase 2: Multi-State Coverage
- Add neighboring states: Tamil Nadu (Chennai), Andhra (Tirupati), Kerala (Kochi)
- Interstate bus services
- Long-distance train coverage (all of India)

### Phase 3: Real-Time Integration
- Live train tracking (IRCTC API)
- Live bus tracking (BMTC GPS data)
- Real-time ride-hailing prices (Uber/Ola API)
- Traffic-aware routing

### Phase 4: Advanced Features
- AI-powered route recommendations
- Carbon footprint calculator
- Multi-modal optimization (shortest time, lowest cost, eco-friendly)
- Group ride coordination
- Ticket booking integration
- PNR status checking
- Seat availability for trains/buses

### Phase 5: Platform Expansion
- Mobile app (React Native)
- Progressive Web App
- Voice assistant integration
- Smart watch companion
- Public transit card integration

---

# 17. Complete File Reference

## Backend Files

| File | Lines | Purpose |
|------|-------|---------|
| `backend/main.py` | ~30 | FastAPI app entry, CORS, router registration |
| `backend/core/config.py` | ~15 | Settings, path configuration |
| `backend/core/database.py` | ~285 | TransitDatabase class, all data loading & queries |
| `backend/services/transit_service.py` | ~1370 | Main routing engine, segment logic, fares |
| `backend/services/gtfs_service.py` | ~200 | GTFS data loader & bus time queries |
| `backend/api/routes.py` | ~400 | FastAPI route definitions |

## Frontend Files

| File | Lines | Purpose |
|------|-------|---------|
| `frontend/src/App.tsx` | ~200 | Main app, map, search, segment panel |
| `frontend/src/components/SegmentPanel.tsx` | ~550 | Segment builder UI |
| `frontend/src/services/api.ts` | ~50 | API client functions |
| `frontend/src/utils/helpers.ts` | ~80 | Icons, labels, formatters |
| `frontend/src/types.ts` | ~60 | TypeScript interfaces |

## Data Files

| File | Size | Records |
|------|------|---------|
| `data_cache/transit_fares.json` | ~2KB | 3 slab tables |
| `data_cache/karnataka_railway_stations.json` | ~3KB | 48 stations |
| `data_cache/bmtc_stops.txt` | ~200KB | ~3000 stops |
| `data_cache/stop_times.txt` | ~2MB | 50,000 rows (limited) |
| `data_cache/shapes.txt` | ~5MB | ~7300 shapes |
| `data_cache/bengaluru_metro_network.csv` | ~10KB | 85 stations |

---

## Appendix: Key Design Decisions

### Why Two-Phase Instead of One-Shot?
- Users can make informed choices at each step
- Backend doesn't need to compute all possible route combinations upfront
- Each segment is independent → easier to extend
- Progressive disclosure: users see only relevant options

### Why Not Show All Routes at Once?
- The combinatorial explosion of route options is massive
- BMTC alone has 600+ routes, combining with metro/train/cab creates millions of permutations
- Two-phase approach reduces cognitive load
- Users can customize their journey at each step

### Why Direct Options Only Cab/Auto/Bike?
- These are doorstep-to-doorstep services
- Bus/metro/train require walking to a stop → segments
- Keeps the distinction clear: "direct" = no transit needed
- Encourages users to build proper multi-modal journeys

### Why Fare Data in JSON Instead of API?
- Transit fares change infrequently
- No real-time fare API exists for BMTC/Metro
- JSON slabs are fast to load and easy to update
- Allows offline functionality

### Why Hardcoded Train Data?
- Indian Railways has no free, easy-to-use API
- IRCTC API requires complex authentication
- Maintaining full train schedule is a large task
- Hardcoded common routes covers 90% of user needs
- Generic generator covers the remaining 10%

---

*Document Version: 1.0*
*Last Updated: July 2026*
*Project: VOYAGER — Bengaluru Transit Navigator*
