import type { AnyCommandNode, CommandFunction, ParsedFile } from '../types/command';

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

function leafNodeCount(node: AnyCommandNode): number {
  switch (node.type) {
    case 'sequence':
    case 'parallel':
    case 'race':
      return node.children.reduce((sum, c) => sum + leafNodeCount(c), 0);
    case 'deadline':
      return leafNodeCount(node.deadline) + node.others.reduce((sum, c) => sum + leafNodeCount(c), 0);
    case 'conditional':
      return leafNodeCount(node.trueBranch) + leafNodeCount(node.falseBranch);
    case 'decorated':
      return leafNodeCount(node.child);
    default:
      return 1; // leaf and unknown
  }
}

export function CommandPanel({ file, selectedCommand, onSelectCommand }: Props) {
  if (file.functions.length === 0) {
    return (
      <div className="command-panel">
        <div className="file-panel-header">
          <span className="file-panel-name">{file.fileName}</span>
        </div>
        <div className="empty-panel">
          <p>No <code>frc2::CommandPtr</code> functions found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="command-panel">
      <div className="file-panel-header">
        <span className="file-panel-name">{file.fileName}</span>
      </div>
      <div className="command-list">
        {file.functions.map(cmd => {
          const active = selectedCommand?.fullName === cmd.fullName && selectedCommand?.name === cmd.name;
          const count  = leafNodeCount(cmd.node);
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
              <span className="cmd-children" title={`${count} leaf command${count !== 1 ? 's' : ''}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
