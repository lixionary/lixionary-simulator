import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Flame, Lightbulb, Pause, Play, SlidersHorizontal } from 'lucide-react';
import { carnotCycle, heatPump, outsideOf, realEngine, stateAt, STROKES, withOutside, ZERO_C, type Cycle, type Engine, type Gas, type Mode, type Pump } from './model';
import { celsius, cop, kelvin, litres, percent, si } from './format';
import { CYCLE, ENGINE, MACHINES, PRESETS, type Stage } from './presets';
import { CycleChart, Piston } from './CycleViews';
import { FlowDiagram, gasRange, RateChart } from './EngineViews';
import { PumpChart, SIDES } from './PumpViews';

const GROUPS = [...new Set(PRESETS.map(p => p.group))];
const STAGES: { key: Stage; name: string; made: string }[] = [{ key: 'cycle', name: 'The cycle', made: 'heat into work' }, { key: 'engine', name: 'A real engine', made: 'power has a price' }, { key: 'pump', name: 'Run it backwards', made: 'work moves heat' }];
const GASES: { key: Gas; name: string }[] = [{ key: 'monatomic', name: 'Helium' }, { key: 'diatomic', name: 'Air' }];
const MODES: { key: Mode; name: string }[] = [{ key: 'fridge', name: 'Refrigerator' }, { key: 'cooler', name: 'Air conditioner' }, { key: 'heater', name: 'Heat pump' }];
const SECONDS_PER_CYCLE = 10;

function startingPreset() {
  const key = new URLSearchParams(window.location.search).get('preset'), found = PRESETS.find(p => p.key === key);
  return { preset: found ?? PRESETS.find(p => p.key === 'carnot')!, unknown: key !== null && !found };
}

