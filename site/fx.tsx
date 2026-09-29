import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as THREE from 'three';

/*
 * The page's three moving pictures, all on one small lifecycle: a transparent canvas that fills its host,
 * draws only while on screen and in a visible tab, and holds one still frame under reduced motion.
 * None of them follow the cursor; they move on their own.
 *
 *  - Vortex: the hero. Sifting as panning for gold: companies spiral in, most are flung off the rim,
 *    the few worth talking to turn mint and settle around a glowing selection point.
 *  - Blinds: the privacy band. Closed blinds with a slow light behind them.
 *  - Slats: the footer. A sea of sieve bars rolling towards the horizon.
 */

interface Stage {
  scene: THREE.Scene;
  resize(w: number, h: number, dpr: number): void;
  tick(t: number): void;
  dispose(): void;
}

function run(el: HTMLElement, make: () => Stage): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
  } catch {
    return () => {}; // no WebGL: every section reads fine without its picture
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.domElement.style.display = 'block';
  el.appendChild(renderer.domElement);
  const camera = new THREE.Camera();
  const stage = make();

  let t = reduced ? 30 : 0;
  const draw = () => {
    stage.tick(t);
    renderer.render(stage.scene, camera);
  };
  const resize = () => {
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    stage.resize(w, h, dpr);
    if (reduced) draw();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
  io.observe(el);
  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden) return;
    t += dt;
    draw();
  };
  if (!reduced) raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    stage.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

// ---------- full-screen fragment shaders (blinds, slats) ----------

const QUAD_VERT = /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function quad(fragmentShader: string, extra: Record<string, THREE.IUniform> = {}): () => Stage {
  return () => {
    const scene = new THREE.Scene();
    const geo = new THREE.PlaneGeometry(2, 2);
    const uniforms = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 }, ...extra };
    const mat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader, uniforms, transparent: true, depthWrite: false });
    scene.add(new THREE.Mesh(geo, mat));
    return {
      scene,
      resize: (w, h, dpr) => { uniforms.uRes.value.set(w, h); uniforms.uDpr.value = dpr; },
      tick: (t) => { uniforms.uTime.value = t; },
      dispose: () => { geo.dispose(); mat.dispose(); },
    };
  };
}

const BLINDS_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime, uDpr;
  uniform vec2 uRes;
  float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 p = gl_FragCoord.xy / uDpr;
    vec2 uv = p / uRes;
    float count = max(6.0, floor(uRes.x / 64.0));
    float s = fract(uv.x * count);
    // Each slat catches light on one edge and falls into shadow on the other.
    float shade = smoothstep(0.0, 0.9, s) * 0.55 + 0.45;
    float seam = smoothstep(0.0, 0.035, s) * smoothstep(1.0, 0.965, s);
    // A soft light drifts behind the blinds.
    vec2 c = vec2(0.72 + 0.12 * sin(uTime * 0.11), 0.55 + 0.18 * sin(uTime * 0.07 + 1.3));
    vec2 d = (uv - c) * vec2(uRes.x / uRes.y, 1.0);
    float light = exp(-dot(d, d) * 2.2);
    vec3 night = vec3(0.043, 0.110, 0.118);
    vec3 pine = vec3(0.086, 0.251, 0.231);
    vec3 mint = vec3(0.624, 0.949, 0.839);
    vec3 col = mix(night, pine, uv.y * 0.45 + light * 0.55);
    col += mint * light * 0.08 * shade;
    col *= mix(0.78, 1.0, shade) * mix(0.7, 1.0, seam);
    col += (rand(p + uTime) - 0.5) * 0.018;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SLATS_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime, uDpr;
  uniform vec2 uRes;
  float pill(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 p = gl_FragCoord.xy / uDpr;
    vec2 pitch = vec2(11.0, 24.0);
    vec2 cell = floor(p / pitch);
    vec2 centre = cell * pitch + pitch * 0.5;
    float v = centre.y / uRes.y;                       // 0 at the bottom (near), 1 at the top (far)
    float depth = 1.0 / (1.0 - v * 0.82);
    vec2 w = vec2((centre.x / uRes.x - 0.5) * (uRes.x / uRes.y) * depth, depth * 1.6);
    float h = 0.55 * sin(w.x * 1.7 + w.y * 2.3 - uTime * 0.8)
            + 0.30 * sin(-w.x * 2.9 + w.y * 3.7 - uTime * 1.15 + 1.7)
            + 0.15 * sin(w.x * 5.1 + w.y * 1.3 - uTime * 0.6 + 4.1);
    float level = clamp(0.5 + 0.5 * h, 0.0, 1.0);
    float crest = smoothstep(0.72, 1.0, level);
    float fog = 1.0 - smoothstep(0.25, 0.95, v);
    float light = (pow(level, 1.4) * 0.95 + crest * 0.6) * fog;
    vec2 half_ = vec2(3.2, 10.5 * mix(0.35, 1.0, level));
    float a = clamp(0.5 - pill(p - centre, half_, 3.2) * uDpr, 0.0, 1.0) * clamp(light, 0.04, 1.0);
    vec3 col = mix(vec3(0.20, 0.42, 0.38), vec3(0.624, 0.949, 0.839), clamp(light * 1.2 + crest * 0.4, 0.0, 1.0));
    gl_FragColor = vec4(col * a, a);
  }
