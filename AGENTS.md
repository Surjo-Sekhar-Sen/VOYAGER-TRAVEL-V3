# VOYAGER - Project Summary

## Architecture
- **Backend**: FastAPI (uvicorn) on port 8000
  - `backend/services/transit_service.py` — main routing logic (two-phase segment builder, train data, smart filtering)
  - `backend/services/gtfs_service.py` — BMTC GTFS data loader (synchronous at startup, ~41s)
  - `backend/core/database.py` — bus/metro/railway station data
- **Frontend**: Vite + React/TS on port 3000
  - `src/components/SegmentPanel.tsx` — two-phase sequential overlay (init → from) with timeline, color-coded cards
  - `src/utils/helpers.ts` — mode icons/labels

## Key Features Built
1. **Two-phase segment builder** — Phase "init" shows reach options + direct options; Phase "from" shows from_stop_options for reached stop; next segment fetches new data from new location
2. **bus_then_cab combo** — for out-of-Bengaluru destinations, farthest BMTC stop en route, bus there + cab rest
3. **Railway stations** — 48 Karnataka stations, `find_nearby_railway_stations()`, railway via-stops with train from_stop_options + last-mile cab/walk
4. **Train integration** — direct train option (cab→train→cab) with train numbers, departure/arrival times, per-person fares. `_get_train_options()` maps common Bengaluru↔Mysuru trains.
5. **GTFS bus departure times** — synchronous load at server start (`stop_times.txt`, 50k limit), `get_next_buses()` filters by current time, available in from_stop_options as `bus_times` array
6. **Last-mile walk** — from_stop_options include a walk option when the stop/station is within 2 km of destination
7. **Interpolated paths** — all reach/from/direct options include `path` coordinates for map display
8. **Bus fares** — uses `transit_fares.json` slab data, `max(6, round(db.get_bmtc_ordinary_fare()))` per-person (no artificial floor)
9. **Smart filtering** — via stop skipped if no common routes; reach options show only walk when dist < 0.5 km; bus from_stop_options only when `has_common`; train only for long-distance

## Train Data (hardcoded)
- `transit_service.py:_TRAIN_DATA` — Bengaluru↔Mysuru trains with number/name/departure/arrival
- `transit_service.py:_get_train_options()` — normalizes station names, returns matching trains

## Performance Notes
- GTFS loading takes ~41s synchronously at server startup
- DB init is fast (~1s)
- API response for Mysuru ~3s; within-Bengaluru may trigger GTFS load on first call
- Reduce `stop_times_count` limit in `gtfs_service.py:97` to make GTFS loading faster

## Running
```powershell
cd VOYAGER
python -m uvicorn backend.main:app --reload --port 8000
cd frontend; npx vite --port 3000
```

## API Endpoint
```
GET /api/routes/segment-step?from_lat=...&from_lng=...&from_name=...&dest_lat=...&dest_lng=...&dest_name=...&group_size=N&budget=N
```
Returns `direct_options` (cab/auto/train/bus_then_cab) + `via_stops` array with `reach_options` + `from_stop_options`.
