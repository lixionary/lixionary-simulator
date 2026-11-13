import { altitude, coordinates, dateLabel, EARTH_TILT, EVENTS, RAD } from './model';

export function OrbitDiagram({ day, tilt, onSelect }: { day: number; tilt: number; onSelect: (day: number) => void }) {
  const longitude = coordinates(day, tilt).longitude * RAD;
  // North-ecliptic-pole view: Earth revolves counterclockwise. Its projected
  // north axis always points left, toward the Sun at the June solstice.
  const point = (lambda: number) => ({ x: 380 + 223 * Math.sin(lambda), y: 218 + 139 * Math.cos(lambda) });
  const earth = point(longitude);
  return <svg className="orbit-diagram" viewBox="0 0 760 420" role="img" aria-label={`Earth's position on ${dateLabel(day)}. Its axis keeps a fixed direction as Earth orbits the Sun.`}>
    <defs>
      <radialGradient id="sun-fill"><stop stopColor="#ffe2a3" /><stop offset="1" stopColor="#edb459" /></radialGradient>
      <radialGradient id="earth-fill" cx="35%" cy="30%"><stop stopColor="#b9b6d1" /><stop offset="1" stopColor="#74718e" /></radialGradient>
      <marker id="orbit-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#b7b4a7" /></marker>
    </defs>
    {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={42 + ((i * 113) % 676)} cy={30 + ((i * 79) % 357)} r={i % 3 ? 1 : 1.5} fill="#c7c4b7" opacity={i % 2 ? '.45' : '.7'} />)}
    <text x="24" y="29" className="diagram-overline">EARTH’S ORBIT</text><text x="24" y="46" className="diagram-small">Northern view · orbit shown in perspective</text>
    <ellipse cx="380" cy="218" rx="223" ry="139" fill="none" stroke="#d5d2c6" strokeWidth="1.3" strokeDasharray="3 6" />
    <path d="M584 275 Q598 255 602 237" fill="none" stroke="#b7b4a7" markerEnd="url(#orbit-arrow)" />
    <path d="M380 218 L380 79 M380 218 L603 218 M380 218 L380 357 M380 218 L157 218" stroke="#e5e1d6" strokeDasharray="3 6" />
    {EVENTS.map(event => {
      const p = point(event.longitude * RAD);
      const anchor = event.longitude === 90 ? 'start' : event.longitude === 270 ? 'end' : 'middle';
      const tx = p.x + (event.longitude === 90 ? 29 : event.longitude === 270 ? -29 : 0);
      const ty = p.y + (event.longitude === 0 ? 29 : event.longitude === 180 ? -32 : -5);
      return <g key={event.title}><circle cx={p.x} cy={p.y} r="7" fill="#f3f0e8" stroke="#c5c0b2" /><text x={tx} y={ty} textAnchor={anchor} className="orbit-event">{event.short.toUpperCase()}</text><text x={tx} y={ty + 16} textAnchor={anchor} className="diagram-small">{dateLabel(event.day)}</text></g>;
    })}
    <circle cx="380" cy="218" r="63" fill="#edc67c" opacity=".07" /><circle cx="380" cy="218" r="49" fill="#edc67c" opacity=".12" /><circle cx="380" cy="218" r="34" fill="url(#sun-fill)" />
    {Array.from({ length: 12 }, (_, i) => <line key={i} x1={380 + Math.cos(i * Math.PI / 6) * 40} y1={218 + Math.sin(i * Math.PI / 6) * 40} x2={380 + Math.cos(i * Math.PI / 6) * 45} y2={218 + Math.sin(i * Math.PI / 6) * 45} stroke="#d5a657" strokeWidth="1.3" />)}
    <text x="380" y="277" textAnchor="middle" className="diagram-label">THE SUN</text>
    <line x1="380" y1="218" x2={earth.x} y2={earth.y} stroke="#dfbd80" strokeWidth="1.3" strokeDasharray="4 5" />
    <g transform={`translate(${earth.x} ${earth.y})`}>
      <circle r="25" fill="#f7f6f2" /><circle r="20" fill="url(#earth-fill)" />
      <path d="M-13 -11 Q-1 -18 7 -7 L2 0 L8 8 L-1 14 L-7 3 L-14 0Z" fill="#cfceda" opacity=".6" />
      <path d="M0 -20 A20 20 0 0 1 0 20 Z" fill="#48465f" opacity=".28" transform={`rotate(${Math.atan2(earth.y - 218, earth.x - 380) / RAD})`} />
      {tilt > 0 && <><line x1="-31" y1="0" x2="31" y2="0" stroke="#655f83" strokeWidth="1.5" /><text x="-39" y="4" className="axis-n">N</text></>}
      <circle r="25" fill="none" stroke="#8d87a6" opacity=".35" />
    </g>
    <g transform="translate(25 329)" className="tilt-inset"><rect width="200" height="61" rx="7" fill="#eeecf3" /><circle cx="21" cy="24" r="9" fill="#a29ab9" /><path d="M21 5 V43" stroke="#c9c2d6" strokeDasharray="2 3" /><line x1={21 - 19 * Math.sin(tilt * RAD)} y1={24 + 19 * Math.cos(tilt * RAD)} x2={21 + 19 * Math.sin(tilt * RAD)} y2={24 - 19 * Math.cos(tilt * RAD)} stroke="#716887" strokeWidth="1.5" /><text x="44" y="24" className="diagram-label">{tilt.toFixed(2)}° AXIAL TILT</text><text x="44" y="41" className="diagram-small">Side view · fixed axis direction</text></g>
    <text x="735" y="390" textAnchor="end" className="diagram-small">Schematic · sizes and distances not to scale</text>
    {EVENTS.map(event => {
      const p = point(event.longitude * RAD);
      return <g key={event.day} role="button" tabIndex={0} aria-label={`Jump to ${event.title}`} className="orbit-hit" onClick={() => onSelect(event.day)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(event.day); } }}><circle cx={p.x} cy={p.y} r="22" fill="transparent" /></g>;
    })}
  </svg>;
}

