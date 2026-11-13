import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Cable, Check, ChevronLeft, ChevronRight, CircleHelp, Code2, Layers, Pause, Play, RotateCcw, ShieldCheck, Unplug, Zap } from 'lucide-react';
import { CLIENT, DEFAULTS, LAYERS, SERVER, crc32, hex, inspectReceived, read16, simulate, text, validateConfig, type Config, type Packet, type Step } from './model';
import { CODES, encodePhysical, wireBits, type Trace } from './physical';

const colorFor = (offset: number, p: Packet) => offset < 14 ? 'link' : offset < 34 ? 'network' : offset < 34 + (p.protocol === 'tcp' ? 20 : 8) ? 'transport' : offset < 14 + p.ip.length ? 'application' : offset < p.frame.length - 4 ? 'padding' : 'fcs';
const address = (bytes: number[]) => bytes.join('.');
const mac = (bytes: number[]) => bytes.map(b => hex(b)).join(':');
const packetName = (p: Packet) => p.direction === 'out' ? 'Client → Server' : 'Server → Client';
function Envelope({ packet, layer }: { packet: Packet; layer: number }) {
  const fields = [
    { name: 'Ethernet', size: 14, cls: 'link', at: 2 },
    { name: 'IPv4', size: 20, cls: 'network', at: 3 },
    { name: packet.protocol.toUpperCase(), size: packet.protocol === 'tcp' ? 20 : 8, cls: 'transport', at: 4 },
    { name: 'Application data', size: packet.payload.length, cls: 'application', at: 7 },
    ...(packet.padding ? [{ name: 'Pad', size: packet.padding, cls: 'padding', at: 2 }] : []),
    { name: 'FCS', size: 4, cls: 'fcs', at: 2 },
  ].filter(f => f.at >= layer || layer <= 2);
  return <div className="pl-envelope" aria-label="Encapsulation envelope">{fields.map(f => <div className={f.cls} key={f.name}><strong>{f.name}</strong><span>{f.size} bytes</span></div>)}</div>;
}
function Waveform({ trace, offset }: { trace: Trace; offset: number }) {
  const first = Math.max(0, trace.owners.indexOf(offset));
  const start = Math.max(0, first - 8), levels = trace.levels.slice(start, start + 96);
  const x = (i: number) => 42 + i * 7;
  const y = (level: number) => 70 - level * 30;
  const path = levels.map((level, i) => `${i === 0 ? 'M' : 'V'}${i === 0 ? x(i) + ' ' : ''}${y(level)}H${x(i + 1)}`).join(' ');
  return <div className="pl-wave-scroll" tabIndex={0} aria-label="Scrollable electrical signal"><svg className="pl-wave" viewBox="0 0 740 143" role="img" aria-label={`${trace.phy === '10base-t' ? 'Manchester' : 'MLT-3'} waveform for frame byte ${offset}`}>
    <rect x={x(first - start)} y="20" width={(trace.phy === '10base-t' ? 16 : 10) * 7} height="94" fill="#e4e9e1" />
    {[-1, 0, 1].map(v => <g key={v}><line x1="35" x2="720" y1={y(v)} y2={y(v)} stroke="#dedfd5" strokeDasharray="3 4"/><text x="14" y={y(v) + 4}>{v > 0 ? '+1' : v}</text></g>)}
    <path d={path} stroke="#547768" strokeWidth="2" fill="none"/>
    <text x="42" y="132">{start * trace.tickNs} ns</text><text x="600" y="132">{(start + levels.length) * trace.tickNs} ns</text>
  </svg></div>;
}
function Inspector({ packet, phy, layer, side, offset, setOffset }: { packet: Packet; phy: Config['phy']; layer: number; side: Step['side']; offset: number; setOffset: (n: number) => void }) {
  const [received, setReceived] = useState(false);
  const [tab, setTab] = useState<'fields' | 'bytes' | 'signal'>('fields');
  const trace = useMemo(() => encodePhysical(packet.frame, phy), [packet, phy]);
  const safeOffset = Math.min(offset, packet.frame.length - 1);
  const bytes = received ? packet.received : packet.frame;
  const checks = inspectReceived(packet.received);
  const crc = crc32(bytes.slice(0, -4));
  const wireCheck = Array.from(bytes.slice(-4)).map(b => hex(b)).join(' ');
  const bodyStart = 34 + (packet.protocol === 'tcp' ? 20 : 8);
  return <details className="pl-inspector">
    <summary><span><Code2 size={17}/> Packet & signal inspector</span><span className="pl-summary-hint">Fields, bytes & waveforms <ChevronRight size={15}/></span></summary>
    <div className="pl-inspector-body">
      <div className="pl-tabs" role="group" aria-label="Inspector view">{(['fields', 'bytes', 'signal'] as const).map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'fields' ? 'Packet fields' : t === 'bytes' ? 'Hex bytes' : 'Copper signal'}</button>)}</div>
      <p className="pl-hint">{packet.title} · {packetName(packet)} · complete frame, {packet.frame.length} bytes. Inspecting layer {layer}; {side === 'wire' ? 'crossing the link' : side + ' side'}.</p>
      {tab === 'fields' && <>
        <div className="pl-field-grid"><section><h4>Application · layers 7–5</h4><p>{packet.payload.length ? packet.protocol === 'tcp' ? 'HTTP text; response body is UTF-8. Request/response tracks the conversation.' : 'DNS binary message; transaction ID 0x1234; A (type 1), IN (class 1).' : 'TCP control packet: no application bytes.'}</p>{packet.payload.length > 0 && (packet.protocol === 'tcp' ? <pre>{text(packet.payload)}</pre> : <dl><dt>Question</dt><dd>One A query</dd><dt>Answers</dt><dd>{packet.direction === 'back' ? '1 · 192.0.2.42 · TTL 60 s' : '0'}</dd><dt>Name encoding</dt><dd>Length-prefixed labels, terminated by zero</dd></dl>)}</section>
        <section><h4>Transport · layer 4</h4><dl><dt>Source → destination port</dt><dd>{read16(packet.transport, 0)} → {read16(packet.transport, 2)}</dd><dt>Header / data</dt><dd>{packet.transport.length - packet.payload.length} / {packet.payload.length} bytes</dd><dt>Checksum</dt><dd>0x{hex(read16(packet.transport, packet.protocol === 'tcp' ? 16 : 6), 4)}</dd>{packet.protocol === 'tcp' && <><dt>Sequence / acknowledgment</dt><dd>{packet.seq} / {packet.ack}</dd><dt>Flags</dt><dd>{[['FIN', 1], ['SYN', 2], ['PSH', 8], ['ACK', 16]].filter(([, bit]) => packet.flags & Number(bit)).map(([name]) => name).join(' + ')}</dd></>}</dl><p>16-bit one's-complement checksum covers the IP pseudo-header, transport header, and payload. An odd byte is padded for calculation only.</p></section>
        <section><h4>IPv4 · layer 3</h4><dl><dt>Source → destination</dt><dd>{address(Array.from(packet.ip.slice(12, 16)))} → {address(Array.from(packet.ip.slice(16, 20)))}</dd><dt>Version / header / total</dt><dd>4 / 20 bytes / {packet.ip.length} bytes</dd><dt>Protocol / TTL</dt><dd>{packet.protocol === 'tcp' ? '6 · TCP' : '17 · UDP'} / 64</dd><dt>Header checksum</dt><dd>0x{hex(read16(packet.ip, 10), 4)}</dd></dl><p>Same subnet, no router. Don't Fragment is set. Padding is outside the IPv4 packet.</p></section>
        <section><h4>Ethernet II · layer 2</h4><dl><dt>Destination MAC</dt><dd>{mac(Array.from(packet.frame.slice(0, 6)))}</dd><dt>Source MAC</dt><dd>{mac(Array.from(packet.frame.slice(6, 12)))}</dd><dt>EtherType / padding</dt><dd>0x0800 · IPv4 / {packet.padding} bytes</dd><dt>Transmitted FCS bytes</dt><dd>{Array.from(packet.frame.slice(-4)).map(b => hex(b)).join(' ')}</dd></dl><p>FCS covers the MAC addresses through data and padding. Preamble and start delimiter are excluded.</p></section></div>
        <div className="pl-check-result"><ShieldCheck size={20}/><div><strong>{packet.fault === 'drop' ? 'Frame absent: receiver cannot check it.' : checks.fcs ? 'Received FCS matches.' : 'Received FCS fails: discard at layer 2.'}</strong><p>{packet.fault === 'clean' ? 'IPv4 and transport checksums also pass.' : packet.fault === 'corrupt' ? 'Upper-layer checks are not reached. The receiver does not compare against a copy of the sent message.' : 'No transport acknowledgment can be generated for this frame.'}</p></div></div>
      </>}
      {tab === 'bytes' && <>
        <div className="pl-byte-heading"><h4>Ethernet frame · click a byte to locate it in the signal</h4><label><input type="checkbox" checked={received} onChange={e => setReceived(e.target.checked)}/> Show decoded receive bytes</label></div>
        {received && packet.fault !== 'clean' && <p className="pl-warning">{packet.fault === 'drop' ? 'Dropped frame: these are the bytes that would have arrived; no receive frame exists.' : `Teaching fault: byte ${bodyStart} changed after PHY decoding. Original FCS preserved.`}</p>}
        <div className="pl-hex" aria-label="Ethernet frame bytes">{Array.from(bytes).map((b, i) => <button className={`${colorFor(i, packet)} ${safeOffset === i ? 'selected' : ''} ${b !== packet.frame[i] ? 'changed' : ''}`} key={i} aria-label={`Byte ${i}: ${hex(b)}, ${colorFor(i, packet)}`} aria-pressed={safeOffset === i} onClick={() => { setOffset(i); setTab('signal'); }}>{hex(b)}</button>)}</div>
        <p className="pl-hint">Offsets start at destination MAC byte 0. Hex display is byte-oriented; copper wire order is shown in the signal view.</p>
        <div className="pl-check-math"><p>CRC-32({received ? 'received' : 'sent'} bytes 0–{bytes.length - 5}) = <strong>0x{hex(crc, 8)}</strong></p><p>FCS in frame: <strong>{wireCheck}</strong> (least-significant CRC byte first).</p><p>Polynomial 0x04C11DB7 · reflected implementation 0xEDB88320 · initial and final XOR 0xFFFFFFFF.</p></div>
      </>}
      {tab === 'signal' && <>
        <div className="pl-byte-heading"><h4>{phy === '10base-t' ? '10BASE-T · Manchester' : '100BASE-TX · 4B/5B → scramble → MLT-3'}</h4><label>Frame byte <input className="pl-offset" aria-label="Signal frame byte" type="number" min={0} max={packet.frame.length - 1} value={safeOffset} onChange={e => setOffset(Math.max(0, Math.min(packet.frame.length - 1, Number(e.target.value))))}/></label></div>
        <Waveform trace={trace} offset={safeOffset}/>
        <div className="pl-signal-values"><span>Byte <b>{safeOffset}</b> / <b>0x{hex(packet.frame[safeOffset])}</b></span>{phy === '10base-t' ? <span>Wire bits, LSB first <b>{wireBits(packet.frame.slice(safeOffset, safeOffset + 1)).join('')}</b></span> : <><span>Low nibble → 5B <b>{(packet.frame[safeOffset] & 15).toString(2).padStart(4, '0')} → {CODES[packet.frame[safeOffset] & 15]}</b></span><span>High nibble → 5B <b>{(packet.frame[safeOffset] >>> 4).toString(2).padStart(4, '0')} → {CODES[packet.frame[safeOffset] >>> 4]}</b></span></>}</div>
        {phy === '10base-t' ? <p className="pl-hint">10 Mb/s: each data bit lasts 100 ns, split into two 50 ns levels. A 1 rises at mid-bit; a 0 falls. Shading marks the selected byte. Signal polarity is a stated convention.</p> : <><p className="pl-hint">100 Mb/s data → 125 million code bits/s (8 ns each). XOR the 5B stream with an 11-bit scrambler sequence, then advance 0 → +1 → 0 → −1 → 0 on each scrambled 1; a 0 holds the level. This is the net NRZI/MLT-3 transition rule.</p><div className="pl-code-chain"><span>5B bits <b>{trace.coded.slice(trace.owners.indexOf(safeOffset), trace.owners.indexOf(safeOffset) + 10).join('')}</b></span><span>Scrambled <b>{trace.scrambled.slice(trace.owners.indexOf(safeOffset), trace.owners.indexOf(safeOffset) + 10).join('')}</b></span></div><p className="pl-hint">J/K (11000 10001) replaces the first preamble byte; T/R (01101 00111) ends the frame. Idle groups are 11111. Known-state teaching scrambler: s[n] = s[n−11] XOR s[n−9], eleven initial ones, with 16 idle groups before J/K. Real links scramble continuously and acquire receiver synchronization.</p></>}
        <p className="pl-hint">Complete transmitted stream includes 7 preamble bytes (55) and SFD (D5), then the frame. The plot shows a short window. Levels are normalized, not calibrated voltages; no analog noise, clock recovery, or equalization is modeled.</p>
      </>}
    </div>
  </details>;
}

