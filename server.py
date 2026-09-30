"""
=================================================================================
⚡ VoltNav - Backend REST API & Static Web Server
Built with Python 3 Standard Library (Zero-Dependency, Instant Launch)
=================================================================
Provides all REST API endpoints for:
 - EV station queries, search, filter, and pagination
 - Live slot availability tracking and dynamic simulation
 - Geolocation proximity search (Haversine formula)
 - Summary statistics for dashboard metrics
 - Serves 3D animated frontend assets
"""

import http.server
import json
import math
import mimetypes
import os
import random
import re
import sys
import threading
import time
from urllib.parse import urlparse, parse_qs

# UTF-8 Console Support
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PORT = 5000
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "cleaned_ev_stations.json")
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

# In-memory station database
STATIONS = []
STATIONS_BY_ID = {}
STATS_CACHE = {}

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance between two points in km."""
    R = 6371.0 # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

def load_dataset():
    global STATIONS, STATIONS_BY_ID
    if not os.path.exists(DATA_PATH):
        print(f"⚠️ Cleaned dataset not found at {DATA_PATH}. Running cleaner...")
        import clean_data
        clean_data.clean_ev_dataset()

    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        STATIONS = json.load(f)

    STATIONS_BY_ID = {s['id']: s for s in STATIONS}
    update_stats()
    print(f" Loaded {len(STATIONS)} EV Charging Stations into memory.")

def update_stats():
    global STATS_CACHE
    total_stations = len(STATIONS)
    total_slots = sum(s['total_slots'] for s in STATIONS)
    available_slots = sum(s['available_slots'] for s in STATIONS)
    occupied_slots = sum(s['occupied_slots'] for s in STATIONS)
    maintenance_slots = sum(s['maintenance_slots'] for s in STATIONS)
    
    # Operators breakdown
    operators = {}
    for s in STATIONS:
        op = s.get('operator', 'Public')
        operators[op] = operators.get(op, 0) + 1
        
    # Charger types
    charger_types = {}
    for s in STATIONS:
        ct = s.get('charger_type', 'Standard')
        charger_types[ct] = charger_types.get(ct, 0) + 1

    # Cities breakdown
    cities = {}
    for s in STATIONS:
        c = s.get('city', 'Unknown')
        cities[c] = cities.get(c, 0) + 1

    top_cities = sorted(cities.items(), key=lambda x: x[1], reverse=True)[:10]

    STATS_CACHE = {
        "total_stations": total_stations,
        "available_stations": sum(1 for s in STATIONS if s['available_slots'] > 0),
        "total_slots": total_slots,
        "available_slots": available_slots,
        "occupied_slots": occupied_slots,
        "maintenance_slots": maintenance_slots,
        "utilization_rate": round((occupied_slots / total_slots * 100), 1) if total_slots else 0,
        "cities_count": len(cities),
        "states_count": len(set(s['state'] for s in STATIONS)),
        "top_cities": [{"city": c, "count": cnt} for c, cnt in top_cities],
        "operators": operators,
        "charger_types": charger_types,
        "last_updated": time.strftime("%Y-%m-%d %H:%M:%S")
    }

def simulate_realtime_fluctuation():
    """
    Subtly simulates real-world EV charging slot arrivals and departures
    every 20-30 seconds so the website reflects dynamic real-time slot tracking.
    """
    while True:
        time.sleep(25)
        if not STATIONS:
            continue
        
        # Pick 5-10 random stations to change
        sample_size = min(len(STATIONS), random.randint(5, 12))
        selected_stations = random.sample(STATIONS, sample_size)
        
        for stn in selected_stations:
            slots = stn.get('slots', [])
            if not slots:
                continue
            
            # Pick a slot to toggle between Available and Occupied
            slot = random.choice(slots)
            if slot['status'] == 'Available':
                slot['status'] = 'Occupied'
                slot['color'] = 'orange'
            elif slot['status'] == 'Occupied':
                slot['status'] = 'Available'
                slot['color'] = 'green'
            
            # Recount station slots
            stn['available_slots'] = sum(1 for sl in slots if sl['status'] == 'Available')
            stn['occupied_slots'] = sum(1 for sl in slots if sl['status'] == 'Occupied')
            stn['maintenance_slots'] = sum(1 for sl in slots if sl['status'] == 'Maintenance')
            
            if stn['available_slots'] > 0:
                stn['status'] = "Available"
            elif stn['occupied_slots'] > 0:
                stn['status'] = "Busy / In Use"
            else:
                stn['status'] = "Maintenance"

        update_stats()

class VoltNavHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for local cross-origin development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # REST API Routes
        if path == '/api/stats':
            self.send_json(STATS_CACHE)
            return

        elif path == '/api/stations':
            # Parameters: q, city, state, charger_type, status, min_power, sort_by, user_lat, user_lon, page, limit
            q = query.get('q', [''])[0].strip().lower()
            city = query.get('city', [''])[0].strip().lower()
            state = query.get('state', [''])[0].strip().lower()
            charger_type = query.get('charger_type', [''])[0].strip().lower()
            status_filter = query.get('status', [''])[0].strip().lower()
            operator = query.get('operator', [''])[0].strip().lower()
            min_power = query.get('min_power', [''])[0].strip()
            page = int(query.get('page', ['1'])[0])
            limit = int(query.get('limit', ['18'])[0])

            user_lat = query.get('lat', [''])[0].strip()
            user_lon = query.get('lon', [''])[0].strip()
            has_user_location = False
            u_lat, u_lon = None, None
            if user_lat and user_lon:
                try:
                    u_lat, u_lon = float(user_lat), float(user_lon)
                    has_user_location = True
                except ValueError:
                    pass

            filtered = []
            for s in STATIONS:
                # Text query
                if q:
                    search_corpus = f"{s['name']} {s['city']} {s['state']} {s['address']} {s.get('operator', '')}".lower()
                    if q not in search_corpus:
                        continue

                # City filter
                if city and city != 'all':
                    if s['city'].lower() != city:
                        continue

                # State filter
                if state and state != 'all':
                    if s['state'].lower() != state:
                        continue

                # Charger Type filter
                if charger_type and charger_type != 'all':
                    if charger_type not in s['charger_type'].lower():
                        continue

                # Status filter
                if status_filter and status_filter != 'all':
                    if status_filter == 'available' and s['available_slots'] == 0:
                        continue
                    elif status_filter == 'occupied' and s['available_slots'] > 0:
                        continue

                # Operator filter
                if operator and operator != 'all':
                    if operator not in s.get('operator', '').lower():
                        continue

                # Min power filter
                if min_power:
                    try:
                        if s['power_kw'] < float(min_power):
                            continue
                    except ValueError:
                        pass

                # If user location provided, calculate distance
                record = dict(s)
                if has_user_location:
                    record['distance_km'] = haversine_distance(u_lat, u_lon, s['latitude'], s['longitude'])
                else:
                    record['distance_km'] = None

                filtered.append(record)

            # Sorting
            sort_by = query.get('sort_by', ['default'])[0].strip()
            if sort_by == 'distance' and has_user_location:
                filtered.sort(key=lambda x: x['distance_km'] if x['distance_km'] is not None else 999999)
            elif sort_by == 'power':
                filtered.sort(key=lambda x: x['power_kw'], reverse=True)
            elif sort_by == 'available_slots':
                filtered.sort(key=lambda x: x['available_slots'], reverse=True)
            elif sort_by == 'name':
                filtered.sort(key=lambda x: x['name'])

            total_matches = len(filtered)
            start = (page - 1) * limit
            end = start + limit
            paginated = filtered[start:end]

            response = {
                "total": total_matches,
                "page": page,
                "limit": limit,
                "total_pages": math.ceil(total_matches / limit) if limit else 1,
                "stations": paginated
            }
            self.send_json(response)
            return

        elif path == '/api/stations/map':
            # Lightweight endpoint specifically for rendering pins on Leaflet Map
            city = query.get('city', [''])[0].strip().lower()
            charger_type = query.get('charger_type', [''])[0].strip().lower()
            
            pins = []
            for s in STATIONS:
                if city and city != 'all' and s['city'].lower() != city:
                    continue
                if charger_type and charger_type != 'all' and charger_type not in s['charger_type'].lower():
                    continue

                pins.append({
                    "id": s['id'],
                    "name": s['name'],
                    "city": s['city'],
                    "state": s['state'],
                    "latitude": s['latitude'],
                    "longitude": s['longitude'],
                    "charger_type": s['charger_type'],
                    "power_kw": s['power_kw'],
                    "status": s['status'],
                    "available_slots": s['available_slots'],
                    "total_slots": s['total_slots'],
                    "pricing": s.get('pricing', 'Standard')
                })
            self.send_json({"count": len(pins), "stations": pins})
            return

        elif path.startswith('/api/stations/'):
            stn_id = path.replace('/api/stations/', '').strip()
            station = STATIONS_BY_ID.get(stn_id)
            if station:
                self.send_json(station)
            else:
                self.send_json({"error": "Station not found"}, status=404)
            return

        elif path == '/api/cities':
            cities_dict = {}
            for s in STATIONS:
                c = s['city']
                cities_dict[c] = cities_dict.get(c, 0) + 1
            sorted_cities = sorted(cities_dict.items(), key=lambda x: x[0])
            self.send_json([{"name": c, "count": cnt} for c, cnt in sorted_cities])
            return

        elif path == '/api/states':
            states = sorted(list(set(s['state'] for s in STATIONS)))
            self.send_json(states)
            return

        # Static Frontend File Serving
        clean_path = path.lstrip('/')
        if not clean_path or clean_path == 'index.html':
            clean_path = 'index.html'

        file_path = os.path.join(FRONTEND_DIR, clean_path)

        # Security check: prevent directory traversal
        if not os.path.abspath(file_path).startswith(os.path.abspath(FRONTEND_DIR)):
            self.send_error(403, "Forbidden")
            return

        if os.path.isfile(file_path):
            ctype, _ = mimetypes.guess_type(file_path)
            if not ctype:
                ctype = 'application/octet-stream'
            
            with open(file_path, 'rb') as f:
                content = f.read()

            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            # Fallback to index.html for SPA-like navigation
            index_path = os.path.join(FRONTEND_DIR, 'index.html')
            if os.path.isfile(index_path):
                with open(index_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, "File Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Interactive slot booking / reservation endpoint
        if path.startswith('/api/slots/reserve'):
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)
            try:
                data = json.loads(post_body.decode('utf-8'))
            except Exception:
                self.send_json({"error": "Invalid JSON"}, status=400)
                return

            stn_id = data.get('station_id')
            slot_id = data.get('slot_id')

            station = STATIONS_BY_ID.get(stn_id)
            if not station:
                self.send_json({"error": "Station not found"}, status=404)
                return

            # Find slot
            target_slot = None
            for sl in station.get('slots', []):
                if sl['slot_id'] == slot_id or (not slot_id and sl['status'] == 'Available'):
                    target_slot = sl
                    break

            if not target_slot:
                self.send_json({"error": "No available slot matching request"}, status=400)
                return

            if target_slot['status'] != 'Available':
                self.send_json({"error": f"Slot {target_slot['slot_id']} is already {target_slot['status']}"}, status=400)
                return

            # Book slot
            target_slot['status'] = 'Occupied'
            target_slot['color'] = 'orange'
            target_slot['reserved_user'] = data.get('user_name', 'VoltNav Driver')
            target_slot['booking_time'] = time.strftime("%H:%M:%S")

            station['available_slots'] = sum(1 for sl in station['slots'] if sl['status'] == 'Available')
            station['occupied_slots'] = sum(1 for sl in station['slots'] if sl['status'] == 'Occupied')
            if station['available_slots'] == 0:
                station['status'] = "Busy / In Use"

            update_stats()

            self.send_json({
                "success": True,
                "message": f"Successfully reserved slot {target_slot['slot_number']} at {station['name']}",
                "slot": target_slot,
                "station": {
                    "id": station['id'],
                    "name": station['name'],
                    "available_slots": station['available_slots'],
                    "occupied_slots": station['occupied_slots']
                }
            })
            return

        self.send_json({"error": "Endpoint not recognized"}, status=404)

def run_server():
    load_dataset()

    # Start live slot simulation background thread
    sim_thread = threading.Thread(target=simulate_realtime_fluctuation, daemon=True)
    sim_thread.start()

    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, VoltNavHandler)
    print("=" * 65)
    print(f"🚀 VoltNav Web Application running at http://localhost:{PORT}")
    print(f"⚡ Live EV Charging Station Tracker is active!")
    print(f"📍 Kaggle Dataset: 1,194 Verified Charging Stations loaded")
    print(f"🌐 REST API: http://localhost:{PORT}/api/stations")
    print("=" * 65)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down VoltNav server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
