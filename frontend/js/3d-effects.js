/**
 * ⚡ VoltNav - 3D Visual Effects, Three.js WebGL Engine, Tilt Physics & Image Showcase
 */

// Global Three.js references
let threeScene, threeCamera, threeRenderer, threeKioskGroup, threeAnimId;
let isThreeRunning = false;

// 1. Ambient Particle Grid Background
function initAmbientCanvas() {
  const canvas = document.getElementById('ambient-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Create ambient particles
  const particleCount = Math.min(width > 768 ? 35 : 18, 50);
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 2 + 1,
      color: Math.random() > 0.5 ? '#0284c7' : '#059669',
      alpha: Math.random() * 0.25 + 0.08
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    // Draw connecting lines between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 140) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(2, 132, 199, ${0.08 * (1 - dist / 140)})`;
          ctx.lineWidth = 0.6;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Update and draw particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });

    requestAnimationFrame(render);
  }

  // Check prefers-reduced-motion
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    render();
  }
}

// 2. Interactive Three.js 3D WebGL EV Charger Model
function initHeroThreeJS() {
  const canvas = document.getElementById('threejs-hero-canvas');
  if (!canvas || !window.THREE) return;

  const container = canvas.parentElement;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 240;

  // Scene
  threeScene = new THREE.Scene();

  // Camera
  threeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  threeCamera.position.set(0, 2.2, 5.8);

  // Renderer
  threeRenderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
  });
  threeRenderer.setSize(width, height);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  threeScene.add(ambientLight);

  const cyanLight = new THREE.PointLight(0x0284c7, 3, 25);
  cyanLight.position.set(3, 4, 3);
  threeScene.add(cyanLight);

  const greenLight = new THREE.PointLight(0x10b981, 2.5, 25);
  greenLight.position.set(-3, 2, 2);
  threeScene.add(greenLight);

  // Kiosk 3D Group
  threeKioskGroup = new THREE.Group();
  threeScene.add(threeKioskGroup);

  // 1. Pedestal Base
  const baseGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.25, 32);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.8
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = -1.2;
  threeKioskGroup.add(baseMesh);

  // Glowing Base Ring
  const ringGeo = new THREE.TorusGeometry(1.65, 0.04, 16, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = -1.1;
  threeKioskGroup.add(ringMesh);

  // 2. Kiosk Body Pillar
  const bodyGeo = new THREE.BoxGeometry(1.1, 2.4, 0.65);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    metalness: 0.85,
    roughness: 0.25
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.15;
  threeKioskGroup.add(bodyMesh);

  // Sleek Side Bevel Trims
  const trimGeo = new THREE.BoxGeometry(0.08, 2.42, 0.67);
  const trimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  
  const trimL = new THREE.Mesh(trimGeo, trimMat);
  trimL.position.set(-0.56, 0.15, 0);
  threeKioskGroup.add(trimL);

  const trimR = new THREE.Mesh(trimGeo, trimMat);
  trimR.position.set(0.56, 0.15, 0);
  threeKioskGroup.add(trimR);

  // 3. Glowing LED Digital Display
  const screenGeo = new THREE.PlaneGeometry(0.85, 1.4);
  const screenMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.85
  });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.set(0, 0.35, 0.34);
  threeKioskGroup.add(screenMesh);

  // Battery Icon / 100kW Graphic bar on screen
  const battGeo = new THREE.BoxGeometry(0.4, 0.2, 0.02);
  const battMat = new THREE.MeshBasicMaterial({ color: 0x00ff87 });
  const battMesh = new THREE.Mesh(battGeo, battMat);
  battMesh.position.set(0, 0.55, 0.36);
  threeKioskGroup.add(battMesh);

  // 4. Dual Charging Guns / Plugs
  const gunGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.45, 16);
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.9 });

  const gunL = new THREE.Mesh(gunGeo, gunMat);
  gunL.position.set(-0.7, -0.1, 0.1);
  gunL.rotation.z = Math.PI / 6;
  threeKioskGroup.add(gunL);

  const gunR = new THREE.Mesh(gunGeo, gunMat);
  gunR.position.set(0.7, -0.1, 0.1);
  gunR.rotation.z = -Math.PI / 6;
  threeKioskGroup.add(gunR);

  // 5. Holographic Rotating Energy Field Rings
  const holoGeo1 = new THREE.TorusGeometry(1.2, 0.02, 16, 64);
  const holoMat1 = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.6,
    wireframe: true
  });
  const holoMesh1 = new THREE.Mesh(holoGeo1, holoMat1);
  holoMesh1.rotation.x = Math.PI / 3;
  threeKioskGroup.add(holoMesh1);

  const holoGeo2 = new THREE.TorusGeometry(1.35, 0.02, 16, 64);
  const holoMat2 = new THREE.MeshBasicMaterial({
    color: 0x00ff87,
    transparent: true,
    opacity: 0.45,
    wireframe: true
  });
  const holoMesh2 = new THREE.Mesh(holoGeo2, holoMat2);
  holoMesh2.rotation.y = Math.PI / 4;
  threeKioskGroup.add(holoMesh2);

  // 6. Interactive Mouse Drag Orbit Controls
  let isDragging = false;
  let prevMouseX = 0;
  let targetRotY = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    prevMouseX = e.clientX;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - prevMouseX;
    prevMouseX = e.clientX;
    targetRotY += deltaX * 0.015;
  });

  // Touch Support
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      prevMouseX = e.touches[0].clientX;
    }
  });

  window.addEventListener('touchend', () => { isDragging = false; });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - prevMouseX;
    prevMouseX = e.touches[0].clientX;
    targetRotY += deltaX * 0.015;
  });

  // Resize Handler
  window.addEventListener('resize', () => {
    const newW = container.clientWidth || 400;
    const newH = container.clientHeight || 240;
    threeCamera.aspect = newW / newH;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(newW, newH);
  });

  // Render Loop
  let clock = new THREE.Clock();

  function animate() {
    threeAnimId = requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    // Auto rotate slowly if not dragging
    if (!isDragging) {
      targetRotY += 0.008;
    }

    // Smooth dampening
    threeKioskGroup.rotation.y += (targetRotY - threeKioskGroup.rotation.y) * 0.1;

    // Pulse energy rings
    holoMesh1.rotation.z = time * 0.8;
    holoMesh2.rotation.x = time * 0.6;
    holoMesh1.scale.setScalar(1 + Math.sin(time * 3) * 0.05);

    // Subtle floating
    threeKioskGroup.position.y = Math.sin(time * 2) * 0.08;

    threeRenderer.render(threeScene, threeCamera);
  }

  isThreeRunning = true;
  animate();
}