export default function App() {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [index, setIndex] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1);
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null), [offset, setOffset] = useState(0);
  const error = validateConfig(config);
  const steps = useMemo(() => error ? [] : simulate(config), [config, error]);
  const step = steps[Math.min(index, steps.length - 1)];
  const layer = selectedLayer ?? step?.layer ?? 7;
  const layerInfo = LAYERS.find(l => l.n === layer)!;
  const packet = step?.packet ?? [...steps.slice(0, index + 1)].reverse().find(s => s.packet)?.packet;
  const packets = [...new Map(steps.filter(s => s.packet).map(s => [s.packet!.id, s])).values()];
  const completed = step?.result === 'success';
  const activeLeft = step?.packet?.direction === 'back' ? step.side === 'receiver' : step?.side === 'sender';
  function update(patch: Partial<Config>) { setConfig(c => ({ ...c, ...patch })); setIndex(0); setPlaying(false); setSelectedLayer(null); setOffset(0); }
  function move(n: number) { setIndex(Math.max(0, Math.min(steps.length - 1, n))); setSelectedLayer(null); }
  useEffect(() => {
    if (!playing || !steps.length) return;
    if (index >= steps.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => { setIndex(i => i + 1); setSelectedLayer(null); }, 1300 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, speed, steps.length]);
  return <div className="pl-app">
    <header className="pl-header"><a className="pl-brand" href="/"><span><Layers size={21}/></span>packet<span className="muted">lab.</span></a><span className="pl-header-label">A LITTLE LAB FOR HOW NETWORKS WORK</span><a href="/" className="pl-back"><ArrowLeft size={14}/>All simulators</a></header>
    <main>
      <section className="pl-hero"><div><span className="eyebrow"><i/> NETWORKING / THE SEVEN-LAYER JOURNEY</span><h1>One message.<br/><em>Seven little layers.</em></h1><p>From a simple request to a signal on a wire.<br/>Unwrap the journey, one layer at a time.</p><a href="#playground">Follow a packet <ArrowDown size={14}/></a></div><div className="pl-hero-art" aria-hidden="true">{['APPLICATION', 'TCP / UDP', 'IPv4', 'ETHERNET', 'COPPER SIGNAL'].map((s, i) => <div style={{ '--i': i } as React.CSSProperties} key={s}><span>0{i + 1}</span>{s}<b>{i === 4 ? '⌁' : '↓'}</b></div>)}<small>A BIG IDEA. SMALL ENVELOPES.</small></div></section>
      <div className="pl-section-rule"><span>THE OSI MODEL / MADE TANGIBLE</span><span>REAL BYTES. SLOWED-DOWN SIGNALS.</span></div>
      <section id="playground" className="pl-playground" aria-label="OSI simulation playground">
        <aside className="pl-controls"><div className="pl-controls-title"><span className="eyebrow">YOUR EXPERIMENT</span><button onClick={() => { update(DEFAULTS); setSpeed(1); }}><RotateCcw size={13}/>Reset</button></div>
          <fieldset><legend><Layers size={15}/>Choose a conversation</legend><div className="pl-protocols">{(['tcp', 'udp'] as const).map(protocol => <button key={protocol} aria-pressed={config.protocol === protocol} onClick={() => update({ protocol })}><strong>{protocol.toUpperCase()} <span>{protocol === 'tcp' ? 'HTTP' : 'DNS'}</span></strong><small>{protocol === 'tcp' ? 'A reliable stream · port 80' : 'A small question · port 53'}</small><ChevronRight size={14}/></button>)}</div><label htmlFor="pl-message">{config.protocol === 'tcp' ? 'HTTP request path' : 'DNS query name'}</label><input id="pl-message" value={config.protocol === 'tcp' ? config.path : config.name} onChange={e => update(config.protocol === 'tcp' ? { path: e.target.value } : { name: e.target.value })} aria-invalid={!!error} aria-describedby="pl-input-help" spellCheck={false}/><p id="pl-input-help" className={error ? 'pl-error' : 'pl-hint'} role={error ? 'alert' : undefined}>{error || (config.protocol === 'tcp' ? 'GET a resource from lab.test. Plain HTTP/1.1, without TLS.' : 'Ask the peer for an IPv4 address. Fixed simulated answer: 192.0.2.42.')}</p></fieldset>
          <fieldset><legend><Cable size={15}/>Choose your copper</legend><label htmlFor="pl-phy">Ethernet physical layer</label><select id="pl-phy" value={config.phy} onChange={e => update({ phy: e.target.value as Config['phy'] })}><option value="10base-t">10BASE-T · Manchester</option><option value="100base-tx">100BASE-TX · MLT-3</option></select><p className="pl-hint">Twisted-pair copper, 8P8C connector (“RJ45”). Established full-duplex link, two pairs: one for each direction.</p></fieldset>
          <fieldset><legend><Zap size={15}/>Try a little what-if</legend><div className="pl-presets">{([{ value: 'clean', label: 'A clean journey', Icon: Check }, { value: 'corrupt', label: 'Corrupt first request frame', Icon: Zap }, { value: 'drop', label: 'Drop first request frame', Icon: Unplug }] as const).map(({ value, label, Icon }) => <button key={value} aria-pressed={config.fault === value} onClick={() => update({ fault: value })}><Icon size={14}/>{label}</button>)}</div><p className="pl-hint">One fault, on the first request data frame. TCP retries; UDP's application times out.</p></fieldset>
          <div className="pl-sidebar-note"><CircleHelp size={20}/><p>OSI is a way to think.<br/><span>Real TCP/IP software often combines the top three layers.</span></p></div>
        </aside>
        <div className="pl-workspace">
          <section className="pl-journey" aria-label="Packet journey"><div className="pl-panel-heading"><div><span className="eyebrow">01 / WATCH THE JOURNEY</span><h2>A little wrapping. A little unwrapping.</h2></div><span className="pl-pill">{config.protocol.toUpperCase()} / IPv4 / Ethernet</span></div>
            <div className="pl-network"><div className="pl-host-heading"><strong>THE CLIENT</strong><span>{address(CLIENT.ip)} · :{CLIENT.port}</span></div><div className="pl-host-heading"><strong>THE SERVER</strong><span>{address(SERVER.ip)} · :{config.protocol === 'tcp' ? 80 : 53}</span></div>
            {['client', 'server'].map((host, hostIndex) => <div className={`pl-stack pl-stack-${host}`} key={host} aria-label={`${host} OSI layers`}>{LAYERS.map(l => <button key={l.n} aria-label={`${host} layer ${l.n}: ${l.name}`} aria-pressed={layer === l.n} className={`${layer === l.n ? 'inspecting' : ''} ${step?.layer === l.n && step.side !== 'wire' && (hostIndex === 0 ? activeLeft : !activeLeft) ? 'active' : ''}`} onClick={() => setSelectedLayer(l.n)}><b>{l.n}</b><span>{l.name}</span><small>{l.n >= 5 ? 'data' : l.n === 4 ? config.protocol === 'tcp' ? 'segment' : 'datagram' : l.n === 3 ? 'packet' : l.n === 2 ? 'frame' : 'signal'}</small></button>)}</div>)}
            <div className={`pl-cable ${step?.side === 'wire' && playing ? 'moving' : ''} ${packet?.direction === 'back' ? 'reverse' : ''}`}><span className="pl-port"/><span className="pl-wire-line"><i/></span><span className="pl-port"/><small>{packet ? packetName(packet) : 'Two directly linked hosts'} · {config.phy.toUpperCase()}</small></div></div>
            <div className={`pl-current ${step?.result === 'failure' || step?.title.startsWith('Bad') ? 'failure' : completed ? 'success' : ''}`} role="status" aria-live={playing ? 'off' : 'polite'}><span className="pl-step-marker">{step?.kind === 'outcome' ? <Check size={21}/> : step?.layer ?? '–'}</span><div><span className="eyebrow">{step ? `${index + 1} / ${steps.length} · ${step.side === 'wire' ? 'ON THE LINK' : step.side.toUpperCase()}` : 'CHECK YOUR INPUT'}</span><h3>{step?.title ?? 'Let’s give this message a valid address.'}</h3><p>{step?.detail ?? error}</p></div></div>
            <div className="pl-playback"><button aria-label="Previous step" disabled={!step || index === 0} onClick={() => { setPlaying(false); move(index - 1); }}><ChevronLeft size={16}/></button><button className="pl-play" disabled={!step || index === steps.length - 1} onClick={() => setPlaying(p => !p)}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause' : 'Play'}</button><button aria-label="Next step" disabled={!step || index === steps.length - 1} onClick={() => { setPlaying(false); move(index + 1); }}><ChevronRight size={16}/></button><label className="pl-scrub-label"><span className="sr-only">Journey step</span><input type="range" aria-label="Journey step" min="0" max={Math.max(1, steps.length - 1)} value={index} disabled={!step} onChange={e => { setPlaying(false); move(Number(e.target.value)); }}/></label><label className="pl-speed"><span className="sr-only">Playback speed</span><select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>
            <div className="pl-jump"><label htmlFor="pl-jump">Jump to a packet</label><select id="pl-jump" value={packet?.id ?? ''} disabled={!step} onChange={e => { setPlaying(false); move(steps.findIndex(s => s.packet?.id === e.target.value)); }}>{packets.map(s => <option key={s.packet!.id} value={s.packet!.id}>{s.packet!.title}</option>)}</select></div>
          </section>
          <section className="pl-layer-card" aria-label="Selected layer"><div className="pl-layer-title"><span className="pl-layer-number">0{layer}</span><div><span className="eyebrow">02 / UNDERSTAND THE LAYER</span><h2>{layerInfo.name}</h2></div><span className="pl-pill">{layerInfo.unit}</span></div><p>{layerInfo.detail}</p>{packet && <Envelope packet={packet} layer={layer}/>}<div className="pl-legend"><span className="application">Application</span><span className="transport">Transport</span><span className="network">IPv4</span><span className="link">Ethernet</span><span className="fcs">FCS</span></div>{layer >= 5 && <p className="pl-hint">Layers 5 and 6 describe responsibilities here, not extra wire headers. The full inspector remains available at every step.</p>}</section>
          {packet && <Inspector packet={packet} phy={config.phy} layer={layer} side={step?.side ?? 'sender'} offset={offset} setOffset={setOffset}/>}
          <details className="pl-timeline"><summary>See the complete journey <span>{steps.length} steps</span></summary><ol>{steps.map((s, i) => <li key={i}><button aria-current={i === index ? 'step' : undefined} onClick={() => { setPlaying(false); move(i); }}><span>{String(i + 1).padStart(2, '0')}</span>{s.title}{s.result === 'success' && <Check size={14}/>}</button></li>)}</ol></details>
        </div>
      </section>
      <section className="pl-lessons"><div><span className="eyebrow">THE BIG IDEA</span><h2>Same cable.<br/><em>Different promises.</em></h2></div><article><span className="eyebrow">TCP / A RELIABLE STREAM</span><h3>“Did you get those bytes?”</h3><p>TCP sets up a connection, numbers bytes, and retries when acknowledgments don't arrive. HTTP/1.1 uses that ordered stream for its requests and responses.</p></article><article><span className="eyebrow">UDP / AN INDEPENDENT DATAGRAM</span><h3>“Here’s my question.”</h3><p>UDP sends without a handshake. Its checksum can detect corruption, but delivery and retries belong to the application. DNS can use both UDP and TCP; this example uses UDP.</p></article></section>
      <aside className="pl-model-note"><ShieldCheck size={23}/><div><strong>The error check lives in the envelope.</strong><p>Ethernet CRC-32/FCS belongs to layer 2. Manchester and MLT-3 belong to layer 1. Neither repairs corrupted frames. A passing check means no error was detected; it does not prove authenticity or guarantee the absence of corruption.</p></div></aside>
      <details className="pl-about"><summary>About this little model & references</summary><p>All packets and signals are calculated in your browser. Two hosts share a subnet with preconfigured peer MAC addresses. We assume an established full-duplex link (including suitable crossover/auto-MDI-X), not collisions or negotiation. A DNS peer answers locally; no recursion or real network requests occur. Responses fit in one IPv4 packet. No routing, ARP, fragmentation, congestion control, analog noise, or clock recovery is simulated. Faults affect only the first request; timeout durations are shortened for teaching. DNS application retries are disabled. Control packets are summarized in one step; request and response data visit every layer.</p><p>Fixed endpoints: client {mac(CLIENT.mac)}, server {mac(SERVER.mac)}. TCP uses an illustrative receive window without options. The clean close omits TIME-WAIT timing. The HTTP request uses a preconfigured address for lab.test; it does not trigger the separate DNS lesson.</p><p>References: <a href="https://www.rfc-editor.org/rfc/rfc9112.html">HTTP/1.1 (RFC 9112)</a>, <a href="https://www.rfc-editor.org/rfc/rfc9293.html">TCP (RFC 9293)</a>, <a href="https://www.rfc-editor.org/rfc/rfc768">UDP (RFC 768)</a>, <a href="https://www.rfc-editor.org/rfc/rfc1035">DNS (RFC 1035)</a>, <a href="https://www.rfc-editor.org/rfc/rfc1071">Internet checksum (RFC 1071)</a>, <a href="https://www.ti.com/lit/ds/symlink/dp83847.pdf">TI Ethernet PHY reference</a>, and IEEE 802.3 Ethernet framing.</p></details>
    </main><footer><a href="/" className="pl-brand"><Layers size={16}/>packet<span className="muted">lab.</span></a><span>Small experiments. Big aha moments.</span><a href="/">Explore all simulators <ArrowRight size={13}/></a></footer>
  </div>;
}
