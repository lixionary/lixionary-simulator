import type { CSSProperties } from 'react';
import { Leaf, Moon, Snowflake, Sprout, Sun, Sunrise } from 'lucide-react';
import { duration, latitudeLabel, MIN_SEASON_TILT, nightDuration, type Season, type Zone } from './model';

type LightState = 'normal' | 'polar-day' | 'polar-night' | 'horizon';
type Props = { season: Season | null; zone: Zone; lightState: LightState; latitude: number; tilt: number; dayHours: number };

const COPY: Record<Season, { title: string; particles: 'petal' | 'leaf' | 'snow' | null; text: string }> = {
  spring: { title: 'Spring', particles: 'petal', text: 'Days are lengthening and the noon Sun climbs higher each day. Blossom time.' },
  summer: { title: 'Summer', particles: null, text: 'Your hemisphere leans toward the Sun: long days, a high noon Sun, and the most direct sunlight of the year.' },
  autumn: { title: 'Autumn', particles: 'leaf', text: 'Days are shortening and the noon Sun sinks lower each day. Leaves turn red.' },
  winter: { title: 'Winter', particles: 'snow', text: 'Your hemisphere leans away from the Sun: short days, a low noon Sun, and slanting, weaker sunlight.' },
};
const ICONS = { spring: Sprout, summer: Sun, autumn: Leaf, winter: Snowflake };
const MAPLE = 'M12 2l1.6 3.6 2.8-1.3-.7 4 3.6-.9-1.5 3.4 3.2 1.3-4.4 3.2.9 2.5-4.6-.8V22h-1.8v-5l-4.6.8.9-2.5L3 12.1l3.2-1.3-1.5-3.4 3.6.9-.7-4 2.8 1.3z';

// Deterministic scatter so the scene is stable between renders.
const scatter = (i: number, step: number, span: number) => (i * step) % span;

function Particles({ kind }: { kind: 'petal' | 'leaf' | 'snow' }) {
  const count = kind === 'snow' ? 34 : 18;
  return <>{Array.from({ length: count }, (_, i) => {
    const style = { left: `${scatter(i, 37, 100)}%`, animationDuration: `${(kind === 'snow' ? 6 : 7) + scatter(i, 13, 6)}s`, animationDelay: `${-scatter(i, 29, 11)}s`, '--drift': `${scatter(i, 17, 60) - 30}px`, '--size': `${(kind === 'snow' ? 3 : 9) + scatter(i, 7, kind === 'snow' ? 4 : 6)}px` } as CSSProperties;
    return kind === 'leaf'
      ? <svg key={i} className="season-particle leaf" style={style} viewBox="0 0 24 24" aria-hidden="true"><path d={MAPLE} fill={['#c8402f', '#d9632c', '#a92f2a'][i % 3]} /></svg>
      : <i key={i} className={`season-particle ${kind}`} style={style} />;
  })}</>;
}

export function SeasonCard({ season, zone, lightState, latitude, tilt, dayHours }: Props) {
  const polarDay = lightState === 'polar-day', polarNight = lightState === 'polar-night';
  const mild = tilt < MIN_SEASON_TILT;
  const scene = polarNight ? 'polar-night' : polarDay ? 'polar-day' : season ?? 'tropical';
  const Icon = polarNight ? Moon : polarDay ? Sunrise : season ? ICONS[season] : Sun;
  const hemisphere = latitude > 0 ? 'Northern hemisphere' : latitude < 0 ? 'Southern hemisphere' : 'On the equator';
  const zoneName = zone === 'tropical' ? 'tropics' : zone === 'polar' ? 'polar region' : Math.abs(latitude) < 35 ? 'subtropics' : 'temperate zone';
  const title = season ? COPY[season].title : mild ? 'Hardly any seasons' : 'No four seasons here';
  const text = season
    ? polarNight ? 'The Sun never clears the horizon today. Above the polar circle, deep winter brings a night that lasts for days or months.'
      : polarDay ? 'The Sun circles the sky without setting. Above the polar circle, high summer brings the midnight Sun.'
      : COPY[season].text
    : mild ? `With only ${tilt.toFixed(1)}° of tilt, sunlight barely changes through the year, so spring, summer, autumn and winter never really arrive.`
      : 'Between the tropics the noon Sun stays high all year and day length hardly changes. Warmth is constant; rain, not sunlight, sets the rhythm of wet and dry seasons.';
  const particles = polarNight ? 'snow' : polarDay ? null : season ? COPY[season].particles : null;
  return <section className="season-card" aria-labelledby="season-title">
    <div className={`season-scene scene-${scene}`} aria-hidden="true">
      {polarNight ? <>{Array.from({ length: 22 }, (_, i) => <i key={i} className="season-star" style={{ left: `${scatter(i, 43, 100)}%`, top: `${scatter(i, 31, 62)}%`, animationDelay: `${-scatter(i, 7, 5)}s` }} />)}<i className="season-aurora" /></> : <span className="season-sun"><i /></span>}
      <i className="season-ground" />
      {season === 'spring' && !polarDay && !polarNight && <i className="season-tree blossom" />}
      {season === 'autumn' && !polarDay && !polarNight && <i className="season-tree maple" />}
      {particles && <Particles kind={particles} />}
    </div>
    <div className="season-copy">
      <span className="eyebrow">THE SEASON AT {latitudeLabel(latitude).toUpperCase()}</span>
      <h2 id="season-title" data-testid="season"><Icon size={18} strokeWidth={1.6} />{title}</h2>
      <p className="season-zone" data-testid="season-zone">{hemisphere} · {zoneName}{polarDay ? ' · polar day' : polarNight ? ' · polar night' : ''}</p>
      <p>{text}</p>
      <div className="season-split"><span><Sun size={12} />Day <strong>{duration(dayHours)}</strong></span><span><Moon size={12} />Night <strong>{nightDuration(dayHours)}</strong></span></div>
    </div>
  </section>;
}
