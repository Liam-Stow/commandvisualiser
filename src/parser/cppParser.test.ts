import { describe, it, expect } from 'vitest';
import { parseFile } from './cppParser';
import type {
  AnyCommandNode,
  SequenceNode,
  ParallelNode,
  RaceNode,
  DeadlineNode,
  DecoratedNode,
  ConditionalNode,
  LeafNode,
} from '../types/command';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wrap(expr: string, name = 'TestCmd', className?: string): string {
  const fullName = className ? `${className}::${name}` : name;
  return `frc2::CommandPtr ${fullName}() { return ${expr}; }`;
}

function parse(expr: string, name = 'TestCmd') {
  const result = parseFile('test.cpp', '/project/commands/test.cpp', wrap(expr, name));
  expect(result.functions).toHaveLength(1);
  return result.functions[0];
}

function parseNode(expr: string): AnyCommandNode {
  return parse(expr).node;
}

// ─── File metadata ─────────────────────────────────────────────────────────────

describe('file metadata', () => {
  it('detects commands category from path', () => {
    const result = parseFile('test.cpp', '/project/commands/test.cpp', '');
    expect(result.category).toBe('commands');
  });

  it('detects subsystems category from path', () => {
    const result = parseFile('sub.cpp', '/project/subsystems/SubDrivebase.cpp', '');
    expect(result.category).toBe('subsystems');
  });

  it('defaults to other category for unrecognised paths', () => {
    const result = parseFile('main.cpp', '/project/main.cpp', '');
    expect(result.category).toBe('other');
  });

  it('stores the file name', () => {
    const result = parseFile('auto.cpp', '/project/commands/auto.cpp', '');
    expect(result.fileName).toBe('auto.cpp');
  });

  it('returns empty functions for file with no CommandPtr', () => {
    const result = parseFile('util.cpp', '/project/util.cpp', 'int helper() { return 42; }');
    expect(result.functions).toHaveLength(0);
  });
});

// ─── Leaf commands ────────────────────────────────────────────────────────────

describe('leaf commands', () => {
  it('parses subsystem GetInstance method call', () => {
    const node = parseNode('SubDrivebase::GetInstance().Drive()') as LeafNode;
    expect(node.type).toBe('leaf');
    expect(node.name).toBe('Drive()');
    expect(node.subsystem).toBe('SubDrivebase');
  });

  it('parses subsystem method with different subsystem name', () => {
    const node = parseNode('SubShooter::GetInstance().Shoot()') as LeafNode;
    expect(node.type).toBe('leaf');
    expect(node.name).toBe('Shoot()');
    expect(node.subsystem).toBe('SubShooter');
  });

  it('parses frc2::cmd::Wait()', () => {
    const node = parseNode('frc2::cmd::Wait(1_s)') as LeafNode;
    expect(node.type).toBe('leaf');
    expect(node.name).toBe('Wait(1_s)');
    expect(node.subsystem).toBeUndefined();
  });

  it('parses cmd::Wait()', () => {
    const node = parseNode('cmd::Wait(2_s)') as LeafNode;
    expect(node.type).toBe('leaf');
    expect(node.name).toBe('Wait(2_s)');
  });

  it('parses plain Wait()', () => {
    const node = parseNode('Wait(500_ms)') as LeafNode;
    expect(node.type).toBe('leaf');
    expect(node.name).toBe('Wait(500_ms)');
  });

  it('parses cmd::None()', () => {
    const node = parseNode('cmd::None()') as LeafNode;
    expect(node.type).toBe('leaf');
    expect(node.name).toBe('None()');
  });

  it('parses cmd::WaitUntil()', () => {
    const node = parseNode('cmd::WaitUntil([this] { return sensor.get(); })') as LeafNode;
    expect(node.type).toBe('leaf');
    expect(node.name).toBe('WaitUntil()');
  });

  it('parses cmd::RunOnce()', () => {
    const node = parseNode('cmd::RunOnce([this] { shooter.stop(); })');
    expect(node.type).toBe('leaf');
    if (node.type === 'leaf') expect(node.name).toBe('RunOnce()');
  });

  it('parses cmd::Print()', () => {
    const node = parseNode('cmd::Print("hello")');
    expect(node.type).toBe('leaf');
    if (node.type === 'leaf') expect(node.name).toBe('Print()');
  });

  it('parses ScheduleCommand()', () => {
    const node = parseNode('frc2::ScheduleCommand(SubA::GetInstance().A())');
    expect(node.type).toBe('leaf');
    if (node.type === 'leaf') expect(node.name).toBe('ScheduleCommand()');
  });

  it('stores the raw expression on the leaf', () => {
    const fn = parse('SubDrivebase::GetInstance().Drive()');
    expect(fn.raw).toContain('SubDrivebase::GetInstance().Drive()');
  });
});

