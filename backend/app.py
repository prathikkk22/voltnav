"""
=================================================================================
⚡ VoltNav - FastAPI Production Backend
=================================================================================
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import os
import math
import random
import time

app = FastAPI(
    title="VoltNav EV Tracker API",
    description="REST API for Kaggle EV Charging Stations with Live Slot Tracking",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "cleaned_ev_stations.json")

def load_data():
    if os.path.exists(DATA_PATH):
        with open(DATA_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

STATIONS = load_data()
STATIONS_BY_ID = {s['id']: s for s in STATIONS}

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2)**2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2)**2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)

@app.get("/api/stats")
def get_stats():
    total = len(STATIONS)
    total_slots = sum(s['total_slots'] for s in STATIONS)
    available_slots = sum(s['available_slots'] for s in STATIONS)
    occupied_slots = sum(s['occupied_slots'] for s in STATIONS)
    return {
        "total_stations": total,
        "available_stations": sum(1 for s in STATIONS if s['available_slots'] > 0),
        "total_slots": total_slots,
        "available_slots": available_slots,
        "occupied_slots": occupied_slots,
        "utilization_rate": round(occupied_slots / total_slots * 100, 1) if total_slots else 0,
        "cities_count": len(set(s['city'] for s in STATIONS)),
        "states_count": len(set(s['state'] for s in STATIONS)),
    }

@app.get("/api/stations")
def get_stations(
    q: str = "",
    city: str = "",
    state: str = "",
    charger_type: str = "",
    status: str = "",
    page: int = 1,
    limit: int = 18,
    lat: float = None,
    lon: float = None,
    sort_by: str = "default"
):
    filtered = []
    for s in STATIONS:
        if q and q.lower() not in f"{s['name']} {s['city']} {s['state']} {s['address']}".lower():
            continue
        if city and city.lower() != 'all' and s['city'].lower() != city.lower():
            continue
        if state and state.lower() != 'all' and s['state'].lower() != state.lower():
            continue
        if charger_type and charger_type.lower() != 'all' and charger_type.lower() not in s['charger_type'].lower():
            continue
        if status and status.lower() != 'all':
            if status.lower() == 'available' and s['available_slots'] == 0:
                continue
            if status.lower() == 'occupied' and s['available_slots'] > 0:
                continue

        rec = dict(s)
        if lat is not None and lon is not None:
            rec['distance_km'] = haversine(lat, lon, s['latitude'], s['longitude'])
        else:
            rec['distance_km'] = None
        filtered.append(rec)

    if sort_by == 'distance' and lat is not None:
        filtered.sort(key=lambda x: x['distance_km'] if x['distance_km'] is not None else 999999)
    elif sort_by == 'power':
        filtered.sort(key=lambda x: x['power_kw'], reverse=True)
    elif sort_by == 'available_slots':
        filtered.sort(key=lambda x: x['available_slots'], reverse=True)

    start = (page - 1) * limit
    return {
        "total": len(filtered),
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(len(filtered) / limit) if limit else 1,
        "stations": filtered[start:start+limit]
    }

@app.get("/api/stations/{stn_id}")
def get_station_by_id(stn_id: str):
    stn = STATIONS_BY_ID.get(stn_id)
    if not stn:
        raise HTTPException(status_code=404, detail="Station not found")
    return stn

# Mount frontend static directory if exists
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
