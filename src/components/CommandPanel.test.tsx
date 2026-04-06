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

// ─── Pose indicator icons ─────────────────────────────────────────────────────

const drivePose = (id: string): AnyCommandNode => ({
  type: 'leaf', id, name: 'DriveToPose()', raw: 'sub.DriveToPose(pose)',
});

describe('pose indicator icons', () => {
  it('shows lightning icon for a command with no poses', () => {
    const file = makeFile([makeCmd('MySeq', seq(leaf('a'), leaf('b')))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(document.querySelector('[data-testid="icon-lightning"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="icon-nav-arrow"]')).toBeNull();
  });

  it('shows nav arrow icon for a command containing a DriveToPose leaf', () => {
    const file = makeFile([makeCmd('MyAuto', seq(leaf('a'), drivePose('dp')))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(document.querySelector('[data-testid="icon-nav-arrow"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="icon-lightning"]')).toBeNull();
  });

  it('shows lightning for commands without poses and nav arrow for commands with poses', () => {
    const file = makeFile([
      makeCmd('NoPoses', seq(leaf('a'), leaf('b'))),
      makeCmd('HasPoses', seq(leaf('c'), drivePose('dp'))),
    ]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(document.querySelectorAll('[data-testid="icon-lightning"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="icon-nav-arrow"]')).toHaveLength(1);
  });

  it('detects poses nested inside decorated nodes', () => {
    const node: AnyCommandNode = { type: 'decorated', id: 'dec', decorator: 'timeout', child: drivePose('dp') };
    const file = makeFile([makeCmd('Decorated', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(document.querySelector('[data-testid="icon-nav-arrow"]')).toBeTruthy();
  });

  it('detects poses inside deadline nodes', () => {
    const node: AnyCommandNode = { type: 'deadline', id: 'd', deadline: drivePose('dp'), others: [leaf('a')] };
    const file = makeFile([makeCmd('Deadline', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(document.querySelector('[data-testid="icon-nav-arrow"]')).toBeTruthy();
  });

  it('detects poses inside conditional branches', () => {
    const node: AnyCommandNode = { type: 'conditional', id: 'c', trueBranch: drivePose('dp'), falseBranch: leaf('f') };
    const file = makeFile([makeCmd('Cond', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(document.querySelector('[data-testid="icon-nav-arrow"]')).toBeTruthy();
  });
});

// ─── Leaf count ───────────────────────────────────────────────────────────────

describe('leaf count', () => {
  it('shows leaf count for a sequence with 3 children', () => {
    const node = seq(leaf('a'), leaf('b'), leaf('c'));
    const file = makeFile([makeCmd('MySeq', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows leaf count for a parallel', () => {
    const node = par(leaf('a'), leaf('b'));
    const file = makeFile([makeCmd('MyPar', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('shows 2 for conditional with two leaf branches', () => {
    const node: AnyCommandNode = {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'), falseBranch: leaf('f'),
    };
    const file = makeFile([makeCmd('MyCond', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('counts all leaves across deadline+others', () => {
    const node: AnyCommandNode = {
      type: 'deadline', id: 'd',
      deadline: leaf('a'),
      others: [leaf('b'), leaf('c')],
    };
    const file = makeFile([makeCmd('MyDl', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('3')).toBeTruthy();
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

  it('shows 1 for a bare leaf command', () => {
    const file = makeFile([makeCmd('MyLeaf', leaf('a'))]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('counts all leaves recursively in a nested tree', () => {
    // seq( par(leaf, leaf), leaf ) → 3 leaves, not 2 direct children
    const node = seq(par(leaf('a'), leaf('b')), leaf('c'));
    const file = makeFile([makeCmd('MyNested', node)]);
    render(<CommandPanel file={file} selectedCommand={null} onSelectCommand={() => {}} />);
    expect(screen.getByText('3')).toBeTruthy();
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
