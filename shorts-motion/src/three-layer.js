// Thin three.js layer: physically based glossy objects rendered into a
// transparent WebGL canvas and composited between 2D layers.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let renderer, scene, camera;
const pool = {};
let active = new Set();
const geoCache = {};
const GEOS = {
  knot: () => new THREE.TorusKnotGeometry(1, 0.34, 260, 40),
  ico: () => new THREE.IcosahedronGeometry(1, 0),
  sphere: () => new THREE.SphereGeometry(1, 64, 40),
  box: () => new RoundedBoxGeometry(1.6, 1.6, 1.6, 6, 0.22),
  torus: () => new THREE.TorusGeometry(1, 0.3, 48, 160),
  tring: () => new THREE.TorusGeometry(3.2, 0.2, 24, 120),
  capsule: () => new THREE.CapsuleGeometry(0.5, 1.2, 16, 32),
  octa: () => new THREE.OctahedronGeometry(1, 0),
  cone: () => new THREE.ConeGeometry(0.8, 1.6, 64),
  tetra: () => new THREE.TetrahedronGeometry(1, 0),
};
const geo = (t) => (geoCache[t] ||= GEOS[t]());

export const G = {
  async init(W, H) {
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.03).texture;
    camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 7, 8); scene.add(key);
    const rimB = new THREE.PointLight(0x3355ff, 80, 0, 2); rimB.position.set(-6, -3, 3); scene.add(rimB);
    const rimO = new THREE.PointLight(0xff6a00, 70, 0, 2); rimO.position.set(6, 4, 2); scene.add(rimO);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    this.canvas = canvas;
  },
  cam(pos, look, fov = 45) {
    camera.position.set(...pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(...look);
  },
  put(key, type, { p = [0, 0, 0], r = [0, 0, 0], s = 1, color = '#ffffff', metal = false } = {}) {
    let m = pool[key];
    if (!m || m.userData.type !== type) {
      if (m) scene.remove(m);
      const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
      m = new THREE.Mesh(geo(type), mat); m.userData.type = type;
      if (type === 'ico' || type === 'octa' || type === 'tetra') mat.flatShading = true;
      scene.add(m); pool[key] = m;
    }
    m.material.color.set(color);
    m.material.metalness = metal ? 0.95 : 0.15; m.material.roughness = metal ? 0.12 : 0.22;
    m.position.set(...p); m.rotation.set(...r);
    if (typeof s === 'number') m.scale.setScalar(Math.max(1e-4, s)); else m.scale.set(...s);
    active.add(m);
    return m;
  },
  draw(ctx) {
    if (!active.size) return;
    for (const k in pool) pool[k].visible = active.has(pool[k]);
    renderer.render(scene, camera);
    ctx.save(); ctx.setTransform(ctx.getTransform()); ctx.drawImage(renderer.domElement, 0, 0); ctx.restore();
    active = new Set();
  },
};