// ─── Sequence ─────────────────────────────────────────────────────────────────

describe('Sequence()', () => {
  it('parses 2-child Sequence()', () => {
    const node = parseNode('Sequence(SubA::GetInstance().A(), SubB::GetInstance().B())') as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(2);
    expect(node.children[0].type).toBe('leaf');
    expect(node.children[1].type).toBe('leaf');
  });

  it('parses 3-child Sequence()', () => {
    const node = parseNode('Sequence(SubA::GetInstance().A(), SubB::GetInstance().B(), SubC::GetInstance().C())') as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(3);
  });

  it('parses frc2::cmd::Sequence()', () => {
    const node = parseNode('frc2::cmd::Sequence(SubA::GetInstance().A(), SubB::GetInstance().B())');
    expect(node.type).toBe('sequence');
  });

  it('empty Sequence() falls back to leaf', () => {
    const node = parseNode('Sequence()');
    expect(node.type).toBe('leaf');
  });

  it('preserves child leaf names in order', () => {
    const node = parseNode('Sequence(SubA::GetInstance().A(), SubB::GetInstance().B())') as SequenceNode;
    expect((node.children[0] as LeafNode).name).toBe('A()');
    expect((node.children[1] as LeafNode).name).toBe('B()');
  });
});

// ─── AndThen chaining ─────────────────────────────────────────────────────────

describe('AndThen chaining', () => {
  it('chains two commands into a sequence', () => {
    const node = parseNode('SubA::GetInstance().A().AndThen(SubB::GetInstance().B())') as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(2);
  });

  it('flattens triple AndThen chain', () => {
    const node = parseNode(
      'SubA::GetInstance().A().AndThen(SubB::GetInstance().B()).AndThen(SubC::GetInstance().C())'
    ) as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(3);
  });

  it('flattens when LHS is already a Sequence()', () => {
    const node = parseNode(
      'Sequence(SubA::GetInstance().A(), SubB::GetInstance().B()).AndThen(SubC::GetInstance().C())'
    ) as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(3);
  });

  it('flattens when RHS is also a Sequence()', () => {
    const node = parseNode(
      'SubA::GetInstance().A().AndThen(Sequence(SubB::GetInstance().B(), SubC::GetInstance().C()))'
    ) as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(3);
  });
});

// ─── Parallel ─────────────────────────────────────────────────────────────────

describe('Parallel()', () => {
  it('parses 2-child Parallel()', () => {
    const node = parseNode('Parallel(SubA::GetInstance().A(), SubB::GetInstance().B())') as ParallelNode;
    expect(node.type).toBe('parallel');
    expect(node.children).toHaveLength(2);
  });

  it('parses 3-child Parallel()', () => {
    const node = parseNode(
      'Parallel(SubA::GetInstance().A(), SubB::GetInstance().B(), SubC::GetInstance().C())'
    ) as ParallelNode;
    expect(node.type).toBe('parallel');
    expect(node.children).toHaveLength(3);
  });

  it('empty Parallel() falls back to leaf', () => {
    const node = parseNode('Parallel()');
    expect(node.type).toBe('leaf');
  });
});

// ─── AlongWith chaining ───────────────────────────────────────────────────────

describe('AlongWith chaining', () => {
  it('creates parallel from two commands', () => {
    const node = parseNode('SubA::GetInstance().A().AlongWith(SubB::GetInstance().B())') as ParallelNode;
    expect(node.type).toBe('parallel');
    expect(node.children).toHaveLength(2);
  });

  it('flattens triple AlongWith chain', () => {
    const node = parseNode(
      'SubA::GetInstance().A().AlongWith(SubB::GetInstance().B()).AlongWith(SubC::GetInstance().C())'
    ) as ParallelNode;
    expect(node.type).toBe('parallel');
    expect(node.children).toHaveLength(3);
  });
});

// ─── Race ─────────────────────────────────────────────────────────────────────

