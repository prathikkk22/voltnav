# ⚡ VoltNav: EV Charging Station Tracker with Slot Availability

VoltNav is a modern, responsive, and 3D-animated web application for discovering electric vehicle charging infrastructure, viewing detailed charging-slot availability, filtering by power capacity and connector types, and navigating to **1,194 verified charging stations across India** using actual Kaggle dataset telemetry.

---

## 🚀 Live Local Application
The application is running locally at:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 📊 Dataset Inspection & Column Mapping

The application uses the Kaggle Indian EV Charging Stations dataset (`ev-charging-stations-india.csv`) as its ground truth. Below is the mapping of dataset fields to application features:

| Dataset Column | Raw Type | Cleaning & Feature Transformation | Application Feature & Usage |
| :--- | :--- | :--- | :--- |
| `name` | String | Trimmed quotes, extracted operator brands (Tata Power, Statiq, Ather Grid, IOCL Green, HPCL, etc.). | Station Title, Network Operator badge, brand filtering. |
| `state` | String | Standardized spelling variations (e.g., `TamiNadu` &rarr; `Tamil Nadu`, `Harayana` &rarr; `Haryana`, `Uttrakhand` &rarr; `Uttarakhand`). | State dropdown filter, regional grouping. |
| `city` | String | Normalized casing (e.g., `bengaluru` &rarr; `Bengaluru`, `gurgaon` &rarr; `Gurugram`). | City filter dropdown, quick search chips, city statistics. |
| `address` | String | Cleaned quotes, provided formatted fallback `"{city}, {state}, India"` for empty records. | Street address on 3D cards, Modal details, GPS directions link. |
| `lattitude` | Float | Corrected Kaggle header typo (`lattitude` &rarr; `latitude`), fixed inverted lat/lon coordinates. | Leaflet.js interactive map pins, Haversine "Near Me" GPS distance sorting. |
| `longitude` | Float | Validated within India's geographic bounds (68°E to 98°E). | Interactive map placement, navigation routing. |
| `type` | Integer (6, 7, 12) | Mapped network codes to charger classes: `12` &rarr; DC Fast Charger (50-60 kW), `7` &rarr; Dual AC/DC Fast (30 kW), `6` &rarr; AC Type 2 Standard (7.4-22 kW). | Charging capacity (kW), voltage levels, connector types (CCS-2, CHAdeMO, Type 2 AC). |
| `slots` *(Enriched)* | Object Array | Allocated 2 to 4 charging ports per station based on hardware class + dynamic simulation states. | 🟢 Available, 🟠 Occupied, 🔴 Maintenance visual slot matrix, live booking simulation. |

> **Ground Truth vs. Real-Time Tracking Notice:**  
> The station locations, operators, coordinates, and charging hardware capacity are derived directly from the verified Kaggle dataset. Because static datasets do not contain live second-by-second vehicle plug-in events, VoltNav pairs the verified dataset with an active dynamic slot simulation engine that realistically updates slot occupancy and responds to user reservations.

---

## 📁 Project Folder Structure

```
voltnav/
├── ev-charging-stations-india.csv     # Raw Kaggle EV Dataset (1,547 records)
├── clean_data.py                      # Standalone zero-dependency Python cleaning pipeline
├── colab_preprocessing.py             # Google Colab pipeline script (Pandas & NumPy)
├── server.py                          # High-performance zero-dependency REST API & Web Server
├── run.py                             # One-click startup runner
├── README.md                          # Documentation & deployment guide
├── data/
│   ├── cleaned_ev_stations.csv        # Cleaned tabular CSV (1,194 verified stations)
│   └── cleaned_ev_stations.json       # Cleaned JSON with full slot topologies
├── backend/
│   ├── app.py                         # FastAPI production alternative
│   └── requirements.txt               # Optional dependencies for FastAPI
└── frontend/
    ├── index.html                     # Responsive single-page application
    ├── css/
    │   └── style.css                  # 3D glassmorphic styling, animations & responsive theme
    └── js/
        ├── 3d-effects.js              # 3D card tilt physics, particle canvas & counters
        ├── map.js                     # Leaflet.js map engine & custom glowing SVG markers
        └── app.js                     # State management, search, filters & slot booking
```

