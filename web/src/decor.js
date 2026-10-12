import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { P } from './rooms.js';

/*
 * Evi renkli, modern ve sıcak hale getiren dekor katmanı:
 *  1) Odalara göre pastel duvar boyası (konuma bağlı shader)
 *  2) Mevcut mobilyaların yeniden renklendirilmesi
 *  3) Kodla üretilen dekor: bitkiler, yastıklar, halılar, lambalar, tablolar, vazolar
 */

export const PALETTE = {
  coral: 0xef6f5e,
  peach: 0xf7b49a,
  mustard: 0xf2b134,
  teal: 0x2a9d8f,
  deepTeal: 0x22686e,
  pink: 0xf4a6b8,
  rose: 0xe9798e,
  lilac: 0xb9a5e6,
  sky: 0x7fbde8,
  cream: 0xfaf0dc,
  leaf: 0x3f9b5a,
  leafLight: 0x67b96f,
  terracotta: 0xc8643f,
  gold: 0xd4a64a,
};

// ---------------------------------------------------------------- 1) duvar boyası
// [x0, y0, x1, y1, renk] — 3ds koordinatları (cm). İlk eşleşen bölge kazanır.
const WALL_ZONES = [
  [-7895, 120, -7800, 445, 0xe58a6c], // kanepe arkası vurgu duvarı (terrakota)
  [-8378, -400, -7800, 900, 0xf7dccf], // açık plan yaşam alanı (şeftali-pembe)
  [-8578, 30, -8378, 268, 0xf8e6a6], // koridor (tereyağı sarısı)
  [-8578, -400, -8378, 30, 0xcdeee0], // ana banyo (nane)
  [-8578, 268, -8378, 900, 0xcfe5f7], // ikinci banyo (gök mavisi)
  [-9100, 145, -8578, 900, 0xdcd2f3], // yatak odası I (lila)
  [-9100, -400, -8578, 145, 0xd3ead0], // yatak odası II (adaçayı)
];

function paintWalls(material) {
  const rects = WALL_ZONES.map(([x0, y0, x1, y1]) => {
    const a = P(x0, y0, 0);
    const b = P(x1, y1, 0);
    return new THREE.Vector4(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z));
  });
  const cols = WALL_ZONES.map((z) => new THREE.Color(z[4]));
  const n = WALL_ZONES.length;
  material.color.set(0xffffff);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.zoneRect = { value: rects };
    shader.uniforms.zoneCol = { value: cols };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWorldP;
uniform vec4 zoneRect[${n}];
uniform vec3 zoneCol[${n}];`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 tint = vec3(1.0);
  for (int i = ${n - 1}; i >= 0; i--) {
    vec4 r = zoneRect[i];
    if (vWorldP.x >= r.x && vWorldP.x <= r.z && vWorldP.z >= r.y && vWorldP.z <= r.w) tint = zoneCol[i];
  }
  // Süpürgelik hizasının altı beyaz kalsın
  if (vWorldP.y < 0.09) tint = vec3(1.0);
  diffuseColor.rgb *= tint;
}`);
  };
  material.customProgramCacheKey = () => 'painted-walls';
  material.needsUpdate = true;
}

// ---------------------------------------------------------------- 2) mobilya renkleri
const RECOLOR = {
  Green_Carpet: { color: 0xf0a92e, roughness: 0.85, map: null, sheen: 0xffe2a0 }, // kanepe → hardal kadife
  Leatherolive: { color: 0xd8693f, roughness: 0.45, map: null }, // sandalyeler → terrakota deri
  'Oak230--PAINTE': { color: PALETTE.deepTeal, roughness: 0.4 }, // kitaplık → derin petrol mavisi
  Twill_Forest: { color: PALETTE.teal, map: null }, // halı kenarı
  'Color_-_Uniform': { color: PALETTE.rose, roughness: 0.9 }, // yatak örtüleri → gül
  'Color_-_Ice': { color: 0xfff6ea, roughness: 0.9 }, // çarşaflar → krem
  Denimblack: { color: PALETTE.lilac, map: null, roughness: 0.9 },
  Charcoal: { color: PALETTE.sky, roughness: 0.5 }, // komodinler
  'Granite-Tiles': { color: 0xd6f1ea, roughness: 0.3 }, // banyo karoları → açık su yeşili
  SoapStone_Tile: { color: 0xf3e2ee, roughness: 0.3 },
};

