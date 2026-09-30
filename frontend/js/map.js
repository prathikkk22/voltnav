/**
 * ⚡ VoltNav - Google Maps Interactive Geospatial Engine
 * Powered by Google Maps Tiles with real-time station overlay and Google UI controls
 */

let mapInstance = null;
let markersLayer = null;
let userMarker = null;
let currentMapStations = [];
let currentTileLayer = null;

// Available Map Layers (Google Maps standard raster tiles + OSM)
const MapLayers = {
  googleRoads: {
    name: 'Google Streets',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps'
  },
  googleHybrid: {
    name: 'Google Satellite',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps'
  },
  googleTerrain: {
    name: 'Google Terrain',
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps'
  },
  darkCanvas: {
    name: 'Electric Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }
};

let activeLayerKey = 'googleRoads';

// Custom Google Maps Style EV Station Marker Pins
function createGoogleMarkerIcon(status, isSelected = false) {
  let pinColor = '#10b981'; // Green for Available
  let borderColor = '#047857';
  let badgeText = '⚡';

  if (status === 'Busy / In Use' || status === 'Occupied') {
    pinColor = '#f59e0b'; // Amber for Occupied
    borderColor = '#d97706';
  } else if (status === 'Maintenance') {
    pinColor = '#ef4444'; // Red for Maintenance
    borderColor = '#b91c1c';
  }

  const width = isSelected ? 36 : 28;
  const height = isSelected ? 48 : 38;

  const svgIcon = `
    <div class="google-pin-wrapper ${isSelected ? 'selected' : ''}" style="width: ${width}px; height: ${height}px; position: relative;">
      <svg viewBox="0 0 32 44" width="${width}" height="${height}" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 11.2 14.2 26.6 15.1 27.6.5.5 1.3.5 1.8 0C17.8 42.6 32 27.2 32 16 32 7.16 24.84 0 16 0z" fill="${pinColor}" stroke="${borderColor}" stroke-width="1.5"/>
        <circle cx="16" cy="15" r="9.5" fill="#ffffff"/>
      </svg>
      <div style="
        position: absolute;
        top: ${isSelected ? '6px' : '4px'};
        left: 0;
        right: 0;
        text-align: center;
        font-size: ${isSelected ? '14px' : '11px'};
        font-weight: 800;
        color: #060911;
        pointer-events: none;
      ">${badgeText}</div>
    </div>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'google-map-marker',
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4]
  });
}

// Initialize Map Engine with Google Maps View
function initMap() {
  const mapElement = document.getElementById('leaflet-map');
  if (!mapElement) return;

  // Center on India geographic center
  const indiaCenter = [21.0, 78.5];
  const defaultZoom = 5;

  mapInstance = L.map('leaflet-map', {
    zoomControl: false,
    attributionControl: false,
    maxBounds: [[5.0, 65.0], [39.0, 100.0]],
    minZoom: 4
  }).setView(indiaCenter, defaultZoom);

  // Set default tile layer (Google Streets)
  setMapLayer('googleRoads');

  // Markers Layer Group
  markersLayer = L.layerGroup().addTo(mapInstance);

  // Add Google Maps UI Layer Switcher control
  addGoogleMapControls();

  // Load Map Pins
  loadMapMarkers();

  // Force map to recalculate container size immediately and after delay
  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize();
  }, 250);
  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize();
  }, 1000);

  // Invalidate on window resize
  window.addEventListener('resize', () => {
    if (mapInstance) mapInstance.invalidateSize();
  });

  // Invalidate when navigation link to map is clicked
  const mapNavLink = document.querySelector('[data-nav="map-view"]');
  if (mapNavLink) {
    mapNavLink.addEventListener('click', () => {
      setTimeout(() => {
        if (mapInstance) {
          mapInstance.invalidateSize();
          mapInstance.setView(indiaCenter, defaultZoom);
        }
      }, 300);
    });
  }
}

// Switch Map Layers (Google Streets / Satellite / Terrain / Dark)
function setMapLayer(layerKey) {
  if (!MapLayers[layerKey] || !mapInstance) return;

  if (currentTileLayer) {
    mapInstance.removeLayer(currentTileLayer);
  }

  const cfg = MapLayers[layerKey];
  currentTileLayer = L.tileLayer(cfg.url, {
    subdomains: cfg.subdomains,
    maxZoom: cfg.maxZoom,
    attribution: cfg.attribution
  }).addTo(mapInstance);

  activeLayerKey = layerKey;

  // Update UI button states if present
  document.querySelectorAll('.gmap-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-layer') === layerKey);
  });
}

// Add Google Maps Styled Floating Controls
function addGoogleMapControls() {
  const mapWrapper = document.querySelector('.map-wrapper');
  if (!mapWrapper) return;

  // Remove existing controls if any
  const existingControls = document.getElementById('google-map-ui-overlay');
  if (existingControls) existingControls.remove();

  const overlay = document.createElement('div');
  overlay.id = 'google-map-ui-overlay';
  overlay.className = 'google-map-ui-overlay';
  overlay.innerHTML = `
    <!-- Top Left: Google Maps Style Map / Satellite Switcher -->
    <div class="gmap-type-switcher">
      <button class="gmap-type-btn active" data-layer="googleRoads" title="Google Maps Streets">
        <i data-lucide="map"></i>
        <span>Map</span>
      </button>
      <button class="gmap-type-btn" data-layer="googleHybrid" title="Google Satellite Imagery with Labels">
        <i data-lucide="globe"></i>
        <span>Satellite</span>
      </button>
      <button class="gmap-type-btn" data-layer="googleTerrain" title="Google Physical Terrain">
        <i data-lucide="mountain"></i>
        <span>Terrain</span>
      </button>
      <button class="gmap-type-btn" data-layer="darkCanvas" title="Electric Dark EV Map">
        <i data-lucide="moon"></i>
        <span>Dark</span>
      </button>
    </div>

    <!-- Top Right: Google Maps Style Search & Action Tools -->
    <div class="gmap-search-bar">
      <i data-lucide="search" class="gmap-search-icon"></i>
      <input type="text" id="gmap-search-input" placeholder="Search city or station on map..." autocomplete="off">
      <button id="gmap-search-clear" style="display:none;"><i data-lucide="x"></i></button>
    </div>

    <!-- Bottom Right: Google Maps Standard Zoom & Location Controls -->
    <div class="gmap-floating-actions">
      <button class="gmap-action-btn" id="gmap-locate-action" title="Your GPS Location">
        <i data-lucide="crosshair"></i>
      </button>
      <button class="gmap-action-btn" id="gmap-recenter-action" title="Recenter India">
        <i data-lucide="compass"></i>
      </button>
      <div class="gmap-zoom-group">
        <button class="gmap-zoom-btn" id="gmap-zoom-in" title="Zoom In">+</button>
        <button class="gmap-zoom-btn" id="gmap-zoom-out" title="Zoom Out">&minus;</button>
      </div>
      <button class="gmap-action-btn" id="gmap-fullscreen-action" title="Toggle Fullscreen">
        <i data-lucide="maximize"></i>
      </button>
    </div>

    <!-- Bottom Center: Station Quick Stats Counter -->
    <div class="gmap-stats-pill">
      <span class="pulse-dot"></span>
      <span id="gmap-station-count">1,194 Stations Mapped</span>
    </div>
  `;

  mapWrapper.appendChild(overlay);

  if (window.lucide) lucide.createIcons();

  // Attach Layer Switcher Listeners
  overlay.querySelectorAll('.gmap-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layer = btn.getAttribute('data-layer');
      setMapLayer(layer);
    });
  });

  // Attach Zoom & Navigation Listeners
  document.getElementById('gmap-zoom-in')?.addEventListener('click', () => mapInstance?.zoomIn());
  document.getElementById('gmap-zoom-out')?.addEventListener('click', () => mapInstance?.zoomOut());
  document.getElementById('gmap-recenter-action')?.addEventListener('click', () => {
    mapInstance?.flyTo([21.0, 78.5], 5, { duration: 1.2 });
  });
  document.getElementById('gmap-locate-action')?.addEventListener('click', handleUserLocation);

  // Fullscreen Toggle
  document.getElementById('gmap-fullscreen-action')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      mapWrapper.requestFullscreen?.().catch(err => console.log(err));
    } else {
      document.exitFullscreen?.().catch(err => console.log(err));
    }
  });

  // Search input directly inside Map
  const searchInput = document.getElementById('gmap-search-input');
  const clearBtn = document.getElementById('gmap-search-clear');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

      if (!q) {
        renderMarkers(currentMapStations);
        return;
      }

      // Filter markers on the fly
      const filtered = currentMapStations.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.city.toLowerCase().includes(q) || 
        s.state.toLowerCase().includes(q)
      );

      renderMarkers(filtered);

      // If matched, pan to first match
      if (filtered.length > 0) {
        mapInstance.flyTo([filtered[0].latitude, filtered[0].longitude], 12, { duration: 1 });
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        renderMarkers(currentMapStations);
      });
    }
  }
}

// Load Markers from Backend Map API or Static Netlify Fallback
async function loadMapMarkers(city = 'all', chargerType = 'all') {
  if (!markersLayer) return;

  try {
    let data;
    if (window.VoltNavData) {
      data = await VoltNavData.getMapStations(city, chargerType);
    } else {
      let url = `/api/stations/map?city=${encodeURIComponent(city)}&charger_type=${encodeURIComponent(chargerType)}`;
      const res = await fetch(url);
      data = await res.json();
    }
    currentMapStations = data.stations || [];

    // Update count pill
    const countEl = document.getElementById('gmap-station-count');
    if (countEl) countEl.textContent = `${currentMapStations.length.toLocaleString()} Stations Mapped`;

    renderMarkers(currentMapStations);
  } catch (err) {
    console.error("Error loading map pins:", err);
  }
}

// Render Google Maps Style Markers
function renderMarkers(stations) {
  if (!markersLayer) return;
  markersLayer.clearLayers();

  stations.forEach(stn => {
    if (!stn.latitude || !stn.longitude) return;

    const icon = createGoogleMarkerIcon(stn.status);
    const marker = L.marker([stn.latitude, stn.longitude], { icon: icon });

    const isAvail = stn.available_slots > 0;
    const availColor = isAvail ? '#10b981' : '#f59e0b';

    // Helper to get image
    let imgSrc = 'images/hero-3d-plaza.jpg';
    if (typeof getStationImage === 'function') {
      imgSrc = getStationImage(stn);
    } else {
      const p = stn.power_kw || 30;
      if (p >= 50) imgSrc = 'images/hero-3d-station.jpg';
      else if (stn.charger_type && stn.charger_type.includes('Dual')) imgSrc = 'images/hero-3d-kiosk.jpg';
    }

    // Google Maps InfoWindow Design
    const popupContent = `
      <div class="gmap-infowindow">
        <div class="infowindow-thumb-wrapper">
          <img src="${imgSrc}" alt="${stn.name}" class="infowindow-thumb-img">
          <span class="infowindow-type-overlay">${stn.charger_type || 'DC Fast'} &bull; ${stn.power_kw} kW</span>
        </div>
        <div class="infowindow-title">${stn.name}</div>
        <div class="infowindow-address">📍 ${stn.city}, ${stn.state}</div>

        <div class="infowindow-slot-bar">
          <div class="slot-badge-pill" style="color: ${availColor};">
            <span class="pill-dot" style="background: ${availColor};"></span>
            <strong>${stn.available_slots} / ${stn.total_slots} Slots Free</strong>
          </div>
          <span class="infowindow-pricing">${stn.pricing || '₹18 / kWh'}</span>
        </div>

        <div class="infowindow-btn-row">
          <button class="gmap-popup-btn primary" onclick="openStationModal('${stn.id}')">
            ⚡ View Details
          </button>
          <a class="gmap-popup-btn outline" href="https://www.google.com/maps/dir/?api=1&destination=${stn.latitude},${stn.longitude}" target="_blank" title="Navigate with Google Maps">
            🗺️ Directions
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      className: 'google-maps-infowindow-wrapper',
      closeButton: true,
      minWidth: 260
    });

    marker.on('click', () => {
      displayStationPreview(stn);
    });

    markersLayer.addLayer(marker);
  });
}

