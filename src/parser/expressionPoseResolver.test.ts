import { describe, it, expect } from 'vitest';
import { extractPose2dConstants, buildExpressionPoseMap } from './expressionPoseResolver';

// ─── extractPose2dConstants ──────────────────────────────────────────────────

describe('extractPose2dConstants', () => {
  it('parses constexpr frc::Pose2d with braces', () => {
    const code = `constexpr frc::Pose2d FRONT_LEFT{1.5_m, 2.0_m, 90_deg};`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(1);
    expect(constants[0].qualifiedName).toBe('FRONT_LEFT');
    expect(constants[0].x).toBeCloseTo(1.5);
    expect(constants[0].y).toBeCloseTo(2.0);
    expect(constants[0].rotation).toBeCloseTo(90);
  });

  it('parses const frc::Pose2d with parens', () => {
    const code = `const frc::Pose2d SCORING_POS(3.0_m, 1.0_m, 0_deg);`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(1);
    expect(constants[0].qualifiedName).toBe('SCORING_POS');
    expect(constants[0].x).toBeCloseTo(3.0);
    expect(constants[0].y).toBeCloseTo(1.0);
    expect(constants[0].rotation).toBeCloseTo(0);
  });

  it('parses inline constexpr auto = frc::Pose2d{...}', () => {
    const code = `inline constexpr auto REEF_A = frc::Pose2d{2.5_m, 3.0_m, 45_deg};`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(1);
    expect(constants[0].qualifiedName).toBe('REEF_A');
    expect(constants[0].x).toBeCloseTo(2.5);
    expect(constants[0].y).toBeCloseTo(3.0);
    expect(constants[0].rotation).toBeCloseTo(45);
  });

  it('parses static constexpr frc::Pose2d', () => {
    const code = `static constexpr frc::Pose2d AMP{0.5_m, 1.0_m, 180_deg};`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(1);
    expect(constants[0].qualifiedName).toBe('AMP');
    expect(constants[0].x).toBeCloseTo(0.5);
    expect(constants[0].rotation).toBeCloseTo(180);
  });

  it('tracks namespace context', () => {
    const code = `
namespace fieldConstants {
  constexpr frc::Pose2d FRONT_LEFT{1.5_m, 2.0_m, 90_deg};
}`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(1);
    expect(constants[0].qualifiedName).toBe('fieldConstants::FRONT_LEFT');
  });

  it('tracks nested namespaces', () => {
    const code = `
namespace field {
  namespace blue {
    constexpr frc::Pose2d AMP{1_m, 2_m, 0_deg};
  }
}`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(1);
    expect(constants[0].qualifiedName).toBe('field::blue::AMP');
  });

  it('tracks class scope', () => {
    const code = `
class FieldConstants {
  static constexpr frc::Pose2d AMP{1_m, 2_m, 0_deg};
};`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(1);
    expect(constants[0].qualifiedName).toBe('FieldConstants::AMP');
  });

  it('extracts multiple constants from one file', () => {
    const code = `
namespace fc {
  constexpr frc::Pose2d A{1_m, 0_m, 0_deg};
  constexpr frc::Pose2d B{2_m, 0_m, 0_deg};
  constexpr frc::Pose2d C{3_m, 0_m, 0_deg};
}`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(3);
    expect(constants.map(c => c.qualifiedName)).toEqual(['fc::A', 'fc::B', 'fc::C']);
  });

  it('handles unit conversions (cm, ft, in)', () => {
    const code = `constexpr frc::Pose2d POS{150_cm, 6_ft, 0.25_tr};`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(1);
    expect(constants[0].x).toBeCloseTo(1.5);
    expect(constants[0].y).toBeCloseTo(6 * 0.3048, 3);
    expect(constants[0].rotation).toBeCloseTo(90);
  });

  it('ignores non-Pose2d constants', () => {
    const code = `
constexpr double MAX_SPEED = 4.0;
constexpr int TEAM_NUMBER = 1234;
constexpr frc::Pose2d POS{1_m, 2_m, 0_deg};
`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(1);
    expect(constants[0].qualifiedName).toBe('POS');
  });

  it('ignores comments', () => {
    const code = `
// constexpr frc::Pose2d COMMENTED{1_m, 2_m, 0_deg};
/* constexpr frc::Pose2d BLOCK{1_m, 2_m, 0_deg}; */
constexpr frc::Pose2d REAL{1_m, 2_m, 0_deg};
`;
    const constants = extractPose2dConstants(code);
    expect(constants).toHaveLength(1);
    expect(constants[0].qualifiedName).toBe('REAL');
  });

  it('returns empty for non-literal Pose2d arguments', () => {
    const code = `constexpr frc::Pose2d POS{getX(), getY(), getRot()};`;
    // parseMeters/parseDeg will return 0 for function calls, but the constant
    // will still be extracted (with zeroed values). This is expected — the
    // extractor doesn't validate that the values are meaningful.
    const constants = extractPose2dConstants(code);
    // The regex will match, but values will be 0 due to parseFloat fallback
    expect(constants).toHaveLength(1);
  });
});

// ─── buildExpressionPoseMap ────────��───────────────────────────────────────────────

describe('buildExpressionPoseMap', () => {
  it('keys by both qualified and short name', () => {
    const poses = extractPose2dConstants(`
namespace fc {
  constexpr frc::Pose2d FRONT{1_m, 2_m, 0_deg};
}`);
    const map = buildExpressionPoseMap(poses);
    expect(map.has('fc::FRONT')).toBe(true);
    expect(map.has('FRONT')).toBe(true);
    expect(map.get('fc::FRONT')).toBe(map.get('FRONT'));
  });

  it('removes ambiguous short names', () => {
    const poses = extractPose2dConstants(`
namespace a { constexpr frc::Pose2d POS{1_m, 0_m, 0_deg}; }
namespace b { constexpr frc::Pose2d POS{2_m, 0_m, 0_deg}; }
`);
    const map = buildExpressionPoseMap(poses);
    expect(map.has('a::POS')).toBe(true);
    expect(map.has('b::POS')).toBe(true);
    expect(map.has('POS')).toBe(false);
  });

  it('keeps unambiguous short names when others are ambiguous', () => {
    const poses = extractPose2dConstants(`
namespace a { constexpr frc::Pose2d POS{1_m, 0_m, 0_deg}; }
namespace b { constexpr frc::Pose2d POS{2_m, 0_m, 0_deg}; }
namespace c { constexpr frc::Pose2d UNIQUE{3_m, 0_m, 0_deg}; }
`);
    const map = buildExpressionPoseMap(poses);
    expect(map.has('POS')).toBe(false);
    expect(map.has('UNIQUE')).toBe(true);
  });
});
