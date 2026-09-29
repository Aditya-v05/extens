import { useEffect, useRef } from 'react';

/*
 * A wall of small slat cards across the bottom of the hero. The cards inside the letters of SIFT are
 * darkened, so the word reads like holes punched in a sieve; now and then a card flickers, and rarely one
 * flickers mint (a signal). No waves and no cursor: the wall sits still apart from the flicker.
 * Plain 2D canvas, a few thousand rounded rects redrawn about 16 times a second, only while on screen.
 */

/** Card size in CSS px; smaller on phones so the letters still have enough rows to read. */
const sizes = (w: number) => (w < 700 ? { SLAT_W: 4, SLAT_H: 10, GAP: 3 } : { SLAT_W: 7, SLAT_H: 18, GAP: 4 });
const FONT = '"Schibsted Grotesk Variable", system-ui, sans-serif';

export function SlatWord({ word = 'SIFT' }: { word?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let cols = 0, rows = 0, ox = 0, oy = 0;
    let { SLAT_W, SLAT_H, GAP } = sizes(el.clientWidth);
    let inWord = new Uint8Array(0);
    let flash = new Float32Array(0);
    let mint = new Uint8Array(0);

    const layout = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      ({ SLAT_W, SLAT_H, GAP } = sizes(w));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const px = SLAT_W + GAP;
      const py = SLAT_H + GAP;
      cols = Math.ceil(w / px) + 1;
      rows = Math.ceil(h / py);
      ox = (w - (cols * px - GAP)) / 2;
      oy = (h - (rows * py - GAP)) / 2;

      // The word, drawn once into a small mask with one pixel per card.
      const mask = document.createElement('canvas');
      mask.width = cols;
      mask.height = rows;
      const m = mask.getContext('2d')!;
      m.scale(1 / px, 1 / py);
      m.translate(-ox, -oy);
      let size = h * 1.28; // cap height is about 0.72 of the font size
      m.font = `800 ${size}px ${FONT}`;
      const fit = m.measureText(word).width;
      if (fit > w * 0.92) size *= (w * 0.92) / fit;
      m.font = `800 ${size}px ${FONT}`;
      m.textAlign = 'center';
      m.textBaseline = 'middle';
      m.fillStyle = '#000';
      m.fillText(word, w / 2, h / 2 + size * 0.02);
      const data = m.getImageData(0, 0, cols, rows).data;
      inWord = new Uint8Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) inWord[i] = data[i * 4 + 3]! > 110 ? 1 : 0;
      flash = new Float32Array(cols * rows);
      mint = new Uint8Array(cols * rows);
      draw();
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let r = 0; r < rows; r++) {
        // Fade the wall in from the top so it sits under the copy without a hard edge.
        const fade = Math.min(1, 0.35 + (r + 1) / (rows * 0.3));
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const f = flash[i]!;
          const base = inWord[i] ? 0.015 : 0.17;
          const a = (base + f * (inWord[i] ? 0.12 : 0.45)) * fade;
          ctx.fillStyle = f > 0.02 && mint[i] ? `rgba(159, 242, 214, ${a + f * 0.25})` : `rgba(239, 236, 228, ${a})`;
          ctx.beginPath();
          ctx.roundRect(ox + c * (SLAT_W + GAP), oy + r * (SLAT_H + GAP), SLAT_W, SLAT_H, SLAT_W / 2);
          ctx.fill();
        }
      }
    };

    let timer = 0;
    let visible = true;
    const tick = () => {
      if (visible && !document.hidden) {
        const n = flash.length;
        for (let i = 0; i < n; i++) if (flash[i]! > 0) flash[i] = flash[i]! < 0.02 ? 0 : flash[i]! * 0.82;
        for (let k = Math.ceil(n * 0.0035); k > 0; k--) {
          const i = Math.floor(Math.random() * n);
          flash[i] = 0.6 + Math.random() * 0.4;
          mint[i] = Math.random() < 0.12 ? 1 : 0;
        }
        draw();
      }
      timer = window.setTimeout(tick, 60);
    };

    const ro = new ResizeObserver(layout);
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    document.fonts.load(`800 100px ${FONT}`).catch(() => {}).finally(() => {
      layout();
      ro.observe(el);
      io.observe(el);
      if (!reduced) tick();
    });

    return () => {
      clearTimeout(timer);
      ro.disconnect();
      io.disconnect();
      canvas.remove();
    };
  }, [word]);

  return <div className="l-slatword" ref={host} role="img" aria-label={word} />;
}
