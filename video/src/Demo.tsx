import { loadFont as loadSerif } from '@remotion/google-fonts/InstrumentSerif';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import React, { type ReactNode } from 'react';
import {
  AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';

/*
 * The landing page demo: a real screen recording of Sift on usepylon.com (public/clean.mp4, made from the raw
 * recording with the revealed email blurred and Chrome's own buttons painted over; see README.md), cut into
 * three moments, with a camera that follows the panel and one caption per moment.
 *
 * Coordinates are pixels of clean.mp4 (2940 x 1838, the recording's retina pixels minus the menu bar).
 * Times inside the recording are in seconds of the original, so they can be checked against it directly.
 */

const { fontFamily: serif } = loadSerif('normal', { weights: ['400'], subsets: ['latin'] });
loadSerif('italic', { weights: ['400'], subsets: ['latin'] });
const { fontFamily: mono } = loadMono('normal', { weights: ['400'], subsets: ['latin'] });

const FPS = 30;
const SRC = { w: 2940, h: 1838 };
const NIGHT = '#071d1a';
const CREAM = '#efece4';
const MINT = '#9ff2d6';
/** Captions get their own band under the picture, so they never sit on the page's own text. */
const BAND = { desktop: 170, vertical: 250 };

type Rect = { x: number; y: number; w: number; h: number };
type Key = [t: number, rect: Rect];

// ---------- the cut: [start, end] in seconds of the recording ----------

const CLIPS = [
  { from: 1.0, to: 3.85 },   // clicking the Sift icon, the panel loading
  { from: 4.3, to: 14.0 },   // Pylon: fit, why now, the best contact, email revealed
  { from: 22.0, to: 25.6 },  // back at the top: Save, Saved
] as const;

const INTRO = 36;
const OUTRO = 66;
const FADE = 10;
const len = (c: { from: number; to: number }) => Math.round((c.to - c.from) * FPS);
const starts: number[] = [];
{
  let at = INTRO - FADE;
  for (const c of CLIPS) {
    starts.push(at);
    at += len(c) - FADE;
  }
  starts.push(at); // outro
}
export const TOTAL = starts[3]! + OUTRO;

// ---------- the camera: rectangles of the recording to fill the frame with, over recording time ----------

/** A rectangle of the given aspect, `w` wide, centred on (cx, cy), kept inside the recording. */
function box(cx: number, cy: number, w: number, aspect: number): Rect {
  const h = w / aspect;
  return {
    x: Math.min(Math.max(cx - w / 2, 0), SRC.w - w),
    y: Math.min(Math.max(cy - h / 2, 0), SRC.h - h),
    w,
    h,
  };
}

function cameraKeys(vertical: boolean): Key[] {
  const a = vertical ? 720 / (1280 - BAND.vertical) : 1600 / (1000 - BAND.desktop);
  // Panel column: x 2180..2930. Where things sit in the panel changes as it scrolls (see README.md).
  const panel = (cy: number) => (vertical ? box(2555, cy, 780, a) : box(2330, cy, 1260, a));
  // Before Chrome went fullscreen the toolbar (with the Sift icon) is at the top: keep it in frame.
  const top = vertical ? box(2300, 0, 1034, a) : box(SRC.w / 2, 0, SRC.w, a);
  const start = vertical ? box(2300, SRC.h / 2, 1034, a) : box(SRC.w / 2, SRC.h / 2, SRC.w, a);
  return [
    [1.0, top],
    [1.5, vertical ? box(2384, 520, 1000, a) : box(2250, 440, 1500, a)], // towards the icon
    [2.4, vertical ? box(2384, 520, 1000, a) : box(2250, 440, 1500, a)],
    [3.85, top],
    [4.3, start],
    [5.0, start],
    [5.9, panel(700)], // the score and the checks
    [6.6, panel(700)],
    [8.2, panel(1000)], // why now
    [9.2, panel(1000)],
    [10.2, panel(1180)], // best contact and the reveal
    [14.0, panel(1180)],
    [22.0, panel(640)],
    [25.6, panel(600)],
  ];
}

function cameraAt(keys: Key[], t: number): Rect {
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1]![0] <= t) i++;
  const [t0, r0] = keys[i]!;
  const [t1, r1] = keys[i + 1]!;
  const k = t1 === t0 ? 1 : interpolate(t, [t0, t1], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.45, 0, 0.2, 1),
  });
  const mix = (p: number, q: number) => p + (q - p) * k;
  return { x: mix(r0.x, r1.x), y: mix(r0.y, r1.y), w: mix(r0.w, r1.w), h: mix(r0.h, r1.h) };
}

