import pandas as pd
import json
import os
from datetime import datetime

class DataPreprocessor:
    def __init__(self):
        self.data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data_cache")
        self.processed_dir = os.path.join(self.data_dir, "processed")
        os.makedirs(self.processed_dir, exist_ok=True)

    def preprocess_metro_network(self):
        path = os.path.join(self.data_dir, "bengaluru_metro_network.csv")
        if not os.path.exists(path):
            return None
        df = pd.read_csv(path)
        df = df.dropna(subset=["latitude", "longitude", "station_name"])
        df.to_csv(os.path.join(self.processed_dir, "metro_stations_clean.csv"), index=False)
        return df

    def preprocess_bus_stops(self):
        path = os.path.join(self.data_dir, "bmtc_all_stops_master.csv")
        if not os.path.exists(path):
            return None
        df = pd.read_csv(path)
        lat_cols = [c for c in df.columns if "lat" in c.lower()]
        lon_cols = [c for c in df.columns if "lon" in c.lower()]

        if lat_cols and lon_cols:
            df = df.rename(columns={lat_cols[0]: "lat", lon_cols[0]: "lng"})
        df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
        df["lng"] = pd.to_numeric(df["lng"], errors="coerce")
        df = df.dropna(subset=["lat", "lng"])
        df = df[(df["lat"] != 0) & (df["lng"] != 0)]
        df.to_csv(os.path.join(self.processed_dir, "bus_stops_clean.csv"), index=False)
        return df

    def preprocess_ride_data(self):
        path = os.path.join(self.data_dir, "rides_data.csv")
        if not os.path.exists(path):
            path = os.path.join(self.data_dir, "bangalore_ride_data.csv")
        if not os.path.exists(path):
            return None
        df = pd.read_csv(path, nrows=5000)
        df.to_csv(os.path.join(self.processed_dir, "rides_sample.csv"), index=False)
        return df

    def preprocess_traffic_logs(self):
        path = os.path.join(self.data_dir, "traffic_logs.csv")
        if not os.path.exists(path):
            return None
        df = pd.read_csv(path)
        df.to_csv(os.path.join(self.processed_dir, "traffic_logs_clean.csv"), index=False)
        return df

    def preprocess_all(self):
        results = {}
        results["metro"] = self.preprocess_metro_network()
        results["bus_stops"] = self.preprocess_bus_stops()
        results["ride_data"] = self.preprocess_ride_data()
        results["traffic"] = self.preprocess_traffic_logs()
        return results

preprocessor = DataPreprocessor()
