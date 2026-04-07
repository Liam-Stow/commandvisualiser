import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { CommandFunction } from '../types/command';
import type { DriveWaypoint, WaypointPose } from '../parser/driveToPoseParser';
import {
  ACTIVE_FIELD,
  type FieldConfig,
  fieldToImagePx,
  imagePxToField,
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
  if (pose.kind !== 'literal') return wp;
  return {
    ...wp,
    pose: {
      ...pose,
      x: flipXForRed(cfg, pose.x),
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
  const trackRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{ anchorX: number; anchorStart: number; anchorEnd: number } | null>(null);
  const [isDraggingMiddle, setIsDraggingMiddle] = useState(false);

  const onFillMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!trackRef.current) return;
    dragRef.current = { anchorX: e.clientX, anchorStart: start, anchorEnd: end };
    setIsDraggingMiddle(true);
  }, [start, end]);

  useEffect(() => {
    if (!isDraggingMiddle) return;
    const span = end - start;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !trackRef.current) return;
      const trackWidth = trackRef.current.getBoundingClientRect().width;
      const deltaPx = e.clientX - dragRef.current.anchorX;
      const deltaSteps = Math.round(deltaPx * (count - 1) / trackWidth);
      const newStart = Math.max(0, Math.min(count - 1 - span, dragRef.current.anchorStart + deltaSteps));
      const newEnd   = newStart + span;
      onChange(newStart, newEnd);
    };

    const onMouseUp = () => {
      dragRef.current = null;
      setIsDraggingMiddle(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingMiddle, count, start, end, onChange]);

  if (count <= 1) return null;

  const pct = (i: number) => count > 1 ? (i / (count - 1)) * 100 : 0;
  const startPct = pct(start);
  const endPct   = pct(end);

  return (
    <div className="path-slider">
      <div className="slider-ticks" aria-hidden="true">
        {waypoints.map((wp, i) => (
          <div
            key={i}
            className="slider-tick"
            style={{ left: `${pct(i)}%` }}
          />
        ))}
      </div>

      <div className="slider-track" ref={trackRef}>
        <div
          className="slider-track-fill"
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            cursor: isDraggingMiddle ? 'grabbing' : 'grab',
          }}
          onMouseDown={onFillMouseDown}
        />
      </div>

      {(() => {
        const endOnTop = start < end || (start === end && end < count - 1);
        return (<>
          <input
            type="range"
            className="slider-input"
            min={0} max={count - 1} step={1}
            value={start}
            style={{ zIndex: endOnTop ? 3 : 5 }}
            onChange={e => onChange(Math.min(+e.target.value, end), end)}
          />
          <input
            type="range"
            className="slider-input"
            min={0} max={count - 1} step={1}
            value={end}
            style={{ zIndex: endOnTop ? 5 : 4 }}
            onChange={e => onChange(start, Math.max(+e.target.value, start))}
          />
        </>);
      })()}
    </div>
  );
}

// ─── SVG overlay elements ─────────────────────────────────────────────────────

interface MarkerProps {
  wp: DriveWaypoint;
  index: number;
  cfg: FieldConfig;
  scale: number;
  active: boolean;
  ghost: boolean;
  showPosTolerance: boolean;
  showRotTolerance: boolean;
  onHover: (i: number | null, e?: React.MouseEvent) => void;
}

