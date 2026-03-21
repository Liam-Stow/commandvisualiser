import { useRef, useEffect, useState, useMemo } from 'react';
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

/** SVG polygon points for an arrowhead pointing from (x1,y1) → (x2,y2) */
function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size = 9): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const ax = x2 - size * Math.cos(angle - Math.PI / 6);
  const ay = y2 - size * Math.sin(angle - Math.PI / 6);
  const bx = x2 - size * Math.cos(angle + Math.PI / 6);
  const by = y2 - size * Math.sin(angle + Math.PI / 6);
  return `${x2},${y2} ${ax},${ay} ${bx},${by}`;
}

/** SVG arc path for a rotation-tolerance wedge */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  // SVG: x right, y down — FRC: x right, y up → negate Y component of angles
  const x1 = cx + r * Math.cos(toRad(startDeg)) ;
  const y1 = cy - r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy - r * Math.sin(toRad(endDeg));
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 0 ${x2},${y2} Z`;
}

// ─── Coordinate transform ─────────────────────────────────────────────────────

function makeTransform(cfg: FieldConfig, scale: number, redAlliance: boolean) {
  const fWidth = fieldWidthMeters(cfg);

  return function toScreen(fx: number, fy: number): [number, number] {
    const xm = redAlliance ? flipXForRed(cfg, fx) : fx;
    const [imgX, imgY] = fieldToImagePx(cfg, xm, fy);
    return [imgX * scale, imgY * scale];
  };
}

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

// ─── Per-waypoint SVG marker ──────────────────────────────────────────────────

interface MarkerProps {
  wp: DriveWaypoint;
  index: number;
  toScreen: (fx: number, fy: number) => [number, number];
  pxPerM: number;     // screen pixels per metre (for tolerance circles)
  showTolerance: boolean;
  showRotation: boolean;
  hovered: boolean;
  onHover: (i: number | null) => void;
}

function WaypointMarker({ wp, index, toScreen, pxPerM, showTolerance, showRotation, hovered, onHover }: MarkerProps) {
  const pose = wp.pose;
  if (pose.kind !== 'numeric') return null;

  const [sx, sy] = toScreen(pose.x, pose.y);
  const color   = speedColor(wp.speedScaling);
  const tolR    = wp.posTolMeters * pxPerM;
  const arrowL  = Math.max(18, Math.min(34, pxPerM * 0.4));
  const rotRad  = toRad(pose.rotation);

  // Rotation arrow endpoint (SVG Y is inverted)
  const arrowX = sx + arrowL * Math.cos(rotRad);
  const arrowY = sy - arrowL * Math.sin(rotRad);

  return (
    <g
      style={{ cursor: 'default' }}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Position tolerance ring */}
      {showTolerance && tolR > 2 && (
        <circle
          cx={sx} cy={sy} r={tolR}
          fill="rgba(96,165,250,0.08)"
          stroke="#60a5fa"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}

      {/* Rotation tolerance wedge */}
      {showRotation && wp.rotTolDeg > 0 && (
        <path
          d={arcPath(sx, sy, arrowL + 6, pose.rotation - wp.rotTolDeg, pose.rotation + wp.rotTolDeg)}
          fill="rgba(250,204,21,0.12)"
          stroke="#facc15"
          strokeWidth={0.8}
        />
      )}

      {/* Path from previous — drawn in PoseLayer, not here */}

      {/* Rotation direction arrow */}
      {showRotation && (
        <>
          <line
            x1={sx} y1={sy}
            x2={arrowX} y2={arrowY}
            stroke={hovered ? '#fff' : '#e2e8f0'}
            strokeWidth={hovered ? 2.5 : 1.8}
          />
          <polygon
            points={arrowHeadPoints(sx, sy, arrowX, arrowY, 6)}
            fill={hovered ? '#fff' : '#e2e8f0'}
          />
        </>
      )}

      {/* Pose marker circle */}
      <circle
        cx={sx} cy={sy} r={hovered ? 13 : 11}
        fill={color}
        stroke={hovered ? '#fff' : 'rgba(0,0,0,0.4)'}
        strokeWidth={hovered ? 2 : 1.5}
      />
      <text
        x={sx} y={sy}
        textAnchor="middle" dominantBaseline="central"
        fontSize={10} fontWeight="700" fill="#fff"
      >
        {index + 1}
      </text>

      {/* Speed badge — show on DriveOverBump too */}
      {hovered && (
        <g>
          <rect
            x={sx + 14} y={sy - 22}
            width={46} height={16}
            rx={3} fill="#1e293b"
            stroke={color} strokeWidth={1}
          />
          <text x={sx + 37} y={sy - 14}
            textAnchor="middle" dominantBaseline="central"
            fontSize={9} fontWeight="700" fill={color}>
            {Math.round(wp.speedScaling * 100)}% speed
          </text>
        </g>
      )}
    </g>
  );
}

// ─── Path lines between consecutive numeric waypoints ─────────────────────────

interface PathLinesProps {
  waypoints: DriveWaypoint[];
  toScreen: (fx: number, fy: number) => [number, number];
}

function PathLines({ waypoints, toScreen }: PathLinesProps) {
  const lines: React.ReactNode[] = [];

  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1].pose;
    const curr = waypoints[i].pose;
    if (prev.kind !== 'numeric' || curr.kind !== 'numeric') continue;

    const [x1, y1] = toScreen(prev.x, prev.y);
    const [x2, y2] = toScreen(curr.x, curr.y);
    const color  = speedColor(waypoints[i].speedScaling);
    const width  = 1.5 + waypoints[i].speedScaling * 2;
    const opacity = 0.45 + waypoints[i].speedScaling * 0.45;

    // Shorten the line so it doesn't overlap the marker circles
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const shrink = Math.min(13, len * 0.15);
    const ux = len > 0 ? dx / len : 0;
    const uy = len > 0 ? dy / len : 0;
    const lx1 = x1 + ux * shrink, ly1 = y1 + uy * shrink;
    const lx2 = x2 - ux * shrink, ly2 = y2 - uy * shrink;

    // Speed label at midpoint
    const mx = (lx1 + lx2) / 2;
    const my = (ly1 + ly2) / 2;

    lines.push(
      <g key={i} opacity={opacity}>
        <line
          x1={lx1} y1={ly1} x2={lx2} y2={ly2}
          stroke={color} strokeWidth={width}
          strokeLinecap="round"
        />
        {/* Arrowhead pointing toward destination */}
        <polygon
          points={arrowHeadPoints(lx1, ly1, lx2, ly2, 8)}
          fill={color}
        />
        {/* Step speed badge on the path segment */}
        {len > 60 && (
          <g>
            <rect
              x={mx - 16} y={my - 9}
              width={32} height={14}
              rx={3} fill="rgba(15,23,42,0.75)"
              stroke={color} strokeWidth={0.8}
            />
            <text
              x={mx} y={my}
              textAnchor="middle" dominantBaseline="central"
              fontSize={8} fontWeight="600" fill={color}
            >
              {Math.round(waypoints[i].speedScaling * 100)}%
            </text>
          </g>
        )}
      </g>,
    );
  }

  return <>{lines}</>;
}

// ─── Named-pose table ─────────────────────────────────────────────────────────

function NamedPoseTable({ waypoints }: { waypoints: DriveWaypoint[] }) {
  const named = waypoints.filter(wp => wp.pose.kind === 'named');
  if (named.length === 0) return null;
  return (
    <div className="named-pose-table">
      <div className="named-pose-header">Named poses (position unknown — resolve from FieldConstants)</div>
      {named.map((wp, i) => (
        <div key={i} className="named-pose-row">
          <span className="named-pose-badge" style={{ color: speedColor(wp.speedScaling) }}>
            {(wp.pose as { kind: 'named'; name: string }).name}
          </span>
          <span className="named-pose-meta">
            {Math.round(wp.speedScaling * 100)}% · ±{(wp.posTolMeters * 100).toFixed(0)}cm · ±{wp.rotTolDeg.toFixed(0)}°
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Waypoint details table ───────────────────────────────────────────────────

function WaypointTable({ waypoints, hoveredIndex }: { waypoints: DriveWaypoint[]; hoveredIndex: number | null }) {
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
            return (
              <tr key={i} className={active ? 'row-active' : ''}>
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

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  command: CommandFunction | null;
}

export function FieldView({ command }: Props) {
  const cfg = ACTIVE_FIELD;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale]           = useState(1);
  const [redAlliance, setRedAlliance] = useState(false);
  const [showTolerance, setShowTolerance] = useState(true);
  const [showRotation, setShowRotation]   = useState(true);
  const [hoveredIndex, setHoveredIndex]   = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / cfg.imageWidthPx);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cfg]);

  const rawWaypoints = useMemo(
    () => command ? extractWaypoints(command.node) : [],
    [command],
  );

  const waypoints = useMemo(
    () => rawWaypoints.map(wp => applyAllianceFlip(wp, redAlliance, cfg)),
    [rawWaypoints, redAlliance, cfg],
  );

  const toScreen = useMemo(
    () => makeTransform(cfg, scale, false), // flip already applied to coords
    [cfg, scale],
  );

  const pxPerM = cfg.pixelsPerMeter * scale;

  if (!command) {
    return (
      <div className="field-view empty-panel">
        <div className="empty-icon">🗺️</div>
        <p>Select a command to see its field path.</p>
      </div>
    );
  }

  if (waypoints.length === 0) {
    return (
      <div className="field-view empty-panel">
        <div className="empty-icon">🔍</div>
        <p>No <code>DriveToPose</code> commands found in <b>{command.name}</b>.</p>
      </div>
    );
  }

  const displayW = cfg.imageWidthPx  * scale;
  const displayH = cfg.imageHeightPx * scale;

  return (
    <div className="field-view">
      {/* Toolbar */}
      <div className="field-toolbar">
        <span className="field-name">{cfg.name}</span>
        <div className="field-controls">
          <label className="toggle-label">
            <input type="checkbox" checked={showTolerance} onChange={e => setShowTolerance(e.target.checked)} />
            Position tolerance
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={showRotation} onChange={e => setShowRotation(e.target.checked)} />
            Rotation
          </label>
          <div className="alliance-toggle">
            <button
              className={`alliance-btn ${!redAlliance ? 'active-blue' : ''}`}
              onClick={() => setRedAlliance(false)}
            >Blue</button>
            <button
              className={`alliance-btn ${redAlliance ? 'active-red' : ''}`}
              onClick={() => setRedAlliance(true)}
            >Red</button>
          </div>
        </div>
      </div>

      {/* Scrollable field + overlay */}
      <div className="field-scroll">
        <div ref={containerRef} className="field-image-wrap">
          <div style={{ position: 'relative', width: displayW, height: displayH }}>
            <img
              src={cfg.imagePath}
              style={{ display: 'block', width: displayW, height: displayH }}
              draggable={false}
            />
            <svg
              style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
              width={displayW}
              height={displayH}
            >
              {/* Paths first (below markers) */}
              <PathLines waypoints={waypoints} toScreen={toScreen} />

              {/* Markers */}
              {waypoints.map((wp, i) => (
                <WaypointMarker
                  key={i}
                  wp={wp}
                  index={i}
                  toScreen={toScreen}
                  pxPerM={pxPerM}
                  showTolerance={showTolerance}
                  showRotation={showRotation}
                  hovered={hoveredIndex === i}
                  onHover={setHoveredIndex}
                />
              ))}
            </svg>
            {/* Re-enable pointer events for markers */}
            <svg
              style={{ position: 'absolute', top: 0, left: 0 }}
              width={displayW}
              height={displayH}
            >
              {waypoints.map((wp, i) => {
                const pose = wp.pose;
                if (pose.kind !== 'numeric') return null;
                const [sx, sy] = toScreen(pose.x, pose.y);
                return (
                  <circle
                    key={i}
                    cx={sx} cy={sy} r={13}
                    fill="transparent"
                    style={{ cursor: 'default' }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
            </svg>
          </div>
        </div>

        {/* Tables */}
        <div className="field-tables">
          <WaypointTable waypoints={waypoints} hoveredIndex={hoveredIndex} />
          <NamedPoseTable waypoints={rawWaypoints} />
        </div>
      </div>
    </div>
  );
}
