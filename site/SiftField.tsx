import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/*
 * The hero: sifting, literally. Thousands of faint dots (companies) fall toward a sieve. Most bounce off
 * to the sides and fade; a few pass through, turn the teal of Sift's mark, and funnel into one stream that
 * runs down into the product below. The pointer pushes dots aside.
 *
 * Every dot's position is a pure function of time and its seed, computed in the vertex shader, so the
 * main thread does nothing per frame but update two uniforms.
 */

const VERT = /* glsl */ `
  attribute vec4 aSeed;          // x: start x (-1..1), y: speed, z: passes the sieve (0/1), w: phase
  attribute float aSize;
  attribute float aNear;         // 1: falls near the stream, so the funnel reads; 0: anywhere
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uMouse;           // in the same space as positions
  uniform float uSieve;          // y of the sieve
  uniform vec2 uCenter;          // where the stream runs
  uniform float uDpr;
  varying float vAlpha;
  varying float vPass;

  void main() {
    float p = fract(uTime * aSeed.y + aSeed.w);          // 0 at the top, 1 at the bottom
    float y = 1.15 - p * 2.5;
    float x = (aNear > 0.5 ? uCenter.x + aSeed.x * 0.62 : aSeed.x * uAspect * 1.05) + sin(uTime * 0.6 + aSeed.w * 40.0) * 0.012;
    float below = clamp((uSieve - y) / 0.9, 0.0, 1.0);   // how far past the sieve
    float pass = aSeed.z;
    float alpha = 0.34;

    if (y < uSieve) {
      if (pass > 0.5) {
        // Through the sieve: pulled into a narrow stream, brighter.
        float k = smoothstep(0.0, 1.0, below * 1.6);
        float lane = (fract(aSeed.w * 7.0) - 0.5) * 0.09;
        x = mix(x, uCenter.x + lane, k);
        alpha = mix(0.5, 0.95, k);
      } else {
        // Rejected: a brief flash as it hits the sieve, then flung sideways, fading out.
        float side = sign(x - uCenter.x + 0.0001);
        x += side * below * below * 1.4;
        y += below * 0.12;
        float hit = 1.0 - smoothstep(0.0, 0.06, below);
        alpha = (0.34 + hit * 0.4) * (1.0 - smoothstep(0.0, 0.35, below));
      }
    }

    vec2 pos = vec2(x, y);
    // The pointer parts the dots.
    vec2 d = pos - uMouse;
    float r = 0.22;
    float len = length(d);
    if (len < r) pos += normalize(d + 0.0001) * (r - len) * 0.9;

    vAlpha = alpha * smoothstep(1.15, 0.95, y);          // fade in at the top
    vPass = pass * step(y, uSieve);
    gl_Position = vec4(pos.x / uAspect, pos.y, 0.0, 1.0);
    gl_PointSize = aSize * uDpr * (1.0 + vPass * 0.9);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying float vPass;
  uniform vec3 uGrey;
  uniform vec3 uTeal;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.2, d);
    gl_FragColor = vec4(mix(uGrey, uTeal, vPass), vAlpha * edge);
  }
`;

export function SiftField({ count = 4200, sieve = -0.08, centerX = 0.52 }: { count?: number; sieve?: number; centerX?: number }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
    } catch {
      return; // no WebGL: the hero still reads fine without the field
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const geo = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 4);
    const sizes = new Float32Array(count);
    const near = new Float32Array(count);
    // Deterministic, so every visitor sees the same field.
    let s = 1234567;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = rand() * 2 - 1;
      seeds[i * 4 + 1] = 0.035 + rand() * 0.05;
      seeds[i * 4 + 2] = rand() < 0.07 ? 1 : 0; // about 1 in 14 is worth talking to
      seeds[i * 4 + 3] = rand();
      sizes[i] = 1.6 + rand() * 2.2;
      near[i] = rand() < 0.45 ? 1 : 0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aNear', new THREE.BufferAttribute(near, 1));

    const uniforms = {
      uTime: { value: reduced ? 30 : 0 },
      uAspect: { value: 1 },
      uMouse: { value: new THREE.Vector2(9, 9) },
      uSieve: { value: sieve },
      uCenter: { value: new THREE.Vector2(0, 0) },
      uDpr: { value: dpr },
      uSpan: { value: 0.45 }, // half-width of the sieve
      uGrey: { value: new THREE.Color('#a9b8bd') },
      uTeal: { value: new THREE.Color('#7fd0c1') },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    // The sieve itself: a faint line of dots across the stream, shimmering a little.
    const SIEVE_DOTS = 70;
    const sieveGeo = new THREE.BufferGeometry();
    const sx = new Float32Array(SIEVE_DOTS);
    for (let i = 0; i < SIEVE_DOTS; i++) sx[i] = (i / (SIEVE_DOTS - 1)) * 2 - 1;
    sieveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SIEVE_DOTS * 3), 3));
    sieveGeo.setAttribute('aX', new THREE.BufferAttribute(sx, 1));
    const sieveMat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float aX;
        uniform float uTime; uniform float uAspect; uniform float uSieve; uniform vec2 uCenter; uniform float uDpr; uniform float uSpan;
        varying float vAlpha;
        void main() {
          float x = uCenter.x + aX * uSpan;
          float y = uSieve + sin(uTime * 1.3 + aX * 9.0) * 0.004;
          vAlpha = 0.5 * (1.0 - smoothstep(0.55, 1.0, abs(aX))) * (0.75 + 0.25 * sin(uTime * 2.0 + aX * 23.0));
          gl_Position = vec4(x / uAspect, y, 0.0, 1.0);
          gl_PointSize = 2.4 * uDpr;
        }`,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying float vAlpha;
        uniform vec3 uTeal;
        void main() {
          if (length(gl_PointCoord - 0.5) > 0.5) discard;
          gl_FragColor = vec4(uTeal, vAlpha);
        }`,
    });
    const sieveDots = new THREE.Points(sieveGeo, sieveMat);
    sieveDots.frustumCulled = false;
    scene.add(sieveDots);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      const aspect = w / Math.max(h, 1);
      uniforms.uAspect.value = aspect;
      // Narrow screens: the stream runs down the middle.
      uniforms.uCenter.value.set(w < 820 ? 0 : centerX * aspect, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const target = new THREE.Vector2(9, 9);
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const aspect = uniforms.uAspect.value;
      target.set(((e.clientX - r.left) / r.width * 2 - 1) * aspect, -((e.clientY - r.top) / r.height * 2 - 1));
    };
    const onLeave = () => target.set(9, 9);
    window.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(el);
    const clock = new THREE.Clock();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!reduced) uniforms.uTime.value += dt;
      // Ease the pointer in, so the dots part smoothly rather than jump.
      uniforms.uMouse.value.lerp(target, 1 - Math.pow(0.001, dt));
      renderer.render(scene, camera);
    };
    if (reduced) renderer.render(scene, camera);
    else frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      geo.dispose();
      mat.dispose();
      sieveGeo.dispose();
      sieveMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [count, sieve, centerX]);

  return <div className="l-field" ref={host} aria-hidden />;
}
