import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont as loadSans } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

const SANS = loadSans('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] }).fontFamily;
const MONO = loadMono('normal', { weights: ['400', '500'], subsets: ['latin'] }).fontFamily;

/* ------------------------------ palette ------------------------------ */
/* Taken from the app itself, not re-invented: #07080B is Bazar's ground and
   #F0B90B is BNB gold, the single accent the product uses. */
const INK = '#07080B';
const GOLD = '#F0B90B';
const CYAN = '#22D3EE';
const VIOLET = '#A78BFA';
const EMERALD = '#34D399';
const ROSE = '#F0576E';
const TEXT = '#F8FAFC';
const MUTED = '#94A3B8';
const DIM = '#5A6472';
const LINE = 'rgba(255,255,255,0.08)';

const FILL: React.CSSProperties = { position: 'absolute', inset: 0 };

/* Eased 0->1 over `dur` frames starting at `delay`. */
const rise = (frame: number, delay: number, dur = 20) =>
  interpolate(frame - delay, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

/* Fade in, hold, fade out - so no scene ends on a hard cut. */
const hold = (frame: number, total: number, inF = 14, outF = 14) =>
  Math.min(rise(frame, 0, inF), interpolate(frame, [total - outF, total], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));

/* ------------------------------ chrome ------------------------------- */

/**
 * Screen footage, full-frame.
 *
 * The recording is 1912x1080 and the composition is 1920x1080, so it is scaled
 * rather than letterboxed - a 0.4% horizontal stretch nobody can see, against
 * black bars everybody can. A vignette and a faint gold wash sit on top so the
 * captured browser chrome reads as part of the film instead of a screenshot
 * dropped into it.
 */
const Footage: React.FC<{
  src: string;
  startFrom?: number;
  playbackRate?: number;
  total: number;
}> = ({ src, startFrom = 0, playbackRate = 1, total }) => {
  const frame = useCurrentFrame();
  const o = hold(frame, total, 16, 16);
  // A slow push-in keeps a static screen recording from feeling frozen.
  const scale = interpolate(frame, [0, total], [1.0, 1.035], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: '50% 50%' }}>
        <OffthreadVideo
          src={staticFile(src)}
          startFrom={startFrom}
          playbackRate={playbackRate}
          muted
          style={{ width: 1920, height: 1080, objectFit: 'fill' }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      <AbsoluteFill
        style={{ background: `radial-gradient(80% 60% at 50% 0%, ${GOLD}0D 0%, transparent 70%)` }}
      />
    </AbsoluteFill>
  );
};

/** Lower-left caption over footage. Never covers the centre of the screen. */
const Caption: React.FC<{ kicker: string; line: string; delay?: number }> = ({ kicker, line, delay = 8 }) => {
  const frame = useCurrentFrame();
  const o = rise(frame, delay, 18);
  const y = interpolate(o, [0, 1], [18, 0]);
  return (
    <div style={{ position: 'absolute', left: 96, bottom: 88, opacity: o, transform: `translateY(${y}px)` }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 19,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: GOLD,
          marginBottom: 12,
        }}
      >
        {kicker}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 42, fontWeight: 600, color: TEXT, letterSpacing: -0.5 }}>
        {line}
      </div>
    </div>
  );
};

/** The faint blueprint grid the app itself uses behind its hero. */
const Grid: React.FC<{ opacity?: number }> = ({ opacity = 0.5 }) => (
  <AbsoluteFill
    style={{
      opacity,
      backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
      backgroundSize: '64px 64px',
      maskImage: 'radial-gradient(70% 60% at 50% 45%, #000 0%, transparent 100%)',
      WebkitMaskImage: 'radial-gradient(70% 60% at 50% 45%, #000 0%, transparent 100%)',
    }}
  />
);

const Stage: React.FC<{ children: React.ReactNode; total: number }> = ({ children, total }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: INK, opacity: hold(frame, total) }}>
      <AbsoluteFill
        style={{ background: `radial-gradient(70% 50% at 50% 0%, ${GOLD}14 0%, transparent 70%)` }}
      />
      <Grid />
      {children}
    </AbsoluteFill>
  );
};

/* ------------------------------- scenes ------------------------------ */