describe('Race()', () => {
  it('parses Race()', () => {
    const node = parseNode('Race(SubA::GetInstance().A(), cmd::Wait(5_s))') as RaceNode;
    expect(node.type).toBe('race');
    expect(node.children).toHaveLength(2);
  });

  it('parses RaceWith chaining', () => {
    const node = parseNode('SubA::GetInstance().A().RaceWith(cmd::Wait(5_s))') as RaceNode;
    expect(node.type).toBe('race');
    expect(node.children).toHaveLength(2);
  });

  it('flattens triple RaceWith chain', () => {
    const node = parseNode(
      'SubA::GetInstance().A().RaceWith(SubB::GetInstance().B()).RaceWith(cmd::Wait(5_s))'
    ) as RaceNode;
    expect(node.type).toBe('race');
    expect(node.children).toHaveLength(3);
  });
});

// ─── Deadline ─────────────────────────────────────────────────────────────────

describe('Deadline()', () => {
  it('parses Deadline(A, B) — A is the deadline command', () => {
    const node = parseNode(
      'Deadline(SubA::GetInstance().A(), SubB::GetInstance().B())'
    ) as DeadlineNode;
    expect(node.type).toBe('deadline');
    expect(node.deadline.type).toBe('leaf');
    expect((node.deadline as LeafNode).name).toBe('A()');
    expect(node.others).toHaveLength(1);
    expect((node.others[0] as LeafNode).name).toBe('B()');
  });

  it('Deadline with multiple others', () => {
    const node = parseNode(
      'Deadline(SubA::GetInstance().A(), SubB::GetInstance().B(), SubC::GetInstance().C())'
    ) as DeadlineNode;
    expect(node.type).toBe('deadline');
    expect(node.others).toHaveLength(2);
  });

  it('DeadlineFor — current command is the deadline', () => {
    const node = parseNode(
      'SubA::GetInstance().A().DeadlineFor(SubB::GetInstance().B())'
    ) as DeadlineNode;
    expect(node.type).toBe('deadline');
    expect((node.deadline as LeafNode).name).toBe('A()');
    expect((node.others[0] as LeafNode).name).toBe('B()');
  });

  it('DeadlineWith — current command is the deadline', () => {
    const node = parseNode(
      'SubA::GetInstance().A().DeadlineWith(SubB::GetInstance().B())'
    ) as DeadlineNode;
    expect(node.type).toBe('deadline');
    expect((node.deadline as LeafNode).name).toBe('A()');
    expect((node.others[0] as LeafNode).name).toBe('B()');
  });

  it('WithDeadline — argument is the deadline', () => {
    const node = parseNode(
      'SubA::GetInstance().A().WithDeadline(SubB::GetInstance().B())'
    ) as DeadlineNode;
    expect(node.type).toBe('deadline');
    // B is the deadline, A runs alongside
    expect((node.deadline as LeafNode).name).toBe('B()');
    expect((node.others[0] as LeafNode).name).toBe('A()');
  });

  it('Deadline with a single arg has empty others array', () => {
    const node = parseNode('Deadline(SubA::GetInstance().A())') as DeadlineNode;
    expect(node.type).toBe('deadline');
    expect(node.others).toHaveLength(0);
  });
});

// ─── Decorated commands ───────────────────────────────────────────────────────

