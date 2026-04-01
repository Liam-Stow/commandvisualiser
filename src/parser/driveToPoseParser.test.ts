import { describe, it, expect } from 'vitest';
import { extractWaypoints } from './driveToPoseParser';
import type {
  AnyCommandNode,
  LeafNode,
  SequenceNode,
  ParallelNode,
  RaceNode,
  DeadlineNode,
  DecoratedNode,
  ConditionalNode,
} from '../types/command';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function leaf(raw: string, name = 'cmd'): LeafNode {
  return { type: 'leaf', id: 'leaf-id', name, raw };
}

function seq(...children: AnyCommandNode[]): SequenceNode {
  return { type: 'sequence', id: 'seq-id', children };
}

function driveToPose(
  pose: string,
  speed = '1.0',
  posTol = '',
  rotTol = '',
  flip = ''
): LeafNode {
  const extras = [posTol, rotTol, flip].filter(Boolean);
  const args = [pose, speed, ...extras].join(', ');
  return leaf(`SubDrivebase::GetInstance().DriveToPose(${args})`, 'DriveToPose()');
}

// ─── Literal poses — unit conversions ─────────────────────────────────────────

describe('literal pose — unit conversions', () => {
  it('parses metres', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1.5_m, 2.0_m, 90_deg}'));
    expect(wp[0].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') {
      expect(wp[0].pose.x).toBeCloseTo(1.5);
      expect(wp[0].pose.y).toBeCloseTo(2.0);
      expect(wp[0].pose.rotation).toBeCloseTo(90);
    }
  });

  it('parses centimetres', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{150_cm, 200_cm, 0_deg}'));
    expect(wp[0].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') {
      expect(wp[0].pose.x).toBeCloseTo(1.5);
      expect(wp[0].pose.y).toBeCloseTo(2.0);
    }
  });

  it('parses feet', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{3_ft, 6_ft, 0_deg}'));
    expect(wp[0].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') {
      expect(wp[0].pose.x).toBeCloseTo(3 * 0.3048, 3);
      expect(wp[0].pose.y).toBeCloseTo(6 * 0.3048, 3);
    }
  });

  it('parses inches', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{60_in, 24_in, 0_deg}'));
    expect(wp[0].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') {
      expect(wp[0].pose.x).toBeCloseTo(60 * 0.0254, 3);
      expect(wp[0].pose.y).toBeCloseTo(24 * 0.0254, 3);
    }
  });

  it('parses degrees rotation', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 180_deg}'));
    expect(wp[0].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') {
      expect(wp[0].pose.rotation).toBeCloseTo(180);
    }
  });

  it('parses radians rotation', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 1.5708_rad}'));
    expect(wp[0].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') {
      expect(wp[0].pose.rotation).toBeCloseTo(90, 0);
    }
  });

  it('parses turns rotation (0.25 tr = 90 deg)', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 0.25_tr}'));
    expect(wp[0].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') {
      expect(wp[0].pose.rotation).toBeCloseTo(90, 1);
    }
  });

  it('parses negative angles', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, -45_deg}'));
    expect(wp[0].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') {
      expect(wp[0].pose.rotation).toBeCloseTo(-45);
    }
  });

  it('parses zero pose', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{0_m, 0_m, 0_deg}'));
    expect(wp).toHaveLength(1);
    expect(wp[0].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') {
      expect(wp[0].pose.x).toBe(0);
      expect(wp[0].pose.y).toBe(0);
      expect(wp[0].pose.rotation).toBe(0);
    }
  });
});

// ─── Paren-constructor pose ───────────────────────────────────────────────────

describe('paren-constructor frc::Pose2d(...)', () => {
  it('parses frc::Pose2d(x, y, rot) with parens', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d(1.5_m, 3.0_m, 45_deg)'));
    expect(wp[0].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') {
      expect(wp[0].pose.x).toBeCloseTo(1.5);
      expect(wp[0].pose.y).toBeCloseTo(3.0);
      expect(wp[0].pose.rotation).toBeCloseTo(45);
    }
  });
});

// ─── DriveToPose parameter parsing ───────────────────────────────────────────

describe('DriveToPose parameters', () => {
  it('reads speed scaling', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 0_deg}', '0.75'));
    expect(wp[0].speedScaling).toBeCloseTo(0.75);
  });

  it('uses default posTol=0.02m when not provided', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 0_deg}', '1.0'));
    expect(wp[0].posTolMeters).toBeCloseTo(0.02);
  });

  it('uses default rotTol=2.0 deg when not provided', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 0_deg}', '1.0'));
    expect(wp[0].rotTolDeg).toBeCloseTo(2.0);
  });

  it('uses default flipForRed=true when not provided', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 0_deg}', '1.0'));
    expect(wp[0].flipForRed).toBe(true);
  });

  it('reads explicit position tolerance in cm', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 0_deg}', '1.0', '5_cm'));
    expect(wp[0].posTolMeters).toBeCloseTo(0.05);
  });

  it('reads explicit rotation tolerance in degrees', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 0_deg}', '1.0', '2_cm', '5_deg'));
    expect(wp[0].rotTolDeg).toBeCloseTo(5.0);
  });

  it('reads flipForRed=false when explicitly false', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 0_deg}', '1.0', '2_cm', '2_deg', 'false'));
    expect(wp[0].flipForRed).toBe(false);
  });

  it('treats non-"false" flip arg as true', () => {
    const wp = extractWaypoints(driveToPose('frc::Pose2d{1_m, 1_m, 0_deg}', '1.0', '2_cm', '2_deg', 'true'));
    expect(wp[0].flipForRed).toBe(true);
  });
});

