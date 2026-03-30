import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { CommandFunction } from '../types/command';
import type { DriveWaypoint } from '../parser/driveToPoseParser';
import { extractWaypoints } from '../parser/driveToPoseParser';
import { TimelineView, Legend } from './TimelineView';
import { FieldView } from './FieldView';

// ─── Combined header ──────────────────────────────────────────────────────────

interface HeaderProps {
  command: CommandFunction | null;
  hasWaypoints: boolean;
  redAlliance: boolean;
  setRedAlliance: (v: boolean) => void;
  showPosTolerance: boolean;
  setShowPosTolerance: (v: boolean) => void;
  showRotTolerance: boolean;
  setShowRotTolerance: (v: boolean) => void;
  showSpeed: boolean;
  setShowSpeed: (v: boolean) => void;
}

function ViewerHeader({
  command, hasWaypoints,
  redAlliance, setRedAlliance,
  showPosTolerance, setShowPosTolerance,
  showRotTolerance, setShowRotTolerance,
  showSpeed, setShowSpeed,
}: HeaderProps) {
  return (
    <div className="viewer-header">
      {/* Command name */}
      <div className="vh-title">
        {command ? (
          <>
            <span className="timeline-cmd-name">{command.name}</span>
            {command.fullName !== command.name && (
              <span className="timeline-cmd-full">{command.fullName}</span>
            )}
          </>
        ) : (
          <span className="timeline-cmd-name vh-placeholder">No command selected</span>
        )}
      </div>

      {/* Field controls — only when field view is visible */}
      {hasWaypoints && (
        <>
          <div className="vh-divider" />
          <div className="vh-field-controls">
            <label className="toggle-label">
              <input type="checkbox" checked={showPosTolerance} onChange={e => setShowPosTolerance(e.target.checked)} />
              Pos Tol
            </label>
            <label className="toggle-label">
              <input type="checkbox" checked={showRotTolerance} onChange={e => setShowRotTolerance(e.target.checked)} />
              Rot Tol
            </label>
            <label className="toggle-label">
              <input type="checkbox" checked={showSpeed} onChange={e => setShowSpeed(e.target.checked)} />
              Speed
            </label>
            <div className="alliance-toggle">
              <button className={`alliance-btn ${!redAlliance ? 'active-blue' : ''}`} onClick={() => setRedAlliance(false)}>Blue</button>
              <button className={`alliance-btn ${redAlliance  ? 'active-red'  : ''}`} onClick={() => setRedAlliance(true)}>Red</button>
            </div>
          </div>
        </>
      )}

      {/* Timeline legend */}
      <div className="vh-timeline-controls">
        <Legend />
      </div>
    </div>
  );
}

// ─── Viewer ───────────────────────────────────────────────────────────────────

interface Props {
  command: CommandFunction | null;
}

export function Viewer({ command }: Props) {
  const [hoveredWaypointIndex, setHoveredWaypointIndex] = useState<number | null>(null);
  const [fieldHeight, setFieldHeight] = useState(() => Math.round(window.innerHeight / 2));
  const fieldHeightRef = useRef(fieldHeight);
  useEffect(() => { fieldHeightRef.current = fieldHeight; }, [fieldHeight]);

  // Lifted from FieldView
  const [redAlliance,   setRedAlliance  ] = useState(false);
  const [showPosTolerance, setShowPosTolerance] = useState(true);
  const [showRotTolerance,  setShowRotTolerance ] = useState(true);
  const [showSpeed,  setShowSpeed ] = useState(false);

  // Lifted from TimelineView
  const [zoom, setZoom] = useState(1.0);

  const waypoints: DriveWaypoint[] = useMemo(
    () => command ? extractWaypoints(command.node) : [],
    [command],
  );

  const hasWaypoints = waypoints.length > 0;

  const startVerticalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = fieldHeightRef.current;
    document.body.style.cursor     = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const maxH = Math.round(window.innerHeight * 0.75);
      setFieldHeight(Math.max(150, Math.min(maxH, startH + ev.clientY - startY)));
    };
    const onUp = () => {
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, []);

  const header = (
    <ViewerHeader
      command={command}
      hasWaypoints={hasWaypoints}
      redAlliance={redAlliance} setRedAlliance={setRedAlliance}
      showPosTolerance={showPosTolerance} setShowPosTolerance={setShowPosTolerance}
      showRotTolerance={showRotTolerance} setShowRotTolerance={setShowRotTolerance}
      showSpeed={showSpeed} setShowSpeed={setShowSpeed}
    />
  );

  if (!hasWaypoints) {
    return (
      <div className="viewer">
        {header}
        <TimelineView command={command} zoom={zoom} setZoom={setZoom} />
      </div>
    );
  }

  return (
    <div className="viewer viewer-split">
      {header}
      <div className="viewer-field-pane" style={{ height: fieldHeight }}>
        <FieldView
          command={command}
          waypoints={waypoints}
          hoveredIndex={hoveredWaypointIndex}
          onHoverIndex={setHoveredWaypointIndex}
          redAlliance={redAlliance}
          showPosTolerance={showPosTolerance}
          showRotTolerance={showRotTolerance}
          showSpeed={showSpeed}
        />
      </div>
      <div className="resize-handle-h" onMouseDown={startVerticalResize} />
      <div className="viewer-timeline-pane">
        <TimelineView
          command={command}
          zoom={zoom}
          setZoom={setZoom}
          waypoints={waypoints}
          hoveredWaypointIndex={hoveredWaypointIndex}
          onHoverWaypointIndex={setHoveredWaypointIndex}
        />
      </div>
    </div>
  );
}
