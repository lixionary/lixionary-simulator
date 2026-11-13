import { describe, expect, it } from 'vitest';
import { traceDatapath } from './datapath-trace';
import { assemble, DEFAULT_CONFIG, initialState, presetInitial, stepCycle, type Config, type State } from './model';
function snapshots(source: string, config: Config = DEFAULT_CONFIG, max = 100) {
  const program = assemble(source), history: State[] = [initialState(presetInitial(0))];
  while (!history.at(-1)!.done && history.length <= max) history.push(stepCycle(history.at(-1)!, program, config));
  return history;
}
function trace(history: State[], cycle: number, config = DEFAULT_CONFIG) { return traceDatapath(history[cycle], history[Math.max(0, cycle - 1)], config); }
describe('clock-linked datapath', () => {
  it('shows instruction fetching, decode register selection, and byte paths at their own clocks', () => {
    const h = snapshots('LD r1, 16(r0)\nADDI r2, r1, 5\nST r2, 17(r0)\nHALT');
    expect(trace(h, 0)).toEqual([]);
    expect(trace(h, 1).find(t => t.path === 'pc-program')?.detail).toBe('Slot 0');
    expect(trace(h, 2).find(t => t.path === 'instruction-decoder')?.detail).toBe('LD r1, 16(r0)');
    expect(trace(h, 2).find(t => t.path === 'decoder-registers')?.detail).toBe('read r0, destination r1');
    expect(trace(h, 4).find(t => t.path === 'ram-writeback')?.detail).toContain('RAM[0x10] = 7');
    expect(trace(h, 4).some(t => t.path === 'writeback-registers')).toBe(false);
    expect(trace(h, 5).find(t => t.path === 'writeback-registers')?.detail).toBe('r1 ← 7 (0x07)');
    expect(trace(h, 7).find(t => t.path === 'operands-ram')?.detail).toBe('Latched store byte 12 → RAM[0x11]');
  });
  it('distinguishes forwarded operands from stale register bytes', () => {
    const h = snapshots('LI r1, 5\nADD r2, r1, r1\nHALT');
    expect(h[4].registers[1]).toBe(0);
    const transfers = trace(h, 4);
    expect(transfers.find(t => t.path === 'alu-operands')?.detail).toContain('r1 = 5');
    expect(transfers.some(t => t.path === 'registers-operands')).toBe(false);
    expect(transfers.find(t => t.path === 'operands-alu')?.detail).toBe('5 + 5 → 10');
  });
  it('with forwarding off, waits for write-back before using the register file', () => {
    const config = { forwarding: false, ramLatency: 1 }, h = snapshots('LI r1, 5\nADD r2, r1, r1\nHALT', config);
    expect(h.flatMap((_, n) => trace(h, n, config)).some(t => t.path === 'alu-operands')).toBe(false);
    expect(trace(h, 4, config).some(t => t.path === 'hazard-hold')).toBe(true);
    expect(trace(h, 6, config).find(t => t.path === 'registers-operands')?.detail).toContain('r1 = 5');
  });
  it('does not repeat transfers while RAM holds execute and fetch', () => {
    const config = { forwarding: true, ramLatency: 3 }, h = snapshots('LD r1, 16(r0)\nADDI r2, r1, 5\nST r2, 17(r0)\nHALT', config);
    expect(trace(h, 5, config).map(t => t.path)).toEqual(['hazard-hold']);
    expect(trace(h, 6, config).filter(t => t.path === 'ram-writeback')).toHaveLength(1);
    expect(h.flatMap((_, n) => trace(h, n, config)).filter(t => t.path === 'operands-ram')).toHaveLength(1);
  });
  it('shows branch comparison, redirect and the flushed fetch without a wrong-path store', () => {
    const h = snapshots('BEQ r0, r0, end\nST r0, 0(r0)\nNOP\nend: HALT');
    expect(trace(h, 3).find(t => t.path === 'alu-nextpc')?.detail).toContain('taken');
    expect(trace(h, 3).find(t => t.path === 'nextpc-pc')?.detail).toContain('Redirect to slot 3');
    expect(trace(h, 3).find(t => t.path === 'program-instruction')?.detail).toContain('(flushed)');
    expect(h.flatMap((_, n) => trace(h, n)).some(t => t.path === 'operands-ram')).toBe(false);
  });
  it('keeps the sequential PC on an untaken branch', () => {
    const h = snapshots('LI r1, 1\nBEQ r0, r1, end\nNOP\nend: HALT');
    expect(trace(h, 4).find(t => t.path === 'alu-nextpc')?.detail).toContain('not taken');
    expect(trace(h, 4).some(t => t.detail.startsWith('Redirect'))).toBe(false);
  });
  it('shows writes of unchanged bytes and ignores writes to r0', () => {
    const h = snapshots('LI r1, 0\nLI r0, 99\nHALT');
    expect(h[5].changed).toEqual([]);
    expect(trace(h, 5).some(t => t.path === 'writeback-registers')).toBe(true);
    expect(trace(h, 6).some(t => t.path === 'writeback-registers')).toBe(false);
  });
  it('shows no younger execute or RAM write on a fault', () => {
    const h = snapshots('LD r1, -1(r0)\nST r0, 0(r0)\nHALT');
    const end = h.length - 1;
    expect(h[end].fault).toContain('outside RAM');
    expect(trace(h, end).find(t => t.path === 'alu-ram')?.detail).toContain('Address -1');
    expect(trace(h, end).some(t => ['operands-alu', 'operands-ram', 'ram-writeback'].includes(t.path))).toBe(false);
  });
});
