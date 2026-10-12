import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { P } from './rooms.js';

/*
 * Sketchfab'dan gelen model yalnızca baseColor dokuları içeriyor; tavan,
 * pürüzlülük/metallik değerleri, cam ve ayna davranışı ile aydınlatma eksik.
 * Bu modül eksikleri kodla tamamlar.
 */

// ---------- 1) Malzeme tamamlama (PBR) ----------
const RULES = [
  // [ad eşleşmesi, ayarlar]
  [/^Glass__Grey/, { kind: 'glass', color: 0x9aa3a6, opacity: 0.32 }],
  [/^Glass__Tempered/, { kind: 'glass', color: 0xdff4ee, opacity: 0.12 }],
  [/^Glass__Bronze/, { kind: 'glass', color: 0xc9bcae, opacity: 0.22 }],
  [/^Color_-_Ice/, { roughness: 0.85 }],
  [/^GunMetal_Glass/, { roughness: 0.15, metalness: 0.4 }],
  [/^Mirror/, { kind: 'mirror' }],
  [/^(Metal_Chrome|RUBINETTERIA|Nickel_Polished|Tin_Polished|LAVABO_TAPPO)/, { roughness: 0.12, metalness: 1 }],
  [/^(Stainless_Steel|Appliance_Stainl|Metal__Aluminum)/, { roughness: 0.3, metalness: 0.9 }],
  [/^Metal__Brass/, { roughness: 0.2, metalness: 1 }],
  [/^(Cooktop|Appliance_Black)/, { roughness: 0.08, metalness: 0.2 }],
  [/^(Vittkakel|Ivory|Material_2|Appliance_White)/, { roughness: 0.18, metalness: 0 }], // seramik/emaye
  [/^(Granite|SoapStone|Aqua_Mosaic)/, { roughness: 0.35 }],
  [/^(Oak|White_Oak|Hickory|Plank|CVOW02)/, { roughness: 0.55 }],
  [/^(Green_Carpet|Twill|Camouflage|Denim|Textile)/, { roughness: 0.95, sheen: true }],
  [/^Leather/, { roughness: 0.5 }],
  [/^(Concrete|Sheet__Plasterbo|White|Color_Off_White|DEFAULT|Vanilj)/, { roughness: 0.9 }],
];

export function enhanceMaterials(root, renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const mirrors = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    if (m.map) {
      m.map.anisotropy = Math.min(8, maxAniso);
      m.map.colorSpace = THREE.SRGBColorSpace;
    }
    // Sketchfab dışa aktarımı varsayılan olarak metalness=1 bırakabiliyor
    m.metalness = 0;
    m.roughness = 0.8;
    m.envMapIntensity = 0.6;

    const rule = RULES.find(([re]) => re.test(m.name));
    if (!rule) return;
    const r = rule[1];
    if (r.kind === 'glass') {
      m.transparent = true;
      m.opacity = r.opacity;
      m.color.set(r.color);
      m.roughness = 0.05;
      m.metalness = 0.1;
      m.envMapIntensity = 1.4;
      m.depthWrite = false;
      m.side = THREE.DoubleSide;
      o.castShadow = false;
      o.renderOrder = 2;
    } else if (r.kind === 'mirror') {
      mirrors.push(o);
    } else {
      if (r.roughness !== undefined) m.roughness = r.roughness;
      if (r.metalness !== undefined) m.metalness = r.metalness;
      if (r.metalness) m.envMapIntensity = 1.1;
    }
  });
  return { mirrors };
}

// ---------- 2) Ayna: gerçek düzlemsel yansıma ----------
// Aynalar banyoların batı duvarında (x = -8571.3), +x yönüne bakıyor.
const MIRROR_PANELS = [
  { y0: -72, y1: 17, z0: 91.3, z1: 211.3, room: 'bath1' },
  { y0: 325, y1: 424, z0: 91.3, z1: 211.3, room: 'bath2' },
];

export function buildMirrors(scene, mirrorMeshes) {
  mirrorMeshes.forEach((m) => {
    m.material.color.set(0x222222);
    m.material.roughness = 0.1;
  });
  return MIRROR_PANELS.map((p) => {
    const w = (p.y1 - p.y0) / 100;
    const h = (p.z1 - p.z0) / 100;
    const ref = new Reflector(new THREE.PlaneGeometry(w, h), {
      textureWidth: 512,
      textureHeight: 512 * (h / w),
      color: 0xb8bcbc,
      clipBias: 0.003,
    });
    ref.position.copy(P(-8571.0, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2));
    ref.rotation.y = Math.PI / 2; // +x yönüne bak
    ref.userData.room = p.room;
    ref.visible = false;
    scene.add(ref);
    return ref;
  });
}

// ---------- 3) Eksik tavan + gömme spot armatürler ----------
export const LIGHTS = [
  // [x, y, oda] — 3ds koordinatları (cm)
  [-8010, 250, 'living'],
  [-8010, -40, 'living'],
  [-8268, -58, 'dining'],
  [-8310, 300, 'kitchen'],
  [-8480, -70, 'bath1'],
  [-8480, 150, 'corridor'],
  [-8510, 390, 'bath2'],
  [-8750, 330, 'bed1'],
  [-8750, -10, 'bed2'],
];
const CEIL_Z = 244;

export function buildCeiling(scene) {
  const group = new THREE.Group();
  group.name = 'GeneratedCeiling';

  // Dairenin dış duvar sınırları (3ds): x -8941..-7839, y -189..532
  const a = P(-8941, -189, CEIL_Z);
  const b = P(-7839, 532, CEIL_Z);
  const w = Math.abs(b.x - a.x);
  const d = Math.abs(b.z - a.z);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.95, side: THREE.FrontSide })
  );
  // Plane varsayılan olarak +z'ye bakar → aşağıya (-y) baksın. Yukarıdan bakınca görünmez.
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set((a.x + b.x) / 2, CEIL_Z / 100, (a.z + b.z) / 2);
  ceil.receiveShadow = true;
  group.add(ceil);

  // Gömme spotlar + ışıklar
  const discGeo = new THREE.CircleGeometry(0.07, 32);
  const ringGeo = new THREE.RingGeometry(0.07, 0.085, 32);
  const discMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 3 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, metalness: 0.6, roughness: 0.3 });
  const lights = [];
  LIGHTS.forEach(([x, y, room]) => {
    const pos = P(x, y, CEIL_Z - 0.3);
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.copy(pos);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(pos);
    group.add(disc, ring);

    const light = new THREE.PointLight(0xffe2bd, 2.2, 6.5, 1.6);
    light.position.copy(P(x, y, CEIL_Z - 20));
    light.userData.room = room;
    group.add(light);
    lights.push(light);
  });

  scene.add(group);
  return { group, lights };
}

// ---------- 4) Gün ışığı ----------
export function buildDaylight(scene) {
  const hemi = new THREE.HemisphereLight(0xfaf4ea, 0x6e604f, 0.65);
  scene.add(hemi);

  // Güney cephesi (3ds -y) = dünya +z. Güneş güneybatıdan, yüksekten.
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(-4, 9, 8);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const s = sun.shadow.camera;
  s.left = -8; s.right = 8; s.top = 8; s.bottom = -8; s.near = 1; s.far = 30;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return { hemi, sun };
}

// ---------- 5) Dış zemin ----------
export function buildGround(scene) {
  const g = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshStandardMaterial({ color: 0x1a1815, roughness: 1 })
  );
  g.rotation.x = -Math.PI / 2;
  g.position.y = -0.3;
  g.receiveShadow = true;
  scene.add(g);
  return g;
}