`;

// ---------- the hero vortex ----------

const VORTEX_VERT = /* glsl */ `
  attribute vec4 aSeed;   // x: start angle, y: speed, z: passes (0/1), w: phase
  attribute float aSize;
  uniform float uTime, uAspect, uR, uCy, uTilt, uLift, uCore, uDpr;
  varying float vAlpha;
  varying float vMint;

  void main() {
    float t = fract(uTime * aSeed.y + aSeed.w);
    float pass = aSeed.z;
    // Most dots ride one of three arms, so the swirl reads as a spiral; the rest is loose dust.
    float arm = floor(aSeed.x * 3.0) / 3.0 + (fract(aSeed.x * 37.0) - 0.5) * 0.09;
    float onArm = step(0.3, fract(aSeed.w * 5.0));
    float th0 = mix(aSeed.x, arm, onArm) * 6.2831853 + uTime * 0.1;
    float rCut = pass > 0.5 ? uCore : uR * (0.3 + 0.12 * fract(aSeed.w * 13.0));
    float rimR = uR * (1.0 + 0.1 * fract(aSeed.w * 7.0));
    float r, th, alpha, mint = 0.0, rise = 0.0;

    if (t < 0.72) {
      // Spiral in, turning faster as the radius shrinks.
      float u = t / 0.72;
      r = mix(rimR, rCut, pow(u, 0.85));
      th = th0 + 1.5 * uR / r;
      mint = pass * smoothstep(0.5, 1.0, u);
      alpha = mix(mix(0.22, 0.6, onArm), 1.0, mint) * smoothstep(0.0, 0.14, u);
      alpha += (1.0 - pass) * 0.4 * smoothstep(0.86, 1.0, u);     // flash on the sieve
    } else {
      float v = (t - 0.72) / 0.28;
      th = th0 + 1.5 * uR / rCut;
      if (pass > 0.5) {
        // Kept: a tight mint orbit around the mark.
        r = rCut * (1.0 - 0.12 * v);
        th += v * 6.0;
        mint = 1.0;
        alpha = 1.0 - smoothstep(0.7, 1.0, v);
      } else {
        // Rejected: flung back out over the rim, fading.
        r = rCut + v * v * uR * 1.4;
        th += v * 1.3;
        alpha = mix(0.62, 1.0, onArm) * (1.0 - smoothstep(0.0, 0.6, v));
        rise = v * 0.18;
      }
    }

    float z = sin(th);
    float x = r * cos(th);
    float y = uCy + r * z * uTilt + uLift * (r / uR) * (r / uR) + rise;   // a shallow funnel, rim raised
    float far = z * min(r / uR, 1.0);                                     // +1 at the back, -1 at the front
    vAlpha = alpha * (1.0 - 0.35 * far);
    vMint = mint;
    gl_Position = vec4(x / uAspect, y, 0.0, 1.0);
    gl_PointSize = aSize * uDpr * (1.0 - 0.3 * far) * mix(0.8 + 0.2 * onArm, 1.9, mint);
  }
