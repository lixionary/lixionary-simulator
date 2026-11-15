import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowUpRight, Lightbulb, Pause, Play, RotateCcw, Satellite, SlidersHorizontal } from 'lucide-react';
import { C, clockError, DAY, EARTH_RADIUS, factoryOffset, fixTrail, maxEccentricity, meanSpeed, NOMINAL_HZ, period, rates, SATELLITES, semiMajor, solveFix, wobbleAmplitude, type Corrections, type Orbit, type Settings } from './model';
import { clockReading, distance, duration, elapsed, hoursMinutes, perDay, thousands } from './format';
import { ORBITS, PRESETS } from './presets';
import { DriftChart, FixMap, OrbitView, RangeList, RateChart, SkyPlot, TINTS } from './Views';

const GROUPS = [...new Set(PRESETS.map(p => p.group))];
const WEEK = 7 * DAY;
const SPEEDS = [{ value: 600, label: '10 minutes a second' }, { value: 3600, label: '1 hour a second' }, { value: 21_600, label: '6 hours a second' }];

function startingPreset() {
  const key = new URLSearchParams(window.location.search).get('preset'), found = PRESETS.find(p => p.key === key);
  return { preset: found ?? PRESETS[0], unknown: key !== null && !found };
}

function Slider({ label, value, min, max, step, text, onChange }: { label: string; value: number; min: number; max: number; step: number; text: string; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="gps-slider"><div><label htmlFor={id}>{label}</label><output htmlFor={id}>{text}</output></div><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></div>;
}
function Check({ checked, onChange, label, children }: { checked: boolean; onChange: (checked: boolean) => void; label: string; children: ReactNode }) {
  return <div className="gps-option"><label className="gps-check"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />{label}</label><p>{children}</p></div>;
}
function Stat({ label, id, value, children }: { label: string; id: string; value: string; children: ReactNode }) {
  return <div><span>{label}</span><b data-testid={id}>{value}</b><small>{children}</small></div>;
}

export default function App() {
  const [start] = useState(startingPreset);
  const [presetKey, setPresetKey] = useState(start.preset.key), [settings, setSettings] = useState<Settings>(start.preset.settings);
  const [t, setT] = useState(start.preset.elapsed), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(3600);
  const [unknownLink, setUnknownLink] = useState(start.unknown);
  const preset = PRESETS.find(p => p.key === presetKey)!, { orbit, corrections, solvesClock } = settings;

  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const step = Math.round((now - last) / 1000 * speed);
      if (step > 0) { last = now; setT(value => Math.min(WEEK, value + step)); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);
  useEffect(() => { if (t >= WEEK) setPlaying(false); }, [t]);

  const a = semiMajor(orbit), rate = rates(a), built = factoryOffset(orbit, corrections), limit = maxEccentricity(orbit.altitudeKm);
  const fix = useMemo(() => solveFix(settings, t), [settings, t]), trail = useMemo(() => fixTrail(settings, t), [settings, t]);
  const error = clockError(settings, SATELLITES[0], t), ground = clockReading(t), orbiting = clockReading(t, error);
  const netPerDay = rate.net * DAY * 1e6, wobble = wobbleAmplitude(orbit);

  function load(key: string) {
    const next = PRESETS.find(p => p.key === key)!;
    setPresetKey(key); setSettings(next.settings); setT(next.elapsed); setPlaying(false); setUnknownLink(false);
    window.history.replaceState(null, '', `?preset=${key}`);
  }
  const setOrbit = (patch: Partial<Orbit>) => {
    const next = { ...orbit, ...patch };
    setSettings({ ...settings, orbit: { ...next, eccentricity: Math.min(next.eccentricity, maxEccentricity(next.altitudeKm)) } });
  };
  const setCorrection = (patch: Partial<Corrections>) => setSettings({ ...settings, corrections: { ...corrections, ...patch } });
  const hertz = (NOMINAL_HZ * (1 + built)).toFixed(5), tuned = Math.abs(built) * NOMINAL_HZ * 1000;

  return <div className="gps-app">
    <header className="gps-header"><a className="gps-brand" href="/"><span><Satellite size={20} strokeWidth={1.6} /></span>relativity<span className="muted">lab.</span></a><a className="gps-back" href="/"><ArrowLeft size={13} />All simulators</a></header>
    <main>
      <section className="gps-hero"><div><span className="eyebrow">GENERAL RELATIVITY, IN YOUR POCKET</span><h1>Time runs fast in orbit.<br />Your phone <em>knows.</em></h1><p>A GPS satellite’s clock gains 38 millionths of a second a day on the ground. <br />Leave that in, and every distance it measures is 11 km off by tomorrow.</p><a href="#lab">Wind the clocks <ArrowDown size={14} /></a></div>
        <div className="gps-hero-note" aria-hidden="true"><svg viewBox="0 0 220 90"><path d="M-10 118 A150 150 0 0 1 230 118" fill="#a9c8d6" fillOpacity=".55" stroke="#6f93a3" /><path d="M8 40 A210 210 0 0 1 212 40" fill="none" stroke="#5b5f97" strokeDasharray="3 5" /><rect x="105" y="10" width="10" height="10" rx="2" fill="#5b5f97" /><path d="M95 12h8v6h-8zM117 12h8v6h-8z" fill="#c9cbe0" stroke="#5b5f97" /><path d="M110 22V68" stroke="#8a8fb8" strokeDasharray="2 4" /><circle cx="110" cy="70" r="3" fill="#c65a48" /></svg><p>Weaker gravity: +45.8 µs a day.<br />Orbital speed: −7.2 µs a day.</p><span>SPECIAL 1905 · GENERAL 1915</span></div></section>
      <div className="gps-section-heading"><span className="eyebrow">THE ORBIT AND THE CLOCKS</span><span>CLOSED-FORM RELATIVITY · SI UNITS · ONE FROZEN SKY OF SIX SATELLITES</span></div>
      <section id="lab" className="gps-lab" aria-label="GPS relativity simulation">
        <aside className="gps-settings">
          <div className="gps-panel-heading"><h2>Build the experiment</h2><SlidersHorizontal size={15} /></div>
          <label className="gps-label" htmlFor="gps-preset">Start with an experiment</label>
          <select id="gps-preset" value={presetKey} onChange={event => load(event.target.value)}>{GROUPS.map(group => <optgroup key={group} label={group}>{PRESETS.filter(p => p.group === group).map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</optgroup>)}</select>
          <p className="gps-hint" data-testid="gps-notice">{preset.notice}</p>
          {unknownLink && <p className="gps-error" role="status">That link names an experiment this lab does not have, so it opened the first one.</p>}

          <details open><summary>Time since the clocks were set</summary><div className="gps-fields">
            <Slider label="Elapsed time" value={t} min={0} max={WEEK} step={600} text={elapsed(t)} onChange={value => { setPlaying(false); setT(value); }} />
            <div className="gps-row"><button className="gps-primary" onClick={() => { if (!playing && t >= WEEK) setT(0); setPlaying(!playing); }}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Pause' : 'Let time run'}</button><button onClick={() => { setPlaying(false); setT(0); }}><RotateCcw size={12} />Reset clocks</button></div>
            <label className="gps-label" htmlFor="gps-speed">Playback speed</label>
            <select id="gps-speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}>{SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          </div></details>

          <details open><summary>The orbit</summary><div className="gps-fields">
            <div className="gps-orbits" role="group" aria-label="Well-known orbits">{ORBITS.map(o => <button key={o.key} aria-pressed={orbit.altitudeKm === o.altitudeKm} onClick={() => setOrbit({ altitudeKm: o.altitudeKm })}>{o.name}<small>{thousands(o.altitudeKm)} km</small></button>)}</div>
            <Slider label="Altitude" value={orbit.altitudeKm} min={300} max={40_000} step={1} text={`${thousands(orbit.altitudeKm)} km`} onChange={altitudeKm => setOrbit({ altitudeKm })} />
            <Slider label="How oval the orbit is" value={orbit.eccentricity} min={0} max={limit} step={0.001} text={orbit.eccentricity === 0 ? 'a circle' : `e ${orbit.eccentricity.toFixed(3)} · ±${duration(wobble)}`} onChange={eccentricity => setOrbit({ eccentricity })} />
          </div></details>

          <details open><summary>What the engineers correct</summary><div className="gps-fields">
            <Check checked={corrections.gravity} onChange={gravity => setCorrection({ gravity })} label="Weaker gravity (general relativity)">Slow the clock down before launch by {perDay(rate.gravity).replace('+', '')}.</Check>
            <Check checked={corrections.speed} onChange={speed => setCorrection({ speed })} label="Orbital speed (special relativity)">Speed the clock up before launch by {perDay(-rate.speed).replace('+', '')}.</Check>
            <Check checked={corrections.orbitShape} onChange={orbitShape => setCorrection({ orbitShape })} label="The oval orbit, in the receiver">{orbit.eccentricity === 0 ? 'Nothing to correct on a circular orbit.' : `The receiver removes each satellite’s swing of ±${duration(wobble)} per lap.`}</Check>
          </div></details>

          <details open><summary>The receiver</summary><div className="gps-fields">
            <Check checked={solvesClock} onChange={value => setSettings({ ...settings, solvesClock: value })} label="Solve for its own clock error">{solvesClock ? 'Like a phone: a cheap clock, set from the satellites. An error shared by every satellite ends up in the time, not the position.' : 'This receiver carries a perfect clock of its own and believes every distance it measures.'}</Check>
          </div></details>
          <div className="gps-tip"><Lightbulb size={16} /><p>Try “Forget relativity”, then tick the corrections back on one at a time.</p></div>
        </aside>

        <div className="gps-stage">
          <div className="gps-stage-heading"><div><span className="gps-status-dot" />{preset.name}</div><span>ONE LAP IN <b>{hoursMinutes(period(a))}</b> · <b>{(meanSpeed(a) / 1000).toFixed(2)} km/s</b></span></div>
          <div className="gps-top">
            <OrbitView orbit={orbit} t={t} />
            <div className="gps-clocks">
              <div><span>GROUND CLOCK</span><b data-testid="gps-ground-clock">{ground.time}<i>{ground.fraction}</i></b></div>
              <div className={Math.abs(error) < 5e-10 ? '' : 'off'}><span>SATELLITE A CLOCK</span><b data-testid="gps-satellite-clock">{orbiting.time}<i>{orbiting.fraction}</i></b></div>
              <p data-testid="gps-verdict">{Math.abs(error) < 5e-10 ? 'The two clocks agree to the nanosecond.' : <>The satellite clock is <strong>{duration(Math.abs(error))} {error > 0 ? 'ahead' : 'behind'}</strong>. Its radio signal travels <strong>{distance(C * error)}</strong> in that time.</>}</p>
              <p className="gps-how">A receiver measures distance by timing the signal: distance = travel time × the speed of light. One nanosecond is 30 cm.</p>
            </div>
          </div>
          <div className="gps-stats">
            <Stat label="Gravity effect" id="gps-gravity" value={perDay(rate.gravity)}>{thousands(orbit.altitudeKm)} km up, gravity is weaker and time runs faster.</Stat>
            <Stat label="Speed effect" id="gps-speed-effect" value={perDay(rate.speed)}>At {(meanSpeed(a) / 1000).toFixed(2)} km/s, a moving clock runs slower.</Stat>
            <Stat label="Net, left alone" id="gps-net" value={perDay(rate.net)}>{Math.abs(netPerDay) < 0.05 ? 'The two effects cancel at this height.' : `An untouched clock runs ${netPerDay > 0 ? 'fast' : 'slow'} in this orbit.`}</Stat>
            <Stat label="Clock as built" id="gps-factory" value={`${thousands(Math.floor(Number(hertz)))}${hertz.slice(hertz.indexOf('.'))} Hz`}>{built === 0 ? 'Exactly 10.23 MHz on the ground, as if relativity did not exist.' : `Tuned ${tuned.toFixed(3)} mHz ${built < 0 ? 'low' : 'high'} on the ground, to read 10.23 MHz in orbit.`}</Stat>
            <Stat label="Satellite clock error" id="gps-clock-error" value={duration(error, true)}>{Math.abs(error) < 1e-12 ? 'Satellite A agrees with the ground.' : `Satellite A is ${error > 0 ? 'ahead of' : 'behind'} the ground clock.`}</Stat>
            <Stat label="Distance error" id="gps-range-error" value={distance(C * error)}>{Math.abs(error) < 1e-12 ? 'Every measured distance is right.' : `Satellite A looks this much too ${error > 0 ? 'near' : 'far'}.`}</Stat>
            <Stat label="Position error" id="gps-fix-error" value={distance(fix.distance)}>{fix.distance < 1e-3 ? 'The fix sits on the true position.' : `${distance(fix.horizontal)} sideways and ${distance(fix.up)} too ${fix.up > 0 ? 'high' : 'low'}.`}</Stat>
            <Stat label="Receiver time error" id="gps-time-error" value={duration(fix.clock, true)}>{solvesClock ? 'A receiver that sets its clock from the satellites copies their error.' : 'This receiver trusts its own perfect clock.'}</Stat>
          </div>
          <section className="gps-charts" aria-label="Position fix">
            <div className="gps-chart"><div className="gps-chart-heading"><h3>Where the receiver thinks it is</h3><span>SEEN FROM ABOVE · THE CROSS IS THE TRUTH</span></div><FixMap fix={fix} trail={trail} /><p>{fix.distance < 1e-3 ? 'The red dot sits on the cross: the fix is exact.' : `The red dot is the fix, ${distance(fix.horizontal)} off on the map and ${distance(fix.up)} too ${fix.up > 0 ? 'high' : 'low'}. The faint line is the path it took.`}</p></div>
            <div className="gps-chart"><div className="gps-chart-heading"><h3>Six satellites overhead</h3><span>ERROR IN EACH MEASURED DISTANCE</span></div><SkyPlot /><RangeList settings={settings} t={t} /><p>A clock that runs ahead stamps its signal late, so the signal looks younger and the satellite nearer. The middle of the plot is straight overhead.</p></div>
          </section>
          <section className="gps-charts" aria-label="Clock rates and drift">
            <div className="gps-chart"><div className="gps-chart-heading"><h3>Which effect wins, by height</h3><span>CIRCULAR ORBITS · AGAINST A SEA-LEVEL CLOCK</span></div><RateChart altitudeKm={orbit.altitudeKm} /><div className="gps-legend"><span><i style={{ background: '#c08a3e' }} />gravity</span><span><i style={{ background: '#3f8f8a' }} />speed</span><span><i style={{ background: '#5b5f97' }} />net</span></div></div>
            <div className="gps-chart"><div className="gps-chart-heading"><h3>Clock error since the clocks were set</h3><span>AFTER THE CORRECTIONS YOU CHOSE</span></div><DriftChart settings={settings} t={t} /><div className="gps-legend">{SATELLITES.map((s, i) => <span key={s.name}><i style={{ background: TINTS[i] }} />{s.name}</span>)}</div></div>
          </section>
        </div>
      </section>

      <section className="gps-understand"><span className="eyebrow">WHAT THE LAB IS SHOWING</span><h2>Two effects, <em>one clock.</em></h2>
        <div className="gps-explanations">
          <article><span>01 · GENERAL RELATIVITY</span><h3>Higher clocks run faster.</h3><p>Mass slows time near it. A clock 20,184 km up sits higher in Earth’s gravity well than one on the ground, so it ticks faster by 45.8 µs every day. The effect grows with height and levels off: far from Earth it can never exceed 60 µs a day.</p></article>
          <article><span>02 · SPECIAL RELATIVITY</span><h3>Moving clocks run slower.</h3><p>A GPS satellite moves at 3.87 km/s. Seen from the ground its clock loses 7.2 µs a day. Low orbits are faster, so the loss is bigger there and wins: a space-station clock runs slow. At 3,167 km the two effects cancel.</p></article>
          <article><span>03 · FROM THEORY TO A BLUE DOT</span><h3>Engineered out, twice.</h3><p>Each GPS clock is built to tick at 10.22999999543 MHz, so that it reads 10.23 MHz once in orbit. Real orbits are slightly oval, so each clock still swings by tens of nanoseconds per lap. Your phone removes that itself, from a formula in the GPS signal specification.</p></article>
        </div>
        <details className="gps-rules"><summary>Inside the model</summary><div>
          <p>The rate of an orbiting clock against a sea-level clock is <code>L<sub>G</sub> − GM/(rc²) − v²/(2c²)</code>. The first two terms are the gravity effect, the last is the speed effect. <code>L<sub>G</sub> = 6.969290134 × 10⁻¹⁰</code> is the defined rate of the sea-level surface, which already folds in Earth’s spin and bulge, so every sea-level clock ticks alike. Averaged over an orbit the sum is <code>L<sub>G</sub> − 3GM/(2ac²)</code>.</p>
          <p>On an oval orbit the clock also swings around that average by <code>F · e · √a · sin E</code>, with <code>F = −2√GM / c²</code>. This is the relativistic correction every GPS receiver applies, as written in the interface specification IS-GPS-200.</p>
          <p>The six satellites stay fixed in the sky so that only the clocks change. The fix is a least-squares solution for position, or for position and receiver clock, from the six measured distances. Altitudes are above the equatorial radius, 6,378.137 km.</p>
          <p>Left out: the Sagnac effect of Earth turning during the signal’s flight (up to about 40 m, also corrected in the receiver), the atmosphere, clock noise, and the corrections the ground stations upload every few hours. Those uploads would catch a runaway clock in practice, which is why “11 km a day” is the size of the problem and not a prediction of a real outage.</p>
          <p>History checked it. The first test satellite, NTS-2 in 1977, flew for 20 days with the correction switched off. Its caesium clock ran fast by 442.5 parts in 10¹², against a predicted 446.5. Then the correction was switched on.</p>
        </div></details>
      </section>
    </main>
    <footer><span>relativity lab. · lixionary / simulators</span><a href="/">Explore all simulators <ArrowUpRight size={12} /></a></footer>
  </div>;
}
