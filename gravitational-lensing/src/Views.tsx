import { useEffect, useRef, type PointerEvent } from 'react';
import { radialImages, TRACK, VIEW, type LensKind, type Source } from './model';
import { times } from './format';
import { paint } from './render';

const PIXELS = 340;
const clamp = (value: number) => Math.max(-TRACK, Math.min(TRACK, Math.round(value * 100) / 100));

/** One square of sky. With onMove it is the true sky and the background can be dragged. */
export function Sky({ kind, shear, source, lensed, showRing, showLens, onMove, label }: { kind: LensKind; shear: number; source: Source; lensed: boolean; showRing: boolean; showLens: boolean; onMove?: (x: number, y: number) => void; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context) context.putImageData(new ImageData(paint(kind, shear, source, lensed, showLens, PIXELS), PIXELS, PIXELS), 0, 0);
  }, [kind, shear, source, lensed, showLens]);
  function drag(event: PointerEvent<HTMLDivElement>) {
    if (!onMove || (event.type === 'pointermove' && !event.currentTarget.hasPointerCapture(event.pointerId))) return;
    if (event.type === 'pointerdown') event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.getBoundingClientRect();
    onMove(clamp(((event.clientX - box.left) / box.width * 2 - 1) * VIEW), clamp((1 - (event.clientY - box.top) / box.height * 2) * VIEW));
  }
  return <div className={`gl-sky${onMove ? ' draggable' : ''}`} data-sky={lensed ? 'lensed' : 'true'} onPointerDown={drag} onPointerMove={drag}>
    <canvas ref={canvas} width={PIXELS} height={PIXELS} role="img" aria-label={label} />
    <svg viewBox={`${-VIEW} ${-VIEW} ${2 * VIEW} ${2 * VIEW}`} aria-hidden="true">
      {showRing && <circle data-ring r="1" fill="none" stroke="#f3d9a4" strokeWidth=".018" strokeDasharray=".07 .07" opacity=".8" />}
      {!showLens && <path d="M-.09 0h.18M0 -.09v.18" stroke="#f3d9a4" strokeWidth=".02" />}
      {onMove && <g data-handle transform={`translate(${source.x} ${-source.y})`}><circle r={Math.max(0.2, source.size * 1.9)} fill="none" stroke="#fff" strokeWidth=".016" opacity=".55" /><path d="M0 -.32v-.14M0 .32v.14M-.32 0h-.14M.32 0h.14" stroke="#fff" strokeWidth=".018" opacity=".7" /></g>}
    </svg>
  </div>;
}

/** Brightness of the source against its position along a straight path past the lens. */
export function LightCurve({ xs, gains, at, duration }: { xs: number[]; gains: number[]; at: number; duration: string }) {
  const W = 440, H = 230, left = 44, right = W - 12, top = 18, bottom = 176, peak = Math.max(...gains), high = Math.max(2, peak * 1.08);
  const px = (x: number) => left + (x + TRACK) / (2 * TRACK) * (right - left), py = (gain: number) => bottom - gain / high * (bottom - top);
  const now = gains[Math.round((at + TRACK) / (2 * TRACK) * (xs.length - 1))];
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Brightness along the path. It peaks at ${times(peak)} and is ${times(now)} now.`}>
    <path d={`M${left} ${py(1)}H${right}`} stroke="#bdb6c2" strokeDasharray="3 4" /><text x={left - 5} y={py(1) + 3} textAnchor="end">1×</text><text x={left - 5} y={py(peak) + 3} textAnchor="end">{times(peak)}</text>
    <path d={`M${left} ${bottom}H${right}`} stroke="#d8d3dc" />
    <text x={left} y={bottom + 16}>before</text><text x={px(0)} y={bottom + 16} textAnchor="middle">closest pass</text><text x={right} y={bottom + 16} textAnchor="end">after</text>
    <path d={`M${px(0)} ${bottom + 28}H${px(1)}M${px(0)} ${bottom + 25}v6M${px(1)} ${bottom + 25}v6`} stroke="#8f8794" /><text x={px(0.5)} y={bottom + 43} textAnchor="middle">{duration}</text>
    <polyline data-testid="gl-curve" points={xs.map((x, i) => `${px(x).toFixed(1)},${py(gains[i]).toFixed(1)}`).join(' ')} fill="none" stroke="#84507f" strokeWidth="2" />
    <path d={`M${px(at)} ${top}V${bottom}`} stroke="#33444b" strokeDasharray="3 4" /><circle cx={px(at)} cy={py(now)} r="4" fill="#84507f" stroke="#fbfaf7" strokeWidth="1.5" />
  </svg>;
}

/** A slice through lens and source seen from the side: the bent paths, and where the eye places the images. */
export function SideView({ kind, offset, lopsided }: { kind: LensKind; offset: number; lopsided: boolean }) {
  const W = 440, H = 230, eye = 415, mid = 270, far = 125, axis = 115, unit = 30, images = radialImages(kind, offset);
  const y = (height: number) => axis - height * unit, back = (mid - far) / (eye - mid);
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Side view. Light from the source reaches the telescope by ${images.length === 1 ? 'one bent path' : 'two bent paths'}.`}>
    <path d={`M${far} ${axis}H${eye}`} stroke="#d8d3dc" /><path d={`M${far} 20V210M${mid} 20V210`} stroke="#e8e4ea" />
    <text x={far} y="14" textAnchor="middle">background</text><text x={mid} y="14" textAnchor="middle">lens</text><text x={eye} y="14" textAnchor="middle">telescope</text>
    {images.map((image, i) => { const apparent = y(image * (1 + back)); return apparent > 22 && apparent < 208 && <g key={i} data-apparent><path d={`M${mid} ${y(image)}L${far} ${apparent}`} stroke="#84507f" strokeDasharray="3 4" opacity=".7" /><circle cx={far} cy={apparent} r="4.5" fill="none" stroke="#84507f" strokeWidth="1.5" /><text x={far - 10} y={apparent + 3} textAnchor="end">seems here</text></g>; })}
    {images.map((image, i) => <path key={i} data-path d={`M${far} ${y(offset * (1 + back))}L${mid} ${y(image)}L${eye} ${axis}`} fill="none" stroke="#c08a3e" strokeWidth="1.6" />)}
    <circle cx={far} cy={y(offset * (1 + back))} r="4.5" fill="#c08a3e" stroke="#fbfaf7" strokeWidth="1.5" /><text x={far - 10} y={y(offset * (1 + back)) + 3} textAnchor="end">really here</text>
    <circle cx={mid} cy={axis} r={kind === 'point' ? 5 : 11} fill={kind === 'point' ? '#33444b' : '#e9c88f'} stroke="#fbfaf7" strokeWidth="1.5" />
    <path d={`M${eye} ${axis - 9}l14 9l-14 9z`} fill="#33444b" />
    <text x={W - 6} y={H - 6} textAnchor="end">{lopsided ? 'drawn for a round lens · ' : ''}angles exaggerated</text>
  </svg>;
}