const Title: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  return (
    <Stage total={total}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Img
          src={staticFile('bazar-header.png')}
          style={{ width: 520, opacity: s, transform: `translateY(${interpolate(s, [0, 1], [16, 0])}px)` }}
        />
        <div
          style={{
            fontFamily: SANS,
            fontSize: 26,
            color: MUTED,
            marginTop: 30,
            letterSpacing: 0.4,
            opacity: rise(frame, 18, 22),
          }}
        >
          Hire onchain AI agents on BNB Chain
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

/** The problem: a very long flat list with nothing to sort it by. */
const Problem: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [10, 80], [0, 310434], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const rows = 13;
  return (
    <Stage total={total}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 4, color: GOLD, textTransform: 'uppercase' }}>
          Registered on BNB Smart Chain
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 128,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: -4,
            marginTop: 8,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {n.toLocaleString('en-US')}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 30, color: MUTED, marginTop: 6 }}>agent identities</div>

        {/* the flat list itself, scrolling past with nothing to order it by */}
        <div
          style={{
            marginTop: 46,
            width: 1180,
            height: 232,
            overflow: 'hidden',
            opacity: rise(frame, 70, 26),
            maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
          }}
        >
          <div style={{ transform: `translateY(${-((frame - 70) * 1.5) % 58}px)` }}>
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 26,
                  alignItems: 'center',
                  height: 58,
                  borderBottom: `1px solid ${LINE}`,
                  fontFamily: MONO,
                  fontSize: 17,
                  color: DIM,
                }}
              >
                <span style={{ color: MUTED, width: 96 }}>#{(49637 + i * 7717).toString()}</span>
                <span style={{ width: 300, color: MUTED }}>{['Agent', 'Bot', 'Trader', 'Router', 'Monitor'][i % 5]}#{(i * 137 + 41).toString(16)}</span>
                <span style={{ width: 250 }}>0x{(i * 92821 + 3187).toString(16).padStart(10, '0')}…</span>
                <span style={{ flex: 1 }}>no category · no ranking · no price</span>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

/** Escrow, drawn: budget leaves the wallet, the kernel holds it, two exits. */
const Escrow: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const p = rise(frame, 14, 40);
  const alt = rise(frame, 96, 30);
  const Node: React.FC<{ x: number; label: string; sub: string; color: string; on: number }> = ({ x, label, sub, color, on }) => (
    <div style={{ position: 'absolute', left: x, top: 400, width: 340, textAlign: 'center', opacity: rise(frame, on, 20) }}>
      <div
        style={{
          height: 128,
          borderRadius: 22,
          border: `1px solid ${color}55`,
          background: `${color}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SANS,
          fontSize: 30,
          fontWeight: 600,
          color,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 16, color: DIM, marginTop: 14, letterSpacing: 1 }}>{sub}</div>
    </div>
  );
  return (
    <Stage total={total}>
      <div style={{ position: 'absolute', left: 0, top: 210, width: 1920, textAlign: 'center' }}>
        <div style={{ fontFamily: SANS, fontSize: 52, fontWeight: 600, color: TEXT, opacity: rise(frame, 4, 20) }}>
          The kernel holds the budget
        </div>
      </div>
      <Node x={190} label="Your wallet" sub="CLIENT" color={MUTED} on={10} />
      <Node x={790} label="ERC-8183 escrow" sub="KERNEL" color={GOLD} on={30} />
      <Node x={1390} label="Agent" sub="PROVIDER" color={EMERALD} on={70} />
      {/* wire 1 */}
      <div style={{ position: 'absolute', left: 530, top: 462, height: 3, width: 260 * p, background: `linear-gradient(90deg, ${MUTED}44, ${GOLD})` }} />
      {/* wire 2 */}
      <div style={{ position: 'absolute', left: 1130, top: 462, height: 3, width: 260 * rise(frame, 70, 26), background: `linear-gradient(90deg, ${GOLD}, ${EMERALD})` }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 660,
          width: 1920,
          textAlign: 'center',
          fontFamily: SANS,
          fontSize: 27,
          color: MUTED,
          opacity: alt,
        }}
      >
        Released when the work is accepted &nbsp;·&nbsp;{' '}
        <span style={{ color: CYAN }}>refundable to you if the deadline passes</span>
      </div>
    </Stage>
  );
};

/** The five calls, ticking off over the signature footage. */
const CallList: React.FC = () => {
  const frame = useCurrentFrame();
  const calls = ['createJob', 'registerJob', 'setBudget', 'approve', 'fund'];
  return (
    <div
      style={{
        position: 'absolute',
        right: 92,
        top: 232,
        width: 430,
        padding: 26,
        borderRadius: 20,
        background: 'rgba(7,8,11,0.82)',
        border: `1px solid ${LINE}`,
        backdropFilter: 'blur(14px)',
        opacity: rise(frame, 10, 18),
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: GOLD, textTransform: 'uppercase', marginBottom: 18 }}>
        Five contract calls
      </div>
      {calls.map((c, i) => {
        const on = rise(frame, 26 + i * 38, 14);
        return (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 14, height: 46 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                border: `1px solid ${on > 0.5 ? EMERALD : LINE}`,
                background: on > 0.5 ? `${EMERALD}22` : 'transparent',
                color: EMERALD,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {on > 0.5 ? '✓' : ''}
            </div>
            <span style={{ fontFamily: MONO, fontSize: 21, color: on > 0.5 ? TEXT : DIM }}>{c}</span>
          </div>
        );
      })}
    </div>
  );
};

/** The session key: an allowlist that refuses something, and a cap. */
const SessionKey: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const rows: [string, boolean][] = [
    ['createJob', true],
    ['registerJob', true],
    ['setBudget', true],
    ['approve', true],
    ['fund', true],
    ['claimRefund', true],
    ['transferFrom', false],
  ];
  const cap = interpolate(frame, [150, 250], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Stage total={total}>
      <div style={{ position: 'absolute', left: 0, top: 130, width: 1920, textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: 4, color: VIOLET, textTransform: 'uppercase' }}>
          Job #56747 · funded by a session key
        </div>
        <div style={{ fontFamily: SANS, fontSize: 50, fontWeight: 600, color: TEXT, marginTop: 14, opacity: rise(frame, 8, 20) }}>
          The agent paid from its own wallet
        </div>
      </div>

      {/* allowlist */}
      <div style={{ position: 'absolute', left: 300, top: 330, width: 560 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: DIM, textTransform: 'uppercase', marginBottom: 16 }}>
          Allowlist · answered by the account
        </div>
        {rows.map(([name, ok], i) => {
          const on = rise(frame, 30 + i * 14, 12);
          return (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 50,
                paddingInline: 18,
                marginBottom: 6,
                borderRadius: 12,
                border: `1px solid ${ok ? `${EMERALD}33` : `${ROSE}55`}`,
                background: ok ? `${EMERALD}0D` : `${ROSE}14`,
                opacity: on,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 20, color: ok ? TEXT : ROSE }}>{name}</span>
              <span style={{ fontFamily: MONO, fontSize: 16, color: ok ? EMERALD : ROSE }}>
                {ok ? 'allowed' : 'REFUSED'}
              </span>
            </div>
          );
        })}
      </div>

      {/* cap */}
      <div style={{ position: 'absolute', left: 1030, top: 330, width: 560 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: DIM, textTransform: 'uppercase', marginBottom: 16 }}>
          Spend cap · enforced by the account
        </div>
        <div style={{ padding: 28, borderRadius: 18, border: `1px solid ${LINE}`, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: SANS, fontSize: 44, fontWeight: 600, color: GOLD }}>0.5 U</span>
            <span style={{ fontFamily: MONO, fontSize: 17, color: DIM }}>per day</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.07)', marginTop: 20, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${cap * 100}%`, background: GOLD }} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 16, color: MUTED, marginTop: 14 }}>
            spent 0.5 of 0.5 — the account counted it
          </div>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 24, color: MUTED, marginTop: 30, lineHeight: 1.5, opacity: rise(frame, 200, 26) }}>
          Five calls as a single intent.
          <br />
          <span style={{ color: TEXT }}>No wallet prompt at any point.</span>
        </div>
      </div>
    </Stage>
  );
};