function WaypointMarker({ wp, index, cfg, scale, active, ghost, showPosTolerance, showRotTolerance, onHover }: MarkerProps) {
  const pose = wp.pose;
  if (pose.kind !== 'literal') return null;

  const [ix, iy] = fieldToImagePx(cfg, pose.x, pose.y);
  const color = speedColor(wp.speedScaling);

  const R       = 11 / scale;
  const fSize   = 9.5 / scale;
  const arrowL  = 28 / scale;
  const rotRad  = toRad(pose.rotation);
  const arrowX  = ix + arrowL * Math.cos(rotRad);
  const arrowY  = iy - arrowL * Math.sin(rotRad);

  const tolR = wp.posTolMeters * cfg.pixelsPerMeter;

  if (ghost) {
    return (
      <circle
        cx={ix} cy={iy} r={R * 0.65}
        fill={color} opacity={0.2}
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  return (
    <g>
      {/* Decorative elements — no pointer events so they don't expand the hover target */}
      {showPosTolerance && tolR > 1 && (
        <circle
          cx={ix} cy={iy} r={tolR}
          fill="rgba(96,165,250,0.07)"
          stroke="#60a5fa"
          strokeWidth={1.2 / scale}
          strokeDasharray={`${6 / scale} ${4 / scale}`}
          style={{ pointerEvents: 'none' }}
        />
      )}
      {showRotTolerance && wp.rotTolDeg > 0 && (
        <path
          d={arcPath(ix, iy, arrowL + 8 / scale, pose.rotation - wp.rotTolDeg, pose.rotation + wp.rotTolDeg)}
          fill="rgba(250,204,21,0.1)"
          stroke="#facc15"
          strokeWidth={0.8 / scale}
          style={{ pointerEvents: 'none' }}
        />
      )}
      {isFinite(arrowX) && isFinite(arrowY) && (
        <>
          <line
            x1={ix} y1={iy} x2={arrowX} y2={arrowY}
            stroke={active ? '#fff' : '#cbd5e1'}
            strokeWidth={(active ? 2.2 : 1.6) / scale}
            style={{ pointerEvents: 'none' }}
          />
          <polygon
            points={arrowHeadPoints(ix, iy, arrowX, arrowY, 6 / scale)}
            fill={active ? '#fff' : '#cbd5e1'}
            style={{ pointerEvents: 'none' }}
          />
        </>
      )}

      {/* Pose circle — sole hover target */}
      <circle
        cx={ix} cy={iy} r={active ? R * 1.2 : R}
        fill={color}
        stroke={active ? '#fff' : 'rgba(0,0,0,0.45)'}
        strokeWidth={(active ? 2 : 1.5) / scale}
        onMouseEnter={(e) => onHover(index, e)}
        onMouseLeave={() => onHover(null)}
      />
      <text
        x={ix} y={iy}
        textAnchor="middle" dominantBaseline="central"
        fontSize={fSize} fontWeight="700" fill="#fff"
        style={{ pointerEvents: 'none' }}
      >
        {index + 1}
      </text>
    </g>
  );
}

interface PathLinesProps {
  waypoints: DriveWaypoint[];
  rangeStart: number;
  rangeEnd: number;
  cfg: FieldConfig;
  scale: number;
  showSpeed: boolean;
}

function PathLines({ waypoints, rangeStart, rangeEnd, cfg, scale, showSpeed }: PathLinesProps) {
  const lines: React.ReactNode[] = [];

  for (let i = 1; i < waypoints.length; i++) {
    if (i < rangeStart || i > rangeEnd) continue;
    const prev = waypoints[i - 1].pose;
    const curr = waypoints[i].pose;
    if (prev.kind !== 'literal' || curr.kind !== 'literal') continue;

    const [x1, y1] = fieldToImagePx(cfg, prev.x, prev.y);
    const [x2, y2] = fieldToImagePx(cfg, curr.x, curr.y);
    const color   = speedColor(waypoints[i].speedScaling);
    const lw      = 3.0 / scale;

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
      <g key={i}>
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={color} strokeWidth={lw} strokeLinecap="round" />
        <polygon points={arrowHeadPoints(lx1, ly1, lx2, ly2, ahSize)} fill={color} />
        {showSpeed && len > 60 / scale && (
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

// ─── Coordinate picker SVG marker ────────────────────────────────────────────

// Pixel radius (in screen space) within which scroll rotates instead of zooming.
const PICKER_ROTATE_RADIUS_PX = 50;

interface PickerMarkerProps {
  pose: { x: number; y: number };
  rotation: number;
  cfg: FieldConfig;
  scale: number;
  nearCursor: boolean;
}

function PickerMarker({ pose, rotation, cfg, scale, nearCursor }: PickerMarkerProps) {
  const [px, py] = fieldToImagePx(cfg, pose.x, pose.y);
  const arm      = 22 / scale;
  const R        = 10 / scale;
  const rotRad   = toRad(rotation);
  const arrowLen = 32 / scale;
  const ax = px + arrowLen * Math.cos(rotRad);
  const ay = py - arrowLen * Math.sin(rotRad);
  // Dashed hover ring shows the scroll-to-rotate activation radius.
  const hoverR = PICKER_ROTATE_RADIUS_PX / scale;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {nearCursor && (
        <circle
          cx={px} cy={py} r={hoverR}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={1 / scale}
          strokeDasharray={`${5 / scale} ${4 / scale}`}
          opacity={0.45}
        />
      )}
      <line x1={px - arm} y1={py} x2={px + arm} y2={py} stroke="#fbbf24" strokeWidth={1.5 / scale} />
      <line x1={px} y1={py - arm} x2={px} y2={py + arm} stroke="#fbbf24" strokeWidth={1.5 / scale} />
      <circle cx={px} cy={py} r={R} fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth={2 / scale} />
      {/* Arrow brightens when cursor is near to hint at scroll-to-rotate */}
      <line x1={px} y1={py} x2={ax} y2={ay} stroke={nearCursor ? '#fff' : '#fbbf24'} strokeWidth={(nearCursor ? 2.5 : 2) / scale} />
      <polygon points={arrowHeadPoints(px, py, ax, ay, 7 / scale)} fill={nearCursor ? '#fff' : '#fbbf24'} />
    </g>
  );
}

// ─── Coordinate picker panel ──────────────────────────────────────────────────

interface PickerPanelProps {
  pose: { x: number; y: number };
  rotation: number;
  onClose: () => void;
}

function PickerPanel({ pose, rotation, onClose }: PickerPanelProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snippet = `frc::Pose2d{${pose.x.toFixed(3)}_m, ${pose.y.toFixed(3)}_m, ${rotation.toFixed(1)}_deg}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* permission denied or doc not focused — leave button unchanged */ });
  };

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  return (
    <div className="pose-picker-panel" onMouseDown={e => e.stopPropagation()}>
      <div className="ppp-header">
        <span>Picked Pose</span>
        <button className="ppp-close" onClick={onClose} title="Dismiss">×</button>
      </div>
      <div className="ppp-alliance-note">Blue alliance origin</div>
      <table className="fwt-table">
        <tbody>
          <tr><td>X</td><td>{pose.x.toFixed(3)} m</td></tr>
          <tr><td>Y</td><td>{pose.y.toFixed(3)} m</td></tr>
          <tr><td>θ</td><td>{rotation.toFixed(1)}°</td></tr>
        </tbody>
      </table>
      <div className="ppp-snippet">{snippet}</div>
      <button className={`ppp-copy${copied ? ' ppp-copied' : ''}`} onClick={handleCopy}>
        {copied ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  );
}

// ─── Waypoint tooltip ─────────────────────────────────────────────────────────

function WaypointTooltip({ wp, x, y }: { wp: DriveWaypoint; x: number; y: number }) {
  const pose = wp.pose;
  return (
    <div className="tooltip field-waypoint-tooltip" style={{ left: x, top: y }}>
      <div className="fwt-header">
        <span className="fwt-index-dot" style={{ background: speedColor(wp.speedScaling) }} />
        <span className="fwt-command">{wp.commandName}</span>
      </div>
      {pose.kind === 'literal' ? (
        <table className="fwt-table">
          <tbody>
            {pose.resolvedFrom && (
              <tr><td colSpan={2} style={{ color: '#94a3b8', fontStyle: 'italic', paddingBottom: 2 }}>{pose.resolvedFrom}</td></tr>
            )}
            <tr><td>X</td><td>{pose.x.toFixed(3)} m</td></tr>
            <tr><td>Y</td><td>{pose.y.toFixed(3)} m</td></tr>
            <tr><td>θ</td><td>{pose.rotation.toFixed(1)}°</td></tr>
            <tr><td>Speed</td><td style={{ color: speedColor(wp.speedScaling) }}>{Math.round(wp.speedScaling * 100)}%</td></tr>
            <tr><td>Pos tol</td><td>±{(wp.posTolMeters * 100).toFixed(0)} cm</td></tr>
            <tr><td>Rot tol</td><td>±{wp.rotTolDeg.toFixed(0)}°</td></tr>
          </tbody>
        </table>
      ) : (
        <div className="fwt-named">{pose.expression}</div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const MIN_SCALE_FACTOR = 0.5;
const MAX_SCALE_FACTOR = 10;

interface Props {
  command: CommandFunction | null;
  /** Pre-extracted raw waypoints from Viewer (avoids duplicate extraction) */
  waypoints: DriveWaypoint[];
  /** Currently highlighted waypoint index — controlled by parent */
  hoveredIndex: number | null;
  onHoverIndex: (i: number | null) => void;
  /** Field display controls — lifted to the combined header in Viewer */
  redAlliance: boolean;
  showPosTolerance: boolean;
  showRotTolerance: boolean;
  showSpeed: boolean;
}

export function FieldView({ command, waypoints: rawWaypoints, hoveredIndex, onHoverIndex, redAlliance, showPosTolerance, showRotTolerance, showSpeed }: Props) {
  const cfg = ACTIVE_FIELD;

  // ── Zoom / pan ──────────────────────────────────────────────────────────────
  const viewportRef    = useRef<HTMLDivElement>(null);
  const isDragging     = useRef(false);
  const hasMoved       = useRef(false);
  const dragOrigin     = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const fitRef         = useRef({ scale: 0.2, x: 0, y: 0 });
  // Always-current transform so wheel/mousemove handlers don't capture stale values.
  const transformRef   = useRef({ scale: 0.2, panX: 0, panY: 0 });
  // Whether cursor is within PICKER_ROTATE_RADIUS_PX of the picked pose (screen px).
  const nearPickerRef  = useRef(false);

  const [scale, setScale] = useState(0.2);
  const [pan,   setPan  ] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [nearPicker, setNearPicker] = useState(false);
  // Tracks hover that originated inside the field viewport (for tooltip placement).
  // Distinct from the external hoveredIndex prop, which can also be set by the timeline.
  const [fieldHoveredIndex, setFieldHoveredIndex] = useState<number | null>(null);

  // ── Coordinate picker ────────────────────────────────────────────────────────
  const [pickerMode,     setPickerMode    ] = useState(false);
  const [pickedPose,     setPickedPose    ] = useState<{ x: number; y: number } | null>(null);
  const [pickerRotation, setPickerRotation] = useState(0);
  // Ref mirrors pickedPose so handleMouseMove can read it without a stale closure.
  const pickedPoseRef = useRef<{ x: number; y: number } | null>(null);

  const setPickedPoseAndRef = useCallback((pose: { x: number; y: number } | null) => {
    pickedPoseRef.current = pose;
    setPickedPose(pose);
    if (!pose) { nearPickerRef.current = false; setNearPicker(false); }
  }, []);

  // Keep transformRef current so wheel/mousemove can read scale+pan without
  // capturing them in closure deps (would cause stale values during fast scroll).
  useEffect(() => { transformRef.current = { scale, panX: pan.x, panY: pan.y }; }, [scale, pan]);

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
      setScale(prev => (prev === 0.2 ? fit.scale : prev));
      setPan(prev => (prev.x === 0 && prev.y === 0 ? { x: fit.x, y: fit.y } : prev));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cfg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPickerMode(false); setPickedPoseAndRef(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (nearPickerRef.current) {
      // Scroll rotates the picked pose (5° per tick; scroll-up = CCW)
      setPickerRotation(r => r + (e.deltaY < 0 ? 5 : -5));
      return;
    }
    const { scale: s, panX, panY } = transformRef.current;
    const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const fitS  = fitRef.current.scale;
    const newS  = Math.min(Math.max(s * delta, fitS * MIN_SCALE_FACTOR), fitS * MAX_SCALE_FACTOR);
    const rect  = viewportRef.current!.getBoundingClientRect();
    const cx    = e.clientX - rect.left;
    const cy    = e.clientY - rect.top;
    setScale(newS);
    setPan({ x: cx - (cx - panX) * (newS / s), y: cy - (cy - panY) * (newS / s) });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    hasMoved.current   = false;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    if (!pickerMode) (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }, [pan, pickerMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Only update tooltip position when a tooltip is actually visible — avoids
    // a re-render on every pixel of cursor movement when nothing is hovered.
    if (fieldHoveredIndex !== null) {
      setMousePos({ x: e.clientX + 16, y: e.clientY + 8 });
    }

    // Proximity check for scroll-to-rotate: convert picked pose to screen space
    // using the always-current transformRef so we don't need scale/pan in deps.
    if (pickedPoseRef.current && viewportRef.current) {
      const { scale: s, panX, panY } = transformRef.current;
      const rect = viewportRef.current.getBoundingClientRect();
      const [imgX, imgY] = fieldToImagePx(cfg, pickedPoseRef.current.x, pickedPoseRef.current.y);
      const screenX = imgX * s + panX + rect.left;
      const screenY = imgY * s + panY + rect.top;
      const dx = e.clientX - screenX, dy = e.clientY - screenY;
      const near = Math.sqrt(dx * dx + dy * dy) < PICKER_ROTATE_RADIUS_PX;
      if (near !== nearPickerRef.current) {
        nearPickerRef.current = near;
        setNearPicker(near);
      }
    }

    if (!isDragging.current) return;
    hasMoved.current = true;
    setPan({
      x: dragOrigin.current.px + e.clientX - dragOrigin.current.mx,
      y: dragOrigin.current.py + e.clientY - dragOrigin.current.my,
    });
  }, [fieldHoveredIndex, cfg]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // A pick requires two conditions: (1) isDragging must be true, meaning a
    // mousedown reached the viewport handler (overlays call stopPropagation on
    // mousedown to prevent this); (2) the pointer must not have moved (no drag).
    const wasClick = isDragging.current && !hasMoved.current;
    isDragging.current = false;
    if (!pickerMode) (e.currentTarget as HTMLElement).style.cursor = 'grab';

    if (wasClick && pickerMode && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const imgX = (e.clientX - rect.left - pan.x) / scale;
      const imgY = (e.clientY - rect.top  - pan.y) / scale;
      const [fx, fy] = imagePxToField(cfg, imgX, imgY);
      setPickedPoseAndRef({ x: fx, y: fy });
      // Cursor is at the pose — activate rotation mode immediately without
      // waiting for the next mousemove to trigger the proximity check.
      nearPickerRef.current = true;
      setNearPicker(true);
    }
  }, [pickerMode, pan, scale, cfg, setPickedPoseAndRef]);

  const handleViewportMouseLeave = useCallback((e: React.MouseEvent) => {
    handleMouseUp(e);
    // Clear any stuck tooltip in case the cursor exited without the waypoint
    // circle's onMouseLeave firing (can happen on fast cursor movement / Safari).
    setFieldHoveredIndex(null);
    onHoverIndex(null);
  }, [handleMouseUp, onHoverIndex]);

  // Stable callback: suppress hover only while actively dragging, not after.
  // Also tracks fieldHoveredIndex so the tooltip only shows when the mouse is
  // actually over the field viewport (not when driven by timeline cross-highlight).
  const handleWaypointHover = useCallback((i: number | null, e?: React.MouseEvent) => {
    if (!isDragging.current) {
      onHoverIndex(i);
      setFieldHoveredIndex(i);
      // Set position immediately on enter so the tooltip doesn't flash at the
      // stale previous position before the first mousemove fires.
      if (i !== null && e) {
        setMousePos({ x: e.clientX + 16, y: e.clientY + 8 });
      }
    }
  }, [onHoverIndex]);

  const zoomBy = useCallback((factor: number) => {
    const fitS = fitRef.current.scale;
    setScale(prev => {
      const next = Math.min(Math.max(prev * factor, fitS * MIN_SCALE_FACTOR), fitS * MAX_SCALE_FACTOR);
      const el = viewportRef.current;
      if (el) {
        const cx = el.clientWidth / 2, cy = el.clientHeight / 2;
        setPan(p => ({ x: cx - (cx - p.x) * (next / prev), y: cy - (cy - p.y) * (next / prev) }));
      }
      return next;
    });
  }, []);

  // ── Slider state ────────────────────────────────────────────────────────────
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd,   setRangeEnd  ] = useState(0);

  // ── Waypoints ───────────────────────────────────────────────────────────────
  const waypoints = useMemo(
    () => rawWaypoints.map(wp => applyAllianceFlip(wp, redAlliance, cfg)),
    [rawWaypoints, redAlliance, cfg],
  );

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
  const hoveredWp = fieldHoveredIndex !== null ? waypoints[fieldHoveredIndex] : null;

  return (
    <div className="field-view">
      {/* ── Viewport (zoom/pan) ── */}
      <div
        ref={viewportRef}
        className="field-viewport"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleViewportMouseLeave}
        style={{ cursor: pickerMode ? 'crosshair' : 'grab' }}
      >
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
          <svg
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
            width={W} height={H}
          >
            <PathLines
              waypoints={waypoints}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              cfg={cfg}
              scale={scale}
              showSpeed={showSpeed}
            />

            {waypoints.map((wp, i) => (
              <WaypointMarker
                key={i}
                wp={wp}
                index={i}
                cfg={cfg}
                scale={scale}
                active={hoveredIndex === i}
                ghost={i < rangeStart || i > rangeEnd}
                showPosTolerance={showPosTolerance}
                showRotTolerance={showRotTolerance}
                onHover={handleWaypointHover}
              />
            ))}

            {/* Coordinate picker marker */}
            {pickedPose && (
              <PickerMarker pose={pickedPose} rotation={pickerRotation} cfg={cfg} scale={scale} nearCursor={nearPicker} />
            )}
          </svg>
        </div>

        {/* Floating zoom controls */}
        <div className="zoom-float" onMouseDown={e => e.stopPropagation()}>
          <button className="zoom-btn" onClick={() => zoomBy(1.25)} title="Zoom in">+</button>
          <button className="zoom-btn" onClick={() => zoomBy(1 / 1.25)} title="Zoom out">−</button>
          <button className="zoom-btn" onClick={applyFit} title="Fit to screen">⤢</button>
          <div className="zoom-divider" />
          <button
            className={`zoom-btn${pickerMode ? ' picker-active' : ''}`}
            onClick={() => { setPickerMode(m => { if (m) setPickedPoseAndRef(null); return !m; }); }}
            title={pickerMode ? 'Exit coordinate picker (Esc)' : 'Pick a field coordinate'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>

        {/* Waypoint tooltip */}
        {hoveredWp && (
          <WaypointTooltip wp={hoveredWp} x={mousePos.x} y={mousePos.y} />
        )}

        {/* Coordinate picker panel */}
        {pickedPose && (
          <PickerPanel
            pose={pickedPose}
            rotation={pickerRotation}
            onClose={() => { setPickedPoseAndRef(null); setPickerMode(false); }}
          />
        )}
      </div>

      {/* ── Path range slider ── */}
      {waypoints.length > 1 && (
        <div className="field-slider-section">
        <RangeSlider
            count={waypoints.length}
            start={rangeStart}
            end={rangeEnd}
            waypoints={waypoints}
            onChange={(s, e) => { setRangeStart(s); setRangeEnd(e); }}
          />
        </div>
      )}
    </div>
  );
}
