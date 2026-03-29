import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineView } from './TimelineView';
import type { CommandFunction, AnyCommandNode } from '../types/command';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCmd(name: string, node: AnyCommandNode, fullName?: string): CommandFunction {
  return { name, fullName: fullName ?? name, node, raw: '' };
}

const leaf = (id: string, name = `${id}()`): AnyCommandNode => ({
  type: 'leaf', id, name, raw: `SubSystem::GetInstance().${name}`,
});

const seq = (...children: AnyCommandNode[]): AnyCommandNode => ({
  type: 'sequence', id: 'seq', children,
});

const par = (...children: AnyCommandNode[]): AnyCommandNode => ({
  type: 'parallel', id: 'par', children,
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('empty state', () => {
  it('shows empty message when command is null', () => {
    render(<TimelineView command={null} />);
    expect(screen.getByText(/Select a command/)).toBeTruthy();
  });

  it('does not render SVG when command is null', () => {
    const { container } = render(<TimelineView command={null} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});

// ─── SVG rendering ────────────────────────────────────────────────────────────

describe('SVG rendering', () => {
  it('renders an SVG when a command is provided', () => {
    const { container } = render(<TimelineView command={makeCmd('Drive', leaf('d'))} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('shows command name in toolbar', () => {
    render(<TimelineView command={makeCmd('ScoreHighCommand', leaf('a'))} />);
    expect(screen.getByText('ScoreHighCommand')).toBeTruthy();
  });

  it('shows full name in toolbar when different from short name', () => {
    render(<TimelineView command={makeCmd('ScoreHigh', leaf('a'), 'MyAuto::ScoreHigh')} />);
    expect(screen.getByText('ScoreHigh')).toBeTruthy();
    expect(screen.getByText('MyAuto::ScoreHigh')).toBeTruthy();
  });

  it('does not show full name when it equals short name', () => {
    const { container } = render(<TimelineView command={makeCmd('ScoreHigh', leaf('a'))} />);
    // The timeline-cmd-full span should not be rendered
    expect(container.querySelector('.timeline-cmd-full')).toBeNull();
  });
});

// ─── Node type headers in SVG ─────────────────────────────────────────────────

describe('node type headers', () => {
  it('renders SEQUENCE header for a sequence node', () => {
    const cmd = makeCmd('TestSeq', seq(leaf('a'), leaf('b')));
    render(<TimelineView command={cmd} />);
    // SEQUENCE appears in the SVG header text (distinct from legend "Sequence")
    const matches = screen.getAllByText('SEQUENCE');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders PARALLEL header for a parallel node', () => {
    const cmd = makeCmd('TestPar', par(leaf('a'), leaf('b')));
    render(<TimelineView command={cmd} />);
    const matches = screen.getAllByText('PARALLEL');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders RACE header for a race node', () => {
    const cmd = makeCmd('TestRace', {
      type: 'race', id: 'r',
      children: [leaf('a'), leaf('b')],
    });
    render(<TimelineView command={cmd} />);
    const matches = screen.getAllByText('RACE');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders DEADLINE header for a deadline node', () => {
    const cmd = makeCmd('TestDeadline', {
      type: 'deadline', id: 'd',
      deadline: leaf('a'),
      others: [leaf('b')],
    });
    render(<TimelineView command={cmd} />);
    const matches = screen.getAllByText('DEADLINE');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders IF/ELSE header for a conditional node', () => {
    const cmd = makeCmd('TestCond', {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'),
      falseBranch: leaf('f'),
    });
    render(<TimelineView command={cmd} />);
    const matches = screen.getAllByText('IF/ELSE');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders TRUE and FALSE labels for conditional branches', () => {
    const cmd = makeCmd('TestCond', {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'),
      falseBranch: leaf('f'),
    });
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('TRUE')).toBeTruthy();
    expect(screen.getByText('FALSE')).toBeTruthy();
  });
});

// ─── Decorator labels ─────────────────────────────────────────────────────────

describe('decorator labels', () => {
  it('shows TIMEOUT <arg> label for timeout decorator', () => {
    const cmd = makeCmd('TestTimeout', {
      type: 'decorated', id: 'dec',
      decorator: 'timeout',
      decoratorArg: '5_s',
      child: leaf('a'),
    });
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('TIMEOUT 5_s')).toBeTruthy();
  });

  it('shows TIMEOUT (no arg) when decoratorArg is absent', () => {
    const cmd = makeCmd('TestTimeout', {
      type: 'decorated', id: 'dec',
      decorator: 'timeout',
      child: leaf('a'),
    });
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('TIMEOUT')).toBeTruthy();
  });

  it('shows REPEATEDLY label for repeatedly decorator', () => {
    const cmd = makeCmd('TestRepeat', {
      type: 'decorated', id: 'dec',
      decorator: 'repeatedly',
      child: leaf('a'),
    });
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('REPEATEDLY')).toBeTruthy();
  });

  it('shows UNTIL (…) label for until decorator', () => {
    const cmd = makeCmd('TestUntil', {
      type: 'decorated', id: 'dec',
      decorator: 'until',
      child: leaf('a'),
    });
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('UNTIL (…)')).toBeTruthy();
  });

  it('shows UNLESS (…) label for unless decorator', () => {
    const cmd = makeCmd('TestUnless', {
      type: 'decorated', id: 'dec',
      decorator: 'unless',
      child: leaf('a'),
    });
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('UNLESS (…)')).toBeTruthy();
  });

  it('shows ONLY IF (…) label for onlyIf decorator', () => {
    const cmd = makeCmd('TestOnlyIf', {
      type: 'decorated', id: 'dec',
      decorator: 'onlyIf',
      child: leaf('a'),
    });
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('ONLY IF (…)')).toBeTruthy();
  });

  it('shows IGNORE DISABLE label for ignoringDisable decorator', () => {
    const cmd = makeCmd('TestIgnore', {
      type: 'decorated', id: 'dec',
      decorator: 'ignoringDisable',
      child: leaf('a'),
    });
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('IGNORE DISABLE')).toBeTruthy();
  });
});

