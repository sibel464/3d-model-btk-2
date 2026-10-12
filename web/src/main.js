import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import gsap from 'gsap';

gsap.ticker.lagSmoothing(0);
import { ROOMS, VIAS, P } from './rooms.js';
import { enhanceMaterials, buildMirrors, buildCeiling, buildDaylight, buildGround } from './completion.js';
import { buildDecor } from './decor.js';
import './style.css';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug');

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!DEBUG });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Işıklar ve model statik: gölge haritası yalnızca model yüklenince bir kez hesaplanır
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0e0c);
scene.fog = new THREE.Fog(0x0f0e0c, 18, 40);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 120);
const lookTarget = new THREE.Vector3();

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enabled = false;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.3;
controls.maxDistance = 22;

// ---------------------------------------------------------------- tamamlanan parçalar
buildDaylight(scene);
buildGround(scene);
const ceiling = buildCeiling(scene);
let mirrors = [];
const collidables = [];

// ---------------------------------------------------------------- UI referansları
const $ = (id) => document.getElementById(id);
const ui = {
  loader: $('loader'), loaderBar: $('loader-bar'), loaderText: $('loader-text'),
  nav: $('rooms-nav'),
  chapter: $('chapter'), chIndex: $('chapter-index'), chTitle: $('chapter-title'), chText: $('chapter-text'), chItems: $('chapter-items'),
  hotspots: $('hotspots'),
  focus: $('focus-panel'), fRoom: $('focus-room'), fTitle: $('focus-title'), fText: $('focus-text'), fSpecs: $('focus-specs'), fBack: $('focus-back'),
  hint: $('hint'), freeHint: $('free-hint'), progress: $('progress-bar'),
  modeTour: $('mode-tour'), modeFree: $('mode-free'),
};

// ---------------------------------------------------------------- tur yolu
const v = (a) => P(a[0], a[1], a[2]);
const stations = ROOMS.map((r) => ({ cam: v(r.cam), look: v(r.look), room: r }));
const N = stations.length;

// Her ardışık istasyon çifti için kameranın izleyeceği eğri (kapı ara noktalarıyla)
const segments = [];
for (let i = 0; i < N - 1; i++) {
  const key = `${stations[i].room.id}>${stations[i + 1].room.id}`;
  const via = (VIAS[key] || []).map(v);
  const pts = [stations[i].cam, ...via, stations[i + 1].cam];
  const curve = pts.length > 2
    ? new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    : new THREE.LineCurve3(pts[0], pts[1]);
  segments.push({ curve, hasVia: via.length > 0 });
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// Scroll ilerlemesi (0..N-1) → kamera pozu. İstasyonlarda kısa bir "durma" platosu var.
const _tan = new THREE.Vector3();
const _fwd = new THREE.Vector3();
function poseAt(s, outPos, outLook) {
  const i = Math.min(N - 2, Math.floor(s));
  const raw = s - i;
  const f = smooth(clamp01((raw - 0.18) / 0.64));
  const seg = segments[i];
  seg.curve.getPoint(f, outPos);
  outLook.lerpVectors(stations[i].look, stations[i + 1].look, f);
  // Odadan ayrılmadan önce bakılan noktaya doğru hafif yakınlaşma (scroll'a anında tepki)
  const lean = Math.sin(Math.PI * clamp01(raw / 0.42)) * 0.16;
  if (lean > 0) _tan.subVectors(stations[i].look, stations[i].cam), outPos.addScaledVector(_tan, lean * (i === 0 ? 1.4 : 1));
  if (seg.hasVia) {
    // Kapıdan geçerken hareket yönüne bak
    seg.curve.getTangent(f, _tan);
    _tan.y = 0;
    _tan.normalize();
    _fwd.copy(outPos).addScaledVector(_tan, 2);
    _fwd.y = outPos.y - 0.15;
    outLook.lerp(_fwd, Math.sin(Math.PI * f) * 0.85);
  }
}

// ---------------------------------------------------------------- durum
const state = {
  mode: 'tour', // 'tour' | 'focus' | 'free' | 'transition'
  target: 0, // scroll hedef ilerleme (0..N-1)
  current: 0,
  activeRoom: -1,
  focusItem: null,
};

// ---------------------------------------------------------------- sanal scroll
// Sayfa gerçekten kaymıyor: tekerlek / dokunma / klavye doğrudan tur ilerlemesini sürüyor.
// Kullanıcı durunca kamera kaydırma yönündeki en yakın odaya "oturuyor".
const WHEEL_ROOMS_PER_PX = 1 / 420; // ~4 tekerlek çentiği = 1 oda
const TOUCH_ROOMS_PER_PX = 1 / 260;
let station = 0; // en son oturulan oda
let snapTimer = null;

const clampS = (s) => Math.min(N - 1, Math.max(0, s));

function goToRoom(i) {
  clearTimeout(snapTimer);
  station = clampS(Math.round(i));
  state.target = station;
}

function snap() {
  const d = state.target - station;
  let next = station;
  if (d > 0.1) next = Math.ceil(state.target - 0.08);
  else if (d < -0.1) next = Math.floor(state.target + 0.08);
  goToRoom(next);
}

function nudge(delta) {
  if (state.mode === 'focus') {
    exitFocus();
    return;
  }
  if (state.mode !== 'tour') return;
  state.target = clampS(state.target + Math.max(-0.6, Math.min(0.6, delta)));
  ui.hint.classList.add('gone');
  clearTimeout(snapTimer);
  snapTimer = setTimeout(snap, 260);
}

window.addEventListener('wheel', (e) => {
  if (state.mode === 'free') return; // serbest modda OrbitControls yakınlaştırır
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
  nudge(e.deltaY * unit * WHEEL_ROOMS_PER_PX);
}, { passive: false });

let touchY = null;
window.addEventListener('touchstart', (e) => {
  if (state.mode === 'free' || e.touches.length !== 1) return;
  touchY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (touchY === null || state.mode === 'free') return;
  const y = e.touches[0].clientY;
  nudge((touchY - y) * TOUCH_ROOMS_PER_PX);
  touchY = y;
  if (e.cancelable) e.preventDefault();
}, { passive: false });
window.addEventListener('touchend', () => (touchY = null));

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.mode === 'focus') exitFocus();
    return;
  }
  if (state.mode !== 'tour') return;
  const next = ['ArrowDown', 'PageDown', ' ', 'ArrowRight'].includes(e.key) ? 1
    : ['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key) ? -1 : 0;
  if (!next) return;
  e.preventDefault();
  goToRoom(station + next);
  ui.hint.classList.add('gone');
});