describe('decorators', () => {
  it('WithTimeout wraps in decorated with decorator="timeout"', () => {
    const node = parseNode('SubA::GetInstance().A().WithTimeout(3_s)') as DecoratedNode;
    expect(node.type).toBe('decorated');
    expect(node.decorator).toBe('timeout');
    expect(node.decoratorArg).toBe('3_s');
    expect(node.child.type).toBe('leaf');
  });

  it('Repeatedly wraps in decorated with decorator="repeatedly"', () => {
    const node = parseNode('SubA::GetInstance().A().Repeatedly()') as DecoratedNode;
    expect(node.type).toBe('decorated');
    expect(node.decorator).toBe('repeatedly');
    expect(node.child.type).toBe('leaf');
  });

  it('Until wraps in decorated with decorator="until"', () => {
    const node = parseNode('SubA::GetInstance().A().Until([this] { return done; })') as DecoratedNode;
    expect(node.type).toBe('decorated');
    expect(node.decorator).toBe('until');
  });

  it('Unless wraps in decorated with decorator="unless"', () => {
    const node = parseNode('SubA::GetInstance().A().Unless([this] { return disabled; })') as DecoratedNode;
    expect(node.type).toBe('decorated');
    expect(node.decorator).toBe('unless');
  });

  it('OnlyIf wraps in decorated with decorator="onlyIf"', () => {
    const node = parseNode('SubA::GetInstance().A().OnlyIf([this] { return enabled; })') as DecoratedNode;
    expect(node.type).toBe('decorated');
    expect(node.decorator).toBe('onlyIf');
  });

  it('IgnoringDisable wraps in decorated with decorator="ignoringDisable"', () => {
    const node = parseNode('SubA::GetInstance().A().IgnoringDisable(true)') as DecoratedNode;
    expect(node.type).toBe('decorated');
    expect(node.decorator).toBe('ignoringDisable');
  });

  it('FinallyDo creates a decorated node with decorator="FinallyDo"', () => {
    const node = parseNode('SubA::GetInstance().A().FinallyDo([this] { cleanup(); })') as DecoratedNode;
    expect(node.type).toBe('decorated');
    expect(node.decorator).toBe('FinallyDo');
  });

  it('WithTimeout applied to a group wraps the whole group', () => {
    const node = parseNode(
      'Sequence(SubA::GetInstance().A(), SubB::GetInstance().B()).WithTimeout(10_s)'
    ) as DecoratedNode;
    expect(node.type).toBe('decorated');
    expect(node.decorator).toBe('timeout');
    expect(node.decoratorArg).toBe('10_s');
    expect(node.child.type).toBe('sequence');
  });

  it('RepeatingSequence creates decorated/repeatedly wrapping a sequence', () => {
    const node = parseNode(
      'RepeatingSequence(SubA::GetInstance().A(), SubB::GetInstance().B())'
    ) as DecoratedNode;
    expect(node.type).toBe('decorated');
    expect(node.decorator).toBe('repeatedly');
    expect(node.child.type).toBe('sequence');
    expect((node.child as SequenceNode).children).toHaveLength(2);
  });
});

// ─── Conditional ──────────────────────────────────────────────────────────────

describe('conditional commands', () => {
  it('parses Either(trueBranch, falseBranch, condition)', () => {
    const node = parseNode(
      'Either(SubA::GetInstance().A(), SubB::GetInstance().B(), [this] { return flag; })'
    ) as ConditionalNode;
    expect(node.type).toBe('conditional');
    expect(node.trueBranch.type).toBe('leaf');
    expect(node.falseBranch.type).toBe('leaf');
    expect(node.condition).toBeDefined();
  });

  it('trueBranch is first argument', () => {
    const node = parseNode(
      'Either(SubA::GetInstance().A(), SubB::GetInstance().B(), [this] { return flag; })'
    ) as ConditionalNode;
    expect((node.trueBranch as LeafNode).name).toBe('A()');
    expect((node.falseBranch as LeafNode).name).toBe('B()');
  });

  it('parses frc2::ConditionalCommand', () => {
    const node = parseNode(
      'frc2::ConditionalCommand(SubA::GetInstance().A(), SubB::GetInstance().B(), [this] { return flag; })'
    ) as ConditionalNode;
    expect(node.type).toBe('conditional');
    expect(node.trueBranch.type).toBe('leaf');
    expect(node.falseBranch.type).toBe('leaf');
  });

  it('handles Either with complex branch expressions', () => {
    const node = parseNode(
      'Either(Sequence(SubA::GetInstance().A(), SubB::GetInstance().B()), cmd::None(), [this] { return hasNote; })'
    ) as ConditionalNode;
    expect(node.type).toBe('conditional');
    expect(node.trueBranch.type).toBe('sequence');
    expect(node.falseBranch.type).toBe('leaf');
  });
});

// ─── Complex nested compositions ──────────────────────────────────────────────

