import { useId, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, CircuitBoard, Lightbulb, SlidersHorizontal } from 'lucide-react';
import { designMos, drainCurrent, gateCurrents, gateOutput, mosRegion, pinchOff, solveJunction, switching, transconductance, transferCurve, type Gate, type GateKind, type Junction, type Mos } from './model';
import { doping, power10, si, volts } from './format';
import { GATE, JUNCTION, MOS, PRESETS, type Stage } from './presets';
import { BandDiagram, DiodeCurve } from './JunctionViews';
import { CrossSection, OutputCurves, TransferCurve } from './MosViews';
import { level, logic, Schematic, TransferPlot, TruthTable } from './GateViews';

const GROUPS = [...new Set(PRESETS.map(p => p.group))];
const STAGES: { key: Stage; name: string; made: string }[] = [{ key: 'junction', name: 'Junction', made: 'a diode' }, { key: 'transistor', name: 'Transistor', made: 'a switch' }, { key: 'gate', name: 'Logic gate', made: 'a decision' }];
const KINDS: { key: GateKind; name: string }[] = [{ key: 'not', name: 'NOT' }, { key: 'nand', name: 'NAND' }, { key: 'nor', name: 'NOR' }];
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

function startingPreset() {
  const key = new URLSearchParams(window.location.search).get('preset'), found = PRESETS.find(p => p.key === key);
  return { preset: found ?? PRESETS.find(p => p.key === 'diode')!, unknown: key !== null && !found };
}

