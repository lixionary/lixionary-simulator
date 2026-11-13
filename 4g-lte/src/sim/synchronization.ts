import { add, c, conj, mul, power } from './math';
import type { Complex, TimingCandidate } from './types';

/**
 * CP and copied tail are N samples apart. Search one symbol's timing phase;
 * sum complex correlations across symbols before taking the magnitude.
 * No arrival offset, transmitted samples, pilots, or payload enter the search.
 */
export function correlatePrefix(capture: Complex[], cp: number, symbols: number, nfft = 64) {
  const stride = nfft + cp;
  const averagedSymbols = Math.max(0, Math.min(symbols, 8, Math.floor((capture.length - stride + 1) / stride)));
  const candidates: TimingCandidate[] = Array.from({ length: stride }, (_, offset) => {
    let correlation = c(), prefixEnergy = 0, tailEnergy = 0;
    for (let symbol = 0; symbol < averagedSymbols; symbol++) {
      for (let i = 0; i < cp; i++) {
        const a = capture[offset + symbol * stride + i];
        const b = capture[offset + symbol * stride + i + nfft];
        if (!a || !b) continue;
        correlation = add(correlation, mul(conj(a), b));
        prefixEnergy += power(a); tailEnergy += power(b);
      }
    }
    const energyProduct = prefixEnergy * tailEnergy;
    const metric = energyProduct > 1e-20 ? Math.min(1, power(correlation) / energyProduct) : 0;
    return { offset, correlation, prefixEnergy, tailEnergy, metric };
  });
  // Strict greater-than chooses the earliest sample for an exactly flat peak.
  const peak = candidates.reduce((best, candidate) => candidate.metric > best.metric ? candidate : best, candidates[0]);
  return {
    candidates, averagedSymbols, detectedOffset: peak.offset, peakMetric: peak.metric,
    estimatedCfo: Math.atan2(peak.correlation.im, peak.correlation.re) / (2 * Math.PI),
  };
}
