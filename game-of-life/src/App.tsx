import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowDown, Sprout, Droplets, HeartPulse, FastForward, Link2, Pause, Play, RotateCcw, StepForward, Shuffle, Users, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { CONFIG_LIMITS, configFromQuery, configToQuery, initialState, PRESETS, reproductionReadiness, RULES, step, type Config, type World } from './model';

type Overlay = 'both' | 'food' | 'water';
const FLOW_WINDOW = 10;
const CAUSES = [
  { key: 'age', label: 'Age', color: '#897aa0' }, { key: 'sickness', label: 'Sickness', color: '#ae6a56' },
  { key: 'starvation', label: 'Starvation', color: '#66805b' }, { key: 'dehydration', label: 'Dehydration', color: '#588a9a' },
] as const;
const percentageKeys = new Set<keyof Config>(['birthChance', 'initialSickness', 'transmission', 'recovery']);
const fieldGroups: { title: string; fields: [keyof Config, string][] }[] = [
  { title: 'The starting habitat', fields: [['population', 'Starting population'], ['foodFullness', 'Initial food (%)'], ['waterFullness', 'Initial water (%)'], ['foodGrowth', 'Food regrowth / cell / tick'], ['waterGrowth', 'Water regrowth / cell / tick']] },
  { title: 'Life & the next generation', fields: [['lifespan', 'Lifespan (ticks)'], ['maturity', 'Maturity age (ticks)'], ['birthChance', 'Pair birth chance (%)'], ['cooldown', 'Birth cooldown (ticks)']] },
  { title: 'Sickness & recovery', fields: [['initialSickness', 'Initially sick (%)'], ['transmission', 'Transmission / contact (%)'], ['recovery', 'Recovery / tick (%)'], ['sicknessSeverity', 'Sick aging multiplier'], ['immunity', 'Immunity after recovery (ticks)']] },
];
function draftFor(config: Config): Record<keyof Config, string> {
  return Object.fromEntries(Object.entries(config).map(([key, value]) => [key, String(Number((value * (percentageKeys.has(key as keyof Config) ? 100 : 1)).toFixed(5)))])) as Record<keyof Config, string>;
}
const number = (value: number) => Math.round(value).toLocaleString('en-US');
// A shared link names its run in the query; a bad link falls back to the default run and says why.
function loadRun(): { world: World; error: string } {
  try {
    const run = configFromQuery(window.location.search);
    return { world: run ? initialState(run.config, run.seed) : initialState(), error: '' };
  } catch (e) { return { world: initialState(), error: `This link's settings were ignored: ${(e as Error).message}` }; }
}
function presetFor(config: Config): number {
  return Math.max(0, PRESETS.findIndex(p => (Object.keys(config) as (keyof Config)[]).every(key => p.config[key] === config[key])));
}

