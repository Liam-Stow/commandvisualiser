import { useState, useMemo } from 'react';
import type { CommandFunction } from '../types/command';
import { extractWaypoints } from '../parser/driveToPoseParser';
import { TimelineView } from './TimelineView';
import { FieldView } from './FieldView';

type Tab = 'timeline' | 'field';

interface Props {
  command: CommandFunction | null;
}

export function Viewer({ command }: Props) {
  const [tab, setTab] = useState<Tab>('timeline');

  const hasWaypoints = useMemo(
    () => command ? extractWaypoints(command.node).length > 0 : false,
    [command],
  );

  return (
    <div className="viewer">
      <div className="viewer-tabs">
        <button
          className={`viewer-tab ${tab === 'timeline' ? 'active' : ''}`}
          onClick={() => setTab('timeline')}
        >
          Timeline
        </button>
        <button
          className={`viewer-tab ${tab === 'field' ? 'active' : ''} ${!hasWaypoints && command ? 'tab-dim' : ''}`}
          onClick={() => setTab('field')}
          title={!hasWaypoints && command ? 'No DriveToPose commands in this command' : undefined}
        >
          Field
          {hasWaypoints && <span className="tab-dot" />}
        </button>
      </div>

      <div className="viewer-content">
        {tab === 'timeline' && <TimelineView command={command} />}
        {tab === 'field'    && <FieldView    command={command} />}
      </div>
    </div>
  );
}
