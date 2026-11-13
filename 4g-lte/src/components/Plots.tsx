import { useEffect, useRef } from 'react';
import type { Complex, Modulation, SymbolRecord } from '../sim/types';
import { constellation } from '../sim/codec';

export const COLORS = { tx: '#168267', rx: '#8b6cce', equalized: '#ec9252', muted: '#a5aaa4' };
type Series = { label: string; color: string; values: number[]; dashed?: boolean };

function canvasSetup(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}
function useCanvas(draw: (canvas: HTMLCanvasElement) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const canvas = ref.current;
    const observer = new ResizeObserver(() => draw(canvas));
    observer.observe(canvas); draw(canvas);
    return () => observer.disconnect();
  }, [draw]);
  return ref;
}

export function LinePlot({ series, xLabel = 'SAMPLE', yLabel = 'AMPLITUDE', region, point, markers = [], xTicks, fixedRange, height = 180 }: {
  series: Series[]; xLabel?: string; yLabel?: string; region?: { start: number; end: number; label: string; color?: string };
  point?: number; xTicks?: string[]; fixedRange?: [number, number]; height?: number;
  markers?: { index: number; label: string; color: string }[];
}) {
  const ref = useCanvas(canvas => {
    const { ctx, w, h } = canvasSetup(canvas), left = 42, right = w - 14, top = 20, bottom = h - 32;
    const length = Math.max(2, ...series.map(s => s.values.length));
    const all = series.flatMap(s => s.values).filter(Number.isFinite);
    let min = fixedRange?.[0] ?? Math.min(0, ...all), max = fixedRange?.[1] ?? Math.max(0, ...all);
    if (max - min < 1e-6) { min -= 1; max += 1; }
    const padding = fixedRange ? 0 : (max - min) * 0.12; min -= padding; max += padding;
    const x = (i: number) => left + i / (length - 1) * (right - left);
    const y = (v: number) => bottom - (v - min) / (max - min) * (bottom - top);
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    for (let i = 0; i < 5; i++) {
      const value = min + (max - min) * i / 4, py = y(value);
      ctx.strokeStyle = '#e8ebe5'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
      ctx.fillStyle = '#657060'; ctx.textAlign = 'right'; ctx.fillText(value.toFixed(max > 10 ? 0 : 1), left - 8, py + 3);
    }
    if (region) {
      ctx.fillStyle = region.color ?? '#16826713'; ctx.fillRect(x(region.start), top, x(region.end) - x(region.start), bottom - top);
      ctx.fillStyle = '#168267'; ctx.textAlign = 'left'; ctx.fillText(region.label, x(region.start) + 4, top - 5);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(left, top, right - left, bottom - top); ctx.clip();
    for (const s of series) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 1.6; ctx.setLineDash(s.dashed ? [4, 4] : []); ctx.beginPath();
      s.values.forEach((v, i) => { if (i === 0) ctx.moveTo(x(i), y(v)); else ctx.lineTo(x(i), y(v)); }); ctx.stroke();
    }
    ctx.setLineDash([]);
    if (point !== undefined) {
      ctx.strokeStyle = '#d68b46'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x(point), top); ctx.lineTo(x(point), bottom); ctx.stroke();
    }
    for (const marker of markers) {
      ctx.strokeStyle = marker.color; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(x(marker.index), top); ctx.lineTo(x(marker.index), bottom); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#657060'; ctx.textAlign = 'center';
    const ticks = xTicks ?? ['0', `${Math.round((length - 1) / 2)}`, `${length - 1}`];
    ticks.forEach((tick, i) => ctx.fillText(tick, left + i / (ticks.length - 1) * (right - left), bottom + 16));
    ctx.textAlign = 'left'; ctx.fillText(yLabel, left, 10);
    ctx.textAlign = 'right'; ctx.fillText(xLabel, right, h - 1);
  });
  return <><canvas ref={ref} style={{ height }} className="plot" role="img" aria-label={`${yLabel} against ${xLabel}. ${series.map(s => s.label).join(' compared with ')}. ${markers.map(v => `${v.label} at ${v.index}`).join(', ')}`} /><div className="plot-legend">{series.map(s => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}{markers.map(marker => <span key={marker.label}><i style={{ background: marker.color }} />{marker.label}: {marker.index}</span>)}</div></>;
}

export function ConstellationPlot({ symbols, modulation, mode = 'equalized', selected, onSelect, height = 230 }: {
  symbols: SymbolRecord[]; modulation: Modulation; mode?: 'rx' | 'equalized' | 'both'; selected: number;
  onSelect?: (index: number) => void; height?: number;
}) {
  const ideal = constellation(modulation);
  const values: Complex[] = symbols.flatMap(s => mode === 'both' ? [s.rx, s.equalized] : [s[mode]]);
  const finiteMax = Math.max(1.3, ...ideal.map(v => Math.max(Math.abs(v.point.re), Math.abs(v.point.im)) * 1.2));
  // Keep extreme fading outliers from flattening the whole learning diagram.
  const extent = Math.min(4, Math.max(finiteMax, ...values.map(v => Math.max(Math.abs(v.re), Math.abs(v.im)))));
  const ref = useCanvas(canvas => {
    const { ctx, w, h } = canvasSetup(canvas), left = 32, right = w - 20, top = 16, bottom = h - 27;
    const x = (v: number) => left + (v + extent) / (2 * extent) * (right - left);
    const y = (v: number) => bottom - (v + extent) / (2 * extent) * (bottom - top);
    ctx.font = '10px ui-monospace, monospace';
    for (let i = -2; i <= 2; i++) {
      const v = i * extent / 2; ctx.strokeStyle = i === 0 ? '#c6cfc7' : '#e9ece6'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x(v), top); ctx.lineTo(x(v), bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(left, y(v)); ctx.lineTo(right, y(v)); ctx.stroke();
      ctx.fillStyle = '#657060'; ctx.textAlign = 'center'; ctx.fillText(v.toFixed(1), x(v), bottom + 15);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(left, top, right - left, bottom - top); ctx.clip();
    for (const item of ideal) {
      ctx.strokeStyle = '#b3bbb2'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x(item.point.re), y(item.point.im), 4, 0, 2 * Math.PI); ctx.stroke();
    }
    const modes = mode === 'both' ? ['rx', 'equalized'] as const : [mode];
    for (const field of modes) {
      ctx.fillStyle = field === 'rx' ? COLORS.rx : COLORS.tx;
      symbols.forEach((s, i) => {
        const value = s[field]; ctx.globalAlpha = i === selected ? 1 : 0.6;
        ctx.beginPath(); ctx.arc(x(value.re), y(value.im), i === selected ? 4.5 : 2.5, 0, 2 * Math.PI); ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
    if (symbols[selected]) {
      const s = symbols[selected], v = mode === 'rx' ? s.rx : s.equalized;
      ctx.strokeStyle = '#db9a56'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x(s.tx.re), y(s.tx.im)); ctx.lineTo(x(v.re), y(v.im)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#203f35'; ctx.beginPath(); ctx.arc(x(v.re), y(v.im), 8, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#758178'; ctx.textAlign = 'right'; ctx.fillText('I →', right, h - 1);
    ctx.textAlign = 'left'; ctx.fillText('Q ↑', left, 10);
  });
  return <><canvas ref={ref} className={`plot ${onSelect ? 'selectable-plot' : ''}`} style={{ height }} role="img"
    aria-label={`${modulation} constellation. Ideal locations are outlined. ${mode === 'rx' ? 'Received' : 'Equalized'} symbols are filled. Selected symbol ${selected + 1}.`}
    onClick={event => {
      if (!onSelect || !symbols.length) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const re = ((event.clientX - rect.left - 32) / (rect.width - 52) * 2 - 1) * extent;
      const im = -((event.clientY - rect.top - 16) / (rect.height - 43) * 2 - 1) * extent;
      let nearest = 0, distance = Infinity;
      symbols.forEach((s, i) => { const v = mode === 'rx' ? s.rx : s.equalized; const d = (v.re - re) ** 2 + (v.im - im) ** 2; if (d < distance) { nearest = i; distance = d; } });
      onSelect(nearest);
    }} />
    <div className="plot-legend"><span><i className="outlined" />Ideal positions</span>{mode !== 'equalized' && <span><i style={{ background: COLORS.rx }} />Received</span>}{mode !== 'rx' && <span><i style={{ background: COLORS.tx }} />Equalized</span>}</div>
  </>;
}