// ─── Non-drive leaves ─────────────────────────────────────────────────────────

describe('non-drive leaf commands', () => {
  it('returns empty array for unrelated subsystem call', () => {
    const wp = extractWaypoints(leaf('SubShooter::GetInstance().Shoot()'));
    expect(wp).toHaveLength(0);
  });

  it('returns empty array for Wait', () => {
    const wp = extractWaypoints(leaf('cmd::Wait(1_s)'));
    expect(wp).toHaveLength(0);
  });

  it('returns empty array for None', () => {
    const wp = extractWaypoints(leaf('cmd::None()'));
    expect(wp).toHaveLength(0);
  });
});

// ─── Tree walking ─────────────────────────────────────────────────────────────

describe('tree walking', () => {
  it('sequence: returns waypoints in child order', () => {
    const node = seq(
      driveToPose('frc::Pose2d{1_m, 0_m, 0_deg}'),
      leaf('SubShooter::GetInstance().Shoot()'),
      driveToPose('frc::Pose2d{3_m, 0_m, 0_deg}'),
    );
    const wp = extractWaypoints(node);
    expect(wp).toHaveLength(2);
    expect(wp[0].pose.kind).toBe('literal');
    expect(wp[1].pose.kind).toBe('literal');
    if (wp[0].pose.kind === 'literal') expect(wp[0].pose.x).toBeCloseTo(1.0);
    if (wp[1].pose.kind === 'literal') expect(wp[1].pose.x).toBeCloseTo(3.0);
  });

  it('parallel: collects waypoints from all children', () => {
    const node: ParallelNode = {
      type: 'parallel', id: 'p',
      children: [
        driveToPose('frc::Pose2d{1_m, 0_m, 0_deg}'),
        driveToPose('frc::Pose2d{2_m, 0_m, 0_deg}'),
      ],
    };
    expect(extractWaypoints(node)).toHaveLength(2);
  });

  it('race: collects waypoints from all children', () => {
    const node: RaceNode = {
      type: 'race', id: 'r',
      children: [
        driveToPose('frc::Pose2d{1_m, 0_m, 0_deg}'),
        leaf('cmd::Wait(5_s)'),
      ],
    };
    expect(extractWaypoints(node)).toHaveLength(1);
  });

  it('deadline: collects from deadline and others', () => {
    const node: DeadlineNode = {
      type: 'deadline', id: 'd',
      deadline: driveToPose('frc::Pose2d{1_m, 0_m, 0_deg}'),
      others: [leaf('SubShooter::GetInstance().Shoot()')],
    };
    expect(extractWaypoints(node)).toHaveLength(1);
  });

  it('decorated: walks into child', () => {
    const node: DecoratedNode = {
      type: 'decorated', id: 'dec',
      decorator: 'timeout',
      child: driveToPose('frc::Pose2d{1_m, 0_m, 0_deg}'),
    };
    expect(extractWaypoints(node)).toHaveLength(1);
  });

  it('conditional: collects from both branches', () => {
    const node: ConditionalNode = {
      type: 'conditional', id: 'c',
      trueBranch: driveToPose('frc::Pose2d{1_m, 0_m, 0_deg}'),
      falseBranch: driveToPose('frc::Pose2d{2_m, 0_m, 0_deg}'),
    };
    expect(extractWaypoints(node)).toHaveLength(2);
  });

  it('unknown node: returns empty', () => {
    expect(extractWaypoints({ type: 'unknown', id: 'u', raw: 'something' })).toHaveLength(0);
  });

  it('complex auto: 3 DriveToPose calls inside sequence/parallel', () => {
    const node = seq(
      driveToPose('frc::Pose2d{1_m, 0_m, 0_deg}'),
      {
        type: 'parallel',
        id: 'p',
        children: [
          driveToPose('frc::Pose2d{2_m, 1_m, 0_deg}'),
          leaf('SubShooter::GetInstance().Shoot()'),
        ],
      } as ParallelNode,
      driveToPose('frc::Pose2d{3_m, 0_m, 0_deg}'),
    );
    const wp = extractWaypoints(node);
    expect(wp).toHaveLength(3);
  });
});