// ---------------------------------------------------------------- oda navigasyonu
ROOMS.forEach((r, i) => {
  const b = document.createElement('button');
  b.innerHTML = `<span class="lbl">${r.title}</span><i></i>`;
  b.addEventListener('click', () => {
    if (state.mode === 'focus') exitFocus(() => goToRoom(i));
    else if (state.mode === 'free') setMode('tour', () => goToRoom(i));
    else goToRoom(i);
  });
  ui.nav.appendChild(b);
});

function setActiveRoom(i) {
  if (i === state.activeRoom) return;
  state.activeRoom = i;
  [...ui.nav.children].forEach((b, k) => b.classList.toggle('active', k === i));
  const r = ROOMS[i];
  ui.chapter.classList.add('swap');
  setTimeout(() => {
    ui.chIndex.textContent = `${String(i + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
    ui.chTitle.textContent = r.title;
    ui.chText.textContent = r.text;
    ui.chItems.innerHTML = '';
    r.items.forEach((it) => {
      const b = document.createElement('button');
      b.textContent = it.name;
      b.addEventListener('click', () => enterFocus(it, r));
      ui.chItems.appendChild(b);
    });
    ui.chapter.classList.remove('swap');
  }, 220);
}

// ---------------------------------------------------------------- eşya etiketleri
const hotspots = [];
ROOMS.forEach((room, ri) => {
  room.items.forEach((it) => {
    const el = document.createElement('div');
    el.className = 'hotspot hidden';
    el.innerHTML = `<span class="pin"></span><span class="tag">${it.name}</span>`;
    el.addEventListener('click', () => enterFocus(it, room));
    ui.hotspots.appendChild(el);
    hotspots.push({ el, item: it, room, roomIndex: ri, pos: v(it.pos), occluded: false });
  });
});

const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true;
const _p = new THREE.Vector3();
const _dir = new THREE.Vector3();
let occlusionTick = 0;

function updateHotspots() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const checkOcclusion = (occlusionTick++ % 6) === 0;
  const near = Math.round(state.current);
  for (const hs of hotspots) {
    let visible = state.mode === 'tour'
      ? hs.roomIndex === near && Math.abs(state.current - near) < 0.2
      : state.mode === 'free' && camera.position.distanceTo(hs.pos) < 5;
    if (visible) {
      _p.copy(hs.pos).project(camera);
      if (_p.z > 1 || Math.abs(_p.x) > 1.05 || Math.abs(_p.y) > 1.05) visible = false;
      else {
        if (checkOcclusion && collidables.length) {
          const dist = camera.position.distanceTo(hs.pos);
          _dir.copy(hs.pos).sub(camera.position).normalize();
          raycaster.set(camera.position, _dir);
          raycaster.far = dist;
          const hit = raycaster.intersectObjects(collidables, false)[0];
          hs.occluded = !!hit && hit.distance < dist - 0.35;
        }
        if (hs.occluded) visible = false;
        const x = (_p.x * 0.5 + 0.5) * w;
        const y = (-_p.y * 0.5 + 0.5) * h;
        hs.el.style.transform = `translate(${x - 8}px, ${y - 8}px)`;
      }
    }
    hs.el.classList.toggle('hidden', !visible);
  }
}

// ---------------------------------------------------------------- odak modu
let tween = null;
function flyTo(pos, look, duration = 1.6, onComplete) {
  tween?.kill();
  const from = { p: camera.position.clone(), l: lookTarget.clone() };
  const o = { t: 0 };
  tween = gsap.to(o, {
    t: 1, duration, ease: 'power3.inOut',
    onUpdate: () => {
      camera.position.lerpVectors(from.p, pos, o.t);
      lookTarget.lerpVectors(from.l, look, o.t);
      camera.lookAt(lookTarget);
    },
    onComplete,
  });
}

function enterFocus(item, room) {
  if (state.mode === 'free') setMode('tour');
  // Odak, içinde bulunulan odaya bağlanır; dönüşte kamera bu odaya oturur
  goToRoom(Math.round(state.current));
  state.current = state.target;
  state.mode = 'focus';
  state.focusItem = item;
  document.body.classList.add('focus');
  ui.fRoom.textContent = room.title;
  ui.fTitle.textContent = item.name;
  ui.fText.textContent = item.text;
  ui.fSpecs.innerHTML = Object.entries(item.specs || {}).map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('');
  ui.focus.classList.remove('hidden');
  flyTo(v(item.cam), v(item.look), 1.6);
}

function exitFocus(after) {
  if (state.mode !== 'focus') return;
  ui.focus.classList.add('hidden');
  state.mode = 'transition';
  document.body.classList.remove('focus');
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  poseAt(state.current, pos, look);
  flyTo(pos, look, 1.2, () => {
    state.mode = 'tour';
    state.focusItem = null;
    after?.();
  });
}
ui.fBack.addEventListener('click', () => exitFocus());

// ---------------------------------------------------------------- serbest gezinti modu
function setMode(mode, after) {
  if (mode === state.mode) return after?.();
  if (state.mode === 'focus') {
    ui.focus.classList.add('hidden');
    document.body.classList.remove('focus');
  }
  ui.modeTour.classList.toggle('active', mode === 'tour');
  ui.modeFree.classList.toggle('active', mode === 'free');
  if (mode === 'free') {
    state.mode = 'free';
    tween?.kill();
    document.body.classList.add('free');
    ui.freeHint.classList.remove('hidden');
    controls.target.copy(lookTarget);
    controls.enabled = true;
    controls.update();
    after?.();
  } else {
    controls.enabled = false;
    ui.freeHint.classList.add('hidden');
    document.body.classList.remove('free');
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    poseAt(state.current, pos, look);
    state.mode = 'transition'; // geçiş sırasında scroll kilitli
    flyTo(pos, look, 1.4, () => {
      state.mode = 'tour';
      after?.();
    });
  }
}
ui.modeTour.addEventListener('click', () => setMode('tour'));
ui.modeFree.addEventListener('click', () => setMode('free'));

// Serbest modda zemine çift tıklayınca oraya yürü
canvas.addEventListener('dblclick', (e) => {
  if (state.mode !== 'free' || !collidables.length) return;
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  raycaster.far = 100;
  const hit = raycaster.intersectObjects(collidables, false)[0];
  if (!hit) return;
  const p = hit.point;
  const dir = new THREE.Vector3().subVectors(p, camera.position).setY(0).normalize();
  const eye = new THREE.Vector3(p.x, 1.6, p.z).addScaledVector(dir, -1.2);
  const look = new THREE.Vector3(p.x, Math.max(0.6, p.y), p.z).addScaledVector(dir, 0.6);
  controls.enabled = false;
  flyTo(eye, look, 1.2, () => {
    controls.target.copy(look);
    controls.enabled = true;
    controls.update();
  });
});

// ---------------------------------------------------------------- model yükleme
const loader = new GLTFLoader();
loader.load(
  '/models/apartment.glb',
  (gltf) => {
    const model = gltf.scene;
    // 3ds cm → metre; daire ortalanır (bkz. rooms.js P())
    model.scale.setScalar(0.01);
    model.position.copy(P(0, 0, 0));
    model.updateMatrixWorld(true);
    const { mirrors: mirrorMeshes } = enhanceMaterials(model, renderer);
    scene.add(model);
    buildDecor(scene, model);
    mirrors = buildMirrors(scene, mirrorMeshes);
    model.traverse((o) => {
      if (o.isMesh && !o.material.transparent) {
        o.geometry.computeBoundsTree();
        collidables.push(o);
      }
    });
    ui.loaderText.textContent = 'Hazır';
    setTimeout(() => ui.loader.classList.add('done'), 300);
    renderer.shadowMap.needsUpdate = true;
    window.__ready = true;
  },
  (e) => {
    const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
    ui.loaderBar.style.width = `${pct}%`;
    ui.loaderText.textContent = `Model yükleniyor… ${pct}%`;
  },
  (err) => {
    console.error(err);
    ui.loaderText.textContent = 'Model yüklenemedi.';
  }
);

// ---------------------------------------------------------------- döngü
const clock = new THREE.Clock();
let debugCam = null;
const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
state.current = state.target;
poseAt(state.current, camera.position, lookTarget);
camera.lookAt(lookTarget);

function updateRoomEffects() {
  // Hangi odadayız? (en yakın istasyon)
  const roomId = ROOMS[Math.round(state.current)].id;
  const insideHeight = camera.position.y < 2.4;
  ceiling.group.visible = insideHeight || state.mode === 'free';
  // Aynalar yalnızca ilgili banyodayken render edilir (performans)
  for (const m of mirrors) {
    const d = camera.position.distanceTo(m.position);
    m.visible = insideHeight && d < 4.5;
  }
  return roomId;
}

// Uyarlanabilir çözünürlük: zayıf GPU'larda kare hızı düşerse piksel oranını azalt
let fpsFrames = 0;
let fpsTime = 0;
let pixelRatio = renderer.getPixelRatio();
function adaptResolution(dt) {
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime < 2) return;
  const fps = fpsFrames / fpsTime;
  fpsFrames = 0;
  fpsTime = 0;
  if (fps < 40 && pixelRatio > 0.75) {
    pixelRatio = Math.max(0.75, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
  }
}

function tick() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.1);
  if (!DEBUG && window.__ready) adaptResolution(rawDt);
  if (state.mode === 'tour') {
    state.current += (state.target - state.current) * (1 - Math.exp(-dt * 3.5));
    if (Math.abs(state.target - state.current) < 1e-4) state.current = state.target;
    poseAt(state.current, _pos, _look);
    camera.position.copy(_pos);
    lookTarget.copy(_look);
    camera.lookAt(lookTarget);
    setActiveRoom(Math.round(state.current));
    ui.progress.style.width = `${(state.current / (N - 1)) * 100}%`;
  } else if (state.mode === 'free' && controls.enabled) {
    controls.update();
    lookTarget.copy(controls.target);
  }
  if (debugCam) {
    renderer.render(scene, debugCam);
    requestAnimationFrame(tick);
    return;
  }
  updateRoomEffects();
  updateHotspots();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- hata ayıklama yardımcıları
if (DEBUG) {
  window.__three = { THREE, scene, camera, renderer, P, state, poseAt, lookTarget, controls, setMode, enterFocus, ROOMS };
  // Sabit kamera pozu: ?debug=1 ile window.__setCam([x,y,z],[x,y,z]) (3ds koordinatları)
  window.__setCam = (c, l) => {
    state.mode = 'debug';
    camera.position.copy(v(c));
    lookTarget.copy(v(l));
    camera.lookAt(lookTarget);
  };
  window.__top = (x0 = -8950, y0 = -200, x1 = -7830, y1 = 540, height = 50) => {
    state.mode = 'debug';
    const a = P(x0, y0, 0);
    const b = P(x1, y1, 0);
    const ortho = new THREE.OrthographicCamera(a.x, b.x, -b.z, -a.z, 0.01, 100);
    // Kuzey (3ds +y = dünya -z) ekranın üstünde
    ortho.position.set(0, height, 0);
    ortho.up.set(0, 0, -1);
    ortho.lookAt(0, 0, 0);
    ceiling.group.visible = false;
    mirrors.forEach((m) => (m.visible = false));
    scene.fog = null;
    debugCam = ortho;
  };
}
