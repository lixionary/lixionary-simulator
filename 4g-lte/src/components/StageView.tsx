import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, Info, Radio, Sparkles } from 'lucide-react';
import { COLORS, ConstellationPlot, LinePlot } from './Plots';
import { Segmented } from './Controls';
import { TimingSynchronization } from './TimingSynchronization';
import { ACTIVE_BINS, BITS_PER_SYMBOL, FREQUENCIES, SAMPLE_RATE, type Cell, type Config, type SimulationResult } from '../sim/types';
import { polar, power } from '../sim/math';

export type Selection = { slot: number; l: number; k: number };
export const STAGES = [
  { label: 'Your bits', title: 'Every message starts with bits.', description: 'Turn characters into bits, add a checksum and redundant bits, then scramble the result for transmission.', detail: 'ASCII is serialized MSB first. CRC detects errors; FEC adds redundancy to repair them. Gold scrambling XORs the codeword with a repeatable sequence. Padding is tracked separately and removed at the receiver.' },
  { label: 'Modulation', title: 'Give your bits a place on the map.', description: 'Each group of bits chooses a point. Its horizontal and vertical position define the I and Q parts of a signal.', detail: 'Even-indexed bits set I; odd-indexed bits set Q. Gray-coded neighboring levels differ by one bit. Constellations are normalized to unit average energy. Higher-order modulation packs more bits into each resource element.' },
  { label: 'Resource grid', title: 'A little room for every symbol.', description: 'Arrange symbols across frequency and time. Save a few known positions so the receiver can find its way.', detail: 'One teaching PRB contains 12 active subcarriers and 7 or 6 OFDM symbols. CRS pilots take priority over control resources. Optional PSS/SSS subsets reserve the last two columns in synchronization slots. DC and 51 guard bins remain zero.' },
  { label: 'OFDM', title: 'Many small waves. One signal.', description: 'Combine the subcarriers into a waveform. Copy its tail to the front to leave room for echoes.', detail: 'A unitary 64-point IFFT creates the time-domain samples. A 16- or 32-sample cyclic prefix repeats the final samples. At 960 kHz, sample timing is 1.0417 μs. PAPR measures peak power relative to average power across the transmitted stream.' },
  { label: 'Wireless channel', title: 'The air adds a little uncertainty.', description: 'Echoes, noise, and frequency mismatch change the signal before it reaches the receiver.', detail: 'The full stream is convolved with complex channel taps, rotated by exp(j2πεn/64), then mixed with circular Gaussian noise. SNR is measured against average post-multipath sample power. Echoes beyond the prefix cause inter-symbol interference.' },
  { label: 'Receiver', title: 'Find the signal inside the noise.', description: 'Find the symbol boundary using the repeated prefix, then use pilots to estimate and undo the channel.', detail: 'Ideal timing uses the known arrival. Manual timing uses your chosen offset. CP timing scans received samples 64 apart and maximizes normalized correlation across up to eight symbols. The chosen boundary drives prefix removal and the FFT. Pilot estimates then feed ZF or MMSE equalization. CP timing alone does not identify the frame or cell.' },
  { label: 'Recovered data', title: 'Did your message make it home?', description: 'Choose likely bits, undo scrambling, and decode. The checksum tells you whether the transport block survived.', detail: 'Hard demapping picks the nearest symbol. Soft demapping computes max-log LLRs: positive favors 0, negative favors 1. Hamming uses syndrome correction; convolutional coding uses terminated four-state Viterbi decoding. Pre-FEC BER counts codeword errors; post-FEC BER includes payload and CRC bits, excluding all padding.' },
];
export function Panel({ eyebrow, title, badge, children, className = '' }: { eyebrow?: string; title: string; badge?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h3>{title}</h3></div>{badge && <span className="panel-badge">{badge}</span>}</div>{children}</section>;
}
const fmt = (v: number) => v.toFixed(3);
export function ComplexValue({ value }: { value: { re: number; im: number } }) { return <code>{fmt(value.re)} {value.im < 0 ? '−' : '+'} j{fmt(Math.abs(value.im))}</code>; }

function BitStrip({ bits, label, start = -1, length = 0, color = 'green' }: { bits: number[]; label: string; start?: number; length?: number; color?: string }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="bit-strip"><div className="bit-strip-heading"><span>{label}</span><span>{bits.length} bits</span></div>
    <div className="bit-cells">{bits.slice(0, expanded ? bits.length : 112).map((bit, i) => <span title={`Bit ${i}: ${bit}`} key={i} className={i >= start && i < start + length ? `bit-selected ${color}` : ''}>{bit}</span>)}</div>
    {bits.length > 112 && <button className="text-button bit-expand" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer' : `Show all ${bits.length} bits`}</button>}
  </div>;
}
function IQDiagram({ bits, cell }: { bits: number[]; cell: Cell }) {
  return <svg className="iq-diagram" viewBox="0 0 660 196" role="img" aria-label={`Symbol bits ${bits.join('')}. Even bits map to I ${fmt(cell.tx.re)}, odd bits to Q ${fmt(cell.tx.im)}.`}>
    <text x="24" y="28" className="svg-label">SYMBOL WORD</text>
    {bits.map((bit, i) => <g key={i}><rect x={24 + i * 30} y="55" width="25" height="32" rx="5" className={i % 2 === 0 ? 'iq-bit-i' : 'iq-bit-q'} /><text x={36.5 + i * 30} y="76" textAnchor="middle" className="svg-bit">{bit}</text><text x={36.5 + i * 30} y="102" textAnchor="middle" className="svg-small">b{i}</text></g>)}
    <path d="M 275 70 L 316 70 L 316 48 L 365 48" fill="none" stroke={COLORS.tx} strokeWidth="1.5" />
    <path d="M 316 70 L 316 137 L 365 137" fill="none" stroke={COLORS.rx} strokeWidth="1.5" />
    <circle cx="316" cy="70" r="3" fill={COLORS.tx} />
    <rect x="365" y="23" width="144" height="51" rx="8" fill="#eaf5ee" /><rect x="365" y="112" width="144" height="51" rx="8" fill="#f2edf9" />
    <text x="379" y="44" className="svg-label" fill={COLORS.tx}>I · EVEN BITS</text><text x="379" y="62" className="svg-bit">{bits.filter((_, i) => i % 2 === 0).join(' ')}</text>
    <text x="379" y="133" className="svg-label" fill={COLORS.rx}>Q · ODD BITS</text><text x="379" y="151" className="svg-bit">{bits.filter((_, i) => i % 2 === 1).join(' ') || '0 (BPSK)'}</text>
    <path d="M 514 48 L 551 48 M 514 137 L 551 137" stroke="#c0cac0" />
    <text x="560" y="44" className="svg-label">I LEVEL</text><text x="560" y="64" className="svg-value" fill={COLORS.tx}>{fmt(cell.tx.re)}</text>
    <text x="560" y="133" className="svg-label">Q LEVEL</text><text x="560" y="153" className="svg-value" fill={COLORS.rx}>{fmt(cell.tx.im)}</text>
    <text x="24" y="176" className="svg-small">BITS → GRAY-CODED LEVELS → NORMALIZED COMPLEX SYMBOL</text>
  </svg>;
}
function AirDiagram({ result, playing }: { result: SimulationResult; playing: boolean }) {
  const profiles = { awgn: 'ONE CLEAR PATH', epa: 'PEDESTRIAN ECHOES', etu: 'URBAN ECHOES', custom: 'CUSTOM MULTIPATH' };
  return <div className={`air-diagram ${playing ? 'playing' : ''}`}><svg viewBox="0 0 780 150" role="img" aria-label={`Transmitter to receiver across ${result.taps.length} wireless paths, with ${result.config.noise ? `${result.config.snr} dB SNR` : 'noise disabled'}.`}>
    <defs><pattern id="air-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="#dce4d9" /></pattern></defs>
    <rect x="0" y="0" width="780" height="150" fill="url(#air-dots)" />
    {result.taps.slice(1).map((tap, i) => <path key={i} d={`M 108 70 Q 390 ${70 + (i % 2 ? 1 : -1) * (48 + i * 16)} 671 70`} fill="none" stroke={i % 2 ? '#b49cd0' : '#83ab90'} strokeWidth={Math.max(0.6, tap.gain * 2)} strokeDasharray="5 6" opacity={tap.gain} />)}
    <path d="M 108 70 L 671 70" stroke="#b4c9b6" strokeWidth="1.5" />
    {[0, 1, 2].map(i => <circle key={i} className="air-packet" cx={245 + i * 133} cy="70" r="3.5" fill={i === 2 ? COLORS.rx : COLORS.tx} style={{ animationDelay: `${i * -1.2}s` }} />)}
    <rect x="327" y="42" width="126" height="55" rx="10" fill="#f5f4ef" stroke="#e1e5dc" /><text x="390" y="64" textAnchor="middle" className="svg-label">{profiles[result.config.profile]}</text><text x="390" y="82" textAnchor="middle" className="svg-small">{result.config.noise ? `SNR ${result.config.snr} dB` : 'NO NOISE'} · {result.taps.length} {result.taps.length === 1 ? 'PATH' : 'PATHS'}</text>
    {[84, 695].map((x, i) => <g key={x} stroke={i === 0 ? COLORS.tx : COLORS.rx} fill="none" strokeWidth="2"><path d={`M ${x - 14} 102 L ${x} 55 L ${x + 14} 102 M ${x - 8} 84 L ${x + 8} 84 M ${x - 11} 96 L ${x + 11} 96 M ${x - 17} 104 L ${x + 17} 104`} /><circle cx={x} cy="50" r="4" fill={i === 0 ? COLORS.tx : COLORS.rx} /><path d={`M ${x - 10} 41 Q ${x - 18} 51 ${x - 10} 60 M ${x + 10} 41 Q ${x + 18} 51 ${x + 10} 60 M ${x - 17} 34 Q ${x - 31} 51 ${x - 17} 67 M ${x + 17} 34 Q ${x + 31} 51 ${x + 17} 67`} opacity="0.5" /></g>)}
    <text x="84" y="131" textAnchor="middle" className="svg-label" fill={COLORS.tx}>TRANSMITTER</text><text x="695" y="131" textAnchor="middle" className="svg-label" fill={COLORS.rx}>RECEIVER</text>
    <text x="390" y="139" textAnchor="middle" className="svg-small">SAME MESSAGE. A CHANGED WAVE.</text>
  </svg></div>;
}
function TapDiagram({ result }: { result: SimulationResult }) {
  const firstDelay = Math.min(...result.taps.filter(t => t.gain > 0).map(t => t.delay));
  const domain = Math.max(32, Math.ceil((firstDelay + result.config.cp) / 8) * 8);
  const xAt = (delay: number) => 40 + delay / domain * 490;
  const cpX = xAt(firstDelay + result.config.cp);
  return <svg className="tap-diagram" viewBox="0 0 580 156" role="img" aria-label={`Channel impulse response. Prefix supports ${result.config.cp} samples of delay spread from the first path at ${firstDelay}. ${result.taps.map(t => `Tap at ${t.delay}, gain ${t.gain.toFixed(2)}`).join('. ')}.`}>
    <rect x={xAt(firstDelay)} y="20" width={cpX - xAt(firstDelay)} height="98" fill="#eaf5ee" /><text x={xAt(firstDelay) + 5} y="34" className="svg-small" fill={COLORS.tx}>CP SPREAD BUDGET</text>
    <path d="M 40 118 L 535 118" stroke="#bbc6ba" />
    <path d={`M ${cpX} 19 L ${cpX} 118`} stroke={COLORS.tx} strokeDasharray="4 4" />
    {result.taps.map((tap, i) => { const x = xAt(tap.delay), y = 118 - tap.gain * 65; return <g key={i}><path d={`M ${x} 118 L ${x} ${y}`} stroke={tap.delay - firstDelay > result.config.cp ? '#c66643' : COLORS.tx} strokeWidth="3" /><circle cx={x} cy={y} r="4" fill={tap.delay - firstDelay > result.config.cp ? '#c66643' : COLORS.tx} /><text x={x + 5} y={y - 8} className="svg-small">{tap.gain.toFixed(2)}</text></g>; })}
    {[0, 1, 2, 3, 4].map(i => <text key={i} x={xAt(i * domain / 4)} y="139" textAnchor="middle" className="svg-small">{i * domain / 4}</text>)}<text x="535" y="153" textAnchor="end" className="svg-small">DELAY (SAMPLES)</text>
  </svg>;
}
export function StageView({ stage, result, selection, select, selectSymbol, playing, update }: {
  stage: number; result: SimulationResult; selection: Selection; select: (s: Selection) => void; selectSymbol: (index: number) => void; playing: boolean;
  update: (patch: Partial<Config>) => void;
}) {
  const [constellationMode, setConstellationMode] = useState<'rx' | 'equalized' | 'both'>('rx');
  const [ofdmMode, setOfdmMode] = useState<'combined' | 'subcarriers'>('combined');
  const [responseMode, setResponseMode] = useState<'magnitude' | 'phase'>('magnitude');
  const { config } = result;
  const slot = Math.min(selection.slot, result.slots - 1), l = Math.min(selection.l, result.symbolsPerSlot - 1), k = selection.k;
  const grid = result.cells[slot], cell = grid[l * 12 + k];
  const selectedIndex = cell.symbolIndex ?? result.symbols.findIndex(s => s.slot === slot && s.l === l);
  const safeIndex = Math.max(0, selectedIndex), record = result.symbols[safeIndex];
  const m = BITS_PER_SYMBOL[config.modulation];
  const start = (slot * result.symbolsPerSlot + l) * (64 + config.cp);
  const tx = result.txSamples.slice(start, start + 64 + config.cp), rx = result.rxSamples.slice(start, start + 64 + config.cp);
  const spill = result.synchronization.safeOffsetStart > result.synchronization.safeOffsetEnd;
  const response = (value: { re: number; im: number }) => responseMode === 'magnitude' ? 10 * Math.log10(Math.max(1e-12, power(value))) : Math.atan2(value.im, value.re) * 180 / Math.PI;
  const renderResponse = () => <Panel eyebrow="READING THE CHANNEL" title="What happened to each frequency?" badge={<Segmented label="Channel response display" value={responseMode} options={[{ value: 'magnitude', label: 'Magnitude' }, { value: 'phase', label: 'Phase' }]} onChange={setResponseMode} />}>
    <LinePlot series={[{ label: 'True channel', color: COLORS.tx, values: result.trueChannel.map(response) }, { label: 'Pilot estimate', color: COLORS.rx, values: Array.from({ length: 12 }, (_, n) => response(grid[l * 12 + n].estimate)), dashed: true }]}
      xLabel="SUBCARRIER (kHz, DC OMITTED)" yLabel={responseMode === 'magnitude' ? 'MAGNITUDE (dB)' : 'PHASE (°)'} xTicks={FREQUENCIES.map(String)} height={210} />
    <p className="plot-note">The receiver knows the pilots. The true channel uses nominal transmit timing and is shown only for comparison. {result.synchronization.timingError !== 0 && 'The pilot estimate also includes the phase slope from the shifted FFT window.'}</p>
  </Panel>;

  if (stage === 0) return <div className="stage-stack"><Panel eyebrow="FROM CHARACTERS TO A CODEWORD" title="A message with a little insurance" badge={`${result.payload.length} payload bits`}>
    <div className="coding-flow">{[['Payload', result.payload.length], [`CRC-${config.crc || 'off'}`, result.transport.length - result.payload.length], [config.coding === 'none' ? 'Uncoded' : config.coding === 'hamming' ? 'Hamming (7,4)' : 'Convolutional', result.coded.length], ['On the grid', result.scrambled.length]].map(([label, value], i) => <div className="coding-flow-item" key={label}><strong>{value}<small>bits</small></strong><span>{label}</span>{i < 3 && <ArrowRight size={15} />}</div>)}</div>
    <BitStrip bits={result.payload} label="01 · Original payload" /><BitStrip bits={result.transport} label="02 · Payload + checksum" /><BitStrip bits={result.coded} label="03 · Encoded codeword" start={safeIndex * m} length={m} />
    <BitStrip bits={result.scrambled} label="04 · Scrambled & padded, ready to map" start={safeIndex * m} length={m} color="purple" />
    <p className="plot-note">{result.codingPadding} coding padding/tail bits · {result.resourcePadding} resource padding bits · {result.slots} {result.slots === 1 ? 'slot' : 'slots'}. Padding is removed during recovery.</p>
  </Panel><div className="insight"><Sparkles size={19} /><div><strong>Detection and correction do different jobs.</strong><p>The checksum detects a damaged block. Error correction adds redundant bits that may repair it. Scrambling changes the pattern without changing the information.</p></div></div></div>;

  if (stage === 1) return <div className="stage-stack"><div className="visual-grid"><Panel eyebrow="BITS BECOME A POINT" title="The constellation" badge={config.modulation}><ConstellationPlot symbols={result.symbols} modulation={config.modulation} selected={safeIndex} mode="both" onSelect={selectSymbol} height={280} /></Panel>
    <Panel eyebrow="SELECTED SYMBOL" title="Split into I and Q" badge={`${m} ${m === 1 ? 'bit' : 'bits'} / symbol`}><IQDiagram bits={record.bits} cell={result.cells[record.slot][record.l * 12 + record.k]} /><div className="symbol-equation"><span>{record.bits.join('')}</span><ArrowRight size={16} /><ComplexValue value={record.tx} /></div><p className="plot-note">Gray coding keeps neighboring levels one bit apart. Click a constellation point or step through symbols to inspect it.</p></Panel></div>
    <div className="insight"><Info size={19} /><div><strong>More points mean more bits—and less room for noise.</strong><p>{config.modulation} carries {m} {m === 1 ? 'bit' : 'bits'} per symbol. Try a higher-order constellation, then lower SNR to see received points drift into neighboring decisions.</p></div></div>
  </div>;

  if (stage === 2) return <div className="stage-stack"><Panel eyebrow="FREQUENCY × TIME" title="A resource grid, one slot at a time" badge={`${result.dataPerSlot} data REs in first slot`}>
    <div className="resource-layout"><div className="resource-map"><div className="resource-grid" style={{ gridTemplateColumns: `44px repeat(${result.symbolsPerSlot}, minmax(20px, 1fr))` }}><div className="resource-axis">kHz ↑</div>{Array.from({ length: result.symbolsPerSlot }, (_, n) => <div key={`head${n}`} className="resource-axis">l={n}</div>)}
      {Array.from({ length: 12 }, (_, n) => 11 - n).map(row => <ResourceRow key={row} k={row} result={result} slot={slot} selection={{ slot, l, k }} select={select} />)}
    </div><div className="resource-time-label">OFDM SYMBOL → TIME</div></div><div className="resource-inspector"><span className="eyebrow">SELECTED ELEMENT</span><span className={`role-tag role-${cell.role}`}>{cell.role.toUpperCase()}</span><dl><div><dt>Slot</dt><dd>{slot}</dd></div><div><dt>Symbol / subcarrier</dt><dd>l={l} / k={k}</dd></div><div><dt>Frequency</dt><dd>{FREQUENCIES[k]} kHz</dd></div><div><dt>FFT bin</dt><dd>{ACTIVE_BINS[k]}</dd></div></dl><span className="eyebrow">TRANSMITTED VALUE</span><ComplexValue value={cell.tx} />{cell.symbolIndex !== null && <><span className="eyebrow">SCRAMBLED SYMBOL BITS</span><code>{result.symbols[cell.symbolIndex].bits.join('')}</code></>}</div></div>
    <div className="plot-legend resource-legend">{['data', 'pilot', 'control', 'pss', 'sss'].map(role => <span key={role}><i className={`role-${role}`} />{role === 'pilot' ? 'CRS pilot' : role.toUpperCase()}</span>)}</div>
  </Panel><Panel eyebrow="THE FULL FFT" title="Room around the active subcarriers" badge="64 bins"><div className="fft-bins">{Array.from({ length: 64 }, (_, bin) => <button key={bin} className={bin === 0 ? 'dc-bin' : ACTIVE_BINS.includes(bin) ? 'active-bin' : ''} title={`FFT bin ${bin}: ${bin === 0 ? 'DC null' : ACTIVE_BINS.includes(bin) ? 'active' : 'guard null'}`} aria-label={`FFT bin ${bin}, ${bin === 0 ? 'DC null' : ACTIVE_BINS.includes(bin) ? 'active subcarrier' : 'guard null'}`} disabled={!ACTIVE_BINS.includes(bin)} onClick={() => select({ slot, l, k: ACTIVE_BINS.indexOf(bin) })}>{bin % 8 === 0 ? bin : ''}</button>)}</div><p className="plot-note">12 active bins · 1 DC null · 51 guard nulls. Null bins stay zero in the frequency domain.</p></Panel></div>;

  if (stage === 3) {
    const traces = grid.filter(v => v.l === l).map((v, index) => ({ label: `${FREQUENCIES[v.k]} kHz`, color: ['#168267', '#a0bb83', '#8b6cce', '#ec9252', '#789ca4', '#c0a773'][index % 6], values: Array.from({ length: 64 }, (_, n) => {
      const w = polar(1 / 8, 2 * Math.PI * ACTIVE_BINS[v.k] * n / 64);
      return v.tx.re * w.re - v.tx.im * w.im;
    }) }));
    return <div className="stage-stack"><Panel eyebrow="BUILDING THE WAVEFORM" title="The sum of all subcarriers" badge={<Segmented label="OFDM waveform display" value={ofdmMode} options={[{ value: 'combined', label: 'Combined' }, { value: 'subcarriers', label: 'Subcarriers' }]} onChange={setOfdmMode} />}>
      <LinePlot series={ofdmMode === 'combined' ? [{ label: 'I · real part', color: COLORS.tx, values: tx.map(v => v.re) }, { label: 'Q · imaginary part', color: COLORS.rx, values: tx.map(v => v.im) }] : traces}
        region={ofdmMode === 'combined' ? { start: 0, end: config.cp, label: 'CYCLIC PREFIX' } : undefined} height={230} />
      <div className="prefix-ribbon"><span>Copied tail</span><div className="prefix-block" style={{ flex: config.cp }}>CP · {config.cp}</div><div className="fft-block" style={{ flex: 64 }}>FFT window · 64 samples</div><span>{((64 + config.cp) / SAMPLE_RATE * 1e6).toFixed(1)} μs</span></div>
      <p className="plot-note">For the combined view, the first {config.cp} samples are an exact copy of the final {config.cp} useful samples.</p>
    </Panel><div className="visual-grid"><Panel eyebrow="POWER ENVELOPE" title="When waves line up" badge={`${result.papr.toFixed(2)} dB PAPR`}><LinePlot series={[{ label: 'Instantaneous power', color: COLORS.tx, values: tx.map(power) }]} yLabel="POWER" height={180} /><p className="plot-note">PAPR above uses the complete transmission. This plot shows the selected symbol.</p></Panel><Panel eyebrow="ECHOES VS. GUARD TIME" title="Does the prefix cover the channel?" badge={spill ? 'Spread exceeds prefix' : 'Spread fits prefix'}><TapDiagram result={result} /><p className={`plot-note ${spill ? 'warning-text' : ''}`}>{spill ? 'The delay spread exceeds the prefix. No timing choice can fully prevent neighboring symbols from interfering.' : 'The echo spread fits within the prefix. Receiver timing must also place the FFT window inside the protected region.'}</p></Panel></div></div>;
  }

  if (stage === 4) return <div className="stage-stack"><AirDiagram result={result} playing={playing} /><div className="visual-grid"><Panel eyebrow="A WAVE THROUGH THE AIR" title="Before & after the channel" badge={`Symbol ${l} · slot ${slot}`}>
    <LinePlot series={[{ label: 'Transmitted I', color: COLORS.tx, values: tx.map(v => v.re) }, { label: 'Received I', color: COLORS.rx, values: rx.map(v => v.re) }]} region={{ start: 0, end: config.cp, label: 'PREFIX' }} height={220} />
    <p className="plot-note">Complex baseband, real component. Noise and echoes change these actual samples.</p></Panel>
    <Panel eyebrow="WHERE THE SYMBOLS LANDED" title="A constellation in motion" badge={<Segmented label="Constellation display" value={constellationMode} options={[{ value: 'rx', label: 'Received' }, { value: 'equalized', label: 'Equalized' }]} onChange={setConstellationMode} />}>
      <ConstellationPlot symbols={result.symbols} modulation={config.modulation} selected={safeIndex} mode={constellationMode} onSelect={selectSymbol} height={220} />
      <p className="plot-note">Outlined points are ideal. Each filled point is a transmitted data symbol after the channel.</p></Panel></div>
    <div className={`insight ${spill ? 'warning-insight' : ''}`}><Radio size={19} /><div><strong>{spill ? 'The echo spread outlasts the cyclic prefix.' : config.cfo !== 0 ? 'A frequency mismatch rotates the signal.' : config.snr < 8 && config.noise ? 'The noise is competing with your signal.' : 'Try making the air a little messier.'}</strong><p>{spill ? 'Compare the normal and extended prefixes. Turn off noise to isolate interference from late echoes.' : config.cfo !== 0 ? 'Enable frequency compensation to reverse the configured offset. Then inspect the received and equalized constellations.' : 'Lower SNR in the controls and watch the constellation spread. Then check whether the recovered message still matches.'}</p></div></div>
    <div className="visual-grid"><Panel eyebrow="THE CHANNEL IMPULSE RESPONSE" title="One signal, several paths" badge={`${result.taps.length} taps`}><TapDiagram result={result} /><div className="tap-values">{result.taps.map((tap, i) => <span key={i}>τ={tap.delay} · |α|={tap.gain.toFixed(2)} · φ={(tap.phase * 180 / Math.PI).toFixed(0)}°</span>)}</div></Panel>{renderResponse()}</div>
  </div>;

  if (stage === 5) return <div className="stage-stack"><TimingSynchronization result={result} selection={{ slot, l, k }} update={update} /><div className="visual-grid"><Panel eyebrow="UNDOING THE CHANNEL" title="Before & after equalization" badge={config.equalizer.toUpperCase()}><ConstellationPlot symbols={result.symbols} modulation={config.modulation} selected={safeIndex} mode="both" onSelect={selectSymbol} height={270} /><p className="plot-note">Orange selection line is the error vector from the ideal symbol to its equalized location.</p></Panel>{renderResponse()}</div>
    <Panel eyebrow="SELECTED RESOURCE ELEMENT" title="Follow the receiver’s arithmetic"><div className="receiver-arithmetic"><div><span>Received Y[k,l]</span><ComplexValue value={cell.rx} /></div><ArrowRight size={16} /><div><span>Estimated H[k,l]</span><ComplexValue value={cell.estimate} /></div><ArrowRight size={16} /><div><span>Equalized X̂[k,l]</span><ComplexValue value={cell.equalized} /></div></div><p className="plot-note">{config.equalizer === 'off' ? 'Equalization is disabled. Channel rotation and fading remain in the received symbols.' : config.equalizer === 'zf' ? 'ZF weight = H* / |H|². Small channel estimates can greatly amplify noise.' : 'MMSE weight = H* / (|H|² + σ²). Regularization limits noise amplification in deep fades.'}</p></Panel>
    <div className="insight"><Info size={19} /><div><strong>Pilots are clues, not perfect knowledge.</strong><p>The receiver estimates the channel between eight known pilot positions. A rapidly varying frequency response can leave errors even when noise is off.</p></div></div></div>;

  const confidence = result.symbols.flatMap(s => s.llrs).slice(0, result.coded.length);
  return <div className="stage-stack"><Panel eyebrow="BACK TO BITS" title="Confidence behind each decision" badge={config.decision === 'soft' ? 'Soft decisions' : 'Hard decisions'}>
    <div className="llr-legend"><span>← Confident 0</span><div /><span>Confident 1 →</span></div><div className="llr-grid">{confidence.slice(0, 160).map((value, i) => <span key={i} title={`Scrambled bit ${i}: LLR ${value.toFixed(2)}, favors ${value >= 0 ? '0' : '1'}`} style={{ background: value >= 0 ? `rgba(22,130,103,${0.12 + Math.min(Math.abs(value) / 12, 1) * 0.7})` : `rgba(139,108,206,${0.12 + Math.min(Math.abs(value) / 12, 1) * 0.7})` }}>{value >= 0 ? '0' : '1'}</span>)}</div>
    <p className="plot-note">First {Math.min(160, confidence.length)} codeword-bearing scrambled bits. Positive LLR favors 0; negative favors 1. Darker cells indicate higher confidence. Confidence is computed in both decision modes; only soft Viterbi uses its magnitude.</p>
    <BitStrip bits={result.recoveredCoded} label="Descrambled received codeword" start={safeIndex * m} length={m} /><BitStrip bits={result.recoveredTransport} label="Decoded transport block" />
  </Panel><div className="visual-grid"><Panel eyebrow="ERROR CORRECTION" title={config.coding === 'none' ? 'No redundant bits this time' : config.coding === 'hamming' ? 'The syndrome finds a suspect bit' : 'A path through the trellis'} badge={config.coding === 'hamming' ? `${result.correctedBlocks} corrections attempted` : config.decision}>
    <div className="decoder-illustration">{config.coding === 'convolutional' ? <TrellisDiagram /> : <div className="hamming-word">{(config.coding === 'hamming' ? ['p₁', 'p₂', 'd₁', 'p₃', 'd₂', 'd₃', 'd₄'] : ['d₁', 'd₂', 'd₃', 'd₄']).map((bit, i) => <span className={bit.startsWith('p') ? 'parity' : ''} key={i}>{bit}</span>)}</div>}</div>
    <p className="plot-note">{config.coding === 'hamming' ? 'A nonzero syndrome identifies a position to flip. Hamming corrects one error per seven-bit word; multiple errors may be miscorrected. The count reports attempts, not guaranteed repairs.' : config.coding === 'convolutional' ? 'The four-state Viterbi decoder finds the most likely bit sequence. Soft mode weighs confidence; hard mode counts bit mismatches. Diagram shows trellis structure, not the actual survivor path.' : 'Without forward error correction, every raw bit decision passes straight to checksum verification.'}</p>
  </Panel><Panel eyebrow="CHECKSUM VERIFICATION" title={result.crcPass === null ? 'No checksum attached' : result.crcPass ? 'The block passes its check' : 'This block needs another try'} badge={result.crcPass === true ? <Check size={16} /> : `CRC-${config.crc || 'off'}`}><div className={`crc-result ${result.crcPass === false ? 'failed' : ''}`}><strong>{result.crcPass === null ? 'NOT CHECKED' : result.crcPass ? 'PASS · ACK' : 'FAIL · NACK'}</strong><span>{result.crcPass === null ? 'Enable a checksum to detect block errors.' : result.crcPass ? 'Decoded transport-block remainder equals zero.' : 'A retransmission would be requested. HARQ is not simulated.'}</span></div><p className="plot-note">CRC validates a block but cannot prove it is error-free. Compare the decoded BER with the original bits to see the actual result.</p></Panel></div></div>;
}

function ResourceRow({ k, result, slot, selection, select }: { k: number; result: SimulationResult; slot: number; selection: Selection; select: (s: Selection) => void }) {
  return <><div className="resource-frequency">{FREQUENCIES[k] > 0 ? '+' : ''}{FREQUENCIES[k]}</div>{Array.from({ length: result.symbolsPerSlot }, (_, l) => {
    const cell = result.cells[slot][l * 12 + k];
    return <button className={`resource-cell role-${cell.role} ${selection.k === k && selection.l === l ? 'selected-cell' : ''}`} key={l} title={`k=${k}, l=${l}: ${cell.role}`}
      aria-label={`${cell.role}, subcarrier ${k}, symbol ${l}`} aria-pressed={selection.k === k && selection.l === l} onClick={() => select({ slot, l, k })}>{cell.role === 'pilot' ? 'R' : cell.role === 'control' ? 'C' : cell.role === 'pss' ? 'P' : cell.role === 'sss' ? 'S' : '·'}</button>;
  })}</>;
}
function TrellisDiagram() {
  return <svg viewBox="0 0 500 150" role="img" aria-label="Four-state convolutional decoder trellis structure"><g stroke="#d2dad0" fill="none">{Array.from({ length: 4 }, (_, t) => Array.from({ length: 4 }, (_, s) => [0, 1].map(bit => <path key={`${t}${s}${bit}`} d={`M ${40 + t * 100} ${20 + s * 34} L ${140 + t * 100} ${20 + (((s << 1) | bit) & 3) * 34}`} strokeDasharray={bit ? '4 4' : undefined} />)))}</g>{Array.from({ length: 5 }, (_, t) => Array.from({ length: 4 }, (_, s) => <g key={`${t}${s}`}><circle cx={40 + t * 100} cy={20 + s * 34} r="5" fill="#168267" />{t === 0 && <text x="23" y={24 + s * 34} textAnchor="end" className="svg-small">{s.toString(2).padStart(2, '0')}</text>}</g>))}</svg>;
}
