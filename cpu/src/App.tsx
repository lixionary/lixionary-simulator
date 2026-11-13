import Datapath from './Datapath';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Cpu, Gauge, Lightbulb, Pause, Play, RotateCcw, Sparkles, StepForward } from 'lucide-react';
import { assemble, byte, DEFAULT_CONFIG, hex, initialState, literal, PRESETS, presetInitial, run, signed, sources, STAGES, stepCycle, type Config, type Initial, type Program, type State, type Token } from './model';

const colors = ['#75866b', '#8c7aa4', '#a88557', '#638c96', '#a56f7e', '#777da7'];
const color = (token: Token) => colors[token.instruction.pc % colors.length];
const stageNames = ['Fetch', 'Decode', 'Execute', 'Memory', 'Write-back'];
const instructions = [
  ['LI r1, 7', 'Put a literal byte in r1.'], ['ADD r3, r1, r2', 'Add two registers; keep the low eight bits.'], ['SUB r3, r1, r2', 'Subtract r2 from r1; wrap to one byte.'],
  ['ADDI r2, r1, -1', 'Add a signed immediate (−128 to 127).'], ['LD r1, 16(r0)', 'Read one unsigned byte at base + offset.'], ['ST r1, 17(r0)', 'Write the byte in r1 at base + offset.'],
  ['BEQ r1, r2, label', 'Jump to a label if the bytes are equal.'], ['J label', 'Always jump to a label.'], ['NOP', 'Retire an instruction without changing data.'], ['HALT', 'Stop fetching and drain older work.'],
];
function executeDetail(token: Token | null): string {
  if (!token) return 'waiting';
  const i = token.instruction, [a = 0, b = 0] = token.operands ?? [];
  if (i.op === 'LI') return `${i.imm} → ${token.result}`;
  if (token.result !== undefined) return `${a} ${i.op === 'SUB' ? '−' : '+'} ${i.imm ?? b} → ${token.result}`;
  if (token.address !== undefined) return `${a} + ${i.imm} → address ${token.address}`;
  if (i.op === 'BEQ') return `${a} ${a === b ? '=' : '≠'} ${b}`;
  return i.op;
}
function Bits({ value, before, label }: { value: number; before?: number; label: string }) {
  return <span className="cpu-bits" aria-label={`${label}: ${value.toString(2).padStart(8, '0')}`}>{Array.from({ length: 8 }, (_, n) => {
    const bit = (value >> (7 - n)) & 1, changed = before !== undefined && bit !== ((before >> (7 - n)) & 1);
    return <span key={n} className={`${bit ? 'one' : ''} ${changed ? 'changed-bit' : ''}`}>{bit}</span>;
  })}</span>;
}
function ByteInput({ value, label, disabled, onCommit }: { value: number; label: string; disabled?: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value)), [error, setError] = useState('');
  useEffect(() => { setDraft(String(value)); setError(''); }, [value]);
  return <span className="cpu-byte-input"><input aria-label={label} aria-invalid={!!error} value={draft} disabled={disabled} spellCheck={false} onChange={e => { setDraft(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={() => {
    try { const next = byte(literal(draft.trim())); setDraft(String(next)); setError(''); if (next !== value) onCommit(next); } catch (e) { setError((e as Error).message); }
  }} />{error && <span className="cpu-field-error" role="alert">{error}</span>}</span>;
}
function Timeline({ history, index }: { history: State[]; index: number }) {
  const from = Math.max(1, index - 17), snapshots = history.slice(from, index + 1);
  const tokens = new Map<number, Token>();
  snapshots.forEach(s => { STAGES.forEach(stage => { const t = s.pipe[stage]; if (t) tokens.set(t.id, t); }); s.squashed.forEach(t => tokens.set(t.id, t)); });
  return <div className="cpu-timeline-scroll" tabIndex={0} aria-label="Pipeline timeline, scroll horizontally">
    {snapshots.length ? <table className="cpu-timeline"><thead><tr><th>INSTRUCTION</th>{snapshots.map(s => <th key={s.cycle} className={s.cycle === index ? 'current-cycle' : ''}>{s.cycle}</th>)}</tr></thead><tbody>{[...tokens.values()].sort((a, b) => a.id - b.id).map(t => <tr key={t.id}><th><i style={{ background: color(t) }} /><span>#{t.id + 1} · {t.instruction.text}</span></th>{snapshots.map(s => {
      const stage = STAGES.find(stage => s.pipe[stage]?.id === t.id), squash = s.squashed.some(v => v.id === t.id), held = stage && s.held.includes(stage);
      return <td key={s.cycle}>{squash ? <span className="cpu-squashed" title="Flushed before any effects">×</span> : stage ? <span style={{ color: color(t), background: `${color(t)}19` }} className={held ? 'cpu-held' : ''} title={`${stageNames[STAGES.indexOf(stage)]}${held ? ' · waiting' : ''}`}>{stage}{held && '·'}</span> : null}</td>;
    })}</tr>)}</tbody></table> : <p className="cpu-empty">Step the clock to start the timeline.</p>}
  </div>;
}
export default function App() {
  const [preset, setPreset] = useState(0), [source, setSource] = useState(PRESETS[0].source), [initial, setInitial] = useState<Initial>(() => presetInitial(0));
  const [program, setProgram] = useState<Program>(() => assemble(PRESETS[0].source)), [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [history, setHistory] = useState<State[]>(() => [initialState(presetInitial(0))]), [index, setIndex] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(500);
  const [error, setError] = useState(''), [dirty, setDirty] = useState(false), [address, setAddress] = useState(16);
  const state = history[index], before = history[Math.max(0, index - 1)], memoryPage = Math.floor(address / 64);
  const baseline = useMemo(() => run(program, initial, DEFAULT_CONFIG), [program, initial]);
  const baselineReady = baseline.done && !baseline.fault && state.done && !state.fault;
  const ready = !dirty && !error;
  function restart(nextInitial = initial) { setPlaying(false); setHistory([initialState(nextInitial)]); setIndex(0); }
  function changeInitial(next: Initial) { setInitial(next); restart(next); }
  function changeConfig(next: Config) { setConfig(next); restart(); }
  function loadPreset(n: number) {
    const next = presetInitial(n); setPreset(n); setSource(PRESETS[n].source); setProgram(assemble(PRESETS[n].source)); setInitial(next); setError(''); setDirty(false); setAddress(n === 3 ? 32 : 16); restart(next);
  }
  function build() {
    setPlaying(false);
    try { const p = assemble(source); setProgram(p); setError(''); setDirty(false); restart(); } catch (e) { setError((e as Error).message); }
  }
  function advance() {
    if (!ready) return;
    if (index < history.length - 1) { setIndex(index + 1); return; }
    if (state.done) return;
    const next = stepCycle(state, program, config); setHistory([...history, next]); setIndex(index + 1);
  }
  useEffect(() => {
    if (!playing) return;
    if (!ready || state.done || state.cycle >= 10000) { setPlaying(false); return; }
    const timer = window.setTimeout(advance, speed); return () => window.clearTimeout(timer);
  }, [playing, ready, state, speed, index, history]);
  const doneLabel = state.fault ? 'Fault' : state.done ? 'Complete' : playing ? 'Running' : state.cycle ? 'Paused' : 'Ready';
  return <div className="cpu-app">
    <header className="cpu-header"><a href="/" className="cpu-brand"><span><Cpu size={23} strokeWidth={1.5} /></span>cpu<span className="muted">lab.</span></a><nav aria-label="Main navigation"><a href="#playground">The processor</a><a href="#understand">The big idea</a></nav><a className="cpu-back" href="/"><ArrowLeft size={14} />All simulators</a></header>
    <main>
      <section className="cpu-hero"><div><span className="eyebrow"><i className="cpu-dot" /> AN INTERACTIVE COMPUTER ARCHITECTURE LAB</span><h1>Small bytes.<br />A little <em>clockwork.</em></h1><p>A number in memory. A tiny instruction. A tick of the clock.<br />Follow the work inside a processor, one cycle at a time.</p><a href="#playground">Take a look inside <ArrowDown size={14} /></a></div><div className="cpu-hero-art" aria-hidden="true"><span className="eyebrow">FIVE STAGES. ONE SHARED RHYTHM.</span><div className="cpu-art-stages">{STAGES.map((s, n) => <span key={s} style={{ '--stage': colors[n] } as React.CSSProperties}>{s}<small>0{n + 1}</small></span>)}</div><div className="cpu-art-track"><span /><span /><span /><span /><span /></div><span className="cpu-art-note">one tick closer to an answer.</span></div></section>
      <div className="cpu-subject"><span>8-BIT / MIPS-INSPIRED / FIVE-STAGE PIPELINE</span><span><i className="cpu-dot" /> REAL STATE. EVERY CLOCK.</span></div>
      <section id="playground" className="cpu-lab" aria-label="CPU simulation playground">
        <aside className="cpu-sidebar">
          <div className="cpu-sidebar-title"><span className="eyebrow">YOUR LITTLE PROGRAM</span><Cpu size={16} /></div>
          <label className="cpu-label" htmlFor="cpu-example">Start with an experiment</label><select id="cpu-example" value={preset} onChange={e => loadPreset(Number(e.target.value))}>{PRESETS.map((p, n) => <option key={p.id} value={n}>{p.name}</option>)}</select><p className="cpu-hint">{PRESETS[preset].hint}</p>
          <div className="cpu-editor-heading"><label className="cpu-label" htmlFor="cpu-source">Assembly editor</label><span>{dirty ? 'UNASSEMBLED CHANGES' : `${program.length} INSTRUCTIONS`}</span></div>
          <textarea id="cpu-source" spellCheck={false} value={source} onChange={e => { setSource(e.target.value); setDirty(true); setError(''); restart(); }} />
          {error && <p className="cpu-error" role="alert">{error}</p>}
          <button className="cpu-primary cpu-assemble" onClick={build}><Cpu size={14} />Assemble & reset<ArrowRight size={14} /></button>
          <p className="cpu-hint">Decimal or hex. Labels and # comments welcome. Changing the program requires assembly.</p>
          <div className="cpu-settings"><h2><Gauge size={16} />Try a little what-if</h2><label className="cpu-switch"><span><strong>Operand forwarding</strong><small>Send results straight to execute.</small></span><input type="checkbox" checked={config.forwarding} onChange={e => changeConfig({ ...config, forwarding: e.target.checked })} /></label><label className="cpu-label" htmlFor="cpu-latency">RAM latency <strong>{config.ramLatency} {config.ramLatency === 1 ? 'cycle' : 'cycles'}</strong></label><input id="cpu-latency" type="range" min="1" max="5" value={config.ramLatency} onChange={e => changeConfig({ ...config, ramLatency: Number(e.target.value) })} /><div className="cpu-range-labels"><span>1 · fast</span><span>5 · more waiting</span></div><p className="cpu-hint">Hardware changes restart execution with the same input bytes.</p></div>
          <div className="cpu-sidebar-note"><Lightbulb size={20} /><p>More clock cycles can produce the same answer. Watch what happens when an instruction has to wait.</p></div>
          <details className="cpu-reference"><summary>Ten tiny instructions <BookOpen size={14} /></summary><dl>{instructions.map(([code, help]) => <div key={code}><dt><code>{code}</code></dt><dd>{help}</dd></div>)}</dl><p>Registers r0–r7. r0 stays zero. Bytes wrap at 256. Memory offsets are −128 to 127; use a base register to reach any of the 256 addresses.</p></details>
        </aside>
        <div className="cpu-workspace">
          <section className="cpu-panel cpu-execution" aria-labelledby="cpu-clock-heading"><div className="cpu-panel-heading"><div><span className="eyebrow">01 / FOLLOW THE CLOCK</span><h2 id="cpu-clock-heading">A little work, every tick.</h2></div><span className={`cpu-status ${state.fault ? 'fault' : ''}`} role="status">{doneLabel}</span></div>
            <div className="cpu-toolbar"><div className="cpu-transport"><button aria-label="Reset execution" title="Reset execution" onClick={() => restart()}><RotateCcw size={15} /></button><button aria-label="Previous cycle" title="Previous cycle" disabled={index === 0} onClick={() => { setPlaying(false); setIndex(index - 1); }}><ChevronLeft size={17} /></button><button className="cpu-primary" disabled={!ready || state.done || state.cycle >= 10000} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Run'}</button><button disabled={!ready || state.done} aria-label="Next cycle" title="Next cycle" onClick={() => { setPlaying(false); advance(); }}><StepForward size={17} /></button></div><label className="cpu-speed">Animation <select aria-label="Animation speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="1200">Slow</option><option value="500">Normal</option><option value="80">Fast</option></select></label></div>
            {dirty && <p className="cpu-notice">Assemble your changes to start this program.</p>}
            <div className="cpu-counters"><div><span>CLOCK CYCLES</span><strong data-testid="cpu-cycles">{state.cycle.toLocaleString()}</strong></div><div><span>RETIRED</span><strong data-testid="cpu-retired">{state.retired}</strong></div><div><span>CYCLES / INSTR.</span><strong data-testid="cpu-cpi">{state.retired ? (state.cycle / state.retired).toFixed(2) : '—'}</strong></div><div><span>INSTR. / CYCLE</span><strong>{state.cycle ? (state.retired / state.cycle).toFixed(2) : '—'}</strong></div></div>
            <div className="cpu-machine" aria-label="CPU and RAM datapath"><div className="cpu-machine-title"><Cpu size={15} /><span>PROCESSOR</span><span>PC <b data-testid="cpu-pc">{state.pc}</b><small>next instruction slot</small></span></div><div className="cpu-stages">{STAGES.map((stage, n) => {
              const t = state.pipe[stage], held = state.held.includes(stage);
              return <div key={stage} className={`cpu-stage ${t ? 'occupied' : ''} ${held ? 'waiting' : ''}`} style={{ '--stage': t ? color(t) : colors[n] } as React.CSSProperties}><div><b>{stage}</b><span>{held ? 'WAIT' : `0${n + 1}`}</span></div><small>{stageNames[n]}</small><p title={t?.instruction.text}>{t ? t.instruction.op : '—'}</p><span className="cpu-stage-detail">{t ? `#${t.id + 1} · slot ${t.instruction.pc}` : state.cycle ? 'bubble' : 'empty'}</span>{n < 4 && <ArrowRight className="cpu-stage-arrow" size={13} />}</div>;
            })}</div><div className="cpu-datapath"><span className={state.pipe.EX ? 'active' : ''}>ALU <b>{executeDetail(state.pipe.EX)}</b></span><span className={state.access || state.pipe.MEM?.remaining ? 'active' : ''}>↔ RAM <b>{state.access ? `[0x${hex(state.access.address)}] ${state.access.write ? '←' : '→'} ${state.access.value}` : state.pipe.MEM?.remaining ? `[0x${hex(state.pipe.MEM.address!)}] · ${state.pipe.MEM.remaining} left` : 'no transfer'}</b></span></div></div>
            <Datapath state={state} previous={before} config={config} playing={playing} />
            <div className={`cpu-explanation ${state.fault ? 'cpu-error' : ''}`} aria-live="polite" aria-atomic="true"><span className="eyebrow">CYCLE {state.cycle} / WHAT HAPPENED</span><ul>{state.events.map((event, n) => <li key={n}>{event}</li>)}</ul></div>
            {state.cycle >= 10000 && !state.done && <p className="cpu-notice">Automatic execution paused at 10,000 cycles. Check for an infinite loop, reset, or continue with Next cycle.</p>}
            <div className="cpu-penalties"><span><b data-testid="cpu-data-stalls">{state.dataStalls}</b> dependency stalls</span><span><b data-testid="cpu-ram-waits">{state.memoryStalls}</b> RAM wait cycles</span><span><b>{state.flushed}</b> flushed instructions</span></div>
            <div className="cpu-comparison"><Gauge size={17} /><p>{baselineReady ? <><strong>{state.cycle === baseline.cycle ? 'Running at the default pace.' : `${state.cycle - baseline.cycle} extra cycles with these settings.`}</strong><span>Same program and input: {baseline.cycle} cycles with forwarding and one-cycle RAM; this run took {state.cycle}.</span></> : <><strong>Same answer. How much waiting?</strong><span>{state.fault ? 'Resolve the fault to compare completed runs.' : !baseline.done ? 'The default run exceeds 10,000 cycles; comparison unavailable.' : 'Finish the program to compare with forwarding and one-cycle RAM.'}</span></>}</p></div>
          </section>
          <div className="cpu-data-panels">
            <section className="cpu-panel cpu-registers" aria-labelledby="cpu-register-heading"><div className="cpu-panel-heading"><div><span className="eyebrow">02 / INSIDE THE CPU</span><h2 id="cpu-register-heading">Eight little registers.</h2></div><span className="cpu-chip">8 × 8 BITS</span></div><p className="cpu-panel-intro">Fast, tiny workspaces. Orange bits changed this cycle; blue rows supply execute. Edit starting bytes in the last column.</p><div className="cpu-register-scroll"><table><thead><tr><th>REG</th><th>BYTE · BIT 7 → 0</th><th>HEX</th><th>DEC<small>unsigned / signed</small></th><th>INITIAL</th></tr></thead><tbody>{state.registers.map((value, r) => <tr key={r} className={state.changed.includes(r) ? 'cpu-register-changed' : state.pipe.EX && sources(state.pipe.EX.instruction).includes(r) ? 'cpu-register-read' : ''} data-testid={`cpu-register-${r}`}><th>r{r}{!r && <small>zero</small>}</th><td><Bits value={value} before={before.registers[r]} label={`r${r} bits`} /></td><td className="cpu-mono">{hex(value)}</td><td className="cpu-register-decimal">{value}<small>{signed(value)}</small></td><td><ByteInput label={`Initial r${r}`} value={initial.registers[r]} disabled={r === 0} onCommit={v => changeInitial({ ...initial, registers: initial.registers.map((old, n) => n === r ? v : old) })} /></td></tr>)}</tbody></table></div><p className="cpu-hint">r0 is wired to zero. A byte is 0–255 unsigned, or −128–127 in two’s complement.</p></section>
            <section className="cpu-panel cpu-memory" aria-labelledby="cpu-memory-heading"><div className="cpu-panel-heading"><div><span className="eyebrow">03 / OUTSIDE THE CPU</span><h2 id="cpu-memory-heading">An address. A byte.</h2></div><span className="cpu-chip">256 B RAM</span></div><p className="cpu-panel-intro">Each address names one byte. Select a cell to inspect its bits or change its starting value.</p><div className="cpu-memory-nav"><label>Address <select aria-label="Inspect RAM address" value={address} onChange={e => setAddress(Number(e.target.value))}>{Array.from({ length: 256 }, (_, n) => <option key={n} value={n}>0x{hex(n)} · {n}</option>)}</select></label><span><button aria-label="Previous RAM page" disabled={!memoryPage} onClick={() => setAddress((memoryPage - 1) * 64)}><ChevronLeft size={15} /></button>{memoryPage + 1} / 4<button aria-label="Next RAM page" disabled={memoryPage === 3} onClick={() => setAddress((memoryPage + 1) * 64)}><ChevronRight size={15} /></button></span></div><div className="cpu-memory-grid" role="group" aria-label={`RAM bytes ${memoryPage * 64} through ${memoryPage * 64 + 63}`}>{Array.from({ length: 64 }, (_, n) => {
              const a = memoryPage * 64 + n, access = state.access?.address === a;
              return <button key={a} aria-label={`RAM address 0x${hex(a)}, value ${state.memory[a]}`} aria-pressed={a === address} className={`${a === address ? 'selected' : ''} ${access ? state.access?.write ? 'written' : 'read' : ''}`} onClick={() => setAddress(a)}><small>{hex(a)}</small><b>{hex(state.memory[a])}</b></button>;
            })}</div><div className="cpu-memory-key"><span><i />selected</span><span><i />read</span><span><i />written</span><span>values in hex</span></div><div className="cpu-memory-inspector" data-testid="cpu-memory-inspector"><div><span className="eyebrow">BYTE AT 0x{hex(address)}</span><Bits value={state.memory[address]} before={before.memory[address]} label={`RAM 0x${hex(address)} bits`} /><p><strong>{state.memory[address]}</strong> unsigned · <strong>{signed(state.memory[address])}</strong> signed</p></div><label>Initial value<ByteInput key={address} label={`Initial RAM 0x${hex(address)}`} value={initial.memory[address]} onCommit={v => changeInitial({ ...initial, memory: initial.memory.map((old, n) => n === address ? v : old) })} /></label></div></section>
          </div>
          <section className="cpu-panel cpu-timing" aria-labelledby="cpu-timeline-heading"><div className="cpu-panel-heading"><div><span className="eyebrow">04 / SEE THE OVERLAP</span><h2 id="cpu-timeline-heading">One instruction, five stages.</h2></div><span className="cpu-chip">CYCLE BY CYCLE</span></div><p className="cpu-panel-intro">Each row follows one instruction. Dotted cells wait; × marks discarded work. Empty cells are bubbles. Showing up to 18 cycles ending at the inspected clock.</p><div className="cpu-history"><label htmlFor="cpu-history">Inspect clock {index}</label><input id="cpu-history" type="range" min="0" max={Math.max(1, history.length - 1)} value={index} disabled={history.length < 2} onChange={e => { setPlaying(false); setIndex(Number(e.target.value)); }} /><span>of {history.length - 1}</span></div><Timeline history={history} index={index} /></section>
        </div>
      </section>
      <section id="understand" className="cpu-understand"><span className="eyebrow">THE BIG IDEA / A PROCESSOR IS A TEAM</span><h2>More overlap.<br /><em>Less standing around.</em></h2><div className="cpu-idea-grid"><article><span>01 / REGISTERS & RAM</span><h3>Keep the work close.</h3><p>RAM holds bytes at numbered addresses. Registers hold the few bytes the CPU is working with right now. A load brings a byte in; a store sends it back.</p></article><article><span>02 / THE PIPELINE</span><h3>Share the rhythm.</h3><p>Fetch, decode, execute, memory, write-back. Different instructions can use different stages during the same clock cycle. The pipeline needs time to fill and drain.</p></article><article><span>03 / THE WAITING</span><h3>Sometimes, take a breath.</h3><p>A result may not be ready, RAM may be busy, or a branch may change the route. Forwarding passes a result along sooner. Stalls and flushes cost cycles.</p></article></div><div className="cpu-model-note"><BookOpen size={20} /><div><strong>About this little model.</strong><p>This is an 8-bit MIPS-inspired teaching architecture, with eight registers and separate program storage and data RAM. It does not execute MIPS machine code. Instructions have no binary encoding here; the PC counts instruction slots. Branches resolve in execute with no delay slot. RAM blocks the pipeline while busy. The model has no caches, operating system, or physical clock-frequency calculation. Animation speed only changes playback.</p><p>CPI is elapsed cycles ÷ retired instructions, including NOP and HALT. The RAM-wait counter counts extra memory cycles; a cycle blocked by RAM is not also counted as a dependency stall. Flushed instructions never retire.</p></div></div></section>
    </main><footer className="cpu-footer"><a href="/" className="cpu-brand"><Cpu size={17} />cpu<span className="muted">lab.</span></a><span>Small experiments. Big aha moments.</span><a href="/">Explore all simulators <ArrowRight size={13} /></a><Sparkles size={15} /></footer>
  </div>;
}
