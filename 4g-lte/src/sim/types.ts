export type Complex = { re: number; im: number };
export type Modulation = 'BPSK' | 'QPSK' | '16-QAM' | '64-QAM' | '256-QAM';
export type Coding = 'none' | 'hamming' | 'convolutional';
export type Tap = { delay: number; gain: number; phase: number };
export type Config = {
  sourceMode: 'ascii' | 'binary'; source: string; modulation: Modulation;
  crc: 0 | 8 | 16; coding: Coding; goldSeed: number; seed: number;
  cp: 16 | 32; cfi: 0 | 1 | 2; sync: 'off' | '0' | '10';
  profile: 'awgn' | 'epa' | 'etu' | 'custom'; taps: Tap[];
  snr: number; noise: boolean; cfo: number; compensateCfo: boolean;
  equalizer: 'off' | 'zf' | 'mmse'; decision: 'hard' | 'soft';
  timingMode: 'ideal' | 'manual' | 'cp'; arrivalOffset: number; manualOffset: number;
  cfoSource: 'known' | 'cp';
};
export type TimingCandidate = {
  offset: number; correlation: Complex; prefixEnergy: number; tailEnergy: number; metric: number;
};
export type Synchronization = {
  capture: Complex[]; candidates: TimingCandidate[]; averagedSymbols: number;
  detectedOffset: number; usedOffset: number; peakMetric: number;
  timingError: number; estimatedCfo: number; appliedCfo: number;
  safeOffsetStart: number; safeOffsetEnd: number;
};
export type Role = 'data' | 'pilot' | 'control' | 'pss' | 'sss';
export type Cell = {
  k: number; l: number; slot: number; role: Role; tx: Complex; rx: Complex;
  equalized: Complex; estimate: Complex; symbolIndex: number | null;
};
export type SymbolRecord = {
  bits: number[]; tx: Complex; rx: Complex; equalized: Complex;
  slot: number; k: number; l: number; llrs: number[]; recoveredBits: number[];
};
export type SimulationResult = {
  config: Config; payload: number[]; transport: number[]; coded: number[];
  padded: number[]; scrambled: number[]; recoveredCoded: number[];
  recoveredTransport: number[]; recoveredPayload: number[];
  decoded: string; crcPass: boolean | null; correctedBlocks: number;
  slots: number; symbolsPerSlot: number; dataPerSlot: number;
  codingPadding: number; resourcePadding: number; cells: Cell[][];
  symbols: SymbolRecord[]; txSamples: Complex[]; channelSamples: Complex[];
  rxSamples: Complex[]; taps: Tap[]; trueChannel: Complex[];
  noiseVariance: number; papr: number; evm: number; rawErrors: number;
  decodedErrors: number; rawBer: number; decodedBer: number;
  synchronization: Synchronization;
};
export const DEFAULT_CONFIG: Config = {
  sourceMode: 'ascii', source: 'HELLO 4G', modulation: 'QPSK',
  crc: 16, coding: 'hamming', goldSeed: 42, seed: 31415,
  cp: 16, cfi: 0, sync: 'off', profile: 'awgn',
  taps: [{ delay: 0, gain: 1, phase: 0 }],
  snr: 24, noise: true, cfo: 0, compensateCfo: false,
  equalizer: 'mmse', decision: 'soft',
  timingMode: 'ideal', arrivalOffset: 24, manualOffset: 0, cfoSource: 'known',
};
export const BITS_PER_SYMBOL: Record<Modulation, number> = {
  BPSK: 1, QPSK: 2, '16-QAM': 4, '64-QAM': 6, '256-QAM': 8,
};
export const ACTIVE_BINS = [58, 59, 60, 61, 62, 63, 1, 2, 3, 4, 5, 6];
export const FREQUENCIES = [-90, -75, -60, -45, -30, -15, 15, 30, 45, 60, 75, 90];
export const SAMPLE_RATE = 960_000;
