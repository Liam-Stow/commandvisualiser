import type { CommandFunction, ParsedFile } from '../types/command';

interface Props {
  file: ParsedFile;
  selectedCommand: CommandFunction | null;
  onSelectCommand: (cmd: CommandFunction) => void;
}

function commandTypePreview(cmd: CommandFunction): string {
  switch (cmd.node.type) {
    case 'sequence':    return 'SEQ';
    case 'parallel':    return 'PAR';
    case 'race':        return 'RACE';
    case 'deadline':    return 'DEADLINE';
    case 'decorated':   return cmd.node.decorator.toUpperCase();
    case 'conditional': return 'IF/ELSE';
    case 'leaf':        return 'CMD';
    default:            return '?';
  }
}

function commandTypeClass(cmd: CommandFunction): string {
  switch (cmd.node.type) {
    case 'sequence':    return 'badge-seq';
    case 'parallel':    return 'badge-par';
    case 'race':        return 'badge-race';
    case 'deadline':    return 'badge-deadline';
    case 'conditional': return 'badge-cond';
    default:            return 'badge-leaf';
  }
}

function childCount(cmd: CommandFunction): number {
  const n = cmd.node;
  if (n.type === 'sequence' || n.type === 'parallel' || n.type === 'race') return n.children.length;
  if (n.type === 'deadline') return 1 + n.others.length;
  if (n.type === 'conditional') return 2;
  if (n.type === 'decorated') return 1;
  return 0;
}

export function CommandPanel({ file, selectedCommand, onSelectCommand }: Props) {
  if (file.functions.length === 0) {
    return (
      <div className="command-panel empty-panel">
        <div className="file-panel-header">{file.fileName}</div>
        <p>No <code>frc2::CommandPtr</code> functions found.</p>
      </div>
    );
  }

  return (
    <div className="command-panel">
      <div className="file-panel-header">
        <span className="file-panel-name">{file.fileName}</span>
        <span className="file-panel-count">{file.functions.length} commands</span>
      </div>
      <div className="command-list">
        {file.functions.map(cmd => {
          const active = selectedCommand?.fullName === cmd.fullName && selectedCommand?.name === cmd.name;
          const count  = childCount(cmd);
          return (
            <button
              key={cmd.fullName + cmd.name}
              className={`command-item ${active ? 'active' : ''}`}
              onClick={() => onSelectCommand(cmd)}
            >
              <span className={`cmd-badge ${commandTypeClass(cmd)}`}>
                {commandTypePreview(cmd)}
              </span>
              <span className="cmd-name">{cmd.name}</span>
              {count > 0 && (
                <span className="cmd-children" title={`${count} child command${count !== 1 ? 's' : ''}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
