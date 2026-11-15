import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowUpRight, Lightbulb, Pause, Play, SlidersHorizontal, Telescope } from 'lucide-react';
import { bendingAtRing, countImages, crossingTime, einsteinRadius, lightCurve, ringMass, ringSize, TRACK, type Lens, type Source, type SourceKind } from './model';
import { angle, lightYears, span, suns, times, timespan } from './format';
import { PRESETS } from './presets';
import { LightCurve, SideView, Sky } from './Views';

const GROUPS = [...new Set(PRESETS.map(p => p.group))];
const XS = Array.from({ length: 89 }, (_, i) => -TRACK + i * 2 * TRACK / 88);
const SOURCES: { key: SourceKind; name: string }[] = [{ key: 'star', name: 'A star' }, { key: 'galaxy', name: 'A galaxy' }, { key: 'field', name: 'Many galaxies' }];
const MILLIARCSECOND = Math.PI / 648_000_000;

function startingPreset() {
  const key = new URLSearchParams(window.location.search).get('preset'), found = PRESETS.find(p => p.key === key);
  return { preset: found ?? PRESETS[0], unknown: key !== null && !found };
}

function Slider({ label, value, min, max, step, text, onChange }: { label: string; value: number; min: number; max: number; step: number; text: string; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="gl-slider"><div><label htmlFor={id}>{label}</label><output htmlFor={id}>{text}</output></div><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></div>;
}
function Stat({ label, id, value, children }: { label: string; id: string; value: string; children: ReactNode }) {
  return <div><span>{label}</span><b data-testid={id}>{value}</b><small>{children}</small></div>;
}
const log = (value: number) => Math.round(Math.log10(value) * 100) / 100;

export default function App() {
  const [start] = useState(startingPreset);
  const [presetKey, setPresetKey] = useState(start.preset.key), [lens, setLens] = useState<Lens>(start.preset.lens), [source, setSource] = useState<Source>(start.preset.source);
  const [showRing, setShowRing] = useState(true), [showLens, setShowLens] = useState(true), [playing, setPlaying] = useState(false);
  const [unknownLink, setUnknownLink] = useState(start.unknown);
  const preset = PRESETS.find(p => p.key === presetKey)!, shear = lens.kind === 'galaxy' ? lens.shear : 0;

  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const step = (now - last) / 1000 * 0.55; last = now;
      setSource(s => ({ ...s, x: Math.min(TRACK, s.x + step) }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => { if (source.x >= TRACK) setPlaying(false); }, [source.x]);

  const ring = einsteinRadius(lens), size = ringSize(lens), mass = ringMass(lens), cross = crossingTime(lens);
  const gains = useMemo(() => lightCurve(lens.kind, shear, source.size, source.y, XS), [lens.kind, shear, source.size, source.y]);
  const gain = useMemo(() => lightCurve(lens.kind, shear, source.size, source.y, [source.x])[0], [lens.kind, shear, source.size, source.y, source.x]);
  const seen = useMemo(() => countImages(lens.kind, shear, source), [lens.kind, shear, source]);
  const peak = Math.max(...gains), offset = Math.hypot(source.x, source.y);

  function load(key: string) {
    const next = PRESETS.find(p => p.key === key)!;
    setPresetKey(key); setLens(next.lens); setSource(next.source); setPlaying(false); setUnknownLink(false);
    window.history.replaceState(null, '', `?preset=${key}`);
  }
  const patchLens = (patch: Partial<Lens>) => {
    const next = { ...lens, ...patch };
    setLens({ ...next, sourceLy: Math.max(next.sourceLy, next.lensLy * 1.1) });
  };
  const patchSource = (patch: Partial<Source>) => { setPlaying(false); setSource({ ...source, ...patch }); };
  const sky = { kind: lens.kind, shear, source, showRing, showLens };
  const thing = source.kind === 'star' ? 'star' : 'galaxy';

  return <div className="gl-app">
    <header className="gl-header"><a className="gl-brand" href="/"><span><Telescope size={20} strokeWidth={1.6} /></span>gravity lens<span className="muted">lab.</span></a><a className="gl-back" href="/"><ArrowLeft size={13} />All simulators</a></header>
    <main>
      <section className="gl-hero"><div><span className="eyebrow">GENERAL RELATIVITY, AT THE LARGEST SCALE</span><h1>Mass bends light.<br />The sky becomes a <em>lens.</em></h1><p>Put a star, a black hole, or a galaxy in front of something far away. <br />Watch the image split, stretch into arcs, and close into a ring.</p><a href="#lab">Look through the lens <ArrowDown size={14} /></a></div>
        <div className="gl-hero-note" aria-hidden="true"><svg viewBox="0 0 220 90"><path d="M12 45 L110 16 L208 45 M12 45 L110 74 L208 45" fill="none" stroke="#c08a3e" strokeWidth="1.3" /><path d="M12 45H208" stroke="#d8d3dc" strokeDasharray="3 4" /><circle cx="110" cy="45" r="9" fill="#e9c88f" /><circle cx="12" cy="45" r="4" fill="#c08a3e" /><path d="M204 38l10 7l-10 7z" fill="#33444b" /></svg><p>Light takes every path that gravity allows.<br />Sometimes that is more than one.</p><span>PREDICTED 1915 · MEASURED 1919</span></div></section>
      <div className="gl-section-heading"><span className="eyebrow">THE TRUE SKY AND THE LENSED SKY</span><span>EVERY PIXEL TRACED BACK THROUGH THE LENS · NORTH UP</span></div>
      <section id="lab" className="gl-lab" aria-label="Gravitational lensing simulation">
        <aside className="gl-settings">
          <div className="gl-panel-heading"><h2>Build the experiment</h2><SlidersHorizontal size={15} /></div>
          <label className="gl-label" htmlFor="gl-preset">Start with an experiment</label>
          <select id="gl-preset" value={presetKey} onChange={event => load(event.target.value)}>{GROUPS.map(group => <optgroup key={group} label={group}>{PRESETS.filter(p => p.group === group).map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</optgroup>)}</select>
          <p className="gl-hint" data-testid="gl-notice">{preset.notice}</p>
          {unknownLink && <p className="gl-error" role="status">That link names an experiment this lab does not have, so it opened the first one.</p>}

          <details open><summary>The lens</summary><div className="gl-fields">
            <div className="gl-switch" role="group" aria-label="Kind of lens"><button aria-pressed={lens.kind === 'point'} onClick={() => patchLens({ kind: 'point' })}>Star or black hole</button><button aria-pressed={lens.kind === 'galaxy'} onClick={() => patchLens({ kind: 'galaxy' })}>Galaxy or cluster</button></div>
            {lens.kind === 'point'
              ? <Slider label="Mass" value={log(lens.massSolar)} min={-3} max={10} step={0.05} text={suns(lens.massSolar)} onChange={value => patchLens({ massSolar: 10 ** value })} />
              : <>
                <Slider label="How fast its stars move" value={lens.sigmaKms} min={50} max={1500} step={5} text={`${lens.sigmaKms} km/s`} onChange={sigmaKms => patchLens({ sigmaKms })} />
                <Slider label="Lopsidedness" value={lens.shear} min={0} max={0.3} step={0.01} text={lens.shear === 0 ? 'perfectly round' : lens.shear.toFixed(2)} onChange={value => patchLens({ shear: value })} />
              </>}
            <Slider label="Distance to the lens" value={log(lens.lensLy)} min={2} max={9.9} step={0.02} text={lightYears(lens.lensLy)} onChange={value => patchLens({ lensLy: 10 ** value })} />
            <Slider label="Distance to the background" value={log(lens.sourceLy)} min={log(lens.lensLy * 1.1)} max={10.1} step={0.02} text={lightYears(lens.sourceLy)} onChange={value => patchLens({ sourceLy: Math.max(10 ** value, lens.lensLy * 1.1) })} />
          </div></details>

          <details open><summary>The background</summary><div className="gl-fields">
            <div className="gl-switch three" role="group" aria-label="Kind of background">{SOURCES.map(s => <button key={s.key} aria-pressed={source.kind === s.key} onClick={() => patchSource({ kind: s.key })}>{s.name}</button>)}</div>
            <Slider label="Size" value={source.size} min={0.03} max={0.5} step={0.01} text={`${source.size.toFixed(2)} ring radii`} onChange={value => patchSource({ size: value })} />
            <Slider label="Position along its path" value={source.x} min={-TRACK} max={TRACK} step={0.01} text={`${source.x.toFixed(2)} ring radii`} onChange={x => patchSource({ x })} />
            <Slider label="Closest pass" value={source.y} min={-TRACK} max={TRACK} step={0.01} text={`${source.y.toFixed(2)} ring radii`} onChange={y => patchSource({ y })} />
            <button className="gl-primary" onClick={() => { if (!playing && source.x >= TRACK) setSource({ ...source, x: -TRACK }); setPlaying(!playing); }}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Pause' : 'Let it drift past'}</button>
          </div></details>

          <details open><summary>On the picture</summary><div className="gl-fields">
            <label className="gl-check"><input type="checkbox" checked={showRing} onChange={event => setShowRing(event.target.checked)} />Mark the Einstein ring</label>
            <label className="gl-check"><input type="checkbox" checked={showLens} onChange={event => setShowLens(event.target.checked)} />Show the lens’s own light</label>
          </div></details>
          <div className="gl-tip"><Lightbulb size={16} /><p>Drag the background anywhere in the true sky. The dashed circle is one ring radius.</p></div>
        </aside>

        <div className="gl-stage">
          <div className="gl-stage-heading"><div><span className="gl-status-dot" />{preset.name}</div><span>EACH PICTURE IS <b>{angle(ring * 5.6)}</b> ACROSS</span></div>
          <div className="gl-skies">
            <figure><Sky {...sky} lensed={false} onMove={(x, y) => patchSource({ x, y })} label={`The true sky. The background ${thing} is ${offset.toFixed(2)} ring radii from the lens.`} /><figcaption><b>The true sky</b>Where things really are. Drag the {thing}.</figcaption></figure>
            <figure><Sky {...sky} lensed label={`The sky through the lens: ${seen.ring ? 'a ring' : `${seen.count} ${seen.count === 1 ? 'image' : 'images'}`}, ${times(gain)} as bright.`} /><figcaption><b>Through the lens</b>What a telescope would record.</figcaption></figure>
          </div>
          <div className="gl-stats">
            <Stat label="Einstein ring radius" id="gl-ring" value={angle(ring)}>{ring < 10 * MILLIARCSECOND ? 'Far too small for any telescope to see as a ring.' : ring < 0.3 * 1000 * MILLIARCSECOND ? 'Within reach of the sharpest telescopes.' : 'Wide enough for a large telescope to show clearly.'}</Stat>
            <Stat label="Ring size at the lens" id="gl-ring-size" value={span(size)}>Light we receive passes the lens about this far out.</Stat>
            <Stat label="Bending at the ring" id="gl-bending" value={angle(bendingAtRing(lens))}>How much that light is turned from a straight line.</Stat>
            <Stat label="Mass inside the ring" id="gl-mass" value={suns(mass)}>{lens.kind === 'point' ? 'The whole lens. Ring size and distances give it directly.' : 'Read off the ring’s size. Usually far more than the visible stars.'}</Stat>
            <Stat label="What you see" id="gl-images" value={seen.ring ? 'A ring' : `${seen.count} ${seen.count === 1 ? 'image' : 'images'}`}>{seen.ring ? 'Lens and background are lined up.' : seen.count === 4 ? 'A lopsided lens and a near-perfect line-up.' : seen.count === 2 ? 'One on each side of the lens.' : seen.count === 1 ? 'Too far off-centre for a second image.' : `Of the chosen ${thing}.`}</Stat>
            <Stat label="Brightness" id="gl-brightness" value={times(gain)}>{gain > 1.005 ? 'All images together, against no lens at all.' : 'No measurable change at this distance.'}</Stat>
            <Stat label="Peak on this path" id="gl-peak" value={times(peak)}>The most it brightens while drifting past.</Stat>
            <Stat label="Time to cross the ring" id="gl-crossing" value={timespan(cross)}>At 200 km/s, a typical drift between stars.</Stat>
          </div>
          <section className="gl-charts" aria-label="Brightness and geometry">
            <div className="gl-chart"><div className="gl-chart-heading"><h3>Brightness as it drifts past</h3><span>TOTAL LIGHT AGAINST NO LENS</span></div><LightCurve xs={XS} gains={gains} at={source.x} duration={`one ring radius: ${timespan(cross)}`} /><p>When the images are too close to tell apart, this rise and fall is all a telescope records. Its width gives the lens’s mass.</p></div>
            <div className="gl-chart"><div className="gl-chart-heading"><h3>The same thing from the side</h3><span>A SLICE THROUGH LENS AND BACKGROUND</span></div><SideView kind={lens.kind} offset={offset} lopsided={shear > 0} /><p>The eye assumes light came straight. Follow each arriving ray backward (dashed) and you get an image in the wrong place.</p></div>
          </section>
        </div>
      </section>

      <section className="gl-understand"><span className="eyebrow">WHAT THE LAB IS SHOWING</span><h2>One bend, <em>many pictures.</em></h2>
        <div className="gl-explanations">
          <article><span>01 · LIGHT FOLLOWS CURVED SPACE</span><h3>Twice what Newton allows.</h3><p>Light passing a mass turns by 4GM/(c²b), where b is how close it passes. That is double the value from Newton’s gravity. For starlight grazing the Sun it comes to 1.75 arcseconds, and the 1919 eclipse photographs found it. Einstein became famous overnight.</p></article>
          <article><span>02 · RINGS, ARCS, AND CROSSES</span><h3>Line-up decides the shape.</h3><p>A lens offers light more than one route around it. Slightly off-centre you get an arc and a small counter-image. Dead centre they close into a ring. A lopsided galaxy breaks the ring into four. None of it changes colour, since gravity bends every wavelength alike.</p></article>
          <article><span>03 · FROM THEORY TO A SCALE</span><h3>Weighing what cannot be seen.</h3><p>The ring’s size depends only on mass and distance, so a lens is a balance. It shows galaxies hold about five times more mass than their stars and gas: dark matter. It finds planets and lone black holes by a brief brightening. It also magnifies the earliest galaxies for free.</p></article>
        </div>
        <details className="gl-rules"><summary>Inside the model</summary><div>
          <p>Every pixel of the lensed sky is traced backward with the lens equation, <code>β = θ − α(θ)</code>: where you look (θ), less the bending (α), is where the light came from (β). The colour found there is painted at θ. Lensing never changes surface brightness, only apparent area.</p>
          <p>A star or black hole bends by <code>α = θ<sub>E</sub>²/θ</code>, with ring radius <code>θ<sub>E</sub> = √(4GM/c² · D<sub>LS</sub>/(D<sub>L</sub>D<sub>S</sub>))</code>. A galaxy or cluster is an isothermal sphere: its stars move at the same speed σ everywhere, it bends by the same amount at every distance, and <code>θ<sub>E</sub> = 4π(σ/c)² · D<sub>LS</sub>/D<sub>S</sub></code>. Lopsidedness is an external shear γ added to that.</p>
          <p>Brightness is the area of all images divided by the area of the source, summed on a fine grid for a soft-edged round source. For a small star behind a compact lens it matches the textbook curve <code>(u² + 2)/(u√(u² + 4))</code>.</p>
          <p>Left out: the expansion of the universe (distances here simply subtract), the delay between images, lenses made of two bodies (which is how planets show up, as a blip on the curve), and the blur of a real telescope.</p>
        </div></details>
      </section>
    </main>
    <footer><span>gravity lens lab. · lixionary / simulators</span><a href="/">Explore all simulators <ArrowUpRight size={12} /></a></footer>
  </div>;
}
