import { attachCrc, crcRemainder, decode, demap, encode, goldSequence, mapSymbol, serialize } from './codec';
import { add, c, conj, fft, gaussian, lerp, meanPower, mul, polar, power, rng, scale, sub } from './math';
import { ACTIVE_BINS, BITS_PER_SYMBOL, FREQUENCIES, type Cell, type Complex, type Config, type Role, type SimulationResult, type Tap } from './types';
import { correlatePrefix } from './synchronization';

export function profileTaps(config: Config): Tap[] {
  if (config.profile === 'custom') return config.taps.map(t => ({ ...t }));
  if (config.profile === 'epa') return [
    { delay: 0, gain: 1, phase: 0 }, { delay: 2, gain: 10 ** (-7 / 20), phase: 0.6 }, { delay: 5, gain: 10 ** (-15 / 20), phase: -1.1 },
  ];
  if (config.profile === 'etu') return [
    { delay: 0, gain: 1, phase: 0 }, { delay: 4, gain: 0.85, phase: 2.4 },
    { delay: 10, gain: 0.65, phase: -0.9 }, { delay: 15, gain: 0.45, phase: 1.6 },
  ];
  return [{ delay: 0, gain: 1, phase: 0 }];
}
export function resourceRole(k: number, l: number, cp: 16 | 32, cfi: number, synchronization: boolean): Role {
  const pilotSymbol = cp === 16 ? 4 : 3;
  const columns = cp === 16 ? 7 : 6;
  if ((l === 0 && [0, 3, 6, 9].includes(k)) || (l === pilotSymbol && [1, 4, 7, 10].includes(k))) return 'pilot';
  if (l < cfi) return 'control';
  if (synchronization && l === columns - 1) return 'pss';
  if (synchronization && l === columns - 2) return 'sss';
  return 'data';
}
export function channelResponse(taps: Tap[]): Complex[] {
  return ACTIVE_BINS.map(bin => taps.reduce((sum, tap) => add(sum, polar(tap.gain, tap.phase - 2 * Math.PI * bin * tap.delay / 64)), c()));
}
export function applyMultipath(input: Complex[], taps: Tap[]): Complex[] {
  return input.map((_, n) => taps.reduce((sum, tap) => n >= tap.delay ? add(sum, mul(input[n - tap.delay], polar(tap.gain, tap.phase))) : sum, c()));
}
function interpolatePilots(cells: Cell[], cp: 16 | 32): Complex[][] {
  const columns = cp === 16 ? 7 : 6, pilotSymbol = cp === 16 ? 4 : 3;
  const rows = [0, pilotSymbol].map(l => {
    const pilots = cells.filter(cell => cell.l === l && cell.role === 'pilot').sort((a, b) => a.k - b.k);
    return Array.from({ length: 12 }, (_, k) => {
      const left = [...pilots].reverse().find(p => p.k <= k) ?? pilots[0];
      const right = pilots.find(p => p.k >= k) ?? pilots[pilots.length - 1];
      if (left.k === right.k) return left.rx;
      const t = (FREQUENCIES[k] - FREQUENCIES[left.k]) / (FREQUENCIES[right.k] - FREQUENCIES[left.k]);
      return lerp(left.rx, right.rx, t);
    });
  });
  return Array.from({ length: columns }, (_, l) => rows[0].map((v, k) => lerp(v, rows[1][k], Math.min(1, l / pilotSymbol))));
}

/** Short teaching synchronization sequences, not full LTE acquisition. */
function syncSymbol(role: 'pss' | 'sss', k: number, slot: number): Complex {
  if (role === 'pss') {
    const n = k < 6 ? k + 25 : k + 26;
    return polar(1, -Math.PI * 25 * n * (n + 1) / 63);
  }
  const sequence = [1, 0, 0, 0, 0];
  for (let i = 0; i < 31; i++) sequence.push(sequence[i + 2] ^ sequence[i]);
  return c(1 - 2 * (sequence[(k + slot) % 31] ^ sequence[(k + 7) % 31]));
}