---

## 🔬 Google Colab Workflow: Kaggle Dataset to Website

If you are using Google Colab for data cleaning and feature engineering:

1. **Upload Dataset to Colab**:
   Mount Google Drive or upload `ev-charging-stations-india.csv` to Colab's file storage.
2. **Run `colab_preprocessing.py`**:
   Copy and run the code from [`colab_preprocessing.py`](file:///c:/Users/Tony/OneDrive/Desktop/voltnav/colab_preprocessing.py) in a Colab cell.
   It will:
   - Clean coordinates and remove inverted lat/long values.
   - Standardize all 290 city names and 38 state names.
   - Enrich charger types, voltage, speed tiers, and slot allocations.
   - Export `cleaned_ev_stations.csv` and `cleaned_ev_stations.json`.
3. **Download to VoltNav**:
   Download the generated `cleaned_ev_stations.json` and place it in the `voltnav/data/` folder. The web application will immediately detect and serve the updated data.

---

## 💻 Running the Project Locally

### Option A: Instant Zero-Dependency Launch (Recommended)
VoltNav includes a built-in Python standard library server that starts in under **50ms** with zero external dependencies:

```bash
# Clean the dataset (if not already cleaned)
py clean_data.py

# Launch the VoltNav web application
py server.py
```
Open **`http://localhost:5000`** in your browser.

### Option B: FastAPI Backend (Optional)
```bash
pip install -r backend/requirements.txt
uvicorn backend.app:app --reload --port 5000
```

---

## 🌐 REST API Endpoints

| Method | Endpoint | Description | Query Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/stats` | Dashboard summary metrics, slot counts, top cities. | None |
| `GET` | `/api/stations` | Paginated station search with multi-parameter filtering. | `q`, `city`, `state`, `charger_type`, `status`, `sort_by`, `lat`, `lon`, `page`, `limit` |
| `GET` | `/api/stations/map` | Lightweight station coordinate pins for Leaflet map. | `city`, `charger_type` |
| `GET` | `/api/stations/{id}` | Full station details, connectors, amenities, and slot states. | Station ID (e.g. `STN-IND-0001`) |
| `GET` | `/api/cities` | List of unique cities with station counts. | None |
| `GET` | `/api/states` | List of unique states / union territories. | None |
| `POST` | `/api/slots/reserve` | Reserve an available slot (interactive live simulation). | JSON: `{"station_id": "STN-IND-0001", "slot_id": "..."}` |

---

## 🎨 3D Design & Visual Animation Highlights

- **3D Card Tilt Physics**: Station cards calculate cursor angle and rotate along the 3D X/Y axes (`perspective(1000px)`), casting dynamic glow shadows on hover.
- **3D Modal Windows**: Detailed modal zooms in with smooth scale and perspective entrance transitions.
- **Ambient Electric Particle Canvas**: Canvas-driven neural grid of glowing cyan/emerald nodes with proximity connections.
- **Animated Slot Indicators**:
  - 🟢 **Available**: Pulsing radar glow indicating ready for plug-in.
  - 🟠 **Occupied**: Amber load indicator.
  - 🔴 **Maintenance**: Offline diagnostic state.
- **Radial Progress Gauges**: Circular SVG gauges reflecting station charging capacity (kW) and slot availability percentages.
- **Interactive Leaflet Map**: Dark CartoDB basemap with custom glowing SVG markers and click-to-preview fly transitions.
- **Accessibility**: Includes full `@media (prefers-reduced-motion: reduce)` support to automatically disable heavy transforms for users with motion sensitivity.

---

## ☁️ Production Deployment

### 1. Render / Railway / Heroku
- Set Build Command: `pip install -r backend/requirements.txt`
- Set Start Command: `python server.py` (or `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`)

### 2. Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN python clean_data.py
EXPOSE 5000
CMD ["python", "server.py"]
```
Build and run:
```bash
docker build -t voltnav .
docker run -p 5000:5000 voltnav
```