function recolor(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m.name === 'Sheet__Plasterbo') paintWalls(m);
    if (m.name === 'Camouflage_Texti') {
      m.map = rugTexture([PALETTE.cream, PALETTE.coral, PALETTE.mustard, PALETTE.teal, PALETTE.pink], 'rings');
      m.color.set(0xffffff);
      m.roughness = 1;
      m.needsUpdate = true;
    }
    const r = RECOLOR[m.name];
    if (!r) return;
    if (r.sheen) {
      const phys = new THREE.MeshPhysicalMaterial({
        name: m.name, color: r.color, roughness: r.roughness,
        sheen: 1, sheenColor: new THREE.Color(r.sheen), sheenRoughness: 0.45,
      });
      o.material = phys;
      return;
    }
    if ('map' in r) m.map = r.map;
    m.color.set(r.color);
    if (r.roughness !== undefined) m.roughness = r.roughness;
    m.needsUpdate = true;
  });
}

// ---------------------------------------------------------------- yardımcılar
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const hex = (c) => `#${new THREE.Color(c).getHexString()}`;

function rugTexture(colors, style) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = hex(colors[0]);
    g.fillRect(0, 0, w, h);
    if (style === 'rings') {
      for (let i = 9; i > 0; i--) {
        g.beginPath();
        g.arc(w / 2, h / 2, (i / 9) * w * 0.48, 0, Math.PI * 2);
        g.fillStyle = hex(colors[i % colors.length]);
        g.fill();
      }
      g.fillStyle = hex(colors[0]);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        g.beginPath();
        g.arc(w / 2 + Math.cos(a) * w * 0.37, h / 2 + Math.sin(a) * h * 0.37, 7, 0, Math.PI * 2);
        g.fill();
      }
    } else if (style === 'stripes') {
      const n = 11;
      for (let i = 0; i < n; i++) {
        g.fillStyle = hex(colors[i % colors.length]);
        g.fillRect(0, (i / n) * h, w, h / n + 1);
      }
      g.strokeStyle = hex(colors[0]);
      g.lineWidth = 6;
      for (let x = -h; x < w; x += 40) {
        g.beginPath();
        g.moveTo(x, h);
        g.lineTo(x + 20, h - 20);
        g.stroke();
      }
    } else {
      // memphis: renkli şekiller
      const rnd = mulberry(7);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = hex(colors[1 + (i % (colors.length - 1))]);
        const x = rnd() * w;
        const y = rnd() * h;
        const s = 12 + rnd() * 26;
        g.save();
        g.translate(x, y);
        g.rotate(rnd() * Math.PI);
        if (i % 3 === 0) { g.beginPath(); g.arc(0, 0, s / 2, 0, Math.PI * 2); g.fill(); }
        else if (i % 3 === 1) { g.fillRect(-s / 2, -s / 6, s, s / 3); }
        else { g.beginPath(); g.moveTo(0, -s / 2); g.lineTo(s / 2, s / 2); g.lineTo(-s / 2, s / 2); g.fill(); }
        g.restore();
      }
    }
  });
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function artTexture(seed, bg, colors) {
  const rnd = mulberry(seed);
  return canvasTex(400, 500, (g, w, h) => {
    g.fillStyle = hex(bg);
    g.fillRect(0, 0, w, h);
    // büyük kemer
    g.fillStyle = hex(colors[0]);
    g.beginPath();
    const ax = w * (0.3 + rnd() * 0.4);
    g.arc(ax, h * 0.72, w * 0.32, Math.PI, 0);
    g.lineTo(ax + w * 0.32, h);
    g.lineTo(ax - w * 0.32, h);
    g.fill();
    // güneş
    g.fillStyle = hex(colors[1]);
    g.beginPath();
    g.arc(w * (0.2 + rnd() * 0.6), h * (0.18 + rnd() * 0.2), w * (0.1 + rnd() * 0.08), 0, Math.PI * 2);
    g.fill();
    // dalga
    g.strokeStyle = hex(colors[2]);
    g.lineWidth = 14;
    g.lineCap = 'round';
    g.beginPath();
    const y0 = h * (0.45 + rnd() * 0.1);
    for (let x = 30; x <= w - 30; x += 6) g.lineTo(x, y0 + Math.sin(x / 28 + seed) * 16);
    g.stroke();
    // yaprak / organik şekil
    g.fillStyle = hex(colors[3] ?? colors[0]);
    g.beginPath();
    g.ellipse(w * (0.2 + rnd() * 0.6), h * 0.86, 46, 22, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
    // noktalar
    g.fillStyle = '#2b2a28';
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.arc(40 + (i % 4) * 16, 40 + Math.floor(i / 4) * 16, 3.2, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// cm cinsinden yerleştirme: 3ds (x, y, z) → dünya
function place(obj, x, y, z, rotY = 0) {
  obj.position.copy(P(x, y, z));
  obj.rotation.y = rotY;
  return obj;
}
const cm = (v) => v / 100;

function shadowed(o) {
  o.traverse((c) => {
    if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
  });
  return o;
}

// ---------------------------------------------------------------- 3) dekor objeleri
function cushion(color, w = 45, h = 45, d = 14) {
  const geo = new RoundedBoxGeometry(cm(w), cm(h), cm(d), 4, cm(6));
  // Ortası kabarık, kenarları basık yastık
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / cm(w / 2);
    const y = p.getY(i) / cm(h / 2);
    const k = Math.max(0.35, 1 - 0.55 * (x * x + y * y) / 2);
    p.setZ(i, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 0.8, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6 }));
}

function leafGeometry() {
  // Monstera benzeri kalp formlu yaprak
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.09, 0.02, 0.13, 0.12, 0.1, 0.2);
  s.bezierCurveTo(0.07, 0.27, 0.02, 0.29, 0, 0.26);
  s.bezierCurveTo(-0.02, 0.29, -0.07, 0.27, -0.1, 0.2);
  s.bezierCurveTo(-0.13, 0.12, -0.09, 0.02, 0, 0);
  const g = new THREE.ShapeGeometry(s, 10);
  // Hafif kıvrım
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, -x * x * 3 + y * 0.25);
  }
  g.computeVertexNormals();
  return g;
}
const LEAF = leafGeometry();