// Display Quick Preview in Side Dock
function displayStationPreview(stn) {
  const panel = document.getElementById('map-station-preview');
  if (!panel) return;

  const isAvail = stn.available_slots > 0;
  let imgSrc = 'images/hero-3d-plaza.jpg';
  if (typeof getStationImage === 'function') {
    imgSrc = getStationImage(stn);
  }

  panel.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div class="preview-media-banner">
        <img src="${imgSrc}" alt="${stn.name}" class="preview-media-img">
        <div class="preview-media-overlay">
          <span class="status-badge ${isAvail ? 'available' : 'occupied'}">
            <span class="dot"></span> ${stn.status}
          </span>
          <span class="text-cyan font-bold" style="font-size: 0.9rem; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 4px;">${stn.power_kw} kW</span>
        </div>
      </div>

      <div>
        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 4px; line-height: 1.3;">${stn.name}</h3>
        <p style="font-size: 0.85rem; color: #94a3b8;">📍 ${stn.city}, ${stn.state}</p>
      </div>

      <div style="background: rgba(0,0,0,0.3); padding: 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);">
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 8px;">
          <span style="color: #94a3b8;">Charger Class:</span>
          <span class="font-bold">${stn.charger_type}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 8px;">
          <span style="color: #94a3b8;">Slot Status:</span>
          <span class="font-bold ${isAvail ? 'text-emerald' : 'text-amber'}">${stn.available_slots} of ${stn.total_slots} Ports Free</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
          <span style="color: #94a3b8;">Tariff:</span>
          <span class="font-bold text-cyan">${stn.pricing || 'Standard Rate'}</span>
        </div>
      </div>

      <button class="btn btn-primary" onclick="openStationModal('${stn.id}')" style="width: 100%;">
        <i data-lucide="zap"></i> View Specs & Book Slot
      </button>

      <a href="https://www.google.com/maps/dir/?api=1&destination=${stn.latitude},${stn.longitude}" target="_blank" class="btn btn-glass" style="width: 100%;">
        <i data-lucide="navigation"></i> Open Turn-by-Turn in Google Maps
      </a>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// Fly to Station & Open Popup
function flyToStation(lat, lon, stnId) {
  if (!mapInstance) return;

  // Scroll to map view
  const mapSection = document.getElementById('map-view');
  if (mapSection) mapSection.scrollIntoView({ behavior: 'smooth' });

  setTimeout(() => {
    mapInstance.invalidateSize();
    mapInstance.flyTo([lat, lon], 15, { duration: 1.2 });

    const stn = currentMapStations.find(s => s.id === stnId);
    if (stn) displayStationPreview(stn);
  }, 350);
}

// User Geolocation Handler
function handleUserLocation() {
  if (!navigator.geolocation) {
    if (typeof showToast === 'function') showToast("Geolocation is not supported by your browser", "info");
    return;
  }

  if (typeof showToast === 'function') showToast("Detecting your location...", "info");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;

      if (userMarker && mapInstance) {
        mapInstance.removeLayer(userMarker);
      }

      // Google Maps Blue Pulse My-Location Marker
      const userIcon = L.divIcon({
        html: `
          <div style="position: relative; width: 22px; height: 22px;">
            <div style="position: absolute; inset: -8px; background: rgba(66, 133, 244, 0.35); border-radius: 50%; animation: pulse-ring 2s infinite;"></div>
            <div style="width: 22px; height: 22px; background: #4285F4; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>
          </div>
        `,
        className: 'google-user-location-pin',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      userMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(mapInstance);
      userMarker.bindPopup("<b>📍 You are here</b><br>Nearest EV stations loaded").openPopup();

      mapInstance.flyTo([latitude, longitude], 13, { duration: 1.5 });

      if (window.onUserLocationFound) {
        window.onUserLocationFound(latitude, longitude);
      }

      if (typeof showToast === 'function') showToast("Location locked! Sorted by closest distance.", "success");
    },
    (err) => {
      if (typeof showToast === 'function') showToast("Could not retrieve GPS location. Check browser location permissions.", "info");
      console.warn("Geolocation error:", err);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMap();
});