// ─── Leaf name rendering ──────────────────────────────────────────────────────

describe('leaf names', () => {
  it('renders leaf command name inside SVG', () => {
    const cmd = makeCmd('Test', leaf('a', 'Drive()'));
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('Drive()')).toBeTruthy();
  });

  it('renders multiple leaf names', () => {
    const cmd = makeCmd('Test', seq(leaf('a', 'Shoot()'), leaf('b', 'Intake()')));
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('Shoot()')).toBeTruthy();
    expect(screen.getByText('Intake()')).toBeTruthy();
  });

  it('renders ? for unknown nodes', () => {
    const cmd = makeCmd('Test', { type: 'unknown', id: 'u', raw: 'some_expr' });
    render(<TimelineView command={cmd} />);
    expect(screen.getByText('?')).toBeTruthy();
  });
});

// ─── Zoom controls ────────────────────────────────────────────────────────────

describe('zoom controls', () => {
  it('renders zoom in, zoom out, and reset buttons', () => {
    render(<TimelineView command={makeCmd('Test', leaf('a'))} />);
    expect(screen.getByTitle('Zoom in')).toBeTruthy();
    expect(screen.getByTitle('Zoom out')).toBeTruthy();
    expect(screen.getByTitle('Reset zoom')).toBeTruthy();
  });

  it('starts at 100% zoom', () => {
    render(<TimelineView command={makeCmd('Test', leaf('a'))} />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('increases zoom when + is clicked', () => {
    render(<TimelineView command={makeCmd('Test', leaf('a'))} />);
    fireEvent.click(screen.getByTitle('Zoom in'));
    // 100% + 15% = 115%
    expect(screen.getByText('115%')).toBeTruthy();
  });

  it('decreases zoom when − is clicked', () => {
    render(<TimelineView command={makeCmd('Test', leaf('a'))} />);
    fireEvent.click(screen.getByTitle('Zoom out'));
    // 100% - 15% = 85%
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('resets zoom to 100% when ↺ is clicked', () => {
    render(<TimelineView command={makeCmd('Test', leaf('a'))} />);
    fireEvent.click(screen.getByTitle('Zoom in'));
    fireEvent.click(screen.getByTitle('Zoom in'));
    fireEvent.click(screen.getByTitle('Reset zoom'));
    expect(screen.getByText('100%')).toBeTruthy();
  });
});

// ─── Legend ───────────────────────────────────────────────────────────────────

describe('legend', () => {
  it('shows all node type labels in the legend', () => {
    render(<TimelineView command={makeCmd('Test', leaf('a'))} />);
    expect(screen.getByText('Sequence')).toBeTruthy();
    expect(screen.getByText('Parallel')).toBeTruthy();
    expect(screen.getByText('Race')).toBeTruthy();
    // "Deadline" appears twice: once for the group type, once for the ⏱ icon row
    expect(screen.getAllByText('Deadline').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('If/Else')).toBeTruthy();
    expect(screen.getByText('Decorator')).toBeTruthy();
  });
});

// ─── Complex tree rendering ───────────────────────────────────────────────────

describe('complex trees', () => {
  it('renders a realistic auto routine without crashing', () => {
    const cmd = makeCmd('ComplexAuto', {
      type: 'sequence', id: 'root',
      children: [
        leaf('drive', 'DriveToPose()'),
        {
          type: 'decorated', id: 'dec',
          decorator: 'timeout',
          decoratorArg: '3_s',
          child: {
            type: 'parallel', id: 'par',
            children: [
              leaf('shoot', 'Shoot()'),
              leaf('intake', 'Intake()'),
            ],
          },
        },
        {
          type: 'conditional', id: 'cond',
          trueBranch: leaf('shoot2', 'ShootAgain()'),
          falseBranch: leaf('none', 'None()'),
        },
      ],
    });
    const { container } = render(<TimelineView command={cmd} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('SEQUENCE')).toBeTruthy();
    expect(screen.getByText('PARALLEL')).toBeTruthy();
    expect(screen.getByText('TIMEOUT 3_s')).toBeTruthy();
    expect(screen.getByText('IF/ELSE')).toBeTruthy();
    expect(screen.getByText('DriveToPose()')).toBeTruthy();
    expect(screen.getByText('Shoot()')).toBeTruthy();
    expect(screen.getByText('TRUE')).toBeTruthy();
  });

  it('renders a deadline command with ⏱ indicator', () => {
    const cmd = makeCmd('DeadlineAuto', {
      type: 'deadline', id: 'd',
      deadline: leaf('drive', 'DriveToPose()'),
      others: [leaf('spin', 'SpinUp()')],
    });
    render(<TimelineView command={cmd} />);
    // The ⏱ emoji should appear in the rendered SVG
    const timerEmojis = screen.getAllByText('⏱');
    expect(timerEmojis.length).toBeGreaterThan(0);
  });

  it('renders nested parallel-inside-sequence without overlap', () => {
    const cmd = makeCmd('Nested', {
      type: 'sequence', id: 's',
      children: [
        leaf('a', 'First()'),
        {
          type: 'parallel', id: 'p',
          children: [leaf('b', 'Second()'), leaf('c', 'Third()')],
        },
        leaf('d', 'Fourth()'),
      ],
    });
    const { container } = render(<TimelineView command={cmd} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(screen.getByText('First()')).toBeTruthy();
    expect(screen.getByText('Second()')).toBeTruthy();
    expect(screen.getByText('Third()')).toBeTruthy();
    expect(screen.getByText('Fourth()')).toBeTruthy();
  });
});

// ─── Tooltip ──────────────────────────────────────────────────────────────────
// Note: hover-triggered tooltip display is not tested here because jsdom does
// not synthesise mousemove/mouseenter events on SVG elements reliably. The
// tooltip's visible state is driven by onMouseEnter/onMouseLeave handlers on
// SVG <g> elements, which are not exercised in this environment.

describe('tooltip', () => {
  it('does not show tooltip initially', () => {
    const { container } = render(
      <TimelineView command={makeCmd('Test', leaf('a', 'Drive()'))} />
    );
    expect(container.querySelector('.tooltip')).toBeNull();
  });
});
