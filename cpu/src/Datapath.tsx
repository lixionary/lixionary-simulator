import { useId, useState } from 'react';
import { BLOCKS, PATHS, traceDatapath, type BlockId, type PathKind } from './datapath-trace';
import { hex, type Config, type State } from './model';

const palette: Record<PathKind, string> = { data: '#688251', address: '#ad7c39', control: '#8b6caa', forward: '#368a9a' };
export default function Datapath({ state, previous, config, playing }: { state: State; previous: State; config: Config; playing: boolean }) {
  const [selected, setSelected] = useState<BlockId>('decoder');
  const uid = useId().replace(/:/g, ''), trace = traceDatapath(state, previous, config);
  const active = new Map(trace.map(t => [t.path, t]));
  const ex = state.pipe.EX, mem = state.pipe.MEM, wb = state.pipe.WB;
  const memoryBusy = !!mem?.remaining, exWaiting = state.held.includes('EX');
  const aluUsed = ex && ['LI', 'ADD', 'SUB', 'ADDI', 'LD', 'ST', 'BEQ'].includes(ex.instruction.op);
  const values: Record<BlockId, string> = {
    pc: `Next slot ${state.pc}`,
    program: state.pipe.IF?.instruction.text ?? (state.stopped ? 'Fetch stopped' : 'No fetch'),
    instruction: state.pipe.IF?.instruction.text ?? 'Latch clear / idle',
    decoder: state.pipe.ID?.instruction.text ?? 'No instruction in ID',
    registers: wb?.instruction.rd && wb.result !== undefined ? `r${wb.instruction.rd} ← ${wb.result}` : 'r0 = 0 · r1–r7 writable',
    immediate: state.pipe.ID?.instruction.imm !== undefined ? `ID literal: ${state.pipe.ID.instruction.imm}` : ex?.instruction.imm !== undefined ? `EX literal: ${ex.instruction.imm}` : 'No immediate selected',
    operands: aluUsed && ex?.operands ? `${ex.operands[0]} / ${ex.instruction.imm ?? ex.operands[1]}${exWaiting ? ' · held' : ''}` : 'No execute inputs',
    alu: aluUsed && ex ? ex.address !== undefined ? `Address ${ex.address}` : ex.result !== undefined ? `Result ${ex.result}` : ex.instruction.op === 'BEQ' ? ex.operands?.[0] === ex.operands?.[1] ? 'Equal' : 'Not equal' : ex.instruction.op : 'No execute work',
    nextpc: `Next slot ${state.pc}`,
    ram: state.fault ? 'Address fault' : mem?.address !== undefined ? `[0x${hex(mem.address)}] ${memoryBusy ? `wait ${mem.remaining}` : mem.instruction.op === 'ST' ? `← ${mem.store}` : `→ ${mem.result}`}` : 'No data access',
    writeback: wb?.instruction.rd && wb.result !== undefined ? `${wb.result} → r${wb.instruction.rd}` : wb ? `${wb.instruction.op}: no write` : 'No write-back',
    hazard: state.held.length ? memoryBusy || state.held.includes('MEM') ? 'RAM wait · upstream held' : 'Dependency · IF / ID held' : state.dependency ? 'Dependency detected for next tick' : 'No hold this cycle',
  };
  const blockTrace = trace.filter(t => PATHS[t.path].from === selected || PATHS[t.path].to === selected);
  return <section className={`cpu-block-diagram ${playing ? 'is-playing' : ''}`} aria-labelledby={`${uid}-heading`}>
    <div className="cpu-block-heading"><div><span className="eyebrow">INSIDE THE DATAPATH / CLOCK {state.cycle}</span><h3 id={`${uid}-heading`}>Where does this byte go?</h3></div><span>SELECT A BLOCK TO LOOK INSIDE</span></div>
    <p className="cpu-panel-intro">Follow the arrows between blocks. Bright paths show work this clock; dim paths show available connections. Different paths can carry different instructions.</p>
    <div className="cpu-block-legend">{(Object.keys(palette) as PathKind[]).map(kind => <span key={kind}><i style={{ background: palette[kind] }} />{kind === 'forward' ? 'forwarding' : kind}</span>)}<span>Scroll diagram ↔</span></div>
    <div className="cpu-block-scroll" tabIndex={0} role="region" aria-label="CPU block diagram, scroll horizontally">
      <svg viewBox="0 0 1210 590" className="cpu-block-svg" aria-labelledby={`${uid}-title ${uid}-desc`}>
        <title id={`${uid}-title`}>CPU datapath at clock {state.cycle}</title><desc id={`${uid}-desc`}>Program counter, instruction memory, instruction latch, instruction decoder, register file, immediate value, operand selector, ALU, next-PC selector, RAM, write-back, and hazard control. Select a block to read its role and current transfers.</desc>
        <defs>{(['idle', ...Object.keys(palette)] as const).map(kind => <marker key={kind} id={`${uid}-${kind}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill={kind === 'idle' ? '#cdd2c2' : palette[kind as PathKind]} /></marker>)}</defs>
        <rect className="cpu-block-cpu-boundary" x="14" y="52" width="1182" height="475" rx="12" />
        {(Object.entries(PATHS)).map(([id, path]) => {
          const transfer = active.get(id as keyof typeof PATHS), live = !!transfer;
          return <g key={id} className={`cpu-block-wire ${live ? 'live' : ''} kind-${path.kind}`} data-testid={`cpu-path-${id}`} data-active={live}>
            <title>{BLOCKS[path.from].title} → {BLOCKS[path.to].title}: {transfer?.detail ?? path.label}</title>
            <path d={path.d} stroke={live ? palette[path.kind] : '#d7dbce'} markerEnd={`url(#${uid}-${live ? path.kind : 'idle'})`} />
            {live && playing && <path className="cpu-flow-motion" d={path.d} stroke={palette[path.kind]} />}
            <text x={path.x} y={path.y} fill={live ? palette[path.kind] : '#969f8a'}>{path.label}</text>
          </g>;
        })}
        {(Object.entries(BLOCKS) as [BlockId, typeof BLOCKS[BlockId]][]).map(([id, block]) => {
          const live = trace.some(t => PATHS[t.path].from === id || PATHS[t.path].to === id);
          const waiting = (['pc', 'program', 'instruction', 'decoder'].includes(id) && state.held.includes('ID')) || (['operands', 'alu'].includes(id) && exWaiting) || (id === 'ram' && memoryBusy);
          return <g key={id} role="button" tabIndex={0} aria-label={`Inspect ${block.title}`} aria-pressed={selected === id} onClick={() => setSelected(id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(id); } }} className={`cpu-block-node ${selected === id ? 'selected' : ''} ${live ? 'live' : ''} ${waiting ? 'waiting' : ''}`} data-testid={`cpu-block-${id}`}>
            <title>{block.title}: {values[id]}{waiting ? ' · waiting' : ''}</title><rect x={block.x} y={block.y} width={block.width} height={block.height} rx="7" />
            <text x={block.x + 11} y={block.y + 23} className="cpu-block-name">{id === 'operands' ? <><tspan x={block.x + 11}>Operand</tspan><tspan x={block.x + 11} dy="15">selector</tspan></> : block.title}</text><text x={block.x + 11} y={block.y + (id === 'operands' ? 55 : 40)} className="cpu-block-subtitle">{block.subtitle}</text>
            <text x={block.x + 11} y={block.y + block.height - 14} className="cpu-block-value">{values[id].length > Math.floor((block.width - 22) / 6.5) ? `${values[id].slice(0, Math.floor((block.width - 22) / 6.5) - 1)}…` : values[id]}</text>
            {waiting && <circle cx={block.x + block.width - 10} cy={block.y + 10} r="3" className="cpu-block-wait-dot" />}
          </g>;
        })}
      </svg>
    </div>
    <div className="cpu-block-inspector" data-testid="cpu-block-inspector"><div><span className="eyebrow">INSIDE THIS BLOCK</span><h4>{BLOCKS[selected].title}</h4><p>{BLOCKS[selected].description}</p><strong>{values[selected]}</strong></div><div><span className="eyebrow">CONNECTED PATHS / THIS CLOCK</span>{blockTrace.length ? <ul>{blockTrace.map(t => <li key={t.path}><b>{BLOCKS[PATHS[t.path].from].title} → {BLOCKS[PATHS[t.path].to].title}</b><span>{t.detail}{t.instruction ? ` · #${t.instruction.id + 1} ${t.instruction.instruction.op}` : ''}</span></li>)}</ul> : <p>No transfer on this block’s paths this clock. Step the simulation to follow its work.</p>}</div></div>
    <details className="cpu-block-transfers"><summary>All transfers this clock <span>{trace.length} active paths</span></summary>{trace.length ? <ul data-testid="cpu-datapath-transfers">{trace.map(t => <li key={t.path}><i style={{ background: palette[PATHS[t.path].kind] }} /><div><b>{BLOCKS[PATHS[t.path].from].title} → {BLOCKS[PATHS[t.path].to].title}</b><span>{t.detail}{t.instruction ? ` · #${t.instruction.id + 1} ${t.instruction.instruction.text}` : ''}</span></div></li>)}</ul> : <p>No transfers yet. Advance the clock to fetch an instruction.</p>}</details>
    <p className="cpu-hint">Pipeline latches retain instructions, operands, and control between stages. Arrows that span stages represent those buffered paths; they do not mean an instruction completes in one clock. Held blocks keep their values without repeating a transfer.</p>
  </section>;
}
