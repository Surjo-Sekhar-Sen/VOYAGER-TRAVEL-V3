import httpx, json

r = httpx.get(
    "http://127.0.0.1:8000/api/routes/all-segments",
    params={
        "from_lat": 13.1, "from_lng": 77.6, "from_name": "Yelahanka",
        "dest_lat": 12.95, "dest_lng": 77.6, "dest_name": "MG Road",
        "group_size": 1, "budget": 500, "skip_llm_pricing": "true"
    },
    timeout=120
)
d = r.json()
data = d.get("data", {})
s0 = data.get("segments", [{}])[0]
dests = s0.get("destinations", [])
print("=== SEGMENT 0 ===")
print("Destinations:", len(dests))
for de in dests:
    topts = de.get("transit_options", [])
    reach = de.get("reach_options", [])
    sn = de["stop"]["name"]
    st = de["stop"]["type"]
    print(f'Stop: {sn} ({st}) reach={len(reach)} transit={len(topts)}')
    for t in topts[:2]:
        mode = t["mode"]
        label = t["label"]
        to = t["to"]
        fare = t["fare"]
        dur = t["duration_minutes"]
        bus_times = t.get("bus_times", [])
        nt_count = len(t.get("next_transit", []))
        fo_count = len(t.get("final_options", []))
        print(f'  {mode} {label} -> {to} (Rs{fare}, {dur}min) nt={nt_count} fo={fo_count}')
        if bus_times:
            times = [b["departure_time"] for b in bus_times[:3]]
            print(f"    Times: {times}")
        if nt_count > 0:
            for nt in t.get("next_transit", [])[:1]:
                print(f"    NextTransit: {nt['mode']} {nt['label']} -> {nt['to']} nt2={len(nt.get('next_transit',[]))}")

print("\n=== DIRECT OPTIONS ===")
for do in s0.get("direct_options", []):
    print(f"  {do['mode']} {do['label']} Rs{do['fare']} {do['duration_minutes']}min")
