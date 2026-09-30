"""
=================================================================================
⚡ VoltNav - Google Colab Preprocessing Script (Pandas & NumPy)
Pipeline: Kaggle Dataset -> Google Colab -> Cleaning & Feature Enrichment -> Clean CSV / JSON
=================================================================================

Run this cell in your Google Colab notebook to download/read the Kaggle dataset,
clean the records, enrich charging attributes and slot capacities, and export 
both CSV and JSON files for the VoltNav web application.
"""

# Step 1: Install & Import Libraries
import pandas as pd
import numpy as np
import json
import re

print("Starting VoltNav EV Dataset Cleaning Pipeline in Google Colab...")

# Step 2: Load the raw Kaggle dataset
# (Upload ev-charging-stations-india.csv to Colab files or mount Google Drive)
INPUT_CSV = "ev-charging-stations-india.csv"
OUTPUT_CSV = "cleaned_ev_stations.csv"
OUTPUT_JSON = "cleaned_ev_stations.json"

df = pd.read_csv(INPUT_CSV)
print(f" Loaded raw dataset: {len(df)} rows, columns: {list(df.columns)}")

# Step 3: Column Standardization
df.columns = [col.strip().lower() for col in df.columns]
if 'lattitude' in df.columns:
    df.rename(columns={'lattitude': 'latitude'}, inplace=True)

# Step 4: Geographic Coordinate Validation & Swapped Coordinate Correction
df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')
df.dropna(subset=['latitude', 'longitude'], inplace=True)

def correct_coords(row):
    lat = row['latitude']
    lon = row['longitude']
    # If latitude is > 50 and longitude is < 40, coordinates are swapped
    if lat > 50.0 and lon < 40.0:
        return pd.Series([lon, lat])
    return pd.Series([lat, lon])

df[['latitude', 'longitude']] = df.apply(correct_coords, axis=1)

# Keep only valid coordinates inside India (lat 6-38, lon 68-98)
india_bounds = (
    (df['latitude'] >= 6.0) & (df['latitude'] <= 38.0) &
    (df['longitude'] >= 68.0) & (df['longitude'] <= 98.0)
)
df = df[india_bounds].copy()
df.drop_duplicates(subset=['latitude', 'longitude'], inplace=True)
print(f" Valid India coordinates after deduplication: {len(df)} stations.")

# Step 5: Clean State and City Names
state_fix = {
    'taminadu': 'Tamil Nadu',
    'tamilnadu': 'Tamil Nadu',
    'uttrakhand': 'Uttarakhand',
    'harayana': 'Haryana',
    'hyderabad': 'Telangana',
    'hyderabad\u00a0': 'Telangana',
    'jammu': 'Jammu and Kashmir',
    'andhrapradesh': 'Andhra Pradesh',
    'westbengal': 'West Bengal'
}

city_fix = {
    'bengaluru': 'Bengaluru',
    'bangalore': 'Bengaluru',
    'gurgaon': 'Gurugram',
    'gurugram': 'Gurugram',
    'hyderbad': 'Hyderabad',
    'delhi': 'New Delhi',
    'new delhi': 'New Delhi',
    'pune': 'Pune',
    'mumbai': 'Mumbai',
    'chennai': 'Chennai',
    'ahmedabad': 'Ahmedabad',
    'kolkata': 'Kolkata',
    'noida': 'Noida'
}

def clean_str(val):
    if pd.isna(val):
        return ""
    return str(val).replace('\u00a0', ' ').strip().strip('"').strip("'")

df['state'] = df['state'].apply(clean_str)
df['state'] = df['state'].apply(lambda s: state_fix.get(s.lower(), s.title() if s else "Unknown"))

df['city'] = df['city'].apply(clean_str)
df['city'] = df['city'].apply(lambda c: city_fix.get(c.lower(), c.title() if c else "Unknown"))

df['address'] = df.apply(
    lambda r: clean_str(r.get('address', '')) or f"{r['city']}, {r['state']}, India", 
    axis=1
)

# Step 6: Identify Operator & Brand
def get_brand(name):
    n = str(name).lower()
    if 'tata power' in n: return 'Tata Power EZ Charge'
    elif 'statiq' in n: return 'Statiq'
    elif 'iocl' in n or 'indian oil' in n: return 'IOCL Green'
    elif 'hp' in n or 'hpcl' in n: return 'HPCL Energy'
    elif 'ather' in n: return 'Ather Grid'
    elif 'veev' in n: return 'VEEV Network'
    elif 'mescom' in n: return 'MESCOM EV'
    elif 'bpcl' in n: return 'BPCL Pulse'
    else: return 'Public EV Network'

