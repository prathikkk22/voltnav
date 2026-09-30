"""
EV Charging Stations Dataset Cleaning & Preprocessing Script
Uses Python standard libraries (csv, json, math, re) for zero-dependency execution,
plus exports Google Colab compatible code.
"""

import csv
import json
import math
import os
import re
import sys

# Ensure UTF-8 output on Windows console
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def clean_ev_dataset(
    input_csv="ev-charging-stations-india.csv",
    output_csv="data/cleaned_ev_stations.csv",
    output_json="data/cleaned_ev_stations.json"
):
    print("=" * 65)
    print("⚡ VoltNav: EV Charging Stations Preprocessing Engine")
    print("=" * 65)
    
    if not os.path.exists(input_csv):
        print(f"❌ Input file not found: {input_csv}")
        return

    os.makedirs(os.path.dirname(output_csv), exist_ok=True)

    raw_records = []
    with open(input_csv, mode='r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_records.append(row)

    print(f" Loaded raw dataset: {len(raw_records)} records found.")

    # State cleaning map
    state_mapping = {
        'taminadu': 'Tamil Nadu',
        'tamilnadu': 'Tamil Nadu',
        'tamil nadu': 'Tamil Nadu',
        'uttrakhand': 'Uttarakhand',
        'uttarakhand': 'Uttarakhand',
        'harayana': 'Haryana',
        'haryana': 'Haryana',
        'hyderabad': 'Telangana',
        'hyderabad\u00a0': 'Telangana',
        'jammu': 'Jammu and Kashmir',
        'jammu and kashmir': 'Jammu and Kashmir',
        'jammu & kashmir': 'Jammu and Kashmir',
        'andhrapradesh': 'Andhra Pradesh',
        'andhra pradesh': 'Andhra Pradesh',
        'westbengal': 'West Bengal',
        'west bengal': 'West Bengal',
        'chhattisgarh': 'Chhattisgarh',
        'chattisgarh': 'Chhattisgarh',
        'pondicherry': 'Puducherry',
        'puducherry': 'Puducherry',
        'delhi': 'Delhi',
        'new delhi': 'Delhi'
    }

    # City cleaning map
    city_mapping = {
        'bengaluru': 'Bengaluru',
        'bangalore': 'Bengaluru',
        'gurgaon': 'Gurugram',
        'gurugram': 'Gurugram',
        'hyderbad': 'Hyderabad',
        'hyderabad': 'Hyderabad',
        'new delhi': 'New Delhi',
        'delhi': 'New Delhi',
        'pune': 'Pune',
        'mumbai': 'Mumbai',
        'chennai': 'Chennai',
        'ahmedabad': 'Ahmedabad',
        'kolkata': 'Kolkata',
        'noida': 'Noida',
        'greater noida': 'Greater Noida',
        'kochi': 'Kochi',
        'coimbatore': 'Coimbatore',
        'jaipur': 'Jaipur',
        'indore': 'Indore',
        'lucknow': 'Lucknow',
        'calicut': 'Kozhikode',
        'kozhikode': 'Kozhikode',
        'nagpur': 'Nagpur',
        'vadodara': 'Vadodara',
        'surat': 'Surat',
        'nashik': 'Nashik',
        'dehradun': 'Dehradun',
        'haridwar': 'Haridwar',
        'shimla': 'Shimla',
        'mysore': 'Mysuru',
        'mysuru': 'Mysuru',
        'hubli': 'Hubballi',
        'hubballi': 'Hubballi',
        'bhopal': 'Bhopal',
        'raipur': 'Raipur',
        'guwahati': 'Guwahati',
        'amritsar': 'Amritsar',
        'chandigarh': 'Chandigarh'
    }

    def clean_text(s):
        if not s:
            return ""
        s = s.replace('\u00a0', ' ').strip().strip('"').strip("'")
        return s

    def extract_operator(name):
        n = name.lower()
        if 'tata power' in n:
            return 'Tata Power EZ Charge'
        elif 'statiq' in n:
            return 'Statiq'
        elif 'iocl' in n or 'indian oil' in n:
            return 'IOCL Green'
        elif 'hp' in n or 'hpcl' in n:
            return 'HPCL Energy'
        elif 'ather' in n:
            return 'Ather Grid'
        elif 'veev' in n:
            return 'VEEV Network'
        elif 'mescom' in n:
            return 'MESCOM EV'
        elif 'mindra' in n:
            return 'Mindra EV'
        elif 'bpcl' in n:
            return 'BPCL Pulse'
        elif 'electriva' in n:
            return 'ElectriVA'
        elif 'chargepit' in n:
            return 'ChargePit'
        else:
            return 'Public EV Network'

    cleaned_records = []
    seen_keys = set()

    for idx, r in enumerate(raw_records):
        name = clean_text(r.get('name', 'EV Charging Station'))
        if not name:
            name = f"EV Charging Station #{idx+1}"

        # Latitude & Longitude (handle typo 'lattitude')
        raw_lat = r.get('latitude') or r.get('lattitude') or ''
        raw_lon = r.get('longitude') or ''

        try:
            lat = float(clean_text(raw_lat))
            lon = float(clean_text(raw_lon))
        except (ValueError, TypeError):
            continue

        # Coordinate Validation & Inversion fix for India
        # India latitude is between 6.0 and 38.0, longitude is between 68.0 and 98.0
        if lat > 60.0 and lon < 40.0:  # Inverted lat/long detected
            lat, lon = lon, lat

        if not (6.0 <= lat <= 38.0 and 68.0 <= lon <= 98.0):
            # Out of bounds
            continue

        # Deduplication key
        coord_key = f"{round(lat, 4)}_{round(lon, 4)}"
        if coord_key in seen_keys:
            continue
        seen_keys.add(coord_key)

        # State & City
        raw_state = clean_text(r.get('state', ''))
        raw_city = clean_text(r.get('city', ''))

        clean_state = state_mapping.get(raw_state.lower(), raw_state.title() if raw_state else "Unknown")
        clean_city = city_mapping.get(raw_city.lower(), raw_city.title() if raw_city else "Unknown")

        # Address
        raw_addr = clean_text(r.get('address', ''))
        if not raw_addr:
            address = f"{name}, {clean_city}, {clean_state}, India"
        else:
            address = raw_addr

        # Raw type integer code
        raw_type = clean_text(r.get('type', '12'))
        try:
            type_code = int(float(raw_type))
        except ValueError:
            type_code = 12

        # Operator
        operator = extract_operator(name)

        # Charger Classification
        name_upper = name.upper()
        is_dc = 'DC' in name_upper or 'FAST' in name_upper or type_code == 12
        is_ac = 'AC' in name_upper or type_code == 6

        if type_code == 7 or (is_dc and is_ac):
            charger_type = 'Dual AC/DC Fast'
            power_kw = 30
            total_slots = 4
            connectors = ['CCS-2 (30 kW DC)', 'Type 2 AC (22 kW)', 'Bharat DC-001 (15 kW)']
            voltage = '415V AC / 400V DC'
            speed_tier = 'Fast'
        elif type_code == 6 or (is_ac and not is_dc):
            charger_type = 'AC Standard / Type 2'
            power_kw = 7.4 if 'ather' in operator.lower() else 22
            total_slots = 2
            connectors = ['Type 2 AC (7.4 kW)', 'IEC 60309 AC (3.3 kW)']
            voltage = '230V Single-Phase / 415V 3-Phase'
            speed_tier = 'Standard'
        else: # type 12 or DC
            charger_type = 'DC Fast Charger'
            power_kw = 60 if 'FAST' in name_upper or type_code == 12 else 50
            total_slots = 4
            connectors = ['CCS-2 (60 kW DC)', 'CHAdeMO (50 kW DC)', 'Bharat DC-001 (15 kW)']
            voltage = '400V - 800V DC'
            speed_tier = 'Superfast'

        # Operating Hours
        name_lower = name.lower()
        if any(w in name_lower for w in ['mall', 'cafe', 'restaurant', 'complex', 'market']):
            operating_hours = "09:00 AM - 11:00 PM"
        else:
            operating_hours = "24/7 Always Open"

        # Pricing
        if charger_type == 'DC Fast Charger':
            pricing = "₹18 - ₹22 / kWh"
        elif charger_type == 'Dual AC/DC Fast':
            pricing = "₹15 - ₹19 / kWh"
        else:
            pricing = "₹11 - ₹14 / kWh"

        # Station ID
        station_id = f"STN-IND-{len(cleaned_records)+1:04d}"

        # Deterministic Initial Slot Topology
        seq_num = len(cleaned_records) + 1
        pattern = seq_num % 5
        if pattern == 0:
            avail_count = total_slots
            occ_count = 0
            maint_count = 0
        elif pattern == 1:
            avail_count = max(1, total_slots - 1)
            occ_count = 1
            maint_count = 0
        elif pattern == 2:
            avail_count = 1
            occ_count = max(1, total_slots - 1)
            maint_count = 0
        elif pattern == 3:
            maint_count = 1
            avail_count = max(1, total_slots - 2)
            occ_count = total_slots - avail_count - maint_count
        else:
            occ_count = total_slots // 2
            avail_count = total_slots - occ_count
            maint_count = 0

        slots = []
        for s_i in range(1, total_slots + 1):
            if s_i <= avail_count:
                s_status = "Available"
                s_color = "green"
            elif s_i <= avail_count + occ_count:
                s_status = "Occupied"
                s_color = "orange"
            else:
                s_status = "Maintenance"
                s_color = "red"

            conn_label = connectors[(s_i - 1) % len(connectors)]
            slots.append({
                "slot_id": f"{station_id}-SLOT-{s_i}",
                "slot_number": s_i,
                "status": s_status,
                "color": s_color,
                "connector": conn_label,
                "power_kw": power_kw
            })

        if avail_count > 0:
            overall_status = "Available"
        elif occ_count > 0:
            overall_status = "Busy / In Use"
        else:
            overall_status = "Maintenance"

        # Amenities
        amenities = ["Parking", "EV Signs"]
        addr_all = (name + " " + address).lower()
        if any(w in addr_all for w in ['hotel', 'resort', 'cafe', 'restaurant', 'food', 'dhaba', 'bakery', 'tea']):
            amenities.extend(["Dining / Cafe", "Restroom"])
        if any(w in addr_all for w in ['mall', 'complex', 'tower', 'square']):
            amenities.extend(["Shopping Mall", "Wi-Fi", "Restroom", "ATM"])
        if any(w in addr_all for w in ['petrol', 'pump', 'iocl', 'hp', 'bpcl', 'fuel']):
            amenities.extend(["Air Pump", "Convenience Store", "Restroom"])
        if "24/7" in operating_hours:
            amenities.append("24/7 Security")

        amenities = sorted(list(set(amenities)))

        record = {
            "id": station_id,
            "name": name,
            "operator": operator,
            "state": clean_state,
            "city": clean_city,
            "address": address,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "raw_type": type_code,
            "charger_type": charger_type,
            "speed_tier": speed_tier,
            "power_kw": power_kw,
            "voltage": voltage,
            "operating_hours": operating_hours,
            "pricing": pricing,
            "amenities": amenities,
            "connectors": connectors,
            "total_slots": total_slots,
            "available_slots": avail_count,
            "occupied_slots": occ_count,
            "maintenance_slots": maint_count,
            "status": overall_status,
            "slots": slots
        }
        cleaned_records.append(record)

    # Export to JSON
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(cleaned_records, f, indent=2, ensure_ascii=False)

    # Export to CSV
    csv_fieldnames = [
        "id", "name", "operator", "state", "city", "address", "latitude", "longitude",
        "charger_type", "speed_tier", "power_kw", "voltage", "operating_hours",
        "pricing", "total_slots", "available_slots", "occupied_slots", "maintenance_slots",
        "status", "connectors", "amenities"
    ]
    with open(output_csv, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_fieldnames)
        writer.writeheader()
        for r in cleaned_records:
            row_copy = {k: r[k] for k in csv_fieldnames if k in r}
            row_copy['connectors'] = "; ".join(r['connectors'])
            row_copy['amenities'] = "; ".join(r['amenities'])
            writer.writerow(row_copy)

    # Compute Summary Stats
    total_stations = len(cleaned_records)
    total_slots = sum(r['total_slots'] for r in cleaned_records)
    available_slots = sum(r['available_slots'] for r in cleaned_records)
    occupied_slots = sum(r['occupied_slots'] for r in cleaned_records)
    unique_cities = len(set(r['city'] for r in cleaned_records))
    unique_states = len(set(r['state'] for r in cleaned_records))

    print("\n✅ Dataset Cleaning Successful!")
    print(f"  • Processed & Validated Stations: {total_stations}")
    print(f"  • Unique Cities: {unique_cities}")
    print(f"  • Unique States & UTs: {unique_states}")
    print(f"  • Total Charging Points / Slots: {total_slots}")
    print(f"  • Available Slots: {available_slots}")
    print(f"  • Occupied Slots: {occupied_slots}")
    print(f"  • Saved CSV: {output_csv}")
    print(f"  • Saved JSON: {output_json}")
    print("=" * 65)

    return cleaned_records

if __name__ == '__main__':
    clean_ev_dataset()
