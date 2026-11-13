import { ChevronDown, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { BITS_PER_SYMBOL, type Config, type Tap } from '../sim/types';
import { profileTaps } from '../sim/simulate';

export function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  return <div className="segmented" role="group" aria-label={label}>{options.map(option => <button type="button" key={option.value}
    aria-pressed={value === option.value} className={value === option.value ? 'selected' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
export function SelectField({ label, children, value, onChange }: { label: string; children: ReactNode; value: string | number; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><div className="select-wrap"><select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select><ChevronDown size={14} /></div></label>;
}
export function RangeField({ label, value, min, max, step = 1, unit = '', onChange, endpoints }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void; endpoints?: [string, string];
}) {
  return <label className="range-field"><span className="range-title"><span>{label}</span><strong>{value.toFixed(step < 1 ? 2 : 0)}<small>{unit}</small></strong></span>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
      style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} />
    {endpoints && <span className="range-endpoints"><span>{endpoints[0]}</span><span>{endpoints[1]}</span></span>}</label>;
}
export function Controls({ config, update }: { config: Config; update: (patch: Partial<Config>) => void }) {
  function updateTap(index: number, patch: Partial<Tap>) {
    update({ taps: config.taps.map((tap, i) => i === index ? { ...tap, ...patch } : tap) });
  }
  return <aside className="controls" aria-label="Simulation controls">
    <div className="controls-heading"><SlidersHorizontal size={16} /><span>Make it your experiment</span></div>
    <section className="control-section">
      <div className="section-label"><span className="section-number">01</span>YOUR MESSAGE</div>
      <Segmented label="Source mode" value={config.sourceMode} options={[{ value: 'ascii', label: 'Text' }, { value: 'binary', label: 'Binary' }]} onChange={sourceMode => update({ sourceMode, source: sourceMode === 'ascii' ? 'HELLO 4G' : '01001000 01001001' })} />
      <label className="sr-only" htmlFor="message">Message to transmit</label>
      <textarea id="message" value={config.source} spellCheck={false} onChange={e => update({ source: e.target.value })} rows={2} />
      <div className="input-meta"><span>{config.sourceMode === 'ascii' ? `${config.source.length} / 128 characters` : `${config.source.replace(/\s/g, '').length} / 1,024 bits`}</span><span>ASCII → BITS</span></div>
      <SelectField label="Modulation" value={config.modulation} onChange={value => update({ modulation: value as Config['modulation'] })}>
        {Object.entries(BITS_PER_SYMBOL).map(([name, bits]) => <option key={name} value={name}>{name} · {bits} {bits === 1 ? 'bit' : 'bits'}/symbol</option>)}
      </SelectField>
      <details className="advanced-controls"><summary>Coding & resource mapping<ChevronDown size={13} /></summary><div className="details-content">
        <SelectField label="Error correction" value={config.coding} onChange={coding => update({ coding: coding as Config['coding'] })}>
          <option value="none">Uncoded · rate 1</option><option value="hamming">Hamming (7,4) · rate 4/7</option><option value="convolutional">Convolutional · rate 1/2</option>
        </SelectField>
        <SelectField label="Checksum" value={config.crc} onChange={crc => update({ crc: Number(crc) as Config['crc'] })}><option value="0">None</option><option value="8">CRC-8</option><option value="16">CRC-16</option></SelectField>
        <SelectField label="Control columns (CFI)" value={config.cfi} onChange={cfi => update({ cfi: Number(cfi) as Config['cfi'] })}><option value="0">0 · data + pilots</option><option value="1">1 control column</option><option value="2">2 control columns</option></SelectField>
        <SelectField label="Synchronization" value={config.sync} onChange={sync => update({ sync: sync as Config['sync'] })}><option value="off">Off</option><option value="0">Start at slot 0</option><option value="10">Start at slot 10</option></SelectField>
        <label className="field"><span>Scrambling seed (c_init)</span><input type="number" min={0} max={2147483647} value={config.goldSeed} onChange={e => { const value = e.target.valueAsNumber; if (Number.isInteger(value) && value >= 0 && value <= 2147483647) update({ goldSeed: value }); }} /></label>
      </div></details>
    </section>
    <section className="control-section">
      <div className="section-label"><span className="section-number">02</span>THE WIRELESS CHANNEL</div>
      <RangeField label="Signal-to-noise ratio" value={config.snr} min={-10} max={40} unit=" dB" onChange={snr => update({ snr })} endpoints={['MORE NOISE', 'CLEARER SIGNAL']} />
      <label className="check-field"><input type="checkbox" checked={config.noise} onChange={e => update({ noise: e.target.checked })} />Add noise to the signal</label>
      <span className="field-label">Channel environment</span>
      <div className="profile-options" role="group" aria-label="Channel environment">{[
        ['awgn', 'Clear path', 'Noise only'], ['epa', 'Pedestrian', 'Gentle echoes'], ['etu', 'Urban', 'Strong echoes'], ['custom', 'Custom', 'Your own taps'],
      ].map(([value, title, description]) => <button key={value} className={config.profile === value ? 'selected' : ''} aria-pressed={config.profile === value}
        onClick={() => update({ profile: value as Config['profile'], ...(value === 'custom' ? { taps: profileTaps(config) } : {}) })}><span className="radio-dot" /><span><strong>{title}</strong><small>{description}</small></span></button>)}</div>
      {config.profile === 'custom' && <div className="tap-editor"><div className="field-label">Channel taps <span>{config.taps.length}/6</span></div>
        {config.taps.map((tap, i) => <div className="tap-control" key={i}><div className="tap-title"><strong>Path {i + 1}</strong><button className="icon-button" aria-label={`Remove path ${i + 1}`} disabled={config.taps.length === 1} onClick={() => update({ taps: config.taps.filter((_, n) => n !== i) })}><Trash2 size={13} /></button></div>
          <RangeField label="Delay" value={tap.delay} min={0} max={28} unit=" samples" onChange={delay => updateTap(i, { delay })} />
          <RangeField label="Gain" value={tap.gain} min={0} max={1} step={0.05} onChange={gain => updateTap(i, { gain })} />
          <RangeField label="Phase" value={Math.round(tap.phase * 180 / Math.PI)} min={-180} max={180} unit="°" onChange={phase => updateTap(i, { phase: phase * Math.PI / 180 })} />
        </div>)}
        <button className="text-button" disabled={config.taps.length >= 6} onClick={() => update({ taps: [...config.taps, { delay: 10, gain: 0.5, phase: 0 }] })}><Plus size={13} />Add a path</button>
      </div>}
      <RangeField label="Frequency offset" value={config.cfo} min={-0.5} max={0.5} step={0.01} unit=" × Δf" onChange={cfo => update({ cfo })} />
      <p className="control-hint">{(config.cfo * 15000).toFixed(0)} Hz oscillator mismatch</p>
    </section>
    <section className="control-section">
      <div className="section-label"><span className="section-number">03</span>HELP THE RECEIVER</div>
      <span className="field-label">Cyclic prefix</span>
      <Segmented label="Cyclic prefix" value={config.cp} options={[{ value: 16, label: 'Normal · 16' }, { value: 32, label: 'Extended · 32' }]} onChange={cp => update({ cp })} />
      <span className="field-label spaced">Equalizer</span>
      <Segmented label="Equalizer" value={config.equalizer} options={[{ value: 'off', label: 'Off' }, { value: 'zf', label: 'ZF' }, { value: 'mmse', label: 'MMSE' }]} onChange={equalizer => update({ equalizer })} />
      <div className="receiver-timing-controls">
        <SelectField label="Timing synchronization" value={config.timingMode} onChange={timingMode => update({ timingMode: timingMode as Config['timingMode'] })}>
          <option value="ideal">Ideal · known arrival time</option><option value="manual">Manual · choose CP start</option><option value="cp">Auto · CP correlation</option>
        </SelectField>
        <RangeField label="Signal arrival delay" value={config.arrivalOffset} min={0} max={63} unit=" samples" onChange={arrivalOffset => update({ arrivalOffset })} />
        {config.timingMode === 'manual' && <RangeField label="Manual CP start" value={config.manualOffset} min={0} max={95} unit=" samples" onChange={manualOffset => update({ manualOffset })} />}
        <p className="control-hint">Receiver view shows how the prefix helps locate a delayed signal.</p>
      </div>
      <label className="check-field"><input type="checkbox" checked={config.compensateCfo} onChange={e => update({ compensateCfo: e.target.checked })} />Compensate frequency offset</label>
      {config.compensateCfo && <SelectField label="Frequency correction source" value={config.cfoSource} onChange={cfoSource => update({ cfoSource: cfoSource as Config['cfoSource'] })}><option value="known">Known offset · ideal correction</option><option value="cp">CP estimate · measured correction</option></SelectField>}
      <SelectField label="Demapping decision" value={config.decision} onChange={decision => update({ decision: decision as Config['decision'] })}><option value="hard">Hard · nearest symbol</option><option value="soft">Soft · bit confidence</option></SelectField>
      <details className="advanced-controls"><summary>Repeatability<ChevronDown size={13} /></summary><div className="details-content"><label className="field"><span>Noise seed</span><input type="number" min={0} max={4294967295} value={config.seed} onChange={e => { const seed = e.target.valueAsNumber; if (Number.isInteger(seed) && seed >= 0 && seed <= 4294967295) update({ seed }); }} /></label><p className="control-hint">The same seed repeats the same noise. Change a setting to compare one effect at a time.</p></div></details>
    </section>
    <div className="model-caption">A small model of a big idea.<br /><span>64-point FFT · 12 subcarriers · 15 kHz spacing</span></div>
  </aside>;
}
