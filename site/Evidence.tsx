import { useEffect, useRef, useState } from 'react';
import { acme, acmeRevealed } from './demo-data';

/*
 * The hero's one moving thing: Sift thinking, made visible.
 * Evidence about Acme appears in grey (noise), the irrelevant pieces are dismissed, the ones that matter
 * turn mint (signal), draw together, and one person comes out. Grey means noise and mint means signal,
 * here and across the page. Hover any piece to see where it came from. Every number matches demo-data.ts.
 */

type Phase = 'empty' | 'reading' | 'sifting' | 'joined' | 'signal';

interface Piece {
  id: string;
  title: string;
  sub: string;
  source: string[];
  keep: boolean;
  rel?: number;
  /** Where it appears, then (if kept) where it settles; % of the canvas, desktop and phone. */
  at: [number, number];
  to?: [number, number];
  mAt: [number, number];
  mTo?: [number, number];
}

const why = acme.whyNow!;
const [hiring, upmarket, growth, funding] = why.signals;
const person = acmeRevealed.contacts![0]!;

const PIECES: Piece[] = [
  {
    id: 'hiring', keep: true, rel: hiring!.relevance, title: hiring!.label, sub: 'Support Team Lead, Support Quality Analyst +2',
    source: ['Apollo job postings', '4 open roles your product serves'], at: [15, 20], to: [22, 36], mAt: [42, 6], mTo: [50, 12],
  },
  {
    id: 'pricing', keep: true, rel: upmarket!.relevance, title: 'acme.example/pricing', sub: '"SSO, SCIM and audit logs on the new Enterprise plan"',
    source: ['Quoted word for word', 'from acme.example/pricing'], at: [50, 8], to: [50, 18], mAt: [46, 30], mTo: [50, 32],
  },
  {
    id: 'growth', keep: true, rel: growth!.relevance, title: growth!.label, sub: '240 people, +31% in 12 months',
    source: ['Apollo headcount data', 'checked on every lookup'], at: [85, 22], to: [78, 36], mAt: [44, 54], mTo: [50, 52],
  },
  {
    id: 'funding', keep: false, rel: funding!.relevance, title: funding!.label, sub: 'Aug 2026',
    source: ['Announcement', 'less relevant to what you sell'], at: [31, 74], mAt: [58, 18],
  },
  {
    id: 'blog', keep: false, title: 'acme.example/blog', sub: 'Company offsite recap',
    source: ['From their site', 'no buying signal'], at: [72, 68], mAt: [56, 42],
  },
  {
    id: 'design', keep: false, title: 'Hiring: Senior Brand Designer', sub: '1 open role',
    source: ['Apollo job postings', 'not a role your product serves'], at: [10, 52], mAt: [55, 66],
  },
];

// When each phase starts (ms), then the whole thing plays again.
const TIMELINE: [Phase, number][] = [['reading', 300], ['sifting', 2600], ['joined', 3700], ['signal', 4700], ['empty', 12000]];
const LOOP = 12800;
const ANSWER_Y = 80;

export function Evidence() {
  const [phase, setPhase] = useState<Phase>('empty');
  const [hover, setHover] = useState<string | null>(null);
  const paused = useRef(false);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('signal');
      return;
    }
    let timers: number[] = [];
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    if (host.current) io.observe(host.current);
    const play = () => {
      timers.forEach(clearTimeout);
      timers = TIMELINE.map(([p, t]) => window.setTimeout(() => setPhase(p), t));
      // Hold on the answer while someone is reading a receipt or the canvas is off screen.
      const again = () => (paused.current || !visible || document.hidden ? (timers.push(window.setTimeout(again, 800)), undefined) : play());
      timers.push(window.setTimeout(again, LOOP));
    };
    play();
    return () => {
      timers.forEach(clearTimeout);
      io.disconnect();
    };
  }, []);

  const after = (p: Phase) => ['reading', 'sifting', 'joined', 'signal'].indexOf(phase) >= ['reading', 'sifting', 'joined', 'signal'].indexOf(p) && phase !== 'empty';
  const kept = PIECES.filter((p) => p.keep);

  return (
    <div
      className={`l-ev ${phase}`}
      ref={host}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => ((paused.current = false), setHover(null))}
    >
      <p className="l-ev-status" aria-live="polite">
        <i aria-hidden />
        {after('signal') ? <b>signal.</b> : after('sifting') ? 'sifting…' : after('reading') ? 'reading acme.example…' : ''}
      </p>

      {(['desk', 'phone'] as const).map((v) => (
        <svg key={v} className={`l-ev-lines ${v}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {kept.map((p) => {
            const [x, y] = v === 'desk' ? p.to! : p.mTo!;
            return <line key={p.id} x1={x} y1={y} x2={50} y2={ANSWER_Y} pathLength={1} />;
          })}
        </svg>
      ))}

      {PIECES.map((p, i) => {
        const gone = !p.keep && after('sifting');
        const signal = p.keep && after('joined');
        const [x, y] = signal ? p.to! : p.at;
        const [mx, my] = signal ? p.mTo! : p.mAt;
        return (
          <div
            key={p.id}
            className={`l-ev-piece ${gone ? 'gone' : ''} ${signal ? 'signal' : ''} ${after('reading') ? 'shown' : ''} ${hover === p.id ? 'open' : ''}`}
            style={{ ['--x' as string]: `${x}%`, ['--y' as string]: `${y}%`, ['--mx' as string]: `${mx}%`, ['--my' as string]: `${my}%`, transitionDelay: phase === 'reading' ? `${i * 160}ms` : '0ms' }}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            tabIndex={gone ? -1 : 0}
            onFocus={() => setHover(p.id)}
            onBlur={() => setHover(null)}
          >
            <div className="l-ev-top">
              <strong>{p.title}</strong>
              {p.rel !== undefined && <em>{Math.round(p.rel * 100)}%</em>}
            </div>
            <span className="l-ev-sub">{p.sub}</span>
            <div className="l-ev-source">
              <span>Source</span>
              {p.source.map((s) => <span key={s}>{s}</span>)}
            </div>
          </div>
        );
      })}

      <div className={`l-ev-answer ${after('signal') ? 'shown' : ''}`}>
        <span className="l-ev-avatar" aria-hidden>{person.firstName[0]}{person.lastName?.[0]}</span>
        <div>
          <strong>{person.firstName} {person.lastName}</strong>
          <span>{person.title}, Acme</span>
        </div>
        <b>{person.rank}</b>
        <span className="l-ev-meta">fit {acme.fit!.score} · timing {why.timing}</span>
      </div>
    </div>
  );
}