function plant({ height = 110, pot = PALETTE.terracotta, leaves = 11, seed = 3, potH = 34, potR = 17, scale = 1, leafScale = 1, spread = 1 } = {}) {
  const rnd = mulberry(seed);
  const g = new THREE.Group();
  const prof = [
    new THREE.Vector2(0, 0), new THREE.Vector2(cm(potR * 0.72), 0), new THREE.Vector2(cm(potR), cm(potH * 0.92)),
    new THREE.Vector2(cm(potR * 1.04), cm(potH)), new THREE.Vector2(cm(potR * 0.95), cm(potH)),
  ];
  const potMesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), mat(pot, { roughness: 0.55 }));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(cm(potR * 0.95), 24), mat(0x4a3426, { roughness: 1 }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = cm(potH * 0.94);
  g.add(potMesh, soil);

  const stemMat = mat(0x4f8a3c);
  const leafMats = [mat(PALETTE.leaf, { side: THREE.DoubleSide, roughness: 0.5 }), mat(PALETTE.leafLight, { side: THREE.DoubleSide, roughness: 0.5 })];
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + rnd() * 0.5;
    const len = cm(height - potH) * (0.55 + rnd() * 0.45);
    const tilt = (0.25 + rnd() * 0.45) * spread;
    const stem = new THREE.Group();
    stem.position.y = cm(potH * 0.9);
    stem.rotation.y = a;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, len, 5), stemMat);
    s.position.y = len / 2;
    const arm = new THREE.Group();
    arm.rotation.z = tilt;
    arm.add(s);
    const leaf = new THREE.Mesh(LEAF, leafMats[i % 2]);
    const ls = (1.1 + rnd() * 0.9) * leafScale;
    leaf.scale.setScalar(ls);
    leaf.position.y = len;
    leaf.rotation.set(-0.6 - rnd() * 0.5, 0, Math.PI / 2 + (rnd() - 0.5) * 0.6);
    arm.add(leaf);
    stem.add(arm);
    g.add(stem);
  }
  g.scale.setScalar(scale);
  return shadowed(g);
}