export function CelestialDiagram({ day, tilt }: { day: number; tilt: number }) {
  const sun = coordinates(day, tilt);
  const x = (ra: number) => 64 + ra / 360 * 632, y = (dec: number) => 210 - dec * 4.7;
  const curve = Array.from({ length: 361 }, (_, longitude) => {
    const dec = Math.asin(Math.sin(tilt * RAD) * Math.sin(longitude * RAD)) / RAD;
    const ra = longitude === 360 ? 360 : (Math.atan2(Math.cos(tilt * RAD) * Math.sin(longitude * RAD), Math.cos(longitude * RAD)) / RAD + 360) % 360;
    return `${longitude ? 'L' : 'M'}${x(ra).toFixed(2)},${y(dec).toFixed(2)}`;
  }).join(' ');
  return <svg className="celestial-diagram" viewBox="0 0 760 420" role="img" aria-label={`The Sun is at right ascension ${(sun.rightAscension / 15).toFixed(1)} hours and declination ${sun.declination.toFixed(1)} degrees.`}>
    <text x="24" y="29" className="diagram-overline">THE SUN AGAINST THE STARS</text><text x="24" y="47" className="diagram-small">An unwrapped map of the sky · right ascension increases eastward</text>
    {Array.from({ length: 42 }, (_, i) => <g key={i} fill="#c3c0b2" opacity=".7"><circle cx={70 + ((i * 97) % 615)} cy={85 + ((i * 67) % 250)} r={i % 5 ? 1.1 : 2} /></g>)}
    {[-30, -15, 0, 15, 30].map(dec => <g key={dec}><line x1="64" x2="696" y1={y(dec)} y2={y(dec)} stroke={dec === 0 ? '#a8a1b8' : '#e2dfd3'} strokeDasharray={dec === 0 ? '5 4' : '2 6'} /><text x="49" y={y(dec) + 4} textAnchor="end" className="diagram-small">{dec > 0 ? '+' : ''}{dec}°</text></g>)}
    {[0, 90, 180, 270, 360].map(ra => <g key={ra}><line x1={x(ra)} x2={x(ra)} y1="69" y2="351" stroke="#e2dfd3" strokeDasharray="2 6" /><text x={x(ra)} y="371" textAnchor="middle" className="diagram-small">{ra / 15}h</text></g>)}
    <path d={curve} fill="none" stroke="#d5a35c" strokeWidth="2" />
    <text x="695" y="201" textAnchor="end" className="diagram-label">CELESTIAL EQUATOR</text><text x="193" y={y(tilt) - 15} className="diagram-label" fill="#b28a4d">ECLIPTIC</text>
    <line x1={x(sun.rightAscension)} x2={x(sun.rightAscension)} y1={y(sun.declination)} y2="351" stroke="#b3a5c5" strokeDasharray="3 5" /><circle cx={x(sun.rightAscension)} cy={y(sun.declination)} r="21" fill="#efcd8b" opacity=".25" /><circle cx={x(sun.rightAscension)} cy={y(sun.declination)} r="11" fill="#edb459" stroke="#f7f6f2" strokeWidth="3" />
    <text x="380" y="402" textAnchor="middle" className="diagram-small">Earth’s orbit makes the Sun appear to travel eastward along the ecliptic.</text>
  </svg>;
}

