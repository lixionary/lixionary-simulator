import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, FlaskConical, Pause, Play, Radio, RefreshCw, RotateCcw, Sparkles, X } from 'lucide-react';
import { Controls } from './components/Controls';
import { NumericalInspector } from './components/NumericalInspector';
import { Panel, StageView, STAGES, type Selection } from './components/StageView';
import { EXPERIMENTS } from './experiments';
import { DEFAULT_CONFIG, type Config, type SimulationResult } from './sim/types';

function useSimulation(config: Config) {
  const worker = useRef<Worker | null>(null), request = useRef(0);
  const [result, setResult] = useState<SimulationResult | null>(null), [error, setError] = useState(''), [pending, setPending] = useState(true);
  useEffect(() => {
    const instance = new Worker(new URL('./sim/worker.ts', import.meta.url), { type: 'module' });
    worker.current = instance;
    instance.onmessage = event => {
      if (event.data.id !== request.current) return;
      setPending(false); setError(event.data.error ?? '');
      if (event.data.result) setResult(event.data.result);
    };
    instance.onerror = () => { setPending(false); setError('The simulation worker could not start. Reload the page to try again.'); };
    return () => { instance.terminate(); worker.current = null; };
  }, []);
  useEffect(() => {
    const id = ++request.current;
    setPending(true);
    const timer = window.setTimeout(() => worker.current?.postMessage({ id, config }), 70);
    return () => window.clearTimeout(timer);
  }, [config]);
  return { result, error, pending };
}

