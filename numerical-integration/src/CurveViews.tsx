import { approximant, runningArea, slicesFor, type Fn, type Rule } from './model';
import { bound, num } from './format';

export const OVER = '#c65a48', UNDER = '#4d7fc0', INK = '#33444b', ACCENT = '#1f7a6d';

/** A curve over [a, b] with the rule's slices drawn on it. Red is area the slices count that the curve does not cover; blue is area they miss. */
export function CurveChart({ f, a, b, n, rule, points, cap, testid, label }: { f: Fn; a: number; b: number; n?: number; rule?: Rule; points?: number[]; cap?: number; testid: string; label: string }) {
  const W = 700, H = 300, left = 56, right = W - 18, top = 16, bottom = 258;
  const xs = Array.from({ length: 281 }, (_, i) => a + (b - a) * i / 280), ys = xs.map(f), finite = ys.filter(Number.isFinite);
  let low = Math.min(0, ...finite), high = Math.max(0, ...finite);
  if (cap) high = Math.min(high, cap);
  if (high - low < 1e-12) high = low + 1;
  const span = high - low, ya = low < 0 ? low - span * 0.08 : 0, yb = high + span * 0.08;
  const px = (x: number) => left + (x - a) / (b - a) * (right - left), py = (y: number) => bottom - (Math.max(ya - span, Math.min(yb + span, y)) - ya) / (yb - ya) * (bottom - top);
  const at = (x: number, y: number) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`;

  let counted = '', over = '', under = '', edges = '';
  const slices = rule && n ? slicesFor(rule, n) : 0;
  if (rule && slices) {
    const top = approximant(f, a, b, slices, rule), h = (b - a) / slices, parts = Math.max(1, Math.ceil(240 / slices));
    for (let i = 0; i < slices; i++) {
      const x0 = a + i * h, line: string[] = [];
      for (let k = 0; k < parts; k++) {
        const x1 = x0 + k * h / parts, x2 = x0 + (k + 1) * h / parts, t1 = top(i, x1), t2 = top(i, x2), f1 = f(x1), f2 = f(x2);
        if (![t1, t2, f1, f2].every(Number.isFinite)) continue;
        if (!line.length) line.push(at(x1, t1));
        line.push(at(x2, t2));
        const quad = `M${at(x1, f1)}L${at(x1, t1)}L${at(x2, t2)}L${at(x2, f2)}Z`;
        if (t1 + t2 > f1 + f2) over += quad; else under += quad;
      }
      if (!line.length) continue;
      counted += `M${px(x0).toFixed(1)} ${py(0).toFixed(1)}L${line.join('L')}L${px(x0 + h).toFixed(1)} ${py(0).toFixed(1)}Z`;
      if (slices <= 128) edges += `M${line.join('L')}`;
      if (slices <= 64) edges += `M${px(x0).toFixed(1)} ${py(0).toFixed(1)}L${line[0]}M${px(x0 + h).toFixed(1)} ${py(0).toFixed(1)}L${line[line.length - 1]}`;
    }
  }
  const curve = xs.map((x, i) => Number.isFinite(ys[i]) ? `${ys[i - 1] === undefined || !Number.isFinite(ys[i - 1]) ? 'M' : 'L'}${at(x, ys[i])}` : '').join('');
  const clip = `ni-clip-${testid}`;
  return <svg className="ni-curve" viewBox={`0 0 ${W} ${H}`} role="img" data-testid={testid} data-slices={slices || undefined} aria-label={label}>
    <defs><clipPath id={clip}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
    <g clipPath={`url(#${clip})`}>
      {!slices && <path d={`${curve}L${px(b).toFixed(1)} ${py(0).toFixed(1)}L${px(a).toFixed(1)} ${py(0).toFixed(1)}Z`} fill={ACCENT} fillOpacity=".12" />}
      <path data-counted d={counted} fill={ACCENT} fillOpacity=".12" />
      <path data-over d={over} fill={OVER} fillOpacity=".5" /><path data-under d={under} fill={UNDER} fillOpacity=".5" />
      <path d={edges} fill="none" stroke={ACCENT} strokeWidth="1" strokeOpacity=".75" />
      <path d={curve} fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      {points && points.length <= 90 && points.map((x, i) => Number.isFinite(f(x)) && <circle key={i} cx={px(x)} cy={py(f(x))} r="3" fill="#fbfaf7" stroke={INK} strokeWidth="1.4" />)}
    </g>
    <path d={`M${left} ${top}V${bottom}M${left} ${py(0)}H${right}`} fill="none" stroke="#bdbcae" />
    {points && <path data-rug data-count={points.length} d={points.map(x => `M${px(x).toFixed(1)} ${bottom + 4}v9`).join('')} stroke={INK} strokeWidth="1" strokeOpacity={points.length > 400 ? 0.35 : 0.7} />}
    <text x={left - 6} y={py(high) + 3} textAnchor="end">{num(high, 3)}</text><text x={left - 6} y={py(0) + 3} textAnchor="end">0</text>
    {low < 0 && <text x={left - 6} y={py(low) + 3} textAnchor="end">{num(low, 3)}</text>}
    {cap !== undefined && <text x={right} y={top + 10} textAnchor="end">the curve carries on up to infinity</text>}
    <text x={left} y={H - 6}>x = {bound(a)}</text><text x={right} y={H - 6} textAnchor="end">x = {bound(b)}</text>
  </svg>;
}

/** The area from the left end up to x, as a curve of its own: the antiderivative, formula or not. */
export function AreaChart({ f, a, b, total }: { f: Fn; a: number; b: number; total: number }) {
  const W = 440, H = 230, left = 58, right = W - 16, top = 18, bottom = 190, path = runningArea(f, a, b), areas = path.map(p => p.area);
  let low = Math.min(0, ...areas), high = Math.max(0, ...areas);
  if (high - low < 1e-12) high = low + 1;
  const px = (x: number) => left + (x - a) / (b - a) * (right - left), py = (y: number) => bottom - (y - low) / (high - low) * (bottom - top - 24);
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" data-testid="ni-area" aria-label={`The area under the curve from ${bound(a)} up to x, rising to ${num(total, 6)} at ${bound(b)}.`}>
    <path d={`M${left} ${top}V${bottom}M${left} ${py(0)}H${right}`} fill="none" stroke="#bdbcae" />
    <polyline points={path.map(p => `${px(p.x).toFixed(1)},${py(p.area).toFixed(1)}`).join(' ')} fill="none" stroke={ACCENT} strokeWidth="2.2" strokeLinejoin="round" />
    <circle cx={px(b)} cy={py(total)} r="5" fill={ACCENT} stroke="#fbfaf7" strokeWidth="1.5" /><text x={px(b) - 9} y={py(total) - 10} textAnchor="end" className="ni-strong">{num(total, 6)}</text>
    <text x={left - 6} y={py(high) + 3} textAnchor="end">{num(high, 3)}</text><text x={left - 6} y={py(0) + 3} textAnchor="end">0</text>{low < 0 && <text x={left - 6} y={py(low) + 3} textAnchor="end">{num(low, 3)}</text>}
    <text x={left} y={bottom + 15}>{bound(a)}</text><text x={right} y={bottom + 15} textAnchor="end">{bound(b)}</text><text x={(left + right) / 2} y={H - 5} textAnchor="middle">area from {bound(a)} up to x</text>
  </svg>;
}
