/**
 * ⚡ VoltNav - Core Application Logic & State Management
 * Connects Frontend UI to Backend REST API with real-time Kaggle dataset telemetry
 */

const AppState = {
  page: 1,
  limit: 18,
  totalStations: 0,
  totalPages: 1,
  filters: {
    q: '',
    city: 'all',
    state: 'all',
    charger_type: 'all',
    status: 'all',
    sort_by: 'default'
  },
  userLocation: null,
  activeView: 'cards', // 'cards' or 'table'
  selectedStationId: null
};

// 1. Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFilterControls();
  initViewToggles();
  initModal();
  loadStats();
  loadFilterDropdowns();
  loadStations();
  initHeroSearch();
  initSlotMonitor();

  // Periodic polling for dynamic slot simulation updates
  setInterval(refreshDynamicSlots, 20000);
});

// 2. Navigation & Smooth Tab Scrolling
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const targetSection = document.getElementById(targetId);

      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Mobile menu toggle
  const mobileToggle = document.getElementById('mobile-toggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      const navLinksContainer = document.querySelector('.nav-links');
      if (navLinksContainer) {
        const isHidden = window.getComputedStyle(navLinksContainer).display === 'none';
        navLinksContainer.style.display = isHidden ? 'flex' : 'none';
        navLinksContainer.style.flexDirection = 'column';
        navLinksContainer.style.position = 'absolute';
        navLinksContainer.style.top = '70px';
        navLinksContainer.style.left = '20px';
        navLinksContainer.style.right = '20px';
        navLinksContainer.style.background = 'var(--bg-surface)';
        navLinksContainer.style.padding = '16px';
        navLinksContainer.style.borderRadius = 'var(--radius-md)';
        navLinksContainer.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
      }
    });
  }

  // Geolocation trigger in nav
  const geoBtn = document.getElementById('geo-btn');
  if (geoBtn) {
    geoBtn.addEventListener('click', () => {
      if (typeof handleUserLocation === 'function') {
        handleUserLocation();
      }
    });
  }

  // Geolocation callback
  window.onUserLocationFound = (lat, lon) => {
    AppState.userLocation = { lat, lon };
    const sortDistOpt = document.getElementById('sort-distance-opt');
    if (sortDistOpt) {
      sortDistOpt.disabled = false;
      sortDistOpt.textContent = "Nearest Distance (GPS Active)";
    }
    AppState.filters.sort_by = 'distance';
    const sortSelect = document.getElementById('filter-sort');
    if (sortSelect) sortSelect.value = 'distance';
    loadStations();
  };
}

// 3. Load Overview Dashboard Statistics
async function loadStats() {
  try {
    let data;
    if (window.VoltNavData) {
      data = await VoltNavData.getStats();
    } else {
      const res = await fetch('/api/stats');
      data = await res.json();
    }

    animateCounter('stat-total-stations', data.total_stations, 1200);
    animateCounter('stat-available-slots', data.available_slots, 1200);
    animateCounter('stat-total-slots', data.total_slots, 1200);
    
    const utilEl = document.getElementById('stat-utilization');
    if (utilEl) utilEl.textContent = `${data.utilization_rate}%`;

  } catch (err) {
    console.error("Failed to load statistics:", err);
  }
}

// 4. Load Cities and States Dropdowns
async function loadFilterDropdowns() {
  try {
    let cities, states;
    if (window.VoltNavData) {
      [cities, states] = await Promise.all([
        VoltNavData.getCities(),
        VoltNavData.getStates()
      ]);
    } else {
      const [citiesRes, statesRes] = await Promise.all([
        fetch('/api/cities'),
        fetch('/api/states')
      ]);
      cities = await citiesRes.json();
      states = await statesRes.json();
    }

    // Populate Cities
    const citySelect = document.getElementById('filter-city');
    if (citySelect) {
      citySelect.innerHTML = `<option value="all">All Cities (${cities.length}+)</option>`;
      cities.forEach(c => {
        citySelect.innerHTML += `<option value="${c.name.toLowerCase()}">${c.name} (${c.count})</option>`;
      });
    }

    // Populate States
    const stateSelect = document.getElementById('filter-state');
    if (stateSelect) {
      stateSelect.innerHTML = `<option value="all">All States / UTs (${states.length})</option>`;
      states.forEach(s => {
        stateSelect.innerHTML += `<option value="${s.toLowerCase()}">${s}</option>`;
      });
    }

    // Monitor station select in Availability section
    populateMonitorSelect(cities);

  } catch (err) {
    console.error("Failed to load dropdown options:", err);
  }
}