export function simulate(config: Config): SimulationResult {
  const payload = serialize(config.source, config.sourceMode);
  const transport = attachCrc(payload, config.crc);
  const encoded = encode(transport, config.coding), coded = encoded.bits;
  const columns = config.cp === 16 ? 7 : 6, m = BITS_PER_SYMBOL[config.modulation];
  const taps = profileTaps(config);
  if (!taps.length || taps.length > 6 || taps.some(t => !Number.isInteger(t.delay) || t.delay < 0 || t.delay > 28 || !Number.isFinite(t.gain) || t.gain < 0 || t.gain > 1 || !Number.isFinite(t.phase))) throw new Error('Use 1–6 taps with integer delays from 0–28 and gains from 0–1.');
  if (taps.every(t => t.gain === 0)) throw new Error('Give at least one channel tap a gain above zero.');
  if (!Number.isFinite(config.snr) || !Number.isFinite(config.cfo)) throw new Error('SNR and frequency offset must be finite numbers.');
  if (!Number.isInteger(config.arrivalOffset) || config.arrivalOffset < 0 || config.arrivalOffset > 63
    || !Number.isInteger(config.manualOffset) || config.manualOffset < 0 || config.manualOffset > 95) {
    throw new Error('Arrival delay must be 0–63 samples and manual timing must be 0–95 samples.');
  }
  const rolesBySlot: Role[][] = [], capacities: number[] = [];
  let capacity = 0, slotCount = 0;
  while (capacity < coded.length) {
    const absoluteSlot = ((config.sync === 'off' ? 1 : Number(config.sync)) + slotCount) % 20;
    const hasSync = config.sync !== 'off' && (absoluteSlot === 0 || absoluteSlot === 10);
    const roles = Array.from({ length: 12 * columns }, (_, idx) => resourceRole(idx % 12, Math.floor(idx / 12), config.cp, config.cfi, hasSync));
    const count = roles.filter(r => r === 'data').length;
    rolesBySlot.push(roles); capacities.push(count);
    capacity += count * m; slotCount++;
  }
  const padded = [...coded, ...Array(capacity - coded.length).fill(0)];
  const gold = goldSequence(capacity, config.goldSeed);
  const scrambled = padded.map((b, i) => b ^ gold[i]);
  const cells: Cell[][] = [], txSamples: Complex[] = [];
  let symbolIndex = 0;
  for (let slot = 0; slot < slotCount; slot++) {
    const grid: Cell[] = [];
    for (let l = 0; l < columns; l++) {
      const frequency = Array.from({ length: 64 }, () => c());
      for (let k = 0; k < 12; k++) {
        const role = rolesBySlot[slot][l * 12 + k];
        let tx: Complex; let index: number | null = null;
        if (role === 'data') { index = symbolIndex++; tx = mapSymbol(scrambled.slice(index * m, (index + 1) * m), config.modulation); }
        else if (role === 'pilot') tx = c(1);
        else if (role === 'control') tx = mapSymbol([(slot >> (k % 5)) & 1, (l + k) & 1], 'QPSK');
        else tx = syncSymbol(role, k, (Number(config.sync) + slot) % 20);
        frequency[ACTIVE_BINS[k]] = tx;
        grid.push({ k, l, slot, role, tx, rx: c(), equalized: c(), estimate: c(), symbolIndex: index });
      }
      const samples = fft(frequency, true);
      txSamples.push(...samples.slice(-config.cp), ...samples);
    }
    cells.push(grid);
  }
  // Keep the last echo after TX stops: acquired timing may read those samples.
  const lastDelay = Math.max(...taps.map(t => t.delay));
  const fullChannel = applyMultipath([...txSamples, ...Array.from({ length: lastDelay }, () => c())], taps);
  const channelSamples = fullChannel.slice(0, txSamples.length);
  const noiseVariance = config.noise ? meanPower(channelSamples) * 10 ** (-config.snr / 10) : 0;
  const random = rng(config.seed);
  const fullReceived = fullChannel.map((value, n) => {
    const rotated = mul(value, polar(1, 2 * Math.PI * config.cfo * (n + config.arrivalOffset) / 64));
    return add(rotated, scale(gaussian(random), Math.sqrt(noiseVariance / 2)));
  });
  const rxSamples = fullReceived.slice(0, txSamples.length);
  const idleRandom = rng(config.seed ^ 0xA5A5A5A5);
  const idle = (length: number) => Array.from({ length }, () => scale(gaussian(idleRandom), Math.sqrt(noiseVariance / 2)));
  const capture = [...idle(config.arrivalOffset), ...fullReceived, ...idle(256)];
  const acquisition = correlatePrefix(capture, config.cp, slotCount * columns);
  const usedOffset = config.timingMode === 'ideal' ? config.arrivalOffset
    : config.timingMode === 'manual' ? config.manualOffset : acquisition.detectedOffset;
  const appliedCfo = config.compensateCfo ? (config.cfoSource === 'cp' ? acquisition.estimatedCfo : config.cfo) : 0;
  const activeTaps = taps.filter(t => t.gain > 0);
  const synchronization = {
    capture, ...acquisition, usedOffset, appliedCfo, timingError: usedOffset - config.arrivalOffset,
    safeOffsetStart: config.arrivalOffset + Math.max(...activeTaps.map(t => t.delay)) - config.cp,
    safeOffsetEnd: config.arrivalOffset + Math.min(...activeTaps.map(t => t.delay)),
  };
  const observed = config.compensateCfo ? capture.map((v, n) => mul(v, polar(1, -2 * Math.PI * appliedCfo * n / 64))) : capture;
  const recoveredScrambled: number[] = [], receivedLlrs: number[] = [];
  const symbols: SimulationResult['symbols'] = [];
  for (let slot = 0; slot < slotCount; slot++) {
    const grid = cells[slot];
    for (let l = 0; l < columns; l++) {
      const start = usedOffset + (slot * columns + l) * (64 + config.cp) + config.cp;
      const transformed = fft(observed.slice(start, start + 64));
      for (let k = 0; k < 12; k++) grid[l * 12 + k].rx = transformed[ACTIVE_BINS[k]];
    }
    const estimates = interpolatePilots(grid, config.cp);
    for (const cell of grid) {
      cell.estimate = estimates[cell.l][cell.k];
      const h2 = power(cell.estimate);
      let weight = c(1), gain = 1;
      if (config.equalizer !== 'off') {
        const denominator = Math.max(1e-12, h2 + (config.equalizer === 'mmse' ? noiseVariance : 0));
        weight = scale(conj(cell.estimate), 1 / denominator);
        gain = h2 / denominator;
      }
      cell.equalized = mul(cell.rx, weight);
      if (cell.symbolIndex === null) continue;
      const decoded = demap(cell.equalized, config.modulation, noiseVariance * power(weight), gain);
      const index = cell.symbolIndex;
      symbols.push({ bits: scrambled.slice(index * m, (index + 1) * m), tx: cell.tx, rx: cell.rx, equalized: cell.equalized,
        slot, k: cell.k, l: cell.l, llrs: decoded.llrs, recoveredBits: [...decoded.bits] });
      recoveredScrambled.push(...decoded.bits); receivedLlrs.push(...decoded.llrs);
    }
  }
  const recoveredCoded = recoveredScrambled.slice(0, coded.length).map((b, i) => b ^ gold[i]);
  const descrambledLlrs = receivedLlrs.slice(0, coded.length).map((v, i) => v * (gold[i] ? -1 : 1));
  const decoded = decode(recoveredCoded, descrambledLlrs, config.coding, config.decision === 'soft', transport.length);
  const recoveredTransport = decoded.bits, recoveredPayload = recoveredTransport.slice(0, payload.length);
  const crcPass = config.crc ? crcRemainder(recoveredTransport, config.crc).every(v => v === 0) : null;
  let output = recoveredPayload.join('');
  if (config.sourceMode === 'ascii') {
    output = '';
    for (let i = 0; i < recoveredPayload.length; i += 8) {
      const value = recoveredPayload.slice(i, i + 8).reduce((sum, bit) => (sum << 1) | bit, 0);
      output += String.fromCharCode(value);
    }
  }
  const rawErrors = coded.reduce((sum, b, i) => sum + Number(b !== recoveredCoded[i]), 0);
  const decodedErrors = transport.reduce((sum, b, i) => sum + Number(b !== recoveredTransport[i]), 0);
  // EVM only covers actual codeword-bearing symbols, excluding resource padding.
  const dataSymbols = symbols.slice(0, Math.ceil(coded.length / m));
  const errorEnergy = dataSymbols.reduce((sum, s) => sum + power(sub(s.equalized, s.tx)), 0);
  const idealEnergy = dataSymbols.reduce((sum, s) => sum + power(s.tx), 0);
  const average = meanPower(txSamples), peak = txSamples.reduce((max, s) => Math.max(max, power(s)), 0);
  return { config, payload, transport, coded, padded, scrambled, recoveredCoded, recoveredTransport, recoveredPayload,
    decoded: output, crcPass, correctedBlocks: decoded.corrected, slots: slotCount, symbolsPerSlot: columns,
    dataPerSlot: capacities[0], codingPadding: encoded.padding, resourcePadding: capacity - coded.length,
    cells, symbols, txSamples, channelSamples, rxSamples, taps, trueChannel: channelResponse(taps), synchronization,
    noiseVariance, papr: 10 * Math.log10(peak / average), evm: 100 * Math.sqrt(errorEnergy / Math.max(idealEnergy, 1e-12)),
    rawErrors, decodedErrors, rawBer: rawErrors / coded.length, decodedBer: decodedErrors / transport.length,
  };
}