df['operator'] = df['name'].apply(get_brand)

# Step 7: Classify Charger Types, Capacity (kW), Voltage & Ports
def classify_charger(row):
    name_up = str(row['name']).upper()
    raw_type = row.get('type', 12)
    is_dc = 'DC' in name_up or 'FAST' in name_up or raw_type == 12
    is_ac = 'AC' in name_up or raw_type == 6

    if raw_type == 7 or (is_dc and is_ac):
        ctype = 'Dual AC/DC Fast'
        power = 30
        slots = 4
        conns = ['CCS-2 (30 kW DC)', 'Type 2 AC (22 kW)', 'Bharat DC-001 (15 kW)']
        speed = 'Fast'
    elif raw_type == 6 or (is_ac and not is_dc):
        ctype = 'AC Standard / Type 2'
        power = 7.4 if 'ather' in row['operator'].lower() else 22
        slots = 2
        conns = ['Type 2 AC (7.4 kW)', 'IEC 60309 AC (3.3 kW)']
        speed = 'Standard'
    else:
        ctype = 'DC Fast Charger'
        power = 60 if 'FAST' in name_up else 50
        slots = 4
        conns = ['CCS-2 (60 kW DC)', 'CHAdeMO (50 kW DC)', 'Bharat DC-001 (15 kW)']
        speed = 'Superfast'

    return pd.Series([ctype, power, slots, conns, speed])

df[['charger_type', 'power_kw', 'total_slots', 'connectors', 'speed_tier']] = df.apply(classify_charger, axis=1)

# Step 8: Station IDs & Operating Hours
df.reset_index(drop=True, inplace=True)
df['id'] = [f"STN-IND-{i+1:04d}" for i in range(len(df))]
df['operating_hours'] = df['name'].apply(
    lambda n: "09:00 AM - 11:00 PM" if any(w in str(n).lower() for w in ['mall', 'cafe', 'complex']) else "24/7 Always Open"
)
df['pricing'] = df['charger_type'].apply(
    lambda t: "₹18 - ₹22 / kWh" if "DC Fast" in t else ("₹15 - ₹19 / kWh" if "Dual" in t else "₹11 - ₹14 / kWh")
)

# Step 9: Slot Topology Generation (Available, Occupied, Maintenance)
def allocate_slots(row):
    total = row['total_slots']
    seq = int(row['id'].split('-')[-1])
    pat = seq % 5
    if pat == 0: avail, occ, maint = total, 0, 0
    elif pat == 1: avail, occ, maint = max(1, total - 1), 1, 0
    elif pat == 2: avail, occ, maint = 1, max(1, total - 1), 0
    elif pat == 3: avail, occ, maint = max(1, total - 2), max(0, total - 2 - 1), 1
    else: occ = total // 2; avail = total - occ; maint = 0

    slots_list = []
    for s in range(1, total + 1):
        if s <= avail: status, color = "Available", "green"
        elif s <= avail + occ: status, color = "Occupied", "orange"
        else: status, color = "Maintenance", "red"
        
        slots_list.append({
            "slot_id": f"{row['id']}-SLOT-{s}",
            "slot_number": s,
            "status": status,
            "color": color,
            "connector": row['connectors'][(s-1) % len(row['connectors'])],
            "power_kw": row['power_kw']
        })

    return pd.Series([avail, occ, maint, "Available" if avail > 0 else "Busy / In Use", slots_list])

df[['available_slots', 'occupied_slots', 'maintenance_slots', 'status', 'slots']] = df.apply(allocate_slots, axis=1)

# Step 10: Export outputs
# Export JSON
records = df.to_dict(orient='records')
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(records, f, indent=2, ensure_ascii=False)

# Export CSV
csv_df = df.copy()
csv_df['connectors'] = csv_df['connectors'].apply(lambda c: "; ".join(c) if isinstance(c, list) else str(c))
csv_df.drop(columns=['slots']).to_csv(OUTPUT_CSV, index=False)

print("\n Preprocessing Complete!")
print(f" Total Stations Processed: {len(df)}")
print(f" Total Charging Ports: {df['total_slots'].sum()}")
print(f" Available Slots: {df['available_slots'].sum()}")
print(f" Output CSV exported: {OUTPUT_CSV}")
print(f" Output JSON exported: {OUTPUT_JSON}")
print(" Copy these files into your VoltNav project's data/ folder to connect to the web application.")
