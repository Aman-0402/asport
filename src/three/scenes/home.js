import * as THREE from 'three';
import { createAmbient } from './ambient.js';

/**
 * Home: the butterfly travels between "stations" as sections scroll by.
 * `target` is tweened by src/pages/home.js; update() eases the butterfly toward it.
 * amp / freq / rim map to wing reach, beat rate and edge glow.
 */
export function create(ctx) {
  const ambient = createAmbient(ctx, {
    butterflies: [
      { position: [2.5, 0.5, -0.5], mobilePosition: [1.2, 2.5, -3.5], radius: 1.3, amp: 0.22 },
      { position: [4.4, -1.6, -2.5], mobilePosition: [-2.4, -3.4, -5], radius: 0.5, amp: 0.16, freq: 1.2 },
    ],
    camera: { from: [0, 0, 7], to: [0, -0.4, 6.4] },
  });

  const hero = ambient.butterflies[0];
  const satellite = ambient.butterflies[1];
  const target = {
    x: hero.base.x,
    y: hero.base.y,
    z: hero.base.z,
    scale: 1,
    amp: 0.22,
    freq: 0.75,
    rim: 0.6,
    // Hidden in the hero (the interactive character lives there); stations fade it in.
    opacity: 0,
    satellite: 0,
  };
  hero.uniforms.uOpacity.value = 0;
  satellite.uniforms.uOpacity.value = 0;
  let synced = false;
  const pos = new THREE.Vector3();
  const baseUpdate = ambient.update;
  const baseResize = ambient.resize;

  return {
    ...ambient,
    target,
    resize(w, h) {
      const keep = hero.base.clone();
      baseResize(w, h);
      if (synced) hero.base.copy(keep);
      else {
        target.x = hero.base.x;
        target.y = hero.base.y;
        target.z = hero.base.z;
      }
    },
    /** Called once the page module has taken control of the stations. */
    sync() {
      synced = true;
    },
    update(state, dt) {
      const k = dt ? 1 - Math.pow(0.04, dt) : 1;
      pos.set(target.x, target.y, target.z);
      hero.base.lerp(pos, k);
      const s = THREE.MathUtils.lerp(hero.mesh.scale.x, target.scale, k);
      hero.mesh.scale.setScalar(s);
      const u = hero.uniforms;
      u.uAmp.value += (target.amp - u.uAmp.value) * k;
      u.uFreq.value += (target.freq - u.uFreq.value) * k;
      u.uRimStrength.value += (target.rim - u.uRimStrength.value) * k;
      u.uOpacity.value += (target.opacity - u.uOpacity.value) * k;
      satellite.uniforms.uOpacity.value += (target.satellite - satellite.uniforms.uOpacity.value) * k;
      satellite.mesh.visible = satellite.uniforms.uOpacity.value > 0.02;
      hero.mesh.visible = u.uOpacity.value > 0.02;
      baseUpdate(state, dt);
    },
  };
}
