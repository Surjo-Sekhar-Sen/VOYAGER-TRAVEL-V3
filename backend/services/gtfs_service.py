"""GTFS data loader for BMTC bus routes - provides real bus path geometry."""
import csv, io, zipfile, os, math
from backend.core.config import settings

class GTFSLoader:
    def __init__(self):
        self._shapes = {}         # shape_id -> list of (lat, lng)
        self._route_shapes = {}   # route_short_name -> [shape_id, ...]
        self._stop_to_shapes = {} # stop_name -> [(shape_id, seq), ...]
        self._stops_by_name = {}  # stop_name -> (lat, lng, stop_id)
        self._loaded = False

    def _hav(self, a, b):
        R = 6371
        dlat = (b[0] - a[0]) * math.pi / 180
        dlng = (b[1] - a[1]) * math.pi / 180
        x = math.sin(dlat/2)**2 + math.cos(a[0]*math.pi/180) * math.cos(b[0]*math.pi/180) * math.sin(dlng/2)**2
        return 2 * R * math.asin(math.sqrt(x))

    def load(self):
        if self._loaded:
            return
        path = os.path.join(settings.DATA_CACHE_DIR, "bmtc_gtfs.zip")
        if not os.path.exists(path):
            print("[GTFS] File not found:", path)
            return
        with zipfile.ZipFile(path, "r") as z:
            # Load shapes
            with z.open("shapes.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
                for row in reader:
                    sid = row["shape_id"]
                    lat = float(row["shape_pt_lat"])
                    lng = float(row["shape_pt_lon"])
                    seq = int(row["shape_pt_sequence"])
                    if sid not in self._shapes:
                        self._shapes[sid] = []
                    self._shapes[sid].append((lat, lng, seq))

            for sid in self._shapes:
                self._shapes[sid].sort(key=lambda x: x[2])
                self._shapes[sid] = [(c[0], c[1]) for c in self._shapes[sid]]

            # Load stops
            with z.open("stops.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
                for row in reader:
                    name = row["stop_name"].strip().lower()
                    self._stops_by_name[name] = (
                        float(row["stop_lat"]), float(row["stop_lon"]), row["stop_id"]
                    )

            # Load trips -> shape mapping
            trip_shape_map = {}
            with z.open("trips.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
                for row in reader:
                    sid = row.get("shape_id", "")
                    if sid in self._shapes:
                        trip_shape_map[row["trip_id"]] = sid

            # Load stop_times -> map stops to shapes
            shape_stops = {}
            with z.open("stop_times.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
                for row in reader:
                    shape_id = trip_shape_map.get(row["trip_id"])
                    if shape_id:
                        sid = row["stop_id"]
                        seq = int(row["stop_sequence"])
                        if shape_id not in shape_stops:
                            shape_stops[shape_id] = {}
                        if sid not in shape_stops[shape_id]:
                            shape_stops[shape_id][sid] = seq

            # Build stop_name -> shape_ids index
            for sname, (slat, slng, sid) in self._stops_by_name.items():
                for shape_id, stop_seqs in shape_stops.items():
                    if sid in stop_seqs:
                        if sname not in self._stop_to_shapes:
                            self._stop_to_shapes[sname] = []
                        self._stop_to_shapes[sname].append((shape_id, stop_seqs[sid]))

            # Load routes -> short_name mapping
            route_id_to_name = {}
            with z.open("routes.txt") as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
                for row in reader:
                    rid = row["route_id"]
                    sn = row.get("route_short_name", "").strip().upper()
                    route_id_to_name[rid] = sn

            # Build route_short_name -> shapes
            for trip_id, shape_id in trip_shape_map.items():
                rid = trip_id.split("-")[0] if "-" in trip_id else trip_id
                short_name = route_id_to_name.get(rid, rid)
                if short_name not in self._route_shapes:
                    self._route_shapes[short_name] = []
                if shape_id not in self._route_shapes[short_name]:
                    self._route_shapes[short_name].append(shape_id)

        print(f"[GTFS] Loaded {len(self._shapes)} shapes, {len(self._route_shapes)} route mappings, {len(self._stop_to_shapes)} stop->shape mappings")
        self._loaded = True

    def get_shape_by_route(self, route_short_name: str):
        key = route_short_name.strip().upper()
        shape_ids = self._route_shapes.get(key)
        if shape_ids:
            coords = self._shapes.get(shape_ids[0])
            if coords and len(coords) >= 2:
                return coords
        return None

    def get_shape_between_stops(self, from_name: str, to_name: str):
        """Find a GTFS shape that goes through both stops, clip to the segment between them."""
        fk = from_name.lower().strip()
        tk = to_name.lower().strip()
        f_stop = self._stop_to_shapes.get(fk, [])
        t_stop = self._stop_to_shapes.get(tk, [])
        if not f_stop or not t_stop:
            return None
        f_shapes = {s[0]: s[1] for s in f_stop}
        t_shapes = {s[0]: s[1] for s in t_stop}
        common = set(f_shapes.keys()) & set(t_shapes.keys())
        for shape_id in common:
            coords = self._shapes.get(shape_id)
            if not coords:
                continue
            f_seq = f_shapes[shape_id]
            t_seq = t_shapes[shape_id]
            start = min(f_seq, t_seq) - 1
            end = max(f_seq, t_seq)
            segment = coords[start:end]
            if len(segment) >= 2:
                if f_seq <= t_seq:
                    return segment
                else:
                    return list(reversed(segment))
        return None

gtfs_loader = GTFSLoader()
