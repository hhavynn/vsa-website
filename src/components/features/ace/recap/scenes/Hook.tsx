import React from 'react';
import { STAGE_H, STAGE_W, CREAM, GOLD } from '../stageModel';
import { ease, lerp, seg } from '../motion/easing';
import { DashedFrame, KineticText, MONO, SANS, SERIF } from '../motion/Kinetic';
import { NightSky, PAPER, Paper, Vignette } from '../motion/Texture';
import { ThreadPath } from '../motion/ThreadPath';
import { line, samplePath } from '../motion/thread';
import type { Poly } from '../motion/thread';

/** Where the title underline sits when the hook hands over to the hero scene. */
export const HOOK_UNDERLINE = { x1: 560, x2: 1360, y: 668 };
/** The fork junction: the ink line's Big dot, and the iris centre. */
const FORK = { x: 1290, y: 820 };
const INK_LINE: Poly = line({ x: 150, y: 820 }, FORK);
const curve = (a: { x: number; y: number }, c1: { x: number; y: number }, c2: { x: number; y: number }, b: { x: number; y: number }): Poly =>
  samplePath(`M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`, 28);
/** The two new branches out of the Big dot: a Little below, another branch ahead. */
const LITTLE_END = { x: 1520, y: 980 };
const BRANCH_END = { x: 1640, y: 760 };
const BRANCH_A: Poly = curve(FORK, { x: 1400, y: 820 }, { x: 1470, y: 860 }, LITTLE_END);
const BRANCH_B: Poly = curve(FORK, { x: 1420, y: 820 }, { x: 1520, y: 760 }, BRANCH_END);

const BRAND_BLUE = '#4356a1';
const BRAND_VIOLET = '#7a5fc0';

/**
 * Opening hook (≈7 s): kinetic ink type on paper — ONE BIG / ONE LITTLE /
 * ONE MORE BRANCH — collapses into a single line that forks (a Big and a
 * Little), the paper irises down onto the Big, and the night title opens
 * with that line becoming its underline. Decorative: no real lineage here.
 */
