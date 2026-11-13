import { hex, type Config, type State, type Token } from './model';

export const BLOCKS = {
  pc: { title: 'Program counter', subtitle: 'PC · instruction slot', x: 30, y: 70, width: 150, height: 90, description: 'Remembers the slot of the next instruction to fetch. Sequential execution advances by one slot; a taken branch replaces it with a target. During a stall, it holds its value.' },
  program: { title: 'Instruction memory', subtitle: 'The assembled program', x: 30, y: 250, width: 150, height: 95, description: 'Returns the instruction selected by the program counter. This teaching CPU keeps program storage separate from data RAM. The fetched instruction waits in a pipeline latch before decode.' },
  instruction: { title: 'Instruction latch', subtitle: 'IF/ID · pipeline latch', x: 30, y: 430, width: 150, height: 70, description: 'Keeps a fetched instruction until the next clock can pass it to decode. It holds its contents during a stall and clears wrong-path work on a branch or HALT. The other stage boundaries also use latches for operands, results, addresses, and control.' },
  decoder: { title: 'Instruction decoder', subtitle: 'Control unit · ID', x: 260, y: 70, width: 160, height: 90, description: 'Identifies the opcode, source and destination register numbers, and literal or branch target. It selects registers to read and produces control signals for later stages. Register data travels toward execute, rather than into the decoder.' },
  registers: { title: 'Register file', subtitle: '8 registers × 8 bits', x: 260, y: 250, width: 160, height: 95, description: 'Reads source registers selected by the decoder and receives results from write-back. Source bytes are carried through pipeline latches to execute. r0 always reads zero. A forwarded result can be newer than the byte currently stored here.' },
  immediate: { title: 'Immediate value', subtitle: 'Literal / signed offset', x: 260, y: 430, width: 160, height: 70, description: 'Carries a number written directly in the instruction. LI uses a literal byte; ADDI adds an immediate; LD and ST add a signed offset to a base register. This is extracted instruction data, not another bank of RAM.' },
  operands: { title: 'Operand selector', subtitle: 'Input MUX', x: 490, y: 250, width: 110, height: 95, description: 'A multiplexer (MUX) selects each execute input: a register byte, an immediate, or a newer forwarded result. Store data also uses this selection before being carried to RAM. Forwarding skips the wait for register write-back.' },
  alu: { title: 'ALU', subtitle: 'Math / compare', x: 640, y: 250, width: 110, height: 95, description: 'The arithmetic logic unit adds or subtracts byte values, calculates RAM addresses, and compares register bytes for BEQ. Arithmetic results wrap to eight bits; addresses are checked without wrapping. LI passes its literal through.' },
  nextpc: { title: 'Next-PC selector', subtitle: 'Next slot / target', x: 640, y: 70, width: 150, height: 90, description: 'Chooses the sequential instruction slot or the target of a taken BEQ or J. BEQ uses the ALU comparison; J uses its decoded target directly. A redirect discards younger instructions. There is no branch delay slot.' },
  ram: { title: 'Data RAM', subtitle: '256 addressable bytes', x: 810, y: 250, width: 150, height: 95, description: 'Uses an address calculated by the ALU. LD reads a byte toward write-back; ST writes the selected source byte. With longer latency, the address and data remain in the memory-stage latch while upstream stages wait. Each store writes once.' },
  writeback: { title: 'Write-back selector', subtitle: 'MUX · RAM or result', x: 1030, y: 250, width: 150, height: 95, description: 'Selects a load byte or an arithmetic/literal result, then writes the destination register in WB. Stores, branches, NOP, and HALT retire without a register write. Writing an unchanged byte still performs a write; writes to r0 are ignored.' },
  hazard: { title: 'Hazard / stall control', subtitle: 'Wait when an input is not ready', x: 490, y: 430, width: 260, height: 70, description: 'Checks dependencies between instructions in decode and older instructions. It can hold fetch and decode and insert an execute bubble. Busy RAM holds fetch, decode, and execute while older write-back work drains. Waiting paths do not transfer the same data again.' },
} as const;
export type BlockId = keyof typeof BLOCKS;
export type PathKind = 'data' | 'address' | 'control' | 'forward';
export const PATHS = {
  'pc-program': { from: 'pc', to: 'program', kind: 'address', d: 'M105 160 V250', label: 'instruction address', x: 114, y: 210 },
  'program-instruction': { from: 'program', to: 'instruction', kind: 'data', d: 'M105 345 V430', label: 'instruction', x: 114, y: 400 },
  'instruction-decoder': { from: 'instruction', to: 'decoder', kind: 'data', d: 'M180 465 H225 V115 H260', label: 'latched instruction', x: 28, y: 520 },
  'decoder-registers': { from: 'decoder', to: 'registers', kind: 'control', d: 'M340 160 V250', label: 'register numbers', x: 350, y: 215 },
  'decoder-immediate': { from: 'decoder', to: 'immediate', kind: 'data', d: 'M420 140 H445 V465 H420', label: 'literal', x: 393, y: 418 },
  'decoder-alu': { from: 'decoder', to: 'alu', kind: 'control', d: 'M420 100 H465 V195 H665 V250', label: 'latched operation', x: 475, y: 187 },
  'decoder-ram': { from: 'decoder', to: 'ram', kind: 'control', d: 'M420 85 H480 V175 H935 V250', label: 'read / write control', x: 800, y: 168 },
  'registers-operands': { from: 'registers', to: 'operands', kind: 'data', d: 'M420 280 H490', label: 'bytes', x: 450, y: 271 },
  'immediate-operands': { from: 'immediate', to: 'operands', kind: 'data', d: 'M420 460 H470 V320 H490', label: 'immediate', x: 480, y: 397 },
  'operands-alu': { from: 'operands', to: 'alu', kind: 'data', d: 'M600 295 H640', label: 'A / B', x: 608, y: 284 },
  'operands-ram': { from: 'operands', to: 'ram', kind: 'data', d: 'M550 345 V385 H860 V345', label: 'latched store byte', x: 650, y: 402 },
  'alu-ram': { from: 'alu', to: 'ram', kind: 'address', d: 'M750 275 H810', label: 'address', x: 758, y: 265 },
  'alu-writeback': { from: 'alu', to: 'writeback', kind: 'data', d: 'M750 315 H780 V365 H1080 V345', label: 'buffered ALU result', x: 864, y: 383 },
  'ram-writeback': { from: 'ram', to: 'writeback', kind: 'data', d: 'M960 295 H1030', label: 'load byte', x: 963, y: 283 },
  'writeback-registers': { from: 'writeback', to: 'registers', kind: 'data', d: 'M1130 345 V545 H240 V320 H260', label: 'destination register + result · MEM/WB latch → register file', x: 490, y: 565 },
  'alu-operands': { from: 'alu', to: 'operands', kind: 'forward', d: 'M750 305 H795 V220 H550 V250', label: 'MEM → EX forwarding', x: 505, y: 212 },
  'alu-nextpc': { from: 'alu', to: 'nextpc', kind: 'control', d: 'M715 250 V160', label: 'equal?', x: 723, y: 238 },
  'decoder-nextpc': { from: 'decoder', to: 'nextpc', kind: 'control', d: 'M420 120 H640', label: 'latched branch target', x: 485, y: 112 },
  'nextpc-pc': { from: 'nextpc', to: 'pc', kind: 'address', d: 'M715 70 V35 H105 V70', label: 'next PC', x: 355, y: 27 },
  'hazard-hold': { from: 'hazard', to: 'decoder', kind: 'control', d: 'M620 430 V410 H455 V180 H400 V160', label: 'hold / wait', x: 495, y: 423 },
} as const satisfies Record<string, { from: BlockId; to: BlockId; kind: PathKind; d: string; label: string; x: number; y: number }>;
export type PathId = keyof typeof PATHS;
export type Transfer = { path: PathId; detail: string; instruction?: Token };