function Slider({ label, value, min, max, step, text, onChange }: { label: string; value: number; min: number; max: number; step: number; text: string; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="si-slider"><div><label htmlFor={id}>{label}</label><output htmlFor={id}>{text}</output></div><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></div>;
}
function Doping({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Slider label={label} value={round(Math.log10(value), 1)} min={14} max={19} step={0.1} text={doping(value)} onChange={power => onChange(10 ** power)} />;
}
function Stat({ label, id, value, children }: { label: string; id: string; value: string; children: ReactNode }) {
  return <div><span>{label}</span><b data-testid={id}>{value}</b><small>{children}</small></div>;
}

export default function App() {
  const [start] = useState(startingPreset);
  const [presetKey, setPresetKey] = useState(start.preset.key), [stage, setStage] = useState<Stage>(start.preset.stage);
  const [junction, setJunction] = useState<Junction>(start.preset.junction ?? JUNCTION), [mos, setMos] = useState<Mos>(start.preset.mos ?? MOS), [gate, setGate] = useState<Gate>(start.preset.gate ?? GATE);
  const [unknownLink, setUnknownLink] = useState(start.unknown);
  const preset = PRESETS.find(p => p.key === presetKey)!;

  function load(key: string) {
    const next = PRESETS.find(p => p.key === key)!;
    setPresetKey(key); setStage(next.stage); setUnknownLink(false);
    if (next.junction) setJunction(next.junction);
    if (next.mos) setMos(next.mos);
    if (next.gate) setGate(next.gate);
    window.history.replaceState(null, '', `?preset=${key}`);
  }
  const patchGate = (patch: Partial<Gate>) => { const next = { ...gate, ...patch }; setGate({ ...next, vinA: Math.min(next.vinA, next.vdd) }); };

  const s = solveJunction(junction), d = designMos(mos.na, mos.toxNm);
  const drain = drainCurrent(d, mos.ratio, mos.vgs, mos.vds), region = mosRegion(d, mos.vgs, mos.vds), pinch = pinchOff(d, mos.vgs);
  const out = gateOutput(d, mos.ratio, gate), curve = transferCurve(d, mos.ratio, gate), cost = switching(d, mos.ratio, gate), through = Math.min(...Object.values(gateCurrents(d, mos.ratio, gate, gate.vinA, out)));
  const stateText = { equilibrium: 'At rest', forward: 'Conducting', reverse: 'Blocking', breakdown: 'Breakdown' }[s.state];
  const regionText = { cutoff: 'Off', triode: 'Closed switch', saturation: 'Current source' }[region];

  return <div className="si-app">
    <header className="si-header"><a className="si-brand" href="/"><span><CircuitBoard size={20} strokeWidth={1.6} /></span>silicon<span className="muted">lab.</span></a><a className="si-back" href="/"><ArrowLeft size={13} />All simulators</a></header>
    <main>
      <section className="si-hero"><div><span className="eyebrow">FROM QUANTUM PHYSICS TO A LOGIC GATE</span><h1>Sand that conducts one way.<br />Then sand that <em>decides.</em></h1><p>Add a few foreign atoms to silicon and a junction appears. <br />Put a gate over it and you have a switch. Join two switches and you have logic.</p><a href="#lab">Start at the junction <ArrowDown size={14} /></a></div>
        <div className="si-hero-note" aria-hidden="true"><svg viewBox="0 0 220 90"><rect x="8" y="30" width="48" height="30" fill="#c65a48" fillOpacity=".3" /><rect x="56" y="30" width="48" height="30" fill="#4d7fc0" fillOpacity=".3" /><path d="M56 30V60" stroke="#8a8478" /><path d="M112 45h14" stroke="#8a8478" /><path d="M150 22V68M142 30V60M136 45H120M150 30H168V22M150 60H168V68" fill="none" stroke="#a5622f" strokeWidth="1.6" /><path d="M176 45h12" stroke="#8a8478" /><path d="M192 30h10a15 15 0 0 1 0 30h-10z" fill="none" stroke="#33444b" strokeWidth="1.6" /><circle cx="216" cy="45" r="3" fill="none" stroke="#33444b" strokeWidth="1.4" /></svg><p>One junction makes a diode.<br />Billions of them make a processor.</p><span>DIODE · TRANSISTOR · GATE</span></div></section>
      <div className="si-section-heading"><span className="eyebrow">THREE LINKS OF ONE CHAIN</span><span>DEVICE EQUATIONS FOR SILICON · NOTHING TUNED BY HAND</span></div>
      <nav className="si-chain" aria-label="Stages">{STAGES.map((item, i) => <button key={item.key} aria-pressed={stage === item.key} onClick={() => setStage(item.key)}><b>{i + 1}</b><span>{item.name}<small>{item.made}</small></span>{i < 2 && <ArrowRight size={14} />}</button>)}</nav>
      <section id="lab" className="si-lab" aria-label="Semiconductor simulation">
        <aside className="si-settings">
          <div className="si-panel-heading"><h2>Build the experiment</h2><SlidersHorizontal size={15} /></div>
          <label className="si-label" htmlFor="si-preset">Start with an experiment</label>
          <select id="si-preset" value={presetKey} onChange={event => load(event.target.value)}>{GROUPS.map(group => <optgroup key={group} label={group}>{PRESETS.filter(p => p.group === group).map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</optgroup>)}</select>
          <p className="si-hint" data-testid="si-notice">{preset.stage === stage ? preset.notice : 'You have moved to another link of the chain. Pick one of its experiments above, or use the controls below.'}</p>
          {unknownLink && <p className="si-error" role="status">That link names an experiment this lab does not have, so it opened the first one.</p>}

          {stage === 'junction' && <>
            <details open><summary>The voltage across it</summary><div className="si-fields">
              <Slider label="Applied voltage" value={junction.voltage} min={-12} max={0.9} step={0.01} text={volts(junction.voltage)} onChange={voltage => setJunction({ ...junction, voltage })} />
              <div className="si-switch three" role="group" aria-label="Voltage shortcuts">{[['Reverse 5 V', -5], ['None', 0], ['Forward 0.65 V', 0.65]].map(([name, voltage]) => <button key={name} aria-pressed={junction.voltage === voltage} onClick={() => setJunction({ ...junction, voltage: voltage as number })}>{name}</button>)}</div>
            </div></details>
            <details open><summary>The silicon</summary><div className="si-fields">
              <Doping label="Acceptor atoms, p side" value={junction.na} onChange={na => setJunction({ ...junction, na })} />
              <Doping label="Donor atoms, n side" value={junction.nd} onChange={nd => setJunction({ ...junction, nd })} />
              <Slider label="Temperature" value={junction.temperature} min={250} max={400} step={1} text={`${junction.temperature} K · ${junction.temperature - 273} °C`} onChange={temperature => setJunction({ ...junction, temperature })} />
            </div></details>
          </>}

          {stage === 'transistor' && <>
            <details open><summary>The voltages</summary><div className="si-fields">
              <Slider label="Gate voltage" value={mos.vgs} min={0} max={3} step={0.01} text={volts(mos.vgs)} onChange={vgs => setMos({ ...mos, vgs })} />
              <Slider label="Drain voltage" value={mos.vds} min={0} max={3} step={0.01} text={volts(mos.vds)} onChange={vds => setMos({ ...mos, vds })} />
            </div></details>
            <details open><summary>How it is built</summary><div className="si-fields">
              <Doping label="Acceptor atoms in the body" value={mos.na} onChange={na => setMos({ ...mos, na })} />
              <Slider label="Oxide thickness" value={mos.toxNm} min={2} max={40} step={0.5} text={`${mos.toxNm} nm`} onChange={toxNm => setMos({ ...mos, toxNm })} />
              <Slider label="Width ÷ length" value={mos.ratio} min={1} max={50} step={1} text={`${mos.ratio} to 1`} onChange={ratio => setMos({ ...mos, ratio })} />
            </div></details>
          </>}

          {stage === 'gate' && <>
            <details open><summary>The gate and its inputs</summary><div className="si-fields">
              <div className="si-switch three" role="group" aria-label="Kind of gate">{KINDS.map(kind => <button key={kind.key} aria-pressed={gate.kind === kind.key} onClick={() => patchGate({ kind: kind.key })}>{kind.name}</button>)}</div>
              <Slider label="Input A" value={gate.vinA} min={0} max={gate.vdd} step={0.01} text={`${volts(gate.vinA)} · logic ${logic(gate.vinA, gate.vdd)}`} onChange={vinA => patchGate({ vinA })} />
              <div className="si-switch" role="group" aria-label="Input A level"><button aria-pressed={gate.vinA === 0} onClick={() => patchGate({ vinA: 0 })}>A = 0</button><button aria-pressed={gate.vinA === gate.vdd} onClick={() => patchGate({ vinA: gate.vdd })}>A = 1</button></div>
              {gate.kind !== 'not' && <div className="si-switch" role="group" aria-label="Input B level"><button aria-pressed={!gate.bHigh} onClick={() => patchGate({ bHigh: false })}>B = 0</button><button aria-pressed={gate.bHigh} onClick={() => patchGate({ bHigh: true })}>B = 1</button></div>}
            </div></details>
            <details open><summary>The supply and the transistors</summary><div className="si-fields">
              <Slider label="Supply voltage" value={gate.vdd} min={0.2} max={3.3} step={0.05} text={volts(gate.vdd)} onChange={vdd => patchGate({ vdd, vinA: gate.vinA === gate.vdd ? vdd : gate.vinA })} />
              <Slider label="p-channel width" value={gate.pWidth} min={1} max={5} step={0.1} text={`${gate.pWidth.toFixed(1)}× the n-channel`} onChange={pWidth => patchGate({ pWidth })} />
              <p className="si-hint">These are the transistors from link 2: threshold {volts(d.threshold)}, {mos.toxNm} nm oxide. Change them there.</p>
            </div></details>
          </>}
          <div className="si-tip"><Lightbulb size={16} /><p>{stage === 'junction' ? 'Slide the voltage through zero and watch the hill between the two sides rise and fall.' : stage === 'transistor' ? 'Raise the gate voltage past the threshold and a channel appears under the oxide.' : 'Sweep input A slowly. The output barely moves, then flips all at once.'}</p></div>
        </aside>

        <div className="si-stage">
          {stage === 'junction' && <>
            <div className="si-stage-heading"><div><span className="si-status-dot" />A PN junction, {stateText.toLowerCase()}</div><span><b>{volts(junction.voltage)}</b> APPLIED · <b>{si(s.current, 'A')}</b></span></div>
            <div className="si-picture"><BandDiagram j={junction} s={s} /><div className="si-legend"><span><i style={{ background: '#c65a48' }} />Fermi level, p side</span><span><i style={{ background: '#4d7fc0' }} />Fermi level, n side{Math.abs(s.across) > 0.005 ? `: ${volts(Math.abs(s.across))} ${s.across > 0 ? 'higher' : 'lower'}` : ''}</span><span><i className="dot" style={{ background: '#4d7fc0' }} />electrons</span><span><i className="dot ring" />holes</span><span><i className="dashed" />middle of the gap</span></div></div>
            <div className="si-stats">
              <Stat label="State" id="si-state" value={stateText}>{s.state === 'forward' ? 'The hill is lowered and carriers pour over it.' : s.state === 'reverse' ? 'The hill is raised. Only stray carriers cross.' : s.state === 'breakdown' ? 'The field tears carriers loose. Voltage stays pinned.' : 'Diffusion and the built-in field are in balance.'}</Stat>
              <Stat label="Current" id="si-current" value={si(s.current, 'A')}>Through a junction one millimetre square.</Stat>
              <Stat label="Built-in voltage" id="si-builtin" value={volts(s.builtIn, 3)}>The hill’s height with nothing applied. Set by doping and temperature.</Stat>
              <Stat label="Empty strip" id="si-width" value={si(s.width, 'm')}>{si(s.xp, 'm')} into the p side, {si(s.xn, 'm')} into the n side.</Stat>
              <Stat label="Peak field" id="si-field" value={`${(s.field / 1e5).toFixed(s.field < 1e7 ? 1 : 0)} kV/cm`}>Right at the boundary between the two sides.</Stat>
              <Stat label="Leakage" id="si-saturation" value={si(s.saturation, 'A')}>The reverse current. It doubles about every 4 K.</Stat>
              <Stat label="Capacitance" id="si-capacitance" value={si(s.capacitance, 'F')}>The strip is a capacitor whose plates the voltage moves.</Stat>
              <Stat label="Breaks down at" id="si-breakdown" value={`${s.breakdown >= 100 ? s.breakdown.toFixed(0) : s.breakdown.toFixed(1)} V reverse`}>{s.breakdown > 12 ? 'Beyond this lab’s 12 V. Dope more heavily to bring it closer.' : 'Within reach: slide the voltage past it.'}</Stat>
            </div>
            <section className="si-charts" aria-label="Current against voltage">
              <div className="si-chart"><div className="si-chart-heading"><h3>Current against voltage</h3><span>LINEAR SCALE</span></div><DiodeCurve j={junction} s={s} log={false} /><p>On a plain scale the diode looks like a switch that closes near 0.6 V.</p></div>
              <div className="si-chart"><div className="si-chart-heading"><h3>The same curve, logarithmic</h3><span>SIZE OF THE CURRENT · 1 fA TO 1 A</span></div><DiodeCurve j={junction} s={s} log /><p>There is no switch. It is one exponential: ten times the current for every {(s.vt * Math.LN10 * 1000).toFixed(0)} mV, until resistance takes over.</p></div>
            </section>
          </>}

          {stage === 'transistor' && <>
            <div className="si-stage-heading"><div><span className="si-status-dot" />An n-channel MOS transistor, {regionText.toLowerCase()}</div><span>THRESHOLD <b>{volts(d.threshold)}</b> · <b>{si(drain, 'A')}</b></span></div>
            <div className="si-picture"><CrossSection mos={mos} d={d} /><p className="si-caption centre">{region === 'cutoff' ? 'Below threshold: nothing joins source to drain.' : region === 'triode' ? 'The gate has drawn a sheet of electrons along the whole surface.' : 'The channel pinches off before the drain, so current no longer rises with drain voltage.'} The pale layer under the gate is {mos.toxNm} nm of oxide.</p></div>
            <div className="si-stats">
              <Stat label="State" id="si-region" value={regionText}>{region === 'cutoff' ? 'Gate below threshold. Only a leak flows.' : region === 'triode' ? 'A resistor the gate controls.' : 'Current set by the gate, not by the drain.'}</Stat>
              <Stat label="Drain current" id="si-drain" value={si(drain, 'A')}>From drain to source through the channel.</Stat>
              <Stat label="Threshold voltage" id="si-threshold" value={volts(d.threshold, 3)}>The gate voltage at which a channel forms. Set by doping and oxide.</Stat>
              <Stat label="Levels off above" id="si-pinch" value={pinch > 0 ? volts(pinch) : '—'}>{pinch > 0 ? 'Drain voltage at which the channel pinches off.' : 'No channel to pinch off yet.'}</Stat>
              <Stat label="Gain" id="si-gm" value={si(transconductance(d, mos.ratio, mos.vgs, mos.vds), 'A/V')}>Extra current per extra volt on the gate.</Stat>
              <Stat label="Leak slope" id="si-swing" value={`${(d.swing * 1000).toFixed(1)} mV/decade`}>Gate voltage that changes the off current tenfold. Physics allows no less than 60.</Stat>
              <Stat label="On ÷ off current" id="si-onoff" value={power10(drainCurrent(d, mos.ratio, 1.8, 1.8) / drainCurrent(d, mos.ratio, 0, 1.8))}>With a 1.8 V supply. This ratio is what makes it a switch.</Stat>
              <Stat label="Gate capacitance" id="si-cox" value={`${(d.cox * 1e3).toFixed(2)} fF/µm²`}>A thinner oxide grips the channel harder.</Stat>
            </div>
            <section className="si-charts" aria-label="Transistor curves">
              <div className="si-chart"><div className="si-chart-heading"><h3>Current against drain voltage</h3><span>ONE CURVE PER GATE VOLTAGE</span></div><OutputCurves mos={mos} d={d} /><p>Each curve rises like a resistor, then goes flat. The bold one is the present gate voltage.</p></div>
              <div className="si-chart"><div className="si-chart-heading"><h3>Current against gate voltage</h3><span>LOGARITHMIC · 0.1 pA TO 10 mA</span></div><TransferCurve mos={mos} d={d} /><p>Below threshold the current is the diode’s exponential again: the gate is lowering a hill.</p></div>
            </section>
          </>}

          {stage === 'gate' && <>
            <div className="si-stage-heading"><div><span className="si-status-dot" />A CMOS {gate.kind.toUpperCase()} gate</div><span>OUTPUT <b>{volts(out)}</b> · LOGIC <b>{level(out, gate.vdd)}</b></span></div>
            <div className="si-picture split"><Schematic gate={gate} d={d} ratio={mos.ratio} /><div><TruthTable gate={gate} d={d} ratio={mos.ratio} /><p className="si-caption">A circle on a transistor’s gate marks a p-channel device: it conducts when its input is low.</p></div></div>
            <div className="si-stats">
              <Stat label="Output" id="si-output" value={`${volts(out)} · ${level(out, gate.vdd)}`}>{gate.kind === 'not' ? 'The opposite of A.' : gate.kind === 'nand' ? 'Low only when A and B are both high.' : 'High only when A and B are both low.'}</Stat>
              <Stat label="Switches at" id="si-vm" value={volts(curve.threshold, 3)}>Input voltage where output equals input.</Stat>
              <Stat label="Noise margins" id="si-margins" value={curve.regenerates ? `${curve.marginLow.toFixed(2)} / ${curve.marginHigh.toFixed(2)} V` : 'none'}>{curve.regenerates ? 'How much a 0 or a 1 can be disturbed and still be read correctly.' : 'Gain is below one: the gate no longer cleans up a signal.'}</Stat>
              <Stat label="Peak gain" id="si-gain" value={`${curve.gain.toFixed(curve.gain < 10 ? 1 : 0)}×`}>Steepness in the middle. Above one, each gate restores the signal.</Stat>
              <Stat label="Current through it" id="si-supply" value={si(through, 'A')}>{through > 1e-6 ? 'Both networks conduct at once: wasted current.' : 'One network is off, so almost nothing flows.'}</Stat>
              <Stat label="Energy per switch" id="si-energy" value={si(cost.energy, 'J')}>Charging 10 fF of wiring: C × V². Halve the supply, quarter the energy.</Stat>
              <Stat label="Delay" id="si-delay" value={si(cost.delay, 's')}>Time for the transistors to move that charge.</Stat>
              <Stat label="Idle power" id="si-leak" value={si(cost.leakage, 'W')}>Leak through the transistor that is off.</Stat>
            </div>
            <section className="si-charts" aria-label="Gate behaviour">
              <div className="si-chart"><div className="si-chart-heading"><h3>Output against input A</h3><span>{gate.kind === 'not' ? 'THE WHOLE GATE' : `WITH B HELD AT ${gate.bHigh ? 1 : 0}`}</span></div><TransferPlot gate={gate} d={d} ratio={mos.ratio} /><p>Flat, a cliff, flat. A slightly wrong input still gives an exactly right output, which is why digital circuits can be chained without end.</p></div>
              <div className="si-chart si-next"><div className="si-chart-heading"><h3>Where the chain goes next</h3><span>GATES TO A PROCESSOR</span></div><p>Two gates cross-coupled remember one bit. A few dozen add two numbers. The CPU Lab picks up exactly here, with registers, an adder, and a clock.</p><p>A full adder for one bit takes 28 of these transistors. A phone’s processor has over ten billion, each switching in picoseconds on about {si(cost.energy, 'J')} at this supply voltage.</p><a href="/cpu/">Continue in CPU Lab <ArrowUpRight size={13} /></a></div>
            </section>
          </>}
        </div>
      </section>

      <section className="si-understand"><span className="eyebrow">WHAT THE LAB IS SHOWING</span><h2>One hill, <em>three uses.</em></h2>
        <div className="si-explanations">
          <article><span>01 · THE JUNCTION</span><h3>A hill for charge.</h3><p>Phosphorus atoms give silicon spare electrons; boron atoms give it holes. Where the two kinds meet, carriers cancel and leave a field behind. That field is an energy hill. Forward voltage lowers it and current rises exponentially. Reverse voltage raises it and current stops.</p></article>
          <article><span>02 · THE TRANSISTOR</span><h3>A hill with a handle.</h3><p>Put two junctions back to back and nothing flows. Lay a metal gate over the gap, insulated by a few nanometres of oxide, and its field lowers the hill from outside. No current enters the gate. A voltage alone controls a current: that is amplification, and it is switching.</p></article>
          <article><span>03 · THE GATE</span><h3>Two switches that disagree.</h3><p>Pair a transistor that closes on a high input with one that closes on a low input. One always connects the output to a rail; the other is always open. The result is a clean 0 or 1, almost no idle current, and enough gain to drive the next gate. Everything digital is built from this.</p></article>
        </div>
        <details className="si-rules"><summary>Inside the model</summary><div>
          <p><b>Junction.</b> An abrupt junction in the depletion approximation: built-in voltage <code>V<sub>bi</sub> = (kT/q) ln(N<sub>A</sub>N<sub>D</sub>/n<sub>i</sub>²)</code>, width <code>W = √(2ε/q · (1/N<sub>A</sub> + 1/N<sub>D</sub>) · (V<sub>bi</sub> − V))</code>, and Shockley’s current <code>I = I<sub>s</sub>(e<sup>V/V<sub>T</sub></sup> − 1)</code> with the saturation current from diffusion lengths and a 1 µs lifetime. One ohm of series resistance bends the curve at high current. Breakdown starts where the peak field reaches silicon’s critical field.</p>
          <p><b>Transistor.</b> Threshold from the MOS capacitor: <code>V<sub>T</sub> = V<sub>FB</sub> + 2φ<sub>F</sub> + γ√(2φ<sub>F</sub>)</code> with an n+ polysilicon gate. Current from the EKV equation, one expression that is exponential below threshold and a square law above it, with 5% per volt of channel-length modulation. Surface mobility is half the bulk value.</p>
          <p><b>Gate.</b> The p-channel transistor is the n-channel one mirrored, with holes 0.4 times as mobile. The output is the voltage where pull-up and pull-down currents are equal. Two transistors in series count as one of half the strength. Delay is the time to move the charge on a 10 fF load.</p>
          <p>Left out: temperature in the transistor (fixed at 300 K), short-channel effects, velocity saturation, gate leakage, the body effect in stacked transistors, and recombination inside the junction’s empty strip. Real modern transistors are fins or sheets a few nanometres wide, but they work on the same principle.</p>
        </div></details>
      </section>
    </main>
    <footer><span>silicon lab. · lixionary / simulators</span><a href="/">Explore all simulators <ArrowUpRight size={12} /></a></footer>
  </div>;
}