function Habitat({ world, overlay, selected, family, onSelect }: { world: World; overlay: Overlay; selected: number | null; family: Set<number>; onSelect: (id: number) => void }) {
  return <svg className="life-habitat" viewBox="0 0 768 480" role="group" aria-label="Population habitat" data-testid="life-habitat">
    <title>Wrapping habitat: 32 by 20 cells. Select an individual here or with the inspector below.</title>
    <rect width="768" height="480" fill="#eff0e5" />
    {world.cells.map((cell, i) => {
      const x = (i % RULES.width) * 24, y = Math.floor(i / RULES.width) * 24;
      return <g key={i} aria-hidden="true">
        <rect x={x + 0.5} y={y + 0.5} width="23" height="23" rx="2" fill={overlay === 'water' ? '#749da7' : '#8aa37b'} opacity={0.04 + (overlay === 'water' ? cell.water : cell.food) / 100 * 0.4} />
        {overlay === 'both' && <rect x={x + 3} y={y + 20} width={18 * cell.water / 100} height="2" rx="1" fill="#588a9a" opacity=".65" />}
      </g>;
    })}
    {world.individuals.map(p => {
      const x = p.x * 24 + 8 + (p.id % 3) * 4, y = p.y * 24 + 8 + (Math.floor(p.id / 3) % 3) * 4;
      const juvenile = p.age < world.config.maturity, immune = !p.sick && p.immuneTicks > 0;
      return <g key={p.id} transform={`translate(${x} ${y})`} role="button" tabIndex={-1} aria-label={`Inspect individual ${p.id}`} aria-pressed={selected === p.id}
        onClick={() => onSelect(p.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.id); } }}>
        <title>#{p.id} · {p.sick ? 'sick' : juvenile ? 'juvenile' : 'healthy adult'}{immune ? ' · immune' : ''} · age {p.age}</title>
        <circle r="9" fill="transparent" />
        {selected === p.id && <circle r="8" fill="none" stroke="#45483a" strokeWidth="1.5" strokeDasharray="2 2" />}
        {family.has(p.id) && <circle r="8" fill="none" stroke="#c98a35" strokeWidth="1.6" data-family="" />}
        {immune && <circle r="6.6" fill="none" stroke="#588a9a" strokeWidth="1.1" />}
        {juvenile ? <path d="M0 -5 L5 0 L0 5 L-5 0 Z" fill={p.sick ? '#ae6a56' : '#897aa0'} stroke="#fffdf6" strokeWidth="1" />
          : <circle r="4.8" fill={p.sick ? '#ae6a56' : '#466b4b'} stroke="#fffdf6" strokeWidth="1" />}
        {p.sick && <path d="M-2 0 H2 M0 -2 V2" stroke="#fffdf6" strokeWidth="1.3" />}
      </g>;
    })}
  </svg>;
}

type Line = { label: string; color: string; values: number[]; latest?: ReactNode };
function Chart({ title, unit, label, ticks, lines, maximum }: { title: string; unit: string; label: string; ticks: [number, number]; lines: Line[]; maximum: number }) {
  const y = (value: number) => 125 - value / maximum * 105;
  return <section className="life-chart">
    <div className="life-chart-heading"><h3>{title}</h3><span>{unit}</span></div>
    <div className="life-chart-legend">{lines.map(line => <span key={line.label}><i style={{ background: line.color }} />{line.label} <b>{line.latest ?? line.values[line.values.length - 1]}</b></span>)}</div>
    <svg viewBox="0 0 600 155" role="img" aria-label={`${label} from tick ${ticks[0]} to ${ticks[1]}`}>
      {[0, 0.5, 1].map(r => <g key={r}><path d={`M35 ${125 - r * 105} H580`} stroke="#e2e3d8" strokeDasharray="3 5" /><text x="27" y={129 - r * 105} textAnchor="end">{Math.round(maximum * r)}</text></g>)}
      {lines.map(line => {
        const count = line.values.length, points = line.values.map((value, i) => `${35 + (count === 1 ? 0 : i / (count - 1) * 545)},${y(value)}`).join(' ');
        return <g key={line.label}><polyline points={points} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" /><circle cx={count === 1 ? 35 : 580} cy={y(line.values[count - 1])} r="3" fill={line.color} /></g>;
      })}
      <text x="35" y="149">TICK {ticks[0]}</text><text x="580" y="149" textAnchor="end">{ticks[1]}</text>
    </svg>
  </section>;
}
function Trends({ world }: { world: World }) {
  const history = world.history, ticks: [number, number] = [history[0].tick, history[history.length - 1].tick];
  const capacity = RULES.width * RULES.height * RULES.cellCapacity / 100;
  const percent = (values: number[]) => `${values[values.length - 1].toFixed(1)}%`;
  // Births and deaths are counted over a trailing window so single ticks do not flicker.
  const recent = (key: 'births' | 'deaths') => history.map((s, i) => s[key] - history[Math.max(0, i - FLOW_WINDOW)][key]);
  const population = history.map(s => s.population), food = history.map(s => s.food / capacity), water = history.map(s => s.water / capacity);
  const births = recent('births'), deaths = recent('deaths');
  const causes = CAUSES.map(cause => ({ label: cause.label, color: cause.color, values: history.map(s => s.causes[cause.key]) }));
  return <section className="life-trends" aria-label="Population and resource trends">
    <Chart title="A population in motion" unit="INDIVIDUALS" label="Population and sickness" ticks={ticks} maximum={Math.max(10, ...population) * 1.1}
      lines={[{ label: 'Population', color: '#66805b', values: population }, { label: 'Sick', color: '#ae6a56', values: history.map(s => s.sick) }, { label: 'Immune', color: '#588a9a', values: history.map(s => s.immune) }]} />
    <Chart title="What the habitat can give" unit="% OF CAPACITY" label="Food and water stocks" ticks={ticks} maximum={100}
      lines={[{ label: 'Food', color: '#66805b', values: food, latest: percent(food) }, { label: 'Water', color: '#588a9a', values: water, latest: percent(water) }]} />
    <Chart title="Arrivals and departures" unit={`PER ${FLOW_WINDOW} TICKS`} label="Births and deaths" ticks={ticks} maximum={Math.max(5, ...births, ...deaths) * 1.1}
      lines={[{ label: 'Births', color: '#66805b', values: births }, { label: 'Deaths', color: '#ae6a56', values: deaths }]} />
    <Chart title="How lives end" unit="DEATHS SINCE TICK 0" label="Deaths by cause" ticks={ticks} maximum={Math.max(5, ...Object.values(world.deaths)) * 1.1} lines={causes} />
  </section>;
}

