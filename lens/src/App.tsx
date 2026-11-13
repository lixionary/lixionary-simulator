import { useId, useMemo, useState, type ReactNode } from 'react';
import { Aperture, ArrowDown, ArrowLeft, ArrowUpRight, Focus, Lightbulb, Minus, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Bench, fitView, moveGroup, type View } from './Bench';
import { FocusCloseUp, length, RayFan } from './Charts';
import { bestFocus, blurAt, cemented, colorShift, describe, elementFocal, equivalentSinglet, GLASSES, imageOf, paraxial, sag, samples, sorted, sphericalShift, validate, type Element, type GlassKey, type Source, type System } from './model';
import { colorsFor, focused, PRESETS, sharpestFocus, type Bench as BenchState } from './presets';

const GROUPS = [...new Set(PRESETS.map(p => p.group))];
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const mm = (value: number) => Number.isFinite(value) ? `${value.toFixed(Math.abs(value) < 100 ? 1 : 0)} mm` : '∞';

function startingPreset() {
  const key = new URLSearchParams(window.location.search).get('preset'), found = PRESETS.find(p => p.key === key);
  return { preset: found ?? PRESETS[0], unknown: key !== null && !found };
}

function Slider({ label, value, min, max, step, text, onChange }: { label: string; value: number; min: number; max: number; step: number; text: string; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="lens-slider"><div><label htmlFor={id}>{label}</label><output htmlFor={id}>{text}</output></div><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></div>;
}
function Stat({ label, id, value, children }: { label: string; id: string; value: string; children: ReactNode }) {
  return <div><span>{label}</span><b data-testid={id}>{value}</b><small>{children}</small></div>;
}

export default function App() {
  const [start] = useState(startingPreset);
  const [presetKey, setPresetKey] = useState(start.preset.key), [bench, setBench] = useState<BenchState>(() => start.preset.build());
  const [tracking, setTracking] = useState(true), [rays, setRays] = useState(9), [textbook, setTextbook] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null), [error, setError] = useState<string | null>(null), [frozen, setFrozen] = useState<View | null>(null);
  const [unknownLink, setUnknownLink] = useState(start.unknown);
  const preset = PRESETS.find(p => p.key === presetKey)!, { system, source, white } = bench;
  const elements = sorted(system), selected = elements.find(e => e.id === selectedId) ?? elements[0];

  const p = useMemo(() => paraxial(system), [system]), image = useMemo(() => imageOf(system, source), [system, source]);
  const view = frozen ?? fitView(bench, p, image);
  const dense = useMemo(() => samples(system, source, colorsFor(white)), [system, source, white]);
  const best = useMemo(() => sharpestFocus(bench), [bench]);
  const blur = system.sensorX === null ? NaN : blurAt(dense, system.sensorX), sharpest = best === null ? NaN : blurAt(dense, best);
  const colour = useMemo(() => colorShift(system, source), [system, source]), edge = useMemo(() => sphericalShift(system, source), [system, source]);
  const single = useMemo(() => {
    const lens = elements.length > 1 && best !== null ? equivalentSinglet(p.focal, p.pupilRadius) : null;
    if (!lens) return null;
    const twin: Source = source.kind === 'point' ? { ...source, x: source.x - p.frontPrincipal + paraxial(lens).frontPrincipal } : source;
    if (validate(lens, twin)) return null;
    const fanned = samples(lens, twin, colorsFor(white)), x = bestFocus(fanned, paraxial(lens).lastX);
    return x === null ? null : { rays: fanned, x, blur: blurAt(fanned, x) };
  }, [system, source, white, best, p]);

  /** Applies a change if the result can be built. Anything but a sensor move refocuses while autofocus is on. */
  function commit(next: BenchState, moved: 'sensor' | 'other' = 'other', quiet = false, refocus = tracking) {
    const follow = refocus && moved !== 'sensor';
    const problem = validate(follow ? { ...next.system, sensorX: null } : next.system, next.source);
    if (problem) { if (!quiet) setError(problem); return; }
    if (moved === 'sensor') setTracking(false);
    setError(null); setBench(follow ? focused(next) : next);
  }
  function load(key: string) {
    setPresetKey(key); setBench(PRESETS.find(q => q.key === key)!.build()); setTracking(true); setSelectedId(null); setError(null); setUnknownLink(false);
    window.history.replaceState(null, '', `?preset=${key}`);
  }
  const setSystem = (next: System, moved: 'sensor' | 'other' = 'other') => commit({ ...bench, system: next }, moved);
  const setSource = (next: Source) => commit({ ...bench, source: next });
  function edit(patch: Partial<Element>) {
    const at = elements.indexOf(selected), before = elements[at - 1], after = elements[at + 1];
    const grow = patch.thickness === undefined ? 0 : patch.thickness - selected.thickness;
    setSystem({
      ...system,
      stop: system.stop && system.stop.x > selected.x ? { ...system.stop, x: system.stop.x + grow } : system.stop,
      elements: system.elements.map(e => {
        if (e.id === selected.id) return { ...e, ...patch };
        if (patch.c1 !== undefined && before && e.id === before.id && cemented(before, selected)) return { ...e, c2: patch.c1 };
        if (patch.c2 !== undefined && after && e.id === after.id && cemented(selected, after)) return { ...e, c1: patch.c2, x: e.x + grow };
        return e.x > selected.x ? { ...e, x: e.x + grow } : e;
      }),
    });
  }
  function addLens(sign: 1 | -1) {
    const last = elements[elements.length - 1], semi = last.semi, c = sign * 0.2 / semi, depth = sag(Math.abs(c), semi);
    const lens: Element = { id: Math.max(...elements.map(e => e.id)) + 1, x: round(last.x + last.thickness + Math.max(0, sag(last.c2, last.semi)) + semi * 0.5 + (sign < 0 ? depth : 0)), c1: c, c2: -c, thickness: round(sign > 0 ? 2 * depth + Math.max(0.6, semi * 0.1) : Math.max(0.6, semi * 0.15)), semi, glass: 'crown' };
    setTracking(true); setSelectedId(lens.id); commit({ ...bench, system: { ...system, elements: [...system.elements, lens] } }, 'other', false, true);
  }
  function toggleStop(on: boolean) {
    const first = elements[0];
    setSystem({ ...system, stop: on ? { x: round(first.x + Math.min(0, sag(first.c1, first.semi)) - Math.max(1, first.semi * 0.15)), radius: round(first.semi / 2) } : null });
  }
  function switchSource(kind: Source['kind']) {
    if (kind === source.kind) return;
    const first = elements[0], reach = Number.isFinite(p.focal) ? Math.abs(p.focal) * 2 : 100;
    setSource(kind === 'parallel' ? { kind, angle: 0 } : { kind, x: round(p.firstX - reach, 1), height: round(first.semi * 0.6, 1) });
  }

  const distance = source.kind === 'point' ? p.firstX - source.x : 0, tallest = elements[0].semi * 1.5;
  const curveText = (c: number, front: boolean) => Math.abs(c) < 1e-6 ? 'flat' : `${(front ? c > 0 : c < 0) ? 'bulges out' : 'curves in'} · R ${(1 / Math.abs(c)).toFixed(Math.abs(c) > 0.05 ? 1 : 0)} mm`;
  const upright = source.kind === 'point' ? image.magnification > 0 : p.focal < 0;
  const imageText = image.kind === 'infinity' ? 'At infinity' : `${image.kind === 'real' ? 'Real' : 'Virtual'} · ${upright ? 'upright' : 'upside down'}`;
  const imagePlace = image.kind === 'infinity' ? 'The rays leave parallel, ready for a relaxed eye.' : image.x > p.lastX ? `${mm(image.x - p.lastX)} behind the last lens` : `${mm(p.lastX - image.x)} before the last lens surface`;
  const power = !Number.isFinite(p.focal) ? 'Afocal: parallel in, parallel out' : p.focal > 0 ? 'Converging: bends rays together' : elements.length > 1 && image.kind === 'infinity' ? 'Negative overall: the two stages flip the image' : 'Diverging: spreads rays apart';
  const plane = system.sensorX ?? (image.kind === 'virtual' ? image.x : null);
  const ratio = single && sharpest > 0 ? single.blur / sharpest : NaN;

  return <div className="lens-app">
    <header className="lens-header"><a className="lens-brand" href="/"><span><Aperture size={20} strokeWidth={1.6} /></span>lens<span className="muted">lab.</span></a><a className="lens-back" href="/"><ArrowLeft size={13} />All simulators</a></header>
    <main>
      <section className="lens-hero"><div><span className="eyebrow">AN INTERACTIVE OPTICS BENCH</span><h1>One lens bends light.<br />A stack makes it <em>sharp.</em></h1><p>Shape a convex or concave lens and watch every ray obey Snell’s law.<br />Then stack lenses the way a camera and a microscope do.</p><a href="#bench">Step up to the bench <ArrowDown size={14} /></a></div>
        <div className="lens-hero-note" aria-hidden="true"><svg viewBox="0 0 220 90"><path d="M10 20 L96 20 L206 62 M10 45 H206 M10 70 L96 70 L206 28" fill="none" stroke="#7fa0ae" strokeWidth="1.3" /><path d="M96 8 Q112 45 96 82 Q80 45 96 8Z" fill="#b9d8e2" fillOpacity=".7" stroke="#6f93a3" /><circle cx="151" cy="45" r="3" fill="#827b9f" /></svg><p>Light slows down in glass.<br />Curved glass turns that into focus.</p><span>CONVEX · CONCAVE · DOUBLET · TRIPLET</span></div></section>
      <div className="lens-section-heading"><span className="eyebrow">THE OPTICAL BENCH</span><span>REAL RAY TRACING · MILLIMETRES · LIGHT TRAVELS LEFT TO RIGHT</span></div>
      <section id="bench" className="lens-lab" aria-label="Lens simulation">
        <aside className="lens-settings">
          <div className="lens-panel-heading"><h2>Build the experiment</h2><SlidersHorizontal size={15} /></div>
          <label className="lens-label" htmlFor="lens-preset">Start with an experiment</label>
          <select id="lens-preset" value={presetKey} onChange={event => load(event.target.value)}>{GROUPS.map(group => <optgroup key={group} label={group}>{PRESETS.filter(q => q.group === group).map(q => <option key={q.key} value={q.key}>{q.name}</option>)}</optgroup>)}</select>
          <p className="lens-hint" data-testid="lens-notice">{preset.notice}</p>
          {unknownLink && <p className="lens-error" role="status">That link names an experiment this lab does not have, so it opened the first one.</p>}

          <details open><summary>The light</summary><div className="lens-fields">
            <div className="lens-switch" role="group" aria-label="Light source"><button aria-pressed={source.kind === 'point'} onClick={() => switchSource('point')}>Nearby object</button><button aria-pressed={source.kind === 'parallel'} onClick={() => switchSource('parallel')}>Distant light</button></div>
            {source.kind === 'point' ? <>
              <Slider label="Object distance" value={round(distance, 1)} min={2} max={Math.max(400, Math.ceil(distance))} step={0.1} text={mm(distance)} onChange={value => setSource({ ...source, x: round(p.firstX - value) })} />
              <Slider label="Object height" value={source.height} min={-tallest} max={tallest} step={tallest < 12 ? 0.05 : 0.5} text={`${source.height.toFixed(tallest < 12 ? 2 : 1)} mm`} onChange={height => setSource({ ...source, height })} />
            </> : <Slider label="Tilt of the incoming light" value={source.angle} min={0} max={25} step={0.5} text={`${source.angle.toFixed(1)}°`} onChange={angle => setSource({ kind: 'parallel', angle })} />}
            <label className="lens-check"><input type="checkbox" checked={white} onChange={event => commit({ ...bench, white: event.target.checked })} />White light (blue, green, and red)</label>
            <label className="lens-check"><input type="checkbox" checked={textbook} onChange={event => setTextbook(event.target.checked)} />Show the textbook prediction</label>
            <Slider label="Rays drawn" value={rays} min={3} max={21} step={2} text={`${rays} per colour`} onChange={setRays} />
          </div></details>

          <details open><summary>The lenses</summary><div className="lens-fields">
            <div className="lens-elements" role="group" aria-label="Lenses on the bench">{elements.map((e, i) => <button key={e.id} aria-pressed={e.id === selected.id} onClick={() => setSelectedId(e.id)}><b>{i + 1}</b>{describe(e)}<small>{Number.isFinite(elementFocal(e)) ? `f ${elementFocal(e).toFixed(0)}` : 'no power'}</small></button>)}</div>
            <div className="lens-add"><button onClick={() => addLens(1)}><Plus size={12} />Add convex lens</button><button onClick={() => addLens(-1)}><Minus size={12} />Add concave lens</button></div>
            <p className="lens-editing">Editing lens {elements.indexOf(selected) + 1} · <span data-testid="lens-selected-shape">{describe(selected)}</span></p>
            <Slider label="Position" value={round(selected.x, 1)} min={Math.floor(view.x0)} max={Math.ceil(view.x1)} step={0.1} text={mm(selected.x)} onChange={x => setSystem(moveGroup(system, selected.id, x))} />
            <Slider label="Front surface" value={round(selected.c1 * 1000, 1)} min={-150} max={150} step={0.5} text={curveText(selected.c1, true)} onChange={value => edit({ c1: value / 1000 })} />
            <Slider label="Back surface" value={round(-selected.c2 * 1000, 1)} min={-150} max={150} step={0.5} text={curveText(selected.c2, false)} onChange={value => edit({ c2: -value / 1000 })} />
            <Slider label="Thickness at the centre" value={selected.thickness} min={0.5} max={30} step={0.1} text={mm(selected.thickness)} onChange={thickness => edit({ thickness })} />
            <Slider label="Diameter" value={selected.semi * 2} min={2} max={80} step={0.5} text={mm(selected.semi * 2)} onChange={value => edit({ semi: value / 2 })} />
            <label className="lens-label" htmlFor="lens-glass">Glass</label>
            <select id="lens-glass" value={selected.glass} onChange={event => edit({ glass: event.target.value as GlassKey })}>{Object.entries(GLASSES).map(([key, glass]) => <option key={key} value={key}>{glass.name} · n {glass.nd.toFixed(3)}</option>)}</select>
            <button className="lens-remove" disabled={elements.length < 2} onClick={() => { setSelectedId(null); setSystem({ ...system, elements: system.elements.filter(e => e.id !== selected.id) }); }}><Trash2 size={12} />Remove this lens</button>
          </div></details>

          <details open><summary>Aperture and sensor</summary><div className="lens-fields">
            <label className="lens-check"><input type="checkbox" checked={system.stop !== null} onChange={event => toggleStop(event.target.checked)} />Aperture stop</label>
            {system.stop && <>
              <Slider label="Aperture position" value={round(system.stop.x, 1)} min={Math.floor(view.x0)} max={Math.ceil(view.x1)} step={0.1} text={mm(system.stop.x)} onChange={x => setSystem({ ...system, stop: { ...system.stop!, x } })} />
              <Slider label="Aperture opening" value={system.stop.radius * 2} min={0.4} max={80} step={0.2} text={mm(system.stop.radius * 2)} onChange={value => setSystem({ ...system, stop: { ...system.stop!, radius: value / 2 } })} />
            </>}
            {system.sensorX !== null
              ? <Slider label="Sensor position" value={round(system.sensorX)} min={Math.ceil((p.lastX + 0.5) * 20) / 20} max={Math.ceil(Math.max(p.lastX + 300, system.sensorX))} step={0.05} text={`${mm(system.sensorX - p.lastX)} behind`} onChange={sensorX => setSystem({ ...system, sensorX }, 'sensor')} />
              : <p className="lens-hint" data-testid="lens-no-sensor">No sensor on the bench: these rays never come together behind the last lens.</p>}
            <button className="lens-primary" onClick={() => commit(bench, 'other', false, true)}><Focus size={13} />Autofocus</button>
            <label className="lens-check"><input type="checkbox" checked={tracking} onChange={event => { setTracking(event.target.checked); if (event.target.checked) commit(bench, 'other', false, true); }} />Keep the sensor in focus as I change things</label>
          </div></details>
          {error && <p className="lens-error" role="alert">{error}</p>}
          <div className="lens-tip"><Lightbulb size={16} /><p>Drag the object, any lens, the aperture, or the sensor directly on the bench.</p></div>
        </aside>

        <div className="lens-stage">
          <div className="lens-bench-heading"><div><span className="lens-status-dot" />{preset.name}</div><span>{elements.length} {elements.length === 1 ? 'LENS' : 'LENSES'} · <b>{Number.isFinite(p.focal) ? `f ${p.focal.toFixed(1)} mm` : 'afocal'}</b></span></div>
          <Bench bench={bench} view={view} p={p} image={image} rays={rays} textbook={textbook} selected={selected.id} onSelect={setSelectedId} onDrag={setFrozen}
            onChange={(next, target) => commit(next, target === 'sensor' ? 'sensor' : 'other', true)} />
          <div className="lens-legend">{colorsFor(white).map(key => <span key={key}><i className={key} />{key} light</span>)}<span><i className="glass" />glass</span>{textbook && <span><i className="textbook" />textbook points F, F′ and planes H, H′</span>}{image.kind === 'virtual' && <span><i className="dashed" />rays traced backward</span>}</div>
          <div className="lens-stats">
            <Stat label="Focal length" id="lens-focal" value={mm(p.focal)}>{power}</Stat>
            <Stat label="Opening" id="lens-fnumber" value={Number.isFinite(p.fNumber) ? `f/${p.fNumber.toFixed(1)}` : '—'}>Light gets through a {mm(p.pupilRadius * 2)} wide beam.</Stat>
            <Stat label="Image" id="lens-image-type" value={imageText}>{imagePlace}</Stat>
            {source.kind === 'point' && image.kind !== 'infinity' && <Stat label="Magnification" id="lens-magnification" value={`${image.magnification.toFixed(2)}×`}>The image is {length(Math.abs(image.height))} tall.</Stat>}
            {image.kind === 'infinity' && <Stat label="Magnifying power" id="lens-magnification" value={`${Math.abs(image.angular).toFixed(Math.abs(image.angular) < 10 ? 1 : 0)}×`}>{source.kind === 'point' ? 'Compared with the naked eye at 250 mm.' : 'Angle out compared with angle in.'}</Stat>}
            {source.kind === 'parallel' && image.kind !== 'infinity' && <Stat label="Image height" id="lens-magnification" value={source.angle === 0 ? '0 mm' : length(Math.abs(image.height))}>For light tilted {source.angle.toFixed(1)}°. Longer focal length, bigger image.</Stat>}
            <Stat label="Blur at the sensor" id="lens-blur" value={length(blur)}>{best === null ? 'No sensor, so nothing to blur.' : blur <= sharpest * 1.01 ? 'The sensor is at the sharpest spot.' : `Sharpest possible here: ${length(sharpest)}.`}</Stat>
            <Stat label="Colour error" id="lens-colour-shift" value={length(Math.abs(colour))}>{!Number.isFinite(colour) ? 'Not measured for a parallel exit beam.' : Math.abs(colour) < 1e-6 ? 'Every colour focuses together.' : `Blue focuses ${colour < 0 ? 'before' : 'after'} red.`}</Stat>
            <Stat label="Edge-ray error" id="lens-edge-shift" value={length(Math.abs(edge))}>{!Number.isFinite(edge) ? 'Not measured for a parallel exit beam.' : `Edge rays cross ${edge < 0 ? 'before' : 'after'} the textbook focus.`}</Stat>
            <Stat label="One lens instead" id="lens-single-blur" value={single ? length(single.blur) : '—'}>{single ? `A single lens with this focal length and opening blurs ${ratio >= 1.05 ? `${ratio.toFixed(ratio < 10 ? 1 : 0)}× more` : 'about as much'}.` : elements.length < 2 ? 'This already is a single lens.' : 'No comparison for this setup.'}</Stat>
          </div>
          <section className="lens-trends" aria-label="Focus quality">
            <div className="lens-chart"><div className="lens-chart-heading"><h3>A close-up of the focus</h3><span>THE LAST STRETCH OF EVERY RAY, MAGNIFIED</span></div><FocusCloseUp rays={dense} sensorX={system.sensorX} best={best} /><p>A perfect lens would pinch every ray through one point. The thinner the waist, the sharper the picture.</p></div>
            <div className="lens-chart"><div className="lens-chart-heading"><h3>Where each ray lands</h3><span>{plane === null ? 'EXIT DIRECTION ERROR' : `MISS DISTANCE AT THE ${system.sensorX === null ? 'VIRTUAL IMAGE' : 'SENSOR'}`} BY ENTRY HEIGHT</span></div><RayFan rays={dense} sensorX={plane} compare={system.sensorX === null ? null : single} /><p>A flat line means every part of the lens agrees.{single ? ' The dashed grey curve is one plain lens doing the same job.' : ''}</p></div>
          </section>

        </div>
      </section>

      <section className="lens-understand"><span className="eyebrow">WHAT THE BENCH IS SHOWING</span><h2>Three ideas, <em>one bench.</em></h2>
        <div className="lens-explanations">
          <article><span>01 · CONVEX AND CONCAVE</span><h3>The shape decides the bend.</h3><p>Glass slows light, and a tilted surface turns that slowdown into a change of direction. A convex lens is thicker in the middle and steers rays together to a real image. A concave lens is thinner in the middle and fans them out, so the image is virtual: it is only where the rays <em>seem</em> to come from.</p></article>
          <article><span>02 · WHY ONE LENS IS NOT ENOUGH</span><h3>A sphere is the wrong shape.</h3><p>Spherical surfaces are easy to grind, but their edges bend light too strongly, and glass bends blue more than red. A single lens therefore smears every point into a coloured blur. Closing the aperture hides the edge error at the cost of light. It cannot fix the colour.</p></article>
          <article><span>03 · STACKING LENSES</span><h3>Errors that cancel.</h3><p>A concave flint lens has the opposite errors of a convex crown lens, and more of them per unit of bending. Pair them and the errors cancel while focusing power remains. A camera triplet adds a third lens to stay sharp off-axis. A microscope stacks two such groups to magnify twice.</p></article>
        </div>
        <details className="lens-rules"><summary>Inside the model</summary><div>
          <p>Every drawn ray is traced exactly: it is intersected with each spherical surface and refracted with Snell’s law, <code>n₁ sin θ₁ = n₂ sin θ₂</code>, using the glass’s refractive index for that colour. Rays that miss a lens, hit the aperture, or reflect totally inside the glass stop there.</p>
          <p>The “textbook prediction” uses the small-angle (paraxial) approximation: focal points F and F′, principal planes H and H′, and the image position from <code>1/s + 1/s′ = 1/f</code>. The gap between the textbook image and where the real rays go is the aberration.</p>
          <p>The bench is a flat slice through the lens axis, so it shows spherical aberration, colour error, coma, and field curvature, but not astigmatism. It ignores diffraction, reflections, and coatings. The camera lens is a classic Cooke triplet prescription; the doublets are a crown and flint pair solved for this lab.</p>
        </div></details>
      </section>
    </main>
    <footer><span>lens lab. · lixionary / simulators</span><a href="/">Explore all simulators <ArrowUpRight size={12} /></a></footer>
  </div>;
}
