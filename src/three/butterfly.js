import * as THREE from 'three';

const wingVertex = /* glsl */ `
varying vec2 vPos;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  vPos = position.xy;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const wingFragment = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uRim;
uniform float uTime;
uniform float uOpacity;
uniform float uRimStrength;
uniform float uReach;
varying vec2 vPos;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  // Radial coordinates from the hinge: r for the gradient, angle for the veins.
  float r = length(vPos) / uReach;
  float a = atan(vPos.y, vPos.x);

  vec3 base = mix(uColorB, uColorA, smoothstep(0.05, 0.75, r));
  float veins = smoothstep(0.93, 1.0, abs(sin(a * 9.0))) * smoothstep(0.12, 0.35, r);
  base *= 1.0 - veins * 0.28;

  // Pale spots along the outer edge, like a real wing pattern.
  float spots = smoothstep(0.55, 0.0, abs(sin(a * 7.0 + 0.6))) * smoothstep(0.78, 0.9, r) * (1.0 - smoothstep(0.93, 1.0, r));
  base = mix(base, vec3(1.0, 0.93, 0.88), spots * 0.55);

  // Mint edge glow, stronger when the wing turns edge-on (iridescent shimmer).
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewPos);
  float facing = abs(dot(n, v));
  float fresnel = pow(1.0 - facing, 2.0);
  float edge = smoothstep(0.82, 1.02, r);
  float shimmer = 0.5 + 0.5 * sin(uTime * 1.3 + r * 6.0);
  vec3 color = base * (0.55 + 0.45 * facing) + uRim * (fresnel * 0.9 + edge * 0.6 * shimmer) * uRimStrength;

  gl_FragColor = vec4(color, uOpacity);
  #include <colorspace_fragment>
}
`;

/** Right forewing outline; the hinge (body) sits at x = 0. */
function forewingShape() {
  const s = new THREE.Shape();
  s.moveTo(0.04, 0.02);
  s.bezierCurveTo(0.2, 0.55, 0.62, 1.02, 1.02, 0.98);
  s.bezierCurveTo(1.22, 0.95, 1.2, 0.62, 1.06, 0.45);
  s.bezierCurveTo(0.9, 0.22, 0.55, 0.06, 0.04, -0.04);
  return s;
}

/** Right hindwing outline. */
function hindwingShape() {
  const s = new THREE.Shape();
  s.moveTo(0.04, -0.02);
  s.bezierCurveTo(0.45, 0.02, 0.86, -0.12, 0.84, -0.5);
  s.bezierCurveTo(0.82, -0.82, 0.48, -0.98, 0.3, -0.86);
  s.bezierCurveTo(0.14, -0.74, 0.06, -0.4, 0.04, -0.02);
  return s;
}

/**
 * Procedural butterfly: two wing pairs on hinges plus a slim body.
 * Exposes the same uniform names the old blob used, so scenes keep working:
 * - uAmp: flap reach (radians = 0.35 + uAmp * 3)
 * - uFreq: flap rate (Hz = 0.9 + uFreq * 1.6)
 * - uRimStrength: mint edge glow
 * - uOpacity: fade
 * Call `flap(time, boost)` every frame; `boost` (0..1.5) speeds the wings up.
 */
export function createButterfly({ radius = 1, amp = 0.2, freq = 0.75, palette }) {
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: amp },
    uFreq: { value: freq },
    uRimStrength: { value: 0.6 },
    uOpacity: { value: 1 },
    uReach: { value: 1.15 },
    uColorA: { value: new THREE.Color(palette.coral) },
    uColorB: { value: new THREE.Color(palette.coralDeep) },
    uRim: { value: new THREE.Color(palette.mint) },
  };
  const wingMaterial = new THREE.ShaderMaterial({
    vertexShader: wingVertex,
    fragmentShader: wingFragment,
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: palette.coralDeep, transparent: true });

  const fore = new THREE.ShapeGeometry(forewingShape(), 28);
  const hind = new THREE.ShapeGeometry(hindwingShape(), 28);

  const mesh = new THREE.Group();
  const tilt = new THREE.Group(); // fixed 3/4 view so both wings read
  tilt.rotation.set(-0.55, 0, 0.25);
  tilt.scale.setScalar(radius);
  mesh.add(tilt);

  const makeSide = (dir) => {
    const foreHinge = new THREE.Group();
    const hindHinge = new THREE.Group();
    const f = new THREE.Mesh(fore, wingMaterial);
    const h = new THREE.Mesh(hind, wingMaterial);
    f.scale.x = dir;
    h.scale.x = dir;
    foreHinge.add(f);
    hindHinge.add(h);
    tilt.add(foreHinge, hindHinge);
    return { foreHinge, hindHinge, dir };
  };
  const sides = [makeSide(1), makeSide(-1)];

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.62, 4, 10), bodyMaterial);
  body.position.y = 0.02;
  tilt.add(body);

  // Antennae: two thin curved lines.
  const antennaGeo = new THREE.BufferGeometry().setFromPoints(
    new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.36, 0), new THREE.Vector3(0.08, 0.6, 0.02), new THREE.Vector3(0.2, 0.7, 0)).getPoints(12)
  );
  const antennaMat = new THREE.LineBasicMaterial({ color: palette.coral, transparent: true });
  [1, -1].forEach((dir) => {
    const line = new THREE.Line(antennaGeo, antennaMat);
    line.scale.x = dir;
    tilt.add(line);
  });

  let phase = 0;
  let last = 0;

  return {
    mesh,
    uniforms,
    /** Advances the wing beat. Wings open wide and close quickly, like a real stroke. */
    flap(time, boost = 0) {
      const dt = Math.min(0.1, Math.max(0, time - last));
      last = time;
      const rate = (0.9 + uniforms.uFreq.value * 1.6) * (1 + boost);
      phase += dt * rate * Math.PI * 2;
      const reach = 0.35 + uniforms.uAmp.value * 3;
      const stroke = Math.sin(phase);
      const angle = 0.25 + reach * (0.5 + 0.5 * Math.sign(stroke) * Math.pow(Math.abs(stroke), 0.7));
      const lag = 0.25 + reach * (0.5 + 0.5 * Math.sin(phase - 0.35));
      sides.forEach(({ foreHinge, hindHinge, dir }) => {
        foreHinge.rotation.y = -dir * angle;
        hindHinge.rotation.y = -dir * lag * 0.92;
      });
      // Body bobs against the stroke.
      tilt.position.y = -Math.sin(phase) * 0.05 * radius;
      bodyMaterial.opacity = uniforms.uOpacity.value;
      antennaMat.opacity = uniforms.uOpacity.value;
    },
  };
}