// 5. Hero Quick Search & Chips
function initHeroSearch() {
  const quickInput = document.getElementById('hero-quick-search');
  const searchBtn = document.getElementById('hero-search-btn');

  function executeSearch() {
    const val = quickInput.value.trim();
    if (!val) return;

    AppState.filters.q = val;
    const mainInput = document.getElementById('filter-search');
    if (mainInput) mainInput.value = val;

    document.getElementById('stations').scrollIntoView({ behavior: 'smooth' });
    loadStations();
  }

  if (searchBtn) searchBtn.addEventListener('click', executeSearch);
  if (quickInput) {
    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeSearch();
    });
  }

  // Quick city chips in hero
  document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const city = chip.getAttribute('data-city');
      AppState.filters.city = city.toLowerCase();
      
      const citySelect = document.getElementById('filter-city');
      if (citySelect) citySelect.value = city.toLowerCase();

      document.getElementById('stations').scrollIntoView({ behavior: 'smooth' });
      loadStations();

      // Update map pins
      if (typeof loadMapMarkers === 'function') {
        loadMapMarkers(city.toLowerCase(), AppState.filters.charger_type);
      }
    });
  });

  // Demo modal button in hero
  const demoModalBtn = document.getElementById('demo-modal-btn');
  if (demoModalBtn) {
    demoModalBtn.addEventListener('click', () => {
      openStationModal('STN-IND-0001');
    });
  }
}

