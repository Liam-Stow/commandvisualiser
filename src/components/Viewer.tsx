import { useState, useMemo, useCallback } from 'react';
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
  showTolerance: boolean;
  setShowTolerance: (v: boolean) => void;
  showRotation: boolean;
  setShowRotation: (v: boolean) => void;
}

function ViewerHeader({
  command, hasWaypoints,
  redAlliance, setRedAlliance,
  showTolerance, setShowTolerance,
  showRotation, setShowRotation,
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
              <input type="checkbox" checked={showTolerance} onChange={e => setShowTolerance(e.target.checked)} />
              Pos Tol
            </label>
            <label className="toggle-label">
              <input type="checkbox" checked={showRotation} onChange={e => setShowRotation(e.target.checked)} />
              Rot Tol
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

  // Lifted from FieldView
  const [redAlliance,   setRedAlliance  ] = useState(false);
  const [showTolerance, setShowTolerance] = useState(true);
  const [showRotation,  setShowRotation ] = useState(true);

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
    const startH = fieldHeight;
    document.body.style.cursor     = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      setFieldHeight(Math.max(150, Math.min(600, startH + ev.clientY - startY)));
    };
    const onUp = () => {
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [fieldHeight]);

  const header = (
    <ViewerHeader
      command={command}
      hasWaypoints={hasWaypoints}
      redAlliance={redAlliance} setRedAlliance={setRedAlliance}
      showTolerance={showTolerance} setShowTolerance={setShowTolerance}
      showRotation={showRotation} setShowRotation={setShowRotation}
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
          showTolerance={showTolerance}
          showRotation={showRotation}
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