describe('complex nested compositions', () => {
  it('parses sequence of parallels', () => {
    const node = parseNode(`Sequence(
      Parallel(SubA::GetInstance().A(), SubB::GetInstance().B()),
      Parallel(SubC::GetInstance().C(), SubD::GetInstance().D())
    )`) as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(2);
    expect(node.children[0].type).toBe('parallel');
    expect(node.children[1].type).toBe('parallel');
  });

  it('parses parallel containing a race', () => {
    const node = parseNode(`Parallel(
      SubA::GetInstance().A(),
      Race(SubB::GetInstance().B(), cmd::Wait(5_s))
    )`) as ParallelNode;
    expect(node.type).toBe('parallel');
    expect(node.children[1].type).toBe('race');
  });

  it('parses sequence of deadline then conditional', () => {
    const node = parseNode(`Sequence(
      Deadline(SubA::GetInstance().A(), SubB::GetInstance().B()),
      Either(SubC::GetInstance().C(), cmd::None(), [this] { return done; })
    )`) as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children[0].type).toBe('deadline');
    expect(node.children[1].type).toBe('conditional');
  });

  it('parses realistic 4-step auto routine', () => {
    const node = parseNode(`Sequence(
      SubDrivebase::GetInstance().DriveToPose(frc::Pose2d{1_m, 2_m, 0_deg}, 1.0),
      Parallel(
        SubShooter::GetInstance().Shoot(),
        SubIntake::GetInstance().Intake()
      ).WithTimeout(3_s),
      cmd::Wait(0.5_s),
      Either(
        SubShooter::GetInstance().ShootAgain(),
        cmd::None(),
        [this] { return hasNote; }
      )
    )`) as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(4);
    expect(node.children[0].type).toBe('leaf');
    expect(node.children[1].type).toBe('decorated'); // parallel + WithTimeout
    if (node.children[1].type === 'decorated') {
      expect((node.children[1] as DecoratedNode).child.type).toBe('parallel');
    }
    expect(node.children[2].type).toBe('leaf');       // Wait
    expect(node.children[3].type).toBe('conditional');
  });

  it('parses deeply nested deadline-inside-sequence-inside-parallel', () => {
    const node = parseNode(`Parallel(
      SubA::GetInstance().A(),
      Sequence(
        SubB::GetInstance().B(),
        Deadline(
          SubC::GetInstance().C(),
          SubD::GetInstance().D().Repeatedly()
        )
      )
    )`) as ParallelNode;
    expect(node.type).toBe('parallel');
    const seqChild = node.children[1] as SequenceNode;
    expect(seqChild.type).toBe('sequence');
    const deadlineChild = seqChild.children[1] as DeadlineNode;
    expect(deadlineChild.type).toBe('deadline');
    expect((deadlineChild.others[0] as DecoratedNode).type).toBe('decorated');
  });

  it('parses AndThen chain mixing with group factories', () => {
    const node = parseNode(`Parallel(SubA::GetInstance().A(), SubB::GetInstance().B())
      .AndThen(SubC::GetInstance().C())
      .AndThen(SubD::GetInstance().D())`) as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(3);
    expect(node.children[0].type).toBe('parallel');
  });
});

// ─── cmd:: namespace variants ─────────────────────────────────────────────────

describe('cmd:: namespace variants', () => {
  it('parses cmd::Sequence()', () => {
    const node = parseNode('cmd::Sequence(SubA::GetInstance().A(), SubB::GetInstance().B())');
    expect(node.type).toBe('sequence');
  });

  it('parses cmd::Parallel()', () => {
    const node = parseNode('cmd::Parallel(SubA::GetInstance().A(), SubB::GetInstance().B())');
    expect(node.type).toBe('parallel');
  });

  it('parses cmd::Race()', () => {
    const node = parseNode('cmd::Race(SubA::GetInstance().A(), SubB::GetInstance().B())');
    expect(node.type).toBe('race');
  });

  it('parses cmd::Select as leaf', () => {
    const node = parseNode('cmd::Select<int>(commands, selector)');
    expect(node.type).toBe('leaf');
    if (node.type === 'leaf') expect(node.name).toBe('Select()');
  });

  it('parses frc2::cmd::Select as leaf', () => {
    const node = parseNode('frc2::cmd::Select<int>(commands, selector)');
    expect(node.type).toBe('leaf');
  });
});

// ─── Comment stripping ────────────────────────────────────────────────────────

describe('comment stripping', () => {
  it('strips line comments', () => {
    const code = `frc2::CommandPtr TestCmd() {
      // This whole line is a comment
      return Sequence(
        SubA::GetInstance().A(), // inline comment after command
        SubB::GetInstance().B()
      );
    }`;
    const result = parseFile('test.cpp', '/commands/test.cpp', code);
    expect(result.functions).toHaveLength(1);
    const node = result.functions[0].node as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(2);
  });

  it('strips block comments', () => {
    const code = `frc2::CommandPtr TestCmd() {
      return Sequence(
        SubA::GetInstance().A(), /* this is ignored */ SubB::GetInstance().B()
      );
    }`;
    const result = parseFile('test.cpp', '/commands/test.cpp', code);
    const node = result.functions[0].node as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(2);
  });

  it('does not strip content inside string literals', () => {
    const code = `frc2::CommandPtr TestCmd() {
      return cmd::Print("// not a comment");
    }`;
    const result = parseFile('test.cpp', '/commands/test.cpp', code);
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].node.type).toBe('leaf');
  });

  it('handles commented-out function that would otherwise be detected', () => {
    const code = `
      // frc2::CommandPtr FakeCmd() { return SubA::GetInstance().A(); }
      frc2::CommandPtr RealCmd() { return SubB::GetInstance().B(); }
    `;
    const result = parseFile('test.cpp', '/commands/test.cpp', code);
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].name).toBe('RealCmd');
  });
});

