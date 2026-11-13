export const OPS = ['LI', 'ADD', 'SUB', 'ADDI', 'LD', 'ST', 'BEQ', 'J', 'NOP', 'HALT'] as const;
export type Op = typeof OPS[number];
export type Instruction = { op: Op; pc: number; line: number; text: string; rd?: number; a?: number; b?: number; imm?: number; target?: number };
export type Program = Instruction[];
export const byte = (n: number) => ((n % 256) + 256) % 256;
export const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
export const signed = (n: number) => n > 127 ? n - 256 : n;
export function literal(text: string, min = -128, max = 255): number {
  text = text.trim();
  if (!/^-?(?:0x[\da-f]+|\d+)$/i.test(text.trim())) throw new Error(`Invalid number “${text}”. Use decimal or hexadecimal.`);
  const value = text.startsWith('-') ? -Number(text.slice(1)) : Number(text);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Value must be ${min} to ${max}.`);
  return value;
}
export function assemble(source: string): Program {
  const labels = new Map<string, number>();
  const lines: { text: string; line: number }[] = [];
  source.split('\n').forEach((raw, i) => {
    let text = raw.split(/#|;/)[0].trim();
    while (/^[a-z_]\w*:/i.test(text)) {
      const match = text.match(/^([a-z_]\w*):\s*/i)!;
      if (labels.has(match[1])) throw new Error(`Line ${i + 1}: Duplicate label ${match[1]}.`);
      labels.set(match[1], lines.length); text = text.slice(match[0].length);
    }
    if (text) lines.push({ text, line: i + 1 });
  });
  if (!lines.length) throw new Error('Enter at least one instruction.');
  if (lines.length > 256) throw new Error('Programs may contain at most 256 instructions.');
  return lines.map(({ text, line }, pc) => {
    try {
      const match = text.match(/^(\w+)(?:\s+(.*))?$/);
      if (!match || !OPS.includes(match[1].toUpperCase() as Op)) throw new Error('Unknown instruction.');
      const op = match[1].toUpperCase() as Op;
      const args = match[2] ? match[2].split(',').map(s => s.trim()) : [];
      const count = ['NOP', 'HALT'].includes(op) ? 0 : op === 'J' ? 1 : ['LI', 'LD', 'ST'].includes(op) ? 2 : 3;
      if (args.length !== count || args.some(s => !s)) throw new Error(`${op} expects ${count} operands, separated by commas.`);
      const reg = (s: string) => { if (!/^r[0-7]$/i.test(s)) throw new Error(`Invalid register ${s}; use r0–r7.`); return Number(s[1]); };
      const target = (s: string) => { if (!labels.has(s)) throw new Error(`Unknown label ${s}.`); const t = labels.get(s)!; if (t >= lines.length) throw new Error(`Label ${s} must point to an instruction.`); return t; };
      const base: Instruction = { op, pc, line, text };
      if (op === 'LI') return { ...base, rd: reg(args[0]), imm: literal(args[1]) };
      if (['ADD', 'SUB'].includes(op)) return { ...base, rd: reg(args[0]), a: reg(args[1]), b: reg(args[2]) };
      if (op === 'ADDI') return { ...base, rd: reg(args[0]), a: reg(args[1]), imm: literal(args[2], -128, 127) };
      if (op === 'LD' || op === 'ST') {
        const m = args[1].match(/^(-?(?:0x[\da-f]+|\d+))\s*\(\s*(r[0-7])\s*\)$/i);
        if (!m) throw new Error('Use offset(base), for example 4(r0).');
        return { ...base, ...(op === 'LD' ? { rd: reg(args[0]) } : { b: reg(args[0]) }), a: reg(m[2]), imm: literal(m[1], -128, 127) };
      }
      if (op === 'BEQ') return { ...base, a: reg(args[0]), b: reg(args[1]), target: target(args[2]) };
      if (op === 'J') return { ...base, target: target(args[0]) };
      return base;
    } catch (e) { throw new Error(`Line ${line}: ${(e as Error).message}`); }
  });
}
export type Config = { forwarding: boolean; ramLatency: number };
export type Initial = { registers: number[]; memory: number[] };
export type Token = { id: number; instruction: Instruction; result?: number; address?: number; store?: number; operands?: number[]; remaining?: number };
export type Stage = 'IF' | 'ID' | 'EX' | 'MEM' | 'WB';
export const STAGES: Stage[] = ['IF', 'ID', 'EX', 'MEM', 'WB'];
export type Pipeline = Record<Stage, Token | null>;
export type State = Initial & {
  cycle: number; pc: number; nextId: number; pipe: Pipeline; retired: number; dataStalls: number; memoryStalls: number; flushed: number;
  stopped: boolean; done: boolean; fault?: string; dependency?: string; events: string[]; held: Stage[]; squashed: Token[];
  access?: { address: number; value: number; write: boolean }; changed: number[];
};
export function initialState(initial: Initial): State {
  if (initial.registers.length !== 8 || initial.memory.length !== 256 || [...initial.registers, ...initial.memory].some(n => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error('Initial state requires 8 byte registers and 256 RAM bytes.');
  return { registers: initial.registers.map((v, i) => i ? v : 0), memory: [...initial.memory], cycle: 0, pc: 0, nextId: 0,
    pipe: { IF: null, ID: null, EX: null, MEM: null, WB: null }, retired: 0, dataStalls: 0, memoryStalls: 0, flushed: 0,
    stopped: false, done: false, events: ['Ready. The next clock fetches the first instruction.'], held: [], squashed: [], changed: [] };
}
export function sources(i: Instruction): number[] { return [i.a, i.b].filter((r): r is number => r !== undefined && r !== 0); }
function dependency(pipe: Pipeline, config: Config): string | undefined {
  if (!pipe.ID) return;
  for (const stage of ['EX', 'MEM'] as const) {
    const producer = pipe[stage];
    const rd = producer?.instruction.rd;
    if (!producer || !rd || !sources(pipe.ID.instruction).includes(rd)) continue;
    if (!config.forwarding || (stage === 'EX' && producer.instruction.op === 'LD'))
      return `${pipe.ID.instruction.op} needs r${rd} from ${producer.instruction.op} in ${stage}. ${config.forwarding ? 'The load must return its byte before execute.' : 'Forwarding is off; wait for write-back.'}`;
  }
}
export function stepCycle(previous: State, program: Program, config: Config): State {
  if (!Number.isInteger(config.ramLatency) || config.ramLatency < 1 || config.ramLatency > 5) throw new Error('RAM latency must be 1–5 cycles.');
  if (previous.done) return previous;
  const s: State = { ...previous, cycle: previous.cycle + 1, pipe: { ...previous.pipe }, events: [], held: [], squashed: [], changed: [], access: undefined, dependency: undefined };
  const old = previous.pipe;
  const memoryBlocked = !!old.MEM && (old.MEM.remaining ?? 0) > 0;
  s.pipe.WB = memoryBlocked ? null : old.MEM;
  // WB writes before this cycle's decode read. Completed WB tokens leave next cycle.
  if (s.pipe.WB) {
    s.retired++;
    const { instruction: i, result } = s.pipe.WB;
    if (i.rd && result !== undefined) {
      s.registers = [...s.registers]; s.registers[i.rd] = byte(result);
      if (s.registers[i.rd] !== previous.registers[i.rd]) s.changed.push(i.rd);
      s.events.push(`Write-back: r${i.rd} ← ${s.registers[i.rd]} (0x${hex(s.registers[i.rd])}).`);
    } else s.events.push(`Retired ${i.op}.`);
  }
  let freshEX = false;
  if (memoryBlocked) {
    s.pipe.MEM = { ...old.MEM! }; s.memoryStalls++; s.held = ['IF', 'ID', 'EX', 'MEM'];
    s.events.push(`RAM wait: ${old.MEM!.instruction.op} holds MEM; fetch, decode, and execute wait.`);
  } else {
    s.pipe.MEM = old.EX ? { ...old.EX, remaining: ['LD', 'ST'].includes(old.EX.instruction.op) ? config.ramLatency : 0 } : null;
    if (previous.dependency) {
      s.pipe.EX = null; s.dataStalls++; s.held = ['IF', 'ID'];
      s.events.push(`Dependency stall: ${previous.dependency}`);
    } else {
      s.pipe.EX = old.ID; s.pipe.ID = old.IF; s.pipe.IF = null; freshEX = !!old.ID;
      if (!s.stopped && s.pc < program.length) {
        s.pipe.IF = { id: s.nextId++, instruction: program[s.pc++] };
        s.events.push(`Fetch instruction ${s.pipe.IF.instruction.pc}: ${s.pipe.IF.instruction.text}.`);
      }
    }
  }
  const mem = s.pipe.MEM;
  if (mem && ['LD', 'ST'].includes(mem.instruction.op)) {
    if (mem.address === undefined || mem.address < 0 || mem.address > 255) {
      s.fault = `Line ${mem.instruction.line}: ${mem.instruction.op} address ${mem.address} is outside RAM (0–255).`;
      s.stopped = true; s.squashed = [s.pipe.IF, s.pipe.ID, s.pipe.EX].filter((t): t is Token => !!t);
      s.flushed += s.squashed.length;
      s.pipe.IF = s.pipe.ID = s.pipe.EX = s.pipe.MEM = null;
      s.events.push(s.fault); freshEX = false;
    } else {
      const remaining = (mem.remaining ?? 1) - 1;
      s.pipe.MEM = { ...mem, remaining };
      if (remaining === 0) {
        const address = mem.address;
        if (mem.instruction.op === 'LD') s.pipe.MEM.result = s.memory[address];
        else { s.memory = [...s.memory]; s.memory[address] = mem.store!; }
        s.access = { address, value: s.memory[address], write: mem.instruction.op === 'ST' };
        s.events.push(`RAM ${s.access.write ? 'write' : 'read'}: [0x${hex(address)}] ${s.access.write ? '←' : '→'} ${s.memory[address]}.`);
      } else s.events.push(`RAM [0x${hex(mem.address)}]: ${remaining} more ${remaining === 1 ? 'cycle' : 'cycles'} needed.`);
    }
  }
  if (freshEX && s.pipe.EX) {
    const token = s.pipe.EX, i = token.instruction;
    const read = (r: number | undefined) => {
      if (!r) return 0;
      const forward = s.pipe.MEM;
      if (config.forwarding && forward?.instruction.rd === r && forward.result !== undefined) {
        s.events.push(`Forward r${r} = ${forward.result} from MEM to EX.`); return forward.result;
      }
      return s.registers[r];
    };
    const a = read(i.a), b = read(i.b);
    const ex: Token = { ...token, operands: [a, b] };
    if (i.op === 'LI') ex.result = byte(i.imm!);
    if (i.op === 'ADD') ex.result = byte(a + b);
    if (i.op === 'SUB') ex.result = byte(a - b);
    if (i.op === 'ADDI') ex.result = byte(a + i.imm!);
    if (i.op === 'LD' || i.op === 'ST') { ex.address = a + i.imm!; ex.store = b; }
    s.pipe.EX = ex;
    if (ex.result !== undefined) s.events.push(`Execute ${i.op}: result ${ex.result} (0x${hex(ex.result)}).`);
    const taken = i.op === 'J' || (i.op === 'BEQ' && a === b);
    if (i.op === 'BEQ') s.events.push(`Compare ${a} and ${b}: branch ${taken ? 'taken' : 'not taken'}.`);
    if (taken || i.op === 'HALT') {
      s.squashed = [s.pipe.IF, s.pipe.ID].filter((t): t is Token => !!t);
      s.flushed += s.squashed.length;
      s.pipe.IF = s.pipe.ID = null;
      if (taken) { s.pc = i.target!; s.events.push(`Redirect to instruction ${s.pc}; flush ${s.squashed.length} younger instructions.`); }
      else { s.stopped = true; s.events.push('HALT: stop fetching and drain the pipeline.'); }
    }
  }
  s.dependency = dependency(s.pipe, config);
  s.done = (s.stopped || s.pc >= program.length) && !s.pipe.IF && !s.pipe.ID && !s.pipe.EX && !s.pipe.MEM;
  if (s.done) s.events.push(s.fault ? 'Execution stopped after the fault.' : 'Complete. The pipeline is drained.');
  if (!s.events.length) s.events.push('Advance the pipeline.');
  return s;
}
export function run(program: Program, initial: Initial, config: Config, limit = 10000): State {
  let state = initialState(initial);
  while (!state.done && state.cycle < limit) state = stepCycle(state, program, config);
  return state;
}
export const DEFAULT_CONFIG: Config = { forwarding: true, ramLatency: 1 };
export const PRESETS = [
  { id: 'memory', name: 'A byte takes a journey', hint: 'Load a byte, add five, and store the result. Watch the load-use stall.', source: '# RAM[16] starts at 7\nLD r1, 16(r0)\nADDI r2, r1, 5\nST r2, 17(r0)\nHALT', memory: { 16: 7 } },
  { id: 'independent', name: 'Keep the pipeline busy', hint: 'Independent instructions overlap without waiting for one another.', source: 'LI r1, 10\nLI r2, 20\nLI r3, 30\nLI r4, 40\nHALT', memory: {} },
  { id: 'dependent', name: 'One result needs another', hint: 'Switch forwarding off. The answers stay the same, but the clock count grows.', source: 'LI r1, 8\nADD r2, r1, r1\nSUB r3, r2, r1\nADDI r4, r3, -1\nHALT', memory: {} },
  { id: 'store', name: 'Write your own RAM', hint: '255 + 1 wraps to zero. Inspect both stored bytes and their bits.', source: 'LI r1, 255\nST r1, 32(r0)\nADDI r2, r1, 1\nST r2, 33(r0)\nHALT', memory: {} },
  { id: 'loop', name: 'A loop changes direction', hint: 'Count down from three. Taken branches discard younger instructions.', source: 'LI r1, 3\nloop: ADDI r2, r2, 1\nADDI r1, r1, -1\nBEQ r1, r0, done\nJ loop\ndone: ST r2, 16(r0)\nHALT', memory: {} },
] satisfies { id: string; name: string; hint: string; source: string; memory: Record<number, number> }[];
export function presetInitial(index: number): Initial {
  const memory = Array<number>(256).fill(0);
  Object.entries(PRESETS[index].memory).forEach(([address, value]) => { memory[Number(address)] = value; });
  return { registers: Array<number>(8).fill(0), memory };
}
