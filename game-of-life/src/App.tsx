import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowDown, Sprout, Droplets, HeartPulse, Pause, Play, RotateCcw, StepForward, Shuffle, Users, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { CONFIG_LIMITS, DEFAULT_CONFIG, initialState, PRESETS, reproductionReadiness, RULES, step, type Config, type Sample, type World } from './model';

type Overlay = 'both' | 'food' | 'water';
const percentageKeys = new Set<keyof Config>(['birthChance', 'initialSickness', 'transmission', 'recovery']);
const fieldGroups: { title: string; fields: [keyof Config, string][] }[] = [
  { title: 'The starting habitat', fields: [['population', 'Starting population'], ['foodFullness', 'Initial food (%)'], ['waterFullness', 'Initial water (%)'], ['foodGrowth', 'Food regrowth / cell / tick'], ['waterGrowth', 'Water regrowth / cell / tick']] },
  { title: 'Life & the next generation', fields: [['lifespan', 'Lifespan (ticks)'], ['maturity', 'Maturity age (ticks)'], ['birthChance', 'Pair birth chance (%)'], ['cooldown', 'Birth cooldown (ticks)']] },
  { title: 'Sickness & recovery', fields: [['initialSickness', 'Initially sick (%)'], ['transmission', 'Transmission / contact (%)'], ['recovery', 'Recovery / tick (%)'], ['sicknessSeverity', 'Sick aging multiplier']] },
];
function draftFor(config: Config): Record<keyof Config, string> {
  return Object.fromEntries(Object.entries(config).map(([key, value]) => [key, String(Number((value * (percentageKeys.has(key as keyof Config) ? 100 : 1)).toFixed(5)))])) as Record<keyof Config, string>;
}
const number = (value: number) => Math.round(value).toLocaleString('en-US');

function Habitat({ world, overlay, selected, onSelect }: { world: World; overlay: Overlay; selected: number | null; onSelect: (id: number) => void }) {
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
      const juvenile = p.age < world.config.maturity;
      return <g key={p.id} transform={`translate(${x} ${y})`} role="button" tabIndex={-1} aria-label={`Inspect individual ${p.id}`} aria-pressed={selected === p.id}
        onClick={() => onSelect(p.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.id); } }}>
        <title>#{p.id} · {p.sick ? 'sick' : juvenile ? 'juvenile' : 'healthy adult'} · age {p.age}</title>
        <circle r="9" fill="transparent" />
        {selected === p.id && <circle r="8" fill="none" stroke="#45483a" strokeWidth="1.5" strokeDasharray="2 2" />}
        {juvenile ? <path d="M0 -5 L5 0 L0 5 L-5 0 Z" fill={p.sick ? '#ae6a56' : '#897aa0'} stroke="#fffdf6" strokeWidth="1" />
          : <circle r="4.8" fill={p.sick ? '#ae6a56' : '#466b4b'} stroke="#fffdf6" strokeWidth="1" />}
        {p.sick && <path d="M-2 0 H2 M0 -2 V2" stroke="#fffdf6" strokeWidth="1.3" />}
      </g>;
    })}
  </svg>;
}

function Chart({ history, resources }: { history: Sample[]; resources?: boolean }) {
  const latest = history[history.length - 1], first = history[0];
  const maximum = resources ? 100 : Math.max(10, ...history.map(s => s.population)) * 1.1;
  const series = resources ? [{ key: 'food' as const, color: '#66805b', label: 'Food' }, { key: 'water' as const, color: '#588a9a', label: 'Water' }]
    : [{ key: 'population' as const, color: '#66805b', label: 'Population' }, { key: 'sick' as const, color: '#ae6a56', label: 'Sick' }];
  const value = (s: Sample, key: typeof series[number]['key']) => resources ? s[key] / (RULES.width * RULES.height * RULES.cellCapacity) * 100 : s[key];
  return <section className="life-chart">
    <div className="life-chart-heading"><h3>{resources ? 'What the habitat can give' : 'A population in motion'}</h3><span>{resources ? '% OF CAPACITY' : 'INDIVIDUALS'}</span></div>
    <div className="life-chart-legend">{series.map(line => <span key={line.key}><i style={{ background: line.color }} />{line.label} <b>{resources ? `${value(latest, line.key).toFixed(1)}%` : latest[line.key]}</b></span>)}</div>
    <svg viewBox="0 0 600 155" role="img" aria-label={`${resources ? 'Food and water stocks' : 'Population and sickness'} from tick ${first.tick} to ${latest.tick}`}>
      {[0, 0.5, 1].map(r => <g key={r}><path d={`M35 ${125 - r * 105} H580`} stroke="#e2e3d8" strokeDasharray="3 5" /><text x="27" y={129 - r * 105} textAnchor="end">{Math.round(maximum * r)}</text></g>)}
      {series.map(line => {
        const points = history.map((s, i) => `${35 + (history.length === 1 ? 0 : i / (history.length - 1) * 545)},${125 - value(s, line.key) / maximum * 105}`).join(' ');
        return <g key={line.key}><polyline points={points} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" /><circle cx={history.length === 1 ? 35 : 580} cy={125 - value(latest, line.key) / maximum * 105} r="3" fill={line.color} /></g>;
      })}
      <text x="35" y="149">TICK {first.tick}</text><text x="580" y="149" textAnchor="end">{latest.tick}</text>
    </svg>
  </section>;
}

