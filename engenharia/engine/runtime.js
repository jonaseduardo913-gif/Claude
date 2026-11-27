// Browser-side renderer. Loads /episodes/<ep>/scene.js and exposes window.renderFrame().
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as kit from './kit.js';
import * as lowpoly from './lowpoly.js';

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
  // Replace NaN/Inf pixels before bloom: a single invalid pixel would otherwise be spread by the
  // bloom mip chain into large black rectangles.
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
        gl_FragColor = vec4(clamp(c.rgb, 0.0, 64.0), c.a); }`,
  }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.28, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(kit.GradeShader);
  composer.addPass(grade);

  const mod = await import(`/episodes/${ep}/scene.js`);
  const style = mod.style || 'studio';
  const ctx = { THREE, kit, lowpoly, scene, camera, renderer, width, height, bloom, grade, style };
  if (style === 'lowpoly') {
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    bloom.strength = 0.08;
    grade.uniforms.vignette.value = 0.16;
    grade.uniforms.grain.value = 0.01;
    camera.far = 4000; camera.updateProjectionMatrix();
    ctx.studio = lowpoly.makeSkyStudio(renderer, scene);
  } else {
    ctx.studio = kit.makeStudio(renderer, scene);
  }
  ctx.cut = new kit.Cutaway(scene);
  const show = await mod.build(ctx);

  window.renderFrame = (sceneId, t, dur, frame) => {
    grade.uniforms.seed.value = frame % 997;
    grade.uniforms.fade.value = 0;
    show.reset?.();
    const fn = show.scenes[sceneId];
    if (!fn) throw new Error('no scene ' + sceneId);
    fn(t, dur);
    if (ctx.studio.sky) ctx.studio.sky.position.copy(camera.position);
    ctx.cut.sync();   // sky dome always surrounds the camera
    for (const l of ctx.labels || []) l.update();
    composer.render();
    return renderer.domElement.toDataURL('image/jpeg', 0.94);
  };
  window.SCENE_IDS = Object.keys(show.scenes);
  window.__ctx = ctx;
}
