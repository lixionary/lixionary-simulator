import { describe, expect, it } from 'vitest';
import { assemble, byte, DEFAULT_CONFIG, initialState, literal, PRESETS, presetInitial, run, stepCycle, type Config, type Initial, type Program } from './model';
const empty = (): Initial => ({ registers: Array(8).fill(0), memory: Array(256).fill(0) });
// Deliberately sequential oracle: no pipeline state, forwarding, or stalls.
function sequential(program: Program, initial: Initial) {
  const registers = [...initial.registers], memory = [...initial.memory]; registers[0] = 0;
  let pc = 0, retired = 0;
  while (pc < program.length && retired < 1000) {
    const i = program[pc++], a = registers[i.a ?? 0], b = registers[i.b ?? 0];
    let result: number | undefined;
    if (i.op === 'LI') result = i.imm!;
    if (i.op === 'ADD') result = a + b;
    if (i.op === 'SUB') result = a - b;
    if (i.op === 'ADDI') result = a + i.imm!;
    if (i.op === 'LD') result = memory[a + i.imm!];
    if (i.op === 'ST') memory[a + i.imm!] = b;
    if (i.rd && result !== undefined) registers[i.rd] = byte(result);
    retired++;
    if (i.op === 'J' || (i.op === 'BEQ' && a === b)) pc = i.target!;
    if (i.op === 'HALT') break;
  }
  return { registers, memory, retired };
}
describe('assembler and byte semantics', () => {
  it('supports labels, comments, mixed case and signed hex', () => {
    const p = assemble('start: li R1, -0x01 # byte\nADDI r2, r1, -1\nBEQ r1, r2, start\nHALT');
    expect(p[0]).toMatchObject({ op: 'LI', imm: -1, line: 1, pc: 0 });
    expect(p[2].target).toBe(0);
    expect(literal('0xff')).toBe(255);
  });
  it.each(['BOGUS', 'LI r8, 1', 'LI r1, 256', 'ADDI r1, r0, 128', 'LD r1, 256(r0)', 'J missing', 'x: NOP\nx: HALT', 'LI r1 5', 'LI r1,', 'NOP 1', 'J end\nend:', ''])('rejects invalid source: %s', source => expect(() => assemble(source)).toThrow());
  it('rejects oversized programs', () => expect(() => assemble(Array(257).fill('NOP').join('\n'))).toThrow('256'));
  it('wraps bytes and fixes r0', () => {
    const initial = empty(); initial.registers[0] = 99;
    const s = run(assemble('LI r0, 42\nLI r1, 255\nADDI r2, r1, 1\nSUB r3, r0, r2\nADDI r4, r3, -1\nHALT'), initial, DEFAULT_CONFIG);
    expect(s.registers).toEqual([0, 255, 0, 0, 255, 0, 0, 0]);
  });
});
describe('pipeline timing', () => {
  it('takes N+4 cycles for independent instructions, including HALT and NOP', () => {
    const s = run(assemble('LI r1, 1\nLI r2, 2\nNOP\nHALT'), empty(), DEFAULT_CONFIG);
    expect(s.cycle).toBe(8); expect(s.retired).toBe(4); expect(s.dataStalls).toBe(0);
  });
  it('forwards arithmetic results and waits two cycles without forwarding', () => {
    const p = assemble('LI r1, 5\nADD r2, r1, r1\nHALT');
    const fast = run(p, empty(), DEFAULT_CONFIG), slow = run(p, empty(), { ...DEFAULT_CONFIG, forwarding: false });
    expect(fast.cycle).toBe(7); expect(slow.cycle).toBe(9); expect(slow.dataStalls).toBe(2);
    expect(fast.registers[2]).toBe(10); expect(slow.registers).toEqual(fast.registers);
  });
  it('inserts one load-use stall', () => {
    const initial = empty(); initial.memory[0] = 9;
    const s = run(assemble('LD r1, 0(r0)\nADD r2, r1, r1\nHALT'), initial, DEFAULT_CONFIG);
    expect(s.cycle).toBe(8); expect(s.dataStalls).toBe(1); expect(s.registers[2]).toBe(18);
  });
  it('supports all RAM addresses through a base register', () => {
    const p = assemble('LI r1, 255\nLI r2, 7\nST r2, 0(r1)\nLD r3, 0(r1)\nHALT');
    const fast = run(p, empty(), DEFAULT_CONFIG), slow = run(p, empty(), { forwarding: true, ramLatency: 4 });
    expect(slow.cycle - fast.cycle).toBe(6); expect(slow.memoryStalls).toBe(6);
    expect(slow.memory[255]).toBe(7); expect(slow.registers[3]).toBe(7);
    let state = initialState(empty()), stores = 0;
    while (!state.done) { state = stepCycle(state, p, { forwarding: true, ramLatency: 4 }); if (state.access?.write) stores++; }
    expect(stores).toBe(1);
  });
  it('flushes wrong-path stores, including after HALT', () => {
    const p = assemble('LI r1, 77\nBEQ r1, r1, end\nST r1, 0(r0)\nST r1, 1(r0)\nend: HALT\nST r1, 2(r0)');
    const s = run(p, empty(), DEFAULT_CONFIG);
    expect(s.memory.slice(0, 3)).toEqual([0, 0, 0]); expect(s.retired).toBe(3); expect(s.flushed).toBe(3); expect(s.cycle).toBe(9);
  });
  it('falls through and drains without HALT', () => {
    const s = run(assemble('LI r1, 42'), empty(), DEFAULT_CONFIG);
    expect(s.done).toBe(true); expect(s.cycle).toBe(5); expect(s.registers[1]).toBe(42);
  });
  it('faults precisely and does not commit younger work', () => {
    const p = assemble('LI r1, 255\nLD r2, 1(r1)\nLI r3, 7\nST r3, 0(r0)');
    const s = run(p, empty(), DEFAULT_CONFIG);
    expect(s.fault).toContain('address 256'); expect(s.done).toBe(true);
    expect(s.registers[1]).toBe(255); expect(s.registers[3]).toBe(0); expect(s.retired).toBe(1); expect(s.memory[0]).toBe(0);
    expect(run(assemble('LD r1, -1(r0)'), empty(), DEFAULT_CONFIG).fault).toContain('address -1');
  });
  it('keeps snapshots immutable', () => {
    const p = assemble('LI r1, 9\nST r1, 0(r0)');
    const first = initialState(empty()); let s = first;
    for (let n = 0; n < 10; n++) s = stepCycle(s, p, DEFAULT_CONFIG);
    expect(first.registers[1]).toBe(0); expect(first.memory[0]).toBe(0); expect(s.memory[0]).toBe(9);
  });
  it('bounds an infinite loop', () => {
    const s = run(assemble('loop: J loop'), empty(), DEFAULT_CONFIG, 100);
    expect(s.cycle).toBe(100); expect(s.done).toBe(false);
  });
});
describe('sequential equivalence', () => {
  for (const forwarding of [true, false]) for (const ramLatency of [1, 2, 5]) {
    const config: Config = { forwarding, ramLatency };
    it(`matches all presets: forwarding=${forwarding}, RAM=${ramLatency}`, () => {
      PRESETS.forEach((preset, index) => {
        const p = assemble(preset.source), initial = presetInitial(index);
        const expected = sequential(p, initial), actual = run(p, initial, config);
        expect(actual.done).toBe(true); expect(actual.fault).toBeUndefined();
        expect(actual.registers).toEqual(expected.registers); expect(actual.memory).toEqual(expected.memory); expect(actual.retired).toBe(expected.retired);
      });
    });
  }
  it('matches deterministic mixed dependencies across many programs', () => {
    let seed = 42;
    const rand = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    for (let trial = 0; trial < 40; trial++) {
      const lines = Array.from({ length: 30 }, () => {
        const rd = rand(7) + 1, a = rand(8), b = rand(8);
        return [`ADD r${rd}, r${a}, r${b}`, `SUB r${rd}, r${a}, r${b}`, `ADDI r${rd}, r${a}, ${rand(127)}`, `LI r${rd}, ${rand(256)}`, `LD r${rd}, ${rand(100)}(r0)`, `ST r${a}, ${rand(100)}(r0)`][rand(6)];
      });
      const p = assemble([...lines, 'HALT'].join('\n')), initial = empty(); initial.memory = initial.memory.map(() => rand(256));
      const expected = sequential(p, initial), actual = run(p, initial, { forwarding: !!(trial % 2), ramLatency: trial % 5 + 1 });
      expect(actual.registers).toEqual(expected.registers); expect(actual.memory).toEqual(expected.memory);
    }
  });
});
