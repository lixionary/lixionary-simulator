import { useMemo, useRef, type PointerEvent } from 'react';
import { cemented, COLORS, fan, imageOf, sag, sorted, type Element, type Image, type Paraxial, type Source, type System } from './model';
import { colorsFor, type Bench as BenchState } from './presets';

export type View = { x0: number; x1: number; yMax: number };
type Target = { kind: 'object' } | { kind: 'element'; id: number } | { kind: 'stop' } | { kind: 'sensor' };
const W = 1000, H = 420, MARGIN = 26;
const GLASS_FILL = { crown: '#b9d8e2', denseCrown: '#aecbe3', flint: '#d3c4e4', ideal: '#cbdcc6' } as const;

/** Elements glued to `id` move as one piece. */
export function moveGroup(system: System, id: number, x: number): System {
  const elements = sorted(system), at = elements.findIndex(e => e.id === id);
  if (at < 0) return system;
  let lo = at, hi = at;
  while (lo > 0 && cemented(elements[lo - 1], elements[lo])) lo--;
  while (hi < elements.length - 1 && cemented(elements[hi], elements[hi + 1])) hi++;
  const shift = x - elements[at].x, group = new Set(elements.slice(lo, hi + 1).map(e => e.id));
  return { ...system, elements: system.elements.map(e => group.has(e.id) ? { ...e, x: e.x + shift } : e) };
}

/** Real images that form in the air between lenses, such as the one inside a microscope tube. */
export function intermediateImages(system: System, source: Source): Image[] {
  const elements = sorted(system), found: Image[] = [];
  for (let k = 1; k < elements.length; k++) {
    if (cemented(elements[k - 1], elements[k])) continue;
    const image = imageOf({ elements: elements.slice(0, k), stop: null, sensorX: null }, source);
    if (image.kind === 'real' && image.x > elements[k - 1].x + elements[k - 1].thickness && image.x < elements[k].x) found.push(image);
  }
  return found;
}

export function fitView({ system, source }: BenchState, p: Paraxial, image: Image): View {
  const elements = sorted(system), semi = Math.max(...elements.map(e => e.semi));
  let lo = p.firstX, hi = p.lastX, yMax = Math.max(semi, system.stop?.radius ?? 0);
  if (system.stop) { lo = Math.min(lo, system.stop.x); hi = Math.max(hi, system.stop.x); }
  if (source.kind === 'point') { lo = Math.min(lo, source.x); yMax = Math.max(yMax, Math.abs(source.height)); }
  if (system.sensorX !== null) hi = Math.max(hi, system.sensorX);
  const base = Math.max(hi - lo, 4 * semi), reach = 2.5 * base, mid = (lo + hi) / 2;
  const include = (x: number) => { if (Number.isFinite(x) && Math.abs(x - mid) < reach) { lo = Math.min(lo, x); hi = Math.max(hi, x); return true; } return false; };
  include(p.frontFocal); include(p.rearFocal);
  if (image.kind !== 'infinity' && include(image.x) && Math.abs(image.height) < 3 * yMax) yMax = Math.max(yMax, Math.abs(image.height));
  for (const between of intermediateImages(system, source)) yMax = Math.max(yMax, Math.min(Math.abs(between.height), 3 * yMax));
  if (source.kind === 'parallel') lo = Math.min(lo, p.firstX - 0.4 * base);
  if (system.sensorX === null) hi = Math.max(hi, p.lastX + 0.4 * base);
  const pad = (hi - lo) * 0.07;
  return { x0: lo - pad, x1: hi + pad, yMax: yMax * 1.3 };
}

function niceLength(span: number): number {
  const raw = span * 0.16, power = 10 ** Math.floor(Math.log10(raw)), lead = raw / power;
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * power;
}

type Props = { bench: BenchState; view: View; p: Paraxial; image: Image; rays: number; textbook: boolean; selected: number | null; onSelect: (id: number) => void; onChange: (bench: BenchState, target: Target['kind']) => void; onDrag: (view: View | null) => void };

