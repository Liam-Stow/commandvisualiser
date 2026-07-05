import { useState } from 'react';
import { normaliseCommandName } from '../parser/driveToPoseParser';
import { NavArrowIcon } from './Icons';

interface Props {
  commandNames: string[];
  onChange: (names: string[]) => void;
}

/**
 * Sidebar section letting the user configure which function names are treated
 * as "drive to pose" commands (e.g. DriveToPose, AutonomousDriveTo). The first
 * argument of each matched call is plotted on the field.
 */
export function DriveCommandsPanel({ commandNames, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const addName = () => {
    const name = normaliseCommandName(draft);
    if (!name) return;
    if (!commandNames.some(n => n.toLowerCase() === name.toLowerCase())) {
      onChange([...commandNames, name]);
    }
    setDraft('');
  };

  const removeName = (name: string) => {
    onChange(commandNames.filter(n => n !== name));
  };

  return (
    <div className={`drive-cmds ${open ? 'open' : ''}`}>
      <button className="drive-cmds-header" onClick={() => setOpen(o => !o)}>
        <span className={`drive-cmds-caret ${open ? 'open' : ''}`}><NavArrowIcon /></span>
        <span className="drive-cmds-title">Drive-to-Pose Commands</span>
        <span className="drive-cmds-count">{commandNames.length}</span>
      </button>

      {open && (
        <div className="drive-cmds-body">
          <p className="drive-cmds-hint">
            Function names whose first argument is a target pose. Each pose is plotted on the field.
          </p>

          <div className="drive-cmds-list">
            {commandNames.length === 0 && (
              <div className="drive-cmds-empty">No commands configured.</div>
            )}
            {commandNames.map(name => (
              <div className="drive-cmd-chip" key={name}>
                <span className="drive-cmd-name" title={name}>{name}</span>
                <button
                  className="drive-cmd-remove"
                  onClick={() => removeName(name)}
                  aria-label={`Remove ${name}`}
                  title={`Remove ${name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="drive-cmds-add">
            <input
              className="drive-cmds-input"
              type="text"
              value={draft}
              placeholder="Add command name…"
              spellCheck={false}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addName(); }}
            />
            <button className="drive-cmds-add-btn" onClick={addName} disabled={!normaliseCommandName(draft)}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