function Slider({ label, value, min, max, step, text, onChange }: { label: string; value: number; min: number; max: number; step: number; text: string; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="th-slider"><div><label htmlFor={id}>{label}</label><output htmlFor={id}>{text}</output></div><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></div>;
}
function Stat({ label, id, value, children }: { label: string; id: string; value: string; children: ReactNode }) {
  return <div><span>{label}</span><b data-testid={id}>{value}</b><small>{children}</small></div>;
}

export default function App() {
  const [start] = useState(startingPreset);
  const [presetKey, setPresetKey] = useState(start.preset.key), [stage, setStage] = useState<Stage>(start.preset.stage);
  const [cycle, setCycle] = useState<Cycle>(start.preset.cycle ?? CYCLE), [engine, setEngine] = useState<Engine>(start.preset.engine ?? ENGINE), [pump, setPump] = useState<Pump>(start.preset.pump ?? MACHINES.fridge);
  const [phase, setPhase] = useState(0.125), [playing, setPlaying] = useState(false), [logAxes, setLogAxes] = useState(false);
  const [unknownLink, setUnknownLink] = useState(start.unknown);
  const preset = PRESETS.find(p => p.key === presetKey)!;

  useEffect(() => {
    if (!playing || stage !== 'cycle') return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const step = (now - last) / 1000 / SECONDS_PER_CYCLE; last = now;
      setPhase(value => (value + step) % 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, stage]);

  function load(key: string) {
    const next = PRESETS.find(p => p.key === key)!;
    setPresetKey(key); setStage(next.stage); setUnknownLink(false); setPlaying(false); setPhase(0.125);
    if (next.cycle) setCycle(next.cycle);
    if (next.engine) setEngine(next.engine);
    if (next.pump) setPump(next.pump);
    window.history.replaceState(null, '', `?preset=${key}`);
  }
  /** The hot reservoir always stays at least 10 K above the cold one; moving one slider pushes the other. */
  function patchCycle(patch: Partial<Cycle>) {
    const next = { ...cycle, ...patch };
    if (next.tHot < next.tCold + 10) { if ('tCold' in patch) next.tHot = next.tCold + 10; else next.tCold = next.tHot - 10; }
    setCycle(next);
  }
  const scrub = (value: number) => { setPlaying(false); setPhase(value); };

  const c = carnotCycle(cycle), now = stateAt(c, phase), e = realEngine(cycle, engine), s = heatPump(pump), side = SIDES[pump.mode];
  const heating = pump.mode === 'heater', inside = heating ? pump.tHot : pump.tCold, ideal = pump.gap === 0 && pump.quality === 1;
  const setInside = (t: number) => setPump(heating ? { ...pump, tHot: t } : { ...pump, tCold: t });

  return <div className="th-app">
    <header className="th-header"><a className="th-brand" href="/"><span><Flame size={20} strokeWidth={1.6} /></span>heat<span className="muted">lab.</span></a><a className="th-back" href="/"><ArrowLeft size={13} />All simulators</a></header>
    <main>
      <section className="th-hero"><div><span className="eyebrow">FROM THE CARNOT CYCLE TO THE HEAT PUMP</span><h1>Heat flows downhill.<br />Work can pump it back <em>up.</em></h1><p>Let heat fall from hot to cold through a gas and some of it becomes work. <br />Push the same machine the other way and it carries heat from cold to hot.</p><a href="#lab">Start with the cycle <ArrowDown size={14} /></a></div>
        <div className="th-hero-note" aria-hidden="true"><svg viewBox="0 0 220 90"><rect x="20" y="6" width="120" height="18" rx="3" fill="#c65a48" fillOpacity=".3" /><rect x="20" y="66" width="120" height="18" rx="3" fill="#4d7fc0" fillOpacity=".3" /><rect x="62" y="24" width="36" height="21" fill="#c65a48" fillOpacity=".55" /><rect x="62" y="45" width="22" height="21" fill="#4d7fc0" fillOpacity=".55" /><path d="M84 38H178l8 7l-8 7H84z" fill="#5c8a4c" fillOpacity=".6" /><circle cx="80" cy="45" r="9" fill="#fbfaf7" stroke="#33444b" strokeWidth="1.4" /></svg><p>Every engine wastes heat.<br />Every refrigerator needs work.</p><span>ENGINE · LIMIT · HEAT PUMP</span></div></section>
      <div className="th-section-heading"><span className="eyebrow">THREE LINKS OF ONE CHAIN</span><span>IDEAL GAS · FIRST AND SECOND LAW · NOTHING TUNED BY HAND</span></div>
      <nav className="th-chain" aria-label="Stages">{STAGES.map((item, i) => <button key={item.key} aria-pressed={stage === item.key} onClick={() => setStage(item.key)}><b>{i + 1}</b><span>{item.name}<small>{item.made}</small></span>{i < 2 && <ArrowRight size={14} />}</button>)}</nav>
      <section id="lab" className="th-lab" aria-label="Thermodynamics simulation">
        <aside className="th-settings">
          <div className="th-panel-heading"><h2>Build the experiment</h2><SlidersHorizontal size={15} /></div>
          <label className="th-label" htmlFor="th-preset">Start with an experiment</label>
          <select id="th-preset" value={presetKey} onChange={event => load(event.target.value)}>{GROUPS.map(group => <optgroup key={group} label={group}>{PRESETS.filter(p => p.group === group).map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</optgroup>)}</select>
          <p className="th-hint" data-testid="th-notice">{preset.stage === stage ? preset.notice : 'You have moved to another link of the chain. Pick one of its experiments above, or use the controls below.'}</p>
          {unknownLink && <p className="th-error" role="status">That link names an experiment this lab does not have, so it opened the first one.</p>}

          {stage === 'cycle' && <>
            <details open><summary>Around the cycle</summary><div className="th-fields">
              <Slider label="Position in the cycle" value={phase} min={0} max={0.995} step={0.005} text={`stroke ${now.stroke + 1} of 4`} onChange={scrub} />
              <div className="th-switch four" role="group" aria-label="Jump to a stroke">{STROKES.map((name, i) => <button key={name} aria-label={`Stroke ${i + 1}: ${name}`} aria-pressed={now.stroke === i} onClick={() => scrub((i + 0.5) / 4)}>{i + 1}</button>)}</div>
              <button className="th-primary" onClick={() => setPlaying(!playing)}>{playing ? <><Pause size={13} />Pause</> : <><Play size={13} />Run the cycle</>}</button>
            </div></details>
            <details open><summary>The two reservoirs</summary><div className="th-fields">
              <Slider label="Hot reservoir" value={cycle.tHot} min={320} max={1000} step={5} text={`${kelvin(cycle.tHot)} · ${celsius(cycle.tHot)}`} onChange={tHot => patchCycle({ tHot })} />
              <Slider label="Cold reservoir" value={cycle.tCold} min={200} max={400} step={5} text={`${kelvin(cycle.tCold)} · ${celsius(cycle.tCold)}`} onChange={tCold => patchCycle({ tCold })} />
            </div></details>
            <details open><summary>The gas</summary><div className="th-fields">
              <div className="th-switch" role="group" aria-label="Kind of gas">{GASES.map(gas => <button key={gas.key} aria-pressed={cycle.gas === gas.key} onClick={() => patchCycle({ gas: gas.key })}>{gas.name}</button>)}</div>
              <Slider label="Expansion while hot" value={cycle.ratio} min={1.2} max={5} step={0.1} text={`${cycle.ratio.toFixed(1)} times the volume`} onChange={ratio => patchCycle({ ratio })} />
              <Slider label="Amount of gas" value={cycle.moles} min={0.05} max={0.5} step={0.05} text={`${cycle.moles.toFixed(2)} mol`} onChange={moles => patchCycle({ moles })} />
            </div></details>
          </>}

          {stage === 'engine' && <>
            <details open><summary>How hard it is driven</summary><div className="th-fields">
              <Slider label="Cycles per second" value={engine.rate} min={0} max={12} step={0.01} text={`${engine.rate.toFixed(2)} per second`} onChange={rate => setEngine({ ...engine, rate })} />
              <div className="th-switch three" role="group" aria-label="Speed shortcuts"><button onClick={() => setEngine({ ...engine, rate: 0.2 })}>Very slow</button><button onClick={() => setEngine({ ...engine, rate: Math.min(12, Math.round(e.bestRate * 100) / 100) })}>Most power</button><button onClick={() => setEngine({ ...engine, rate: Math.min(12, Math.ceil(e.stallRate * 110) / 100) })}>Too fast</button></div>
            </div></details>
            <details open><summary>What it loses</summary><div className="th-fields">
              <Slider label="Heat exchangers" value={engine.conductance} min={5} max={60} step={1} text={`${engine.conductance} W per kelvin`} onChange={conductance => setEngine({ ...engine, conductance })} />
              <Slider label="Friction" value={engine.friction} min={0} max={0.5} step={0.01} text={`${percent(engine.friction, 0)} of the work`} onChange={friction => setEngine({ ...engine, friction })} />
              <p className="th-hint">This is the engine from link 1: {kelvin(cycle.tHot)} to {kelvin(cycle.tCold)}, {si(c.work, 'J')} a cycle at best. Change it there.</p>
            </div></details>
          </>}

          {stage === 'pump' && <>
            <details open><summary>The machine</summary><div className="th-fields">
              <div className="th-switch stack" role="group" aria-label="Kind of machine">{MODES.map(mode => <button key={mode.key} aria-pressed={pump.mode === mode.key} onClick={() => setPump(MACHINES[mode.key])}>{mode.name}</button>)}</div>
              <Slider label={side.inside} value={Math.round(inside - ZERO_C)} min={side.insideRange[0]} max={side.insideRange[1]} step={1} text={celsius(inside)} onChange={t => setInside(t + ZERO_C)} />
              <Slider label={side.outside} value={Math.round(outsideOf(pump) - ZERO_C)} min={side.range[0]} max={side.range[1]} step={1} text={celsius(outsideOf(pump))} onChange={t => setPump(withOutside(pump, t + ZERO_C))} />
            </div></details>
            <details open><summary>How good it is</summary><div className="th-fields">
              <Slider label="Coil temperature gap" value={pump.gap} min={0} max={20} step={1} text={`${pump.gap} K each side`} onChange={gap => setPump({ ...pump, gap })} />
              <Slider label="Compressor quality" value={pump.quality} min={0.2} max={1} step={0.05} text={`${percent(pump.quality, 0)} of ideal`} onChange={quality => setPump({ ...pump, quality })} />
              <Slider label="Leaky walls" value={pump.leak} min={side.leakRange[0]} max={side.leakRange[1]} step={side.leakRange[2]} text={`${pump.leak} W per kelvin`} onChange={leak => setPump({ ...pump, leak })} />
              <button aria-pressed={ideal} onClick={() => setPump(ideal ? { ...pump, gap: MACHINES[pump.mode].gap, quality: MACHINES[pump.mode].quality } : { ...pump, gap: 0, quality: 1 })}>A perfect machine</button>
            </div></details>
          </>}
          <div className="th-tip"><Lightbulb size={16} /><p>{stage === 'cycle' ? 'Bring the two reservoirs closer together and watch the loop, and the work, shrink towards nothing.' : stage === 'engine' ? 'Slide the speed from zero upward. Efficiency only ever falls; power rises, peaks, and collapses.' : 'Move the outdoor temperature. The further heat has to be lifted, the more work every joule costs.'}</p></div>
        </aside>

        <div className="th-stage">
          {stage === 'cycle' && <>
            <div className="th-stage-heading"><div><span className="th-status-dot" />A Carnot engine, {STROKES[now.stroke].toLowerCase()}</div><span><b>{kelvin(cycle.tHot)}</b> TO <b>{kelvin(cycle.tCold)}</b> · <b>{percent(c.efficiency)}</b></span></div>
            <div className="th-picture"><Piston cycle={cycle} c={c} now={now} /><p className="th-caption centre">{['Touching the hot reservoir, the gas expands and takes in heat without cooling.', 'Cut off from both, it keeps expanding and cools to the cold reservoir’s temperature.', 'Touching the cold reservoir, it is squeezed and gives up heat without warming.', 'Cut off again, squeezing warms it back to where it started.'][now.stroke]}</p></div>
            <div className="th-stats">
              <Stat label="Efficiency" id="th-efficiency" value={percent(c.efficiency)}>1 − T cold ÷ T hot, in kelvin. Nothing else matters.</Stat>
              <Stat label="Work each cycle" id="th-work" value={si(c.work, 'J')}>Heat in minus heat out: the area of the loop.</Stat>
              <Stat label="Heat taken in" id="th-heat-hot" value={si(c.qHot, 'J')}>From the hot reservoir, on stroke 1.</Stat>
              <Stat label="Heat given up" id="th-heat-cold" value={si(c.qCold, 'J')}>To the cold reservoir, on stroke 3. The price of returning to the start.</Stat>
              <Stat label="Entropy carried" id="th-entropy" value={si(c.entropy, 'J/K')}>Taken from the hot side and handed, unchanged, to the cold side.</Stat>
              <Stat label="Stroke" id="th-stroke" value={STROKES[now.stroke]}>{now.stroke % 2 === 0 ? 'Temperature held steady by a reservoir.' : 'No heat crosses the cylinder wall.'}</Stat>
              <Stat label="Pressure now" id="th-pressure" value={si(now.p, 'Pa')}>The air around you is 101 kPa.</Stat>
              <Stat label="Volume now" id="th-volume" value={litres(now.v)}>At {kelvin(now.t)}. Largest volume {litres(c.corners[2].v)}.</Stat>
            </div>
            <section className="th-charts" aria-label="The cycle on two charts">
              <div className="th-chart"><div className="th-chart-heading"><h3>Pressure against volume</h3><button className="th-small" aria-pressed={logAxes} onClick={() => setLogAxes(!logAxes)}>Logarithmic axes</button></div><CycleChart c={c} now={now} kind="pv" log={logAxes} /><p>Red and blue are the strokes that touch a reservoir. The gas pushes hard going out and is squeezed back while cold and slack: the area between is the work.</p></div>
              <div className="th-chart"><div className="th-chart-heading"><h3>Temperature against entropy</h3><span>THE SAME LOOP, AS A RECTANGLE</span></div><CycleChart c={c} now={now} kind="ts" /><p>Heat is temperature times entropy. The whole area down to zero is the heat taken in; the part below the cold line has to be thrown away.</p></div>
            </section>
          </>}

          {stage === 'engine' && <>
            <div className="th-stage-heading"><div><span className="th-status-dot" />An engine in a hurry, <span data-testid="th-engine-state">{e.stalled ? 'stalled' : 'running'}</span></div><span><b>{si(e.power, 'W')}</b> AT <b>{percent(e.efficiency)}</b> · LIMIT <b>{percent(e.carnot)}</b></span></div>
            <div className="th-picture"><FlowDiagram unit="W" stalled={e.stalled} top={[`Hot source · ${kelvin(cycle.tHot)}`, `heat in ${si(e.heatIn, 'W')}`]} bottom={[`Cold sink · ${kelvin(cycle.tCold)}`, `waste ${si(e.heatOut, 'W')}`]} inner={[`gas takes it in at ${kelvin(e.tGasHot)}`, `gas gives it up at ${kelvin(e.tGasCold)}`]} heatHot={e.heatIn} heatCold={e.heatOut} work={e.power} scale={engine.conductance * (cycle.tHot - cycle.tCold) / 2}
              label={`Energy flow through the engine: ${si(e.heatIn, 'W')} of heat in, ${si(e.power, 'W')} of work out, ${si(e.heatOut, 'W')} wasted.`} /><p className="th-caption centre">{e.stalled ? 'Too fast: the gas has no temperature difference left of its own, and heat simply leaks through.' : `Heat only flows across a temperature difference, so the gas works between ${kelvin(e.tGasHot)} and ${kelvin(e.tGasCold)}, not ${kelvin(cycle.tHot)} and ${kelvin(cycle.tCold)}.`}</p></div>
            <div className="th-stats">
              <Stat label="Power" id="th-power" value={si(e.power, 'W')}>Work per cycle times cycles per second{engine.friction > 0 ? ', less friction' : ''}.</Stat>
              <Stat label="Efficiency" id="th-real-efficiency" value={percent(e.efficiency)}>{e.stalled ? 'Nothing comes out.' : `${percent(e.efficiency / e.carnot, 0)} of what Carnot allows.`}</Stat>
              <Stat label="Carnot limit" id="th-carnot" value={percent(e.carnot)}>Reached only at zero speed, and so at zero power.</Stat>
              <Stat label="Most power" id="th-best" value={si(e.bestPower, 'W')}>At {e.bestRate.toFixed(2)} cycles per second, where efficiency is {percent(e.bestEfficiency)}.</Stat>
              <Stat label="Heat drawn" id="th-heat-in" value={si(e.heatIn, 'W')}>From the hot source: the fuel bill.</Stat>
              <Stat label="Waste heat" id="th-heat-out" value={si(e.heatOut, 'W')}>To the cold sink: the cooling tower.</Stat>
              <Stat label="Gas runs between" id="th-gas" value={gasRange(e)}>Cooler than the source and warmer than the sink.</Stat>
              <Stat label="Entropy made" id="th-entropy-rate" value={si(e.entropyRate, 'W/K')}>Zero for Carnot. Every shortfall from the limit shows up here.</Stat>
            </div>
            <section className="th-charts" aria-label="Engine curves">
              <div className="th-chart"><div className="th-chart-heading"><h3>Power against speed</h3><span>ZERO AT BOTH ENDS</span></div><RateChart cycle={cycle} engine={engine} e={e} kind="power" /><p>Too slow and little heat flows. Too fast and the gas cannot keep a temperature difference. In between there is a best speed.</p></div>
              <div className="th-chart"><div className="th-chart-heading"><h3>Efficiency against speed</h3><span>ONLY EVER DOWN</span></div><RateChart cycle={cycle} engine={engine} e={e} kind="efficiency" /><p>At the peak of power the efficiency is 1 − √(T cold ÷ T hot), whatever the heat exchangers are like. That is what real power stations achieve.</p></div>
            </section>
          </>}

          {stage === 'pump' && <>
            <div className="th-stage-heading"><div><span className="th-status-dot" />{{ fridge: 'A refrigerator', cooler: 'An air conditioner', heater: 'A heat pump' }[pump.mode]}{ideal ? ', perfect' : ''}</div><span><b>{celsius(pump.tCold)}</b> UP TO <b>{celsius(pump.tHot)}</b> · COP <b>{cop(s.cop)}</b></span></div>
            <div className="th-picture"><FlowDiagram unit="W" reversed top={[`${side.hot} · ${celsius(pump.tHot)}`, `heat out ${si(s.heatHot, 'W')}`]} bottom={[`${side.cold} · ${celsius(pump.tCold)}`, `heat in ${si(s.heatCold, 'W')}`]} inner={[`hot coil at ${celsius(s.tCoilHot)}`, `cold coil at ${celsius(s.tCoilCold)}`]} heatHot={s.heatHot} heatCold={s.heatCold} work={s.electricity} scale={s.heatHot * 130 / 110}
              label={`Energy flow through the machine: ${si(s.heatCold, 'W')} of heat taken from the cold side plus ${si(s.electricity, 'W')} of work gives ${si(s.heatHot, 'W')} to the warm side.`} /><p className="th-caption centre">{heating ? `Of every ${cop(s.cop)} joules that reach the room, one is electricity. The rest came out of the outdoor air.` : `Each joule of electricity moves ${cop(s.cop)} joules out of ${pump.mode === 'fridge' ? 'the food' : 'the room'}, and all of it ends up ${pump.mode === 'fridge' ? 'in the kitchen' : 'outdoors'}.`}</p></div>
            <div className="th-stats">
              <Stat label={heating ? 'Heat per joule (COP)' : 'Cooling per joule (COP)'} id="th-cop" value={cop(s.cop)}>{heating ? 'Joules of heat delivered per joule of electricity.' : 'Joules of heat removed per joule of electricity.'}</Stat>
              <Stat label="Limit for any machine" id="th-cop-limit" value={cop(s.limit)}>{heating ? 'T hot ÷ (T hot − T cold): one over the Carnot efficiency.' : 'T cold ÷ (T hot − T cold), in kelvin.'}</Stat>
              <Stat label={heating ? 'Heat the room needs' : 'Heat to remove'} id="th-demand" value={si(s.demand, 'W')}>{heating ? 'Leaking out through the walls.' : 'Leaking in through the walls.'}</Stat>
              <Stat label="Electricity" id="th-electricity" value={si(s.electricity, 'W')}>What the compressor draws to keep up.</Stat>
              {heating ? <Stat label="An electric heater" id="th-compare" value={si(s.demand, 'W')}>{cop(s.cop)} times the electricity for the same warmth.</Stat>
                : <Stat label="Heat thrown out" id="th-compare" value={si(s.heatHot, 'W')}>Heat removed plus the electricity. {pump.mode === 'fridge' ? 'A refrigerator warms its kitchen.' : 'The street gets hotter.'}</Stat>}
              <Stat label="Coils run at" id="th-coils" value={`${celsius(s.tCoilCold)} and ${celsius(s.tCoilHot)}`}>Colder than the cold side, hotter than the warm side.</Stat>
              <Stat label="Lift" id="th-lift" value={`${(s.tCoilHot - s.tCoilCold).toFixed(0)} K`}>How far the heat is raised. A smaller lift needs less work per joule.</Stat>
              <Stat label="Entropy made" id="th-pump-entropy" value={si(s.entropyRate, 'W/K')}>{ideal ? 'None. A perfect machine is the Carnot engine reversed.' : 'From the coil gaps and the compressor.'}</Stat>
            </div>
            <section className="th-charts" aria-label="Performance against temperature">
              <div className="th-chart"><div className="th-chart-heading"><h3>Performance against {heating ? 'the weather' : pump.mode === 'fridge' ? 'kitchen temperature' : 'the weather'}</h3><span>COEFFICIENT OF PERFORMANCE</span></div><PumpChart pump={pump} s={s} kind="cop" /><p>{heating ? 'Above one at every temperature: even in deep cold, a heat pump delivers more heat than the electricity it uses.' : 'The closer the two temperatures, the less work each joule of heat needs.'}</p></div>
              <div className="th-chart"><div className="th-chart-heading"><h3>Electricity against {pump.mode === 'fridge' ? 'kitchen temperature' : 'the weather'}</h3><span>WATTS TO HOLD THE TEMPERATURE</span></div><PumpChart pump={pump} s={s} kind="power" /><p>{heating ? 'Colder weather costs twice: more heat leaks out, and each joule is harder to lift.' : 'Hotter surroundings cost twice: more heat leaks in, and each joule must be lifted further.'}</p></div>
            </section>
          </>}
        </div>
      </section>

      <section className="th-understand"><span className="eyebrow">WHAT THE LAB IS SHOWING</span><h2>One machine, <em>two directions.</em></h2>
        <div className="th-explanations">
          <article><span>01 · THE CYCLE</span><h3>Work comes from a difference.</h3><p>A hot gas pushes a piston harder than a cold one. Let it expand while hot and squeeze it back while cold, and the outward push beats the inward one. But the gas only comes back to its start if it hands heat to something colder. That handed-over heat is not a design flaw. It is the cost of running in a circle.</p></article>
          <article><span>02 · THE LIMIT</span><h3>The best possible is also the slowest.</h3><p>Carnot’s engine wastes the least because nothing in it is ever out of balance: heat crosses no temperature gap, nothing rubs. That also means nothing happens at any speed. A real engine opens gaps to make heat hurry, and each gap makes entropy and costs work.</p></article>
          <article><span>03 · BACKWARDS</span><h3>Moving heat is cheaper than making it.</h3><p>Reverse every arrow and work carries heat uphill. An engine that is 5% efficient between two close temperatures becomes, backwards, a heat pump that delivers twenty joules for one. Refrigerators, air conditioners, and heat pumps are all this one machine, with the box drawn round a different end.</p></article>
        </div>
        <details className="th-rules"><summary>Inside the model</summary><div>
          <p><b>The cycle.</b> An ideal gas, <code>PV = nRT</code>, starting at 10 litres per mole. Strokes 1 and 3 are isothermal: <code>Q = nRT ln(V<sub>2</sub>/V<sub>1</sub>)</code>. Strokes 2 and 4 are adiabatic: <code>TV<sup>γ−1</sup></code> is constant, with γ = 5/3 for helium and 7/5 for air. Efficiency is <code>1 − T<sub>c</sub>/T<sub>h</sub></code> and the entropy carried is <code>nR ln(V<sub>2</sub>/V<sub>1</sub>)</code>.</p>
          <p><b>A real engine.</b> The same cycle run <code>f</code> times a second between heat exchangers of conductance <code>K</code> on each side (the Curzon–Ahlborn model). The gas settles at <code>T<sub>h</sub>K/(K + fΔS)</code> on the hot stroke and <code>T<sub>c</sub>K/(K − fΔS)</code> on the cold one. Power peaks at <code>½K(√T<sub>h</sub> − √T<sub>c</sub>)²</code> with efficiency <code>1 − √(T<sub>c</sub>/T<sub>h</sub>)</code>. Friction removes a fixed share of the work and returns it as waste heat.</p>
          <p><b>Backwards.</b> A reversed Carnot cycle between coils that sit a fixed gap colder than the cold side and hotter than the warm side. The compressor needs 1/quality times the ideal work. Cooling performance is <code>quality × T<sub>coil,c</sub>/(T<sub>coil,h</sub> − T<sub>coil,c</sub>)</code>, and heating performance is exactly one more, because the work arrives as heat too. The load is the leak through the walls, proportional to the temperature difference.</p>
          <p>Left out: real refrigerators and heat pumps use a fluid that boils and condenses (vapour compression), not a gas in a Carnot cycle, and their performance depends on that fluid. Also left out: defrosting, fans and pumps, heat leaking straight through the engine, the time the adiabatic strokes take, and gases that are not ideal.</p>
        </div></details>
      </section>
    </main>
    <footer><span>heat lab. · lixionary / simulators</span><a href="/">Explore all simulators <ArrowUpRight size={12} /></a></footer>
  </div>;
}