export default function App() {
  const [world, setWorld] = useState(() => initialState());
  const [draft, setDraft] = useState(() => draftFor(DEFAULT_CONFIG)), [seedDraft, setSeedDraft] = useState('42');
  const [preset, setPreset] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(5);
  const [overlay, setOverlay] = useState<Overlay>('both'), [selected, setSelected] = useState<number | null>(null), [error, setError] = useState('');
  const sample = world.history[world.history.length - 1], person = world.individuals.find(p => p.id === selected);
  const activeDraft = draftFor(world.config);
  const dirty = seedDraft !== String(world.seed) || (Object.keys(draft) as (keyof Config)[]).some(key => draft[key] !== activeDraft[key]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setWorld(previous => step(previous)), 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed]);
  function restart(config = world.config, seed = world.seed) {
    setPlaying(false); setSelected(null); setWorld(initialState(config, seed));
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
          <div className="life-toolbar"><div className="life-playback"><button className="life-primary" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play'}</button><button onClick={() => setWorld(previous => step(previous))} disabled={playing}><StepForward size={14} />Step</button><button onClick={() => { restart(); setSeedDraft(String(world.seed)); }}><RotateCcw size={14} />Reset</button></div><label className="life-speed">Speed<select aria-label="Simulation speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[1, 5, 15, 30].map(n => <option key={n} value={n}>{n} ticks/s</option>)}</select></label></div>
          <div className="life-world-heading"><div><i className={`life-status-dot ${playing ? 'running' : ''}`} /><span>{world.individuals.length === 0 ? 'Population extinct · habitat regenerating' : playing ? 'Life in motion' : 'Paused · take a closer look'}</span></div><span>TICK <b data-testid="life-tick">{world.tick}</b></span></div>
          <Habitat world={world} overlay={overlay} selected={selected} onSelect={setSelected} />
          <div className="life-world-footer"><div className="life-legend"><span><i className="adult" />Adult</span><span><i className="juvenile" />Juvenile</span><span><i className="sick">+</i>Sick</span></div><label>Show<select aria-label="Resource overlay" value={overlay} onChange={e => setOverlay(e.target.value as Overlay)}><option value="both">Food + water</option><option value="food">Food</option><option value="water">Water</option></select></label></div>
          <p className="life-map-hint">{overlay === 'both' ? 'Green cells hold food; blue bars hold water.' : overlay === 'food' ? 'Greener cells hold more food.' : 'Bluer cells hold more water.'} Click an individual to meet it.</p>
          <div className="life-stats">
            <div><Users size={15} /><span>Population</span><b data-testid="life-population">{sample.population}</b><small>{sample.births} births · {sample.deaths} deaths</small></div>
            <div><HeartPulse size={15} /><span>Sick</span><b data-testid="life-sick">{sample.sick}</b><small>{sample.population ? Math.round(sample.sick / sample.population * 100) : 0}% of population</small></div>
            <div><Sprout size={15} /><span>Food stock</span><b data-testid="life-food">{number(sample.food)}</b><small>+{number(world.config.foodGrowth * RULES.width * RULES.height)} / tick, before eating</small></div>
            <div><Droplets size={15} /><span>Water stock</span><b data-testid="life-water">{number(sample.water)}</b><small>+{number(world.config.waterGrowth * RULES.width * RULES.height)} / tick, before drinking</small></div>
          </div>
          {world.blockedThisTick > 0 && <p className="life-limit" role="status">The habitat has reached its 500-individual simulation limit. {world.blockedThisTick} offspring prevented this tick.</p>}
          <div className="life-inspector" data-testid="life-inspector"><div><span className="eyebrow">MEET AN INDIVIDUAL</span><select aria-label="Inspect individual" value={person?.id ?? ''} onChange={e => setSelected(e.target.value ? Number(e.target.value) : null)}><option value="">{selected !== null && !person ? `#${selected} is no longer alive` : 'Choose an individual…'}</option>{world.individuals.map(p => <option key={p.id} value={p.id}>#{p.id} · {p.sick ? 'sick' : p.age < world.config.maturity ? 'juvenile' : 'adult'}</option>)}</select></div>
            {person ? <><dl><div><dt>Age</dt><dd>{person.age} ticks</dd></div><div><dt>Lifespan budget left</dt><dd>{Math.max(0, person.lifespan - person.lifeUsed).toFixed(1)} ticks</dd></div><div><dt>Food / water</dt><dd>{person.food.toFixed(0)} / {person.water.toFixed(0)}</dd></div><div><dt>Health</dt><dd>{person.sick ? `Sick · aging ×${world.config.sicknessSeverity}` : 'Healthy'}</dd></div><div><dt>Parents</dt><dd>{person.parents ? person.parents.map(id => `#${id}`).join(' & ') : 'Founding generation'}</dd></div><div><dt>Next generation</dt><dd>{reproductionReadiness(person, world.config)}</dd></div></dl><p>{(person.lifeUsed - person.age).toFixed(1)} ticks of lifespan lost to sickness. {person.sick ? `About ${Math.max(0, (person.lifespan - person.lifeUsed) / world.config.sicknessSeverity).toFixed(0)} ticks left if sickness continues.` : 'Recovery stops accelerated aging; lost lifespan stays lost.'}</p></> : <p>{selected !== null ? 'This individual has died. Choose a living individual to follow another life.' : 'Every dot has its own age, needs, family, and chance to recover. Choose one on the map or in this list.'}</p>}
          </div>
          <div className="life-run-meta"><span>SEED <b data-testid="life-seed">{world.seed}</b> · same seed, same story</span><button onClick={newSeed}><Shuffle size={13} />New seed</button></div>
        </div>
      </div>
      <section className="life-trends" aria-label="Population and resource trends"><Chart history={world.history} /><Chart history={world.history} resources /></section>
      <div className="life-mortality"><span>DEATHS BY CAUSE</span><span>Age <b>{world.deaths.age}</b></span><span>Sickness <b>{world.deaths.sickness}</b></span><span>Starvation <b>{world.deaths.starvation}</b></span><span>Dehydration <b>{world.deaths.dehydration}</b></span><span>Showing the latest {world.history.length} ticks</span></div>
      <section className="life-understand"><span className="eyebrow">THE BIG IDEA</span><h2>More life needs <em>more to live on.</em></h2><div className="life-explanations"><article><span>01 / THE NEXT GENERATION</span><h3>Two can become more.</h3><p>Healthy, mature neighbors can pair up. With adequate reserves, two parents produce one child. With abundant reserves, they produce two. Each birth has a cost and a pause before the next.</p></article><article><span>02 / A FINITE HABITAT</span><h3>Every meal leaves a mark.</h3><p>Food and water belong to places. Individuals seek nearby supplies and leave less behind. Give a cell time without feeding visitors and its stocks recover, up to its capacity.</p></article><article><span>03 / THE COST OF SICKNESS</span><h3>A shorter time to grow.</h3><p>Illness spreads through nearby contact and uses lifespan faster. Individuals may recover and reproduce again. The time sickness took away cannot be restored.</p></article></div>
        <details className="life-rules"><summary>Inside this teaching model</summary><div><p>Time uses abstract ticks. Each tick renews resources, moves and feeds individuals in a seeded shuffled order, uses reserves and lifespan, resolves deaths and sickness, then creates offspring. A newborn starts acting next tick. This model has no sexes, genetics, seasons, or inherited sickness.</p><p>The 32 × 20 grid wraps at its edges. Individuals may share cells, move at most one cell in each direction per tick, and interact within their own cell and its eight neighbors. Food and water each have a capacity of 100 per cell. Initial stocks vary between 50% and 150% of the chosen fullness, capped at 100. Regrowth is additive and stops at capacity.</p><p>Individuals harvest up to 8 food and 10 water per tick, hold at most 100 of each, and use 2 food and 3 water per tick. Five consecutive ticks at zero food cause starvation; three at zero water cause dehydration. If death conditions coincide, dehydration takes priority, then starvation, then exhausted lifespan.</p><p>Lifespan is the chosen value with seeded ±20% variation. Founders have varied ages below three maturity periods and half their lifespan. Healthy aging uses one unit of lifespan per tick; sickness uses the selected multiplier. Death from exhausted lifespan is attributed to sickness if accelerated aging has occurred, including after recovery.</p><p>Both parents must be healthy, mature, out of cooldown, and have at least 60 of both reserves. At 80 of both reserves for both parents, two children are possible; otherwise one. Each parent pays 15 of both resources per child; each child starts with 30. Each individual pairs at most once per tick; pair success uses the selected birth chance. At the 500-individual limit, births are reduced or prevented, and counted visibly.</p><p>The initial sick fraction is rounded to a whole individual. Each infectious neighbor independently contributes the chosen transmission probability. Sickness uses the contact snapshot before recovery; new infections spread from the next tick. Recovery has the selected chance each tick and gives no immunity. With zero initial sickness, there are no infections.</p><p>Population and resource charts retain the latest 500 samples. Food and water stocks exclude personal reserves. Resource renewal continues after extinction. This is a simplified ecosystem for exploring cause and effect.</p></div></details>
      </section>
    </main><footer><span>lixionary / simulators</span><span>A small world. A thousand possible futures.</span></footer>
  </div>;
}