export default function App() {
  const [config, setConfig] = useState<Config>({ ...DEFAULT_CONFIG });
  const [stage, setStage] = useState(4), [tab, setTab] = useState<'playground' | 'experiments' | 'about'>('playground');
  const [selection, setSelection] = useState<Selection>({ slot: 0, l: 0, k: 1 });
  const [playing, setPlaying] = useState(false), [experiment, setExperiment] = useState<number | null>(null);
  const recoveredRef = useRef<HTMLElement | null>(null);
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const { result, error, pending } = useSimulation(config);
  const update = (patch: Partial<Config>) => { setPlaying(false); setConfig(current => ({ ...current, ...patch })); };
  const baseSelection = result ? { slot: Math.min(selection.slot, result.slots - 1), l: Math.min(selection.l, result.symbolsPerSlot - 1), k: selection.k } : selection;
  const baseCell = result?.cells[baseSelection.slot]?.[baseSelection.l * 12 + baseSelection.k];
  const fallback = [0, 1, 6].includes(stage) && baseCell?.symbolIndex === null
    ? result?.symbols.find(s => s.slot === baseSelection.slot && s.l === baseSelection.l)
      ?? result?.symbols.find(s => s.slot === baseSelection.slot) ?? result?.symbols[0]
    : null;
  const safeSelection = fallback ? { slot: fallback.slot, l: fallback.l, k: fallback.k } : baseSelection;
  const cell = result?.cells[safeSelection.slot]?.[safeSelection.l * (12) + safeSelection.k];
  const selectedIndex = cell?.symbolIndex ?? result?.symbols.findIndex(s => s.slot === safeSelection.slot && s.l === safeSelection.l) ?? 0;
  function selectSymbol(index: number) {
    if (!result) return;
    const symbol = result.symbols[(index + result.symbols.length) % result.symbols.length];
    setSelection({ slot: symbol.slot, l: symbol.l, k: symbol.k });
  }
  useEffect(() => {
    if (!playing || !result) return;
    const timer = window.setInterval(() => {
      setSelection(current => {
        const index = result.symbols.findIndex(s => s.slot === current.slot && s.l === current.l && s.k === current.k);
        const next = result.symbols[(index + 1) % result.symbols.length];
        return { slot: next.slot, l: next.l, k: next.k };
      });
    }, 850);
    return () => clearInterval(timer);
  }, [playing, result]);
  useEffect(() => {
    if (!recoveredRef.current || tab !== 'playground' || error) return;
    const observer = new IntersectionObserver(([entry]) => setRecoveryVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(recoveredRef.current);
    return () => observer.disconnect();
  }, [result, tab, error]);
  function openExperiment(index: number) {
    setPlaying(false); setExperiment(index); setStage(EXPERIMENTS[index].stage);
    setConfig({ ...DEFAULT_CONFIG, source: config.source, sourceMode: config.sourceMode, seed: config.seed, ...EXPERIMENTS[index].config });
    setSelection({ slot: 0, l: 0, k: 1 }); setTab('playground');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function reset() { setConfig({ ...DEFAULT_CONFIG }); setSelection({ slot: 0, l: 0, k: 1 }); setPlaying(false); setExperiment(null); setStage(4); }
  const crcState = result?.crcPass === null ? 'unchecked' : result?.crcPass ? 'passed' : 'failed';
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="#" onClick={e => { e.preventDefault(); setTab('playground'); }} aria-label="Signal Lab home"><span className="brand-mark"><Activity size={23} strokeWidth={1.8} /></span><span>signal<span className="brand-light">lab</span><span className="brand-dot">.</span></span></a>
      <nav className="main-nav" aria-label="Main navigation"><button className={tab === 'playground' ? 'active' : ''} onClick={() => setTab('playground')}>Playground</button><button className={tab === 'experiments' ? 'active' : ''} onClick={() => setTab('experiments')}>Experiments<span className="nav-count">{EXPERIMENTS.length}</span></button><button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>How it works</button></nav>
      <div className="header-end"><a href="/" className="text-button" aria-label="All simulators">All simulators</a><span className="header-tag">LEARN BY MAKING WAVES</span><button className="help-button" onClick={() => setTab('about')} aria-label="About the simulation"><CircleHelp size={18} /></button></div>
    </header>
    <main>
      {tab === 'playground' && <>
        <section className="hero"><div><div className="hero-eyebrow"><span /><span>AN INTERACTIVE 4G EXPLORER</span></div><h1>A message. A wave.<br />A little <em>interference.</em></h1><p>Follow your message through the air. Change the conditions.<br className="desktop-break" /> See what makes it through—and what gets lost.</p></div><div className="hero-aside"><span className="hero-sketch" aria-hidden="true"><svg viewBox="0 0 190 60"><path d="M0 30 Q10 30 15 30 Q20 2 28 30 Q36 58 44 30 Q52 -2 60 30 Q68 62 76 30 Q84 -8 92 30 Q100 68 108 30 Q116 6 124 30 Q132 54 140 30 Q148 20 156 30 L190 30" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></span><span>Small experiments.<br />Big <span className="underlined">aha</span> moments.</span><button className="text-button" onClick={() => setTab('experiments')}>Start with an experiment <ArrowRight size={14} /></button></div></section>
        {experiment !== null && <section className="experiment-banner" aria-label="Active guided experiment"><div className="experiment-banner-icon"><FlaskConical size={19} /></div><div><span className="eyebrow">GUIDED EXPERIMENT {experiment + 1} / {EXPERIMENTS.length}</span><h2>{EXPERIMENTS[experiment].title}</h2><p><strong>Try this:</strong> {EXPERIMENTS[experiment].task}</p><p className="experiment-observe"><strong>Look for:</strong> {EXPERIMENTS[experiment].observe}</p></div><div className="experiment-banner-actions"><button className="text-button" onClick={() => openExperiment((experiment + 1) % EXPERIMENTS.length)}>Next <ArrowRight size={14} /></button><button className="icon-button" aria-label="Close experiment guidance" onClick={() => setExperiment(null)}><X size={17} /></button></div></section>}
        <div className="pipeline" role="group" aria-label="Signal-processing stages">{STAGES.map((item, index) => <button key={item.label} className={`pipeline-stage ${index === stage ? 'active' : ''} ${index === 4 ? 'channel-stage' : ''}`} aria-label={item.label} aria-pressed={index === stage} onClick={() => { setStage(index); if ([0, 1, 6].includes(index) && cell?.symbolIndex === null) selectSymbol(Math.max(0, selectedIndex)); }}><span className="stage-index">{index === 4 ? <Radio size={15} /> : String(index + 1).padStart(2, '0')}</span><span>{item.label}</span>{index < STAGES.length - 1 && <ChevronRight className="stage-arrow" size={13} />}</button>)}</div>
        <div className="lab-layout"><Controls config={config} update={update} /><div className="lab-content">
          <div className="lab-toolbar"><div className="live-indicator"><span className={pending ? 'pending-dot' : error ? 'error-dot' : ''} />{pending ? 'Computing transmission' : error ? 'Check your input' : 'Live simulation'}</div><div className="toolbar-actions"><button onClick={() => update({ seed: (config.seed + 1) >>> 0 })} title="Keep settings and generate a different noise realization"><RefreshCw size={13} />New noise</button><button onClick={reset}><RotateCcw size={13} />Reset</button></div></div>
          {error ? <div className="error-panel" role="alert"><InfoIcon /><h2>Let’s adjust that input.</h2><p>{error}</p><p className="muted">Your controls are still available on the left.</p></div> : !result ? <div className="loading-panel" role="status"><Activity size={30} /><p>Turning your message into a wave…</p></div> : <div className={pending ? 'simulation-content computing' : 'simulation-content'} aria-busy={pending}>
            <section className="stage-intro"><div className="stage-title-row"><span className="eyebrow">{String(stage + 1).padStart(2, '0')} / {STAGES[stage].label.toUpperCase()}</span><span className="teaching-badge">LTE teaching model</span></div><h2>{STAGES[stage].title}</h2><p>{STAGES[stage].description}</p><details className="technical-detail"><summary><BookOpen size={12} />A little more detail</summary><p>{STAGES[stage].detail}</p></details></section>
            <div className="inspection-bar"><div className="playback"><button className="icon-button" aria-label={playing ? 'Pause symbol animation' : 'Play symbol animation'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={14} /> : <Play size={14} />}</button><button className="icon-button" aria-label="Previous data symbol" onClick={() => { setPlaying(false); selectSymbol(Math.max(0, selectedIndex) - 1); }}><ChevronLeft size={15} /></button><button className="icon-button" aria-label="Next data symbol" onClick={() => { setPlaying(false); selectSymbol(Math.max(0, selectedIndex) + 1); }}><ChevronRight size={15} /></button><span>{cell?.role === 'data' ? `Data symbol ${Math.max(0, selectedIndex) + 1}` : `${cell?.role.toUpperCase()} element`}</span></div>
              <div className="inspection-coordinates"><label>Slot <select aria-label="Inspected slot" value={safeSelection.slot} onChange={e => { setPlaying(false); setSelection({ ...safeSelection, slot: Number(e.target.value) }); }}>{Array.from({ length: result.slots }, (_, slot) => <option key={slot} value={slot}>{slot + 1} / {result.slots}</option>)}</select></label><span>l={safeSelection.l} <span className="coordinate-divider">/</span> k={safeSelection.k}</span></div></div>
            <StageView stage={stage} result={result} selection={safeSelection} select={s => { setPlaying(false); setSelection(s); }} selectSymbol={i => { setPlaying(false); selectSymbol(i); }} playing={playing} update={update} />
            <NumericalInspector result={result} selection={safeSelection} />
            <section ref={recoveredRef} className="recovered-panel" aria-label="Recovered message"><div className="recovered-heading"><div><span className="eyebrow">AT THE OTHER END</span><h3>Your message, recovered.</h3></div><span className={`crc-badge ${crcState}`}><span />{result.crcPass === null ? 'CRC not checked' : result.crcPass ? 'CRC PASS' : 'CRC FAIL'}</span></div><div className="recovered-message" data-testid="recovered-message" aria-label={`Recovered ${result.config.sourceMode === 'ascii' ? 'message' : 'bits'}: ${result.decoded}`}>
              {[...result.decoded].map((char, i) => {
                const width = result.config.sourceMode === 'ascii' ? 8 : 1;
                const changed = result.payload.slice(i * width, i * width + width).some((b, j) => b !== result.recoveredPayload[i * width + j]);
                return <span key={i} className={changed ? 'errored-char' : ''} title={changed ? 'This character contains a bit error' : undefined}>{char === ' ' ? '\u00a0' : (char.charCodeAt(0) < 32 && char !== '\n') || char.charCodeAt(0) >= 127 ? '·' : char}</span>;
              })}
            </div><div className="recovered-footnote">{result.decodedErrors === 0 ? <><Check size={13} />All {result.payload.length} payload bits arrived intact.</> : <><span className="error-dot" />{result.decodedErrors} transport-block bits differ from the original.{result.crcPass === false && ' A retransmission would be requested.'}</>}</div>
            <div className="metrics"><Metric label="RAW CHANNEL BER" value={`${(result.rawBer * 100).toFixed(2)}%`} description={`${result.rawErrors} / ${result.coded.length} coded bits`} /><Metric label="DECODED BLOCK BER" value={`${(result.decodedBer * 100).toFixed(2)}%`} description={`${result.decodedErrors} / ${result.transport.length} transport bits`} /><Metric label="ERROR VECTOR · EVM" value={`${result.evm.toFixed(1)}%`} description="RMS symbol displacement" /><Metric label="PEAK / AVERAGE · PAPR" value={`${result.papr.toFixed(2)}`} unit="dB" description="Whole transmission" /></div></section>
            <div className="next-step"><span><Sparkles size={14} />One change can tell you a lot.</span><button className="text-button" onClick={() => setTab('experiments')}>Explore the experiments <ArrowRight size={14} /></button></div>
          </div>}
        </div></div>
      </>}
      {tab === 'experiments' && <section className="experiments-page"><div className="hero-eyebrow"><span /><span>SEVEN WAYS TO MAKE AN AHA MOMENT</span></div><h1>A little curiosity.<br /><em>A lot to discover.</em></h1><p className="page-description">Each experiment changes one part of the journey. Make a prediction,<br className="desktop-break" /> move a control, and see what your message tells you.</p><div className="experiment-cards">{EXPERIMENTS.map((item, i) => <button className="experiment-card" key={item.title} onClick={() => openExperiment(i)}><span className="eyebrow">{item.tag}</span><div className={`experiment-mini mini-${i}`} aria-hidden="true"><ExperimentArt index={i} /></div><h2>{item.title}</h2><p>{item.description}</p><span className="experiment-start">Try the experiment<ArrowRight size={16} /></span></button>)}</div><button className="text-button" onClick={() => setTab('playground')}><ArrowLeft size={14} />Back to your playground</button></section>}
      {tab === 'about' && <About onBack={() => setTab('playground')} />}
    </main>
    {tab === 'playground' && result && !error && !recoveryVisible && <div className={`live-recovery ${pending ? 'recovery-pending' : ''}`} aria-label="Live recovered data">
      <div className="live-recovery-message"><span className="eyebrow">{pending ? 'UPDATING…' : 'YOUR MESSAGE, ON THE OTHER SIDE'}</span><code>{[...result.decoded].slice(0, 48).map((char, i) => {
        const width = result.config.sourceMode === 'ascii' ? 8 : 1;
        const changed = result.payload.slice(i * width, i * width + width).some((b, j) => b !== result.recoveredPayload[i * width + j]);
        return <span key={i} className={changed ? 'live-error' : ''}>{char.charCodeAt(0) < 32 || char.charCodeAt(0) >= 127 ? '·' : char}</span>;
      })}{result.decoded.length > 48 && '…'}</code></div>
      <span className={`live-recovery-crc ${crcState}`}>{result.crcPass === null ? 'CRC OFF' : result.crcPass ? <><Check size={12} />Verified</> : 'CRC failed'}</span>
      <div className="live-recovery-ber"><strong>{(result.decodedBer * 100).toFixed(2)}%</strong><span>DECODED BER</span></div>
      <button className="icon-button" aria-label="Jump to decoded data" onClick={() => recoveredRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' })}><ArrowRight size={16} /></button>
    </div>}
    <footer className="site-footer"><div><span className="footer-brand">signal<span>lab.</span></span><span>A little lab for understanding the air.</span></div><button onClick={() => setTab('about')}>About the model <ArrowRight size={12} /></button><span className="footer-meta">4G LTE / OFDM EXPLORER</span></footer>
  </div>;
}

function InfoIcon() { return <CircleHelp size={24} />; }
function Metric({ label, value, unit, description }: { label: string; value: string; unit?: string; description: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{description}</p></div>;
}
function ExperimentArt({ index }: { index: number }) {
  if (index === 6) return <svg viewBox="0 0 320 120"><rect x="50" y="27" width="46" height="55" rx="5" fill="#dcebdd" /><rect x="220" y="27" width="46" height="55" rx="5" fill="#e9dff5" /><path d="M50 55 Q62 25 73 55 Q84 85 96 55 M220 55 Q232 25 243 55 Q254 85 266 55" fill="none" stroke="#168267" strokeWidth="2" /><path d="M73 90 H243" stroke="#b9cbb0" strokeDasharray="4 4" /><text x="158" y="108" textAnchor="middle" className="svg-label">64 SAMPLES APART</text><text x="73" y="18" textAnchor="middle" className="svg-label">CP</text><text x="243" y="18" textAnchor="middle" className="svg-label">TAIL</text></svg>;
  return <svg viewBox="0 0 320 120">{index === 0 || index === 1 ? <g>{Array.from({ length: index === 1 ? 64 : 38 }, (_, i) => <circle key={i} cx={index === 1 ? 75 + i % 8 * 24 : 90 + Math.sin(i * 6.3) * 20 + (i % 2) * 120} cy={index === 1 ? 17 + Math.floor(i / 8) * 12 : 45 + Math.cos(i * 3.4) * 25 + (i % 3) * 8} r={index === 1 ? 3 : 2.5} fill={i % 2 ? '#8b6cce' : '#168267'} opacity="0.7" />)}</g> : index === 2 ? <g fill="none" stroke="#168267" strokeWidth="2"><path d="M50 80 L160 20 L270 80 M50 80 L160 100 L270 80" strokeDasharray="4 5" /><path d="M50 80 L270 80" /><circle cx="50" cy="80" r="6" /><circle cx="270" cy="80" r="6" /></g> : index === 3 ? <g><rect x="40" y="32" width="65" height="50" rx="5" fill="#b6d9bc" /><rect x="110" y="32" width="168" height="50" rx="5" fill="#e1e8db" /><text x="72" y="63" textAnchor="middle" className="svg-bit">CP</text><text x="194" y="63" textAnchor="middle" className="svg-bit">OFDM</text><path d="M255 92 Q310 115 70 105 L70 88" fill="none" stroke="#8b6cce" strokeWidth="2" /></g> : index === 4 ? <g fill="none" strokeWidth="2"><circle cx="160" cy="60" r="39" stroke="#dae3d5" /><path d="M160 60 L186 31" stroke="#168267" /><path d="M160 60 L192 80" stroke="#8b6cce" /><path d="M192 37 Q214 53 202 73" stroke="#8b6cce" /><circle cx="160" cy="60" r="3" fill="#168267" /></g> : <g>{['1', '0', '1', 'p', '0', 'p', '1'].map((b, i) => <g key={i}><rect x={34 + i * 37} y="40" width="30" height="38" rx="5" fill={b === 'p' ? '#e9dff5' : '#dcebdd'} /><text x={49 + i * 37} y="65" textAnchor="middle" className="svg-bit">{b}</text></g>)}</g>}</svg>;
}
function About({ onBack }: { onBack: () => void }) {
  return <section className="about-page"><div className="hero-eyebrow"><span /><span>HOW THE LITTLE LAB WORKS</span></div><h1>Real signal processing.<br /><em>A smaller model.</em></h1><p className="page-description">Signal Lab follows a message through a computed transmitter, wireless channel,<br className="desktop-break" /> and receiver. Every chart is connected to the same set of samples.</p><div className="about-grid"><Panel eyebrow="START HERE" title="Learn by changing one thing"><ol className="about-steps"><li>Type a short message and watch it arrive.</li><li>Lower SNR. Inspect how the constellation spreads.</li><li>Choose an echo-filled channel and compare equalizers.</li><li>Inspect each stage to connect bits, symbols, and waveforms.</li></ol><button className="primary-button" onClick={onBack}>Open the playground<ArrowRight size={15} /></button></Panel><Panel eyebrow="THE BIG IDEA" title="Bits travel as a changing wave"><p>Modulation maps bits to complex symbols. OFDM combines many subcarriers into one waveform. Echoes, oscillator mismatch, and noise alter the samples.</p><p>The receiver uses pilot symbols to estimate those changes. It separates the subcarriers, decides which bits were sent, and applies error correction and a checksum.</p></Panel></div><div className="model-notes"><h2>What this model simplifies</h2><p>This is an LTE-inspired teaching simulator, rather than a standards-compliant LTE implementation. These choices make individual samples and resource elements easy to inspect:</p><dl><div><dt>Small transform and grid</dt><dd>64-point FFT, 12 active subcarriers, one DC null, and 51 guard nulls. The useful symbol is 66.67 μs at 15 kHz subcarrier spacing.</dd></div><div><dt>Prefix and timing</dt><dd>Normal: 16 samples (16.67 μs), seven symbols per teaching slot (583.33 μs). Extended: 32 samples (33.33 μs), six symbols (600 μs). These are teaching timings, not real LTE’s 0.5 ms slots.</dd></div><div><dt>Reference and control signals</dt><dd>Eight fixed unit pilots use the documented positions. Control elements carry deterministic QPSK metadata. PSS/SSS are short teaching subsets; synchronization and control-channel decoding are not implemented.</dd></div><div><dt>Channel profiles</dt><dd>EPA and ETU are the document’s reduced sample-delay models, with fixed tap phases. The channel is static; changing CFO illustrates oscillator mismatch or Doppler-related frequency offset.</dd></div><div><dt>Receiver knowledge</dt><dd>Framing, FFT length, prefix length, and scrambling seed are known. Ideal timing uses the configured arrival; CP timing estimates the boundary from received sample repetition. CFO compensation can use a known offset or a CP phase estimate. CP alone cannot identify frames or cells. Original bits and the true channel are used only for teaching comparisons and metrics.</dd></div><div><dt>Error correction and retransmission</dt><dd>Hamming and K=3 convolutional codes illustrate coding concepts. Full LTE uses other coding and rate-matching schemes. NACK describes a retransmission request; no HARQ or network stack is simulated.</dd></div><div><dt>Repeatable noise</dt><dd>The noise seed keeps experiments reproducible. “New noise” advances the seed while preserving settings. A single short transmission is one realization, so its BER is not a statistical guarantee.</dd></div></dl><p className="source-links">Further reading: <a href="https://www.etsi.org/deliver/etsi_ts/136200_136299/136211/15.08.01_60/ts_136211v150801p.pdf" target="_blank" rel="noreferrer">3GPP LTE physical channels and modulation<ArrowRight size={12} /></a><a href="https://www.mathworks.com/help/comm/ug/digital-baseband-modulation.html" target="_blank" rel="noreferrer">Modulation and soft-decision confidence<ArrowRight size={12} /></a></p></div><button className="text-button" onClick={onBack}><ArrowLeft size={14} />Back to the playground</button></section>;
}