export function Hook({ f, d, cycleLabel }: { f: number; d: number; cycleLabel: string }) {
  const collapse = 112;
  const irisStart = 146;
  const iris = ease.inOutCubic(seg(f, irisStart, 26));
  const paperVisible = iris < 1;
  // Punch-in on each line's arrival: short energetic beats before the hold.
  const punch = [8, 38, 70].reduce((acc, at) => acc + 0.035 * Math.max(0, 1 - Math.abs(f - at - 6) / 10), 0);
  const camScale = 1 + 0.05 * ease.inOutCubic(seg(f, 0, collapse)) + punch;
  const roll = lerp(0, -1.2, ease.inOutCubic(seg(f, 0, collapse)));
  const exitTo = { y: 1.6, scale: 0.15, opacity: 0, rot: 18 };
  const typeStyle: React.CSSProperties = { fontFamily: SANS, fontWeight: 700, fontSize: 168, lineHeight: 1, color: PAPER.ink, letterSpacing: '-0.02em' };
  const lineDraw = ease.inOutCubic(seg(f, collapse - 4, 30));
  const forkDraw = ease.outCubic(seg(f, collapse + 24, 16));
  const radius = Math.hypot(STAGE_W, STAGE_H) * (1 - iris);
  const title = f >= irisStart;
  const underline = ease.inOutExpo(seg(f, irisStart + 22, 30));
  const titleOut = d - 6;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {title && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <NightSky frame={f} />
          <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
            <circle cx={FORK.x} cy={FORK.y} r={10 * (1 - ease.inCubic(seg(f, irisStart + 20, 14)))} fill={GOLD} />
            <ThreadPath id="hook-ul" poly={line({ x: FORK.x, y: FORK.y }, { x: HOOK_UNDERLINE.x2, y: HOOK_UNDERLINE.y })}
              t1={ease.inOutCubic(seg(f, irisStart + 8, 16))} opacity={1 - seg(f, irisStart + 22, 6)} width={3} />
            <ThreadPath id="hook-ul2" poly={line({ x: HOOK_UNDERLINE.x2, y: HOOK_UNDERLINE.y }, { x: HOOK_UNDERLINE.x1, y: HOOK_UNDERLINE.y })}
              t1={underline} width={3} head={underline < 1} />
          </svg>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 410, textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 22, color: 'rgba(255,246,230,0.72)', textTransform: 'uppercase' }}>
              <KineticText text={`VSA at UCSD · ACE · ${cycleLabel}`} f={f} start={irisStart + 10} by="char" stagger={0.6} dur={14}
                from={{ y: 0, opacity: 0 }} tracking={[0.9, 0.34]} trackDur={44} ease={ease.outCubic}
                exit={{ at: titleOut, dur: 6, stagger: 0, to: { opacity: 0 } }} />
            </div>
            <div style={{ marginTop: 18, fontFamily: SERIF, fontStyle: 'italic', fontSize: 176, lineHeight: 1, color: CREAM }}>
              <KineticText text="A New Generation" f={f} start={irisStart + 18} by="char" stagger={1.1} dur={20} mask
                from={{ y: 1.05, opacity: 1 }} ease={ease.outQuint}
                color={(i) => (i >= 4 ? GOLD : undefined)} exit={{ at: titleOut, dur: 6, stagger: 0, to: { opacity: 0 } }} />
            </div>
          </div>
        </div>
      )}
      {paperVisible && (
        <div style={{
          position: 'absolute', inset: 0,
          clipPath: iris > 0 ? `circle(${radius}px at ${FORK.x}px ${FORK.y}px)` : undefined,
        }}>
          <Paper frame={f} />
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${camScale}) rotate(${roll}deg)`, transformOrigin: '50% 55%' }}>
            <div style={{ position: 'absolute', left: 150, top: 150 }}>
              <div style={typeStyle}>
                <KineticText text="ONE BIG." f={f} start={4} stagger={1.5} dur={16} jitter={9} from={{ y: 0.8, rot: -10, scale: 1.4, opacity: 0 }}
                  exit={{ at: collapse, dur: 12, stagger: 1.1, to: exitTo }} />
              </div>
            </div>
            <DashedFrame x={140} y={140} w={760} h={190} f={f} start={14} dur={18} label="big · 01" color="rgba(27,31,63,0.6)" exitAt={collapse - 6} />
            <div style={{ position: 'absolute', left: 560, top: 370 }}>
              <div style={typeStyle}>
                <KineticText text="ONE LITTLE." f={f} start={34} stagger={1.4} dur={16} jitter={9} from={{ x: 0.6, rot: 12, scale: 1.3, opacity: 0 }}
                  color={(i) => (i >= 3 ? BRAND_VIOLET : undefined)} exit={{ at: collapse + 4, dur: 12, stagger: 1.1, to: exitTo }} />
              </div>
            </div>
            <div style={{ position: 'absolute', left: 150, top: 590 }}>
              <div style={{ ...typeStyle, fontSize: 150 }}>
                <KineticText text="ONE MORE BRANCH." f={f} start={66} stagger={1.2} dur={16} jitter={7} from={{ y: -0.8, rot: 8, scale: 1.25, opacity: 0 }}
                  color={(i) => (i >= 7 ? BRAND_BLUE : undefined)} exit={{ at: collapse + 8, dur: 12, stagger: 1, to: exitTo }} />
              </div>
            </div>
          </div>
          <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
            <ThreadPath id="hook-ink" poly={INK_LINE} t1={lineDraw} color={PAPER.ink} width={4} head={false} />
            <ThreadPath id="hook-a" poly={BRANCH_A} t1={forkDraw} color={BRAND_VIOLET} width={5} head={false} />
            <ThreadPath id="hook-b" poly={BRANCH_B} t1={forkDraw} color={BRAND_BLUE} width={5} head={false} />
            {lineDraw >= 1 && <circle cx={FORK.x} cy={FORK.y} r={13 * ease.outBack(seg(f, collapse + 22, 10))} fill={PAPER.ink} />}
            {forkDraw >= 1 && <>
              <circle cx={LITTLE_END.x} cy={LITTLE_END.y} r={12 * ease.outBack(seg(f, collapse + 40, 10))} fill={BRAND_VIOLET} />
              <circle cx={BRANCH_END.x} cy={BRANCH_END.y} r={12 * ease.outBack(seg(f, collapse + 40, 10))} fill={BRAND_BLUE} />
            </>}
          </svg>
          <Vignette strength={0.22} color="60,40,20" />
          {iris > 0 && (
            <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
              <circle cx={FORK.x} cy={FORK.y} r={radius} fill="none" stroke={GOLD} strokeWidth={3} opacity={0.8} />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
