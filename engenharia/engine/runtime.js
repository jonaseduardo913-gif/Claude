// Browser-side renderer. Loads /episodes/<ep>/scene.js and exposes window.renderFrame().
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as kit from './kit.js';

export async function boot(ep, { width, height }) {
  await Promise.all(['800 72px Inter', '600 72px Inter'].map(f => document.fonts.load(f)));

  const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.02, 200);

  const rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.28, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(kit.GradeShader);
  composer.addPass(grade);

  const ctx = { THREE, kit, scene, camera, renderer, width, height, bloom, grade };
  ctx.studio = kit.makeStudio(renderer, scene);
  ctx.cut = new kit.Cutaway(scene);

  const mod = await import(`/episodes/${ep}/scene.js`);
  const show = await mod.build(ctx);

  window.renderFrame = (sceneId, t, dur, frame) => {
    grade.uniforms.seed.value = frame % 997;
    grade.uniforms.fade.value = 0;
    show.reset?.();
    const fn = show.scenes[sceneId];
    if (!fn) throw new Error('no scene ' + sceneId);
    fn(t, dur);
    for (const l of ctx.labels || []) l.update();
    composer.render();
    return renderer.domElement.toDataURL('image/jpeg', 0.94);
  };
  window.SCENE_IDS = Object.keys(show.scenes);
}