function floorLamp(shadeColor) {
  const g = new THREE.Group();
  const brass = mat(PALETTE.gold, { metalness: 1, roughness: 0.25 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(cm(15), cm(16), cm(2.5), 32), brass);
  base.position.y = cm(1.25);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(cm(1), cm(1), cm(150), 12), brass);
  pole.position.y = cm(75);
  const shade = new THREE.Mesh(
    new THREE.SphereGeometry(cm(22), 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(shadeColor, { side: THREE.DoubleSide, roughness: 0.4 })
  );
  shade.position.y = cm(152);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(cm(6), 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 4 }));
  bulb.position.y = cm(146);
  const light = new THREE.PointLight(0xffc98a, 1.6, 4, 1.8);
  light.position.y = cm(140);
  g.add(base, pole, shade, bulb, light);
  return shadowed(g);
}

function pendant(color, dropTo) {
  const g = new THREE.Group();
  const ceilingY = cm(244);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, ceilingY - cm(dropTo + 18), 6), mat(0x222222));
  cord.position.y = (ceilingY + cm(dropTo + 18)) / 2;
  const shade = new THREE.Mesh(
    new THREE.SphereGeometry(cm(24), 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(color, { side: THREE.DoubleSide, roughness: 0.35 })
  );
  shade.position.y = cm(dropTo);
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(cm(23.5), 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: 0xffe0b0, emissiveIntensity: 0.9, side: THREE.BackSide })
  );
  inner.position.y = cm(dropTo);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(cm(5), 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 5 }));
  bulb.position.y = cm(dropTo + 2);
  const light = new THREE.PointLight(0xffd2a0, 2.6, 5, 1.6);
  light.position.y = cm(dropTo - 6);
  shade.castShadow = true;
  g.add(cord, shade, inner, bulb, light);
  return g;
}

function artPiece(seed, w, h, bg, colors, frame = 0xf3eadb) {
  const g = new THREE.Group();
  const fr = new THREE.Mesh(new THREE.BoxGeometry(cm(w + 4), cm(h + 4), cm(2.5)), mat(frame, { roughness: 0.5 }));
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(cm(w), cm(h)), new THREE.MeshStandardMaterial({ map: artTexture(seed, bg, colors), roughness: 0.85 }));
  canvas.position.z = cm(1.3);
  g.add(fr, canvas);
  return shadowed(g);
}

function rug(w, d, colors, style, round = false) {
  const tex = rugTexture(colors, style);
  const geo = round ? new THREE.CircleGeometry(cm(w / 2), 64) : new THREE.PlaneGeometry(cm(w), cm(d));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

function coffeeTable(color) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(cm(38), cm(38), cm(3), 48), mat(color, { roughness: 0.3 }));
  top.position.y = cm(40);
  g.add(top);
  const brass = mat(PALETTE.gold, { metalness: 1, roughness: 0.3 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(cm(1.2), cm(1.2), cm(39), 10), brass);
    leg.position.set(Math.cos(a) * cm(26), cm(19.5), Math.sin(a) * cm(26));
    g.add(leg);
  }
  // Üstünde kitaplar + küçük vazo
  const bookCols = [PALETTE.coral, PALETTE.teal, PALETTE.mustard];
  bookCols.forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(cm(22 - i * 2), cm(3), cm(16 - i)), mat(c, { roughness: 0.7 }));
    b.position.set(cm(-10), cm(43 + i * 3), cm(4));
    b.rotation.y = i * 0.25;
    g.add(b);
  });
  const vz = vase(PALETTE.sky, 20, [PALETTE.pink, PALETTE.mustard]);
  vz.position.set(cm(14), cm(41.5), cm(-6));
  g.add(vz);
  return shadowed(g);
}

