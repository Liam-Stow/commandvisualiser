import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPanel } from './CommandPanel';
import type { ParsedFile, CommandFunction, AnyCommandNode } from '../types/command';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCmd(name: string, node: AnyCommandNode): CommandFunction {
  return { name, fullName: name, node, raw: '' };
}

function makeFile(functions: CommandFunction[], name = 'auto.cpp'): ParsedFile {
  return {
    fileName: name,
    filePath: `/commands/${name}`,
    category: 'commands',
    functions,
  };
}

const leaf = (id: string): AnyCommandNode => ({ type: 'leaf', id, name: `${id}()`, raw: '' });
const seq = (...children: AnyCommandNode[]): AnyCommandNode => ({ type: 'sequence', id: 'seq', children });
const par = (...children: AnyCommandNode[]): AnyCommandNode => ({ type: 'parallel', id: 'par', children });
const race = (...children: AnyCommandNode[]): AnyCommandNode => ({ type: 'race', id: 'race', children });

// ─── Empty states ─────────────────────────────────────────────────────────────

describe('empty states', () => {
  it('shows empty state when no file is selected', () => {
    render(<CommandPanel file={null} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText(/Select a file/)).toBeTruthy();
  });

  it('shows no-commands message when file has zero functions', () => {
    render(<CommandPanel file={makeFile([])} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText(/No/)).toBeTruthy();
    expect(screen.getByText('frc2::CommandPtr')).toBeTruthy();
  });

  it('shows file name when file has no commands', () => {
    render(<CommandPanel file={makeFile([], 'empty.cpp')} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('empty.cpp')).toBeTruthy();
  });
});

// ─── Command list rendering ───────────────────────────────────────────────────

describe('command list', () => {
  it('renders the file name', () => {
    const file = makeFile([makeCmd('ScoreHigh', leaf('a'))], 'scoring.cpp');
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('scoring.cpp')).toBeTruthy();
  });

  it('shows the command count', () => {
    const file = makeFile([makeCmd('A', leaf('a')), makeCmd('B', leaf('b'))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('2 commands')).toBeTruthy();
  });

  it('renders a button for each command', () => {
    const file = makeFile([makeCmd('CmdA', leaf('a')), makeCmd('CmdB', leaf('b'))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('renders command names', () => {
    const file = makeFile([makeCmd('ScoreHigh', leaf('a')), makeCmd('ScoreLow', leaf('b'))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('ScoreHigh')).toBeTruthy();
    expect(screen.getByText('ScoreLow')).toBeTruthy();
  });

  it('calls onSelectCommand with the correct command when clicked', () => {
    const onSelect = vi.fn();
    const cmd = makeCmd('TestCmd', leaf('a'));
    const file = makeFile([cmd]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(cmd);
  });

  it('calls onSelectCommand with the correct command when multiple exist', () => {
    const onSelect = vi.fn();
    const cmdA = makeCmd('CmdA', leaf('a'));
    const cmdB = makeCmd('CmdB', leaf('b'));
    const file = makeFile([cmdA, cmdB]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={onSelect} />);
    fireEvent.click(screen.getByText('CmdB').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith(cmdB);
  });
});

// ─── Type badges ──────────────────────────────────────────────────────────────

describe('type badges', () => {
  it('shows SEQ badge for sequence', () => {
    const file = makeFile([makeCmd('MySeq', seq(leaf('a'), leaf('b')))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('SEQ')).toBeTruthy();
  });

  it('shows PAR badge for parallel', () => {
    const file = makeFile([makeCmd('MyPar', par(leaf('a'), leaf('b')))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('PAR')).toBeTruthy();
  });

  it('shows RACE badge for race', () => {
    const file = makeFile([makeCmd('MyRace', race(leaf('a'), leaf('b')))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('RACE')).toBeTruthy();
  });

  it('shows DEADLINE badge for deadline', () => {
    const node: AnyCommandNode = { type: 'deadline', id: 'd', deadline: leaf('a'), others: [leaf('b')] };
    const file = makeFile([makeCmd('MyDeadline', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('DEADLINE')).toBeTruthy();
  });

  it('shows IF/ELSE badge for conditional', () => {
    const node: AnyCommandNode = {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'), falseBranch: leaf('f'),
    };
    const file = makeFile([makeCmd('MyCond', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('IF/ELSE')).toBeTruthy();
  });

  it('shows CMD badge for leaf', () => {
    const file = makeFile([makeCmd('MyLeaf', leaf('a'))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('CMD')).toBeTruthy();
  });

  it('shows decorator name uppercased for decorated nodes', () => {
    const node: AnyCommandNode = {
      type: 'decorated', id: 'dec',
      decorator: 'timeout',
      child: leaf('a'),
    };
    const file = makeFile([makeCmd('MyTimeout', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('TIMEOUT')).toBeTruthy();
  });
});

// ─── Child count ──────────────────────────────────────────────────────────────

describe('child count', () => {
  it('shows child count for a sequence with 3 children', () => {
    const node = seq(leaf('a'), leaf('b'), leaf('c'));
    const file = makeFile([makeCmd('MySeq', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows child count for a parallel', () => {
    const node = par(leaf('a'), leaf('b'));
    const file = makeFile([makeCmd('MyPar', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('shows 2 for conditional (always two branches)', () => {
    const node: AnyCommandNode = {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'), falseBranch: leaf('f'),
    };
    const file = makeFile([makeCmd('MyCond', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('counts deadline+others for deadline node', () => {
    const node: AnyCommandNode = {
      type: 'deadline', id: 'd',
      deadline: leaf('a'),
      others: [leaf('b'), leaf('c')],
    };
    const file = makeFile([makeCmd('MyDl', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('3')).toBeTruthy(); // 1 deadline + 2 others
  });

  it('shows 1 for decorated node', () => {
    const node: AnyCommandNode = {
      type: 'decorated', id: 'dec',
      decorator: 'timeout',
      child: leaf('a'),
    };
    const file = makeFile([makeCmd('MyDec', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('does not show count for leaf (0 children)', () => {
    const file = makeFile([makeCmd('MyLeaf', leaf('a'))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    // There should be no count element since count=0
    const buttons = screen.getAllByRole('button');
    // The button text content should not contain a standalone number
    const btnText = buttons[0].textContent ?? '';
    expect(btnText).not.toMatch(/^\d+$/); // no lone number
  });
});

// ─── Active selection ─────────────────────────────────────────────────────────

describe('active selection', () => {
  it('marks the selected command button as active', () => {
    const cmd = makeCmd('ActiveCmd', leaf('a'));
    const file = makeFile([cmd]);
    render(<CommandPanel file={file} selectedCommand={cmd} onSelectCommand={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.classList.contains('active')).toBe(true);
  });

  it('does not mark other commands as active', () => {
    const cmdA = makeCmd('CmdA', leaf('a'));
    const cmdB = makeCmd('CmdB', leaf('b'));
    const file = makeFile([cmdA, cmdB]);
    render(<CommandPanel file={file} selectedCommand={cmdA} onSelectCommand={() => {}} />);
    const buttons = screen.getAllByRole('button');
    const activeBtns = buttons.filter(b => b.classList.contains('active'));
    expect(activeBtns).toHaveLength(1);
    expect(activeBtns[0].textContent).toContain('CmdA');
  });

  it('no buttons are active when selectedCommand is null', () => {
    const file = makeFile([makeCmd('CmdA', leaf('a')), makeCmd('CmdB', leaf('b'))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.every(b => !b.classList.contains('active'))).toBe(true);
  });
});
