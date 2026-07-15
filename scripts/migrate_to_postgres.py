"""Migration script: populate PostgreSQL from existing data files.
Usage: python scripts/migrate_to_postgres.py

Requires: pip install psycopg2-binary
Run after: createdb voyager && psql voyager < backend/core/schema.sql"""

import json, csv, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from backend.core.config import settings

DB_CONFIG = {
    "dbname": "voyager",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": 5432,
}

def migrate():
    try:
        import psycopg2
    except ImportError:
        print("Install psycopg2-binary first: pip install psycopg2-binary")
        return

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Bus stops
    path = os.path.join(settings.DATA_CACHE_DIR, "bmtc_all_stops_master.csv")
    if os.path.exists(path):
        import pandas as pd
        df = pd.read_csv(path)
        df.columns = [c.strip() for c in df.columns]
        count = 0
        for _, row in df.iterrows():
            name = str(row.get("Stop Name", ""))
            lat = float(row.get("Latitude", 0))
            lng = float(row.get("Longitude", 0))
            if lat == 0 and lng == 0 or not name:
                continue
            routes_raw = row.get("Routes with num trips", "{}")
            routes = []
            if isinstance(routes_raw, str) and routes_raw.startswith("{"):
                try:
                    import ast
                    routes = list(ast.literal_eval(routes_raw).keys())
                except:
                    pass
            cur.execute(
                "INSERT INTO bus_stops (name, geom, routes) VALUES (%s, ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography, %s)",
                (name, lng, lat, routes)
            )
            count += 1
        conn.commit()
        print(f"Inserted {count} bus stops")

    # Metro stations
    path = os.path.join(settings.DATA_CACHE_DIR, "bengaluru_metro_network.csv")
    if os.path.exists(path):
        df = pd.read_csv(path)
        count = 0
        for _, row in df.iterrows():
            cur.execute(
                """INSERT INTO metro_stations (station_code, name, line, sequence, next_station_code,
                   distance_to_next_km, is_interchange, geom)
                   VALUES (%s,%s,%s,%s,%s,%s,%s, ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography)
                   ON CONFLICT (station_code) DO NOTHING""",
                (
                    str(row.get("station_code", "")),
                    row.get("station_name", ""),
                    row.get("line", ""),
                    int(row.get("sequence", 0)),
                    str(row.get("next_station_code", "")),
                    float(row.get("distance_to_next_km", 0)),
                    int(row.get("is_interchange", 0)),
                    float(row.get("longitude", 0)),
                    float(row.get("latitude", 0)),
                )
            )
            count += 1
        conn.commit()
        print(f"Inserted {count} metro stations")

    # Railway stations
    path = os.path.join(settings.DATA_CACHE_DIR, "karnataka_railway_stations.json")
    if os.path.exists(path):
        with open(path) as f:
            data = json.load(f)
        count = 0
        for stn in data:
            cur.execute(
                "INSERT INTO railway_stations (station_code, name, geom) VALUES (%s,%s, ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography) ON CONFLICT (station_code) DO NOTHING",
                (str(stn.get("code", "")), stn.get("name", ""), stn.get("lng", 0), stn.get("lat", 0))
            )
            count += 1
        conn.commit()
        print(f"Inserted {count} railway stations")

    # Transit fares
    path = os.path.join(settings.DATA_CACHE_DIR, "transit_fares.json")
    if os.path.exists(path):
        with open(path) as f:
            fares = json.load(f)
        for mode, key in [("bmtc_ordinary", "bmtc_ordinary_slabs"), ("bmtc_ac", "bmtc_ac_vajra_slabs"), ("metro", "namma_metro_slabs")]:
            for slab in fares.get(key, []):
                cur.execute(
                    "INSERT INTO transit_fares (mode, max_km, adult_fare, child_fare, senior_fare) VALUES (%s,%s,%s,%s,%s)",
                    (mode, slab["max_km"], slab.get("fare", slab.get("adult_fare", 0)),
                     slab.get("child_fare"), slab.get("senior_fare"))
                )
        conn.commit()
        print("Inserted fare slabs")

    cur.close()
    conn.close()
    print("\nMigration complete! You can now switch PgDatabase in database.py")

if __name__ == "__main__":
    migrate()
