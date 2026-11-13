import { useEffect, useState } from 'react';
import { ArrowRight, Check, Pause, Play, ScanLine } from 'lucide-react';
import { RangeField, Segmented } from './Controls';
import { COLORS, LinePlot } from './Plots';
import { Panel, type Selection } from './StageView';
import { SAMPLE_RATE, type Config, type SimulationResult } from '../sim/types';
import { mul, conj } from '../sim/math';

export function TimingSynchronization({ result, selection, update }: {
  result: SimulationResult; selection: Selection; update: (patch: Partial<Config>) => void;
}) {
  const sync = result.synchronization, cp = result.config.cp, stride = 64 + cp;
  const [probe, setProbe] = useState(Math.min(sync.usedOffset, stride - 1));
  const [scanning, setScanning] = useState(false);
  const [component, setComponent] = useState<'re' | 'im'>('re');
  const [pair, setPair] = useState(0);
  const d = Math.min(probe, stride - 1), pairIndex = Math.min(pair, cp - 1);
  const candidate = sync.candidates[d];
  const base = (selection.slot * result.symbolsPerSlot + selection.l) * stride;
  const prefix = sync.capture.slice(base + d, base + d + cp);
  const tail = sync.capture.slice(base + d + 64, base + d + 64 + cp);
  const protectedWindow = sync.usedOffset >= sync.safeOffsetStart && sync.usedOffset <= sync.safeOffsetEnd;
  useEffect(() => {
    if (!scanning) return;
    const timer = window.setInterval(() => setProbe(current => (current + 1) % stride), 90);
    return () => window.clearInterval(timer);
  }, [scanning, stride]);
  return <section className="timing-lab" aria-label="Cyclic-prefix synchronization">
    <div className="timing-heading"><span className="timing-heading-icon"><ScanLine size={19} /></span><div><span className="eyebrow">FIRST, FIND THE SYMBOL BOUNDARY</span><h3>The prefix is a built-in timing clue.</h3></div><span className={`timing-quality ${sync.peakMetric < 0.3 ? 'weak' : ''}`}>{sync.peakMetric >= 0.7 ? 'Strong' : sync.peakMetric >= 0.3 ? 'Partial' : 'Weak'} CP match</span></div>
    <p className="timing-introduction">The transmitter copies its last <strong>{cp} samples</strong> to the front. The receiver slides two windows <strong>64 samples apart</strong> and looks for the strongest repetition.</p>
    <div className="timing-methods"><Segmented label="Receiver timing mode" value={result.config.timingMode} options={[{ value: 'ideal', label: 'Ideal timing' }, { value: 'manual', label: 'Manual timing' }, { value: 'cp', label: 'Auto · CP correlation' }]} onChange={timingMode => { setScanning(false); update({ timingMode }); }} /></div>
    <div className="timing-readouts" aria-label="Synchronization measurements">
      <div><span>ACTUAL ARRIVAL</span><strong>{result.config.arrivalOffset}<small>samples</small></strong></div>
      <div><span>DETECTED CP START</span><strong data-testid="detected-timing">{sync.detectedOffset}<small>samples</small></strong></div>
      <div><span>RECEIVER USES</span><strong data-testid="used-timing">{sync.usedOffset}<small>samples</small></strong></div>
      <div><span>TIMING ERROR</span><strong className={sync.timingError === 0 ? '' : 'timing-error'} data-testid="timing-error">{sync.timingError > 0 ? '+' : ''}{sync.timingError}<small>samples</small></strong></div>
    </div>
    <Panel eyebrow="01 · LOOK FOR THE REPEAT" title="Slide the CP against its copied tail" badge={`Probe: sample ${d}`}>
      <div className="capture-timeline-scroll" tabIndex={0} role="region" aria-label="Received timing timeline"><CaptureTimeline result={result} selection={selection} probe={d} pair={pairIndex} /></div>
      <RangeField label="Correlation probe" value={d} min={0} max={stride - 1} unit=" samples" onChange={value => { setScanning(false); setProbe(value); }} endpoints={['CAPTURE START', 'ONE SYMBOL OF SEARCH']} />
      <div className="timing-probe-actions"><button className="text-button" onClick={() => setScanning(!scanning)} aria-label={scanning ? 'Pause correlation scan' : 'Play correlation scan'}>{scanning ? <Pause size={13} /> : <Play size={13} />}{scanning ? 'Pause scan' : 'Animate the scan'}</button><button className="text-button" onClick={() => { setScanning(false); setProbe(sync.detectedOffset); }}>Jump to correlation peak<ArrowRight size={13} /></button><button className="probe-use" onClick={() => { setScanning(false); update({ timingMode: 'manual', manualOffset: d }); }}>Use probe as receiver timing</button></div>
      <p className="plot-note">Orange windows are the probe. Green CP and purple tail show the actual transmitted boundary for comparison. The bottom bar is the FFT window the receiver currently uses.</p>
    </Panel>
    <div className="visual-grid">
      <Panel eyebrow="02 · COMPARE THE SAMPLES" title="Do these two windows match?" badge={<Segmented label="CP sample component" value={component} options={[{ value: 're', label: 'I' }, { value: 'im', label: 'Q' }]} onChange={setComponent} />}>
        <LinePlot series={[{ label: 'Probe prefix', color: COLORS.tx, values: prefix.map(v => v[component]) }, { label: 'Probe tail (+64)', color: COLORS.rx, values: tail.map(v => v[component]), dashed: true }]} point={pairIndex} xLabel="SAMPLE WITHIN WINDOW" yLabel={component === 're' ? 'I · REAL PART' : 'Q · IMAGINARY PART'} height={190} />
        <RangeField label="Inspected sample pair" value={pairIndex} min={0} max={cp - 1} onChange={setPair} />
        <p className="plot-note">This plot shows the inspected OFDM symbol. Noise disrupts the match; CFO rotates the tail’s phase. The correlation magnitude uses both I and Q.</p>
      </Panel>
      <Panel eyebrow="03 · FIND THE BEST ALIGNMENT" title="A peak points to the CP start" badge={`${sync.averagedSymbols} symbols averaged`}>
        <LinePlot series={[{ label: 'Normalized CP correlation', color: COLORS.tx, values: sync.candidates.map(v => v.metric) }]} markers={[{ index: sync.detectedOffset, label: 'Peak', color: COLORS.rx }, { index: d, label: 'Probe', color: COLORS.equalized }]} xLabel="CANDIDATE CP START (SAMPLES)" yLabel="REPETITION SCORE" fixedRange={[0, 1.05]} height={190} />
        <div className="correlation-score"><span>At your probe <strong>{candidate.metric.toFixed(3)}</strong></span><span>Peak <strong>{sync.peakMetric.toFixed(3)}</strong></span></div>
        <p className="plot-note">A score of 1 means perfect coherent repetition. This score is not a probability. Noise, echoes, and the narrow bandwidth can make the peak weak, broad, or displaced.</p>
      </Panel>
    </div>
    <div className={`timing-outcome ${protectedWindow ? '' : 'outside-window'}`}><div><strong>{result.config.timingMode === 'ideal' ? 'Ideal mode uses the known arrival time.' : result.config.timingMode === 'manual' ? 'Manual mode uses your chosen sample.' : 'The correlation peak now drives the receiver.'}</strong><p>FFT starts at sample <b>{sync.usedOffset + cp}</b> ({((sync.usedOffset + cp) / SAMPLE_RATE * 1e6).toFixed(2)} μs) and reads 64 samples per symbol. {protectedWindow ? 'This start lies inside the theoretical guard-protected region; channel estimation can still leave errors.' : sync.safeOffsetStart > sync.safeOffsetEnd ? 'The delay spread exceeds the prefix: no FFT start can fully avoid interference.' : 'This start lies outside the guard-protected region, so the FFT can include idle samples or part of a neighboring symbol.'}</p></div><button className="primary-button" onClick={() => { setScanning(false); setProbe(sync.detectedOffset); update({ timingMode: 'cp' }); }}><Check size={14} />Apply CP synchronization</button></div>
    <div className="cp-frequency-readout"><div><span className="eyebrow">A SECOND CLUE: CORRELATION PHASE</span><p>The phase between repeated windows estimates frequency mismatch.</p></div><div><strong>{(sync.estimatedCfo * 15000).toFixed(1)} Hz</strong><span>CP estimate · ε̂={sync.estimatedCfo.toFixed(4)}</span></div><div><strong>{(result.config.cfo * 15000).toFixed(1)} Hz</strong><span>Actual · shown for comparison</span></div></div>
    <p className="plot-note">Enable frequency compensation and choose “CP estimate” in the receiver controls to use this measured offset. Its unambiguous range is strictly within ±7.5 kHz; noise and timing errors reduce accuracy.</p>
    <details className="technical-detail"><summary>Correlation math & sample values</summary><div className="cp-math"><code>P(d) = Σₛ Σᵢ conj(r[d + sT + i]) · r[d + sT + i + 64]</code><code>M(d) = |P(d)|² / (Eprefix · Etail)</code><code>ε̂ = arg(P(dpeak)) / (2π); T = 64 + CP</code><p>Scan one symbol period and maximize M(d), using up to eight symbols. The detector receives only captured samples and known FFT/prefix lengths. Actual arrival time is used only by ideal mode and comparison overlays.</p><div className="numeric-table-scroll" tabIndex={0} role="region" aria-label="CP sample pair values"><table><thead><tr><th scope="col">Pair</th><th scope="col">Prefix I</th><th scope="col">Prefix Q</th><th scope="col">Tail I</th><th scope="col">Tail Q</th><th scope="col">Product I</th><th scope="col">Product Q</th></tr></thead><tbody>{prefix.map((a, i) => { const b = tail[i], product = mul(conj(a), b); return <tr key={i} className={i === pairIndex ? 'inspected-pair' : ''}><th scope="row">{i}</th><td>{a.re.toFixed(4)}</td><td>{a.im.toFixed(4)}</td><td>{b.re.toFixed(4)}</td><td>{b.im.toFixed(4)}</td><td>{product.re.toFixed(4)}</td><td>{product.im.toFixed(4)}</td></tr>; })}</tbody></table></div><div className="numeric-table-scroll" tabIndex={0} role="region" aria-label="CP correlation candidate values"><table><thead><tr><th scope="col">CP start</th><th scope="col">P I</th><th scope="col">P Q</th><th scope="col">Match score</th></tr></thead><tbody>{sync.candidates.map(v => <tr key={v.offset} className={v.offset === d ? 'inspected-pair' : ''}><th scope="row">{v.offset}</th><td>{v.correlation.re.toFixed(4)}</td><td>{v.correlation.im.toFixed(4)}</td><td>{v.metric.toFixed(5)}</td></tr>)}</tbody></table></div></div></details>
    <p className="timing-limit">CP finds symbol timing, not frame identity or cell identity. This experiment assumes capture begins within the first symbol period. Full LTE also uses synchronization signals such as PSS/SSS.</p>
  </section>;
}

