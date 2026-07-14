import sys, os, time
sys.path.insert(0, '.')

# Set test time
os.environ["VOYAGER_TEST_TIME"] = "2024-07-15 12:00:00"

# Initialize DB
from backend.core.database import db
db.initialize()
print(f"DB loaded: {len(db.bus_stops)} bus stops, {len(db.metro_stations)} metro")

# Load GTFS
t0 = time.time()
from backend.services.gtfs_service import gtfs_loader
try:
    gtfs_loader.load()
    print(f"GTFS loaded in {time.time()-t0:.1f}s")
    print(f"  shapes: {len(gtfs_loader._shapes)}")
    print(f"  stops with times: {len(gtfs_loader._stop_times)}")
    print(f"  routes indexed: {len(gtfs_loader._stop_times_by_route)}")
    
    # Check Yelahanka Old Town matching
    yh_key = gtfs_loader._resolve_name("Yelahanka Old Town")
    print(f"\nResolved 'Yelahanka Old Town' -> GTFS key: {yh_key}")
    if yh_key:
        print(f"  Sample bus times: {gtfs_loader._stop_times.get(yh_key, [])[:5]}")
    
    # Try some variants
    for test_name in ["Yelahanka New Town", "Yelahanka", "Yelahanka Old Town", "yelahanka old town"]:
        resolved = gtfs_loader._resolve_name(test_name)
        print(f"  '{test_name}' -> '{resolved}'")
    
    # Check for any GTFS stops near Yelahanka
    yh_gtfs = [k for k in gtfs_loader._stop_times.keys() if 'yelahanka' in k.lower()]
    print(f"\nGTFS stops containing 'yelahanka': {len(yh_gtfs)}")
    for k in yh_gtfs[:10]:
        routes = [r for _, r in gtfs_loader._stop_times.get(k, [])]
        print(f"  {k}: routes={routes[:5]}")
    
    # Check _all_gtfs_names for yelahanka
    yh_all = [k for k in gtfs_loader._all_gtfs_names if 'yelahanka' in k.lower()]
    print(f"\nAll GTFS names containing 'yelahanka': {len(yh_all)}")
    for k in yh_all[:5]:
        print(f"  {k}")
    
    # Test route shapes for BMTC routes found at Yelahanka
    test_routes = ["401-AB", "401-AE", "285-B", "285-H"]
    for rn in test_routes:
        shape = gtfs_loader.get_shape_path_for_route(rn)
        print(f"\nRoute {rn}: shape={len(shape) if shape else 0} points")
        stops = gtfs_loader.find_stops_on_route_toward_dest(rn, 13.1007, 77.5943, 12.9755, 77.6068, 3)
        if stops:
            for s in stops:
                print(f"  stop: {s['stop_name']} dist={s['distance_to_dest_km']}km")
    
except Exception as e:
    print(f"GTFS ERROR: {e}")
    import traceback
    traceback.print_exc()