function vase(color, height, flowerCols) {
  const g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    prof.push(new THREE.Vector2(cm(4 + Math.sin(t * Math.PI) * 4 - t * 2), cm(t * height)));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), mat(color, { roughness: 0.2 }));
  g.add(body);
  const stemMat = mat(0x4f8a3c);
  const rnd = mulberry(height);
  for (let i = 0; i < 7; i++) {
    const len = cm(height * 0.9 + rnd() * 14);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, len, 4), stemMat);
    const ax = (rnd() - 0.5) * 0.6;
    const az = (rnd() - 0.5) * 0.6;
    stem.position.set(Math.sin(az) * len / 2, cm(height * 0.6) + len / 2 * Math.cos(ax), Math.sin(ax) * len / 2);
    stem.rotation.set(ax, 0, -az);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(cm(2.6 + rnd() * 1.6), 1), mat(flowerCols[i % flowerCols.length], { roughness: 0.7 }));
    head.position.set(Math.sin(az) * len, cm(height * 0.6) + len * Math.cos(ax), Math.sin(ax) * len);
    g.add(stem, head);
  }
  return g;
}

function throwBlanket(color, w, d) {
  const geo = new RoundedBoxGeometry(cm(w), cm(3), cm(d), 2, cm(1.2));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: rugTexture([color, 0xffffff], 'stripes'), roughness: 0.95 }));
}

function herbPot(color, seed) {
  return plant({ height: 28, potH: 11, potR: 6, leaves: 10, pot: color, seed, leafScale: 0.32, spread: 0.8 });
}

