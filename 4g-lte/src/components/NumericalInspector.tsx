import { TableProperties } from 'lucide-react';
import type { SimulationResult } from '../sim/types';
import type { Selection } from './StageView';
import { ComplexValue } from './StageView';
import { power } from '../sim/math';
import { FREQUENCIES } from '../sim/types';

export function NumericalInspector({ result, selection }: { result: SimulationResult; selection: Selection }) {
  const { slot, l, k } = selection;
  const cell = result.cells[slot][l * 12 + k];
  const symbol = cell.symbolIndex === null ? null : result.symbols[cell.symbolIndex];
  const offset = (slot * result.symbolsPerSlot + l) * (64 + result.config.cp);
  return <details className="numerical-inspector"><summary><TableProperties size={13} />Inspect numerical values<span>Slot {slot + 1} · l={l} · k={k}</span></summary>
    <div className="numerical-content"><div className="numerical-symbol"><h3>Selected {cell.role} element · {FREQUENCIES[k]} kHz</h3><dl><div><dt>Transmitted</dt><dd><ComplexValue value={cell.tx} /></dd></div><div><dt>Received after FFT</dt><dd><ComplexValue value={cell.rx} /></dd></div><div><dt>Estimated channel</dt><dd><ComplexValue value={cell.estimate} /></dd></div><div><dt>Equalized</dt><dd><ComplexValue value={cell.equalized} /></dd></div>
      {symbol && <><div><dt>Scrambled symbol bits</dt><dd><code>{symbol.bits.join('')}</code></dd></div><div><dt>Hard bit decisions</dt><dd><code>{symbol.recoveredBits.join('')}</code></dd></div><div><dt>LLRs (+ means 0)</dt><dd><code>{symbol.llrs.map(v => v.toFixed(2)).join(', ')}</code></dd></div></>}
    </dl></div><h3>Selected OFDM symbol · complex baseband samples</h3><p>The first {result.config.cp} transmitted samples form the cyclic prefix. RX values align to the actual arrival and include all channel effects before CFO compensation. The receiver’s FFT uses capture sample {result.synchronization.usedOffset + offset + result.config.cp}; inspect Receiver to compare timing.</p><div className="numeric-table-scroll" tabIndex={0} role="region" aria-label="Waveform sample values"><table><caption className="sr-only">Transmit and receive samples for OFDM symbol {l}, slot {slot + 1}</caption><thead><tr><th scope="col">Sample</th><th scope="col">Region</th><th scope="col">TX I</th><th scope="col">TX Q</th><th scope="col">RX I</th><th scope="col">RX Q</th><th scope="col">TX power</th></tr></thead><tbody>{result.txSamples.slice(offset, offset + 64 + result.config.cp).map((tx, n) => {
      const rx = result.rxSamples[offset + n];
      return <tr key={n}><th scope="row">{n}</th><td>{n < result.config.cp ? 'CP' : 'FFT'}</td><td>{tx.re.toFixed(4)}</td><td>{tx.im.toFixed(4)}</td><td>{rx.re.toFixed(4)}</td><td>{rx.im.toFixed(4)}</td><td>{power(tx).toFixed(4)}</td></tr>;
    })}</tbody></table></div>
    <h3>Channel response at each active subcarrier</h3><div className="numeric-table-scroll" tabIndex={0} role="region" aria-label="Channel response values"><table><thead><tr><th scope="col">k</th><th scope="col">kHz</th><th scope="col">True I</th><th scope="col">True Q</th><th scope="col">Estimated I</th><th scope="col">Estimated Q</th></tr></thead><tbody>{result.trueChannel.map((value, n) => <tr key={n}><th scope="row">{n}</th><td>{FREQUENCIES[n]}</td><td>{value.re.toFixed(4)}</td><td>{value.im.toFixed(4)}</td><td>{result.cells[slot][l * 12 + n].estimate.re.toFixed(4)}</td><td>{result.cells[slot][l * 12 + n].estimate.im.toFixed(4)}</td></tr>)}</tbody></table></div></div>
  </details>;
}
