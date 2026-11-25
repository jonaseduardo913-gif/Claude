// Loads story ?s=N and exposes renderFrame(f) for the headless renderer.
import * as E from './engine.js';

window.__ready = (async () => {
  await Promise.all([document.fonts.load('80px "Luckiest Guy"'), document.fonts.load('600 50px Fredoka')]);
  const id = new URLSearchParams(location.search).get('s') || '1';
  const mod = await import(`./story${id}.js`);
  const glc = E.init();
  const story = mod.build();
  const out = document.getElementById('out'); const ctx = out.getContext('2d');
  window.FRAMES = Math.round(story.duration * E.FPS);
  window.CUES = story.cues;
  const draw = (f) => {
    const t = f / E.FPS;
    story.frame(t);
    E.renderer.render(E.scene, E.camera);
    ctx.globalAlpha = 1; ctx.drawImage(glc, 0, 0);
    E.vignette(ctx, 0.32);
    if (story.overlay) story.overlay(ctx, t);
    if (story.title) E.drawTitle(ctx, t, story.title);
    const cap = story.caps.find((c) => t >= c.t0 && t < c.t1);
    E.drawCaption(ctx, cap, t);
    if (story.endAt) E.drawEnd(ctx, t, story.endAt);
    // fades to/from black
    let k = 0;
    for (const [a, b, dir] of story.fades || []) if (t >= a && t <= b) k = Math.max(k, dir === 'in' ? 1 - (t - a) / (b - a) : (t - a) / (b - a));
    if (t > story.duration - 0.05) k = 1;
    if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${E.clamp(k)})`; ctx.fillRect(0, 0, E.W, E.H); }
  };
  window.renderFrame = (f, q = 0.93) => { draw(f); return out.toDataURL('image/jpeg', q); };
  window.renderFramePNG = (f) => { draw(f); return out.toDataURL('image/png'); };
})();