function CaptureTimeline({ result, selection, probe, pair }: {
  result: SimulationResult; selection: Selection; probe: number; pair: number;
}) {
  const sync = result.synchronization, cp = result.config.cp, stride = 64 + cp;
  const count = stride * 2 + 32, base = (selection.slot * result.symbolsPerSlot + selection.l) * stride;
  const samples = sync.capture.slice(base, base + count);
  const amplitude = Math.max(0.01, ...samples.map(v => Math.abs(v.re)));
  const x = (n: number) => 35 + n / count * 690, y = (value: number) => 74 - value / amplitude * 26;
  const a = probe + pair, b = a + 64;
  const trace = samples.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v.re).toFixed(1)}`).join(' ');
  return <svg className="capture-timeline" viewBox="0 0 760 180" role="img" aria-label={`Received sample timeline. Probe pairs are ${64} samples apart. Actual CP begins at ${result.config.arrivalOffset}; receiver FFT begins at ${sync.usedOffset + cp}.`}>
    <rect x={x(result.config.arrivalOffset)} y="28" width={x(cp) - x(0)} height="81" rx="3" fill="#e4f0e1" />
    <rect x={x(result.config.arrivalOffset + 64)} y="28" width={x(cp) - x(0)} height="81" rx="3" fill="#eee5f7" />
    <text x={x(result.config.arrivalOffset) + 4} y="22" className="svg-label">CP</text><text x={x(result.config.arrivalOffset + 64) + 4} y="22" className="svg-label">COPIED TAIL</text>
    <path d={`M35 74 H725`} stroke="#d7e2cd" />
    <path d={trace} fill="none" stroke="#7b9270" strokeWidth="1.2" />
    {[probe, probe + 64].map((n, i) => <rect key={i} x={x(n)} y="30" width={x(cp) - x(0)} height="78" fill="none" stroke={COLORS.equalized} strokeDasharray="4 3" rx="3" />)}
    <path d={`M${x(a)} ${y(samples[a].re)} V118 H${x(b)} V${y(samples[b].re)}`} fill="none" stroke="#b48d56" strokeWidth="1" strokeDasharray="3 3" />
    {[a, b].map((n, i) => <circle key={i} cx={x(n)} cy={y(samples[n].re)} r="3.5" fill={i === 0 ? COLORS.tx : COLORS.rx} />)}
    <rect x={x(sync.usedOffset + cp)} y="135" width={x(64) - x(0)} height="22" rx="4" fill="#e7efe0" stroke="#bbcdb0" />
    <text x={x(sync.usedOffset + cp + 32)} y="149" textAnchor="middle" className="svg-label">RECEIVER FFT · 64 SAMPLES</text>
    <text x={x(a + 32)} y="129" textAnchor="middle" className="svg-small">PAIR {pair} · 64 SAMPLES APART</text>
    {[0, 32, 64, 96, 128, 160, 192].filter(n => n < count).map(n => <text key={n} x={x(n)} y="175" textAnchor="middle" className="svg-small">{n}</text>)}<text x="725" y="175" textAnchor="end" className="svg-small">SAMPLES</text>
  </svg>;
}
