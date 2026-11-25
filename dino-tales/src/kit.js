// Shared story helpers: hearts, dizzy stars, footstep cues, walk paths
import { THREE, scene, add, mat, geo, clamp, lerp, E, seg, hash, makeEmote, track } from './engine.js';

// rising hearts burst: update(t, bursts=[[t0,[x,y,z]],...])
export function makeHearts(n = 7) {
  const hs = []; for (let i = 0; i < n; i++) { const m = add(scene, geo.heart, mat('#ff4d7a', { r: 0.35, e: '#ff2a5a', ei: 0.35 }), [0, 0, 0], 0.1, [0, 0, 0], { shadow: false }); m.visible = false; hs.push(m); }
  return {
    update(t, bursts) {
      hs.forEach((m) => (m.visible = false));
      for (const [t0, p, s = 1] of bursts) {
        const lt = t - t0; if (lt < 0 || lt > 2.2) continue;
        hs.forEach((m, i) => {
          const d = lt - i * 0.12; if (d < 0) return;
          const l = d / 1.8; if (l > 1) return;
          m.visible = true;
          const a = i * 2.4;
          m.position.set(p[0] + Math.cos(a) * 0.35 * s * l + Math.sin(d * 5 + i) * 0.06, p[1] + d * 0.9 * s, p[2] + Math.sin(a) * 0.35 * s * l);
          m.scale.setScalar(0.12 * s * E.back(clamp(d / 0.3)) * (1 - clamp((l - 0.7) / 0.3)));
          m.rotation.set(0, Math.sin(d * 3 + i) * 0.5, Math.sin(d * 4 + i) * 0.2);
        });
      }
    },
  };
}

// dizzy stars circling a head
export function makeDizzy(n = 3) {
  const st = Array.from({ length: n }, () => makeEmote('star'));
  return { update(t, on, p, r = 0.35, size = 0.22) { st.forEach((e, i) => { const a = t * 6 + i * Math.PI * 2 / n; e.set(on, [p[0] + Math.cos(a) * r, p[1] + 0.05 * Math.sin(a * 2), p[2] + Math.sin(a) * r], size); }); } };
}

// footstep cue times for phase = t*freq walking between t0 and t1
export function stepCues(cues, t0, t1, freq, type = 'step', gain = 1, pan = 0) {
  const k0 = Math.ceil(t0 * freq / Math.PI), k1 = Math.floor(t1 * freq / Math.PI);
  for (let k = k0; k <= k1; k++) cues.push({ type, t: +(k * Math.PI / freq).toFixed(3), gain: gain * (0.85 + hash(k) * 0.3), pan });
}

// path from keyframes [[t,[x,z]],...]: position, walk amount from speed
export function walkPath(keys, nominal = 1.2) {
  const f = track(keys);
  return {
    pos: (t, y = 0) => { const [x, z] = f(t); return [x, y, z]; },
    speed: (t) => { const a = f(t - 0.05), b = f(t + 0.05); return Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1; },
    walk(t) { return clamp(this.speed(t) / nominal); },
    heading(t) { const a = f(t - 0.05), b = f(t + 0.05); return Math.atan2(b[0] - a[0], b[1] - a[1]); },
  };
}

// angle helpers
export const face = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);
// a cue list builder
export function cueList() {
  const L = [];
  L.at = (t, type, o = {}) => { L.push({ type, t: +t.toFixed(3), ...o }); return L; };
  return L;
}