export function Bench({ bench, view, p, image, rays, textbook, selected, onSelect, onChange, onDrag }: Props) {
  const { system, source, white } = bench, svg = useRef<SVGSVGElement>(null), drag = useRef<{ ox: number; oy: number } | null>(null);
  const sx = (x: number) => (x - view.x0) / (view.x1 - view.x0) * W, sy = (y: number) => H / 2 - y / view.yMax * (H / 2 - MARGIN);
  const at = (x: number, y: number) => `${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`;
  const elements = sorted(system), endX = system.sensorX ?? view.x1;
  const fans = useMemo(() => colorsFor(white).map(key => { const color = COLORS.find(c => c.key === key)!; return { color, ...fan(system, source, color.nm, rays, view.x0) }; }), [system, source, white, rays, view.x0]);
  const between = useMemo(() => intermediateImages(system, source), [system, source]);
  const stretch = (H / 2 - MARGIN) / view.yMax / (W / (view.x1 - view.x0)), bar = niceLength(view.x1 - view.x0);

  function toModel(event: PointerEvent) {
    const box = svg.current!.getBoundingClientRect();
    return { x: view.x0 + (event.clientX - box.left) / box.width * (view.x1 - view.x0), y: (H / 2 - (event.clientY - box.top) / box.height * H) / (H / 2 - MARGIN) * view.yMax };
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  function handle(target: Target, originX: number, originY = 0) {
    return {
      onPointerDown: (event: PointerEvent<SVGGElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const m = toModel(event); drag.current = { ox: m.x - originX, oy: m.y - originY }; onDrag(view);
        if (target.kind === 'element') onSelect(target.id);
      },
      onPointerMove: (event: PointerEvent<SVGGElement>) => {
        if (!drag.current) return;
        const m = toModel(event), x = round(m.x - drag.current.ox), y = round(m.y - drag.current.oy);
        if (target.kind === 'object' && source.kind === 'point') onChange({ ...bench, source: { ...source, x, height: y } }, 'object');
        if (target.kind === 'element') onChange({ ...bench, system: moveGroup(system, target.id, x) }, 'element');
        if (target.kind === 'stop' && system.stop) onChange({ ...bench, system: { ...system, stop: { ...system.stop, x } } }, 'stop');
        if (target.kind === 'sensor') onChange({ ...bench, system: { ...system, sensorX: x } }, 'sensor');
      },
      onPointerUp: () => { drag.current = null; onDrag(null); },
      onPointerCancel: () => { drag.current = null; onDrag(null); },
      style: { cursor: 'grab', touchAction: 'none' as const },
    };
  }
  function lensPath(e: Element) {
    const N = 20, front: string[] = [], back: string[] = [];
    for (let i = 0; i <= N; i++) { const y = -e.semi + 2 * e.semi * i / N; front.push(at(e.x + sag(e.c1, y), y)); back.unshift(at(e.x + e.thickness + sag(e.c2, y), y)); }
    return `M${[...front, ...back].join('L')}Z`;
  }
  const arrow = (x: number, height: number, color: string, dashed = false) => {
    const tip = sy(height), base = sy(0), dir = Math.sign(tip - base) || -1, size = Math.min(8, Math.abs(tip - base));
    return <g stroke={color} fill={color}><path d={`M${sx(x)} ${base}V${tip - dir * size}`} strokeWidth="2.4" strokeDasharray={dashed ? '5 4' : undefined} fill="none" />{Math.abs(tip - base) > 2 ? <path d={`M${sx(x)} ${tip}l-5 ${-dir * size}h10Z`} stroke="none" /> : <circle cx={sx(x)} cy={base} r="3.5" stroke="none" />}</g>;
  };
  const label = (height: number) => Math.min(H - 8, Math.max(12, sy(height) + (height < 0 ? 15 : -9)));
  const shown = image.kind !== 'infinity' && image.x > view.x0 && image.x < view.x1;
  const summary = `Ray diagram of ${elements.length} ${elements.length === 1 ? 'lens' : 'lenses'}${source.kind === 'point' ? ' with a nearby object' : ' in distant light'}. ${image.kind === 'infinity' ? 'The rays leave parallel.' : `A ${image.kind} image forms.`}`;

  return <svg ref={svg} className="lens-bench" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
    <defs><clipPath id="lens-clip"><rect width={W} height={H} /></clipPath></defs>
    <rect width={W} height={H} fill="#fbfaf7" />
    <path d={`M0 ${H / 2}H${W}`} stroke="#c9cdc4" strokeDasharray="2 5" />
    <g clipPath="url(#lens-clip)">
      {textbook && Number.isFinite(p.focal) && <g className="lens-textbook">
        {[['H', p.frontPrincipal], ['H′', p.rearPrincipal]].map(([label, x]) => <g key={label}><path d={`M${sx(x as number)} ${MARGIN + 8}V${H - MARGIN - 8}`} stroke="#b3a9c9" strokeDasharray="3 4" /><text x={sx(x as number)} y={MARGIN + 2} textAnchor="middle">{label}</text></g>)}
        {[['F', p.frontFocal], ['F′', p.rearFocal]].map(([label, x]) => <g key={label}><circle cx={sx(x as number)} cy={H / 2} r="3.5" fill="#827b9f" /><text x={sx(x as number)} y={H / 2 + 17} textAnchor="middle">{label}</text></g>)}
      </g>}
      {fans.map(({ color, rays: through, cut }) => <g key={color.key} stroke={color.stroke} fill="none" strokeWidth="1.15" style={{ mixBlendMode: 'multiply' }}>
        {cut.map((trace, i) => <polyline key={`cut${i}`} points={trace.points.map(q => at(q.x, q.y)).join(' ')} opacity=".28" />)}
        {through.map((ray, i) => {
          const slope = ray.end.dy / ray.end.dx, yAt = (x: number) => ray.end.y + (x - ray.end.x) * slope;
          return <g key={i}><polyline data-ray={color.key} points={[...ray.points, { x: Math.max(endX, ray.end.x), y: yAt(Math.max(endX, ray.end.x)) }].map(q => at(q.x, q.y)).join(' ')} opacity=".85" />
            {image.kind === 'virtual' && <path d={`M${at(ray.end.x, ray.end.y)}L${at(Math.max(image.x, view.x0), yAt(Math.max(image.x, view.x0)))}`} strokeDasharray="3 4" opacity=".55" />}</g>;
        })}
      </g>)}
      {elements.map((e, i) => <g key={e.id} {...handle({ kind: 'element', id: e.id }, e.x)} data-element={e.id}>
        <path d={lensPath(e)} fill={GLASS_FILL[e.glass]} fillOpacity=".62" stroke={selected === e.id ? '#3f6477' : '#7fa0ae'} strokeWidth={selected === e.id ? 2 : 1.1} strokeLinejoin="round" />
        <text x={sx(e.x + e.thickness / 2) + (elements[i + 1] && cemented(e, elements[i + 1]) ? -5 : elements[i - 1] && cemented(elements[i - 1], e) ? 5 : 0)} y={Math.max(13, sy(e.semi) - 7)} textAnchor="middle" className="lens-number">{i + 1}</text>
      </g>)}
      {system.stop && <g {...handle({ kind: 'stop' }, system.stop.x)} data-stop>
        <rect x={sx(system.stop.x) - 9} y={MARGIN} width="18" height={H - 2 * MARGIN} fill="transparent" />
        {[1, -1].map(side => <path key={side} d={`M${sx(system.stop!.x)} ${sy(side * system.stop!.radius)}V${sy(side * Math.max(view.yMax * 0.86, system.stop!.radius))}`} stroke="#4a4a43" strokeWidth="4" />)}
        <text x={sx(system.stop.x)} y={H - 6} textAnchor="middle">aperture</text>
      </g>}
      {between.map((mid, i) => <g key={i} opacity=".75">{arrow(mid.x, mid.height, '#b08a4e', true)}<text x={sx(mid.x)} y={label(mid.height)} textAnchor="middle">image in the tube</text></g>)}
      {textbook && shown && <g data-image={image.kind}>{arrow(image.x, image.height, '#8a6fa8', image.kind === 'virtual')}<text x={sx(image.x)} y={label(image.height)} textAnchor="middle">{image.kind} image</text></g>}
      {system.sensorX !== null && <g {...handle({ kind: 'sensor' }, system.sensorX)} data-sensor>
        <rect x={sx(system.sensorX) - 10} y={MARGIN} width="20" height={H - 2 * MARGIN} fill="transparent" />
        <path d={`M${sx(system.sensorX)} ${MARGIN + 12}V${H - MARGIN - 12}`} stroke="#5d5a52" strokeWidth="3" /><text x={sx(system.sensorX)} y={H - 6} textAnchor="middle">sensor</text>
      </g>}
      {source.kind === 'point' && <g {...handle({ kind: 'object' }, source.x, source.height)} data-object>
        {arrow(source.x, source.height, '#3f4a3a')}<circle cx={sx(source.x)} cy={sy(source.height)} r="13" fill="transparent" /><text x={sx(source.x)} y={label(source.height)} textAnchor="middle">object</text>
      </g>}
    </g>
    <g className="lens-scale"><path d={`M16 ${H - 14}h${bar / (view.x1 - view.x0) * W}`} stroke="#8d8f83" strokeWidth="1.5" /><text x="16" y={H - 20}>{bar} mm{stretch > 1.15 || stretch < 0.87 ? ` · height drawn ×${stretch.toFixed(1)}` : ''}</text></g>
  </svg>;
}