// ---------- captions: one per moment, in recording time ----------

const CAPTIONS: { from: number; to: number; label: string; text: ReactNode }[] = [
  { from: 1.0, to: 3.85, label: 'usepylon.com', text: <>One click on <em>their</em> homepage.</> },
  { from: 4.6, to: 7.4, label: '82% · strong fit', text: <>Scored against <em>your</em> customer.</> },
  { from: 7.9, to: 10.2, label: 'why now · timing 75', text: <>Why they matter <em>this week.</em></> },
  { from: 10.6, to: 14.0, label: 'best contact · email verified', text: <>Who to talk to, <em>and how.</em></> },
  { from: 22.2, to: 25.6, label: 'my accounts', text: <>Save it. <em>Rank it later.</em></> },
];

// ---------- pieces ----------

function Clip({ clip, vertical }: { clip: (typeof CLIPS)[number]; vertical: boolean }) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const band = vertical ? BAND.vertical : BAND.desktop;
  const t = clip.from + frame / FPS;
  const cam = cameraAt(cameraKeys(vertical), t);
  const scale = width / cam.w;
  const fade = Math.min(
    interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: 'clamp' }),
    interpolate(frame, [durationInFrames - FADE, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' }),
  );
  const caption = CAPTIONS.find((c) => t >= c.from && t < c.to);
  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT, opacity: fade }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width, height: height - band, overflow: 'hidden' }}>
      <OffthreadVideo
        src={staticFile('clean.mp4')}
        startFrom={Math.round(clip.from * FPS)}
        muted
        style={{
          position: 'absolute', left: 0, top: 0, width: SRC.w, height: SRC.h, maxWidth: 'none',
          transformOrigin: '0 0', transform: `scale(${scale}) translate(${-cam.x}px, ${-cam.y}px)`,
        }}
      />
      </div>
      {caption && <Caption key={caption.label} {...caption} t={t} vertical={vertical} band={band} />}
    </AbsoluteFill>
  );
}

function Caption({ label, text, from, to, t, vertical, band }: { label: string; text: ReactNode; from: number; to: number; t: number; vertical: boolean; band: number }) {
  const inK = interpolate(t, [from, from + 0.45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const outK = interpolate(t, [to - 0.3, to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute', left: vertical ? 44 : 64, right: vertical ? 44 : undefined, bottom: 0, height: band,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        opacity: Math.min(inK, outK), transform: `translateY(${(1 - inK) * 18}px)`, color: CREAM,
      }}
    >
      <div style={{ fontFamily: mono, fontSize: vertical ? 22 : 20, color: MINT, letterSpacing: '0.02em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: MINT, boxShadow: `0 0 12px ${MINT}` }} />
        {label}
      </div>
      <div style={{ fontFamily: serif, fontSize: vertical ? 64 : 60, lineHeight: 1, letterSpacing: '-0.02em' }}>{text}</div>
    </div>
  );
}

function Card({ children, sub }: { children: ReactNode; sub?: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const k = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const out = interpolate(frame, [durationInFrames - FADE, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  const small = width < 1000;
  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT, alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: out, padding: 48 }}>
      <div style={{ opacity: k, transform: `translateY(${(1 - k) * 16}px)`, display: 'grid', justifyItems: 'center', gap: small ? 28 : 30 }}>
        <Img src={staticFile('icon.png')} style={{ width: small ? 76 : 64, height: small ? 76 : 64, borderRadius: 16 }} />
        <div style={{ fontFamily: serif, color: CREAM, fontSize: small ? 70 : 84, lineHeight: 1.02, letterSpacing: '-0.02em' }}>{children}</div>
        {sub && <div style={{ fontFamily: mono, color: '#6b807c', fontSize: small ? 22 : 20 }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
}

// ---------- the whole thing ----------

export function Demo({ vertical }: { vertical: boolean }) {
  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT }}>
      <Sequence durationInFrames={INTRO}>
        <Card>Sift, on a real site.</Card>
      </Sequence>
      {CLIPS.map((c, i) => (
        <Sequence key={c.from} from={starts[i]} durationInFrames={len(c)}>
          <Clip clip={c} vertical={vertical} />
        </Sequence>
      ))}
      <Sequence from={starts[3]} durationInFrames={OUTRO}>
        <Card sub="Free and open source · sift-through.vercel.app">
          Sift through companies.<br /><em style={{ color: MINT }}>Talk to the right ones.</em>
        </Card>
      </Sequence>
    </AbsoluteFill>
  );
}