// 6. Filter Controls & Event Handlers
function initFilterControls() {
  const searchInput = document.getElementById('filter-search');
  const clearBtn = document.getElementById('clear-search');
  const citySelect = document.getElementById('filter-city');
  const stateSelect = document.getElementById('filter-state');
  const sortSelect = document.getElementById('filter-sort');

  // Debounced Search Input
  let debounceTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      const val = e.target.value.trim();
      if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

      debounceTimeout = setTimeout(() => {
        AppState.filters.q = val;
        AppState.page = 1;
        loadStations();
      }, 350);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      AppState.filters.q = '';
      AppState.page = 1;
      loadStations();
    });
  }

  // City dropdown
  if (citySelect) {
    citySelect.addEventListener('change', (e) => {
      AppState.filters.city = e.target.value;
      AppState.page = 1;
      loadStations();
      if (typeof loadMapMarkers === 'function') {
        loadMapMarkers(AppState.filters.city, AppState.filters.charger_type);
      }
    });
  }

  // State dropdown
  if (stateSelect) {
    stateSelect.addEventListener('change', (e) => {
      AppState.filters.state = e.target.value;
      AppState.page = 1;
      loadStations();
    });
  }

  // Charger Type filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.filters.charger_type = chip.getAttribute('data-type');
      AppState.page = 1;
      loadStations();
      if (typeof loadMapMarkers === 'function') {
        loadMapMarkers(AppState.filters.city, AppState.filters.charger_type);
      }
    });
  });

  // Slot status chips
  document.querySelectorAll('.status-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.status-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.filters.status = chip.getAttribute('data-status');
      AppState.page = 1;
      loadStations();
    });
  });

  // Sort dropdown
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      AppState.filters.sort_by = e.target.value;
      loadStations();
    });
  }

  // Pagination buttons
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (AppState.page > 1) {
        AppState.page--;
        loadStations();
        document.getElementById('stations').scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (AppState.page < AppState.totalPages) {
        AppState.page++;
        loadStations();
        document.getElementById('stations').scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

// 7. View Toggles (Cards vs Table)
function initViewToggles() {
  const cardsBtn = document.getElementById('btn-view-cards');
  const tableBtn = document.getElementById('btn-view-table');
  const cardsContainer = document.getElementById('station-cards-container');
  const tableContainer = document.getElementById('station-table-container');

  if (cardsBtn && tableBtn) {
    cardsBtn.addEventListener('click', () => {
      cardsBtn.classList.add('active');
      tableBtn.classList.remove('active');
      cardsContainer.style.display = 'grid';
      tableContainer.style.display = 'none';
      AppState.activeView = 'cards';
    });

    tableBtn.addEventListener('click', () => {
      tableBtn.classList.add('active');
      cardsBtn.classList.remove('active');
      cardsContainer.style.display = 'none';
      tableContainer.style.display = 'block';
      AppState.activeView = 'table';
    });
  }
}

// 8. Fetch Stations from REST API or Static Netlify Fallback
async function loadStations() {
  const cardsContainer = document.getElementById('station-cards-container');
  const tableBody = document.getElementById('station-table-body');

  try {
    let data;
    if (window.VoltNavData) {
      data = await VoltNavData.getStations(
        AppState.filters,
        AppState.page,
        AppState.limit,
        AppState.userLocation?.lat,
        AppState.userLocation?.lon
      );
    } else {
      let url = `/api/stations?page=${AppState.page}&limit=${AppState.limit}&sort_by=${AppState.filters.sort_by}`;

      if (AppState.filters.q) url += `&q=${encodeURIComponent(AppState.filters.q)}`;
      if (AppState.filters.city !== 'all') url += `&city=${encodeURIComponent(AppState.filters.city)}`;
      if (AppState.filters.state !== 'all') url += `&state=${encodeURIComponent(AppState.filters.state)}`;
      if (AppState.filters.charger_type !== 'all') url += `&charger_type=${encodeURIComponent(AppState.filters.charger_type)}`;
      if (AppState.filters.status !== 'all') url += `&status=${encodeURIComponent(AppState.filters.status)}`;

      if (AppState.userLocation) {
        url += `&lat=${AppState.userLocation.lat}&lon=${AppState.userLocation.lon}`;
      }

      const res = await fetch(url);
      data = await res.json();
    }

    AppState.totalStations = data.total;
    AppState.totalPages = data.total_pages;

    // Update Result Counters
    const dispEl = document.getElementById('displayed-count');
    const totEl = document.getElementById('total-count');
    if (dispEl) dispEl.textContent = data.stations.length;
    if (totEl) totEl.textContent = data.total.toLocaleString();

    // Render Views
    renderStationCards(data.stations);
    renderStationTable(data.stations);
    renderPagination();

    // Reinitialize tilt effects on freshly rendered cards
    if (typeof refresh3DTiltCards === 'function') {
      setTimeout(refresh3DTiltCards, 50);
    }

    // Recreate Lucide Icons
    if (window.lucide) lucide.createIcons();

  } catch (err) {
    console.error("Failed to load stations:", err);
    if (cardsContainer) {
      cardsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ff3366;">
          <h3>⚠️ Unable to load station records</h3>
          <p>Please ensure the backend server is running at http://localhost:5000</p>
        </div>
      `;
    }
  }
}

// Helper to select the most appropriate picture for a station
function getStationImage(stn) {
  const name = (stn.name || '').toLowerCase();
  const op = (stn.operator || '').toLowerCase();
  const power = stn.power_kw || 30;

  if (op.includes('ather') || name.includes('scooter') || name.includes('cycle') || power <= 10) {
    return 'images/hero-3d-scooter.jpg';
  } else if (name.includes('mall') || name.includes('complex') || name.includes('square') || name.includes('market') || name.includes('hotel')) {
    return 'images/hero-3d-mall.jpg';
  } else if (power >= 50 || name.includes('dc') || op.includes('statiq') || op.includes('tata') || op.includes('iocl')) {
    return 'images/hero-3d-station.jpg';
  } else if (stn.charger_type && stn.charger_type.includes('Dual')) {
    return 'images/hero-3d-kiosk.jpg';
  } else {
    return 'images/hero-3d-plaza.jpg';
  }
}

// 9. Render Station Cards with Picture Banners
function renderStationCards(stations) {
  const container = document.getElementById('station-cards-container');
  if (!container) return;

  if (stations.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #94a3b8;">
        <i data-lucide="search-x" style="width: 48px; height: 48px; color: #00f0ff; margin-bottom: 12px; opacity: 0.6;"></i>
        <h3>No Charging Stations Found</h3>
        <p>Try clearing your filters or searching for another city / landmark.</p>
      </div>
    `;
    return;
  }

  let html = '';
  stations.forEach(stn => {
    const isAvail = stn.available_slots > 0;
    const availPercent = Math.round((stn.available_slots / stn.total_slots) * 100);
    const imgSrc = getStationImage(stn);

    // Build mini slot pills
    let slotPillsHtml = '';
    (stn.slots || []).forEach(sl => {
      slotPillsHtml += `
        <span class="slot-pill-badge ${sl.color}" title="Slot ${sl.slot_number}: ${sl.status} (${sl.connector})">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span>
          ${sl.status === 'Available' ? 'Free' : (sl.status === 'Occupied' ? 'In Use' : 'Maint')}
        </span>
      `;
    });

    // Distance badge if GPS active
    let distBadge = '';
    if (stn.distance_km !== null && stn.distance_km !== undefined) {
      distBadge = `<span class="badge badge-purple"><i data-lucide="navigation" style="width:10px;height:10px;"></i> ${stn.distance_km} km away</span>`;
    }

    html += `
      <div class="station-card" data-tilt>
        <div class="station-card-inner">
          <!-- Photo Banner with Overlay -->
          <div class="card-media-wrapper">
            <img src="${imgSrc}" alt="${stn.name}" class="card-media-img" loading="lazy">
            <div class="card-media-gradient"></div>
            <div class="card-media-top-tags">
              <span class="media-operator-pill">${stn.operator || 'Public Network'}</span>
              <span class="status-badge ${isAvail ? 'available' : 'occupied'}">
                <span class="dot"></span> ${stn.status}
              </span>
            </div>
            <div class="media-power-tag">
              <i data-lucide="zap" style="width:12px;height:12px;"></i>
              <span>${stn.power_kw} kW</span>
            </div>
          </div>

          <div class="station-card-top">
            <div>
              <h3 class="card-station-name">${stn.name}</h3>
            </div>
          </div>

          <div class="card-location-row">
            <i data-lucide="map-pin"></i>
            <span>${stn.city}, ${stn.state}</span>
            ${distBadge}
          </div>

          <div class="specs-strip">
            <div class="spec-cell">
              <span class="cell-label">Power</span>
              <span class="cell-value text-cyan">${stn.power_kw} kW</span>
            </div>
            <div class="spec-cell">
              <span class="cell-label">Charger Class</span>
              <span class="cell-value">${stn.speed_tier || 'Fast'}</span>
            </div>
            <div class="spec-cell">
              <span class="cell-label">Slots Free</span>
              <span class="cell-value ${isAvail ? 'text-emerald' : 'text-amber'}">${stn.available_slots}/${stn.total_slots}</span>
            </div>
          </div>

          <div class="slot-bar-wrapper">
            <div class="slot-bar-meta">
              <span style="color: #94a3b8; font-size: 0.75rem;">Slot Availability</span>
              <span style="font-weight: 700; font-size: 0.75rem; color: ${isAvail ? '#00ff87' : '#ffb703'};">${availPercent}% Free</span>
            </div>
            <div class="slot-progress-bar">
              <div class="slot-progress-fill" style="width: ${availPercent}%;"></div>
            </div>
          </div>

          <div class="card-slots-row">
            ${slotPillsHtml}
          </div>

          <div class="station-card-actions">
            <button class="btn btn-primary btn-sm" onclick="openStationModal('${stn.id}')">
              <i data-lucide="zap"></i> View Specs
            </button>
            <button class="btn btn-glass btn-sm" onclick="flyToStation(${stn.latitude}, ${stn.longitude}, '${stn.id}')" title="Center on Map">
              <i data-lucide="map"></i> Map
            </button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${stn.latitude},${stn.longitude}" target="_blank" class="btn btn-glass btn-sm" title="Directions">
              <i data-lucide="navigation"></i>
            </a>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// 10. Render Station Table View
function renderStationTable(stations) {
  const tableBody = document.getElementById('station-table-body');
  if (!tableBody) return;

  let html = '';
  stations.forEach(stn => {
    const isAvail = stn.available_slots > 0;
    html += `
      <tr>
        <td style="font-weight: 700;">
          <div>${stn.name}</div>
          <small style="color: #00f0ff;">${stn.operator}</small>
        </td>
        <td>${stn.city}, ${stn.state}</td>
        <td><span class="badge badge-cyan">${stn.charger_type}</span></td>
        <td class="font-bold text-cyan">${stn.power_kw} kW</td>
        <td>${stn.total_slots} Ports</td>
        <td>
          <span class="status-badge ${isAvail ? 'available' : 'occupied'}">
            ${stn.available_slots} / ${stn.total_slots} Free
          </span>
        </td>
        <td>${stn.operating_hours || '24/7'}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-primary" onclick="openStationModal('${stn.id}')">Details</button>
            <button class="btn btn-sm btn-glass" onclick="flyToStation(${stn.latitude}, ${stn.longitude}, '${stn.id}')">Map</button>
          </div>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
}

// 11. Pagination Rendering
function renderPagination() {
  const numbersContainer = document.getElementById('page-numbers');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');

  if (prevBtn) prevBtn.disabled = AppState.page <= 1;
  if (nextBtn) nextBtn.disabled = AppState.page >= AppState.totalPages;

  if (!numbersContainer) return;

  let html = '';
  const current = AppState.page;
  const total = AppState.totalPages;

  // Window of 5 pages
  let start = Math.max(1, current - 2);
  let end = Math.min(total, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);

  for (let i = start; i <= end; i++) {
    html += `
      <button class="page-btn ${i === current ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>
    `;
  }

  numbersContainer.innerHTML = html;
}

function goToPage(pageNum) {
  AppState.page = pageNum;
  loadStations();
  document.getElementById('stations').scrollIntoView({ behavior: 'smooth' });
}

// 12. Station Modal Operations
function initModal() {
  const backdrop = document.getElementById('station-modal-backdrop');
  const closeBtn = document.getElementById('modal-close-btn');

  if (closeBtn) closeBtn.addEventListener('click', closeStationModal);
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeStationModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeStationModal();
  });

  // Modal Reserve Slot Button
  const bookBtn = document.getElementById('m-book-slot-btn');
  if (bookBtn) {
    bookBtn.addEventListener('click', () => {
      if (AppState.selectedStationId) {
        reserveSlot(AppState.selectedStationId);
      }
    });
  }
}

async function openStationModal(stationId) {
  try {
    let stn;
    if (window.VoltNavData) {
      stn = await VoltNavData.getStationById(stationId);
      if (!stn) throw new Error("Station not found");
    } else {
      const res = await fetch(`/api/stations/${stationId}`);
      if (!res.ok) throw new Error("Station not found");
      stn = await res.json();
    }

    AppState.selectedStationId = stn.id;

    // Populate modal fields
    const modalImg = document.getElementById('m-photo-img');
    if (modalImg) modalImg.src = getStationImage(stn);

    document.getElementById('m-name').textContent = stn.name;
    document.getElementById('m-operator').textContent = stn.operator || 'Public Network';
    document.getElementById('m-status').textContent = stn.status;
    document.getElementById('m-status').className = `badge ${stn.available_slots > 0 ? 'badge-emerald' : 'badge-amber'}`;
    document.getElementById('m-speed').textContent = stn.speed_tier || 'Fast';

    document.getElementById('m-address').querySelector('span').textContent = stn.address || `${stn.city}, ${stn.state}`;
    document.getElementById('m-power').textContent = `${stn.power_kw} kW`;
    document.getElementById('m-pricing').textContent = stn.pricing || '₹18 / kWh';
    document.getElementById('m-hours').textContent = stn.operating_hours || '24/7 Always Open';
    document.getElementById('m-voltage').textContent = stn.voltage || '400V - 800V DC';

    // Directions link
    const dirBtn = document.getElementById('m-directions-btn');
    if (dirBtn) {
      dirBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${stn.latitude},${stn.longitude}`;
    }

    // Connectors
    const connContainer = document.getElementById('m-connectors');
    if (connContainer) {
      connContainer.innerHTML = (stn.connectors || []).map(c => `
        <span class="connector-chip">
          <i data-lucide="plug-2" style="width:14px;height:14px;color:#00f0ff;"></i>
          ${c}
        </span>
      `).join('');
    }

    // Slots Summary & Visual Grid
    document.getElementById('m-slots-summary').textContent = `${stn.available_slots} of ${stn.total_slots} Slots Free`;
    
    const slotsGrid = document.getElementById('m-slots-grid');
    if (slotsGrid) {
      slotsGrid.innerHTML = (stn.slots || []).map(sl => `
        <div class="slot-visual-box ${sl.status}">
          <div class="slot-box-num">Slot #${sl.slot_number}</div>
          <div class="slot-box-status">${sl.status === 'Available' ? '🟢 Available' : (sl.status === 'Occupied' ? '🟠 Occupied' : '🔴 Maint')}</div>
          <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px;">${sl.connector}</div>
        </div>
      `).join('');
    }

    // Amenities
    const amenitiesContainer = document.getElementById('m-amenities');
    if (amenitiesContainer) {
      amenitiesContainer.innerHTML = (stn.amenities || []).map(a => `
        <span class="amenity-chip">${a}</span>
      `).join('');
    }

    // Show modal
    const backdrop = document.getElementById('station-modal-backdrop');
    if (backdrop) backdrop.classList.add('open');

    if (window.lucide) lucide.createIcons();

  } catch (err) {
    console.error("Error opening station modal:", err);
  }
}

function closeStationModal() {
  const backdrop = document.getElementById('station-modal-backdrop');
  if (backdrop) backdrop.classList.remove('open');
}

// 13. Interactive Slot Booking Simulation
async function reserveSlot(stationId, slotId = null) {
  try {
    let data;
    if (window.VoltNavData) {
      data = await VoltNavData.reserveSlot(stationId, slotId, 'Driver App Session');
    } else {
      const res = await fetch('/api/slots/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: stationId,
          slot_id: slotId,
          user_name: 'Driver App Session'
        })
      });
      data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Slot reservation failed", "info");
        return;
      }
    }

    showToast(`⚡ ${data.message}! Charging gun activated.`, 'success');

    // Refresh modal if open
    openStationModal(stationId);

    // Refresh active cards
    loadStations();
    loadStats();

  } catch (err) {
    console.error("Slot reservation error:", err);
    showToast("Network error reserving slot", "info");
  }
}

// 14. Availability Section: Interactive Station Monitor
function populateMonitorSelect(cities) {
  const select = document.getElementById('monitor-station-select');
  if (!select) return;

  // Fetch top 30 stations for the monitor
  fetch('/api/stations?limit=30')
    .then(r => r.json())
    .then(data => {
      select.innerHTML = '<option value="">Select an EV station to monitor...</option>';
      (data.stations || []).forEach(stn => {
        select.innerHTML += `<option value="${stn.id}">${stn.name} (${stn.city}) - ${stn.available_slots} Slots Free</option>`;
      });

      // Default to first station
      if (data.stations && data.stations.length > 0) {
        select.value = data.stations[0].id;
        renderSlotMonitorContent(data.stations[0]);
      }
    });

  select.addEventListener('change', (e) => {
    const id = e.target.value;
    if (!id) return;
    fetch(`/api/stations/${id}`)
      .then(r => r.json())
      .then(stn => renderSlotMonitorContent(stn));
  });
}

function initSlotMonitor() {
  // handled in populateMonitorSelect
}

function renderSlotMonitorContent(stn) {
  const container = document.getElementById('slot-monitor-content');
  if (!container) return;

  let slotsHtml = '';
  (stn.slots || []).forEach(sl => {
    const isAvail = sl.status === 'Available';
    slotsHtml += `
      <div class="monitor-slot-card ${sl.color}">
        <div class="slot-number-title">Port #${sl.slot_number}</div>
        <div class="slot-connector-type">${sl.connector}</div>
        <div class="slot-state-badge ${isAvail ? 'available' : 'occupied'}">
          <span class="dot"></span> ${sl.status}
        </div>
        <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 14px;">
          Max Output: <strong class="text-cyan">${sl.power_kw} kW</strong>
        </div>
        ${isAvail ? `
          <button class="btn btn-primary btn-sm" onclick="reserveSlot('${stn.id}', '${sl.slot_id}')" style="width: 100%;">
            <i data-lucide="zap"></i> Plug-In Simulation
          </button>
        ` : `
          <button class="btn btn-glass btn-sm" disabled style="width: 100%; opacity: 0.6; cursor: not-allowed;">
            Currently In Use
          </button>
        `}
      </div>
    `;
  });

  container.innerHTML = `
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
        <div>
          <span class="operator-tag">${stn.operator} &bull; ${stn.speed_tier} Hub</span>
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-top: 4px;">${stn.name}</h2>
          <p style="color: #94a3b8; font-size: 0.9rem;">📍 ${stn.address}</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <span class="badge badge-cyan">${stn.power_kw} kW Rating</span>
          <span class="badge badge-emerald">${stn.available_slots} / ${stn.total_slots} Slots Available</span>
        </div>
      </div>
    </div>

    <div class="monitor-slots-grid">
      ${slotsHtml}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// 15. Periodic Dynamic Slot Refresher
function refreshDynamicSlots() {
  // Update stats bar subtly
  fetch('/api/stats')
    .then(r => r.json())
    .then(data => {
      const availEl = document.getElementById('stat-available-slots');
      if (availEl) availEl.textContent = data.available_slots.toLocaleString();
    })
    .catch(() => {});
}