/** Project recorded clock snapshots onto conceptual blocks; never re-execute the CPU. */
export function traceDatapath(state: State, previous: State, config: Config): Transfer[] {
  if (!state.cycle) return [];
  const transfers: Transfer[] = [];
  const add = (path: PathId, detail: string, instruction?: Token) => transfers.push({ path, detail, instruction });
  const { IF: fetch, ID: decode, EX: ex, MEM: mem, WB: wb } = state.pipe;
  // A just-fetched instruction can already have been squashed by a branch in EX.
  const fetched = fetch?.id === previous.nextId ? fetch : state.squashed.find(t => t.id === previous.nextId);
  if (fetched) {
    add('pc-program', `Slot ${fetched.instruction.pc}`, fetched);
    add('program-instruction', `${fetched.instruction.text} → IF/ID latch${state.squashed.includes(fetched) ? ' (flushed)' : ''}`, fetched);
  }
  if (decode && decode.id !== previous.pipe.ID?.id) {
    add('instruction-decoder', decode.instruction.text, decode);
    const i = decode.instruction, regs = [i.a, i.b].filter(r => r !== undefined);
    if (regs.length || i.rd !== undefined) add('decoder-registers', [...regs.map(r => `read r${r}`), ...(i.rd !== undefined ? [`destination r${i.rd}`] : [])].join(', '), decode);
    if (i.imm !== undefined) add('decoder-immediate', `Extract ${i.imm}`, decode);
  }
  if (ex && ex.id !== previous.pipe.EX?.id && !state.held.includes('EX')) {
    const i = ex.instruction, operands = ex.operands ?? [0, 0];
    const reads: string[] = [], forwarded: string[] = [];
    [i.a, i.b].forEach((r, n) => {
      if (r === undefined) return;
      const text = `r${r} = ${operands[n]}`;
      if (r && config.forwarding && mem?.instruction.rd === r && mem.result !== undefined) forwarded.push(text);
      else reads.push(text);
    });
    if (reads.length) add('registers-operands', reads.join(', '), ex);
    if (forwarded.length) add('alu-operands', `${forwarded.join(', ')} from the EX/MEM result latch`, ex);
    if (i.imm !== undefined) add('immediate-operands', `Literal / offset ${i.imm}`, ex);
    if (['LI', 'ADD', 'SUB', 'ADDI', 'LD', 'ST', 'BEQ'].includes(i.op)) {
      add('decoder-alu', `${i.op} control carried through ID/EX`, ex);
      add('operands-alu', i.op === 'LI' ? `Literal ${i.imm} → byte ${ex.result}` : `${operands[0]} ${i.op === 'SUB' ? '−' : i.op === 'BEQ' ? 'compare' : '+'} ${i.imm ?? operands[1]}${ex.address !== undefined ? ` → address ${ex.address}` : ex.result !== undefined ? ` → ${ex.result}` : ''}`, ex);
    }
    if (i.op === 'BEQ') add('alu-nextpc', `${operands[0]} ${operands[0] === operands[1] ? '=' : '≠'} ${operands[1]} · ${operands[0] === operands[1] ? 'taken' : 'not taken'}`, ex);
    if (i.op === 'J' || i.op === 'BEQ') add('decoder-nextpc', `Target slot ${i.target} from ID/EX`, ex);
    if (i.op === 'J' || (i.op === 'BEQ' && operands[0] === operands[1])) add('nextpc-pc', `Redirect to slot ${i.target}; discard younger work`, ex);
  }
  if (fetched && !transfers.some(t => t.path === 'nextpc-pc')) add('nextpc-pc', `Sequential next slot ${fetched.instruction.pc + 1}`, fetched);
  if (mem && mem.id !== previous.pipe.MEM?.id) {
    if (mem.address !== undefined) {
      add('alu-ram', `Latched address ${mem.address} (0x${hex(mem.address)})`, mem);
      add('decoder-ram', mem.instruction.op === 'ST' ? 'Store enable' : 'Load enable', mem);
    } else if (mem.result !== undefined && mem.instruction.rd) add('alu-writeback', `Buffered result ${mem.result} for r${mem.instruction.rd}`, mem);
  }
  if (state.fault && !previous.fault && previous.pipe.EX?.address !== undefined) {
    const faulting = previous.pipe.EX;
    add('alu-ram', `Address ${faulting.address} is outside RAM (0–255)`, faulting);
    add('decoder-ram', `${faulting.instruction.op} request rejected; no memory transfer`, faulting);
  }
  if (state.access && mem) {
    if (state.access.write) add('operands-ram', `Latched store byte ${state.access.value} → RAM[0x${hex(state.access.address)}]`, mem);
    else add('ram-writeback', `RAM[0x${hex(state.access.address)}] = ${state.access.value} → MEM/WB latch`, mem);
  }
  if (wb?.instruction.rd && wb.result !== undefined) add('writeback-registers', `r${wb.instruction.rd} ← ${wb.result} (0x${hex(wb.result)})`, wb);
  if (state.held.length) add('hazard-hold', state.held.includes('MEM') ? 'RAM busy: hold IF, ID, EX, and MEM' : 'Dependency: hold IF and ID; insert an EX bubble');
  return transfers;
}
