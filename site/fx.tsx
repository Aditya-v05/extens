import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/*
 * The page's two moving pictures, all on one small lifecycle: a transparent canvas that fills its host,
 * draws only while on screen and in a visible tab, and holds one still frame under reduced motion.
 * None of them follow the cursor; they move on their own.
 *
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

export function Blinds() {
  const host = useStage(() => quad(BLINDS_FRAG), []);
  return <div className="l-fx" ref={host} aria-hidden />;
}

export function Slats() {
  const host = useStage(() => quad(SLATS_FRAG), []);
  return <div className="l-fx" ref={host} aria-hidden />;
}
