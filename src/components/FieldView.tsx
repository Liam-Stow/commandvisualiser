import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { CommandFunction } from '../types/command';
import type { DriveWaypoint, WaypointPose } from '../parser/driveToPoseParser';
import { extractWaypoints } from '../parser/driveToPoseParser';
import {
  ACTIVE_FIELD,
  type FieldConfig,
  fieldToImagePx,
  fieldWidthMeters,
  flipXForRed,
  flipRotForRed,
} from '../config/fields';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function speedColor(s: number): string {
  if (s >= 0.85) return '#22c55e';
  if (s >= 0.65) return '#84cc16';
  if (s >= 0.45) return '#f59e0b';
  return '#ef4444';
}

function toRad(deg: number) { return deg * (Math.PI / 180); }

function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const ax = x2 - size * Math.cos(angle - Math.PI / 6);
  const ay = y2 - size * Math.sin(angle - Math.PI / 6);
  const bx = x2 - size * Math.cos(angle + Math.PI / 6);
  const by = y2 - size * Math.sin(angle + Math.PI / 6);
  return `${x2},${y2} ${ax},${ay} ${bx},${by}`;
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy - r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy - r * Math.sin(toRad(endDeg));
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 0 ${x2},${y2} Z`;
}

// ─── Alliance transform ───────────────────────────────────────────────────────

function applyAllianceFlip(wp: DriveWaypoint, redAlliance: boolean, cfg: FieldConfig): DriveWaypoint {
  if (!redAlliance || !wp.flipForRed) return wp;
  const pose = wp.pose;
  if (pose.kind !== 'numeric') return wp;
  return {
    ...wp,
    pose: {
      kind: 'numeric',
      x: flipXForRed(cfg, pose.x),
      y: pose.y,
      rotation: flipRotForRed(pose.rotation),
    },
  };
}

// ─── Two-thumb range slider ───────────────────────────────────────────────────

interface RangeSliderProps {
  count: number;
  start: number;
  end: number;
  waypoints: DriveWaypoint[];
  onChange: (start: number, end: number) => void;
}

function RangeSlider({ count, start, end, waypoints, onChange }: RangeSliderProps) {
  if (count <= 1) return null;

  const pct = (i: number) => count > 1 ? (i / (count - 1)) * 100 : 0;
  const startPct = pct(start);
  const endPct   = pct(end);

  return (
    <div className="path-slider">
      {/* Per-waypoint tick marks above the track */}
      <div className="slider-ticks" aria-hidden="true">
        {waypoints.map((wp, i) => (
          <div
            key={i}
            className="slider-tick"
            style={{
              left: `${pct(i)}%`,
              background: speedColor(wp.speedScaling),
              opacity: i >= start && i <= end ? 1 : 0.25,
            }}
            title={`Step ${i + 1}`}
          />
        ))}
      </div>

      {/* Track background + filled range */}
      <div className="slider-track">
        <div
          className="slider-track-fill"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
      </div>

      {/* Start thumb — lower z-index unless it's at the max */}
      <input
        type="range"
        className="slider-input"
        min={0} max={count - 1} step={1}
        value={start}
        style={{ zIndex: start >= end ? 5 : 3 }}
        onChange={e => onChange(Math.min(+e.target.value, end), end)}
      />
      {/* End thumb */}
      <input
        type="range"
        className="slider-input"
        min={0} max={count - 1} step={1}
        value={end}
        style={{ zIndex: 4 }}
        onChange={e => onChange(start, Math.max(+e.target.value, start))}
      />

      <div className="slider-step-labels">
        <span>Step {start + 1}</span>
        <span>Showing {end - start + 1} of {count} steps</span>
        <span>Step {end + 1}</span>
      </div>
    </div>
  );
}

// ─── SVG overlay elements ─────────────────────────────────────────────────────

/** Convert field coords → image-pixel coords. Flip is already applied to the pose upstream. */
function poseToImgPx(cfg: FieldConfig, pose: WaypointPose): [number, number] | null {
  if (pose.kind !== 'numeric') return null;
  return fieldToImagePx(cfg, pose.x, pose.y);
}

interface MarkerProps {
  wp: DriveWaypoint;
  index: number;
  cfg: FieldConfig;
  scale: number;
  active: boolean;
  ghost: boolean;
  showTolerance: boolean;
  showRotation: boolean;
  onHover: (i: number | null) => void;
}

function WaypointMarker({ wp, index, cfg, scale, active, ghost, showTolerance, showRotation, onHover }: MarkerProps) {
  const pose = wp.pose;
  if (pose.kind !== 'numeric') return null;

  const [ix, iy] = fieldToImagePx(cfg, pose.x, pose.y);
  const color = speedColor(wp.speedScaling);

  // Screen-constant sizes expressed in image pixels
  const R       = 11 / scale;
  const fSize   = 9.5 / scale;
  const arrowL  = 28 / scale;
  const rotRad  = toRad(pose.rotation);
  const arrowX  = ix + arrowL * Math.cos(rotRad);
  const arrowY  = iy - arrowL * Math.sin(rotRad);

  // Tolerance in image pixels (field-scale)
  const tolR = wp.posTolMeters * cfg.pixelsPerMeter;

  if (ghost) {
    return (
      <circle
        cx={ix} cy={iy} r={R * 0.65}
        fill={color} opacity={0.2}
        onMouseEnter={() => onHover(index)}
        onMouseLeave={() => onHover(null)}
      />
    );
  }

  return (
    <g onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)}>
      {/* Tolerance ring */}
      {showTolerance && tolR > 1 && (
        <circle
          cx={ix} cy={iy} r={tolR}
          fill="rgba(96,165,250,0.07)"
          stroke="#60a5fa"
          strokeWidth={1.2 / scale}
          strokeDasharray={`${6 / scale} ${4 / scale}`}
        />
      )}

      {/* Rotation tolerance wedge */}
      {showRotation && wp.rotTolDeg > 0 && (
        <path
          d={arcPath(ix, iy, arrowL + 8 / scale, pose.rotation - wp.rotTolDeg, pose.rotation + wp.rotTolDeg)}
          fill="rgba(250,204,21,0.1)"
          stroke="#facc15"
          strokeWidth={0.8 / scale}
        />
      )}

      {/* Rotation arrow */}
      {showRotation && (
        <>
          <line
            x1={ix} y1={iy} x2={arrowX} y2={arrowY}
            stroke={active ? '#fff' : '#cbd5e1'}
            strokeWidth={(active ? 2.2 : 1.6) / scale}
          />
          <polygon
            points={arrowHeadPoints(ix, iy, arrowX, arrowY, 6 / scale)}
            fill={active ? '#fff' : '#cbd5e1'}
          />
        </>
      )}

      {/* Pose circle */}
      <circle
        cx={ix} cy={iy} r={active ? R * 1.2 : R}
        fill={color}
        stroke={active ? '#fff' : 'rgba(0,0,0,0.45)'}
        strokeWidth={(active ? 2 : 1.5) / scale}
      />
      <text
        x={ix} y={iy}
        textAnchor="middle" dominantBaseline="central"
        fontSize={fSize} fontWeight="700" fill="#fff"
      >
        {index + 1}
      </text>

      {/* Hover badge */}
      {active && (() => {
        const bw = 52 / scale, bh = 16 / scale, bx = ix + R + 3 / scale, by = iy - bh / 2;
        return (
          <g>
            <rect x={bx} y={by} width={bw} height={bh} rx={3 / scale} fill="#1e293b" stroke={color} strokeWidth={1 / scale} />
            <text x={bx + bw / 2} y={iy} textAnchor="middle" dominantBaseline="central" fontSize={8 / scale} fontWeight="700" fill={color}>
              {Math.round(wp.speedScaling * 100)}% speed
            </text>
          </g>
        );
      })()}
    </g>
  );
}

interface PathLinesProps {
  waypoints: DriveWaypoint[];
  rangeStart: number;
  rangeEnd: number;
  cfg: FieldConfig;
  scale: number;
}

function PathLines({ waypoints, rangeStart, rangeEnd, cfg, scale }: PathLinesProps) {
  const lines: React.ReactNode[] = [];

  for (let i = 1; i < waypoints.length; i++) {
    if (i < rangeStart || i > rangeEnd) continue;
    const prev = waypoints[i - 1].pose;
    const curr = waypoints[i].pose;
    if (prev.kind !== 'numeric' || curr.kind !== 'numeric') continue;

    const [x1, y1] = fieldToImagePx(cfg, prev.x, prev.y);
    const [x2, y2] = fieldToImagePx(cfg, curr.x, curr.y);
    const color   = speedColor(waypoints[i].speedScaling);
    const lw      = (1.5 + waypoints[i].speedScaling * 2.5) / scale;
    const opacity = 0.5 + waypoints[i].speedScaling * 0.45;

    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) continue;

    const shrink = Math.min(14 / scale, len * 0.15);
    const ux = dx / len, uy = dy / len;
    const lx1 = x1 + ux * shrink, ly1 = y1 + uy * shrink;
    const lx2 = x2 - ux * shrink, ly2 = y2 - uy * shrink;
    const mx  = (lx1 + lx2) / 2,  my  = (ly1 + ly2) / 2;

    const ahSize  = 9 / scale;
    const badgeW  = 36 / scale, badgeH = 14 / scale;
    const fontSize = 8 / scale;

    lines.push(
      <g key={i} opacity={opacity}>
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={color} strokeWidth={lw} strokeLinecap="round" />
        <polygon points={arrowHeadPoints(lx1, ly1, lx2, ly2, ahSize)} fill={color} />
        {len > 60 / scale && (
          <g>
            <rect x={mx - badgeW / 2} y={my - badgeH / 2} width={badgeW} height={badgeH}
              rx={3 / scale} fill="rgba(15,23,42,0.8)" stroke={color} strokeWidth={0.8 / scale} />
            <text x={mx} y={my} textAnchor="middle" dominantBaseline="central"
              fontSize={fontSize} fontWeight="600" fill={color}>
              {Math.round(waypoints[i].speedScaling * 100)}%
            </text>
          </g>
        )}
      </g>,
    );
  }

  return <>{lines}</>;
}

// ─── Named / details tables ───────────────────────────────────────────────────

function WaypointTable({ waypoints, hoveredIndex, rangeStart, rangeEnd }:
  { waypoints: DriveWaypoint[]; hoveredIndex: number | null; rangeStart: number; rangeEnd: number }) {
  return (
    <div className="waypoint-table-wrap">
      <table className="waypoint-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Pose (x, y, θ)</th>
            <th>Speed</th>
            <th>Pos tol</th>
            <th>Rot tol</th>
            <th>Alliance flip</th>
          </tr>
        </thead>
        <tbody>
          {waypoints.map((wp, i) => {
            const pose = wp.pose;
            const active = hoveredIndex === i;
            const inRange = i >= rangeStart && i <= rangeEnd;
            return (
              <tr key={i} className={active ? 'row-active' : inRange ? '' : 'row-out-of-range'}>
                <td>
                  <span className="step-num" style={{ background: speedColor(wp.speedScaling) }}>{i + 1}</span>
                </td>
                <td className="pose-cell">
                  {pose.kind === 'numeric'
                    ? <><b>{pose.x.toFixed(2)}</b>m, <b>{pose.y.toFixed(2)}</b>m, <b>{pose.rotation.toFixed(0)}</b>°</>
                    : <span className="named-ref">{pose.name}</span>}
                </td>
                <td style={{ color: speedColor(wp.speedScaling) }}>{Math.round(wp.speedScaling * 100)}%</td>
                <td>±{(wp.posTolMeters * 100).toFixed(0)} cm</td>
                <td>{wp.command === 'DriveToPose' ? `±${wp.rotTolDeg.toFixed(0)}°` : '—'}</td>
                <td>{wp.flipForRed ? 'Yes' : 'No'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NamedPoseTable({ waypoints }: { waypoints: DriveWaypoint[] }) {
  const named = waypoints.filter(wp => wp.pose.kind === 'named');
  if (named.length === 0) return null;
  return (
    <div className="named-pose-table">
      <div className="named-pose-header">Named poses — resolve from FieldConstants to plot on field</div>
      {named.map((wp, i) => (
        <div key={i} className="named-pose-row">
          <span className="named-pose-badge" style={{ color: speedColor(wp.speedScaling) }}>
            {(wp.pose as { kind: 'named'; name: string }).name}
          </span>
          <span className="named-pose-meta">
            {Math.round(wp.speedScaling * 100)}% · ±{(wp.posTolMeters * 100).toFixed(0)} cm · ±{wp.rotTolDeg.toFixed(0)}°
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const MIN_SCALE_FACTOR = 0.5;  // fraction of fit scale
const MAX_SCALE_FACTOR = 10;   // fraction of fit scale

interface Props { command: CommandFunction | null }

export function FieldView({ command }: Props) {
  const cfg = ACTIVE_FIELD;

  // ── Zoom / pan ──────────────────────────────────────────────────────────────
  const viewportRef    = useRef<HTMLDivElement>(null);
  const isDragging     = useRef(false);
  const hasMoved       = useRef(false);
  const dragOrigin     = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const fitRef         = useRef({ scale: 0.2, x: 0, y: 0 });

  const [scale, setScale] = useState(0.2);
  const [pan,   setPan  ] = useState({ x: 0, y: 0 });

  const applyFit = useCallback(() => {
    const f = fitRef.current;
    setScale(f.scale);
    setPan({ x: f.x, y: f.y });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const compute = () => {
      const { clientWidth: w, clientHeight: h } = el;
      const s = Math.min(w / cfg.imageWidthPx, h / cfg.imageHeightPx) * 0.97;
      const fit = { scale: s, x: (w - cfg.imageWidthPx * s) / 2, y: (h - cfg.imageHeightPx * s) / 2 };
      fitRef.current = fit;
      // Only auto-fit on first load (scale still at initialised value)
      setScale(prev => (prev === 0.2 ? fit.scale : prev));
      setPan(prev => (prev.x === 0 && prev.y === 0 ? { x: fit.x, y: fit.y } : prev));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cfg]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta  = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const fitS   = fitRef.current.scale;
    const newS   = Math.min(Math.max(scale * delta, fitS * MIN_SCALE_FACTOR), fitS * MAX_SCALE_FACTOR);
    const rect   = viewportRef.current!.getBoundingClientRect();
    const cx     = e.clientX - rect.left;
    const cy     = e.clientY - rect.top;
    setScale(newS);
    setPan({ x: cx - (cx - pan.x) * (newS / scale), y: cy - (cy - pan.y) * (newS / scale) });
  }, [scale, pan]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    hasMoved.current   = false;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    hasMoved.current = true;
    setPan({
      x: dragOrigin.current.px + e.clientX - dragOrigin.current.mx,
      y: dragOrigin.current.py + e.clientY - dragOrigin.current.my,
    });
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    isDragging.current = false;
    (e.currentTarget as HTMLElement).style.cursor = 'grab';
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const fitS = fitRef.current.scale;
    setScale(prev => {
      const next = Math.min(Math.max(prev * factor, fitS * MIN_SCALE_FACTOR), fitS * MAX_SCALE_FACTOR);
      // Zoom toward centre of viewport
      const el = viewportRef.current;
      if (el) {
        const cx = el.clientWidth / 2, cy = el.clientHeight / 2;
        setPan(p => ({ x: cx - (cx - p.x) * (next / prev), y: cy - (cy - p.y) * (next / prev) }));
      }
      return next;
    });
  }, []);

  // ── State ───────────────────────────────────────────────────────────────────
  const [redAlliance,   setRedAlliance  ] = useState(false);
  const [showTolerance, setShowTolerance] = useState(true);
  const [showRotation,  setShowRotation ] = useState(true);
  const [hoveredIndex,  setHoveredIndex ] = useState<number | null>(null);
  const [rangeStart,    setRangeStart   ] = useState(0);
  const [rangeEnd,      setRangeEnd     ] = useState(0);

  // ── Waypoints ───────────────────────────────────────────────────────────────
  const rawWaypoints = useMemo(
    () => command ? extractWaypoints(command.node) : [],
    [command],
  );

  const waypoints = useMemo(
    () => rawWaypoints.map(wp => applyAllianceFlip(wp, redAlliance, cfg)),
    [rawWaypoints, redAlliance, cfg],
  );

  // Reset range when waypoints change
  useEffect(() => {
    setRangeStart(0);
    setRangeEnd(Math.max(0, waypoints.length - 1));
  }, [waypoints.length]);

  // ── Empty states ─────────────────────────────────────────────────────────────
  if (!command) return (
    <div className="field-view empty-panel">
      <div className="empty-icon">🗺️</div>
      <p>Select a command to see its field path.</p>
    </div>
  );

  if (waypoints.length === 0) return (
    <div className="field-view empty-panel">
      <div className="empty-icon">🔍</div>
      <p>No <code>DriveToPose</code> commands found in <b>{command.name}</b>.</p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const W = cfg.imageWidthPx, H = cfg.imageHeightPx;

  return (
    <div className="field-view">
      {/* ── Toolbar ── */}
      <div className="field-toolbar">
        <span className="field-name">{cfg.name}</span>
        <div className="field-controls">
          <label className="toggle-label">
            <input type="checkbox" checked={showTolerance} onChange={e => setShowTolerance(e.target.checked)} />
            Pos tolerance
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={showRotation} onChange={e => setShowRotation(e.target.checked)} />
            Rotation
          </label>
          <div className="alliance-toggle">
            <button className={`alliance-btn ${!redAlliance ? 'active-blue' : ''}`} onClick={() => setRedAlliance(false)}>Blue</button>
            <button className={`alliance-btn ${redAlliance  ? 'active-red'  : ''}`} onClick={() => setRedAlliance(true)}>Red</button>
          </div>
        </div>
      </div>

      {/* ── Viewport (zoom/pan) ── */}
      <div
        ref={viewportRef}
        className="field-viewport"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: 'grab' }}
      >
        {/* Transformed content */}
        <div
          style={{
            position: 'absolute',
            width: W, height: H,
            transformOrigin: '0 0',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          <img
            src={cfg.imagePath}
            width={W} height={H}
            draggable={false}
            style={{ display: 'block', userSelect: 'none' }}
          />
          {/* SVG overlay — all coordinates in image pixels */}
          <svg
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
            width={W} height={H}
          >
            {/* Path lines (below markers) */}
            <PathLines
              waypoints={waypoints}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              cfg={cfg}
              scale={scale}
            />

            {/* Waypoint markers */}
            {waypoints.map((wp, i) => (
              <WaypointMarker
                key={i}
                wp={wp}
                index={i}
                cfg={cfg}
                scale={scale}
                active={hoveredIndex === i}
                ghost={i < rangeStart || i > rangeEnd}
                showTolerance={showTolerance}
                showRotation={showRotation}
                onHover={hasMoved.current ? () => {} : setHoveredIndex}
              />
            ))}
          </svg>
        </div>

        {/* Floating zoom controls */}
        <div className="zoom-float">
          <button className="zoom-btn" onClick={() => zoomBy(1.25)} title="Zoom in">+</button>
          <button className="zoom-btn" onClick={() => zoomBy(1 / 1.25)} title="Zoom out">−</button>
          <button className="zoom-btn" onClick={applyFit} title="Fit to screen">⤢</button>
        </div>
      </div>

      {/* ── Path range slider ── */}
      <div className="field-slider-section">
        <div className="slider-header">
          <span className="slider-title">Path steps</span>
          <span className="slider-hint">Drag handles to focus on a portion of the route</span>
        </div>
        <RangeSlider
          count={waypoints.length}
          start={rangeStart}
          end={rangeEnd}
          waypoints={waypoints}
          onChange={(s, e) => { setRangeStart(s); setRangeEnd(e); }}
        />
      </div>

      {/* ── Detail tables ── */}
      <div className="field-tables">
        <WaypointTable
          waypoints={waypoints}
          hoveredIndex={hoveredIndex}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
        />
        <NamedPoseTable waypoints={rawWaypoints} />
      </div>
    </div>
  );
}
