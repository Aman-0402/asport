import * as THREE from 'three';
import { simplexNoise } from './noise.glsl.js';

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform float uSpeed;
varying vec3 vNormal;
varying vec3 vViewPos;
varying float vDisp;

${simplexNoise}

float displacement(vec3 p) {
  float n = snoise(p * uFreq + vec3(0.0, uTime * uSpeed, uTime * uSpeed * 0.6));
  n += 0.18 * snoise(p * uFreq * 2.1 - vec3(uTime * uSpeed * 0.8));
  return n * uAmp;
}

vec3 orthogonal(vec3 v) {
  return normalize(abs(v.x) > abs(v.z) ? vec3(-v.y, v.x, 0.0) : vec3(0.0, -v.z, v.y));
}

void main() {
  vec3 n = normalize(normal);
  float d = displacement(position);
  vec3 displaced = position + n * d;

  // Recompute the normal from two displaced neighbours so lighting follows the noise.
  float eps = 0.01;
  vec3 t = orthogonal(n);
  vec3 b = normalize(cross(n, t));
  vec3 n1 = position + t * eps;
  vec3 n2 = position + b * eps;
  n1 += n * displacement(n1);
  n2 += n * displacement(n2);
  vec3 dn = normalize(cross(n1 - displaced, n2 - displaced));

  vNormal = normalize(normalMatrix * dn);
  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vViewPos = -mv.xyz;
  vDisp = d;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uRim;
uniform vec3 uLightDir;
uniform float uOpacity;
uniform float uRimStrength;
varying vec3 vNormal;
varying vec3 vViewPos;
varying float vDisp;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewPos);
  vec3 l = normalize(uLightDir);
  float diffuse = max(dot(n, l), 0.0);
  float wrap = diffuse * 0.7 + 0.3;
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.4);
  float spec = pow(max(dot(reflect(-l, n), v), 0.0), 36.0);

  vec3 base = mix(uColorB, uColorA, smoothstep(-0.25, 0.3, vDisp * 2.5 + n.y * 0.4));
  vec3 color = base * wrap + uRim * fresnel * uRimStrength + vec3(spec * 0.45);
  gl_FragColor = vec4(color, uOpacity);
  #include <colorspace_fragment>
}
`;

/** Organic noise-displaced sphere with coral body and mint fresnel rim. */
export function createBlob({ radius = 1, detail = 48, amp = 0.2, freq = 0.75, speed = 0.18, palette }) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: amp },
      uFreq: { value: freq },
      uSpeed: { value: speed },
      uColorA: { value: new THREE.Color(palette.coral) },
      uColorB: { value: new THREE.Color(palette.coralDeep) },
      uRim: { value: new THREE.Color(palette.mint) },
      uRimStrength: { value: 0.6 },
      uLightDir: { value: new THREE.Vector3(0.6, 0.8, 0.9) },
      uOpacity: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(geometry, material);

  return {
    mesh,
    uniforms: material.uniforms,
  };
}
