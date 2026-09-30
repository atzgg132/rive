/* Ink-on-paper fragment shader. One pass, domain-warped fbm (four warp
   octaves, five for the final density), paper fibre grain, feathered edges.
   Output is premultiplied so the paper shows through wherever there is no ink.
   The same body serves WebGL2 (GLSL ES 3.00) and WebGL1 (GLSL ES 1.00). */

export const VERTEX_BODY = /* glsl */ `
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_PRECISION = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

export const FRAGMENT_BODY = /* glsl */ `
uniform vec2 uRes;
uniform float uTime;
uniform float uFlow;
uniform float uProgress;
uniform float uIntensity;
uniform float uEnergy;
uniform float uHorizon;
uniform float uCalm;
uniform vec2 uPointer;
uniform float uPointerAmt;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);

float fbm4(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = ROT * p;
    a *= 0.5;
  }
  return v;
}

float fbm5(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = ROT * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float pr = uProgress;
  float t = uTime;

  // The pointer leans the flow toward itself; it never adds density.
  vec2 pp = vec2(uPointer.x * asp, uPointer.y);
  vec2 dv = p - pp;
  float pull = exp(-dot(dv, dv) * 5.0) * uPointerAmt;
  vec2 s = p * 1.25 - dv * pull * 0.45;
  s.y += uFlow;

  vec2 q = vec2(fbm4(s + vec2(0.0, t * 0.05)), fbm4(s + vec2(5.2, 1.3) - t * 0.04));
  vec2 r = vec2(
    fbm4(s + 2.6 * q + vec2(1.7, 9.2) + t * 0.07),
    fbm4(s + 2.6 * q + vec2(8.3, 2.8) - t * 0.05)
  );
  float f = fbm5(s + 3.0 * r);

  // Where the ink may gather: a bed that hugs the top edge of the product
  // (uHorizon, in screen height from the bottom) and climbs with it, and on
  // wide screens a cloud in the top-right corner. The copy stays clear.
  float ydist = uv.y - uHorizon - (uv.x - 0.5) * 0.1;
  float m1 = 1.0 - smoothstep(-0.22, 0.26, ydist);
  m1 *= mix(0.78, 1.0, smoothstep(0.0, 0.6, uv.x));

  vec2 c2 = vec2(asp * 1.03, 1.02);
  float d2 = length((p - c2) * vec2(1.0, 1.6));
  float m2 = (1.0 - smoothstep(0.0, mix(0.66, 0.8, pr), d2)) * smoothstep(1.05, 1.6, asp);

  float m = max(m1, m2 * 0.95);
  m = clamp(m + uEnergy * 0.12, 0.0, 1.0);

  float fibre = noise(frag * vec2(0.07, 0.8) + 11.0);
  float speck = noise(frag * 0.85);
  float edge = 0.5 + (speck - 0.5) * 0.05 + (fibre - 0.5) * 0.035;

  float v = f + (m - 0.5) * 0.78 + (r.x - 0.5) * 0.2;
  float body = smoothstep(edge - 0.07, edge + 0.07, v);
  float wash = smoothstep(edge - 0.3, edge, v) * 0.14 * m;
  float core = smoothstep(edge + 0.16, edge + 0.6, v);

  vec3 inkBlue = vec3(0.102, 0.227, 0.561);
  vec3 inkDeep = vec3(0.035, 0.067, 0.122);
  vec3 col = mix(inkBlue, inkDeep, core * (0.65 + 0.35 * r.y));
  col = mix(vec3(0.15, 0.3, 0.68), col, smoothstep(0.0, 0.5, body + wash * 2.0));

  // The corner cloud is a translucent indigo wash, so the nav reads over it.
  float cloudShare = (m2 * 0.95) / (m1 + m2 * 0.95 + 0.0001);
  float rim = smoothstep(edge - 0.02, edge + 0.05, v) * (1.0 - smoothstep(edge + 0.05, edge + 0.2, v));
  col = mix(col, vec3(0.17, 0.4, 0.86), rim * 0.55);

  float a = clamp(max(body * 0.94, wash), 0.0, 1.0) * uIntensity;
  a *= 1.0 - 0.66 * cloudShare;

  // Nothing but the corner wash may sit over the copy. Once the copy has
  // drifted away and faded, the bed is free to climb behind the product.
  float calm = mix(uCalm, 1.1, smoothstep(0.3, 0.75, pr));
  a *= mix(1.0 - smoothstep(calm - 0.06, calm, uv.y), 1.0, cloudShare);

  // Paper grain, faint enough to read only as tooth.
  float grainA = (0.035 + 0.05 * (1.0 - a)) * (speck * 0.6 + fibre * 0.6 - 0.35);
  grainA = max(grainA, 0.0);
  vec3 grainCol = vec3(0.22, 0.17, 0.1);

  float outA = a + grainA * (1.0 - a);
  vec3 rgb = col * a + grainCol * grainA * (1.0 - a);
  float dither = (hash(frag + t) - 0.5) / 255.0;
  outColor = vec4(rgb + dither, outA + dither);
}
`;

export function vertexSource(gl2: boolean): string {
  return gl2
    ? `#version 300 es\nin vec2 aPos;\n${VERTEX_BODY}`
    : `attribute vec2 aPos;\n${VERTEX_BODY}`;
}

export function fragmentSource(gl2: boolean): string {
  return gl2
    ? `#version 300 es${FRAGMENT_PRECISION}out vec4 outColor;\n${FRAGMENT_BODY}`
    : `${FRAGMENT_PRECISION}#define outColor gl_FragColor\n${FRAGMENT_BODY}`;
}
