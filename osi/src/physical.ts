import { concat, type Phy } from './model';
export const CODES = ['11110', '01001', '10100', '10101', '01010', '01011', '01110', '01111', '10010', '10011', '10110', '10111', '11010', '11011', '11100', '11101'];
export const JK = '1100010001', TR = '0110100111';
export const wireBits = (bytes: Uint8Array) => Array.from(bytes).flatMap(byte => Array.from({ length: 8 }, (_, bit) => byte >>> bit & 1));
/** Known-state teaching scrambler. PN recurrence s[n]=s[n-11] XOR s[n-9]. */
export function scramble(bits: number[]) {
  const state = Array<number>(11).fill(1);
  return bits.map(bit => { const pn = state[0] ^ state[2]; state.shift(); state.push(pn); return bit ^ pn; });
}
export function manchester(bits: number[]) { return bits.flatMap(bit => bit ? [-1, 1] : [1, -1]); }
export function decodeManchester(levels: number[]) {
  if (levels.length % 2) throw new Error('Incomplete Manchester bit');
  const bits: number[] = [];
  for (let i = 0; i < levels.length; i += 2) {
    if (levels[i] === levels[i + 1] || Math.abs(levels[i]) !== 1 || Math.abs(levels[i + 1]) !== 1) throw new Error('Invalid Manchester transition');
    bits.push(levels[i] === -1 ? 1 : 0);
  }
  return bits;
}
export function mlt3(bits: number[]) {
  const cycle = [0, 1, 0, -1]; let phase = 0;
  return bits.map(bit => { if (bit) phase = (phase + 1) % 4; return cycle[phase]; });
}
export function decodeMlt3(levels: number[]) {
  let last = 0;
  return levels.map(level => { const bit = level === last ? 0 : 1; last = level; return bit; });
}
export type Trace = { levels: number[]; coded: number[]; scrambled: number[]; owners: number[]; tickNs: number; wire: Uint8Array; phy: Phy };
export function encodePhysical(frame: Uint8Array, phy: Phy): Trace {
  const wire = concat([85, 85, 85, 85, 85, 85, 85, 213], frame);
  if (phy === '10base-t') {
    const coded = wireBits(wire);
    return { levels: manchester(coded), coded, scrambled: coded, owners: Array.from(wire).flatMap((_, i) => Array(16).fill(i - 8)), tickNs: 50, wire, phy };
  }
  // Idle context, J/K replaces first preamble octet, remaining octets low nibble first, T/R, idle.
  const groups: { code: string; owner: number }[] = Array.from({ length: 16 }, () => ({ code: '11111', owner: -9 }));
  groups.push({ code: JK, owner: -8 });
  for (let i = 1; i < wire.length; i++) groups.push({ code: CODES[wire[i] & 15] + CODES[wire[i] >>> 4], owner: i - 8 });
  groups.push({ code: TR, owner: frame.length });
  groups.push(...Array.from({ length: 12 }, () => ({ code: '11111', owner: frame.length + 1 })));
  const coded = groups.flatMap(g => Array.from(g.code, Number));
  const scrambled = scramble(coded);
  return { levels: mlt3(scrambled), coded, scrambled, owners: groups.flatMap(g => Array(g.code.length).fill(g.owner)), tickNs: 8, wire, phy };
}
/** Decode our known-state trace; synchronization/clock recovery are assumed. */
export function decodePhysical(trace: Trace): Uint8Array {
  if (trace.phy === '10base-t') {
    const bits = decodeManchester(trace.levels);
    return Uint8Array.from(Array.from({ length: bits.length / 8 }, (_, i) => bits.slice(i * 8, i * 8 + 8).reduce((n, bit, j) => n + (bit << j), 0))).slice(8);
  }
  const bits = scramble(decodeMlt3(trace.levels)); // XOR with the same PN stream undoes scrambling.
  if (bits.slice(80, 90).join('') !== JK) throw new Error('Missing start delimiter');
  const bytes: number[] = [];
  for (let i = 90; i < bits.length; i += 10) {
    const pair = bits.slice(i, i + 10).join('');
    if (pair === TR) break;
    const low = CODES.indexOf(pair.slice(0, 5)), high = CODES.indexOf(pair.slice(5));
    if (low < 0 || high < 0) throw new Error('Invalid 4B/5B group');
    bytes.push(low | high << 4);
  }
  return Uint8Array.from(bytes).slice(7); // The first preamble byte was replaced by J/K.
}
