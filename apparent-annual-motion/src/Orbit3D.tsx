import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Globe2, Orbit } from 'lucide-react';
import earthUrl from './assets/earth-day.jpg';
import { coordinates, dateLabel, EVENTS, RAD } from './model';
import { earthPosition, observerNormal, spinAngle, sunDirection, surfacePoint } from './scene-math';

type Props = { day: number; tilt: number; latitude: number; longitude: number; hour: number; onSelect: (day: number) => void; onUnavailable: () => void };
type Mode = 'orbit' | 'earth';

const EARTH_RADIUS = 1.1, SUN_RADIUS = 1.7;

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!, gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,236,190,1)'); gradient.addColorStop(.22, 'rgba(255,196,96,.55)');
  gradient.addColorStop(.5, 'rgba(255,150,50,.14)'); gradient.addColorStop(1, 'rgba(255,140,40,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function starField() {
  // Deterministic pseudo-random stars so the backdrop is identical on every visit.
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const positions = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const z = random() * 2 - 1, angle = random() * Math.PI * 2, r = Math.sqrt(1 - z * z), distance = 90 + random() * 40;
    positions.set([r * Math.cos(angle) * distance, z * distance, r * Math.sin(angle) * distance], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xcfd6ee, size: 1.6, sizeAttenuation: false, transparent: true, opacity: .8 }));
}

