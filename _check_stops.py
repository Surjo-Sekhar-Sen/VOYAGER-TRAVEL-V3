import sys; sys.path.insert(0, '.')
from backend.core.database import db
db.initialize()

stops_list = list(db.bus_stops.values())

yh_stops = [s for s in stops_list if isinstance(s.get('name'), str) and 'yelahanka' in s['name'].lower()]
print(f'Found {len(yh_stops)} Yelahanka bus stops')
for s in yh_stops[:10]:
    print(f'  {s["name"]}: ({s["lat"]}, {s["lng"]}) routes: {s.get("routes", [])[:5]}')

old_town = [s for s in stops_list if isinstance(s.get('name'), str) and 'old town' in s['name'].lower()]
print(f'\nFound {len(old_town)} old town stops')
for s in old_town[:5]:
    print(f'  {s["name"]}: ({s["lat"]}, {s["lng"]})')

mgr = [s for s in stops_list if isinstance(s.get('name'), str) and ('mg road' in s['name'].lower() or 'mahatma gandhi' in s['name'].lower())]
print(f'\nFound {len(mgr)} MG Road stops')
for s in mgr[:5]:
    print(f'  {s["name"]}: ({s["lat"]}, {s["lng"]})')

print(f'\nMetro stations: {len(db.metro_stations)}')
for m in db.metro_stations[:5]:
    print(f'  {m["name"]}: ({m["lat"]}, {m["lng"]}) line={m.get("line")}')
