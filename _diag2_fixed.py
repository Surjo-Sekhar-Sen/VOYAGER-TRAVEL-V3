import sys, os, time, zipfile, csv, io
sys.path.insert(0, '.')

os.environ["VOYAGER_TEST_TIME"] = "2024-07-15 12:00:00"
from backend.core.database import db
db.initialize()

from backend.services.gtfs_service import gtfs_loader, _time_to_seconds
try:
    gtfs_loader.load()
except:
    pass

# 1. Check what route_short_names look like in GTFS
print("=== GTFS route_short_name samples ===")
zip_path = os.path.join('data_cache', 'bmtc_gtfs.zip')
if os.path.exists(zip_path):
    with zipfile.ZipFile(zip_path) as z:
        with z.open("routes.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
            count = 0
            for row in reader:
                if count < 20:
                    sn = row.get('route_short_name','')
                    ln = row.get('route_long_name','')
                    sys.stdout.write(f"  route_id={row['route_id']} short_name='{sn}' long_name='{ln}'\n")
                count += 1
            sys.stdout.write(f"  Total routes: {count}\n")

# 2. Check stop_times_by_route
print(f"\n=== _stop_times_by_route ===")
print(f"  Number of routes indexed: {len(gtfs_loader._stop_times_by_route)}")
if len(gtfs_loader._stop_times_by_route) > 0:
    sample_routes = list(gtfs_loader._stop_times_by_route.keys())[:10]
    for rn in sample_routes:
        entries = gtfs_loader._stop_times_by_route[rn]
        print(f"  Route {rn}: {len(entries)} entries, first: {entries[0]}")

# 3. Check what routes.txt has for route_id mapping
print(f"\n=== route_id_to_name check ===")
with zipfile.ZipFile(zip_path) as z:
    route_id_to_name = {}
    trip_to_route = {}
    with z.open("routes.txt") as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
        for row in reader:
            rid = row["route_id"]
            sn = row.get("route_short_name", "").strip().upper()
            route_id_to_name[rid] = sn
    
    with z.open("trips.txt") as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
        for row in reader:
            trip_to_route[row["trip_id"]] = row["route_id"]
    
    # Check a sample of trip_to_route mapping
    sample_trips = list(trip_to_route.items())[:10]
    for trip_id, rid in sample_trips:
        sn = route_id_to_name.get(rid, "NOT_FOUND")
        print(f"  trip_id={trip_id} -> route_id={rid} -> short_name='{sn}'")

# 4. Check what routes are stored for Yelahanka Old Town in stop_times
yh_key = gtfs_loader._resolve_name("Yelahanka Old Town")
print(f"\n=== Yelahanka Old Town (GTFS key: {yh_key}) ===")
if yh_key:
    now_s = _time_to_seconds("12:00:00")
    times = gtfs_loader._stop_times.get(yh_key, [])
    print(f"  Total stop_times entries: {len(times)}")

    future = [(t, r) for t, r in times if _time_to_seconds(t) >= now_s]
    print(f"  Future entries (after 12:00): {len(future)}")
    for t, r in sorted(future, key=lambda x: x[0])[:15]:
        print(f"    {t} - {r}")

# 5. Check get_all_routes_at_stop result
print(f"\n=== get_all_routes_at_stop ===")
try:
    routes = gtfs_loader.get_all_routes_at_stop("Yelahanka Old Town")
    print(f"  Routes found: {len(routes)}")
    for r in routes[:10]:
        print(f"  {r['route_number']}: next_deps={r['next_departures']}")
except Exception as e:
    print(f"  ERROR: {e}")
