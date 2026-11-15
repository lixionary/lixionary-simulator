import { heatPump, outsideOf, withOutside, ZERO_C, type Mode, type Pump, type PumpState } from './model';
import { celsius, cop, si } from './format';
import { HOT } from './CycleViews';

/** What each machine calls its two sides, and the range of weather it is tried in (°C). */
export const SIDES: Record<Mode, { cold: string; hot: string; outside: string; inside: string; range: [number, number]; insideRange: [number, number]; leakRange: [number, number, number] }> = {
  fridge: { cold: 'Inside the refrigerator', hot: 'The kitchen', outside: 'Kitchen temperature', inside: 'Temperature inside', range: [15, 40], insideRange: [-30, 10], leakRange: [0.5, 5, 0.1] },
  cooler: { cold: 'Your room', hot: 'Outdoors', outside: 'Outdoor temperature', inside: 'Room temperature', range: [28, 50], insideRange: [18, 27], leakRange: [50, 500, 10] },
  heater: { cold: 'Outdoors', hot: 'Your room', outside: 'Outdoor temperature', inside: 'Room temperature', range: [-30, 15], insideRange: [16, 26], leakRange: [50, 500, 10] },
};

/** Coefficient of performance, or the electricity needed, against the weather. */
export function PumpChart({ pump, s, kind }: { pump: Pump; s: PumpState; kind: 'cop' | 'power' }) {
  const W = 440, H = 230, left = 58, right = W - 14, top = 18, bottom = 190, [low, high] = SIDES[pump.mode].range, heating = pump.mode === 'heater', isCop = kind === 'cop';
  const temps = Array.from({ length: 101 }, (_, i) => low + i * (high - low) / 100), states = temps.map(t => heatPump(withOutside(pump, t + ZERO_C)));
  const value = (state: PumpState) => isCop ? state.cop : state.electricity, limit = (state: PumpState) => isCop ? Math.min(state.limit, 1e3) : state.demand;
  const ceiling = isCop ? Math.max(...states.map(value)) * 2.2 : Math.max(...states.map(heating ? limit : value)) * 1.12;
  const px = (t: number) => left + (t - low) / (high - low) * (right - left), py = (v: number) => bottom - Math.min(1.05, v / ceiling) * (bottom - top);
  const line = (of: (state: PumpState) => number) => temps.map((t, i) => `${px(t).toFixed(1)},${py(of(states[i])).toFixed(1)}`).join(' ');
  const here = outsideOf(pump) - ZERO_C, showLimit = isCop || heating;
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" data-testid={`th-${kind}-curve`} aria-label={isCop ? `Coefficient of performance against ${SIDES[pump.mode].outside.toLowerCase()}. It is ${cop(s.cop)} at ${celsius(outsideOf(pump))}.` : `Electricity needed against ${SIDES[pump.mode].outside.toLowerCase()}. It is ${si(s.electricity, 'W')} at ${celsius(outsideOf(pump))}.`}>
    <clipPath id={`th-clip-${kind}`}><rect x={left} y={top - 2} width={right - left} height={bottom - top + 2} /></clipPath>
    <path d={`M${left} ${top}V${bottom}H${right}`} fill="none" stroke="#bdbcae" />
    {isCop && <><path d={`M${left} ${py(1)}H${right}`} stroke="#cfc9bb" strokeDasharray="3 5" /><text x={right} y={py(1) - 5} textAnchor="end">{heating ? 'electric heater: 1' : '1: a joule moved per joule spent'}</text></>}
    {showLimit && <polyline clipPath={`url(#th-clip-${kind})`} points={line(limit)} fill="none" stroke={HOT} strokeWidth="1.4" strokeDasharray="4 4" />}
    <polyline clipPath={`url(#th-clip-${kind})`} points={line(value)} fill="none" stroke="#b5532f" strokeWidth="2.2" />
    <circle data-dot cx={px(here)} cy={py(value(s))} r="5" fill="#b5532f" stroke="#fbfaf7" strokeWidth="1.5" />
    {py(value(s)) < bottom - 14 && <text x={left - 5} y={bottom + 3} textAnchor="end">0</text>}<text x={left - 5} y={py(value(s)) + 3} textAnchor="end">{isCop ? cop(s.cop) : si(s.electricity, 'W')}</text>
    <text x={left} y={bottom + 14}>{celsius(low + ZERO_C)}</text><text x={right} y={bottom + 14} textAnchor="end">{celsius(high + ZERO_C)}</text>
    <text x={(left + right) / 2} y={H - 5} textAnchor="middle">{SIDES[pump.mode].outside.toLowerCase()}</text>
    {showLimit && <text x={heating && isCop ? left + 8 : right - 4} y={top + 8} textAnchor={heating && isCop ? 'start' : 'end'}>dashed: {isCop ? 'the limit for any machine' : 'an electric heater'}</text>}
  </svg>;
}