const Close: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  return (
    <Stage total={total}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Img src={staticFile('bazar-header.png')} style={{ width: 480, opacity: rise(frame, 2, 22) }} />
        <div
          style={{
            fontFamily: SANS,
            fontSize: 40,
            color: TEXT,
            marginTop: 34,
            opacity: rise(frame, 16, 22),
            letterSpacing: -0.5,
          }}
        >
          usebazar.xyz
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 19,
            color: DIM,
            marginTop: 20,
            letterSpacing: 2,
            opacity: rise(frame, 30, 22),
          }}
        >
          ERC-8004 · ERC-8183 · BNB SMART CHAIN
        </div>
      </AbsoluteFill>
    </Stage>
  );
};


/**
 * What Bazar is built on.
 *
 * Named because each relationship is real and load-bearing, not as a credits
 * roll. AltLayer leads: Bazar runs no indexer, so 8004scan is the deepest
 * dependency in the project and the least visible on screen.
 *
 * The PancakeSwap line says "no endorsement" in the frame itself. The app
 * carries that disclaimer on its own lane page, and a video that dropped it
 * would be making a claim the product refuses to make.
 */
const BuiltOn: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  // Logo, name, what it does here, accent. BNB Chain leads because it is the
  // ground everything else stands on, not a partner among partners.
  const rows: [string, string, string, string][] = [
    ['logos/bnb-logo.png', 'BNB Smart Chain', 'the settlement chain · mainnet only', GOLD],
    ['logos/altlayer-logo.png', 'AltLayer', '8004scan — every listing Bazar shows', CYAN],
    ['logos/altana-logo.png', 'Altana', 'session keys, spend caps, revocation', VIOLET],
    ['logos/pancake-logo.png', 'PancakeSwap', 'swap BNB for U · independent integration', '#22D3EE'],
    ['logos/termix-logo.png', 'TermiX', 'the advantage report, measured', EMERALD],
  ];
  return (
    <Stage total={total}>
      <div style={{ position: 'absolute', left: 0, top: 108, width: 1920, textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: 4, color: GOLD, textTransform: 'uppercase' }}>
          Built on
        </div>
        <div style={{ fontFamily: SANS, fontSize: 46, fontWeight: 600, color: TEXT, marginTop: 12, opacity: rise(frame, 6, 20) }}>
          Bazar runs no indexer of its own
        </div>
      </div>
      <div style={{ position: 'absolute', left: 400, top: 268, width: 1120 }}>
        {rows.map(([logo, name, what, color], i) => {
          const on = rise(frame, 30 + i * 46, 20);
          return (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                height: 118,
                paddingInline: 26,
                marginBottom: 15,
                borderRadius: 20,
                border: `1px solid ${color}33`,
                background: `${color}0D`,
                opacity: on,
                transform: `translateX(${interpolate(on, [0, 1], [-26, 0])}px)`,
              }}
            >
              {/* Each logo keeps its own background inside a rounded tile.
                  The five arrive on white, black and cyan grounds; keying them
                  would eat any pale mark inside the logo itself. */}
              <div
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 18,
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: `1px solid rgba(255,255,255,0.10)`,
                  boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
                }}
              >
                <Img src={staticFile(logo)} style={{ width: 78, height: 78, objectFit: 'cover' }} />
              </div>
              <div style={{ fontFamily: SANS, fontSize: 33, fontWeight: 600, color: TEXT, width: 330 }}>{name}</div>
              <div style={{ fontFamily: MONO, fontSize: 19, color: MUTED }}>{what}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

/* ------------------------------ timeline ----------------------------- */

type Cut = { from: number; dur: number; vo?: string; el: React.ReactNode };

const F = 30;
const s = (n: number) => Math.round(n * F);

export const Bazar: React.FC = () => {
  let t = 0;
  const cuts: Cut[] = [];
  const add = (dur: number, el: React.ReactNode, vo?: string) => {
    cuts.push({ from: t, dur, vo, el });
    t += dur;
  };

  add(s(3.4), <Title total={s(3.4)} />);
  add(s(14.2), <Problem total={s(14.2)} />, 'v01');
  add(
    s(8),
    <>
      <Footage src="clips/landing.mp4" total={s(8)} />
      <Caption kicker="The front door" line="One index. Two ways in." />
    </>,
    'v02',
  );
  add(
    s(15.6),
    <>
      <Footage src="clips/browse.mp4" total={s(15.6)} playbackRate={1.25} />
      <Caption kicker="Read from the registries" line="Identity, reputation, endpoints." />
    </>,
    'v03',
  );
  add(
    s(11),
    <>
      <Footage src="clips/brief.mp4" total={s(11)} playbackRate={2.2} />
      <Caption kicker="A real ERC-8183 job" line="You write the brief. You name the budget." />
    </>,
    'v04',
  );
  add(
    s(9.6),
    <>
      <Footage src="clips/sign.mp4" total={s(9.6)} />
      <CallList />
    </>,
    'v05',
  );
  add(s(9.2), <Escrow total={s(9.2)} />, 'v06');
  add(
    s(8),
    <>
      <Footage src="clips/explorer.mp4" total={s(8)} playbackRate={0.85} />
      <Caption kicker="Onchain" line="The kernel is the record, not Bazar." />
    </>,
    'v07',
  );
  add(
    s(12.4),
    <>
      <Footage src="clips/permissions.mp4" total={s(12.4)} playbackRate={0.55} />
      <Caption kicker="Altana session keys" line="An allowlist, a cap, an expiry." />
    </>,
    'v08',
  );
  add(s(15), <SessionKey total={s(15)} />, 'v09');
  add(
    s(5.4),
    <>
      <Footage src="clips/developers.mp4" total={s(5.4)} />
      <Caption kicker="For machines" line="Six endpoints. No key." delay={4} />
    </>,
    'v10',
  );
  add(s(21), <BuiltOn total={s(21)} />, 'v12');
  add(s(5.2), <Close total={s(5.2)} />, 'v11');

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {cuts.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.dur}>
          {c.el}
          {c.vo ? <Audio src={staticFile(`vo/${c.vo}.mp3`)} /> : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const BAZAR_DURATION = s(3.4 + 14.2 + 8 + 15.6 + 11 + 9.6 + 9.2 + 8 + 12.4 + 15 + 5.4 + 21 + 5.2);