// ─── Multiple functions in one file ───────────────────────────────────────────

describe('multiple functions per file', () => {
  it('finds all CommandPtr functions', () => {
    const code = `
      frc2::CommandPtr CmdA() { return SubA::GetInstance().A(); }
      frc2::CommandPtr CmdB() { return SubB::GetInstance().B(); }
      frc2::CommandPtr CmdC() { return Sequence(SubA::GetInstance().A(), SubB::GetInstance().B()); }
    `;
    const result = parseFile('test.cpp', '/commands/test.cpp', code);
    expect(result.functions).toHaveLength(3);
    expect(result.functions[0].name).toBe('CmdA');
    expect(result.functions[1].name).toBe('CmdB');
    expect(result.functions[2].name).toBe('CmdC');
  });

  it('parses each function independently', () => {
    const code = `
      frc2::CommandPtr SimpleCmd() { return SubA::GetInstance().A(); }
      frc2::CommandPtr CompositeCmd() {
        return Parallel(
          SubA::GetInstance().A(),
          SubB::GetInstance().B()
        );
      }
    `;
    const result = parseFile('test.cpp', '/commands/test.cpp', code);
    expect(result.functions[0].node.type).toBe('leaf');
    expect(result.functions[1].node.type).toBe('parallel');
  });
});

// ─── Class method names ───────────────────────────────────────────────────────

describe('class method names', () => {
  it('extracts short name from Class::Method form', () => {
    const code = `frc2::CommandPtr MyAuto::ScoreHigh() { return SubA::GetInstance().A(); }`;
    const result = parseFile('test.cpp', '/commands/test.cpp', code);
    expect(result.functions[0].name).toBe('ScoreHigh');
    expect(result.functions[0].fullName).toBe('MyAuto::ScoreHigh');
  });

  it('handles methods without class prefix', () => {
    const code = `frc2::CommandPtr StandaloneCmd() { return SubA::GetInstance().A(); }`;
    const result = parseFile('test.cpp', '/commands/test.cpp', code);
    expect(result.functions[0].name).toBe('StandaloneCmd');
    expect(result.functions[0].fullName).toBe('StandaloneCmd');
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles empty Parallel() as leaf fallback', () => {
    const node = parseNode('Parallel()');
    expect(node.type).toBe('leaf');
  });

  it('handles empty Race() as leaf fallback', () => {
    const node = parseNode('Race()');
    expect(node.type).toBe('leaf');
  });

  it('handles nested lambdas in decorator args without mis-splitting', () => {
    // The lambda contains a comma which should not split the arguments
    const node = parseNode(
      'SubA::GetInstance().A().Until([this]() { return a > 0 && b > 0; })'
    );
    expect(node.type).toBe('decorated');
    if (node.type === 'decorated') expect(node.decorator).toBe('until');
  });

  it('handles deeply nested lambdas in Sequence args', () => {
    const node = parseNode(
      'Sequence(cmd::RunOnce([this] { if (x) { y = 1; } }), SubB::GetInstance().B())'
    ) as SequenceNode;
    expect(node.type).toBe('sequence');
    expect(node.children).toHaveLength(2);
  });

  it('handles frc::Pose2d arguments inside a leaf without mis-parsing', () => {
    // DriveToPose has braces inside its args — should still be a leaf
    const node = parseNode(
      'SubDrivebase::GetInstance().DriveToPose(frc::Pose2d{1_m, 2_m, 90_deg}, 0.8)'
    );
    expect(node.type).toBe('leaf');
    if (node.type === 'leaf') expect(node.name).toBe('DriveToPose()');
  });

  it('handles function with non-command return (no CommandPtr match)', () => {
    const code = `int helper() { return 42; }`;
    const result = parseFile('helper.cpp', '/helper.cpp', code);
    expect(result.functions).toHaveLength(0);
  });
});