`;

const VORTEX_FRAG = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying float vMint;
  uniform vec3 uGrey, uMint;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(mix(uGrey, uMint, vMint), vAlpha * smoothstep(0.5, 0.12, d));
  }
`;

/** Where the vortex sits for a given canvas shape, in canvas units (y from -1 to 1, x scaled by height). */
export function vortexLayout(w: number, h: number) {
  const aspect = w / h;
  const narrow = aspect < 0.9;
  return {
    aspect,
    R: Math.min(narrow ? 1.0 : 1.22, aspect * (narrow ? 1.08 : 0.9)),
    cy: narrow ? 0.24 : 0.16,
    tilt: narrow ? 0.58 : 0.38,
    lift: 0.12,
  };
}

function vortex(count: number): () => Stage {
  return () => {
    const scene = new THREE.Scene();
    const geo = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 4);
    const sizes = new Float32Array(count);
    let s = 1234567; // deterministic: every visitor sees the same swirl
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = rand();
      seeds[i * 4 + 1] = 0.035 + rand() * 0.05;
      seeds[i * 4 + 2] = rand() < 0.08 ? 1 : 0;
      seeds[i * 4 + 3] = rand();
      sizes[i] = 1.5 + rand() * 2.3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const uniforms = {
      uTime: { value: 0 }, uAspect: { value: 1 }, uR: { value: 1 }, uCy: { value: 0 }, uTilt: { value: 0.34 },
      uLift: { value: 0.12 }, uCore: { value: 0.2 }, uDpr: { value: 1 },
      uGrey: { value: new THREE.Color('#b4c9c6') }, uMint: { value: new THREE.Color('#9ff2d6') },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VORTEX_VERT, fragmentShader: VORTEX_FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return {
      scene,
      resize: (w, h, dpr) => {
        const l = vortexLayout(w, h);
        uniforms.uAspect.value = l.aspect;
        uniforms.uR.value = l.R;
        uniforms.uCy.value = l.cy;
        uniforms.uTilt.value = l.tilt;
        uniforms.uLift.value = l.lift;
        uniforms.uCore.value = Math.max(0.07, (30 / h) * 2); // a tight orbit around the selection point
        uniforms.uDpr.value = dpr;
      },
      tick: (t) => { uniforms.uTime.value = t; },
      dispose: () => { geo.dispose(); mat.dispose(); },
    };
  };
}

// ---------- components ----------

function useStage(make: () => () => Stage, deps: unknown[]) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    return el ? run(el, make()) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return host;
}

/**
 * The hero picture. Children (the Sift mark, the notes) are placed with CSS variables that follow the
 * vortex: --vx/--vy its centre in px, --vr its radius in px, --vt its tilt.
 */
export function Vortex({ children }: { children?: ReactNode }) {
  const [count] = useState(() => (window.innerWidth < 700 ? 1500 : 3400));
  const host = useStage(() => vortex(count), [count]);
  const [vars, setVars] = useState<Record<string, string>>({});
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const place = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const l = vortexLayout(w, h);
      setVars({ '--vx': `${w / 2}px`, '--vy': `${((1 - l.cy) / 2) * h}px`, '--vr': `${(l.R * h) / 2}px`, '--vt': String(l.tilt) });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [host]);
  return (
    <div className="l-vortex" style={vars as CSSProperties}>
      <div className="l-fx" ref={host} aria-hidden />
      {children}
    </div>
  );
}

export function Blinds() {
  const host = useStage(() => quad(BLINDS_FRAG), []);
  return <div className="l-fx" ref={host} aria-hidden />;
}

export function Slats() {
  const host = useStage(() => quad(SLATS_FRAG), []);
  return <div className="l-fx" ref={host} aria-hidden />;
}
