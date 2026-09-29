import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/*
 * Sifting, literally. Dots (companies) leave the top of the field, fall onto the sieve (where the page
 * puts the Sift mark), and most are flung aside and fade. About 1 in 14 passes, turns the mark's mint,
 * and runs down a narrow stream into whatever the page puts at the bottom (the result pill).
 *
 * Coordinates are the canvas's own: y from 1 (top) to -1 (bottom), x scaled by the aspect ratio.
 * Every dot's position is a pure function of time and its seed (vertex shader), so the main thread only
 * updates two uniforms per frame.
 */

export interface FieldProps {
  count?: number;
  /** Where dots appear, where the sieve sits, and where the stream ends (canvas y, 1 = top). */
  top?: number;
  sieve?: number;
  bottom?: number;
  /** Half-width of where dots start, in canvas units (1 = half the canvas height). */
  width?: number;
  /** Half-width of the visible sieve line. 0 hides it (when the page draws the mark itself). */
  span?: number;
  /** Share of dots that pass. */
  pass?: number;
}

const VERT = /* glsl */ `
  attribute vec4 aSeed;   // x: start (-1..1), y: speed, z: passes (0/1), w: phase
  attribute float aSize;
  uniform float uTime, uAspect, uTop, uSieve, uBottom, uWidth, uDpr;
  uniform vec2 uMouse;
  varying float vAlpha;
  varying float vPass;

  void main() {
    float p = fract(uTime * aSeed.y + aSeed.w);
    float y = uTop - p * (uTop - uBottom + 0.25);
    float x = aSeed.x * uWidth + sin(uTime * 0.7 + aSeed.w * 40.0) * 0.01;
    float pass = aSeed.z;
    float below = clamp((uSieve - y) / max(uSieve - uBottom, 0.1), 0.0, 1.0);
    float alpha = 0.42;

    // On the way down, everything drifts gently toward the sieve.
    float above = clamp((uTop - y) / max(uTop - uSieve, 0.1), 0.0, 1.0);
    x *= mix(1.0, 0.55, above * above);

    if (y < uSieve) {
      if (pass > 0.5) {
        float k = smoothstep(0.0, 0.35, below);
        x = mix(x, (fract(aSeed.w * 7.0) - 0.5) * 0.05, k);
        alpha = mix(0.6, 1.0, k) * (1.0 - smoothstep(0.85, 1.0, below));   // absorbed at the bottom
      } else {
        float side = sign(x + 0.0001);
        float hit = 1.0 - smoothstep(0.0, 0.05, below);
        x += side * below * below * 2.2;
        y += below * 0.3;
        alpha = (0.42 + hit * 0.45) * (1.0 - smoothstep(0.0, 0.3, below));
      }
    }

    vec2 pos = vec2(x, y);
    vec2 d = pos - uMouse;
    float len = length(d);
    if (len < 0.24) pos += normalize(d + 0.0001) * (0.24 - len) * 0.9;

    vAlpha = alpha * smoothstep(uTop + 0.02, uTop - 0.12, y);
    vPass = pass * step(y, uSieve);
    gl_Position = vec4(pos.x / uAspect, pos.y, 0.0, 1.0);
    gl_PointSize = aSize * uDpr * (1.0 + vPass * 0.8);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying float vPass;
  uniform vec3 uGrey, uMint;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(mix(uGrey, uMint, vPass), vAlpha * smoothstep(0.5, 0.15, d));
  }
`;

export function SiftField({ count = 2600, top = 0.8, sieve = 0.05, bottom = -0.75, width = 1.4, span = 0, pass = 0.075 }: FieldProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
    } catch {
      return; // no WebGL: the page reads fine without the field
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const geo = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 4);
    const sizes = new Float32Array(count);
    let s = 1234567; // deterministic: every visitor sees the same field
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = rand() * 2 - 1;
      seeds[i * 4 + 1] = 0.05 + rand() * 0.07;
      seeds[i * 4 + 2] = rand() < pass ? 1 : 0;
      seeds[i * 4 + 3] = rand();
      sizes[i] = 1.6 + rand() * 2.2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const uniforms = {
      uTime: { value: reduced ? 30 : 0 },
      uAspect: { value: 1 },
      uMouse: { value: new THREE.Vector2(9, 9) },
      uTop: { value: top },
      uSieve: { value: sieve },
      uBottom: { value: bottom },
      uWidth: { value: width },
      uSpan: { value: span },
      uDpr: { value: dpr },
      uGrey: { value: new THREE.Color('#9fb3b6') },
      uMint: { value: new THREE.Color('#9ff2d6') },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    // Optional visible sieve: a shimmering dotted line.
    let sieveGeo: THREE.BufferGeometry | null = null;
    let sieveMat: THREE.ShaderMaterial | null = null;
    if (span > 0) {
      const N = 70;
      sieveGeo = new THREE.BufferGeometry();
      const sx = new Float32Array(N);
      for (let i = 0; i < N; i++) sx[i] = (i / (N - 1)) * 2 - 1;
      sieveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      sieveGeo.setAttribute('aX', new THREE.BufferAttribute(sx, 1));
      sieveMat = new THREE.ShaderMaterial({
        uniforms, transparent: true, depthWrite: false,
        vertexShader: /* glsl */ `
          attribute float aX;
          uniform float uTime, uAspect, uSieve, uDpr, uSpan;
          varying float vAlpha;
          void main() {
            vAlpha = 0.55 * (1.0 - smoothstep(0.55, 1.0, abs(aX))) * (0.75 + 0.25 * sin(uTime * 2.0 + aX * 23.0));
            gl_Position = vec4(aX * uSpan / uAspect, uSieve + sin(uTime * 1.3 + aX * 9.0) * 0.004, 0.0, 1.0);
            gl_PointSize = 2.4 * uDpr;
          }`,
        fragmentShader: /* glsl */ `
          precision mediump float;
          varying float vAlpha;
          uniform vec3 uMint;
          void main() {
            if (length(gl_PointCoord - 0.5) > 0.5) discard;
            gl_FragColor = vec4(uMint, vAlpha);
          }`,
      });
      const line = new THREE.Points(sieveGeo, sieveMat);
      line.frustumCulled = false;
      scene.add(line);
    }

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      uniforms.uAspect.value = w / Math.max(h, 1);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const target = new THREE.Vector2(9, 9);
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.set(((e.clientX - r.left) / r.width * 2 - 1) * uniforms.uAspect.value, -((e.clientY - r.top) / r.height * 2 - 1));
    };
    window.addEventListener('pointermove', onMove, { passive: true });

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
      geo.dispose();
      mat.dispose();
      sieveGeo?.dispose();
      sieveMat?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [count, top, sieve, bottom, width, span, pass]);

  return <div className="l-field" ref={host} aria-hidden />;
}
