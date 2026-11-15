import { useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, ChartArea, Lightbulb, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { adaptiveSimpson, evenSimpson, integrate, INTERVALS, repeatErrors, ruleInText, RULES, ruleOf, sampleTrip, samplePoints, slicesFor, trapezoidData, TRIP_DISTANCE, TRIP_MEAN_SPEED } from './model';
import { FORMULA, integrandOf, NO_FORMULA, setupFor, solve, spike, TRAPS, type Integrand, type Setup, type Solved } from './functions';
import { bound, correctDigits, count, err, metres, num, percent, sci, shrink } from './format';
import { OPEN, PRESETS, SLICE, SLICES, SPIKE, TRAP, TRIP, type Situation, type Spike, type Stage, type Trip } from './presets';
import { ACCENT, AreaChart, CurveChart } from './CurveViews';
import { ConvergenceTable, LogChart, RULE_TINT, Table, tolerance } from './ErrorViews';
import { RepeatChart, TripChart } from './DataViews';

const GROUPS = [...new Set(PRESETS.map(p => p.group))];
const STAGES: { key: Stage; name: string; made: string }[] = [{ key: 'formula', name: 'Against the formula', made: 'how big is the error' }, { key: 'none', name: 'No formula', made: 'the curve is still there' }, { key: 'practice', name: 'In practice', made: 'data, accuracy, traps' }];
const SITUATIONS: { key: Situation; name: string }[] = [{ key: 'data', name: 'Measured data' }, { key: 'adaptive', name: 'Accuracy on demand' }, { key: 'trap', name: 'Where it is fooled' }];
const DERIVATIVE = { left: 'first', right: 'first', midpoint: 'second', trapezoid: 'second', simpson: 'fourth' };

function startingPreset() {
  const key = new URLSearchParams(window.location.search).get('preset'), found = PRESETS.find(p => p.key === key);
  return { preset: found ?? PRESETS[0], unknown: key !== null && !found };
}

function Slider({ label, value, min, max, step, text, onChange }: { label: string; value: number; min: number; max: number; step: number; text: string; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="ni-slider"><div><label htmlFor={id}>{label}</label><output htmlFor={id}>{text}</output></div><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></div>;
}
function Stat({ label, id, value, children }: { label: string; id: string; value: string; children: ReactNode }) {
  return <div><span>{label}</span><b data-testid={id}>{value}</b><small>{children}</small></div>;
}

/** The curve, the interval, the rule, and the number of slices: the same controls wherever slices are added up. */
function SetupControls({ list, setup, onChange }: { list: Integrand[]; setup: Setup; onChange: (next: Setup) => void }) {
  const id = useId(), fn = integrandOf(setup.fn), n = slicesFor(setup.rule, setup.n), index = SLICES.filter(size => size <= n).length - 1;
  const ends = (patch: { a?: number; b?: number }) => {
    const next = { ...setup, ...patch };
    if (next.b < next.a + 0.1) { if ('a' in patch) next.b = Math.min(fn.domain[1], next.a + 0.1); else next.a = Math.max(fn.domain[0], next.b - 0.1); }
    if (next.b >= next.a + 0.1 - 1e-9) onChange(next);
  };
  return <>
    <details open><summary>The curve</summary><div className="ni-fields">
      <label className="ni-label" htmlFor={id}>Area under</label>
      <select id={id} value={setup.fn} onChange={event => onChange(setupFor(event.target.value, setup.rule, setup.n))}>{list.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
      {fn.about && <p className="ni-hint flush">{fn.about}</p>}
      {!fn.fixed && <><Slider label="From" value={setup.a} min={fn.domain[0]} max={fn.domain[1]} step={0.05} text={`x = ${bound(setup.a)}`} onChange={a => ends({ a })} /><Slider label="To" value={setup.b} min={fn.domain[0]} max={fn.domain[1]} step={0.05} text={`x = ${bound(setup.b)}`} onChange={b => ends({ b })} /></>}
      {fn.param && <Slider label={fn.param.label} value={setup.p} min={fn.param.min} max={fn.param.max} step={fn.param.step} text={fn.param.text(setup.p)} onChange={p => onChange({ ...setup, p })} />}
    </div></details>
    <details open><summary>The rule</summary><div className="ni-fields">
      <div className="ni-switch" role="group" aria-label="Rule">{RULES.map(rule => <button key={rule.key} aria-pressed={setup.rule === rule.key} onClick={() => onChange({ ...setup, rule: rule.key })}>{rule.name}</button>)}</div>
      <Slider label="Slices" value={index} min={0} max={SLICES.length - 1} step={1} text={count(n)} onChange={i => onChange({ ...setup, n: SLICES[i] })} />
      <div className="ni-switch"><button disabled={n <= 1 || (setup.rule === 'simpson' && n <= 2)} onClick={() => onChange({ ...setup, n: Math.max(1, Math.floor(n / 2)) })}>Halve</button><button className="ni-primary" disabled={n >= 512} onClick={() => onChange({ ...setup, n: Math.min(512, n * 2) })}>Double the slices</button></div>
    </div></details>
  </>;
}

const Legend = () => <div className="ni-legend"><span><i style={{ background: '#33444b' }} />the curve</span><span><i className="block" style={{ background: '#c65a48' }} />counted, but not under the curve</span><span><i className="block" style={{ background: '#4d7fc0' }} />under the curve, but missed</span></div>;

function errorSeries(s: Solved) {
  return RULES.map(rule => ({ key: rule.key, name: rule.short, tint: RULE_TINT[rule.key], points: s.curves.find(c => c.rule === rule.key)!.points, strong: rule.key === s.rule }));
}

/** Slices against a curve whose integral has a formula: used for the first link and for the traps in the third. */
function SliceStage({ s }: { s: Solved }) {
  const rule = ruleOf(s.rule), finite = Number.isFinite(s.value), integral = `${s.fn.label} from ${bound(s.a)} to ${bound(s.b)}`;
  return <>
    <div className="ni-stage-heading"><div><span className="ni-status-dot" />{rule.name}, {count(s.n)} {s.n === 1 ? 'slice' : 'slices'}</div><span>AREA UNDER <b>{s.fn.label}</b> · <b>{bound(s.a)}</b> TO <b>{bound(s.b)}</b></span></div>
    <div className="ni-picture"><CurveChart f={s.f} a={s.a} b={s.b} n={s.n} rule={s.rule} cap={s.fn.cap} points={s.n <= 64 ? samplePoints(s.a, s.b, s.n, s.rule) : undefined} testid="ni-curve" label={`The curve ${integral} with ${s.n} slices drawn by ${ruleInText(s.rule)}. The slices add up to ${num(s.value, 6)}; the exact area is ${num(s.exact, 6)}.`} /><Legend />
      <p className="ni-caption centre" data-testid="ni-verdict">{!finite ? 'This rule evaluates the curve at x = 0, where it is infinite, so it has no answer at all.' : s.zero ? 'The slices and the curve cover exactly the same area. What is counted in error and what is missed cancel.' : `Red less blue is the error: ${err(s.error, false)}. The slices come out too ${s.error > 0 ? 'large' : 'small'}.`}</p></div>
    <div className="ni-stats">
      <Stat label="Exact, from the formula" id="ni-exact" value={num(s.exact, 8)}>[{s.fn.formula}] from {bound(s.a)} to {bound(s.b)}.</Stat>
      <Stat label="Numeric estimate" id="ni-value" value={num(s.value, 8)}>{count(s.n)} {s.n === 1 ? 'slice' : 'slices'}, each {num(s.width, 3)} wide.</Stat>
      <Stat label="Error" id="ni-error" value={err(s.error, s.zero)}>{!finite ? 'One infinite sample ruins the sum.' : s.zero ? 'Only the computer’s own rounding is left.' : 'Estimate minus exact.'}</Stat>
      <Stat label="Relative error" id="ni-relative" value={!finite ? '—' : s.zero ? '0' : s.relative >= 1e-3 ? percent(s.relative, 2) : sci(s.relative)}>{finite ? `${correctDigits(s.relative)} correct digits.` : 'No digits at all.'}</Stat>
      <Stat label="Function evaluations" id="ni-evaluations" value={count(s.evaluations)}>The cost: how many times the curve’s height was worked out.</Stat>
      <Stat label="Doubling the slices" id="ni-ratio" value={shrink(s.ratio)}>{s.ratio === null ? (finite ? 'Nothing left to shrink.' : 'Still infinite.') : `What the error does. On a smooth curve this rule gives ÷ ${2 ** rule.order}.`}</Stat>
      <Stat label="Guaranteed bound" id="ni-bound" value={s.limit === null || !Number.isFinite(s.limit) ? 'None' : s.limit === 0 ? '0' : sci(s.limit)}>{s.limit === null ? 'Not worked out for this curve.' : !Number.isFinite(s.limit) ? 'The textbook promise needs a finite slope, and this curve is vertical at an end.' : `The textbook promise, from the largest ${DERIVATIVE[s.rule]} derivative. The error is never above it.`}</Stat>
      <Stat label="Slice width" id="ni-width" value={num(s.width, 4)}>The error is proportional to this to the power {rule.order}.</Stat>
    </div>
    <section className="ni-charts" aria-label="How the error shrinks">
      <div className="ni-chart"><div className="ni-chart-heading"><h3>Error against slices</h3><span>BOTH AXES LOGARITHMIC</span></div><LogChart series={errorSeries(s)} mark={{ x: s.n, y: Math.abs(s.error), tint: RULE_TINT[s.rule] }} limit={{ y: 2.2e-16 * Math.max(1, Math.abs(s.exact)), text: 'rounding limit of the computer' }} xLabel="number of slices" testid="ni-errors" label={`The size of the error against the number of slices for all five rules. ${rule.name} is highlighted.`} /><p>A straight line means the error is a power of the slice width, and the steepness is the power. Nothing goes below the dashed line: there the computer runs out of digits.</p></div>
      <div className="ni-chart"><div className="ni-chart-heading"><h3>Keep doubling</h3><span>{rule.short.toUpperCase()} · FROM {count(s.n)} SLICES</span></div><ConvergenceTable rows={s.rows} exact={s.exact} /><p>The last column is the rule’s signature: ÷ 2 for rectangles at an edge, ÷ 4 for midpoints and trapezoids, ÷ 16 for Simpson. A curve that is not smooth gives itself away here.</p></div>
    </section>
  </>;
}

function OpenStage({ s, p }: { s: Solved; p: number }) {
  const rule = ruleOf(s.rule), need = (relative: number) => { const n = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536].find(k => Math.abs(integrate(s.f, s.a, s.b, k, s.rule) - s.exact) <= relative * Math.abs(s.exact)); return n ? count(n) : 'Over 65,536'; };
  const six = useMemo(() => need(5e-7), [s]), twelve = useMemo(() => need(5e-13), [s]), meaning = s.fn.meaning?.(s.value, s.a, s.b, p);
  return <>
    <div className="ni-stage-heading"><div><span className="ni-status-dot" />{rule.name}, {count(s.n)} slices, no formula</div><span>AREA UNDER <b>{s.fn.label}</b> · <b>{bound(s.a)}</b> TO <b>{bound(s.b)}</b></span></div>
    <div className="ni-picture"><CurveChart f={s.f} a={s.a} b={s.b} n={s.n} rule={s.rule} points={s.n <= 64 ? samplePoints(s.a, s.b, s.n, s.rule) : undefined} testid="ni-curve" label={`The curve ${s.fn.label} from ${bound(s.a)} to ${bound(s.b)} with ${s.n} slices. Its area has no formula; the slices add up to ${num(s.value, 6)}.`} /><Legend />
      <p className="ni-caption centre" data-testid="ni-meaning">{meaning || s.fn.about}</p></div>
    <div className="ni-stats">
      <Stat label="Formula for the area" id="ni-formula" value="None">It has only a name: {s.fn.special}.</Stat>
      <Stat label="Numeric estimate" id="ni-value" value={num(s.value, 8)}>{count(s.n)} slices, {count(s.evaluations)} evaluations of the curve.</Stat>
      <Stat label="Error, self-checked" id="ni-estimate" value={sci(s.estimate)}>How far the answer moves when the slices double. It needs no formula.</Stat>
      <Stat label="Error, actual" id="ni-error" value={err(s.error, s.zero)}>Against the reference. {correctDigits(s.relative)} correct digits.</Stat>
      <Stat label="Slices for 6 digits" id="ni-six" value={six}>With {ruleInText(s.rule)}.</Stat>
      <Stat label="Slices for 12 digits" id="ni-twelve" value={twelve}>{twelve.startsWith('Over') ? 'This rule is too slow. Try Simpson.' : 'A fraction of a millisecond of arithmetic.'}</Stat>
      <Stat label="Reference value" id="ni-reference" value={num(s.exact, 12)}>From a much finer rule: 5,120 evaluations.</Stat>
      <Stat label="Doubling the slices" id="ni-ratio" value={shrink(s.ratio)}>What the error does. Expect ÷ {2 ** rule.order}, unless the curve is a full wave.</Stat>
    </div>
    <section className="ni-charts" aria-label="The missing formula as a curve">
      <div className="ni-chart"><div className="ni-chart-heading"><h3>The area so far</h3><span>THE ANTIDERIVATIVE, DRAWN</span></div><AreaChart f={s.f} a={s.a} b={s.b} total={s.exact} /><p>A formula for this curve does not exist, but the curve does. It is as smooth and as definite as x³/3. Only our notation falls short.</p></div>
      <div className="ni-chart"><div className="ni-chart-heading"><h3>Can the error be trusted?</h3><span>WITHOUT KNOWING THE ANSWER</span></div><LogChart series={[{ key: 'actual', name: 'actual error', tint: RULE_TINT[s.rule], points: s.selfCheck.map(r => [r.n, r.actual]), strong: true }, { key: 'estimate', name: 'self-check: change on doubling', tint: '#33444b', points: s.selfCheck.map(r => [r.n, r.estimate]), dashed: true }]} mark={{ x: s.n, y: Math.abs(s.error), tint: RULE_TINT[s.rule] }} xLabel="number of slices" testid="ni-selfcheck" label="The actual error and the error estimated by doubling the slices, against the number of slices. The two lines stay together." /><p>With no formula there is nothing to check against. But the change on doubling tracks the true error closely, so the slices can report their own accuracy.</p></div>
    </section>
  </>;
}

function DataStage({ trip }: { trip: Trip }) {
  const interval = INTERVALS[trip.interval], readings = sampleTrip(interval, trip.noise, trip.seed), distance = trapezoidData(readings), error = distance - TRIP_DISTANCE;
  const sweep = useMemo(() => INTERVALS.map(dt => ({ dt, ...repeatErrors(dt, trip.noise) })), [trip.noise]), here = sweep[trip.interval];
  const series = [{ key: 'coarse', name: 'from logging too rarely', tint: '#4d7fc0', points: sweep.map(r => [r.dt, Math.abs(r.clean)] as [number, number]), strong: true }, ...(trip.noise > 0 ? [{ key: 'noise', name: 'from sensor noise (typical)', tint: '#c65a48', points: sweep.map(r => [r.dt, r.spread] as [number, number]), strong: true }] : [])];
  return <>
    <div className="ni-stage-heading"><div><span className="ni-status-dot" />A speed log, one reading every {interval} s</div><span><b>{readings.length}</b> READINGS · <b>{metres(distance)}</b> TRAVELLED</span></div>
    <div className="ni-picture"><TripChart readings={readings} distance={distance} /><div className="ni-legend"><span><i className="ring" />a logged reading</span><span><i style={{ background: ACCENT }} />straight lines between readings</span><span><i className="dashed" />what the car really did</span></div>
      <p className="ni-caption centre">Distance is the area under speed. With only readings, the area is a sum of trapezoids: each pair of readings, averaged, times the seconds between them.</p></div>
    <div className="ni-stats">
      <Stat label="Readings" id="ni-readings" value={count(readings.length)}>One every {interval} s for two minutes.</Stat>
      <Stat label="Distance from the log" id="ni-distance" value={metres(distance, 1)}>The trapezoid sum of the readings.</Stat>
      <Stat label="True distance" id="ni-true" value={metres(TRIP_DISTANCE, 1)}>Known only because the lab invented this trip. A real car has no such number.</Stat>
      <Stat label="Error" id="ni-trip-error" value={metres(error, 1)}>{percent(error / TRIP_DISTANCE, 2)} of the trip.</Stat>
      <Stat label="Noise in one reading" id="ni-reading-noise" value={percent(trip.noise / TRIP_MEAN_SPEED, 0)}>±{trip.noise.toFixed(1)} m/s on an average speed of {TRIP_MEAN_SPEED.toFixed(1)} m/s.</Stat>
      <Stat label="Noise in the total" id="ni-total-noise" value={percent(here.spread / TRIP_DISTANCE, 2)}>Typical scatter of the distance, ±{metres(here.spread, 1)}. Random errors mostly cancel in a sum.</Stat>
      <Stat label="From coarseness alone" id="ni-coarse" value={metres(here.clean, Math.abs(here.clean) < 0.05 ? 3 : 1)}>The error a perfect sensor would make at this interval.</Stat>
      <Stat label="Formula" id="ni-data-formula" value="None">There is no function here to find an antiderivative of. Only numbers.</Stat>
    </div>
    <section className="ni-charts" aria-label="Two sources of error">
      <div className="ni-chart"><div className="ni-chart-heading"><h3>Two sources of error</h3><span>METRES · BOTH AXES LOGARITHMIC</span></div><LogChart series={series} mark={{ x: interval, y: Math.max(Math.abs(here.clean), 1e-3), tint: '#4d7fc0' }} least={1e-3} limit={{ y: 1e-3, text: 'a millimetre or less' }} xTicks={[0.5, 1, 2, 5, 10, 30]} xLabel="seconds between readings" testid="ni-sources" label="Distance error against the logging interval, from coarse sampling and from sensor noise." /><p>Logging more often removes the first kind of error very quickly and the second only slowly. Past a point, a faster logger buys nothing and a better sensor is what counts.</p></div>
      <div className="ni-chart"><div className="ni-chart-heading"><h3>Sixty repeats of the same trip</h3><span>EACH DOT ONE SET OF READINGS</span></div><RepeatChart errors={here.errors} clean={here.clean} spread={here.spread} current={error} /><p>{trip.noise > 0 ? 'Each repeat has different random noise. The marker is the log shown above.' : 'With a perfect sensor every repeat gives the same answer. Add sensor noise to spread them out.'}</p></div>
    </section>
  </>;
}

function AdaptiveStage({ set }: { set: Spike }) {
  const target = 10 ** -set.digits;
  const sweep = useMemo(() => {
    const sp = spike(set.width), by = [2, 3, 4, 5, 6, 7, 8, 9, 10].map(digits => ({ digits, adaptive: adaptiveSimpson(sp.f, 0, 1, 10 ** -digits), even: evenSimpson(sp.f, 0, 1, 10 ** -digits) }));
    const even = [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192].map(n => [n + 1, Math.abs(integrate(sp.f, 0, 1, n, 'simpson') - sp.exact)] as [number, number]);
    return { sp, by, even };
  }, [set.width]);
  const { sp } = sweep, { adaptive, even } = sweep.by.find(r => r.digits === set.digits)!, adaptiveError = adaptive.value - sp.exact, evenError = even.value - sp.exact;
  const gaps = adaptive.points.slice(1).map((x, i) => x - adaptive.points[i]), smallest = Math.min(...gaps), largest = Math.max(...gaps), met = (error: number) => Math.abs(error) <= target;
  return <>
    <div className="ni-stage-heading"><div><span className="ni-status-dot" />Adaptive Simpson, accurate to {tolerance(set.digits)}</div><span><b>{count(adaptive.evaluations)}</b> EVALUATIONS · EVEN SLICES NEED <b>{count(even.evaluations)}</b></span></div>
    <div className="ni-picture"><CurveChart f={sp.f} a={0} b={1} points={adaptive.points} testid="ni-curve" label={`A narrow spike at x = 0.37. The adaptive rule evaluated the curve at ${adaptive.evaluations} points, crowded round the spike.`} />
      <p className="ni-caption centre">Each tick under the axis is a place the adaptive rule evaluated the curve. It spends its effort at the spike and almost none on the flat parts.</p></div>
    <div className="ni-stats">
      <Stat label="Exact, from the formula" id="ni-spike-exact" value={num(sp.exact, 8)}>w·arctan((x − c)/w): this spike has a formula, so both methods can be marked.</Stat>
      <Stat label="Accuracy asked for" id="ni-tolerance" value={tolerance(set.digits)}>Both methods stop when their own self-check says they are this close.</Stat>
      <Stat label="Adaptive: evaluations" id="ni-adaptive-evals" value={count(adaptive.evaluations)}>Closest together {sci(smallest, 1)}, furthest apart {num(largest, 2)}.</Stat>
      <Stat label="Adaptive: error" id="ni-adaptive-error" value={err(adaptiveError, false)}>{met(adaptiveError) ? 'Within what was asked.' : 'Outside what was asked: its self-check was too optimistic.'}</Stat>
      <Stat label="Even slices: evaluations" id="ni-even-evals" value={count(even.evaluations)}>{count(even.n)} equal slices, each {sci(1 / even.n, 1)} wide.</Stat>
      <Stat label="Even slices: error" id="ni-even-error" value={err(evenError, false)}>{met(evenError) ? 'Within what was asked.' : 'Outside what was asked: its self-check was too optimistic.'}</Stat>
      <Stat label="Work saved" id="ni-saving" value={`× ${num(even.evaluations / adaptive.evaluations, 3)}`}>{even.evaluations >= adaptive.evaluations ? 'Fewer evaluations for the same request.' : 'Here equal slices are cheaper: at very tight accuracy every part of the curve needs fine slices.'}</Stat>
      <Stat label="Area in the spike" id="ni-spike-share" value={percent(set.width * 2 * Math.atan(5) / sp.exact, 0)}>Within five half-widths of the peak: {percent(set.width * 10, 0)} of the interval.</Stat>
    </div>
    <section className="ni-charts" aria-label="Even against adaptive">
      <div className="ni-chart"><div className="ni-chart-heading"><h3>Error against effort</h3><span>BOTH AXES LOGARITHMIC</span></div><LogChart series={[{ key: 'even', name: 'equal slices', tint: RULE_TINT.simpson, points: sweep.even, strong: true }, { key: 'adaptive', name: 'adaptive', tint: ACCENT, points: sweep.by.map(r => [r.adaptive.evaluations, Math.abs(r.adaptive.value - sp.exact)] as [number, number]), strong: true }]} mark={{ x: adaptive.evaluations, y: Math.abs(adaptiveError), tint: ACCENT }} xLabel="function evaluations" testid="ni-effort" label="Error against the number of function evaluations, for equal slices and for the adaptive rule." /><p>Equal slices are useless until they are finer than the spike, then improve fast. The adaptive rule gets useful answers early. Make the spike narrower to pull the two apart.</p></div>
      <div className="ni-chart"><div className="ni-chart-heading"><h3>The price of each extra digit</h3><span>EVALUATIONS NEEDED</span></div><Table testid="ni-prices" head={['Accuracy', 'Adaptive', 'Equal slices', 'Adaptive error']} rows={sweep.by.filter(r => r.digits % 2 === 0).map(r => [tolerance(r.digits), count(r.adaptive.evaluations), count(r.even.evaluations), err(r.adaptive.value - sp.exact, false)])} /><p>A hundred times more accuracy costs roughly three times the work, not a hundred. That is why asking a computer for an integral to ten digits is routine.</p></div>
    </section>
  </>;
}

export default function App() {
  const [start] = useState(startingPreset);
  const [presetKey, setPresetKey] = useState(start.preset.key), [stage, setStage] = useState<Stage>(start.preset.stage), [unknownLink, setUnknownLink] = useState(start.unknown);
  const [slice, setSlice] = useState<Setup>(start.preset.slice ?? SLICE), [open, setOpen] = useState<Setup>(start.preset.open ?? OPEN);
  const [situation, setSituation] = useState<Situation>(start.preset.situation ?? 'data'), [trip, setTrip] = useState<Trip>(start.preset.trip ?? TRIP), [spikeSet, setSpikeSet] = useState<Spike>(start.preset.spike ?? SPIKE), [trap, setTrap] = useState<Setup>(start.preset.trap ?? TRAP);
  const preset = PRESETS.find(p => p.key === presetKey)!;

  function load(key: string) {
    const next = PRESETS.find(p => p.key === key)!;
    setPresetKey(key); setStage(next.stage); setUnknownLink(false);
    if (next.slice) setSlice(next.slice);
    if (next.open) setOpen(next.open);
    if (next.situation) setSituation(next.situation);
    if (next.trip) setTrip(next.trip);
    if (next.spike) setSpikeSet(next.spike);
    if (next.trap) setTrap(next.trap);
    window.history.replaceState(null, '', `?preset=${key}`);
  }
  const active = stage === 'formula' ? slice : stage === 'none' ? open : trap, solved = useMemo(() => solve(active), [active]);
  const tip = stage === 'formula' ? 'Press “Double the slices” a few times and watch the error. Then change the rule and do it again.' : stage === 'none' ? 'Try plain trapezoids on the pendulum or the ellipse. Over a full wave they beat Simpson.' : situation === 'data' ? 'Turn the noise up, then log more often. Then leave the noise off and log less often. The two errors behave differently.' : situation === 'adaptive' ? 'Narrow the spike and watch the ticks crowd together. At the narrowest, loose accuracy can miss it altogether.' : 'Change the slices by one step either way. A wrong answer that jumps about when the slices change is the warning sign.';

  return <div className="ni-app">
    <header className="ni-header"><a className="ni-brand" href="/"><span><ChartArea size={20} strokeWidth={1.6} /></span>integral<span className="muted">lab.</span></a><a className="ni-back" href="/"><ArrowLeft size={13} />All simulators</a></header>
    <main>
      <section className="ni-hero"><div><span className="eyebrow">FROM EXACT FORMULAS TO ADDING UP SLICES</span><h1>Some areas have a formula.<br />Every area has a <em>sum.</em></h1><p>Cut the area under a curve into slices and add them up. See how wrong that is when a formula knows the answer, <br />then meet the curves where no formula exists and the slices are all anyone has.</p><a href="#lab">Start with the slices <ArrowDown size={14} /></a></div>
        <div className="ni-hero-note" aria-hidden="true"><svg viewBox="0 0 220 90">{[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={22 + i * 29} y={80 - 68 * Math.sin((i + 0.5) / 6 * Math.PI)} width="29" height={68 * Math.sin((i + 0.5) / 6 * Math.PI)} fill={ACCENT} fillOpacity=".16" stroke={ACCENT} strokeOpacity=".6" />)}<path d={`M22 80${Array.from({ length: 30 }, (_, i) => `L${(22 + (i + 1) * 5.8).toFixed(1)} ${(80 - 68 * Math.sin((i + 1) / 30 * Math.PI)).toFixed(1)}`).join('')}`} fill="none" stroke="#33444b" strokeWidth="1.8" /><path d="M14 80H206" stroke="#bdbcae" /></svg><p>A formula is exact, when there is one.<br />A sum is close, always.</p><span>FORMULA · NO FORMULA · PRACTICE</span></div></section>
      <div className="ni-section-heading"><span className="eyebrow">THREE LINKS OF ONE CHAIN</span><span>FIVE RULES · REAL ARITHMETIC · NOTHING TUNED BY HAND</span></div>
      <nav className="ni-chain" aria-label="Stages">{STAGES.map((item, i) => <button key={item.key} aria-pressed={stage === item.key} onClick={() => setStage(item.key)}><b>{i + 1}</b><span>{item.name}<small>{item.made}</small></span>{i < 2 && <ArrowRight size={14} />}</button>)}</nav>
      <section id="lab" className="ni-lab" aria-label="Numerical integration simulation">
        <aside className="ni-settings">
          <div className="ni-panel-heading"><h2>Build the experiment</h2><SlidersHorizontal size={15} /></div>
          <label className="ni-label" htmlFor="ni-preset">Start with an experiment</label>
          <select id="ni-preset" value={presetKey} onChange={event => load(event.target.value)}>{GROUPS.map(group => <optgroup key={group} label={group}>{PRESETS.filter(p => p.group === group).map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</optgroup>)}</select>
          <p className="ni-hint" data-testid="ni-notice">{preset.stage === stage && (stage !== 'practice' || preset.situation === situation) ? preset.notice : 'You have moved to another part of the lab. Pick one of its experiments above, or use the controls below.'}</p>
          {unknownLink && <p className="ni-error" role="status">That link names an experiment this lab does not have, so it opened the first one.</p>}

          {stage === 'formula' && <SetupControls list={FORMULA} setup={slice} onChange={setSlice} />}
          {stage === 'none' && <SetupControls list={NO_FORMULA} setup={open} onChange={setOpen} />}
          {stage === 'practice' && <>
            <details open><summary>The situation</summary><div className="ni-fields"><div className="ni-switch stack" role="group" aria-label="Situation">{SITUATIONS.map(item => <button key={item.key} aria-pressed={situation === item.key} onClick={() => setSituation(item.key)}>{item.name}</button>)}</div></div></details>
            {situation === 'data' && <details open><summary>The logger</summary><div className="ni-fields">
              <Slider label="Time between readings" value={trip.interval} min={0} max={INTERVALS.length - 1} step={1} text={`${INTERVALS[trip.interval]} s`} onChange={interval => setTrip({ ...trip, interval })} />
              <Slider label="Sensor noise" value={trip.noise} min={0} max={3} step={0.1} text={`±${trip.noise.toFixed(1)} m/s`} onChange={noise => setTrip({ ...trip, noise })} />
              <button disabled={trip.noise === 0} onClick={() => setTrip({ ...trip, seed: trip.seed + 1 })}><RefreshCw size={13} />Drive it again</button>
            </div></details>}
            {situation === 'adaptive' && <details open><summary>The request</summary><div className="ni-fields">
              <Slider label="Accuracy asked for" value={spikeSet.digits} min={2} max={10} step={1} text={tolerance(spikeSet.digits)} onChange={digits => setSpikeSet({ ...spikeSet, digits })} />
              <Slider label="Spike half-width" value={spikeSet.width} min={0.001} max={0.05} step={0.001} text={spikeSet.width.toFixed(3)} onChange={width => setSpikeSet({ ...spikeSet, width })} />
            </div></details>}
            {situation === 'trap' && <SetupControls list={TRAPS} setup={trap} onChange={setTrap} />}
          </>}
          <div className="ni-tip"><Lightbulb size={16} /><p>{tip}</p></div>
        </aside>

        <div className="ni-stage">
          {stage === 'formula' && <SliceStage s={solved} />}
          {stage === 'none' && <OpenStage s={solved} p={open.p} />}
          {stage === 'practice' && situation === 'data' && <DataStage trip={trip} />}
          {stage === 'practice' && situation === 'adaptive' && <AdaptiveStage set={spikeSet} />}
          {stage === 'practice' && situation === 'trap' && <SliceStage s={solved} />}
        </div>
      </section>

      <section className="ni-understand"><span className="eyebrow">WHAT THE LAB IS SHOWING</span><h2>The formula is the exception. <em>The sum is the rule.</em></h2>
        <div className="ni-explanations">
          <article><span>01 · THE ERROR</span><h3>It is small, and it is predictable.</h3><p>Slices never match a curve exactly, but they miss in an orderly way. Halve the width and rectangles halve their error, trapezoids quarter it, and Simpson’s parabolas cut it sixteen-fold. Because the error follows a law, you can say how many slices any accuracy will cost before doing the work.</p></article>
          <article><span>02 · NO FORMULA</span><h3>Most integrals cannot be written down.</h3><p>Differentiating any formula gives another formula. Going backwards usually does not. The bell curve, the swing of a pendulum, the length of an ellipse: each is a perfectly good area with no expression for it. Mathematicians gave these areas names and then computed them the only way possible, by adding.</p></article>
          <article><span>03 · IN PRACTICE</span><h3>Real problems come as numbers.</h3><p>A sensor gives readings, not a function, so a sum is the only integral there is. A sum also averages out random noise. What a sum cannot do is know what happened between its samples. A spike nobody sampled, or a wave in step with the slices, produces a confident wrong answer.</p></article>
        </div>
        <details className="ni-rules"><summary>Inside the model</summary><div>
          <p><b>The rules.</b> With <code>n</code> slices of width <code>h = (b − a)/n</code>: left and right rectangles use the curve’s height at one edge of each slice, midpoint rectangles at the centre, trapezoids the average of both edges, and Simpson’s rule a parabola through each pair of slices, <code>h/3·(f₀ + 4f₁ + 2f₂ + … + 4f<sub>n−1</sub> + f<sub>n</sub>)</code>. On a smooth curve their errors are proportional to <code>h</code>, <code>h²</code>, <code>h²</code>, and <code>h⁴</code>.</p>
          <p><b>The bounds.</b> The guaranteed bounds are the textbook ones: <code>(b−a)²/(2n)·max|f′|</code> for edge rectangles, <code>(b−a)³/(24n²)·max|f″|</code> for midpoints, twice that for trapezoids, and <code>(b−a)⁵/(180n⁴)·max|f⁗|</code> for Simpson, using exact derivatives sampled across the interval.</p>
          <p><b>No formula.</b> The reference value is five-point Gauss–Legendre quadrature on 1,024 panels, accurate to about fourteen digits for these curves. The self-check is the change in the answer when the slices double. A pendulum of length <code>L</code> released at angle <code>θ</code> has period <code>4√(L/g)·∫ dφ/√(1 − k² sin²φ)</code> from 0 to π/2 with <code>k = sin(θ/2)</code>.</p>
          <p><b>In practice.</b> The trip is an invented smooth speed curve, sampled exactly and then given normally distributed noise from a seeded generator. The adaptive rule is recursive Simpson: starting from eight pieces, it splits a piece when its two halves differ from the whole by more than fifteen times that piece’s share of the tolerance. Equal slices are doubled from 16 until two answers agree to the tolerance.</p>
          <p>Left out: Gaussian and Romberg rules as things to play with, integrals over infinite ranges, integrals in more than one dimension, Monte Carlo methods, and changes of variable that remove an infinite end. All arithmetic is ordinary double precision, so no error can fall much below 10⁻¹⁶ of the answer.</p>
        </div></details>
      </section>
    </main>
    <footer><span>integral lab. · lixionary / simulators</span><a href="/">Explore all simulators <ArrowUpRight size={12} /></a></footer>
  </div>;
}