export default function Orbit3D({ day, tilt, latitude, longitude, hour, onSelect, onUnavailable }: Props) {
  const container = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<(HTMLButtonElement | null)[]>([]);
  const [mode, setMode] = useState<Mode>('orbit');
  const solarLongitude = coordinates(day, tilt).longitude;
  const target = useRef({ solarLongitude, tilt, latitude, longitude, hour, mode });
  const invalidate = useRef(() => {});
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;

  useEffect(() => {
    const host = container.current!, element = canvas.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: element, antialias: true }); } catch { unavailable.current(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070914);
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 400);
    const controls = new OrbitControls(camera, element);
    controls.enablePan = false; controls.enableDamping = !reduced; controls.minDistance = 2.4; controls.maxDistance = 60;
    // Let vertical swipes scroll the page; horizontal drags rotate the scene.
    element.style.touchAction = 'pan-y';

    scene.add(starField(), new THREE.AmbientLight(0x9fb2e6, .42));
    const sunlight = new THREE.PointLight(0xfff4e0, 3.2, 0, 0);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(SUN_RADIUS * 6.5);
    scene.add(sunlight, sun, glow);

    const ring = Array.from({ length: 256 }, (_, i) => new THREE.Vector3(...earthPosition(i / 256 * 360)));
    scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: 0x6f7696, transparent: true, opacity: .75 })));
    const markerGeometry = new THREE.SphereGeometry(.13, 16, 12), markerMaterial = new THREE.MeshBasicMaterial({ color: 0xe8dcc0 });
    const eventPoints = EVENTS.map(event => {
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(...earthPosition(event.longitude));
      scene.add(marker);
      return marker.position;
    });
    const sunLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), new THREE.LineBasicMaterial({ color: 0xf1c070, transparent: true, opacity: .35 }));
    scene.add(sunLine);

    // earthGroup (orbit position) → tiltGroup (fixed axis) → spinGroup (daily rotation).
    const earthGroup = new THREE.Group(), tiltGroup = new THREE.Group(), spinGroup = new THREE.Group();
    const earthMaterial = new THREE.MeshStandardMaterial({ color: 0x2f62a8, roughness: 1, metalness: 0 });
    spinGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 96, 64), earthMaterial));
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.022, 64, 48), new THREE.MeshBasicMaterial({ color: 0x6db4ff, transparent: true, opacity: .2, side: THREE.BackSide }));
    const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -EARTH_RADIUS * 1.38, 0), new THREE.Vector3(0, EARTH_RADIUS * 1.38, 0)]), new THREE.LineBasicMaterial({ color: 0xd9d2f2 }));
    const northCap = new THREE.Mesh(new THREE.ConeGeometry(.045, .14, 12), new THREE.MeshBasicMaterial({ color: 0xd9d2f2 }));
    northCap.position.y = EARTH_RADIUS * 1.38;
    const circle = (color: number, opacity: number) => new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    const equator = circle(0xffffff, .28), latitudeCircle = circle(0xffd27a, .95);
    const unitCircle = Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2), 0, Math.sin(i / 128 * Math.PI * 2)));
    equator.geometry.setFromPoints(unitCircle); latitudeCircle.geometry.setFromPoints(unitCircle);
    equator.scale.setScalar(EARTH_RADIUS * 1.003);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff5d5d }));
    const pinHalo = new THREE.Mesh(new THREE.RingGeometry(.07, .095, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: .9 }));
    spinGroup.add(equator, latitudeCircle, pin, pinHalo);
    tiltGroup.add(spinGroup, axis, northCap, atmosphere);
    earthGroup.add(tiltGroup);
    scene.add(earthGroup);

    let disposed = false, dirty = true, frame = 0, last = performance.now();
    invalidate.current = () => { dirty = true; };
    const texture = new THREE.TextureLoader().load(earthUrl, () => {
      if (disposed) return;
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      earthMaterial.map = texture; earthMaterial.color.set(0xffffff); earthMaterial.needsUpdate = true; dirty = true;
    });
    controls.addEventListener('change', () => { dirty = true; });
    // Plain wheel scrolls the page; pinch or Ctrl/⌘ + wheel zooms the scene.
    const onWheel = (event: WheelEvent) => { if (!event.ctrlKey && !event.metaKey) event.stopPropagation(); };
    host.addEventListener('wheel', onWheel, { capture: true });

    let aimedLongitude = target.current.longitude, followedLongitude = target.current.solarLongitude, shownLongitude = target.current.solarLongitude, shownMode: Mode | null = null, width = 1, height = 1;
    const resize = () => {
      width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      shownMode = null; dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const UP = new THREE.Vector3(0, 1, 0), projected = new THREE.Vector3(), earthNow = new THREE.Vector3(), shift = new THREE.Vector3();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(.1, (now - last) / 1000), goal = target.current;
      last = now;
      const gap = ((goal.solarLongitude - shownLongitude + 540) % 360) - 180;
      if (gap !== 0) {
        shownLongitude = reduced || Math.abs(gap) < .02 ? goal.solarLongitude : shownLongitude + gap * Math.min(1, dt * 9);
        dirty = true;
      }
      earthNow.set(...earthPosition(shownLongitude));
      if (goal.mode === 'earth' && goal.longitude !== aimedLongitude) shownMode = null;
      if (goal.mode !== shownMode) {
        aimedLongitude = goal.longitude;
        shownMode = goal.mode;
        if (goal.mode === 'orbit') {
          // Pull back on narrow screens so the whole orbit stays in frame.
          const distance = 29 * Math.max(1, 1.45 / camera.aspect);
          controls.target.set(0, -1.6, 0); camera.position.set(distance * .42, distance * .56, distance * .71);
        } else {
          // Look at the observer's side of the globe, leaning sunward so the terminator stays in view.
          const [sx, , sz] = sunDirection(shownLongitude);
          const [nx, ny, nz] = observerNormal(goal.latitude, goal.longitude, spinAngle(shownLongitude, goal.tilt, goal.hour, goal.longitude), goal.tilt);
          controls.target.copy(earthNow);
          camera.position.copy(earthNow).add(new THREE.Vector3(nx + sx * .7, ny * .6 + .25, nz + sz * .7).normalize().multiplyScalar(5.2));
        }
        followedLongitude = shownLongitude; dirty = true;
      } else if (goal.mode === 'earth' && !controls.target.equals(earthNow)) {
        // Follow Earth and turn with it, so the chosen view of the sunlit side is kept all year.
        shift.copy(camera.position).sub(controls.target).applyAxisAngle(UP, (shownLongitude - followedLongitude) * RAD);
        controls.target.copy(earthNow); camera.position.copy(earthNow).add(shift);
        followedLongitude = shownLongitude; dirty = true;
      }
      controls.update();
      if (!dirty) return;
      dirty = false;
      earthGroup.position.copy(earthNow);
      tiltGroup.rotation.x = -goal.tilt * RAD;
      spinGroup.rotation.y = spinAngle(shownLongitude, goal.tilt, goal.hour, goal.longitude) * RAD;
      const phi = goal.latitude * RAD, spot = surfacePoint(goal.latitude, goal.longitude);
      latitudeCircle.scale.setScalar(Math.max(.001, Math.cos(phi)) * EARTH_RADIUS * 1.004);
      latitudeCircle.position.y = Math.sin(phi) * EARTH_RADIUS * 1.004;
      pin.position.set(...spot).multiplyScalar(EARTH_RADIUS * 1.01);
      pinHalo.position.set(...spot).multiplyScalar(EARTH_RADIUS * 1.012);
      axis.visible = northCap.visible = goal.tilt > 0 || goal.mode === 'earth';
      const line = sunLine.geometry.attributes.position as THREE.BufferAttribute;
      line.setXYZ(1, earthNow.x, earthNow.y, earthNow.z); line.needsUpdate = true;
      scene.updateMatrixWorld();
      pinHalo.lookAt(spinGroup.localToWorld(new THREE.Vector3(...spot).multiplyScalar(3)));
      renderer.render(scene, camera);
      eventPoints.forEach((point, i) => {
        const label = labels.current[i];
        if (!label) return;
        projected.copy(point).project(camera);
        const visible = !(goal.mode === 'earth' && point.distanceTo(earthNow) < 1.5) && projected.z < 1 && Math.abs(projected.x) < .98 && Math.abs(projected.y) < .98;
        label.style.visibility = visible ? 'visible' : 'hidden';
        label.classList.toggle('flip', projected.x > .4);
        label.style.transform = `translate(${((projected.x + 1) / 2 * width).toFixed(1)}px, ${((1 - projected.y) / 2 * height).toFixed(1)}px)`;
      });
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame); observer.disconnect(); host.removeEventListener('wheel', onWheel, { capture: true });
      controls.dispose(); texture.dispose();
      scene.traverse(object => {
        const item = object as THREE.Mesh;
        item.geometry?.dispose();
        (Array.isArray(item.material) ? item.material : item.material ? [item.material] : []).forEach(material => { (material as THREE.SpriteMaterial).map?.dispose(); material.dispose(); });
      });
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    target.current = { solarLongitude, tilt, latitude, longitude, hour, mode };
    invalidate.current();
  }, [solarLongitude, tilt, latitude, longitude, hour, mode]);

  return <div className="orbit3d" ref={container}>
    <canvas ref={canvas} data-testid="orbit-3d" role="img" aria-label={`Earth's position on ${dateLabel(day)}, shown in 3D. Its axis keeps a fixed direction as Earth orbits the Sun.`} />
    {EVENTS.map((event, i) => <button key={event.day} ref={node => { labels.current[i] = node; }} className={`orbit3d-event${day === event.day ? ' selected' : ''}`} aria-label={`Jump to ${event.title}`} onClick={() => onSelect(event.day)}><i /><span>{event.short.toUpperCase()}</span></button>)}
    <div className="orbit3d-modes" role="group" aria-label="Camera view">
      <button aria-pressed={mode === 'orbit'} onClick={() => setMode('orbit')}><Orbit size={12} />Whole orbit</button>
      <button aria-pressed={mode === 'earth'} onClick={() => setMode('earth')}><Globe2 size={12} />Earth close-up</button>
    </div>
    <p className="orbit3d-legend"><span><i className="legend-pin" />You</span><span><i className="legend-latitude" />Your latitude</span><span><i className="legend-axis" />Axis</span></p>
    <p className="orbit3d-hint">Drag to rotate · pinch or Ctrl + scroll to zoom · not to scale</p>
  </div>;
}
