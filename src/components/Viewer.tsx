import { useState, useMemo, useCallback } from 'react';
import type { CommandFunction } from '../types/command';
import type { DriveWaypoint } from '../parser/driveToPoseParser';
import { extractWaypoints } from '../parser/driveToPoseParser';
import { TimelineView } from './TimelineView';
import { FieldView } from './FieldView';

interface Props {
  command: CommandFunction | null;
}

export function Viewer({ command }: Props) {
  const [hoveredWaypointIndex, setHoveredWaypointIndex] = useState<number | null>(null);
  const [fieldHeight, setFieldHeight] = useState(() => Math.round(window.innerHeight / 2));

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

  if (!hasWaypoints) {
    return (
      <div className="viewer">
        <TimelineView command={command} />
      </div>
    );
  }

  return (
    <div className="viewer viewer-split">
      <div className="viewer-field-pane" style={{ height: fieldHeight }}>
        <FieldView
          command={command}
          waypoints={waypoints}
          hoveredIndex={hoveredWaypointIndex}
          onHoverIndex={setHoveredWaypointIndex}
        />
      </div>
      <div className="resize-handle-h" onMouseDown={startVerticalResize} />
      <div className="viewer-timeline-pane">
        <TimelineView
          command={command}
          waypoints={waypoints}
          hoveredWaypointIndex={hoveredWaypointIndex}
          onHoverWaypointIndex={setHoveredWaypointIndex}
        />
      </div>
    </div>
  );
}