// 3. Hero 3D Picture Showcase & Mode Switcher
function initHeroMediaShowcase() {
  const photoBtn = document.getElementById('btn-show-photo');
  const model3dBtn = document.getElementById('btn-show-3d');
  const imgEl = document.getElementById('hero-featured-img');
  const canvasEl = document.getElementById('threejs-hero-canvas');
  const captionEl = document.getElementById('hero-media-caption');
  const thumbs = document.querySelectorAll('.hero-thumb-strip .thumb-item');

  // Toggle Photo View
  photoBtn?.addEventListener('click', () => {
    photoBtn.classList.add('active');
    model3dBtn?.classList.remove('active');
    if (imgEl) imgEl.style.display = 'block';
    if (canvasEl) canvasEl.style.display = 'none';
  });

  // Toggle 3D WebGL Model View
  model3dBtn?.addEventListener('click', () => {
    model3dBtn.classList.add('active');
    photoBtn?.classList.remove('active');
    if (imgEl) imgEl.style.display = 'none';
    if (canvasEl) {
      canvasEl.style.display = 'block';
      if (!isThreeRunning) {
        initHeroThreeJS();
      }
    }
  });

  // Thumbnail clicks
  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');

      const imgSrc = thumb.getAttribute('data-img');
      const caption = thumb.getAttribute('data-caption');

      if (imgEl) {
        imgEl.style.opacity = '0.3';
        setTimeout(() => {
          imgEl.src = imgSrc;
          imgEl.style.opacity = '1';
        }, 150);
      }

      if (captionEl) captionEl.textContent = caption;

      // Switch to photo view
      photoBtn?.click();
    });
  });
}

// 4. 3D Card Tilt Physics
function applyCardTilt(element) {
  if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  element.addEventListener('mousemove', (e) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -9; // Max 9 deg
    const rotateY = ((x - centerX) / centerX) * 9;

    element.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
  });

  element.addEventListener('mouseleave', () => {
    element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
  });
}

// 5. Attach 3D Tilt to all current and future cards
function refresh3DTiltCards() {
  document.querySelectorAll('[data-tilt]').forEach(applyCardTilt);
  const heroCard = document.getElementById('hero-tilt-card');
  if (heroCard) applyCardTilt(heroCard);
}

// 6. Smooth Number Counter Animation
function animateCounter(elementId, targetValue, duration = 1500, suffix = "") {
  const el = document.getElementById(elementId);
  if (!el) return;

  const target = parseFloat(targetValue.toString().replace(/,/g, ''));
  if (isNaN(target)) {
    el.textContent = targetValue;
    return;
  }

  const startTime = performance.now();
  const startVal = 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease-out expo
    const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const currentVal = Math.floor(startVal + (target - startVal) * easeProgress);

    el.textContent = currentVal.toLocaleString() + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target.toLocaleString() + suffix;
    }
  }

  requestAnimationFrame(update);
}

// 7. Toast Notification Manager
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'check-circle' : 'info';
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.animation = 'slide-in 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initAmbientCanvas();
  initHeroMediaShowcase();
  refresh3DTiltCards();
});