// ---------------------------------------------------------------- yerleşim
export function buildDecor(scene, modelRoot) {
  recolor(modelRoot);
  const g = new THREE.Group();
  g.name = 'Decor';
  const lights = [];

  // --- Oturma alanı
  // Kanepe arkasına dayalı yastıklar (kanepe x -7970..-7869, y 132..373, oturum ~45 cm)
  [[175, PALETTE.coral], [228, PALETTE.teal], [286, PALETTE.pink], [338, PALETTE.cream]].forEach(([y, c], i) => {
    const cu = cushion(c);
    place(cu, -7898, y, 66, -Math.PI / 2);
    cu.rotation.x = 0;
    cu.rotation.z = (i % 2 ? 1 : -1) * 0.12;
    cu.rotateX(-0.25);
    g.add(shadowed(cu));
  });
  g.add(place(rug(190, 190, [PALETTE.cream, PALETTE.mustard, PALETTE.coral, PALETTE.teal, PALETTE.pink], 'rings', true), -8045, 255, 1.6));
  g.add(place(coffeeTable(PALETTE.pink), -8040, 255, 1.6));
  const fl = floorLamp(PALETTE.mustard);
  g.add(place(fl, -7905, 410, 0));
  g.add(place(plant({ height: 140, pot: PALETTE.coral, leaves: 14, seed: 11, potR: 20, potH: 36 }), -8105, 425, 0));
  // Kanepe üstü tablo üçlüsü (doğu duvarı, -x yönüne bakıyor)
  [[195, 11, PALETTE.cream, [PALETTE.coral, PALETTE.mustard, PALETTE.teal, PALETTE.pink]],
   [253, 23, 0xfde3d8, [PALETTE.teal, PALETTE.coral, PALETTE.deepTeal, PALETTE.mustard]],
   [311, 37, PALETTE.cream, [PALETTE.mustard, PALETTE.rose, PALETTE.teal, PALETTE.sky]]].forEach(([y, seed, bg, cols]) => {
    g.add(place(artPiece(seed, 44, 56, bg, cols), -7872, y, 150, -Math.PI / 2));
  });

  // --- Yemek alanı
  g.add(place(pendant(PALETTE.coral, 165), -8268, -58, 0));
  g.add(place(vase(PALETTE.teal, 22, [PALETTE.mustard, PALETTE.pink, PALETTE.coral]), -8268, -58, 75.4));
  g.add(place(plant({ height: 120, pot: PALETTE.mustard, leaves: 12, seed: 5, spread: 0.6 }), -8140, -115, 0));

  // --- Mutfak: tezgâhta fesleğen saksıları, meyve kâsesi
  g.add(place(herbPot(PALETTE.coral, 21), -8240, 288, 92.5));
  g.add(place(herbPot(PALETTE.mustard, 22), -8240, 304, 92.5));
  g.add(place(fruitBowl(), -8235, 160, 92.5));

  // --- Yatak odası I (yatak x -8905..-8800, y 305..495, başı kuzeyde)
  const t1 = throwBlanket(PALETTE.mustard, 112, 48);
  g.add(shadowed(place(t1, -8852, 340, 66)));
  [[-8875, PALETTE.teal], [-8830, PALETTE.peach]].forEach(([x, c]) => {
    const cu = cushion(c, 40, 34, 12);
    place(cu, x, 462, 74, 0);
    cu.rotateX(-0.5);
    g.add(shadowed(cu));
  });
  g.add(place(rug(95, 150, [PALETTE.cream, PALETTE.lilac, PALETTE.pink, PALETTE.sky], 'stripes'), -8745, 395, 1.6));
  g.add(place(artPiece(51, 60, 45, 0xf5ecff, [PALETTE.lilac, PALETTE.mustard, PALETTE.coral, PALETTE.teal]), -8852, 500, 145, 0));
  g.add(place(plant({ height: 100, pot: PALETTE.lilac, leaves: 10, seed: 8, spread: 0.7 }), -8870, 283, 0));

  // --- Yatak odası II (yatak x -8713..-8608, y -110..35)
  const t2 = throwBlanket(PALETTE.teal, 112, 46);
  g.add(shadowed(place(t2, -8660, 10, 66)));
  [[-8685, PALETTE.mustard], [-8638, PALETTE.coral]].forEach(([x, c]) => {
    const cu = cushion(c, 38, 32, 12);
    place(cu, x, -92, 74, Math.PI);
    cu.rotateX(-0.5);
    g.add(shadowed(cu));
  });
  g.add(place(rug(85, 140, [PALETTE.cream, PALETTE.coral, PALETTE.mustard, PALETTE.teal, PALETTE.pink], 'memphis'), -8775, -35, 1.6));
  g.add(place(artPiece(77, 50, 64, 0xeaf6e6, [PALETTE.teal, PALETTE.coral, PALETTE.mustard, PALETTE.pink]), -8584, -40, 150, -Math.PI / 2));
  g.add(place(plant({ height: 110, pot: PALETTE.teal, leaves: 12, seed: 14, spread: 0.6 }), -8750, -115, 0));

  // --- Banyolar: küçük bitkiler
  g.add(place(plant({ height: 55, pot: PALETTE.cream, leaves: 8, seed: 31, potR: 11, potH: 20, leafScale: 0.6, spread: 0.6 }), -8400, 12, 0));

  g.traverse((o) => { if (o.isPointLight) lights.push(o); });
  scene.add(g);
  return { group: g, lights };
}

function fruitBowl() {
  const g = new THREE.Group();
  const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(cm(7), 0), new THREE.Vector2(cm(13), cm(7)), new THREE.Vector2(cm(12.5), cm(7))];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 32), mat(PALETTE.teal, { roughness: 0.25, side: THREE.DoubleSide })));
  const fruits = [[0xff8c2b, 4.2], [0xf2d13a, 4], [0xd8323c, 3.8], [0x8ccf4d, 3.8], [0xff8c2b, 4]];
  fruits.forEach(([c, r], i) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(cm(r), 20, 14), mat(c, { roughness: 0.35 }));
    const a = (i / fruits.length) * Math.PI * 2;
    f.position.set(Math.cos(a) * cm(5.5), cm(6 + (i % 2) * 2), Math.sin(a) * cm(5.5));
    g.add(f);
  });
  return shadowed(g);
}