export default function App() {
  const [loaded] = useState(loadRun);
  const [world, setWorld] = useState(loaded.world);
  const [draft, setDraft] = useState(() => draftFor(loaded.world.config)), [seedDraft, setSeedDraft] = useState(String(loaded.world.seed));
  const [preset, setPreset] = useState(() => presetFor(loaded.world.config)), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(5);
  const [overlay, setOverlay] = useState<Overlay>('both'), [selected, setSelected] = useState<number | null>(null), [error, setError] = useState(loaded.error);
  const [linkNote, setLinkNote] = useState('');
  const sample = world.history[world.history.length - 1], person = world.individuals.find(p => p.id === selected);
  const children = person ? world.individuals.filter(p => p.parents?.includes(person.id)) : [];
  const family = new Set([...(person?.parents ?? []), ...children.map(p => p.id)]);
  const extinct = world.individuals.length === 0;
  const activeDraft = draftFor(world.config);
  const dirty = seedDraft !== String(world.seed) || (Object.keys(draft) as (keyof Config)[]).some(key => draft[key] !== activeDraft[key]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setWorld(previous => step(previous)), 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed]);
  // Nothing is left to watch once the last individual dies; Step still renews the habitat.
  useEffect(() => { if (playing && extinct) setPlaying(false); }, [playing, extinct]);
  useEffect(() => {
    if (!linkNote) return;
    const timer = window.setTimeout(() => setLinkNote(''), 2500);
    return () => window.clearTimeout(timer);
  }, [linkNote]);
  const runUrl = (config: Config, seed: number) => `${window.location.pathname}?${configToQuery(config, seed)}`;
  function restart(config = world.config, seed = world.seed) {
    const next = initialState(config, seed);
    setPlaying(false); setSelected(null); setWorld(next);
    window.history.replaceState(null, '', runUrl(config, seed));
  }
  function skip() {
    setWorld(previous => { let next = previous; for (let i = 0; i < 100; i++) next = step(next); return next; });
  }
  async function copyLink() {
    const url = runUrl(world.config, world.seed);
    window.history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(window.location.origin + url); setLinkNote('Link copied'); }
    catch { setLinkNote('Link is in the address bar'); }
  }
  function apply() {
    try {
      const config = Object.fromEntries((Object.keys(draft) as (keyof Config)[]).map(key => [key, Number(draft[key]) / (percentageKeys.has(key) ? 100 : 1)])) as Config;
      restart(config, Number(seedDraft)); setDraft(draftFor(config)); setSeedDraft(String(Number(seedDraft))); setError('');
    } catch (e) { setError((e as Error).message); }
  }
  function newSeed() {
    const seed = (world.seed + 1 + crypto.getRandomValues(new Uint32Array(1))[0] % 0xFFFFFFFF) >>> 0;
    // Pending experiment settings stay drafts; New seed uses the running experiment.
    restart(world.config, seed); setSeedDraft(String(seed)); setError('');
  }
  return <div className="life-app">
    <header className="life-header"><a className="life-brand" href="/"><span><Sprout size={23} strokeWidth={1.5} /></span>population<span className="muted">lab.</span></a><a href="/" className="life-back"><ArrowLeft size={14} />All simulators</a></header>
    <main>
      <section className="life-hero"><div><span className="eyebrow">AN INTERACTIVE POPULATION ECOSYSTEM</span><h1>A little life.<br />A delicate <em>balance.</em></h1><p>A new generation. A dwindling water supply. A chance to recover.<br />Watch a small world find its way, one tick at a time.</p><a href="#habitat">Make room for a little life <ArrowDown size={14} /></a></div><div className="life-hero-note"><div className="life-generation"><span>● ●</span><ArrowUpRight size={24} /><span>● ●<small>+ one or two</small></span></div><p>Two parents. A new beginning.</p><span>ENOUGH TO THRIVE?<br />THE HABITAT DECIDES.</span></div></section>
      <div className="life-section-heading" id="habitat"><span className="eyebrow">YOUR LITTLE ECOSYSTEM</span><span>32 × 20 CELLS · A WORLD THAT WRAPS</span></div>
      <div className="life-lab">
        <aside className="life-settings">
          <div className="life-panel-heading"><h2>The experiment</h2><SlidersHorizontal size={16} /></div>
          <form onSubmit={e => { e.preventDefault(); apply(); }}>
            <label className="life-label" htmlFor="life-preset">Start with an experiment</label><select id="life-preset" value={preset} onChange={e => { const n = Number(e.target.value); setPreset(n); setDraft(draftFor(PRESETS[n].config)); setError(''); }}>
              {PRESETS.map((p, n) => <option key={p.name} value={n}>{p.name}</option>)}
            </select><p className="life-hint">{PRESETS[preset].hint}</p>
            {fieldGroups.map((group, n) => <details key={group.title} open={n === 0 || undefined}><summary>{group.title}</summary><div className="life-fields">{group.fields.map(([key, label]) => {
              const [min, max, increment] = CONFIG_LIMITS[key], scale = percentageKeys.has(key) ? 100 : 1;
              return <label className="life-field" key={key}><span>{label}</span><input type="number" required min={min * scale} max={max * scale} step={increment * scale} value={draft[key]} onChange={e => { setDraft({ ...draft, [key]: e.target.value }); setError(''); }} /></label>;
            })}</div></details>)}
            <label className="life-field life-seed"><span>Random seed</span><input type="number" min="0" max="4294967295" step="1" required value={seedDraft} onChange={e => setSeedDraft(e.target.value)} /></label>
            <button className="life-primary life-apply" type="submit"><RotateCcw size={14} />Apply &amp; restart</button>
            <p className={`life-draft-note ${dirty ? 'pending' : ''}`} role="status">{dirty ? 'Pending changes · apply to start a new run.' : 'Settings applied · ready to explore.'}</p>
            {error && <p role="alert" className="life-error">{error}</p>}
          </form>
          <div className="life-birth-note"><Sprout size={19} /><div><b>A little room for the next generation</b><p>Both parents need 60 food &amp; water for one child, or 80 for two. Parents stay alive and share their reserves.</p></div></div>
        </aside>
        <div className="life-stage">
          <div className="life-toolbar"><div className="life-playback"><button className="life-primary" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play'}</button><button onClick={() => setWorld(previous => step(previous))} disabled={playing}><StepForward size={14} />Step</button><button onClick={skip} disabled={playing}><FastForward size={14} />Skip 100</button><button onClick={() => { restart(); setSeedDraft(String(world.seed)); }}><RotateCcw size={14} />Reset</button></div><label className="life-speed">Speed<select aria-label="Simulation speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[1, 5, 15, 30].map(n => <option key={n} value={n}>{n} ticks/s</option>)}</select></label></div>
          <div className="life-world-heading"><div><i className={`life-status-dot ${playing ? 'running' : ''}`} /><span>{extinct ? 'Population extinct · habitat regenerating' : playing ? 'Life in motion' : 'Paused · take a closer look'}</span></div><span>TICK <b data-testid="life-tick">{world.tick}</b></span></div>
          <Habitat world={world} overlay={overlay} selected={selected} family={family} onSelect={setSelected} />
          <div className="life-world-footer"><div className="life-legend"><span><i className="adult" />Adult</span><span><i className="juvenile" />Juvenile</span><span><i className="sick">+</i>Sick</span><span><i className="immune" />Immune</span><span><i className="family" />Family</span></div><label>Show<select aria-label="Resource overlay" value={overlay} onChange={e => setOverlay(e.target.value as Overlay)}><option value="both">Food + water</option><option value="food">Food</option><option value="water">Water</option></select></label></div>
          <p className="life-map-hint">{overlay === 'both' ? 'Green cells hold food; blue bars hold water.' : overlay === 'food' ? 'Greener cells hold more food.' : 'Bluer cells hold more water.'} Click an individual to meet it and ring its living parents and children.</p>
          <div className="life-stats">
            <div><Users size={15} /><span>Population</span><b data-testid="life-population">{sample.population}</b><small>{sample.births} births · {sample.deaths} deaths</small></div>
            <div><HeartPulse size={15} /><span>Sick</span><b data-testid="life-sick">{sample.sick}</b><small>{sample.population ? Math.round(sample.sick / sample.population * 100) : 0}% of population</small></div>
            <div><Sprout size={15} /><span>Food stock</span><b data-testid="life-food">{number(sample.food)}</b><small>+{number(world.config.foodGrowth * RULES.width * RULES.height)} / tick, before eating</small></div>
            <div><Droplets size={15} /><span>Water stock</span><b data-testid="life-water">{number(sample.water)}</b><small>+{number(world.config.waterGrowth * RULES.width * RULES.height)} / tick, before drinking</small></div>
          </div>
          {world.blockedThisTick > 0 && <p className="life-limit" role="status">The habitat has reached its 500-individual simulation limit. {world.blockedThisTick} offspring prevented this tick.</p>}
          <div className="life-inspector" data-testid="life-inspector"><div><span className="eyebrow">MEET AN INDIVIDUAL</span><select aria-label="Inspect individual" value={person?.id ?? ''} onChange={e => setSelected(e.target.value ? Number(e.target.value) : null)}><option value="">{selected !== null && !person ? `#${selected} is no longer alive` : 'Choose an individual…'}</option>{world.individuals.map(p => <option key={p.id} value={p.id}>#{p.id} · {p.sick ? 'sick' : p.age < world.config.maturity ? 'juvenile' : 'adult'}</option>)}</select></div>
            {person ? <><dl><div><dt>Age</dt><dd>{person.age} ticks</dd></div><div><dt>Lifespan budget left</dt><dd>{Math.max(0, person.lifespan - person.lifeUsed).toFixed(1)} ticks</dd></div><div><dt>Food / water</dt><dd>{person.food.toFixed(0)} / {person.water.toFixed(0)}</dd></div><div><dt>Health</dt><dd>{person.sick ? `Sick · aging ×${world.config.sicknessSeverity}` : person.immuneTicks > 0 ? `Immune · ${person.immuneTicks} ticks` : 'Healthy'}</dd></div><div><dt>Parents</dt><dd>{person.parents ? person.parents.map(id => `#${id}`).join(' & ') : 'Founding generation'}</dd></div><div><dt>Children</dt><dd>{children.length} alive</dd></div><div><dt>Next generation</dt><dd>{reproductionReadiness(person, world.config)}</dd></div></dl><p>{(person.lifeUsed - person.age).toFixed(1)} ticks of lifespan lost to sickness. {person.sick ? `About ${Math.max(0, (person.lifespan - person.lifeUsed) / world.config.sicknessSeverity).toFixed(0)} ticks left if sickness continues.` : 'Recovery stops accelerated aging; lost lifespan stays lost.'}</p></> : <p>{selected !== null ? 'This individual has died. Choose a living individual to follow another life.' : 'Every dot has its own age, needs, family, and chance to recover. Choose one on the map or in this list.'}</p>}
          </div>
          <div className="life-run-meta"><span>SEED <b data-testid="life-seed">{world.seed}</b> · same seed, same story</span><div><span className="life-link-note" aria-live="polite">{linkNote}</span><button onClick={copyLink}><Link2 size={13} />Copy link</button><button onClick={newSeed}><Shuffle size={13} />New seed</button></div></div>
        </div>
      </div>
      <Trends world={world} />
      <p className="life-trends-note">Charts show the latest {world.history.length} ticks · totals cover the whole run</p>
      <section className="life-understand"><span className="eyebrow">THE BIG IDEA</span><h2>More life needs <em>more to live on.</em></h2><div className="life-explanations"><article><span>01 / THE NEXT GENERATION</span><h3>Two can become more.</h3><p>Healthy, mature neighbors can pair up. With adequate reserves, two parents produce one child. With abundant reserves, they produce two. Each birth has a cost and a pause before the next.</p></article><article><span>02 / A FINITE HABITAT</span><h3>Every meal leaves a mark.</h3><p>Food and water belong to places. Individuals seek nearby supplies and leave less behind. Give a cell time without feeding visitors and its stocks recover, up to its capacity.</p></article><article><span>03 / THE COST OF SICKNESS</span><h3>A shorter time to grow.</h3><p>Illness spreads through nearby contact and uses lifespan faster. Individuals may recover, reproduce again, and resist reinfection for a while if immunity is set. The time sickness took away cannot be restored.</p></article></div>
        <details className="life-rules"><summary>Inside this teaching model</summary><div><p>Time uses abstract ticks. Each tick renews resources, moves and feeds individuals in a seeded shuffled order, uses reserves and lifespan, resolves deaths and sickness, then creates offspring. A newborn starts acting next tick. This model has no sexes, genetics, seasons, or inherited sickness.</p><p>The 32 × 20 grid wraps at its edges. Individuals may share cells, move at most one cell in each direction per tick, and interact within their own cell and its eight neighbors. Food and water each have a capacity of 100 per cell. Initial stocks vary between 50% and 150% of the chosen fullness, capped at 100. Regrowth is additive and stops at capacity.</p><p>Individuals harvest up to 8 food and 10 water per tick, hold at most 100 of each, and use 2 food and 3 water per tick. Five consecutive ticks at zero food cause starvation; three at zero water cause dehydration. If death conditions coincide, dehydration takes priority, then starvation, then exhausted lifespan.</p><p>Lifespan is the chosen value with seeded ±20% variation. Founders have varied ages below three maturity periods and half their lifespan. Healthy aging uses one unit of lifespan per tick; sickness uses the selected multiplier. Death from exhausted lifespan is attributed to sickness if accelerated aging has occurred, including after recovery.</p><p>Both parents must be healthy, mature, out of cooldown, and have at least 60 of both reserves. At 80 of both reserves for both parents, two children are possible; otherwise one. Each parent pays 15 of both resources per child; each child starts with 30. Each individual pairs at most once per tick; pair success uses the selected birth chance. At the 500-individual limit, births are reduced or prevented, and counted visibly.</p><p>The initial sick fraction is rounded to a whole individual. Each infectious neighbor independently contributes the chosen transmission probability. Sickness uses the contact snapshot before recovery; new infections spread from the next tick. Recovery has the selected chance each tick. A recovered individual cannot be reinfected for the selected immunity period, which is zero unless you raise it. With zero initial sickness, there are no infections.</p><p>Charts retain the latest 500 samples; births and deaths are counted over the trailing 10 ticks. Food and water stocks exclude personal reserves. Playback pauses at extinction, and stepping continues to renew resources. The address bar names the applied settings and seed, so a copied link replays the same run. This is a simplified ecosystem for exploring cause and effect.</p></div></details>
      </section>
    </main><footer><span>lixionary / simulators</span><span>A small world. A thousand possible futures.</span></footer>
  </div>;
}