export function DeclinationChart({ day, tilt }: { day: number; tilt: number }) {
  const x = (d: number) => 48 + d / 364 * 640, y = (dec: number) => 100 - dec * 2.5;
  const path = Array.from({ length: 365 }, (_, d) => `${d ? 'L' : 'M'}${x(d).toFixed(2)},${y(coordinates(d, tilt).declination).toFixed(2)}`).join(' ');
  const delta = coordinates(day, tilt).declination;
  return <svg viewBox="0 0 720 212" role="img" aria-label="Annual solar declination curve, from the June northern extreme to the December southern extreme">
    {[-EARTH_TILT, 0, EARTH_TILT].map(dec => <g key={dec}><line x1="48" x2="688" y1={y(dec)} y2={y(dec)} stroke="#dedbd0" strokeDasharray="3 5" /><text x="37" y={y(dec) + 3} textAnchor="end" className="chart-label">{dec > 0 ? '+' : ''}{dec.toFixed(dec === 0 ? 0 : 1)}°</text></g>)}
    <path d={`${path} L688,100 L48,100 Z`} fill="#eac48b" opacity=".12" /><path d={path} fill="none" stroke="#c89c60" strokeWidth="2" />
    <line x1={x(day)} x2={x(day)} y1="16" y2="171" stroke="#9386a4" strokeDasharray="3 4" /><circle cx={x(day)} cy={y(delta)} r="5" fill="#8a7e9d" stroke="#fbfaf7" strokeWidth="2" />
    {[['Jan', 0], ['Mar', 59], ['May', 120], ['Jul', 181], ['Sep', 243], ['Nov', 304], ['Dec', 364]].map(([label, d]) => <text key={label} x={x(Number(d))} y="194" textAnchor="middle" className="chart-label">{label}</text>)}
  </svg>;
}

export function SkyChart({ day, tilt, latitude, hour, compare }: { day: number; tilt: number; latitude: number; hour: number; compare: boolean }) {
  const delta = coordinates(day, tilt).declination;
  const x = (h: number) => 42 + h / 24 * 398, y = (alt: number) => 142 - alt * 1.1;
  const curve = (dec: number) => Array.from({ length: 193 }, (_, i) => `${i ? 'L' : 'M'}${x(i / 8).toFixed(2)},${y(altitude(latitude, dec, i / 8)).toFixed(2)}`).join(' ');
  const currentAltitude = altitude(latitude, delta, hour);
  return <svg viewBox="0 0 476 264" role="img" aria-label={`Daily solar altitude. At ${hour.toFixed(1)} local solar hours, the Sun is ${currentAltitude.toFixed(1)} degrees above the horizon.`}>
    <defs><clipPath id="sky-plot"><rect x="42" y="34" width="398" height="211" /></clipPath><linearGradient id="sky-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e9d2a8" stopOpacity=".4" /><stop offset="1" stopColor="#e9d2a8" stopOpacity="0" /></linearGradient></defs>
    <rect x="42" y="34" width="398" height="108" fill="#f5f1e7" /><rect x="42" y="142" width="398" height="100" fill="#ecebf0" opacity=".6" />
    {[90, 45, 0, -45, -90].map(a => <g key={a}><line x1="42" x2="440" y1={y(a)} y2={y(a)} stroke={a === 0 ? '#a9a596' : '#e2dfd5'} strokeDasharray={a === 0 ? undefined : '2 5'} /><text x="32" y={y(a) + 3} textAnchor="end" className="chart-label">{a}°</text></g>)}
    <g clipPath="url(#sky-plot)">
      {compare && <><path d={curve(tilt)} fill="none" stroke="#cbb089" strokeWidth="1.4" strokeDasharray="4 4" /><path d={curve(-tilt)} fill="none" stroke="#b0a8c0" strokeWidth="1.4" strokeDasharray="4 4" /></>}
      <path d={`${curve(delta)} L440,242 L42,242 Z`} fill="url(#sky-fill)" /><path d={curve(delta)} fill="none" stroke="#d09c54" strokeWidth="2" />
      <line x1={x(hour)} x2={x(hour)} y1="34" y2="242" stroke="#9e92b3" strokeDasharray="3 4" /><circle cx={x(hour)} cy={y(currentAltitude)} r="7" fill="#e9b460" stroke="#fbfaf7" strokeWidth="2" />
    </g>
    <text x="431" y="136" textAnchor="end" className="chart-label">HORIZON</text>
    {[0, 6, 12, 18, 24].map(h => <text key={h} x={x(h)} y="260" textAnchor="middle" className="chart-label">{String(h).padStart(2, '0')}:00</text>)}
  </svg>;
}
